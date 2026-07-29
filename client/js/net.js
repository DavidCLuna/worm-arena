// Cliente WebSocket: conexión, protocolo y envío de input
const Net = (() => {
  let ws = null, connected = false;
  const handlers = {}; // onAuth, onJoin, onSnap, onDeath, onStore, onLeaders, onOpen
  let lastInput = 0, lastA = 999, lastB = false;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => { connected = true; handlers.onOpen && handlers.onOpen(); };
    ws.onclose = () => { connected = false; setTimeout(connect, 1500); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      switch (m.t) {
        case 'auth':   handlers.onAuth && handlers.onAuth(m); break;
        case 'j':      handlers.onJoin && handlers.onJoin(m); break;
        case 's':      handlers.onSnap && handlers.onSnap(m); break;
        case 'd':      handlers.onDeath && handlers.onDeath(m); break;
        case 'store':  handlers.onStore && handlers.onStore(m); break;
        case 'leaders': handlers.onLeaders && handlers.onLeaders(m); break;
      }
    };
  }

  function send(obj) { if (connected && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  // Input a ~25Hz o inmediatamente si cambia el boost o el ángulo
  function sendInput(a, b) {
    const now = performance.now();
    if (b !== lastB || Math.abs(a - lastA) > 0.01 || now - lastInput > 40) {
      send({ t: 'input', a: Math.round(a * 1000) / 1000, b });
      lastInput = now; lastA = a; lastB = b;
    }
  }

  function join(mode, name, skin, customSkin, wear, opts) {
    opts = opts || {};
    const msg = { t: 'join', mode, name, skin, customSkin, wear, w: innerWidth, h: innerHeight };
    if (opts.createParty) msg.createParty = true;
    if (opts.party) msg.party = opts.party;
    send(msg);
  }

  return {
    connect, send, sendInput, on: (k, f) => { handlers[k] = f; },
    join,
    register: (user, pass) => send({ t: 'register', user, pass }),
    login: (user, pass) => send({ t: 'login', user, pass }),
    token: (token) => send({ t: 'token', token }),
    buy: (kind, idx) => send({ t: 'buy', kind, idx }),
    cfg: (cfg) => send({ t: 'cfg', ...cfg }),
    leaders: () => send({ t: 'leaders' }),
    screen: () => send({ t: 'screen', w: innerWidth, h: innerHeight }),
    get connected() { return connected; },
  };
})();

// avisar al servidor si cambia el tamaño de la ventana (rango de visión)
window.addEventListener('resize', () => { try { Net.screen(); } catch {} });
