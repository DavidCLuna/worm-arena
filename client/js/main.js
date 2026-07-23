// main.js: estado global del jugador, arranque y flujo entre pantallas
var My = {
  name: 'Worm' + Math.floor(Math.random() * 1000),
  skin: 0, customSkin: null, wear: 'none',
  profile: null, token: localStorage.getItem('worm_token') || null,
  mode: 'arena',
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
      // la apariencia del perfil manda si existe
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
    Render.onJoin(m);
    UI.hide('screen-menu'); UI.hide('screen-death');
    UI.show('hud');
    if (Input.isTouch) UI.show('touch-boost');
    if (UI && document.getElementById('set-music').checked) AudioFX.startMusic();
  });
  Net.on('onSnap', (m) => Render.onSnap(m));
  Net.on('onDeath', (m) => {
    AudioFX.death();
    AudioFX.boost(false);
    // Cámara de muerte: 3 segundos viendo la zona (al que te mató) antes del panel
    G.dead = true;
    const d = Skins.def(My.skin, My.customSkin);
    Particles.confetti(G.self.x, G.self.y, [d.c1, d.c2, d.c3], 60);
    Particles.floatText(G.self.x, G.self.y - G.self.r * 2.5, '💀', '#fff', 54);
    setTimeout(() => {
      if (!G.playing) return; // por si acaso
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
  document.getElementById('btn-again').onclick = () => play(My.mode);
  document.getElementById('btn-menu').onclick = () => {
    UI.hide('screen-death'); UI.show('screen-menu'); UI.refreshPreview();
  };
  document.getElementById('btn-exit').onclick = () => location.reload();

  // HUD en vivo
  setInterval(UI.updateHud, 120);

  // Desbloquear audio en el primer gesto del usuario
  document.addEventListener('pointerdown', () => AudioFX.unlock(), { once: true });

  function play(mode) {
    My.mode = mode;
    My.name = document.getElementById('inp-name').value.trim().slice(0, 14) || 'Worm';
    localStorage.setItem('worm_name', My.name);
    AudioFX.unlock();
    Net.join(mode, My.name, My.skin, My.customSkin, My.wear);
  }
})();
