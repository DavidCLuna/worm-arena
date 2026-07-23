// Test de letalidad: simula una sala solo con bots durante 120s y cuenta muertes
const World = require('../server/game/world.js');
const C = require('../shared/constants.js');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}

console.log('Test de letalidad de bots (120s simulados)\n');

const w = new World('arena');
const used = new Set();
for (let i = 0; i < C.BOT_FILL; i++) w.addBot(used);

let deaths = 0, kills = 0;
const origKill = w.kill.bind(w);
w.kill = (worm, killer) => {
  deaths++;
  if (killer && killer !== worm) kills++;
  origKill(worm, killer);
};

const dt = 1 / 20;
const now0 = Date.now();
for (let i = 0; i < 20 * 120; i++) {
  w.tick(dt, now0 + i * 50);
  while (w.entityCount() < C.BOT_FILL) w.addBot(used); // reponer como rooms.js
}

// masa máxima alcanzada (¿llegan a cazar? algunos > 50)
let maxMass = 0, hunters = 0;
for (const b of w.worms.values()) { if (b.mass > maxMass) maxMass = b.mass; if (b.mass > 50) hunters++; }

console.log(`  muertes totales: ${deaths} | bajas bot-vs-bot: ${kills} | bots vivos >50 masa: ${hunters} | mayor: ${Math.round(maxMass)}`);

check(deaths >= 4, `al menos 4 muertes en 2 min (${deaths})`);
check(kills >= 2, `al menos 2 bajas bot-vs-bot (${kills})`);
check(w.foods.size > 0, `queda comida en el mundo (${w.foods.size})`);
check(w.entityCount() === C.BOT_FILL, `población de bots estable en ${C.BOT_FILL}`);

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
process.exit(failures === 0 ? 0 : 1);
