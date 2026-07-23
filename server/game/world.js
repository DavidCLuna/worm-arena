const C = require('../../shared/constants.js');
const Worm = require('./worm.js');
const SpatialHash = require('./spatial.js');
const botai = require('./botai.js');

let foodId = 1, potionId = 1;

function pickFoodType() {
  const total = C.FOOD_TYPES.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < C.FOOD_TYPES.length; i++) {
    r -= C.FOOD_TYPES[i].w;
    if (r <= 0) return i;
  }
  return 0;
}
function pickPotionType() {
  const keys = Object.keys(C.POTION_TYPES);
  const total = keys.reduce((s, k) => s + C.POTION_TYPES[k].w, 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= C.POTION_TYPES[k].w; if (r <= 0) return k; }
  return keys[0];
}
function randPos(margin = 200) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (C.WORLD_RADIUS - margin);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

// Tamaños de bots por niveles: el leaderboard siempre tiene variedad,
// con gigantes de miles/pocas decenas de miles como en wormate
function botMass() {
  const r = Math.random();
  if (r < 0.38) return 50 + Math.random() * 250;        // pequeños
  if (r < 0.68) return 300 + Math.random() * 1200;      // medianos
  if (r < 0.88) return 1500 + Math.random() * 4500;     // grandes (miles)
  if (r < 0.97) return 6000 + Math.random() * 14000;    // enormes (miles)
  return 20000 + Math.random() * 40000;                 // gigantes (decenas de miles)
}

class World {
  // mode: 'arena' (FFA) | 'teams' (rojo vs azul)
  constructor(mode) {
    this.mode = mode;
    this.worms = new Map();   // id -> Worm
    this.foods = new Map();   // id -> {id,x,y,v,t}
    this.potions = new Map(); // id -> {id,x,y,k}
    this.bodyGrid = new SpatialHash(110); // puntos de cuerpo (reconstruido cada tick)
    this.foodGrid = new SpatialHash(150); // comida estática
    this.events = [];         // eventos del tick para net.js [{k:'death',...}]
    for (let i = 0; i < C.FOOD_TARGET; i++) this.spawnFood();
    for (let i = 0; i < C.POTION_TARGET; i++) this.spawnPotion();
  }

  // special=1 → comida de cadáver (brillante, con halo dorado en el cliente)
  spawnFood(x, y, v, t, special) {
    const p = x === undefined ? randPos() : { x, y };
    const type = t === undefined ? pickFoodType() : t;
    const f = { id: foodId++, x: p.x, y: p.y, v: v === undefined ? C.FOOD_TYPES[type].v : v, t: type, s: special ? 1 : 0 };
    this.foods.set(f.id, f);
    this.foodGrid.insert(f.x, f.y, f);
    this.events.push({ k: 'f+', f });
    return f;
  }
  removeFood(id) {
    const f = this.foods.get(id);
    if (f) { this.foods.delete(id); this.events.push({ k: 'f-', id }); }
  }
  spawnPotion() {
    const p = randPos(400);
    const po = { id: potionId++, x: p.x, y: p.y, k: pickPotionType() };
    this.potions.set(po.id, po);
  }

  queryFoods(x, y, r) { return this.foodGrid.query(x, y, r); }
  queryBodies(x, y, r) { return this.bodyGrid.query(x, y, r); }

  freeSpawn() {
    for (let i = 0; i < 25; i++) {
      const p = randPos(600);
      let ok = true;
      for (const w of this.worms.values()) {
        if (Math.hypot(w.head.x - p.x, w.head.y - p.y) < 700) { ok = false; break; }
      }
      if (ok) return p;
    }
    return randPos(800);
  }

  addPlayer(opts) {
    const p = this.freeSpawn();
    if (this.mode === 'teams') {
      let r = 0, b = 0;
      for (const w of this.worms.values()) { if (w.team === 1) r++; else if (w.team === 2) b++; }
      opts.team = r <= b ? 1 : 2;
    }
    const w = new Worm({ ...opts, x: p.x, y: p.y });
    this.worms.set(w.id, w);
    return w;
  }

  addBot(usedNames) {
    const p = this.freeSpawn();
    const bot = new Worm({
      name: botai.botName(usedNames), isBot: true, x: p.x, y: p.y,
      skin: Math.floor(Math.random() * C.SKINS.length),
      mass: botMass(),
      team: this.mode === 'teams' ? (Math.random() < 0.5 ? 1 : 2) : 0,
    });
    bot.aiNext = 0;
    this.worms.set(bot.id, bot);
    return bot;
  }

  entityCount() { return this.worms.size; }
  humanCount() { let n = 0; for (const w of this.worms.values()) if (!w.isBot) n++; return n; }

  // Convierte el cuerpo de un gusano muerto en comida
  dropBody(w) {
    // tope de seguridad: no inflar el mundo con festines infinitos
    if (this.foods.size > C.FOOD_TARGET * 1.5) return;
    const step = Math.max(2, Math.floor(w.path.length / 70));
    for (let i = 0; i < w.path.length; i += step) {
      const p = w.path[i];
      // tope 10 por pieza: así el radio de recogida coincide con el tamaño dibujado
      const v = Math.max(2, Math.min(10, Math.round(w.mass / 45)));
      const type = Math.random() < 0.5 ? 2 : 4; // donuts y pasteles
      this.spawnFood(p.x + (Math.random() - 0.5) * 24, p.y + (Math.random() - 0.5) * 24, v, type, 1);
    }
  }

  kill(w, killer) {
    if (!w.alive) return;
    w.alive = false;
    w.killedBy = killer && killer !== w ? killer.name : '';
    this.dropBody(w);
    if (killer && killer !== w && killer.alive) {
      killer.kills++;
      // "Headshot": la víctima chocó contra la zona de la cabeza del killer
      var headshot = false;
      for (let i = 0; i < Math.min(4, killer.path.length); i++) {
        const p = killer.path[i];
        if (Math.hypot(p.x - w.head.x, p.y - w.head.y) < killer.r * 1.2) { headshot = true; break; }
      }
      this.events.push({ k: 'death', id: w.id, by: killer.id, hs: headshot, name: w.name, byName: killer.name });
    } else {
      this.events.push({ k: 'death', id: w.id, by: 0, hs: false, name: w.name, byName: '' });
    }
  }

  tick(dt, now) {
    this.events.length = 0;

    // 1) IA de bots (a intervalos)
    for (const w of this.worms.values()) {
      if (w.isBot && w.alive && now >= w.aiNext) {
        w.aiNext = now + 220 + Math.random() * 120;
        botai.think(w, this, now);
      }
    }

    // 2) Mover gusanos + comida de boost
    for (const w of this.worms.values()) {
      if (!w.alive) continue;
      const drop = w.update(dt, now);
      if (drop) this.spawnFood(drop.x, drop.y, drop.v, drop.t);
    }

    // 3) Reconstruir grid de cuerpos (excluye solo los 2 puntos más cercanos a la cabeza)
    this.bodyGrid.clear();
    for (const w of this.worms.values()) {
      if (!w.alive) continue;
      const bodyR = w.r * 0.8;
      for (let i = 2; i < w.path.length; i += 2) {
        const p = w.path[i];
        p.worm = w; p.br = bodyR;
        this.bodyGrid.insert(p.x, p.y, p);
      }
    }

    // 4) REGLA DE ORO de colisiones:
    //    - Pierde EL QUE TOCA CON SU CABEZA el cuerpo o la cabeza de otro.
    //    - Cuerpo contra cuerpo NO hace nada.
    //    - Si ambos se tocan a la vez → mueren los dos.
    //    (Cortar el paso con tu cuerpo mata al otro, nunca a ti.)
    const q = [];
    const aliveList = [...this.worms.values()].filter(w => w.alive);
    for (const w of aliveList) {
      if (!w.alive) continue;
      const h = w.head, hr = w.r * 0.75;
      // borde del mundo
      if (Math.hypot(h.x, h.y) > C.WORLD_RADIUS - w.r * 0.4) { this.kill(w, null); continue; }
      // cabeza vs cuerpo ajeno
      q.length = 0;
      this.bodyGrid.query(h.x, h.y, hr + 90, q);
      let dead = false;
      for (const p of q) {
        if (p.worm === w) continue;
        if (this.mode === 'teams' && w.team && p.worm.team === w.team) continue;
        const rr = hr + (p.br || 10) * 0.85;
        if (Math.hypot(p.x - h.x, p.y - h.y) < rr) { this.kill(w, p.worm); dead = true; break; }
      }
      if (dead) continue;
      // cabeza vs cabeza por DIRECCIÓN: pierde EL QUE CONDUCE SU CABEZA HACIA LA OTRA.
      // Si tu cabeza toca de lado la frente del otro → él pierde, tú no.
      // Frontal mutuo → gana el más grande (±25% → ambos mueren).
      for (const o of aliveList) {
        if (o === w || !o.alive) continue;
        if (this.mode === 'teams' && w.team && o.team === w.team) continue;
        const dx = o.head.x - h.x, dy = o.head.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d > (w.r + o.r) * 0.75) continue;
        const norm = (x) => { while (x > Math.PI) x -= Math.PI * 2; while (x < -Math.PI) x += Math.PI * 2; return x; };
        const CONE = 1.2; // ~69°: cono frontal de "voy hacia él"
        const angToO = Math.atan2(dy, dx);
        const wInto = Math.abs(norm(angToO - w.angle)) < CONE;          // ¿w conduce hacia o?
        const angToW = angToO + Math.PI;
        const oInto = Math.abs(norm(angToW - o.angle)) < CONE;          // ¿o conduce hacia w?
        if (wInto && oInto) {
          if (w.mass > o.mass * 1.25) { this.kill(o, w); }
          else if (o.mass > w.mass * 1.25) { this.kill(w, o); }
          else { this.kill(w, o); this.kill(o, w); }
        } else if (wInto) { this.kill(w, o); }
        else if (oInto) { this.kill(o, w); }
        // roce lateral puro (ninguno va hacia el otro) → no pasa nada
        break;
      }
    }

    // 5) Comer comida (+ imán). Reconstruir grid: el imán movió comida el tick anterior
    this.foodGrid.clear();
    for (const f of this.foods.values()) this.foodGrid.insert(f.x, f.y, f);
    for (const w of this.worms.values()) {
      if (!w.alive) continue;
      const h = w.head;
      const magnet = now < w.fx.mag;
      const eatR = w.r + 8;
      q.length = 0;
      // radio de consulta amplio: la recogida usa el tamaño VISUAL de la comida
      this.foodGrid.query(h.x, h.y, magnet ? C.MAGNET_RADIUS : eatR + 60, q);
      for (const f of q) {
        if (!this.foods.has(f.id)) continue;
        const d = Math.hypot(f.x - h.x, f.y - h.y);
        // recogida alineada con lo que se ve: radio dibujado ≈ 7 + v*3.5
        if (d < eatR + 7 + f.v * 3.5) {
          w.addMass(f.v, now);
          this.removeFood(f.id);
        } else if (magnet && d < C.MAGNET_RADIUS && d > 1) {
          // el imán desplaza la comida hacia la cabeza
          const pull = (C.MAGNET_PULL * dt) / d;
          f.x += (h.x - f.x) * pull; f.y += (h.y - f.y) * pull;
        }
      }
      // 6) Tomar pociones
      for (const po of this.potions.values()) {
        if (Math.hypot(po.x - h.x, po.y - h.y) < w.r + 16) {
          w.applyPotion(po.k, now);
          this.potions.delete(po.id);
          this.events.push({ k: 'pot', id: w.id, pot: po.k });
        }
      }
    }

    // 7) Reponer comida y pociones
    while (this.foods.size < C.FOOD_TARGET) this.spawnFood();
    while (this.potions.size < C.POTION_TARGET) this.spawnPotion();

    // 8) Eliminar muertos
    for (const w of [...this.worms.values()]) {
      if (!w.alive) this.worms.delete(w.id);
    }
  }

  leaderboard() {
    const arr = [...this.worms.values()]
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 10)
      .map(w => ({ n: w.name, m: w.score, t: w.team }));
    return arr;
  }

  teamScores() {
    let r = 0, b = 0;
    for (const w of this.worms.values()) {
      if (w.team === 1) r += w.score; else if (w.team === 2) b += w.score;
    }
    return [Math.floor(r), Math.floor(b)];
  }

  // Rango de visión: crece con el tamaño del gusano (pequeña ve MENOS que grande).
  // Se sincroniza con el zoom del cliente: R = diagPantalla * multZoomPocion / zoom(radio)
  viewRangeOf(viewer, now) {
    const diag = (viewer.client && viewer.client.screenDiag) || 1250;
    const zm = now < viewer.fx.zm ? (C.POTION_TYPES.zm.zoom || 1.5) : 1;
    // margen generoso: que todo se renderice ANTES de entrar a tu pantalla
    return Math.min(C.WORLD_RADIUS * 1.1, Math.max(1300, diag * zm / C.zoomOf(viewer.r) + 500));
  }



  // Mapa de calor 12×12 del mundo (dónde hay más culebras). Se recalcula cada 2s.
  heatmap(now) {
    if (!this._hmAt || now - this._hmAt > 2000) {
      this._hmAt = now;
      const G = 12, cells = new Array(G * G).fill(0);
      for (const w of this.worms.values()) {
        const cx = Math.max(0, Math.min(G - 1, Math.floor((w.head.x / C.WORLD_RADIUS * 0.5 + 0.5) * G)));
        const cy = Math.max(0, Math.min(G - 1, Math.floor((w.head.y / C.WORLD_RADIUS * 0.5 + 0.5) * G)));
        cells[cy * G + cx] += 30 + Math.min(200, w.mass / 40);
      }
      this._hm = cells.map(v => Math.min(255, Math.round(v)));
    }
    return this._hm;
  }

  // Snapshot filtrado por cercanía al espectador (interest management)
  snapshotFor(viewer, now) {
    const h = viewer.head, R = this.viewRangeOf(viewer, now);
    this.heatmap(now); // recalcular mapa de calor si toca (cada 2s)
    // ids de gusanos con CUALQUIER parte del cuerpo dentro del rango,
    // usando el grid de colisiones (denso) — así un gigante NUNCA es invisible.
    // Margen amplio: aparecen en pantalla ANTES de poder tocarse contigo.
    const nearIds = new Set();
    const probe = [];
    this.bodyGrid.query(h.x, h.y, R * 1.35, probe);
    for (const p of probe) {
      if (Math.hypot(p.x - h.x, p.y - h.y) <= R * 1.35) nearIds.add(p.worm.id);
    }
    const worms = [];
    for (const w of this.worms.values()) {
      const pts = w.samplePoints();
      const near = w === viewer || nearIds.has(w.id) ||
                   Math.hypot(w.head.x - h.x, w.head.y - h.y) <= R * 1.7;
      if (!near) continue;
      worms.push({
        i: w.id, n: w.name, m: Math.round(w.mass), r: Math.round(w.r * 10) / 10,
        s: w.skin, c: w.customSkin, w: w.wear, t: w.team, b: w.boosting ? 1 : 0,
        p: pts,
      });
    }
    const potions = [];
    for (const po of this.potions.values()) {
      if (Math.hypot(po.x - h.x, po.y - h.y) <= R) potions.push([po.id, Math.round(po.x), Math.round(po.y), po.k]);
    }
    return {
      t: 's', now,
      me: {
        i: viewer.id, m: Math.round(viewer.mass), k: viewer.kills,
        x: Math.round(h.x), y: Math.round(h.y), a: Math.round(viewer.angle * 100) / 100,
        fx: {
          spd: Math.max(0, (viewer.fx.spd - now) / 1000),
          agi: Math.max(0, (viewer.fx.agi - now) / 1000),
          mag: Math.max(0, (viewer.fx.mag - now) / 1000),
          zm: Math.max(0, (viewer.fx.zm - now) / 1000),
          mult: now < viewer.fx.multUntil ? viewer.fx.mult : 0,
          mt: Math.max(0, (viewer.fx.multUntil - now) / 1000),
        },
      },
      w: worms, po: potions, lb: this.leaderboard(),
      ts: this.mode === 'teams' ? this.teamScores() : undefined,
      hm: this._hmAt === now ? this._hm : undefined, // mapa de calor solo cuando se refresca
    };
  }

  allFoods() {
    const out = [];
    for (const f of this.foods.values()) out.push([f.id, Math.round(f.x), Math.round(f.y), f.v, f.t, f.s]);
    return out;
  }
}

module.exports = World;
