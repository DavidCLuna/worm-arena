// main.js: estado global del jugador, arranque y flujo entre pantallas
var My = {
  name: 'Worm' + Math.floor(Math.random() * 1000),
  skin: 0, customSkin: null, wear: 'none',
  profile: null, token: localStorage.getItem('worm_token') || null,
  mode: 'arena',
  partyCode: null,       // party activa (tras crear/unirse)
  pendingParty: null,    // código de #party= en la URL
};

(function boot() {
  // Restaurar apariencia local
  try {
    const look = JSON.parse(localStorage.getItem('worm_look') || '{}');
    if (typeof look.skin === 'number') My.skin = look.skin;
    if (look.customSkin) My.customSkin = look.customSkin;
    if (look.wear) My.wear = look.wear;
  } catch {}
  const savedName = localStorage.getItem('worm_name');
  if (savedName) My.name = savedName;
  document.getElementById('inp-name').value = My.name;

  // Party link desde URL (#party=CODIGO)
  parsePartyHash();
  window.addEventListener('hashchange', parsePartyHash);

  UI.loadSettings();
  UI.bindSettings();
  UI.bindCloses();
  Editor.init();
  UI.refreshPreview();

  // ===== Conexión y handlers de red =====
  Net.connect();
  Net.on('onOpen', () => { if (My.token) Net.token(My.token); });
  Net.on('onAuth', (m) => {
    if (m.ok) {
      My.profile = m.profile;
      if (m.token) { My.token = m.token; localStorage.setItem('worm_token', m.token); }
      if (m.profile) {
        My.skin = m.profile.skin; My.customSkin = m.profile.customSkin; My.wear = m.profile.wear;
        UI.saveMyConfig();
      }
      UI.updateProfile(m.profile);
      UI.refreshPreview();
      UI.hide('modal-login');
      document.getElementById('login-err').textContent = '';
    } else if (m.err) {
      document.getElementById('login-err').textContent =
        m.err === 'exists' ? 'El usuario ya existe' :
        m.err === 'invalid' ? 'Usuario o contraseña incorrectos' :
        m.err === 'bad_user' ? 'Usuario inválido (3-16 letras/números)' :
        m.err === 'bad_pass' ? 'Contraseña muy corta (mín. 4)' : 'Error';
    }
  });
  Net.on('onJoin', (m) => {
    if (m.err) {
      const msg =
        m.err === 'party_not_found' ? UI.t('party_not_found') :
        m.err === 'party_full' ? UI.t('party_full') :
        UI.t('join_fail');
      alert(msg);
      return;
    }
    My.partyCode = m.party || null;
    if (My.partyCode) {
      location.hash = 'party=' + My.partyCode;
      UI.showPartyInvite(My.partyCode);
    }
    Render.onJoin(m);
    UI.hide('screen-menu'); UI.hide('screen-death');
    UI.show('hud');
    UI.updatePartyBanner(My.partyCode);
    if (Input.isTouch) UI.show('touch-boost');
    if (UI && document.getElementById('set-music').checked) AudioFX.startMusic();
  });
  Net.on('onSnap', (m) => Render.onSnap(m));
  Net.on('onDeath', (m) => {
    AudioFX.death();
    AudioFX.boost(false);
    G.dead = true;
    const d = Skins.def(My.skin, My.customSkin);
    Particles.confetti(G.self.x, G.self.y, [d.c1, d.c2, d.c3], 60);
    Particles.floatText(G.self.x, G.self.y - G.self.r * 2.5, '💀', '#fff', 54);
    setTimeout(() => {
      if (!G.playing) return;
      Render.reset();
      UI.showDeath(m);
    }, 3000);
  });
  Net.on('onStore', (m) => {
    if (m.ok && m.profile) {
      My.profile = m.profile;
      UI.updateProfile(m.profile);
      UI.renderStore();
      Editor.renderGallery();
    } else if (m.err === 'coins') {
      alert('🪙 No tienes monedas suficientes. ¡Juega para ganar más!');
    }
  });
  Net.on('onLeaders', (m) => { UI.renderLeaders(m.list); UI.show('modal-leaders'); });

  Render.start();

  // ===== Botones del menú =====
  document.getElementById('btn-play-arena').onclick = () => play('arena');
  document.getElementById('btn-play-teams').onclick = () => play('teams');
  document.getElementById('btn-party').onclick = () => play('arena', { createParty: true });
  document.getElementById('btn-copy-party').onclick = () => {
    const inp = document.getElementById('party-link');
    inp.select();
    try {
      navigator.clipboard.writeText(inp.value);
    } catch {
      document.execCommand('copy');
    }
    document.getElementById('party-status').textContent = UI.t('copied');
  };
  document.getElementById('btn-clear-party').onclick = () => {
    My.pendingParty = null;
    history.replaceState(null, '', location.pathname + location.search);
    UI.updatePartyHint(null);
  };
  document.getElementById('btn-skins').onclick = () => Editor.open();
  document.getElementById('btn-store').onclick = () => { UI.renderStore(); UI.show('modal-store'); };
  document.getElementById('btn-leaders').onclick = () => Net.leaders();
  document.getElementById('btn-settings').onclick = () => UI.show('modal-settings');
  document.getElementById('btn-login').onclick = () => UI.show('modal-login');
  document.getElementById('btn-logout').onclick = () => {
    My.profile = null; My.token = null;
    localStorage.removeItem('worm_token');
    UI.updateProfile(null);
  };
  document.getElementById('tab-skins').onclick = () => UI.setStoreTab('skins');
  document.getElementById('tab-wear').onclick = () => UI.setStoreTab('wear');

  document.getElementById('btn-do-login').onclick = () => {
    Net.login(document.getElementById('login-user').value, document.getElementById('login-pass').value);
  };
  document.getElementById('btn-do-register').onclick = () => {
    Net.register(document.getElementById('login-user').value, document.getElementById('login-pass').value);
  };

  // ===== Pantalla de muerte =====
  document.getElementById('btn-again').onclick = () => {
    const opts = {};
    if (My.partyCode) opts.party = My.partyCode;
    else if (My.pendingParty) opts.party = My.pendingParty;
    play(My.mode === 'teams' && !opts.party ? 'teams' : 'arena', opts);
  };
  document.getElementById('btn-menu').onclick = () => {
    UI.hide('screen-death'); UI.show('screen-menu'); UI.refreshPreview();
    if (My.partyCode) UI.showPartyInvite(My.partyCode);
  };
  document.getElementById('btn-exit').onclick = () => location.reload();

  setInterval(UI.updateHud, 120);
  document.addEventListener('pointerdown', () => AudioFX.unlock(), { once: true });

  function parsePartyHash() {
    const m = location.hash.match(/party=([A-Za-z0-9]+)/i);
    My.pendingParty = m ? m[1].toUpperCase() : null;
    UI.updatePartyHint(My.pendingParty);
  }

  function play(mode, opts) {
    opts = opts || {};
    My.mode = mode;
    My.name = document.getElementById('inp-name').value.trim().slice(0, 14) || 'Worm';
    localStorage.setItem('worm_name', My.name);
    AudioFX.unlock();
    // si hay party pendiente en la URL y no estamos creando otra, unirse a ella
    if (!opts.createParty && !opts.party && My.pendingParty) opts.party = My.pendingParty;
    // party siempre es arena (FFA con fuego amigo)
    if (opts.createParty || opts.party) mode = 'arena';
    Net.join(mode, My.name, My.skin, My.customSkin, My.wear, opts);
  }
})();
