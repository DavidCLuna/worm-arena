// Entrada: mouse, teclado y táctil (joystick virtual + botón de boost)
const Input = (() => {
  let angle = 0, boost = false;
  let mouseX = 0, mouseY = 0;
  let joyId = null, joyOX = 0, joyOY = 0;
  const isTouch = 'ontouchstart' in window;

  function screenAngle(cx, cy) { return Math.atan2(mouseY - cy, mouseX - cx); }

  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) boost = true; AudioFX.unlock(); });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) boost = false; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { boost = true; e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') boost = false; });
  window.addEventListener('contextmenu', (e) => { if (e.target.id === 'game') e.preventDefault(); });

  // Botón flotante de boost (móviles/tablets): mantener presionado = correr
  const boostBtn = document.getElementById('touch-boost');
  let boostTouchId = null;
  if (boostBtn) {
    boostBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      AudioFX.unlock();
      boostTouchId = e.changedTouches[0].identifier;
      boost = true;
      boostBtn.classList.add('active');
    }, { passive: false });
    const release = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === boostTouchId) {
          boostTouchId = null; boost = false;
          boostBtn.classList.remove('active');
        }
      }
    };
    boostBtn.addEventListener('touchend', release);
    boostBtn.addEventListener('touchcancel', release);
  }

  // Táctil: primer dedo en el canvas = joystick de dirección (origen dinámico)
  window.addEventListener('touchstart', (e) => {
    AudioFX.unlock();
    for (const t of e.changedTouches) {
      if (t.target.id === 'touch-boost') continue;
      if (joyId === null && t.target.id === 'game') {
        joyId = t.identifier; joyOX = t.clientX; joyOY = t.clientY;
      }
    }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const dx = t.clientX - joyOX, dy = t.clientY - joyOY;
        if (Math.hypot(dx, dy) > 12) angle = Math.atan2(dy, dx);
      }
    }
  }, { passive: true });
  function touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) joyId = null;
    }
  }
  window.addEventListener('touchend', touchEnd);
  window.addEventListener('touchcancel', touchEnd);

  return {
    get boost() { return boost; },
    isTouch,
    // En modo mouse el ángulo depende del centro de pantalla cada frame
    computeAngle(cx, cy) {
      if (!isTouch) angle = screenAngle(cx, cy);
      return angle;
    },
  };
})();
