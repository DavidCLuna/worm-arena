const C = require('../../shared/constants.js');

let nextId = 1;

class Worm {
  constructor(opts) {
    this.id = nextId++;
    this.name = opts.name || 'Worm';
    this.skin = opts.skin || 0;          // índice de skin o -1 = custom
    this.customSkin = opts.customSkin || null; // {p,c1,c2,c3} si custom
    this.wear = opts.wear || 'none';
    this.team = opts.team || 0;          // 0=FFA, 1=rojo, 2=azul
    this.isBot = !!opts.isBot;
    this.client = null;                  // ref al socket (net.js)
    this.alive = true;

    this.mass = opts.mass || C.START_MASS;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.boosting = false;
    this.kills = 0;
    this.spawnTime = Date.now();
    this.boostDropAcc = 0;
    // Personalidad (bots): 0.4 = cauteloso, 1.0 = muy agresivo
    this.agro = opts.agro !== undefined ? opts.agro : 0.4 + Math.random() * 0.6;

    // Efectos activos: timestamp (ms) de expiración; mult = multiplicador de crecimiento
    this.fx = { spd: 0, agi: 0, mag: 0, zm: 0, mult: 1, multUntil: 0 };

    // Construir path inicial (línea recta detrás de la cabeza)
    const x = opts.x, y = opts.y;
    this.path = [{ x, y }];
    const step = 8;
    const n = Math.ceil(C.lengthOf(this.mass) / step);
    for (let i = 1; i <= n; i++) {
      this.path.push({ x: x - Math.cos(this.angle) * step * i, y: y - Math.sin(this.angle) * step * i });
    }
  }

  get r() { return C.radiusOf(this.mass); }
  get len() { return C.lengthOf(this.mass); }
  get head() { return this.path[0]; }
  get score() { return Math.floor(this.mass); }

  speed(now) {
    let s = C.BASE_SPEED;
    if (this.boosting) s *= C.BOOST_MULT;
    if (now < this.fx.spd) s *= C.SPD_POTION_MULT;
    return s;
  }
  turnRate(now) { return now < this.fx.agi ? C.AGI_TURN_RATE : C.TURN_RATE; }
  growthMult(now) { return now < this.fx.multUntil ? this.fx.mult : 1; }

  applyPotion(type, now) {
    const P = C.POTION_TYPES[type];
    if (!P) return;
    const dur = (P.durMin + Math.random() * (P.durMax - P.durMin)) * 1000;
    if (type === 'spd') this.fx.spd = now + dur;
    else if (type === 'agi') this.fx.agi = now + dur;
    else if (type === 'mag') this.fx.mag = now + dur;
    else if (type === 'zm') this.fx.zm = now + dur;
    else { this.fx.mult = P.mult; this.fx.multUntil = now + dur; }
  }

  addMass(v, now) { this.mass += v * this.growthMult(now) * C.GROWTH_GAIN; }

  // Avanza la simulación del gusano. Devuelve comida generada por boost (o null).
  update(dt, now) {
    // Giro limitado hacia targetAngle
    let diff = this.targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = this.turnRate(now) * dt;
    if (diff > maxTurn) diff = maxTurn; else if (diff < -maxTurn) diff = -maxTurn;
    this.angle += diff;

    // Boost: drena masa; se corta si no hay masa suficiente
    let drop = null;
    if (this.boosting) {
      if (this.mass <= C.MIN_BOOST_MASS) {
        this.boosting = false;
      } else {
        // drena MÁS de lo que vale el rastro que suelta (si no, boostear en círculo imprime masa)
        this.mass = Math.max(C.MIN_BOOST_MASS * 0.6, this.mass - (C.BOOST_BASE_DRAIN + this.mass * C.BOOST_DRAIN) * dt);
        this.boostDropAcc += dt;
        if (this.boostDropAcc >= C.BOOST_DROP_EVERY) {
          this.boostDropAcc = 0;
          const tail = this.path[this.path.length - 1];
          drop = { x: tail.x + (Math.random() - 0.5) * 10, y: tail.y + (Math.random() - 0.5) * 10, v: 1, t: 0 };
        }
      }
    }

    // Mover cabeza
    const sp = this.speed(now) * dt;
    const h = this.head;
    this.path.unshift({ x: h.x + Math.cos(this.angle) * sp, y: h.y + Math.sin(this.angle) * sp });

    // Recortar path a la longitud del cuerpo
    const maxLen = this.len;
    let acc = 0, cut = this.path.length;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      acc += Math.hypot(a.x - b.x, a.y - b.y);
      if (acc > maxLen) { cut = i + 1; break; }
    }
    if (cut < this.path.length) this.path.length = cut;
    return drop;
  }

  // Puntos muestreados para la red (cada k-ésimo punto, tope 60)
  samplePoints() {
    const pts = [];
    const step = Math.max(1, Math.floor(this.path.length / 55));
    for (let i = 0; i < this.path.length; i += step) {
      pts.push([Math.round(this.path[i].x), Math.round(this.path[i].y)]);
    }
    return pts;
  }
}

module.exports = Worm;
