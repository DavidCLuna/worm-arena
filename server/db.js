// Persistencia simple en JSON: cuentas, stats, monedas, skins, tokens
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('../shared/constants.js');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = { users: {}, tokens: {} };

function load() {
  try {
    if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('db load error', e); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db));
    } catch (e) { console.error('db save error', e); }
  }, 400);
}
load();

function hash(pass, salt) {
  return crypto.createHash('sha256').update(salt + ':' + pass).digest('hex');
}
function newProfile(user) {
  return {
    user, coins: 200, xp: 0,
    stats: { highScore: 0, bestTime: 0, kills: 0, headshots: 0, games: 0, playTime: 0, created: Date.now() },
    ownedSkins: [0, 1, 2, 3], ownedWear: ['none'],
    skin: 0, customSkin: null, wear: 'none',
  };
}
function publicProfile(u) {
  return {
    user: u.user, coins: u.coins, xp: u.xp, level: C.levelOf(u.xp),
    stats: u.stats, ownedSkins: u.ownedSkins, ownedWear: u.ownedWear,
    skin: u.skin, customSkin: u.customSkin, wear: u.wear,
  };
}

module.exports = {
  register(user, pass) {
    user = String(user || '').trim().slice(0, 16);
    if (!/^[a-zA-Z0-9_\-áéíóúñÑ]{3,16}$/.test(user)) return { ok: false, err: 'bad_user' };
    if (String(pass).length < 4) return { ok: false, err: 'bad_pass' };
    const key = user.toLowerCase();
    if (db.users[key]) return { ok: false, err: 'exists' };
    const salt = crypto.randomBytes(8).toString('hex');
    db.users[key] = { ...newProfile(user), salt, pass: hash(pass, salt) };
    const token = crypto.randomBytes(16).toString('hex');
    db.tokens[token] = key;
    save();
    return { ok: true, token, profile: publicProfile(db.users[key]) };
  },
  login(user, pass) {
    const key = String(user || '').trim().toLowerCase();
    const u = db.users[key];
    if (!u || u.pass !== hash(pass, u.salt)) return { ok: false, err: 'invalid' };
    const token = crypto.randomBytes(16).toString('hex');
    db.tokens[token] = key;
    save();
    return { ok: true, token, profile: publicProfile(u) };
  },
  auth(token) {
    const key = db.tokens[token];
    if (!key || !db.users[key]) return null;
    return { key, profile: publicProfile(db.users[key]) };
  },
  saveConfig(key, cfg) {
    const u = db.users[key];
    if (!u) return;
    if (typeof cfg.skin === 'number') u.skin = cfg.skin;
    if (cfg.customSkin) u.customSkin = cfg.customSkin;
    if (typeof cfg.wear === 'string') u.wear = cfg.wear;
    save();
  },
  buy(key, kind, idx) {
    const u = db.users[key];
    if (!u) return { ok: false, err: 'no_user' };
    if (kind === 'skin') {
      const s = C.SKINS[idx];
      if (!s) return { ok: false, err: 'no_item' };
      if (u.ownedSkins.includes(idx)) return { ok: false, err: 'owned' };
      if (u.coins < s[5]) return { ok: false, err: 'coins' };
      u.coins -= s[5]; u.ownedSkins.push(idx);
    } else if (kind === 'wear') {
      const w = C.WEAR[idx];
      if (!w) return { ok: false, err: 'no_item' };
      if (u.ownedWear.includes(w[0])) return { ok: false, err: 'owned' };
      if (u.coins < w[2]) return { ok: false, err: 'coins' };
      u.coins -= w[2]; u.ownedWear.push(w[0]);
    }
    save();
    return { ok: true, profile: publicProfile(u) };
  },
  // Resultado de una partida: actualiza stats, xp, monedas, nivel
  gameResult(key, { score, kills, headshots, timeMs }) {
    const u = db.users[key];
    if (!u) return null;
    const s = u.stats;
    s.games++;
    s.kills += kills;
    s.headshots += headshots;
    s.playTime += Math.round(timeMs / 1000);
    if (score > s.highScore) s.highScore = score;
    if (timeMs / 1000 > s.bestTime) s.bestTime = Math.round(timeMs / 1000);
    const oldLevel = C.levelOf(u.xp);
    u.xp += C.xpForGame(score, kills);
    const newLevel = C.levelOf(u.xp);
    u.coins += C.coinsForGame(score, kills) + Math.max(0, newLevel - oldLevel) * C.LEVELUP_COINS;
    save();
    return { profile: publicProfile(u), levelUp: newLevel > oldLevel, newLevel };
  },
  leaders(n = 20) {
    return Object.values(db.users)
      .map(u => ({ user: u.user, level: C.levelOf(u.xp), highScore: u.stats.highScore, kills: u.stats.kills, headshots: u.stats.headshots }))
      .sort((a, b) => b.highScore - a.highScore)
      .slice(0, n);
  },
};
