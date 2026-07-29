const C = require('../shared/constants.js');
const World = require('./game/world.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Gestiona salas de juego con ESCALADO DINÁMICO + Party Link:
// - Tope por sala: HUMAN_CAP humanos / ENTITY_CAP entidades
// - Party: sala privada por código (#party=CODIGO), tope PARTY_CAP, FFA (se matan entre sí)
// - Salas extra vacías por >60s se eliminan
class Rooms {
  constructor() {
    this.modes = { arena: [new World('arena')], teams: [new World('teams')] };
    this.parties = new Map(); // code → { code, world }
    this.usedNames = new Set();
  }

  list(mode) { return this.modes[mode === 'teams' ? 'teams' : 'arena']; }
  get(mode) { return this.list(mode)[0]; } // compat

  genCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    } while (this.parties.has(code));
    return code;
  }

  // Une a matchmaking público O a party (createParty / partyCode)
  join(client, mode, opts) {
    if (opts.createParty) return this.createParty(client, opts);
    if (opts.partyCode) return this.joinParty(client, opts.partyCode, opts);

    const rooms = this.list(mode);
    let best = null;
    for (const w of rooms) {
      const humans = w.humanCount();
      if (humans >= C.HUMAN_CAP || w.entityCount() >= C.ENTITY_CAP) continue;
      if (!best || humans > best.humanCount()) best = w;
    }
    if (!best) {
      best = new World(mode === 'teams' ? 'teams' : 'arena');
      rooms.push(best);
      console.log(`[rooms] nueva sala ${mode} #${rooms.length} creada`);
    }
    return this._attach(client, best, opts, null);
  }

  createParty(client, opts) {
    const code = this.genCode();
    const world = new World('arena');
    world.isParty = true;
    world.partyCode = code;
    this.parties.set(code, { code, world });
    console.log(`[rooms] party ${code} creada`);
    return this._attach(client, world, opts, code);
  }

  joinParty(client, rawCode, opts) {
    const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const party = this.parties.get(code);
    if (!party) {
      const err = new Error('party_not_found');
      err.code = 'party_not_found';
      throw err;
    }
    if (party.world.humanCount() >= C.PARTY_CAP) {
      const err = new Error('party_full');
      err.code = 'party_full';
      throw err;
    }
    return this._attach(client, party.world, opts, code);
  }

  _attach(client, world, opts, partyCode) {
    const worm = world.addPlayer(opts);
    worm.client = client;
    client.worm = worm;
    client.world = world;
    client.partyCode = partyCode;
    client.traj = null; // reset streaming state
    return worm;
  }

  leave(client) {
    if (client.worm && client.world) {
      client.world.worms.delete(client.worm.id);
    }
    client.worm = null;
    client.world = null;
    client.partyCode = null;
    client.traj = null;
  }

  tick(dt, now) {
    for (const key of Object.keys(this.modes)) {
      const rooms = this.modes[key];
      for (let i = rooms.length - 1; i >= 0; i--) {
        this._tickRoom(rooms, i, key, dt, now);
      }
    }
    // parties (salas privadas)
    for (const [code, party] of [...this.parties.entries()]) {
      const w = party.world;
      const humans = w.humanCount();
      if (humans === 0) {
        w.emptySince = w.emptySince || now;
        if (now - w.emptySince > 60000) {
          this.parties.delete(code);
          console.log(`[rooms] party ${code} eliminada por inactividad`);
          continue;
        }
      } else w.emptySince = 0;
      this._fillBots(w);
      w.tick(dt, now);
    }
  }

  _tickRoom(rooms, i, key, dt, now) {
    const w = rooms[i];
    const humans = w.humanCount();
    if (humans === 0) {
      w.emptySince = w.emptySince || now;
      if (rooms.length > 1 && now - w.emptySince > 60000) {
        rooms.splice(i, 1);
        console.log(`[rooms] sala ${key} eliminada por inactividad (quedan ${rooms.length})`);
        return;
      }
    } else w.emptySince = 0;
    this._fillBots(w);
    w.tick(dt, now);
  }

  _fillBots(w) {
    const humans = w.humanCount();
    const target = Math.min(C.ENTITY_CAP, Math.max(C.BOT_FILL, humans + 6));
    const diff = target - w.entityCount();
    if (diff > 0) w.addBot(this.usedNames);
    else if (diff < 0) {
      for (const b of w.worms.values()) {
        if (b.isBot) { w.kill(b, null); break; }
      }
    }
  }

  stats() {
    const out = {};
    for (const key of Object.keys(this.modes)) {
      out[key] = this.modes[key].map(w => ({ humans: w.humanCount(), entities: w.entityCount() }));
    }
    out.parties = [...this.parties.keys()].map(c => {
      const w = this.parties.get(c).world;
      return { code: c, humans: w.humanCount(), entities: w.entityCount() };
    });
    return out;
  }
}

module.exports = Rooms;
