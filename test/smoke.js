// Smoke test: conecta 2 clientes WS, se unen a una sala y verifican snapshots
const WebSocket = require('ws');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}

function makeClient(name, mode) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    const st = { ws, name, snaps: 0, joined: false, id: 0, sawOther: false, foods: 0 };
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.t === 'hi') {
        ws.send(JSON.stringify({ t: 'join', mode, name, skin: 2 }));
      } else if (m.t === 'j') {
        st.joined = true; st.id = m.id; st.foods = m.foods.length;
      } else if (m.t === 's') {
        st.snaps++;
        if (m.w && m.w.length > 1) st.sawOther = true;
        st.lastMe = m.me;
        if (st.snaps === 10) { ws.send(JSON.stringify({ t: 'input', a: 1.2, b: true })); }
        if (st.snaps >= 55) { ws.close(); resolve(st); }
      }
    });
    ws.on('error', (e) => { console.error(name, 'error', e.message); resolve(st); });
  });
}

async function main() {
  console.log('Smoke test WormArena\n');
  const [a, b] = await Promise.all([makeClient('TesterA', 'arena'), makeClient('TesterB', 'teams')]);

  check(a.joined, 'cliente A se unió a arena');
  check(a.foods > 500, `A recibió comida inicial (${a.foods})`);
  check(a.snaps >= 55, `A recibió ${a.snaps} snapshots`);
  check(a.sawOther, 'A ve otros gusanos (bots) en el snapshot');
  check(a.lastMe && a.lastMe.m >= 0, `A tiene masa en snapshot (${a.lastMe && a.lastMe.m})`);
  check(b.joined, 'cliente B se unió a teams');
  check(b.snaps >= 30, `B recibió ${b.snaps} snapshots`);

  // auth + store
  const ws = new WebSocket('ws://localhost:3000/ws');
  await new Promise((res) => {
    let step = 0;
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.t === 'hi') ws.send(JSON.stringify({ t: 'register', user: 'smoketest', pass: '1234' }));
      else if (m.t === 'auth') {
        check(m.ok || m.err === 'exists', 'registro/login ok');
        if (step === 0) { step = 1; ws.send(JSON.stringify({ t: 'login', user: 'smoketest', pass: '1234' })); }
        else { ws.send(JSON.stringify({ t: 'leaders' })); }
      } else if (m.t === 'leaders') {
        check(Array.isArray(m.list), 'leaderboard global recibido');
        ws.close(); res();
      }
    });
    ws.on('error', () => res());
  });

  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
