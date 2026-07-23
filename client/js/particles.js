// Sistema de partículas: explosiones, confeti, anillos, textos flotantes
const Particles = (() => {
  let list = [];

  function spawn(x, y, opts) {
    list.push({
      x, y,
      vx: opts.vx || 0, vy: opts.vy || 0,
      life: opts.life || 0.6, maxLife: opts.life || 0.6,
      size: opts.size || 6, color: opts.color || '#fff',
      kind: opts.kind || 'dot', // dot | ring | text
      text: opts.text || '', grav: opts.grav || 0,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 8,
    });
  }

  // Migas + destellos al comer
  function burst(x, y, color, n = 6, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3,
                    size: 3 + Math.random() * 4, color, grav: 200 });
    }
  }

  // Explosión de confeti al morir (colores de la skin)
  function confetti(x, y, colors, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 380;
      spawn(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.9,
                    size: 4 + Math.random() * 7, color: colors[i % colors.length],
                    kind: 'rect', grav: 300 });
    }
  }

  // Anillo expansivo (poción, festín dorado)
  function ring(x, y, color, maxR = 120, life = 0.5) {
    spawn(x, y, { life, size: maxR, color, kind: 'ring' });
  }

  // Texto flotante "+N"
  function floatText(x, y, str, color = '#ffd23f', size = 26) {
    spawn(x, y, { vy: -70, life: 1.0, size, color, kind: 'text', text: str });
  }

  // Estela del boost (puntos)
  function trail(x, y, color) {
    spawn(x, y, { vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
                  life: 0.3 + Math.random() * 0.2, size: 3 + Math.random() * 5, color });
  }

  // Líneas de velocidad alrededor de la cabeza al hacer boost
  function streak(x, y, angle, speed, color) {
    spawn(x, y, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                  life: 0.22 + Math.random() * 0.15, size: 26 + Math.random() * 30,
                  color, kind: 'line' });
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    if (list.length > 600) list.splice(0, list.length - 600);
  }

  function draw(ctx) {
    for (const p of list) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      if (p.kind === 'ring') {
        const r = p.size * (1 - t);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * t + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.font = `${p.size}px 'Anton', 'Rajdhani', sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'line') {
        // línea a lo largo de su velocidad (estela de velocidad)
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3.5 * t + 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.09, p.y + p.vy * 0.09);
        ctx.stroke();
        ctx.lineCap = 'butt';
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t + 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function clear() { list = []; }

  return { burst, confetti, ring, floatText, trail, streak, update, draw, clear };
})();
