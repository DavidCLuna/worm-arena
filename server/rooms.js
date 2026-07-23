const C = require('../shared/constants.js');
const World = require('./game/world.js');

// Gestiona salas de juego con ESCALADO DINÁMICO:
// - Tope por sala: HUMAN_CAP humanos / ENTITY_CAP entidades (controla el tráfico)
// - Si todas las salas de un modo están llenas → se crea una nueva automáticamente
// - Los bots rellenan hasta BOT_FILL y ceden su puesto cuando entran humanos
// - Salas extra vacías por >60s se eliminan (siempre queda al menos 1 por modo)
class Rooms {
  constructor() {
    this.modes = { arena: [new World('arena')], teams: [new World('teams')] };
    this.usedNames = new Set();
  }

  list(mode) { return this.modes[mode === 'teams' ? 'teams' : 'arena']; }
  get(mode) { return this.list(mode)[0]; } // compat

  join(client, mode, opts) {
    const rooms = this.list(mode);
    // elegir la sala con MÁS humanos que aún tenga cupo (llenar antes de crear)
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
    const worm = best.addPlayer(opts);
    worm.client = client;
    client.worm = worm;
    client.world = best;
    return worm;
  }

  leave(client) {
    if (client.worm && client.world) {
      client.world.worms.delete(client.worm.id);
    }
    client.worm = null;
    client.world = null;
  }

  tick(dt, now) {
    for (const key of Object.keys(this.modes)) {
      const rooms = this.modes[key];
      for (let i = rooms.length - 1; i >= 0; i--) {
        const w = rooms[i];
        const humans = w.humanCount();
        // limpiar salas extra vacías
        if (humans === 0) {
          w.emptySince = w.emptySince || now;
          if (rooms.length > 1 && now - w.emptySince > 60000) {
            rooms.splice(i, 1);
            console.log(`[rooms] sala ${key} eliminada por inactividad (quedan ${rooms.length})`);
            continue;
          }
        } else w.emptySince = 0;

        // bots: rellenar o ceder cupo (máx 1 cambio por tick → se ve natural)
        const target = Math.min(C.ENTITY_CAP, Math.max(C.BOT_FILL, humans + 6));
        const diff = target - w.entityCount();
        if (diff > 0) w.addBot(this.usedNames);
        else if (diff < 0) {
          for (const b of w.worms.values()) {
            if (b.isBot) { w.kill(b, null); break; } // muere y deja su festín
          }
        }
        w.tick(dt, now);
      }
    }
  }

  stats() {
    const out = {};
    for (const key of Object.keys(this.modes)) {
      out[key] = this.modes[key].map(w => ({ humans: w.humanCount(), entities: w.entityCount() }));
    }
    return out;
  }
}

module.exports = Rooms;
