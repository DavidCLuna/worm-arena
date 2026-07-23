const C = require('../../shared/constants.js');

const BOT_NAMES = [
  'Anaconda', 'Snek', 'Lombriz', 'ChocoWorm', 'Donut', 'Gusanito', 'Pixel',
  'Turbo', 'Noodle', 'Spaguetti', 'Mamba', 'Cobra Kai', 'Slinky', 'Wiggly',
  'Caramel', 'Menta', 'Fresita', 'Rayo', 'ZigZag', 'Bubbles', 'Tiburon',
  'Lombrigon', 'Pepito', 'Kawaii', 'Veneno', 'Tornado', 'Chispa', 'Mochi',
];

function botName(used) {
  for (let i = 0; i < 40; i++) {
    const n = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    if (!used.has(n)) return n;
  }
  return 'Bot' + Math.floor(Math.random() * 999);
}

// Decide targetAngle y boosting de un bot. Se llama ~4 veces/seg por bot.
// Personalidad: bot.agro (0.4 cauteloso → 1.0 asesino)
function think(bot, world, now) {
  const h = bot.head;
  const WR = C.WORLD_RADIUS;
  const agro = bot.agro || 0.7;
  let ax = 0, ay = 0; // vector de evasión acumulado

  // 1) Huir del borde del mundo
  const dCenter = Math.hypot(h.x, h.y);
  if (dCenter > WR - 500) {
    const w = (dCenter - (WR - 500)) / 500;
    ax -= (h.x / dCenter) * w * 3;
    ay -= (h.y / dCenter) * w * 3;
  }

  // 2) Evasión de cuerpos enemigos (los agresivos arriesgan más: peso menor)
  const near = world.queryBodies(h.x, h.y, 260);
  let danger = 0;
  const evadeW = 5 * (1.15 - 0.5 * agro);
  for (const p of near) {
    if (p.worm === bot) continue;
    if (bot.team && p.worm.team === bot.team) continue;
    const dx = h.x - p.x, dy = h.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const w = (260 - d) / 260;
    ax += (dx / d) * w * evadeW;
    ay += (dy / d) * w * evadeW;
    danger = Math.max(danger, w);
  }

  // 3) Comida: scoring premia MUCHO el valor → "corpse rush" (festines de muertos
  //    atraen bots → se aglomeran → se matan entre ellos)
  let fx = 0, fy = 0, foundFood = false;
  let best = null, bestD = Infinity;
  const foods = world.queryFoods(h.x, h.y, 1100);
  for (const f of foods) {
    const d = Math.hypot(f.x - h.x, f.y - h.y);
    const score = d - f.v * 100 - (f.s ? 300 : 0); // comida de cadáver = imán de bots
    if (score < bestD) { bestD = score; best = f; }
  }
  if (best) {
    const d = Math.hypot(best.x - h.x, best.y - h.y) || 1;
    fx = (best.x - h.x) / d; fy = (best.y - h.y) / d;
    foundFood = true;
  }

  // 4) Caza: interceptar gusanos más pequeños (radio y decisión según agresividad)
  let hunt = null, huntD = Infinity;
  const huntR = 400 + 350 * agro;
  if (danger < 0.45 && bot.mass > 50) {
    for (const w of world.worms.values()) {
      if (w === bot || !w.alive) continue;
      if (bot.team && w.team === bot.team) continue;
      if (w.mass >= bot.mass * 0.9) continue;
      const d = Math.hypot(w.head.x - h.x, w.head.y - h.y);
      if (d < huntR && d < huntD) { hunt = w; huntD = d; }
    }
  }

  let tx, ty;
  if (hunt) {
    // Interceptación predictiva: apuntar donde ESTARÁ la presa
    const lead = Math.max(60, Math.min(400, huntD * 0.5));
    const px = hunt.head.x + Math.cos(hunt.angle) * lead;
    const py = hunt.head.y + Math.sin(hunt.angle) * lead;
    tx = px - h.x; ty = py - h.y;
    bot.targetAngle = Math.atan2(ty, tx);
    // Boost solo si está alineado y cerca (no desperdicia masa)
    let diff = Math.abs(bot.targetAngle - bot.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    bot.boosting = huntD < 240 + 160 * agro && diff < 0.5 && bot.mass > C.MIN_BOOST_MASS * 2;
    return;
  }

  bot.boosting = false;
  if (Math.abs(ax) + Math.abs(ay) > 0.4) {
    tx = ax + fx * 0.4; ty = ay + fy * 0.4;
  } else if (foundFood) {
    const wob = Math.sin(now / 1400 + bot.id) * 0.5;
    tx = fx + Math.cos(bot.angle + Math.PI / 2) * wob * 0.3;
    ty = fy + Math.sin(bot.angle + Math.PI / 2) * wob * 0.3;
  } else {
    tx = -h.x / (dCenter || 1) + Math.cos(now / 900 + bot.id) * 0.6;
    ty = -h.y / (dCenter || 1) + Math.sin(now / 900 + bot.id) * 0.6;
  }
  bot.targetAngle = Math.atan2(ty, tx);
}

module.exports = { think, botName };
