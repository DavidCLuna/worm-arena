// Editor de skin personalizada: patrón + 3 colores con vista previa en vivo
const Editor = (() => {
  const PATTERNS = ['tri', 'solid', 'stripes', 'hstripes', 'gradient', 'dots', 'checker', 'rainbow'];
  const PATTERN_NAMES = {
    tri: 'Tricolor', solid: 'Sólido', stripes: 'Rayas', hstripes: 'Bandas',
    gradient: 'Degradado', dots: 'Puntos', checker: 'Cuadros', rainbow: 'Arcoíris',
  };
  let current = { p: 'tri', c1: '#ff5d5d', c2: '#ffffff', c3: '#3aa0ff' };

  function init() {
    const box = document.getElementById('ed-patterns');
    PATTERNS.forEach(p => {
      const b = document.createElement('button');
      b.className = 'pat-btn' + (p === current.p ? ' active' : '');
      b.textContent = PATTERN_NAMES[p];
      b.dataset.pat = p;
      b.onclick = () => {
        current.p = p;
        box.querySelectorAll('.pat-btn').forEach(x => x.classList.toggle('active', x.dataset.pat === p));
        preview();
      };
      box.appendChild(b);
    });
    for (const k of ['c1', 'c2', 'c3']) {
      document.getElementById('ed-' + k).oninput = (e) => { current[k] = e.target.value; preview(); };
    }
    document.getElementById('btn-ed-use').onclick = () => {
      My.skin = -1;
      My.customSkin = { ...current };
      UI.saveMyConfig();
      UI.refreshPreview();
      UI.hide('modal-editor');
    };
    renderGallery();
  }

  function preview() {
    Skins.drawPreview(document.getElementById('ed-preview'), -1, current, My.wear);
  }

  // Galería de skins predefinidas dentro del editor
  function renderGallery() {
    const grid = document.getElementById('skins-grid');
    grid.innerHTML = '';
    CONST.SKINS.forEach((s, i) => {
      const owned = !My.profile ? s[5] === 0 : My.profile.ownedSkins.includes(i);
      if (!owned) return; // en la galería solo las que posees
      const div = document.createElement('div');
      div.className = 'store-item' + (My.skin === i ? ' selected' : '');
      const cv = document.createElement('canvas'); cv.width = 100; cv.height = 42;
      Skins.drawPreview(cv, i, null, 'none');
      div.appendChild(cv);
      div.insertAdjacentHTML('beforeend', `<div>${s[0]}</div>`);
      div.onclick = () => {
        My.skin = i; My.customSkin = null;
        UI.saveMyConfig(); UI.refreshPreview();
        renderGallery(); UI.hide('modal-editor');
      };
      grid.appendChild(div);
    });
    // entrada para la personalizada actual
    if (My.customSkin) {
      const div = document.createElement('div');
      div.className = 'store-item' + (My.skin === -1 ? ' selected' : '');
      const cv = document.createElement('canvas'); cv.width = 100; cv.height = 42;
      Skins.drawPreview(cv, -1, My.customSkin, 'none');
      div.appendChild(cv);
      div.insertAdjacentHTML('beforeend', `<div>${UI.t('custom')}</div>`);
      div.onclick = () => { My.skin = -1; UI.saveMyConfig(); renderGallery(); };
      grid.appendChild(div);
    }
  }

  function open() {
    if (My.customSkin) current = { ...My.customSkin };
    document.getElementById('ed-c1').value = current.c1;
    document.getElementById('ed-c2').value = current.c2;
    document.getElementById('ed-c3').value = current.c3;
    document.querySelectorAll('#ed-patterns .pat-btn').forEach(x => x.classList.toggle('active', x.dataset.pat === current.p));
    preview();
    renderGallery();
    UI.show('modal-editor');
  }

  return { init, open, renderGallery };
})();
