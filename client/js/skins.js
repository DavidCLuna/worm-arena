// Motor de skins procedurales: patrones × colores, accesorios, previews
// Render "gominola 3D": cada color se pre-renderiza como esfera con gradiente (caché)
const Skins = (() => {

  function def(sel, custom) {
    if (sel === -1 && custom) return { p: custom.p, c1: custom.c1, c2: custom.c2, c3: custom.c3 };
    const s = CONST.SKINS[sel] || CONST.SKINS[0];
    return { p: s[1], c1: s[2], c3: s[4], c2: s[3] };
  }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbStr(r, g, b) { return `rgb(${r|0},${g|0},${b|0})`; }
  function parseColor(c) {
    if (c[0] === '#') return hexToRgb(c);
    const m = c.match(/(\d+(?:\.\d+)?)/g);
    return m ? [+m[0], +m[1], +m[2]] : [255, 255, 255];
  }
  function lerpColor(a, b, t) {
    const A = parseColor(a), B = parseColor(b);
    return rgbStr(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function shade(c, f) { // f<1 oscurece, f>1 aclara
    const [r, g, b] = parseColor(c);
    return rgbStr(Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f));
  }

  // Color del segmento i de n para un patrón dado
  function bodyColor(d, i, n) {
    const t = n > 1 ? i / (n - 1) : 0;
    switch (d.p) {
      case 'solid':    return d.c1;
      case 'tri':      return [d.c1, d.c2, d.c3][i % 3];
      case 'stripes':  return (Math.floor(i / 2) % 2) ? d.c2 : d.c1;
      case 'hstripes': return t < 0.34 ? d.c1 : (t < 0.67 ? d.c2 : d.c3);
      case 'gradient': return lerpColor(d.c1, d.c2, t);
      case 'dots':     return d.c1;
      case 'checker':  return (i % 2) ? d.c2 : d.c1;
      case 'rainbow':  return `hsl(${(i * 16) % 360},90%,55%)`;
      default:         return d.c1;
    }
  }

  // ===== Cuerpo TUBO CONTINUO: un solo trazo suave por capas =====
  // (sombra → outline → color/patrón → brillo). Sin bandas entre segmentos.
  function strokeChunk(ctx, pts, i0, i1, width, color, dash, dashOff, offY) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOff || 0; }
    ctx.beginPath();
    const oy = offY || 0;
    ctx.moveTo(pts[i0].x, pts[i0].y + oy);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i].x, pts[i].y + oy);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  function drawBody(ctx, pts, r, d, withShadow) {
    const n = pts.length;
    if (n < 2) return;
    // longitudes acumuladas (para continuidad de patrones dash)
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[n - 1] || 1;

    // trozos cabeza→cola con GROSOR UNIFORME en todo el cuerpo
    const isFlow = d.p === 'gradient' || d.p === 'rainbow';
    const CH = isFlow ? 14 : 5;
    const chunks = [];
    for (let c = 0; c < CH; c++) {
      const i0 = Math.floor((c / CH) * (n - 1));
      const i1 = Math.max(i0 + 1, Math.ceil(((c + 1) / CH) * (n - 1)));
      chunks.push({ i0, i1, w: r * 2 }); // mismo grosor en todo el cuerpo
    }

    // 1) sombra
    if (withShadow !== false) {
      for (const ch of chunks) strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w * 1.02, 'rgba(0,0,0,.14)', null, 0, r * 0.5);
    }
    // 2) outline oscuro (da definición al tubo)
    for (const ch of chunks) strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w * 1.14, 'rgba(12,8,18,.5)');

    // 3) color base + patrón
    const L = r * 1.5;
    for (let c = 0; c < chunks.length; c++) {
      const ch = chunks[c];
      const t = cum[ch.i0] / total; // progreso 0=cabeza → 1=cola
      const off = -cum[ch.i0];
      switch (d.p) {
        case 'gradient':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, lerpColor(d.c1, d.c2, t));
          break;
        case 'rainbow':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, `hsl(${(t * 420) % 360},90%,55%)`);
          break;
        case 'hstripes':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, t < 0.34 ? d.c1 : (t < 0.67 ? d.c2 : d.c3));
          break;
        case 'stripes':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c1);
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c2, [L, L], off);
          break;
        case 'checker':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c1);
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c2, [r * 0.95, r * 0.95], off);
          break;
        case 'tri':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c1);
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c2, [L, L * 2], off);
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c3, [L, L * 2], off + L);
          break;
        case 'dots':
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c1);
          break;
        default: // solid
          strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w, d.c1);
      }
    }
    // puntos decorativos encima (patrón dots)
    if (d.p === 'dots') {
      for (let i = 2; i < n; i += 3) {
        const rr = r * 0.42;
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y - rr * 0.3, rr, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 4) brillo superior (sheen) → volumen gominola sin bandas
    for (const ch of chunks) {
      strokeChunk(ctx, pts, ch.i0, ch.i1, ch.w * 0.42, 'rgba(255,255,255,.20)', null, 0, -ch.w * 0.2);
    }
  }

  // Ojos cartoon grandes con brillo + sonrisa
  function drawEyes(ctx, x, y, r, angle) {
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const px = -ey, py = ex;
    const eo = r * 0.52, fo = r * 0.38;
    for (const s of [-1, 1]) {
      const cx = x + ex * fo + px * eo * s, cy = y + ey * fo + py * eo * s;
      const er = r * 0.42;
      // esclerótica con borde
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = er * 0.14;
      ctx.stroke();
      // pupila
      ctx.fillStyle = '#16121f';
      ctx.beginPath(); ctx.arc(cx + ex * er * 0.32, cy + ey * er * 0.32, er * 0.5, 0, Math.PI * 2); ctx.fill();
      // brillo
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + ex * er * 0.32 - er * 0.18, cy + ey * er * 0.32 - er * 0.2, er * 0.17, 0, Math.PI * 2); ctx.fill();
    }
    // sonrisa
    const mx = x + ex * r * 0.55, my = y + ey * r * 0.55;
    ctx.strokeStyle = 'rgba(20,10,20,.65)';
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(mx, my, r * 0.42, angle + 0.55, angle + Math.PI - 0.55);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Accesorios sobre la cabeza
  function drawWear(ctx, x, y, r, angle, key) {
    if (!key || key === 'none') return;
    const up = angle - Math.PI / 2;
    const hx = x + Math.cos(up) * r * 0.9, hy = y + Math.sin(up) * r * 0.9;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle + Math.PI / 2);
    const u = r / 20;
    switch (key) {
      case 'crown':
        ctx.fillStyle = '#ffd23f';
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.moveTo(-14 * u, 4 * u); ctx.lineTo(-14 * u, -6 * u); ctx.lineTo(-7 * u, 0);
        ctx.lineTo(0, -10 * u); ctx.lineTo(7 * u, 0); ctx.lineTo(14 * u, -6 * u); ctx.lineTo(14 * u, 4 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e33';
        ctx.beginPath(); ctx.arc(0, -3 * u, 2.4 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'cap':
        ctx.fillStyle = '#e33';
        ctx.beginPath(); ctx.arc(0, 2 * u, 12 * u, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c22';
        ctx.fillRect(2 * u, -2 * u, 16 * u, 4 * u);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -10 * u, 2.5 * u, 0, Math.PI * 2); ctx.fill();
        break;
      case 'glasses':
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5 * u;
        ctx.fillStyle = 'rgba(30,30,40,.75)';
        ctx.beginPath(); ctx.arc(-7 * u, 2 * u, 6 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(7 * u, 2 * u, 6 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-1 * u, 2 * u); ctx.lineTo(1 * u, 2 * u); ctx.stroke();
        break;
      case 'horns':
        ctx.fillStyle = '#eee';
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1 * u;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 8 * u, 2 * u); ctx.lineTo(s * 14 * u, -12 * u); ctx.lineTo(s * 4 * u, -4 * u);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        break;
      case 'halo':
        ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 3 * u;
        ctx.shadowColor = '#ffe97a'; ctx.shadowBlur = 8 * u;
        ctx.beginPath(); ctx.ellipse(0, -10 * u, 10 * u, 4 * u, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'flower':
        ctx.fillStyle = '#ff9ff3';
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 7 * u, Math.sin(a) * 7 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(0, 0, 4 * u, 0, Math.PI * 2); ctx.fill();
        break;
    }
    ctx.restore();
  }

  // Vista previa de un gusano ondulado en un canvas
  function drawPreview(canvas, sel, custom, wearKey) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const d = def(sel, custom);
    const pts = [];
    const n = 16, r = H * 0.18;
    for (let i = 0; i < n; i++) {
      const x = W - 30 - i * (W - 60) / n;
      const y = H / 2 + Math.sin(i * 0.55) * H * 0.18;
      pts.push({ x, y });
    }
    drawBody(ctx, pts, r, d, false);
    const head = pts[0];
    const ang = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
    drawEyes(ctx, head.x, head.y, r * 1.15, ang);
    drawWear(ctx, head.x, head.y, r * 1.15, ang, wearKey);
  }

  return { def, bodyColor, drawBody, drawEyes, drawWear, drawPreview, lerpColor, shade, parseColor };
})();
