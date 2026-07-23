// Capa de red: WebSocket, protocolo de mensajes, envío de snapshots
const { WebSocketServer } = require('ws');
const db = require('./db.js');

function setupNet(server, rooms) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set();

  wss.on('connection', (ws) => {
    const client = { ws, worm: null, world: null, userKey: null, profile: null, alive: true };
    clients.add(client);
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      handle(client, msg);
    });
    ws.on('close', () => { clients.delete(client); rooms.leave(client); });
    ws.on('error', () => {});
    ws.send(JSON.stringify({ t: 'hi' }));
  });

  function send(client, obj) {
    if (client.ws.readyState === 1) client.ws.send(JSON.stringify(obj));
  }

  function handle(client, m) {
    switch (m.t) {
      case 'register': {
        const r = db.register(m.user, m.pass);
        if (r.ok) { client.userKey = r.profile.user.toLowerCase(); client.profile = r.profile; }
        send(client, { t: 'auth', ok: r.ok, err: r.err, token: r.token, profile: r.profile });
        break;
      }
      case 'login': {
        const r = db.login(m.user, m.pass);
        if (r.ok) { client.userKey = r.profile.user.toLowerCase(); client.profile = r.profile; }
        send(client, { t: 'auth', ok: r.ok, err: r.err, token: r.token, profile: r.profile });
        break;
      }
      case 'token': {
        const a = db.auth(m.token);
        if (a) { client.userKey = a.key; client.profile = a.profile; }
        send(client, { t: 'auth', ok: !!a, profile: a ? a.profile : null });
        break;
      }
      case 'join': {
        if (client.worm) rooms.leave(client);
        client.spectate = null; client.world = null;
        // tamaño de pantalla del cliente → rango de visión sincronizado con su zoom
        client.screenDiag = Math.hypot(Number(m.w) || 1280, Number(m.h) || 720) / 2;
        const p = client.profile;
        const opts = {
          name: String(m.name || 'Worm').slice(0, 14) || 'Worm',
          skin: typeof m.skin === 'number' ? m.skin : (p ? p.skin : 0),
          customSkin: m.customSkin || (p ? p.customSkin : null),
          wear: m.wear || (p ? p.wear : 'none'),
        };
        const worm = rooms.join(client, m.mode === 'teams' ? 'teams' : 'arena', opts);
        send(client, {
          t: 'j', id: worm.id, mode: client.world.mode, team: worm.team,
          foods: client.world.allFoods(),
        });
        break;
      }
      case 'input': {
        const w = client.worm;
        if (!w || !w.alive) return;
        if (typeof m.a === 'number' && isFinite(m.a)) w.targetAngle = m.a;
        w.boosting = !!m.b;
        break;
      }
      case 'screen': {
        // el cliente redimensionó la ventana → actualizar su rango de visión
        client.screenDiag = Math.hypot(Number(m.w) || 1280, Number(m.h) || 720) / 2;
        break;
      }
      case 'buy': {
        if (!client.userKey) { send(client, { t: 'store', ok: false, err: 'no_user' }); return; }
        const r = db.buy(client.userKey, m.kind, m.idx);
        if (r.ok) client.profile = r.profile;
        send(client, { t: 'store', ok: r.ok, err: r.err, profile: r.profile || client.profile });
        break;
      }
      case 'cfg': {
        if (client.userKey) db.saveConfig(client.userKey, m);
        break;
      }
      case 'leaders': {
        send(client, { t: 'leaders', list: db.leaders(20) });
        break;
      }
    }
  }

  // Eventos del tick relevantes para un espectador en (hx, hy)
  function collectEvents(world, viewerId, hx, hy) {
    const evs = [];
    for (const e of world.events) {
      if (e.k === 'f+') {
        evs.push(['f+', e.f.id, Math.round(e.f.x), Math.round(e.f.y), e.f.v, e.f.t, e.f.s || 0]);
      } else if (e.k === 'f-') {
        evs.push(['f-', e.id]);
      } else if (e.k === 'death') {
        evs.push(['d', e.id, e.by, e.hs ? 1 : 0]);
        if (e.by === viewerId && e.hs) return { evs, headshot: true };
      } else if (e.k === 'pot' && e.id === viewerId) {
        evs.push(['pot', e.pot]);
      }
    }
    return { evs, headshot: false };
  }

  // Llamado tras cada tick de simulación
  function broadcast(now) {
    for (const client of clients) {
      // Modo espectador post-muerte (~3s): sigue viendo la zona donde murió
      if (!client.worm && client.spectate && client.world) {
        if (now >= client.spectate.until) {
          client.spectate = null; client.world = null;
          continue;
        }
        const ghost = client.spectate.ghost;
        const snap = client.world.snapshotFor(ghost, now);
        const { evs } = collectEvents(client.world, 0, ghost.head.x, ghost.head.y);
        if (evs.length) snap.e = evs;
        send(client, snap);
        continue;
      }
      const w = client.worm;
      if (!w || !client.world) continue;
      if (!w.alive) {
        // muerte: resultado + activar cámara de muerte (espectador 3.2s)
        const timeMs = Date.now() - w.spawnTime;
        const score = w.score;
        let result = null;
        if (client.userKey) {
          result = db.gameResult(client.userKey, { score, kills: w.kills, headshots: w.headshots || 0, timeMs });
          if (result) client.profile = result.profile;
        }
        send(client, {
          t: 'd', score, kills: w.kills, time: Math.round(timeMs / 1000),
          by: w.killedBy || '',
          levelUp: result ? result.levelUp : false, newLevel: result ? result.newLevel : 0,
          profile: client.profile,
        });
        client.spectate = {
          until: now + 3200,
          ghost: {
            id: 0, head: { x: w.head.x, y: w.head.y }, mass: w.mass, r: w.r,
            fx: { spd: 0, agi: 0, mag: 0, zm: 0, mult: 1, multUntil: 0 },
            client, team: 0, alive: true,
          },
        };
        client.world.worms.delete(w.id);
        client.worm = null;
        continue;
      }
      // snapshot + eventos relevantes
      const snap = client.world.snapshotFor(w, now);
      const { evs, headshot } = collectEvents(client.world, w.id, w.head.x, w.head.y);
      if (headshot) w.headshots = (w.headshots || 0) + 1;
      if (evs.length) snap.e = evs;
      send(client, snap);
    }
  }

  return { broadcast };
}

module.exports = setupNet;
