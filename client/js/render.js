// Motor de render: estado del juego, predicción propia, interpolación, dibujo
const G = {
  playing: false, dead: false, mode: 'arena', team: 0, myId: 0, party: null,
  foods: new Map(), potions: new Map(), worms: new Map(),
  self: { ready: false, x: 0, y: 0, angle: 0, path: [], mass: 20, r: 12, kills: 0,
          fx: { spd: 0, agi: 0, mag: 0, zm: 0, mult: 0, mt: 0 }, fxAt: 0, corrX: 0, corrY: 0 },
  lb: [], teamScores: null, heat: [], off: null,
  cam: { x: 0, y: 0, zoom: 1 },
  showNames: true,
};

const Render = (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let vignette = null, bgPattern = null;

  function resize() {
    W = canvas.width = innerWidth; H = canvas.height = innerHeight;
    // viñeta pre-renderizada
    vignette = document.createElement('canvas');
    vignette.width = W; vignette.height = H;
    const g = vignette.getContext('2d');
    const grad = g.createRadialGradient(W/2, H/2, Math.min(W,H)*0.42, W/2, H/2, Math.max(W,H)*0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(8,5,16,.42)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  }
  window.addEventListener('resize', resize);
  resize();

  // ===== Tile de fondo confeti (patrón en espacio de mundo) =====
  function makeBgTile() {
    const t = document.createElement('canvas');
    t.width = t.height = 260;
    const g = t.getContext('2d');
    const colors = ['rgba(255,255,255,.05)', 'rgba(255,210,63,.06)', 'rgba(46,194,126,.06)',
                    'rgba(58,160,255,.06)', 'rgba(255,93,143,.06)', 'rgba(201,91,255,.05)'];
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 260, y = Math.random() * 260;
      g.fillStyle = colors[i % colors.length];
      g.save(); g.translate(x, y); g.rotate(Math.random() * Math.PI);
      if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, 3 + Math.random() * 2.5, 0, 7); g.fill(); }
      else g.fillRect(-7, -2, 14, 4);
      g.restore();
    }
    return t;
  }
  bgPattern = ctx.createPattern(makeBgTile(), 'repeat');

  // ===== Sprites de comida glossy (56px) =====
  function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
  }
  function gloss(g, s) { // brillo superior compartido
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath(); g.ellipse(s*0.38, s*0.3, s*0.16, s*0.09, -0.5, 0, 7); g.fill();
  }
  const foodSprites = [
    sprite(56, (g, s) => { // candy
      g.fillStyle = '#ff5d8f';
      g.beginPath(); g.moveTo(s*0.28, s*0.42); g.lineTo(s*0.04, s*0.28); g.lineTo(s*0.04, s*0.66); g.lineTo(s*0.28, s*0.56); g.fill();
      g.beginPath(); g.moveTo(s*0.72, s*0.42); g.lineTo(s*0.96, s*0.28); g.lineTo(s*0.96, s*0.66); g.lineTo(s*0.72, s*0.56); g.fill();
      const gr = g.createRadialGradient(s*0.4, s*0.36, 2, s*0.5, s*0.5, s*0.3);
      gr.addColorStop(0, '#ff9dbe'); gr.addColorStop(1, '#e8366f');
      g.fillStyle = gr;
      g.beginPath(); g.arc(s/2, s*0.48, s*0.27, 0, 7); g.fill();
      gloss(g, s);
    }),
    sprite(56, (g, s) => { // cookie
      const gr = g.createRadialGradient(s*0.42, s*0.38, 2, s*0.5, s*0.5, s*0.36);
      gr.addColorStop(0, '#e2a563'); gr.addColorStop(1, '#a3652f');
      g.fillStyle = gr; g.beginPath(); g.arc(s/2, s/2, s*0.35, 0, 7); g.fill();
      g.fillStyle = '#4a2c15';
      [[.38,.38],[.6,.42],[.42,.6],[.62,.62],[.5,.5]].forEach(p => { g.beginPath(); g.arc(s*p[0], s*p[1], s*0.055, 0, 7); g.fill(); });
      gloss(g, s);
    }),
    sprite(56, (g, s) => { // donut
      const gr = g.createRadialGradient(s*0.42, s*0.4, 2, s*0.5, s*0.5, s*0.38);
      gr.addColorStop(0, '#f5c87e'); gr.addColorStop(1, '#c98f3f');
      g.fillStyle = gr; g.beginPath(); g.arc(s/2, s/2, s*0.37, 0, 7); g.fill();
      g.fillStyle = '#ff8fb5';
      g.beginPath(); g.arc(s/2, s*0.48, s*0.29, 0, 7); g.fill();
      g.fillStyle = '#1a1626'; g.beginPath(); g.arc(s/2, s*0.48, s*0.12, 0, 7); g.fill();
      const sp = ['#fff','#37e2d5','#ffd23f','#39d353'];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        g.fillStyle = sp[i % 4];
        g.save(); g.translate(s/2 + Math.cos(a)*s*0.21, s*0.48 + Math.sin(a)*s*0.21); g.rotate(a);
        g.fillRect(-3, -1, 6, 2); g.restore();
      }
      gloss(g, s);
    }),
    sprite(56, (g, s) => { // chocolate
      const gr = g.createLinearGradient(0, s*0.28, 0, s*0.72);
      gr.addColorStop(0, '#8d5a33'); gr.addColorStop(1, '#5b3a1e');
      g.fillStyle = gr; g.beginPath(); g.roundRect(s*0.18, s*0.28, s*0.64, s*0.44, 6); g.fill();
      g.strokeStyle = '#3d2412'; g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(s*0.39, s*0.28); g.lineTo(s*0.39, s*0.72);
      g.moveTo(s*0.61, s*0.28); g.lineTo(s*0.61, s*0.72); g.stroke();
      gloss(g, s);
    }),
    sprite(56, (g, s) => { // cake
      g.fillStyle = '#fff5f8';
      g.beginPath(); g.moveTo(s*0.5, s*0.14); g.lineTo(s*0.87, s*0.76); g.lineTo(s*0.13, s*0.76); g.closePath(); g.fill();
      g.fillStyle = '#ff8fa3';
      g.beginPath(); g.moveTo(s*0.5, s*0.14); g.lineTo(s*0.87, s*0.76); g.lineTo(s*0.13, s*0.76); g.closePath();
      g.save(); g.clip();
      g.fillRect(0, s*0.42, s, s*0.1); g.fillRect(0, s*0.62, s, s*0.1);
      g.restore();
      g.fillStyle = '#e33'; g.beginPath(); g.arc(s*0.5, s*0.15, s*0.08, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(s*0.47, s*0.12, s*0.03, 0, 7); g.fill();
    }),
  ];
  // Halo dorado para comida de cadáver
  const goldHalo = sprite(96, (g, s) => {
    const gr = g.createRadialGradient(s/2, s/2, s*0.1, s/2, s/2, s*0.5);
    gr.addColorStop(0, 'rgba(255,215,80,.55)');
    gr.addColorStop(0.55, 'rgba(255,180,40,.22)');
    gr.addColorStop(1, 'rgba(255,180,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  // Halo suave para toda la comida
  const softHalo = sprite(64, (g, s) => {
    const gr = g.createRadialGradient(s/2, s/2, s*0.08, s/2, s/2, s*0.5);
    gr.addColorStop(0, 'rgba(255,255,255,.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const potionSprites = {};
  for (const [k, p] of Object.entries(CONST.POTION_TYPES)) {
    potionSprites[k] = sprite(48, (g, s) => {
      const gr = g.createRadialGradient(s/2, s*0.55, 4, s/2, s*0.55, s*0.42);
      gr.addColorStop(0, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s); // aura
      g.fillStyle = 'rgba(230,240,255,.35)'; g.fillRect(s*0.42, s*0.06, s*0.16, s*0.22);
      g.fillStyle = p.color;
      g.beginPath(); g.roundRect(s*0.24, s*0.26, s*0.52, s*0.6, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.roundRect(s*0.31, s*0.33, s*0.11, s*0.38, 6); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(s*0.24, s*0.26, s*0.52, s*0.6, 10); g.stroke();
    });
  }

  // ===== Curvas del cuerpo: tabla de longitud de arco + spline Catmull-Rom =====
  function curveOf(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return { pts, cum, total: cum[cum.length - 1] || 1 };
  }
  function sampleCurve(c, f) {
    const target = f * c.total;
    const pts = c.pts, cum = c.cum;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const i1 = Math.max(1, i), i0 = i1 - 1;
    const segLen = cum[i1] - cum[i0] || 1;
    const t = (target - cum[i0]) / segLen;
    const p0 = pts[Math.max(0, i0 - 1)], p1 = pts[i0];
    const p2 = pts[Math.min(pts.length - 1, i1)], p3 = pts[Math.min(pts.length - 1, i1 + 1)];
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    };
  }

  // ===== Snapshots =====
  // Streaming de trayectoria: si viene `p` (sync completo) se carga el path;
  // si no, se añade la cabeza y se recorta a lengthOf(mass) — misma lógica que el server.
  function trimPath(path, mass) {
    const maxLen = CONST.lengthOf(mass);
    let acc = 0, cut = path.length;
    for (let i = 1; i < path.length; i++) {
      acc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (acc > maxLen) { cut = i + 1; break; }
    }
    if (cut < path.length) path.length = cut;
  }
  function pathToPts(path) {
    const pts = new Array(path.length);
    for (let i = 0; i < path.length; i++) pts[i] = [path[i].x, path[i].y];
    return pts;
  }
  function onSnap(m) {
    const now = performance.now();
    // reloj del SERVIDOR: interpolar contra él elimina los microtirones por jitter de red
    const off = m.now - now;
    G.off = G.off === null ? off : G.off * 0.92 + off * 0.08;
    const seen = new Set();
    for (const w of m.w) {
      seen.add(w.i);
      let e = G.worms.get(w.i);
      if (!e) { e = { prev: null, cur: null, born: now, path: [] }; G.worms.set(w.i, e); }
      // reconstruir trayectoria local
      if (w.p && w.p.length) {
        e.path = w.p.map((pt) => ({ x: pt[0], y: pt[1] }));
      } else if (typeof w.x === 'number') {
        const hx = w.x, hy = w.y;
        const h0 = e.path[0];
        if (!h0 || h0.x !== hx || h0.y !== hy) e.path.unshift({ x: hx, y: hy });
        if (!e.path.length) {
          // fallback: línea corta detrás de la cabeza
          e.path = [{ x: hx, y: hy }];
          for (let i = 1; i <= 12; i++) e.path.push({ x: hx - i * 8, y: hy });
        }
        trimPath(e.path, w.m);
      }
      const pts = pathToPts(e.path);
      e.prev = e.cur;
      e.cur = { ...w, p: pts, ts: now, tsS: m.now, crv: curveOf(pts) };
      if (!e.prev) e.prev = e.cur;
    }
    for (const id of [...G.worms.keys()]) {
      if (!seen.has(id)) {
        const e = G.worms.get(id);
        if (now - e.cur.ts > 600) G.worms.delete(id);
      }
    }
    if (m.e) {
      for (const ev of m.e) {
        if (ev[0] === 'f+') G.foods.set(ev[1], { id: ev[1], x: ev[2], y: ev[3], v: ev[4], t: ev[5], s: ev[6] || 0 });
        else if (ev[0] === 'f-') G.foods.delete(ev[1]);
        else if (ev[0] === 'd') {
          if (ev[2] === G.myId && ev[1] !== G.myId) AudioFX.kill();
          // confeti con los colores de la skin del que murió (si estaba visible)
          const e = G.worms.get(ev[1]);
          if (e && e.cur.p && e.cur.p.length) {
            const d = Skins.def(e.cur.s, e.cur.c);
            Particles.confetti(e.cur.p[0][0], e.cur.p[0][1], [d.c1, d.c2, d.c3], 45);
          }
        }
        else if (ev[0] === 'pot') {
          AudioFX.potion();
          Particles.ring(G.self.x, G.self.y, '#fff', 140, 0.5);
        }
      }
    }
    const S = G.self, me = m.me;
    S.kills = me.k;
    const oldMass = S.mass;
    S.mass = me.m;
    // efectos de crecimiento
    const delta = me.m - oldMass;
    if (S.ready && delta > 0.5) {
      AudioFX.eat();
      Particles.burst(S.x, S.y, delta >= 10 ? '#ffd23f' : '#fff', delta >= 10 ? 10 : 4);
      if (delta >= 6) Particles.floatText(S.x, S.y - S.r * 2, '+' + Math.round(delta), delta >= 15 ? '#ffd23f' : '#9fe8ff', delta >= 15 ? 34 : 24);
      if (delta >= 15) { Particles.ring(S.x, S.y, '#ffd23f', S.r * 5, 0.6); AudioFX.potion(); }
    }
    S.fx = me.fx; S.fxAt = now;
    if (!S.ready) {
      S.ready = true; S.x = me.x; S.y = me.y; S.angle = me.a;
      S.path = [{ x: me.x, y: me.y }];
      for (let i = 1; i <= 12; i++) S.path.push({ x: me.x - Math.cos(me.a) * 8 * i, y: me.y - Math.sin(me.a) * 8 * i });
    } else if (!G.dead) {
      // Reconciliación SOLO de cabeza, distribuida en el tiempo: el cuerpo
      // nunca se arrastra (eso causaba los tirones). Teletransporte si es enorme.
      const dx = me.x - S.x, dy = me.y - S.y;
      const err = Math.hypot(dx, dy);
      if (err > 400) {
        for (const p of S.path) { p.x += dx; p.y += dy; }
        S.x += dx; S.y += dy;
        S.corrX = S.corrY = 0;
      } else {
        S.corrX = dx; S.corrY = dy;
      }
    }
    G.lb = m.lb || [];
    G.teamScores = m.ts || null;
    if (m.hm) G.heat = m.hm;
  }

  function onJoin(m) {
    G.playing = true; G.dead = false; G.mode = m.mode; G.team = m.team; G.myId = m.id;
    G.party = m.party || null;
    G.foods.clear(); G.potions.clear(); G.worms.clear();
    for (const f of m.foods) G.foods.set(f[0], { id: f[0], x: f[1], y: f[2], v: f[3], t: f[4], s: f[5] || 0 });
    const S = G.self;
    S.ready = false; S.mass = CONST.START_MASS; S.kills = 0;
    S.fx = { spd: 0, agi: 0, mag: 0, zm: 0, mult: 0, mt: 0 };
    S.corrX = S.corrY = 0;
    G.cam.zoom = 1;
    Particles.clear();
  }

  function reset() {
    G.playing = false; G.dead = false;
    G.worms.clear(); G.foods.clear(); G.potions.clear();
    G.self.ready = false;
    Particles.clear();
    AudioFX.boost(false);
  }

  // ===== Predicción del gusano propio =====
  let trailAcc = 0;
  function predict(dt) {
    const S = G.self;
    if (!S.ready || !G.playing || G.dead) return;
    const now = performance.now();
    const el = (now - S.fxAt) / 1000;
    const fx = {
      spd: Math.max(0, S.fx.spd - el), agi: Math.max(0, S.fx.agi - el),
      mag: Math.max(0, S.fx.mag - el), zm: Math.max(0, (S.fx.zm || 0) - el),
      mult: S.fx.mt - el > 0 ? S.fx.mult : 0,
    };
    S.liveFx = fx;
    const targetA = Input.computeAngle(W / 2, H / 2);
    const boosting = Input.boost && S.mass > CONST.MIN_BOOST_MASS;
    AudioFX.boost(boosting);

    // corrección de cabeza pendiente (suave, ~250ms) — el cuerpo no se toca
    if (S.corrX || S.corrY) {
      const k = Math.min(1, dt * 4);
      S.x += S.corrX * k; S.y += S.corrY * k;
      S.corrX *= (1 - k); S.corrY *= (1 - k);
      if (Math.hypot(S.corrX, S.corrY) < 0.5) { S.corrX = S.corrY = 0; }
    }

    let diff = targetA - S.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = (fx.agi > 0 ? CONST.AGI_TURN_RATE : CONST.TURN_RATE) * dt;
    if (diff > maxTurn) diff = maxTurn; else if (diff < -maxTurn) diff = -maxTurn;
    S.angle += diff;

    let sp = CONST.BASE_SPEED;
    if (boosting) sp *= CONST.BOOST_MULT;
    if (fx.spd > 0) sp *= CONST.SPD_POTION_MULT;
    S.x += Math.cos(S.angle) * sp * dt;
    S.y += Math.sin(S.angle) * sp * dt;
    S.path.unshift({ x: S.x, y: S.y });
    const maxLen = CONST.lengthOf(S.mass);
    let acc = 0, cut = S.path.length;
    for (let i = 1; i < S.path.length; i++) {
      acc += Math.hypot(S.path[i].x - S.path[i-1].x, S.path[i].y - S.path[i-1].y);
      if (acc > maxLen) { cut = i + 1; break; }
    }
    if (cut < S.path.length) S.path.length = cut;
    S.r = CONST.radiusOf(S.mass);

    // estela de boost PRO: chispas + líneas de velocidad laterales
    if (boosting) {
      trailAcc += dt;
      if (trailAcc > 0.03) {
        trailAcc = 0;
        const bx = S.x - Math.cos(S.angle) * S.r * 1.5;
        const by = S.y - Math.sin(S.angle) * S.r * 1.5;
        Particles.trail(bx, by, Math.random() < 0.5 ? '#ffe97a' : '#ffffff');
        for (const side of [-1, 1]) {
          const a = S.angle + Math.PI + side * (0.5 + Math.random() * 0.5);
          const px = S.x + Math.cos(S.angle + side * Math.PI / 2) * S.r * 0.9;
          const py = S.y + Math.sin(S.angle + side * Math.PI / 2) * S.r * 0.9;
          Particles.streak(px, py, a, 320, side < 0 ? 'rgba(255,233,122,.9)' : 'rgba(120,230,255,.9)');
        }
      }
    }
    Net.sendInput(S.angle, boosting);
  }

  // ===== Interpolación de otros gusanos: paramétrica por longitud de arco =====
  // (los cuerpos se muestrean por fracción de longitud → sin bloques, sin vibración,
  //  y el cuerpo COMPLETO siempre visible, incluso en gigantes)
  const BODY_SAMPLES = 80;
  function interpBody(e, renderTimeS) {
    const a = e.prev, b = e.cur;
    if (!a || !b || !a.crv || !b.crv || !b.crv.pts.length) return { pts: [], r: (b && b.r) || 12 };
    let alpha = b.tsS > a.tsS ? (renderTimeS - a.tsS) / (b.tsS - a.tsS) : 1;
    alpha = Math.max(0, Math.min(1, alpha));
    const ca = a.crv, cb = b.crv;
    const out = new Array(BODY_SAMPLES);
    for (let i = 0; i < BODY_SAMPLES; i++) {
      const f = i / (BODY_SAMPLES - 1);
      const pa = sampleCurve(ca, f), pb = sampleCurve(cb, f);
      out[i] = { x: pa.x + (pb.x - pa.x) * alpha, y: pa.y + (pb.y - pa.y) * alpha };
    }
    return { pts: out, r: a.r + (b.r - a.r) * alpha };
  }

  // ===== Dibujo =====
  let boostRamp = 0; // 0→1 suave para efectos de turbo
  function draw(dt) {
    const S = G.self;
    const now = performance.now();
    const selfBoost = G.playing && !G.dead && Input.boost && S.mass > CONST.MIN_BOOST_MASS;
    boostRamp += ((selfBoost ? 1 : 0) - boostRamp) * Math.min(1, (dt || 0.016) * 6);

    G.cam.x += (S.x - G.cam.x) * 0.15;
    G.cam.y += (S.y - G.cam.y) * 0.15;
    const zmF = (S.liveFx && S.liveFx.zm > 0) ? (CONST.POTION_TYPES.zm.zoom || 1.5) : 1;
    const targetZoom = (CONST.zoomOf(S.r) / zmF) * (1 - 0.07 * boostRamp); // FOV kick al turbo
    G.cam.zoom += (targetZoom - G.cam.zoom) * 0.06;
    const z = G.cam.zoom;

    ctx.fillStyle = '#221c33';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-G.cam.x, -G.cam.y);

    const vx = G.cam.x - W / 2 / z, vy = G.cam.y - H / 2 / z;
    const vw = W / z, vh = H / z;
    const inView = (x, y, m) => x > vx - m && x < vx + vw + m && y > vy - m && y < vy + vh + m;

    // fondo confeti (en espacio de mundo)
    ctx.fillStyle = bgPattern;
    ctx.fillRect(vx, vy, vw, vh);

    // borde del mundo: franjas animadas + zona roja exterior + ANILLO DE PELIGRO INTERIOR
    const WR = CONST.WORLD_RADIUS;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.arc(0, 0, WR, 0, Math.PI * 2, true);
    const red = ctx.createRadialGradient(0, 0, WR * 0.85, 0, 0, WR * 1.3);
    red.addColorStop(0, 'rgba(160,25,40,.25)');
    red.addColorStop(1, 'rgba(90,8,18,.6)');
    ctx.fillStyle = red;
    ctx.fill('evenodd');
    ctx.restore();
    // anillo de advertencia DENTRO del mundo (visible desde lejos)
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, WR, 0, Math.PI * 2);
    ctx.arc(0, 0, WR - 320, 0, Math.PI * 2, true);
    const warn = ctx.createRadialGradient(0, 0, WR - 320, 0, 0, WR);
    warn.addColorStop(0, 'rgba(224,57,62,0)');
    warn.addColorStop(1, 'rgba(224,57,62,.28)');
    ctx.fillStyle = warn;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#e0393e';
    ctx.lineWidth = 12;
    ctx.setLineDash([46, 30]);
    ctx.lineDashOffset = -now / 25;
    ctx.beginPath(); ctx.arc(0, 0, WR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(224,57,62,.35)';
    ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(0, 0, WR + 8, 0, Math.PI * 2); ctx.stroke();

    // comida (más grande, con pulso y halo)
    for (const f of G.foods.values()) {
      if (!inView(f.x, f.y, 80)) continue;
      const spr = foodSprites[f.t] || foodSprites[0];
      const pulse = 1 + 0.09 * Math.sin(now / 350 + f.id);
      const sz = (14 + f.v * 7) * pulse;
      if (f.s) { // comida de cadáver: halo dorado + destellos giratorios
        const hs = sz * 3.4 * (1 + 0.12 * Math.sin(now / 280 + f.id));
        ctx.drawImage(goldHalo, f.x - hs / 2, f.y - hs / 2, hs, hs);
        ctx.fillStyle = '#fff8d0';
        for (let k = 0; k < 3; k++) {
          const a = now / 500 + f.id + k * (Math.PI * 2 / 3);
          const rr = sz * 1.1;
          const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
          const ss = 3 + 2 * Math.sin(now / 150 + k + f.id);
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, ss), 0, 7); ctx.fill();
        }
      } else {
        ctx.drawImage(softHalo, f.x - sz, f.y - sz, sz * 2, sz * 2);
      }
      ctx.drawImage(spr, f.x - sz / 2, f.y - sz / 2, sz, sz);
    }
    // pociones
    for (const p of G.potions.values()) {
      if (!inView(p.x, p.y, 80)) continue;
      const spr = potionSprites[p.k];
      if (spr) {
        ctx.save();
        ctx.translate(p.x, p.y + Math.sin(now / 500 + p.id) * 5);
        ctx.rotate(Math.sin(now / 600 + p.id) * 0.18);
        ctx.drawImage(spr, -24, -24, 48, 48);
        ctx.restore();
      }
    }

    const renderTimeS = now + (G.off || 0) - 150; // tiempo de render contra el reloj del servidor

    // otros gusanos + flechas a amigos fuera de pantalla
    const friendOff = [];
    for (const e of G.worms.values()) {
      if (e.cur.i === G.myId) continue;
      const { pts, r } = interpBody(e, renderTimeS);
      if (!pts.length) continue;
      let vis = false;
      for (let i = 0; i < pts.length; i++) {
        if (inView(pts[i].x, pts[i].y, 300)) { vis = true; break; }
      }
      if (vis) {
        drawWorm(pts, r, e.cur.s, e.cur.c, e.cur.w, e.cur.n, e.cur.t, e.cur.b, e.born, !!e.cur.f);
      } else if (e.cur.f) {
        friendOff.push(pts[0]);
      }
    }
    // mi gusano (predicho) — no dibujar si estoy muerto (cámara de muerte)
    if (S.ready && G.playing && !G.dead) {
      const pts = [];
      const step = Math.max(1, Math.floor(S.path.length / 80));
      for (let i = 0; i < S.path.length; i += step) pts.push(S.path[i]);
      drawWorm(pts, S.r, My.skin, My.customSkin, My.wear, My.name, G.team, Input.boost);
      if (S.liveFx && S.liveFx.mag > 0) {
        ctx.strokeStyle = 'rgba(201,91,255,.4)';
        ctx.lineWidth = 5;
        ctx.setLineDash([24, 18]);
        ctx.lineDashOffset = -now / 20;
        ctx.beginPath(); ctx.arc(S.x, S.y, CONST.MAGNET_RADIUS, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // partículas (en espacio de mundo)
    Particles.draw(ctx);
    ctx.restore();

    // líneas de velocidad en los bordes de la pantalla (turbo pro)
    if (boostRamp > 0.05) {
      ctx.save();
      ctx.globalAlpha = 0.35 * boostRamp;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const cx = W / 2, cy = H / 2;
      const R0 = Math.hypot(cx, cy) * 0.62;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + (now / 900) % (Math.PI * 2 / 20);
        const sp = (now * 1.1 + i * 137) % 260;
        const r1 = R0 + sp, r2 = r1 + 46 + 40 * boostRamp;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineCap = 'butt';
    }

    // viñeta + flechas a amigos + minimapa (espacio de pantalla)
    if (vignette) ctx.drawImage(vignette, 0, 0);
    if (friendOff.length) drawFriendArrows(friendOff);
    if (G.playing) drawMinimap();
  }

  // Flechas en el borde apuntando a amigos fuera de pantalla
  function drawFriendArrows(heads) {
    const margin = 36;
    const cx = W / 2, cy = H / 2;
    for (const h of heads) {
      const sx = (h.x - G.cam.x) * G.cam.zoom + cx;
      const sy = (h.y - G.cam.y) * G.cam.zoom + cy;
      const dx = sx - cx, dy = sy - cy;
      const ang = Math.atan2(dy, dx);
      // intersección con el rectángulo de pantalla
      const tan = Math.tan(ang);
      let ax, ay;
      if (Math.abs(dx) * (H / 2 - margin) > Math.abs(dy) * (W / 2 - margin)) {
        ax = dx > 0 ? W - margin : margin;
        ay = cy + tan * (ax - cx);
      } else {
        ay = dy > 0 ? H - margin : margin;
        ax = cx + (ay - cy) / (tan || 1e-6);
      }
      ax = Math.max(margin, Math.min(W - margin, ax));
      ay = Math.max(margin, Math.min(H - margin, ay));
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#3dd68c';
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.lineTo(-10, -10);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // blob naranja para el mapa de calor (pre-renderizado)
  const heatBlob = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,90,30,.9)');
    gr.addColorStop(0.5, 'rgba(255,60,30,.4)');
    gr.addColorStop(1, 'rgba(255,60,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return c;
  })();

  // ===== Minimapa circular: mi posición + MAPA DE CALOR de culebras =====
  function drawMinimap() {
    const R = Math.max(64, Math.min(95, W * 0.085));
    const cx = W - R - 16, cy = H - R - 16;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(15,11,25,.72)';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // mapa de calor 12×12 (dónde hay más culebras)
    if (G.heat && G.heat.length === 144) {
      const cell = (R * 2) / 12;
      for (let i = 0; i < 144; i++) {
        const v = G.heat[i];
        if (v < 20) continue;
        const gx = i % 12, gy = Math.floor(i / 12);
        const x = cx - R + gx * cell + cell / 2, y = cy - R + gy * cell + cell / 2;
        ctx.globalAlpha = Math.min(0.75, (v / 255) * 0.9);
        const bs = cell * 2.6;
        ctx.drawImage(heatBlob, x - bs / 2, y - bs / 2, bs, bs);
      }
      ctx.globalAlpha = 1;
    }
    // cruz de referencia (centro del mundo y ejes)
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
    // yo + amigos de party: puntos verdes
    const S = G.self;
    if (S.ready) {
      const x = cx + (S.x / CONST.WORLD_RADIUS) * R;
      const y = cy + (S.y / CONST.WORLD_RADIUS) * R;
      ctx.strokeStyle = '#2ec27e'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(S.angle) * 11, y + Math.sin(S.angle) * 11); ctx.stroke();
      ctx.fillStyle = '#3dd68c';
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const e of G.worms.values()) {
      if (!e.cur.f || e.cur.i === G.myId) continue;
      const hx = e.path && e.path[0] ? e.path[0].x : e.cur.x;
      const hy = e.path && e.path[0] ? e.path[0].y : e.cur.y;
      if (hx == null) continue;
      const fx = cx + (hx / CONST.WORLD_RADIUS) * R;
      const fy = cy + (hy / CONST.WORLD_RADIUS) * R;
      ctx.fillStyle = '#3dd68c';
      ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#e0393e';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.stroke();
  }

  function drawWorm(pts, r, skin, custom, wear, name, team, boosting, born, friend) {
    if (!pts || pts.length < 2) return;
    const d = Skins.def(skin, custom);
    const h = pts[0];
    const ang = Math.atan2(h.y - pts[1].y, h.x - pts[1].x);
    // fade-in de aparición (nadie "sale de la nada": emergen suavemente)
    let alphaIn = 1;
    if (born) {
      const t = Math.min(1, (performance.now() - born) / 450);
      alphaIn = 0.15 + 0.85 * t;
      r = r * (0.45 + 0.55 * t);
    }
    ctx.save();
    ctx.globalAlpha = alphaIn;
    // motion blur: copia fantasma del cuerpo desplazada hacia atrás
    if (boosting && pts.length > 1) {
      const gx = -Math.cos(ang) * r * 1.5, gy = -Math.sin(ang) * r * 1.5;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = r * 1.9;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x + gx, pts[0].y + gy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + gx, pts[i].y + gy);
      ctx.stroke();
      ctx.restore();
    }
    Skins.drawBody(ctx, pts, r, d);
    // estelas de velocidad al hacer boost
    if (boosting) {
      ctx.strokeStyle = 'rgba(255,240,180,.45)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const a = ang + Math.PI + i * 0.35;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * r * 1.4, h.y + Math.sin(a) * r * 1.4);
        ctx.lineTo(h.x + Math.cos(a) * r * 3.4, h.y + Math.sin(a) * r * 3.4);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    // anillo de equipo o de amigo (party)
    if (friend) {
      ctx.strokeStyle = 'rgba(61,214,140,.95)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.35, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.35, 0, Math.PI * 2); ctx.stroke();
    } else if (team) {
      ctx.strokeStyle = team === 1 ? 'rgba(255,93,93,.8)' : 'rgba(58,160,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, h.y, r * 1.25, 0, Math.PI * 2); ctx.stroke();
    }
    Skins.drawEyes(ctx, h.x, h.y, r * 0.95, ang);
    Skins.drawWear(ctx, h.x, h.y, r * 0.95, ang, wear);
    if (G.showNames && name) {
      ctx.font = `800 ${Math.max(13, r * 0.85)}px 'Baloo 2', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      const ny = h.y - r * 1.9;
      ctx.strokeText(name, h.x, ny);
      ctx.fillStyle = friend ? '#3dd68c' : team === 1 ? '#ff8a8a' : team === 2 ? '#8ac4ff' : '#fff';
      ctx.fillText(name, h.x, ny);
    }
    ctx.restore(); // fade-in
  }

  // ===== Loop principal =====
  let lastT = performance.now();
  function loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (G.playing) {
      predict(dt);
      Particles.update(dt);
      draw(dt);
    } else {
      ctx.fillStyle = '#1a1626';
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(loop);
  }

  return { onSnap, onJoin, reset, start: () => requestAnimationFrame(loop) };
})();

// Pociones llegan dentro del snapshot; las extraemos aquí para mantener Render simple
(() => {
  const orig = Render.onSnap;
  Render.onSnap = (m) => {
    if (m.po) {
      G.potions.clear();
      for (const p of m.po) G.potions.set(p[0], { id: p[0], x: p[1], y: p[2], k: p[3] });
    }
    orig(m);
  };
})();
