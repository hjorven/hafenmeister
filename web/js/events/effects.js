// Wettereffekte als leichte 2D-Ebene über der 3D-Szene: Regen, Schnee, Nebelschwaden,
// Sturmtönung, Blitze und Feuerwerk am Abend des Hafenfests.
// Bewusst unabhängig von der Landschaft: Die Ebene fängt keine Klicks ab und kostet wenig.
// Die Landschaft kann zusätzlich selbst auf game.on('weather') reagieren (Wellen, Gischt, Wolken).

const MAX_DROPS = 260;
const MAX_FLAKES = 140;

export function initEffects(game) {
  const host = document.getElementById('game') ?? document.body;
  const stage = document.getElementById('stage');
  const canvas = document.createElement('canvas');
  canvas.id = 'weather-fx';
  canvas.setAttribute('aria-hidden', 'true');
  if (stage && stage.parentNode === host) stage.after(canvas); else host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // Zielwerte (aus 'weather') und aktuelle, weich überblendete Werte
  const target = { wind: 0.2, fog: 0, rain: 0, snow: 0, sun: 0.7 };
  const cur = { ...target };
  let fireworks = false;
  let w = 0, h = 0, dpr = 1;

  const drops = [];
  const flakes = [];
  const wisps = [];
  const sparks = [];
  let rocketTimer = 0;
  let flash = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  for (let i = 0; i < 6; i++) wisps.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 });

  game.on('weather', (wx) => {
    if (!wx) return;
    for (const k of Object.keys(target)) target[k] = wx[k] ?? 0;
  });

  const updateFireworks = () => {
    const ev = game.events?.current?.event;
    fireworks = !!ev && ev.evening === 'feuerwerk' && game.events.phase === 'abend';
  };
  game.on('event:phase', updateFireworks);
  game.on('event:start', updateFireworks);
  game.on('event:end', () => { fireworks = false; });

  function spawnRocket() {
    const x = w * (0.2 + Math.random() * 0.6);
    const y = h * (0.15 + Math.random() * 0.3);
    const hue = [8, 45, 190, 120, 320][Math.floor(Math.random() * 5)];
    const n = reduced ? 24 : 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 60 + Math.random() * 60;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.5, age: 0, hue });
    }
    game.emit('sound', { id: 'feuerwerk' });
  }

  game.onTick((dt) => {
    if (w === 0 || h === 0) return;
    // Weich überblenden (etwa 3 Sekunden)
    const k = Math.min(1, dt * 0.35);
    for (const key of Object.keys(cur)) cur[key] += (target[key] - cur[key]) * k;

    ctx.clearRect(0, 0, w, h);
    const tilt = cur.wind * 0.6;

    // Sturmtönung und trübes Licht
    const gloom = Math.max(0, cur.rain * 0.18 + (1 - cur.sun) * 0.08);
    if (gloom > 0.01) { ctx.fillStyle = `rgba(40, 54, 72, ${gloom.toFixed(3)})`; ctx.fillRect(0, 0, w, h); }

    // Blitz bei Sturm: kurzes, seltenes Aufhellen (nicht bei reduzierter Bewegung)
    if (!reduced && dt > 0 && cur.rain > 0.8 && cur.wind > 0.8 && Math.random() < dt * 0.06) {
      flash = 1;
      game.emit('sound', { id: 'donner' });
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 250, ${(flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      flash = Math.max(0, flash - dt * 4);
    }

    // Nebel: helle Schleier, die langsam ziehen
    if (cur.fog > 0.02) {
      ctx.fillStyle = `rgba(240, 244, 246, ${(cur.fog * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      for (const p of wisps) {
        if (dt > 0) p.x += p.v * dt * (1 + cur.wind);
        if (p.x > 1.3) { p.x = -0.3; p.y = Math.random(); }
        const r = Math.max(w, h) * 0.35 * p.s;
        const gx = p.x * w, gy = p.y * h;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, `rgba(250, 252, 253, ${(cur.fog * 0.45).toFixed(3)})`);
        g.addColorStop(1, 'rgba(250, 252, 253, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
    }

    // Regen: schräge Striche
    const wantDrops = Math.round(cur.rain * (reduced ? MAX_DROPS / 3 : MAX_DROPS));
    while (drops.length < wantDrops) drops.push({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 10, v: 500 + Math.random() * 300 });
    if (drops.length > wantDrops) drops.length = wantDrops;
    if (drops.length) {
      ctx.strokeStyle = 'rgba(220, 232, 240, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        d.y += d.v * dt; d.x += d.v * tilt * dt;
        if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + h * tilt) - h * tilt; }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * tilt, d.y - d.l);
      }
      ctx.stroke();
    }

    // Schnee im Winter
    const wantFlakes = Math.round(cur.snow * (reduced ? MAX_FLAKES / 3 : MAX_FLAKES));
    while (flakes.length < wantFlakes) flakes.push({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2, v: 20 + Math.random() * 30, p: Math.random() * 6 });
    if (flakes.length > wantFlakes) flakes.length = wantFlakes;
    if (flakes.length) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const f of flakes) {
        f.p += dt; f.y += f.v * dt; f.x += (Math.sin(f.p) * 10 + cur.wind * 30) * dt;
        if (f.y > h) { f.y = -4; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Feuerwerk
    if (fireworks && dt > 0) {
      rocketTimer -= dt;
      if (rocketTimer <= 0) { spawnRocket(); rocketTimer = 0.9 + Math.random() * 1.4; }
    }
    if (sparks.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) { sparks.splice(i, 1); continue; }
        s.vy += 40 * dt; s.vx *= 1 - dt * 0.8; s.vy *= 1 - dt * 0.8;
        s.x += s.vx * dt; s.y += s.vy * dt;
        const a = 1 - s.age / s.life;
        ctx.fillStyle = `hsla(${s.hue}, 90%, 65%, ${a.toFixed(3)})`;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  });
}
