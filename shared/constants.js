// Constantes compartidas entre servidor (Node) y cliente (browser)
(function (root, factory) {
  const C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else { root.CONST = C; }
})(typeof self !== 'undefined' ? self : this, function () {

  const FOOD_TYPES = [
    { key: 'candy',    v: 1, w: 58, color: '#ff5d8f' },
    { key: 'cookie',   v: 2, w: 20, color: '#c98a4b' },
    { key: 'donut',    v: 3, w: 10, color: '#f7b32b' },
    { key: 'choco',    v: 4, w: 7,  color: '#7b4b2a' },
    { key: 'cake',     v: 5, w: 5,  color: '#ff8fa3' },
  ];

  const POTION_TYPES = {
    spd: { color: '#39d353', durMin: 10, durMax: 25, w: 20 }, // +50% velocidad
    agi: { color: '#3aa0ff', durMin: 10, durMax: 30, w: 20 }, // giro ágil
    mag: { color: '#c95bff', durMin: 10, durMax: 30, w: 20 }, // imán (rojo-azul)
    zm:  { color: '#37e2d5', durMin: 10, durMax: 30, w: 12, zoom: 1.5 }, // +50% campo de visión
    x2:  { color: '#ffb14d', durMin: 10, durMax: 40, w: 18, mult: 2 },
    x5:  { color: '#ff8c1a', durMin: 10, durMax: 40, w: 14, mult: 5 },
    x10: { color: '#8a4b1f', durMin: 10, durMax: 40, w: 8,  mult: 10 },
  };

  // Catálogo de skins: [nombre, patrón, c1, c2, c3, precio]
  // Patrones: tri, solid, stripes, hstripes, gradient, dots, checker, rainbow
  const SKINS = [
    ['Clásico',    'tri',      '#ff5d5d', '#ffffff', '#3aa0ff', 0],
    ['Sandía',     'tri',      '#ff6b6b', '#ffffff', '#2ec27e', 0],
    ['Abeja',      'stripes',  '#ffd23f', '#222222', '#ffd23f', 0],
    ['Aurora',     'gradient', '#43e97b', '#38f9d7', '#43e97b', 0],
    ['Lava',       'gradient', '#f83600', '#f9d423', '#f83600', 200],
    ['Océano',     'gradient', '#1a6dff', '#21d4fd', '#1a6dff', 200],
    ['Uva',        'solid',    '#8e2de2', '#8e2de2', '#8e2de2', 100],
    ['Menta',      'solid',    '#2ec27e', '#2ec27e', '#2ec27e', 100],
    ['Fresa',      'solid',    '#ff5d8f', '#ff5d8f', '#ff5d8f', 100],
    ['Carbón',     'solid',    '#333a45', '#333a45', '#333a45', 150],
    ['Nieve',      'dots',     '#ffffff', '#9fd8ff', '#ffffff', 250],
    ['Leopardo',   'dots',     '#e0a458', '#5b3a1e', '#e0a458', 300],
    ['Vacas',      'dots',     '#ffffff', '#333333', '#ffffff', 300],
    ['Arcoíris',   'rainbow',  '#ff0000', '#00ff00', '#0000ff', 400],
    ['Neón',       'rainbow',  '#ff00ff', '#00ffff', '#ffff00', 500],
    ['México',     'hstripes', '#2ec27e', '#ffffff', '#ff5d5d', 350],
    ['España',     'hstripes', '#ff5d5d', '#ffd23f', '#ff5d5d', 350],
    ['Francia',    'stripes',  '#3aa0ff', '#ffffff', '#ff5d5d', 350],
    ['Argentina',  'hstripes', '#9fd8ff', '#ffffff', '#9fd8ff', 350],
    ['Alemania',   'hstripes', '#222222', '#ff5d5d', '#ffd23f', 350],
    ['Brasil',     'tri',      '#2ec27e', '#ffd23f', '#3aa0ff', 350],
    ['Colombia',   'hstripes', '#ffd23f', '#3aa0ff', '#ff5d5d', 350],
    ['Italia',     'stripes',  '#2ec27e', '#ffffff', '#ff5d5d', 350],
    ['Japón',      'dots',     '#ffffff', '#ff5d5d', '#ffffff', 350],
    ['Ajedrez',    'checker',  '#ffffff', '#222222', '#ffffff', 450],
    ['Pikachu',    'tri',      '#ffd23f', '#ffd23f', '#c0392b', 450],
    ['Galaxia',    'dots',     '#1b1b3a', '#c95bff', '#1b1b3a', 500],
    ['Fuego',      'gradient', '#ff0844', '#ffb199', '#ff0844', 500],
    ['Esmeralda',  'gradient', '#0ba360', '#3cba92', '#0ba360', 500],
    ['Atardecer',  'gradient', '#fa709a', '#fee140', '#fa709a', 500],
    ['Dulce',      'stripes',  '#ff9ff3', '#feca57', '#ff9ff3', 600],
    ['Dragón',     'checker',  '#2ec27e', '#145a32', '#2ec27e', 600],
    ['Real',       'tri',      '#8e2de2', '#ffd23f', '#8e2de2', 750],
    ['Diamante',   'dots',     '#a8edea', '#ffffff', '#a8edea', 900],
  ];

  // Accesorios (wear): [key, nombre, precio]
  const WEAR = [
    ['none',    'Nada',      0],
    ['crown',   'Corona',    800],
    ['cap',     'Gorra',     400],
    ['glasses', 'Gafas',     500],
    ['horns',   'Cuernos',   600],
    ['halo',    'Aureola',   700],
    ['flower',  'Flor',      350],
  ];

  return {
    TICK_RATE: 20,
    WORLD_RADIUS: 4500,
    VIEW_RANGE: 2400,          // interest management (radio de envío)
    BASE_SPEED: 155,
    BOOST_MULT: 1.9,
    SPD_POTION_MULT: 1.5,
    TURN_RATE: 4.0,            // rad/s
    AGI_TURN_RATE: 6.8,
    START_MASS: 20,
    MIN_BOOST_MASS: 24,
    BOOST_DRAIN: 0.04,         // fracción de masa por segundo
    BOOST_BASE_DRAIN: 5,       // drenaje base por segundo (siempre > valor del rastro)
    BOOST_DROP_EVERY: 0.14,    // s entre gotas de comida al acelerar
    FOOD_TARGET: 2400,
    POTION_TARGET: 22,
    MAGNET_RADIUS: 380,
    MAGNET_PULL: 420,          // u/s
    BOT_FILL: 24,              // entidades mínimas de relleno por sala
    ENTITY_CAP: 40,            // entidades máximas por sala (humanos + bots)
    HUMAN_CAP: 20,             // humanos máximos por sala → luego se crea otra
    PARTY_CAP: 8,              // miembros máximos por party link
    TRAJ_FULL_MS: 2500,        // resync completo de trayectoria (cliente/servidor)
    FOOD_TYPES,
    POTION_TYPES,
    SKINS,
    WEAR,
    radiusOf: (mass) => 5 + Math.sqrt(mass) * 1.7,
    lengthOf: (mass) => 60 + mass * 1.7, // cuerpo largo para poder encerrar
    GROWTH_GAIN: 1.5, // ganancia de masa al comer (crecer más rápido)
    // Zoom: una culebra pequeña ve MENOS área que una grande (cámara más cerca),
    // una grande hace zoom-out y ve más. Misma fórmula en cliente y servidor.
    zoomOf: (r) => Math.max(0.32, Math.min(1.6, 30 / r)),
    xpForGame: (score, kills) => Math.floor(score / 10) + kills * 10,
    levelOf: (xp) => Math.floor(Math.sqrt(xp / 50)) + 1,
    coinsForGame: (score, kills) => Math.floor(score / 50) + kills * 2,
    LEVELUP_COINS: 100,
  };
});
