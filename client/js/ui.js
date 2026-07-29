// UI: i18n, HUD, modales, tienda, clasificación, ajustes
const UI = (() => {
  const I18N = {
    es: {
      tagline: '¡Atrapa caramelos, galletas y pasteles!', name: 'Tu nombre',
      arena: 'Arena', teams: '2 Equipos', skins: 'Skins', store: 'Tienda',
      leaders: 'Clasificación', settings: 'Ajustes', login: 'Iniciar sesión',
      register: 'Registrarse', logout: 'Salir', close: 'Cerrar', level: 'Nivel',
      best: 'Récord', dead: '¡Te comieron!', again: 'Jugar otra vez', menu: 'Menú',
      levelup: '¡Subiste de nivel!', music: 'Música', sfx: 'Efectos de sonido',
      shownames: 'Mostrar nombres', lang: 'Idioma', user: 'Usuario', pass: 'Contraseña',
      wear: 'Accesorios', editor: 'Editor de skin', use: 'Usar esta skin',
      gallery: 'Galería', needlogin: '(inicia sesión para comprar)',
      score: 'Puntos', time: 'Tiempo', kills: 'Bajas', custom: 'Personalizada',
      ateyou: 'Te comió', borderdeath: '¡Chocaste con el borde!',
      party: '🎉 Party con amigos', partylink: 'Link de party', copy: 'Copiar',
      copied: '¡Copiado! Compártelo con tus amigos',
      joiningparty: 'Entrarás a la party', clearparty: 'Quitar',
      party_not_found: 'Party no encontrada (¿expiró el código?)',
      party_full: 'Party llena (máx. 8)', join_fail: 'No se pudo unir',
    },
    en: {
      tagline: 'Catch candies, cookies and cakes!', name: 'Your name',
      arena: 'Arena', teams: '2 Teams', skins: 'Skins', store: 'Store',
      leaders: 'Leaderboard', settings: 'Settings', login: 'Log in',
      register: 'Sign up', logout: 'Log out', close: 'Close', level: 'Level',
      best: 'Best', dead: 'You got eaten!', again: 'Play again', menu: 'Menu',
      levelup: 'Level up!', music: 'Music', sfx: 'Sound effects',
      shownames: 'Show names', lang: 'Language', user: 'Username', pass: 'Password',
      wear: 'Wear', editor: 'Skin editor', use: 'Use this skin',
      gallery: 'Gallery', needlogin: '(log in to buy)',
      score: 'Score', time: 'Time', kills: 'Kills', custom: 'Custom',
      ateyou: 'You were eaten by', borderdeath: 'You hit the border!',
      party: '🎉 Party with friends', partylink: 'Party link', copy: 'Copy',
      copied: 'Copied! Share it with friends',
      joiningparty: 'You will join party', clearparty: 'Clear',
      party_not_found: 'Party not found (code expired?)',
      party_full: 'Party full (max 8)', join_fail: 'Could not join',
    },
  };
  let lang = 'es';
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.es[k] || k;

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang;
  }

  // ===== Ajustes =====
  const settings = { music: true, sfx: true, names: true, lang: 'es' };
  function loadSettings() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem('worm_settings') || '{}')); } catch {}
    lang = settings.lang;
    document.getElementById('set-music').checked = settings.music;
    document.getElementById('set-sfx').checked = settings.sfx;
    document.getElementById('set-names').checked = settings.names;
    document.getElementById('set-lang').value = settings.lang;
    AudioFX.setMusic(settings.music);
    AudioFX.setSfx(settings.sfx);
    G.showNames = settings.names;
    applyLang();
  }
  function saveSettings() {
    localStorage.setItem('worm_settings', JSON.stringify(settings));
  }
  function bindSettings() {
    document.getElementById('set-music').onchange = (e) => { settings.music = e.target.checked; AudioFX.setMusic(settings.music); saveSettings(); };
    document.getElementById('set-sfx').onchange = (e) => { settings.sfx = e.target.checked; AudioFX.setSfx(settings.sfx); saveSettings(); };
    document.getElementById('set-names').onchange = (e) => { settings.names = e.target.checked; G.showNames = settings.names; saveSettings(); };
    document.getElementById('set-lang').onchange = (e) => { settings.lang = e.target.value; lang = settings.lang; applyLang(); saveSettings(); };
  }

  // ===== Pantallas / modales =====
  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }
  function bindCloses() {
    document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => hide(b.dataset.close); });
  }

  // ===== HUD =====
  let lbLast = 0;
  function updateHud() {
    if (!G.playing) return;
    document.getElementById('score-val').textContent = Math.floor(G.self.mass);
    document.getElementById('kills-val').textContent = G.self.kills;
    const now = performance.now();
    if (now - lbLast > 500) {
      lbLast = now;
      const ol = document.getElementById('lb-list');
      ol.innerHTML = '';
      const friendNames = new Set();
      for (const e of G.worms.values()) { if (e.cur && e.cur.f) friendNames.add(e.cur.n); }
      G.lb.forEach((e, i) => {
        const li = document.createElement('li');
        if (e.n === My.name) li.className = 'me';
        else if (friendNames.has(e.n)) li.className = 'friend';
        li.innerHTML = `<span>${i + 1}. ${escapeHtml(e.n)}</span><b>${e.m}</b>`;
        ol.appendChild(li);
      });
      if (G.teamScores) {
        show('team-score');
        document.getElementById('ts-red').textContent = G.teamScores[0];
        document.getElementById('ts-blue').textContent = G.teamScores[1];
      } else hide('team-score');
      // iconos de efectos con cuenta regresiva
      const fx = G.self.liveFx || G.self.fx;
      const bar = document.getElementById('fxbar');
      bar.innerHTML = '';
      const icons = [];
      if (fx.spd > 0) icons.push(['🟢', fx.spd]);
      if (fx.agi > 0) icons.push(['🔵', fx.agi]);
      if (fx.mag > 0) icons.push(['🧲', fx.mag]);
      if (fx.zm > 0) icons.push(['🔍', fx.zm]);
      if (fx.mult > 0) icons.push(['✖' + fx.mult, fx.mt !== undefined ? fx.mt : 0]);
      for (const [ic, secs] of icons) {
        const d = document.createElement('div');
        d.className = 'fx-icon';
        d.textContent = `${ic} ${Math.ceil(secs)}s`;
        bar.appendChild(d);
      }
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ===== Perfil =====
  function updateProfile(p) {
    if (p) {
      show('profile-box'); hide('btn-login');
      document.getElementById('prof-user').textContent = p.user;
      document.getElementById('prof-level').textContent = p.level;
      document.getElementById('prof-coins').textContent = p.coins;
      document.getElementById('prof-best').textContent = p.stats.highScore;
    } else {
      hide('profile-box'); show('btn-login');
    }
  }

  // ===== Tienda =====
  let storeTab = 'skins';
  function renderStore() {
    document.getElementById('store-coins').textContent = My.profile ? My.profile.coins : 0;
    document.getElementById('store-guest-hint').style.display = My.profile ? 'none' : 'inline';
    document.getElementById('tab-skins').classList.toggle('active', storeTab === 'skins');
    document.getElementById('tab-wear').classList.toggle('active', storeTab === 'wear');
    const grid = document.getElementById('store-grid');
    grid.innerHTML = '';
    if (storeTab === 'skins') {
      CONST.SKINS.forEach((s, i) => {
        const owned = !My.profile ? s[5] === 0 : My.profile.ownedSkins.includes(i);
        const div = document.createElement('div');
        div.className = 'store-item' + (My.skin === i ? ' selected' : '');
        const cv = document.createElement('canvas'); cv.width = 100; cv.height = 42;
        Skins.drawPreview(cv, i, null, 'none');
        div.appendChild(cv);
        div.insertAdjacentHTML('beforeend',
          `<div>${escapeHtml(s[0])}</div>` +
          (owned ? `<div class="owned">✓</div>` : `<div class="price">🪙 ${s[5]}</div>`));
        div.onclick = () => {
          if (owned) { My.skin = i; My.customSkin = null; saveMyConfig(); renderStore(); refreshPreview(); }
          else if (My.profile) Net.buy('skin', i);
        };
        grid.appendChild(div);
      });
    } else {
      CONST.WEAR.forEach((w, i) => {
        const owned = !My.profile ? w[2] === 0 : My.profile.ownedWear.includes(w[0]);
        const div = document.createElement('div');
        div.className = 'store-item' + (My.wear === w[0] ? ' selected' : '');
        const cv = document.createElement('canvas'); cv.width = 100; cv.height = 42;
        Skins.drawPreview(cv, My.skin, My.customSkin, w[0]);
        div.appendChild(cv);
        div.insertAdjacentHTML('beforeend',
          `<div>${escapeHtml(w[1])}</div>` +
          (owned ? `<div class="owned">✓</div>` : `<div class="price">🪙 ${w[2]}</div>`));
        div.onclick = () => {
          if (owned) { My.wear = w[0]; saveMyConfig(); renderStore(); refreshPreview(); }
          else if (My.profile) Net.buy('wear', i);
        };
        grid.appendChild(div);
      });
    }
  }

  // ===== Clasificación global =====
  function renderLeaders(list) {
    const tb = document.querySelector('#leaders-table tbody');
    tb.innerHTML = '';
    list.forEach((e, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(e.user)}</td><td>${e.level}</td><td>${e.highScore}</td><td>${e.kills}/${e.headshots}</td>`;
      tb.appendChild(tr);
    });
  }

  function refreshPreview() {
    Skins.drawPreview(document.getElementById('skin-preview'), My.skin, My.customSkin, My.wear);
  }

  function saveMyConfig() {
    localStorage.setItem('worm_look', JSON.stringify({ skin: My.skin, customSkin: My.customSkin, wear: My.wear }));
    if (My.profile) Net.cfg({ skin: My.skin, customSkin: My.customSkin, wear: My.wear });
  }

  function showDeath(m) {
    const stats = document.getElementById('death-stats');
    const cause = m.by
      ? `💀 ${t('ateyou')} <b>${escapeHtml(m.by)}</b><br>`
      : `🧱 <b>${t('borderdeath')}</b><br>`;
    stats.innerHTML = cause +
      `🏆 ${t('score')}: <b>${m.score}</b><br>💀 ${t('kills')}: <b>${m.kills}</b><br>⏱ ${t('time')}: <b>${m.time}s</b>`;
    if (m.levelUp) {
      show('death-levelup');
      document.getElementById('death-level').textContent = m.newLevel;
      AudioFX.levelup();
    } else hide('death-levelup');
    hide('hud'); show('screen-death');
    spawnDeathFX();
    if (m.profile) { My.profile = m.profile; updateProfile(m.profile); }
  }

  function spawnDeathFX() {
    const layer = document.getElementById('death-confetti');
    const coins = document.getElementById('death-coins');
    if (layer) {
      layer.innerHTML = '';
      const colors = ['#f7e359', '#1a9fff', '#ff7a18', '#3ef0d0', '#ff2d55', '#ffffff'];
      for (let i = 0; i < 36; i++) {
        const el = document.createElement('i');
        el.style.left = Math.random() * 100 + '%';
        el.style.background = colors[i % colors.length];
        el.style.animationDelay = (Math.random() * 0.8) + 's';
        el.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
        layer.appendChild(el);
      }
    }
    if (coins) {
      coins.innerHTML = '';
      for (let i = 0; i < 14; i++) {
        const c = document.createElement('span');
        c.className = 'coin';
        c.textContent = '🪙';
        c.style.left = (10 + Math.random() * 80) + '%';
        c.style.animationDelay = (Math.random() * 0.6) + 's';
        coins.appendChild(c);
      }
    }
  }

  function showPartyInvite(code) {
    const box = document.getElementById('party-invite');
    if (!box || !code) return;
    box.classList.remove('hidden');
    const link = location.origin + location.pathname + '#party=' + code;
    document.getElementById('party-link').value = link;
    document.getElementById('party-status').textContent = '';
  }

  function updatePartyHint(code) {
    const hint = document.getElementById('party-join-hint');
    if (!hint) return;
    if (code) {
      hint.classList.remove('hidden');
      document.getElementById('party-join-code').textContent = code;
    } else {
      hint.classList.add('hidden');
    }
  }

  function updatePartyBanner(code) {
    const b = document.getElementById('party-banner');
    if (!b) return;
    if (code) {
      b.classList.remove('hidden');
      document.getElementById('party-code-hud').textContent = code;
    } else {
      b.classList.add('hidden');
    }
  }

  return {
    t, show, hide, bindCloses, bindSettings, loadSettings, updateHud,
    updateProfile, renderStore, renderLeaders, refreshPreview, saveMyConfig, showDeath,
    showPartyInvite, updatePartyHint, updatePartyBanner,
    setStoreTab: (tab) => { storeTab = tab; renderStore(); },
  };
})();
