// Test de gameplay: comer (crece la masa), boost (drena masa), muerte en el borde,
// resultado de partida con cuenta (xp/monedas) y compra en la tienda
const WebSocket = require('ws');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Gameplay test WormArena\n');
  const ws = new WebSocket('ws://localhost:3000/ws');
  let foods = [], me = null, myId = 0, joined = false, died = null, profile = null, storeRes = null;

  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'hi') {
      ws.send(JSON.stringify({ t: 'register', user: 'gametest' + Date.now() % 100000, pass: '1234' }));
    } else if (m.t === 'auth') {
      profile = m.profile;
      ws.send(JSON.stringify({ t: 'join', mode: 'arena', name: 'Gamer', skin: 0 }));
    } else if (m.t === 'j') {
      joined = true; myId = m.id; foods = m.foods.map(f => ({ id: f[0], x: f[1], y: f[2], v: f[3] }));
    } else if (m.t === 's') {
      me = m.me;
      if (m.e) for (const ev of m.e) {
        if (ev[0] === 'f+') foods.push({ id: ev[1], x: ev[2], y: ev[3], v: ev[4] });
        else if (ev[0] === 'f-') { const i = foods.findIndex(f => f.id === ev[1]); if (i >= 0) foods.splice(i, 1); }
      }
    } else if (m.t === 'd') {
      died = m;
    } else if (m.t === 'store') {
      storeRes = m;
    }
  });

  await sleep(500);
  check(joined, 'unido a la arena');

  // 1) Perseguir comida durante 12s -> la masa debe subir
  let maxMass = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && !died) {
    if (me && foods.length) {
      let best = null, bd = Infinity;
      for (const f of foods) {
        const d = Math.hypot(f.x - me.x, f.y - me.y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best) {
        const a = Math.atan2(best.y - me.y, best.x - me.x);
        ws.send(JSON.stringify({ t: 'input', a, b: false }));
      }
      maxMass = Math.max(maxMass, me.m);
    }
    await sleep(80);
  }
  check(maxMass > 20, `comió y creció (masa máx: ${maxMass})`);

  // 2) (el drenaje del boost se valida de forma determinista en test/boost.js)

  // 3) Huir hacia el borde -> debe morir y llegar pantalla de muerte
  if (!died) {
    const a = Math.atan2(me.y, me.x); // dirección hacia afuera
    const t1 = Date.now();
    while (!died && Date.now() - t1 < 40000) {
      const aa = Math.atan2(me.y, me.x);
      ws.send(JSON.stringify({ t: 'input', a: aa, b: true }));
      await sleep(100);
    }
  }
  check(!!died, 'murió al chocar con el borde');
  if (died) {
    check(typeof died.score === 'number' && died.score >= 0, `pantalla de muerte con score=${died.score}`);
    check(died.profile && died.profile.stats.games >= 1, `stats guardadas (partidas: ${died.profile && died.profile.stats.games})`);
    check(died.profile && died.profile.xp > 0, `XP ganada (${died.profile && died.profile.xp})`);
  }

  // 4) Comprar en la tienda (perfil nuevo tiene 200 monedas + ganancias de la partida)
  ws.send(JSON.stringify({ t: 'buy', kind: 'skin', idx: 4 })); // Lava = 200 monedas
  await sleep(600);
  check(storeRes && storeRes.ok, 'compra de skin en la tienda');
  if (storeRes && storeRes.profile) {
    check(storeRes.profile.ownedSkins.includes(4), `skin en inventario (total: ${storeRes.profile.ownedSkins.length})`);
  }

  ws.close();
  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
