// Verifica que al matar siempre cae comida de cadáver (aunque el mapa esté lleno)
const C = require('../shared/constants.js');
const World = require('../server/game/world.js');
const Worm = require('../server/game/worm.js');

let fail = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); fail++; }
}

const w = new World('arena');
// llenar el mapa por encima del tope antiguo
while (w.foods.size < C.FOOD_TARGET * 1.6) w.spawnFood();
const before = w.foods.size;
console.log('mapa lleno:', before);

const victim = new Worm({ name: 'Victim', x: 0, y: 0, mass: 500 });
// path largo artificial
for (let i = 1; i < 200; i++) victim.path.push({ x: -i * 8, y: 0 });
w.worms.set(victim.id, victim);

const killer = new Worm({ name: 'Killer', x: 50, y: 0, mass: 800 });
w.worms.set(killer.id, killer);

w.events.length = 0;
w.kill(victim, killer);

const corpse = [...w.foods.values()].filter(f => f.s === 1);
const fplus = w.events.filter(e => e.k === 'f+' && e.f && e.f.s === 1);

check(corpse.length >= 8, `cadáver soltó comida (${corpse.length} piezas)`);
check(fplus.length >= 8, `eventos f+ de cadáver (${fplus.length})`);
check(w.foods.size > 0, `sigue habiendo comida en el mundo (${w.foods.size})`);

console.log(fail === 0 ? '\nTODO OK' : `\n${fail} FALLOS`);
process.exit(fail === 0 ? 0 : 1);
