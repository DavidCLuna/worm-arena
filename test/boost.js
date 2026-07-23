// Test determinista del boost: drena masa, deja rastro, y el drenaje
// supera el valor del rastro (boostear en círculo NO imprime masa)
const C = require('../shared/constants.js');
const World = require('../server/game/world.js');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}

console.log('Test de boost\n');

const w = new World('arena');
const worm = w.addPlayer({ name: 'T', skin: 0 });
// gusano recto hacia el este desde el centro
worm.mass = 200;
worm.angle = worm.targetAngle = 0;
worm.path = [];
for (let i = 0; i < 60; i++) worm.path.push({ x: -7.75 * i, y: 0 });
worm.boosting = true;

C.FOOD_TARGET = 0; // sin comida ambiente: prueba aislada
w.foods.clear();

const before = worm.mass;
for (let i = 0; i < 60; i++) w.tick(1 / 20, Date.now()); // 3s de boost

const drops = w.foods.size;
console.log(`  masa: ${before} -> ${worm.mass.toFixed(1)} | gotas de rastro: ${drops}`);

check(worm.mass < before - 10, `boost drena masa (${before} -> ${worm.mass.toFixed(1)})`);
check(drops >= 15, `deja rastro de comida (${drops} gotas en 3s)`);
check(worm.mass + drops < before, 'balance: drena más de lo que suelta el rastro');
check(worm.alive, 'sigue vivo tras el boost');

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
process.exit(failures === 0 ? 0 : 1);
