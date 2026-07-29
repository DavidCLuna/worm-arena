// Test Party Link: crear party, unirse con código, verificar amigo (f:1) y trayectoria
const WebSocket = require('ws');

let failures = 0;
function check(cond, label) {
  if (cond) console.log('  OK  ' + label);
  else { console.log('  FAIL ' + label); failures++; }
}

function openClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    ws.on('open', () => {});
    ws.on('error', reject);
    const waitHi = () => new Promise((res) => {
      const onMsg = (d) => {
        const m = JSON.parse(d);
        if (m.t === 'hi') { ws.off('message', onMsg); res(); }
      };
      ws.on('message', onMsg);
    });
    waitHi().then(() => resolve(ws)).catch(reject);
  });
}

function once(ws, type, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + type)), timeoutMs || 5000);
    const onMsg = (d) => {
      const m = JSON.parse(d);
      if (m.t === type) { clearTimeout(t); ws.off('message', onMsg); resolve(m); }
    };
    ws.on('message', onMsg);
  });
}

function collectSnaps(ws, n) {
  return new Promise((resolve) => {
    const st = { snaps: 0, friend: false, fullP: 0, headOnly: 0 };
    const onMsg = (d) => {
      const m = JSON.parse(d);
      if (m.t !== 's') return;
      st.snaps++;
      for (const w of (m.w || [])) {
        if (w.p && w.p.length) st.fullP++;
        else if (typeof w.x === 'number') st.headOnly++;
        if (w.f === 1) st.friend = true;
      }
      if (st.snaps >= n) { ws.off('message', onMsg); resolve(st); }
    };
    ws.on('message', onMsg);
  });
}

async function main() {
  console.log('Test Party Link + trayectoria\n');

  const host = await openClient();
  host.send(JSON.stringify({
    t: 'join', mode: 'arena', name: 'HostParty', skin: 0, createParty: true, w: 1280, h: 720,
  }));
  const hj = await once(host, 'j');
  check(!hj.err && hj.id, 'host creó party');
  check(!!hj.party && hj.party.length === 6, `código party (${hj.party})`);

  const guest = await openClient();
  guest.send(JSON.stringify({
    t: 'join', mode: 'arena', name: 'GuestParty', skin: 1, party: hj.party, w: 1280, h: 720,
  }));
  const gj = await once(guest, 'j');
  check(!gj.err && gj.id, 'guest se unió a la party');
  check(gj.party === hj.party, 'mismo código de party');

  const [hs, gs] = await Promise.all([collectSnaps(host, 30), collectSnaps(guest, 30)]);
  check(hs.friend || gs.friend, 'marcador amigo f:1 en snapshot');
  check(hs.fullP > 0, `sync completo de path presente (${hs.fullP})`);
  check(hs.headOnly > 0, `deltas solo-cabeza presentes (${hs.headOnly})`);

  const bad = await openClient();
  bad.send(JSON.stringify({
    t: 'join', mode: 'arena', name: 'Bad', skin: 0, party: 'ZZZZZZ', w: 800, h: 600,
  }));
  const bj = await once(bad, 'j');
  check(bj.err === 'party_not_found', 'party inexistente → party_not_found');

  try { host.close(); guest.close(); bad.close(); } catch {}

  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLOS`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
