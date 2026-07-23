// Test de justicia de colisiones (regla de oro: pierde el que toca con su cabeza):
//  A) Corte de paso limpio: el que corta (B) mata; la víctima (A) se estrella con su cuerpo
//  B) Frontal real cabeza-cabeza: mueren ambos
//  C) Carga lateral contra un cuerpo: el que carga muere, el dueño del cuerpo vive
//  D) Contacto paralelo a distancia: nadie muere
const World = require('../server/game/world.js');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}

function makeWorm(w, name, mass, hx, hy, angle) {
  const worm = w.addPlayer({ name, skin: 0 });
  worm.mass = mass;
  worm.angle = worm.targetAngle = angle;
  worm.path = [];
  const n = Math.ceil((60 + mass * 1.7) / 7.75);
  for (let i = 0; i < n; i++) {
    worm.path.push({ x: hx - Math.cos(angle) * 7.75 * i, y: hy - Math.sin(angle) * 7.75 * i });
  }
  return worm;
}
function run(world, ticks) {
  for (let i = 0; i < ticks; i++) world.tick(1 / 20, Date.now());
}

console.log('Test de justicia de colisiones\n');

// A) B cruza POR DELANTE de A con suficiente adelanto → A se estrella con el cuerpo de B
{
  const w = new World('arena');
  const A = makeWorm(w, 'Victima', 500, -100, 0, 0);              // grande, hacia el este
  const B = makeWorm(w, 'Cortador', 30, 40, -90, Math.PI / 2);    // cruza hacia el sur, adelantado
  run(w, 25);
  check(!A.alive, 'A) la víctima muere al estrellarse con el cuerpo del que corta');
  check(B.alive, 'A) el que corta el paso SOBREVIVE ✂');
}

// B) Frontal real: la cabeza más grande gana (el pequeño entra en su círculo)
{
  const w = new World('arena');
  const A = makeWorm(w, 'Este', 500, -150, 0, 0);
  const B = makeWorm(w, 'Oeste', 30, 150, 0, Math.PI);
  run(w, 40);
  check(A.alive && !B.alive, 'B) choque frontal → gana la cabeza más grande');
}

// C) A carga perpendicular contra el costado de B → A muere, B vive
{
  const w = new World('arena');
  const B = makeWorm(w, 'Dueno', 500, -45, 0, 0);                 // grande, hacia el este
  const A = makeWorm(w, 'Cargador', 30, 0, -100, Math.PI / 2);    // carga hacia el sur contra el costado
  run(w, 25);
  check(!A.alive, 'C) el que carga contra un cuerpo MUERE');
  check(B.alive, 'C) el dueño del cuerpo SOBREVIVE');
}

// D) Paralelos a 60u de distancia → nadie muere (cuerpo-cuerpo no hace nada)
{
  const w = new World('arena');
  const A = makeWorm(w, 'Par1', 200, 0, 0, 0);
  const B = makeWorm(w, 'Par2', 200, -50, 60, 0);
  run(w, 25);
  check(A.alive && B.alive, 'D) contacto paralelo a distancia → nadie muere');
}

// E) Cruce limpio: yo cruzo primero, el otro llega después y se estrella → él pierde, yo no
{
  const w = new World('arena');
  const C = makeWorm(w, 'YoCruce', 30, 0, 0, 0);                // hacia el este (cruzo primero)
  const V = makeWorm(w, 'Tarde', 30, 30, -70, Math.PI / 2);     // hacia el sur (llega tarde al cruce)
  run(w, 20);
  check(!V.alive, 'E) el que llega tarde al cruce PIERDE');
  check(C.alive, 'E) el que cruzó primero SOBREVIVE ✂');
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
process.exit(failures === 0 ? 0 : 1);
