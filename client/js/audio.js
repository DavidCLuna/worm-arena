// Audio 100% procedural con WebAudio: SFX + música, sin assets externos
const AudioFX = (() => {
  let ctx = null, musicOn = true, sfxOn = true;
  let musicTimer = null, boostNode = null;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    if (!sfxOn || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  function eat() { blip(500 + Math.random() * 500, 0.08, 'square', 0.08, 200); }
  function potion() {
    if (!sfxOn || !ensure()) return;
    [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.15, 'sine', 0.12), i * 70));
  }
  function death() {
    if (!sfxOn || !ensure()) return;
    blip(400, 0.7, 'sawtooth', 0.15, -350);
  }
  function kill() { blip(300, 0.2, 'triangle', 0.14, 250); }
  function levelup() {
    if (!sfxOn || !ensure()) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.13), i * 100));
  }

  function boost(on) {
    if (!ensure()) return;
    if (on && !boostNode) {
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = sfxOn ? 0.05 : 0;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
      boostNode = { src, g };
    } else if (!on && boostNode) {
      try { boostNode.src.stop(); } catch {}
      boostNode = null;
    }
  }

  // Música: loop chiptune simple (bajo + arpegio)
  const bassNotes = [110, 110, 131, 98];
  const arpNotes = [220, 262, 330, 392, 330, 262];
  let step = 0;
  function musicStep() {
    if (!musicOn || !ctx) return;
    const t = ctx.currentTime;
    const b = bassNotes[Math.floor(step / 4) % bassNotes.length];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = b;
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    if (step % 2 === 0) {
      const a = arpNotes[(step / 2) % arpNotes.length];
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'square'; o2.frequency.value = a;
      g2.gain.setValueAtTime(0.035, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o2.connect(g2).connect(ctx.destination); o2.start(t); o2.stop(t + 0.2);
    }
    step++;
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(musicStep, 240);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  return {
    eat, potion, death, kill, levelup, boost, startMusic, stopMusic,
    setMusic(v) { musicOn = v; if (!v) stopMusic(); },
    setSfx(v) { sfxOn = v; if (!v) boost(false); },
    unlock() { ensure(); },
  };
})();
