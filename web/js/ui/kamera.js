// Kompass: erscheint, sobald die Kamera gedreht oder geneigt ist (wie bei Kartenspielen und Karten-Apps).
// Die Nadel zeigt nach Norden und kippt mit der Neigung. Antippen: weich zurueck zu Norden oben
// und Standardneigung, Ort und Zoom bleiben. Fuer alle Geraete.
//
// Steuerung der Kamera selbst: core/input.js (Finger, Maus links), ui/input-pc.js (rechte Maustaste,
// Rad, Tasten). Schnittstelle der Kamera: core/camera.js (rotateFree, tiltFree, ausrichten, pitchGrad).

const CSS = `
#btn-kompass { padding: 0; display: grid; place-items: center; cursor: pointer; touch-action: manipulation;
  transition: opacity 0.25s, transform 0.25s; }
#btn-kompass[hidden] { display: grid; opacity: 0; transform: scale(0.6); pointer-events: none; }
#btn-kompass svg { width: 34px; height: 34px; overflow: visible; }
#btn-kompass:focus-visible { outline: 3px solid #23897d; outline-offset: 2px; }
#btn-kompass:active { transform: scale(0.94); }
/* Platz und Aussehen, solange die neue Oberflaeche (.hm-neu, ui/oberflaeche.js) ihn nicht einordnet */
#btn-kompass:not(.hm-neu *) {
  position: absolute; right: 12px; top: 50%; z-index: 6;
  width: 48px; height: 48px; margin-top: -24px; border: 0; border-radius: 50%;
  background: rgba(255, 252, 246, 0.94); box-shadow: 0 2px 10px rgba(20, 40, 60, 0.22);
}
body.card-open #btn-kompass:not(.hm-neu *), body.foto #btn-kompass, body.help-open #btn-kompass { opacity: 0; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { #btn-kompass { transition: none; } }
`;

const SVG = `<svg viewBox="-20 -20 40 40" aria-hidden="true">
  <g class="kompass-scheibe">
    <ellipse class="kompass-ring" cx="0" cy="0" rx="16" ry="16" fill="none" stroke="#c9d3da" stroke-width="2"/>
    <g class="kompass-nadel">
      <path d="M0 -14 L5 0 L-5 0 Z" fill="#e0553d"/>
      <path d="M0 14 L5 0 L-5 0 Z" fill="#33475f"/>
      <circle r="1.8" fill="#fff"/>
    </g>
    <text class="kompass-n" x="0" y="-17.5" text-anchor="middle" font-size="7" font-weight="700" fill="#e0553d" font-family="system-ui, sans-serif">N</text>
  </g>
</svg>`;

export function init(game) {
  const rig = game.camera;
  if (!rig || typeof rig.ausrichten !== 'function') return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-kompass';
  btn.hidden = true;
  btn.title = 'Norden nach oben';
  btn.setAttribute('aria-label', 'Kamera ausrichten: Norden nach oben, normale Neigung');
  btn.innerHTML = SVG;
  (game.canvas.parentElement || document.body).appendChild(btn);
  const scheibe = btn.querySelector('.kompass-scheibe');

  // Seitliche Leiste (Tablet quer: #hud-bottom als Spalte rechts, Linkshaender links) freilassen
  function platz() {
    if (btn.matches('.hm-neu *')) { btn.style.right = ''; return; }
    const c = game.canvas.getBoundingClientRect();
    let rechts = 12;
    for (const id of ['hud-bottom', 'hud-top']) {
      const el = document.getElementById(id);
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      const mitte = c.top + c.height / 2;
      if (r.height > c.height * 0.4 && r.top < mitte && r.bottom > mitte && r.left > c.left + c.width / 2) {
        rechts = Math.max(rechts, c.right - r.left + 12);
      }
    }
    btn.style.right = `${Math.round(rechts)}px`;
  }
  game.on('resize', () => requestAnimationFrame(platz));
  game.on('ready', () => requestAnimationFrame(platz));
  btn.addEventListener('transitionstart', platz);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    rig.ausrichten();
    game.emit('kamera:ausrichten');
  });

  // Nadel jedes Bild nachfuehren (nur wenn sich etwas geaendert hat)
  let letzt = '';
  game.onTick(() => {
    const yaw = rig.yawGrad ?? 0;
    const pitch = rig.pitchGrad ?? 50;
    const norden = ((yaw % 360) + 540) % 360 - 180;     // -180..180, 0 = Norden oben
    const std = (rig.pitchStandard ?? 0.873) * 180 / Math.PI;
    const zeigen = Math.abs(norden) > 2 || Math.abs(pitch - std) > 2;
    if (btn.hidden === zeigen) { btn.hidden = !zeigen; if (zeigen) platz(); }
    if (!zeigen) return;
    // Karte dreht mit yaw gegen den Uhrzeigersinn, also zeigt Norden im Bild um yaw gedreht
    const kipp = Math.max(0.55, Math.sin(pitch * Math.PI / 180));
    const t = `scale(1 ${kipp.toFixed(3)}) rotate(${norden.toFixed(1)})`;
    if (t !== letzt) { scheibe.setAttribute('transform', t); letzt = t; }
  });
}
