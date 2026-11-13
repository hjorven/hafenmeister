// PC-Bedienung: Maus, Trackpad und Tastatur. Gehört dem PC-UI-Thread.
//
// Arbeitsteilung mit den anderen Eingabe-Modulen:
//   core/input.js  linke Taste ziehen = Karte verschieben, Mausrad, Tipp (tap)        für alle Geräte
//   ui/gesten.js   Schleppleine von der Warteboje, Kassierstrich                       für alle Geräte
//   ui/oberflaeche.js  Tempo-Knöpfe unten links (Pause, 1x, 3x, 8x)                     für alle Geräte
//   ui/input-pc.js (diese Datei) alles, was nur Maus und Tastatur können:
//     - rechte oder mittlere Maustaste ziehen = Kamera schwenken: links/rechts dreht, hoch/runter neigt
//       (rechte Taste nur geklickt = Abbrechen)
//     - Mausrad: rechnet Firefox-Zeilen und Trackpad-Pinch richtig um, Umschalt + Rad dreht, Alt + Rad neigt
//     - Doppelklick: wartendes Boot fährt selbst ein, sonst näher heran
//     - Mauszeiger und Tooltip je nach Objekt unter der Maus
//     - Tastenkürzel und eine Hilfe-Übersicht (Taste ?), Tastenschilder an den Knöpfen
//   Touch-Eingaben werden hier nie abgefangen.
//
// Was dieses Modul vom Spielobjekt nutzt (mit ? = optional, ohne fällt nur die Funktion weg):
//   game.canvas, game.camera.zoomAt/panBy/reset/screenToWorld, game.pick, game.setPaused, game.paused,
//   game.speed, game.on/emit
//   game.camera.rotateBy?(rad), rotateFree?(rad), tiltFree?(rad), tiltBy?(rad), release?(), flyTo?(x, z)
//   game.sim?.wartet?(bootId)        wartet das Boot vor dem Hafen?
//   game.describe?(treffer)          -> Tooltip-Text oder null (sonst ein kurzer Text aus game.sim.state)
//   game.sim?.waitingBoats?(), select?(id), selected   Boot per Taste wählen
//   game.spielstand?.oeffnen?()      Fenster "Spielstand"
//
// Gesendete Ereignisse (docs/grundgeruest.md):
//   ui:cancel                 Esc oder Rechtsklick
//   ui:auto-einfahren {boot}  Doppelklick auf ein wartendes Boot
//   ui:vorspulen {speed}      Taste F schaltet 3x an und aus, über game.oberflaeche.tempo (wie die Tempo-Knöpfe unten links)
//   ui:mute                   Taste M
// Über das DOM: 1 bis 9 und Tab klicken die Boot-Knöpfe in #queue ([data-boat], aria-pressed),
// bei offener Karte wählen 1 bis 9 die Knöpfe in #card.
//   hover {x, y, world, hit}  Maus bewegt sich ohne gedrückte Taste

const DRAG_PX = 6;
const PAN_SPEED = 900;          // Pixel pro Sekunde bei gehaltener Taste
const FAST = 3;                 // Vorspulen mit Taste F, wie der Knopf 3x
const PAN_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [1, 0], ArrowLeft: [1, 0], KeyD: [-1, 0], ArrowRight: [-1, 0],
};
const KEY_BADGES = { 'btn-pause': 'Leertaste', 'btn-build': 'B', 'btn-overview': '0', 'btn-collect': 'K' };

export function init(game) {
  const canvas = game.canvas;
  const cam = game.camera;
  const root = canvas.parentElement || document.body;
  const isMouse = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pick = (p) => (game.pick ? game.pick(p.x, p.y) : null);
  const world = (p) => cam.screenToWorld(p.x, p.y);
  const waiting = (hit) => !!(hit && hit.type === 'boat' &&
    (game.sim?.wartet?.(hit.id) ?? hit.object?.userData?.wartet === true));
  // Tooltip: eigener Text der Spielregeln (game.describe), sonst ein kurzer aus game.sim
  const boatOf = (id) => game.sim?.state?.boats?.[Number(String(id).replace(/^b/, ''))];
  const meters = (m) => (Number.isFinite(m) ? `${m.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m` : '');
  const describe = (hit) => {
    if (!hit) return null;
    if (game.describe) return game.describe(hit);
    const b = (hit.type === 'boat' || hit.type === 'coin') ? boatOf(hit.id) : null;
    if (!b) return null;
    if (b.pendingFee > 0) return `${b.name}: ${Math.round(b.pendingFee)} € kassieren`;
    const head = [b.name, b.size && `(${b.size})`, meters(b.length)].filter(Boolean).join(' ');
    if (b.status === 'waiting') return `${head}. Ziehen oder doppelklicken`;
    if (b.status === 'moored') return `${head}, noch ${b.nights} ${b.nights === 1 ? 'Nacht' : 'Nächte'}`;
    return head || null;
  };
  const visible = (el) => !!el && !el.hidden && !el.disabled && el.offsetParent !== null;
  const byId = (id) => document.getElementById(id);

  document.body.classList.add('input-pc');

  // Hilfe: zeigt nur Kürzel, deren Funktion es gerade gibt
  const HELP = [
    ['Wartendes Boot ziehen', 'An der Schleppleine in einen leuchtenden Platz ziehen', () => true],
    ['Doppelklick auf wartendes Boot', 'Boot fährt selbst in den besten Platz', () => true],
    ['Maustaste halten und über Münzen streichen', 'Alles in einem Zug kassieren', () => true],
    ['Tempo-Knöpfe unten links', 'Pause, 1x, 3x, 8x (8x bis zum nächsten Boot)', () => true],
    ['<kbd>F</kbd>', '3x an und aus', () => true],
    ['<kbd>G</kbd>', '8x an und aus', () => !!game.oberflaeche?.tempo],
    ['<kbd>K</kbd>', 'Kassieren (abends)', () => true],
    ['<kbd>1</kbd> bis <kbd>9</kbd>', 'Wartendes Boot wählen, bei offener Karte deren Knopf', () => true],
    ['<kbd>Tab</kbd>, Umschalt + <kbd>Tab</kbd>', 'Nächstes, voriges wartendes Boot', () => true],
    ['<kbd>Enter</kbd>', 'Gewähltes Boot einfahren lassen, bei offener Karte deren ersten Knopf', () => true],
    ['<kbd>B</kbd>', 'Bauen', () => visible(byId('btn-build'))],
    ['<kbd>Leertaste</kbd>', 'Pause', () => !!game.setPaused],
    ['<kbd>Esc</kbd> oder Rechtsklick', 'Abbrechen', () => true],
    ['Mausrad, <kbd>+</kbd> <kbd>-</kbd>', 'Zoomen zum Mauszeiger', () => true],
    ['Doppelklick auf Wasser oder Land', 'Näher heran', () => true],
    ['Ziehen, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, Pfeiltasten', 'Karte verschieben', () => true],
    ['Rechte Maustaste ziehen nach links oder rechts, Umschalt + Mausrad, <kbd>Q</kbd> <kbd>E</kbd>', 'Hafen drehen', () => !!cam.rotateBy],
    ['Rechte Maustaste ziehen nach oben oder unten, Alt + Mausrad, <kbd>R</kbd> <kbd>V</kbd>, <kbd>Bild auf</kbd> <kbd>Bild ab</kbd>', 'Kamera neigen: flach über das Wasser oder steil von oben', () => !!cam.tiltFree],
    ['<kbd>0</kbd> oder <kbd>Pos1</kbd>', 'Ganzen Hafen zeigen, Norden wieder oben', () => true],
    ['<kbd>M</kbd>', 'Ton aus und an', () => !!game.audio],
    ['<kbd>P</kbd>', 'Fotomodus', () => !!game.foto],
    ['<kbd>L</kbd>', 'Spielstand sichern oder laden', () => !!game.spielstand?.oeffnen],
    ['<kbd>?</kbd> oder <kbd>F1</kbd>', 'Diese Übersicht', () => true],
  ];

  // ---------- DOM: Tooltip, Hilfe, Tastenschilder ----------
  const tooltip = document.createElement('div');
  tooltip.className = 'pc-tooltip';
  tooltip.hidden = true;
  root.appendChild(tooltip);

  const help = document.createElement('div');
  help.className = 'pc-help';
  help.hidden = true;
  root.appendChild(help);
  help.addEventListener('click', (e) => { if (e.target === help || e.target.closest('[data-close]')) toggleHelp(false); });

  function toggleHelp(show = help.hidden) {
    if (show) {
      // Ohne innerHTML (Audit C05): <kbd> in den festen Texten oben wird zu echten Elementen
      const mitTasten = (text) => text.split(/<kbd>(.*?)<\/kbd>/).map((t, i) => {
        if (i % 2 === 0) return document.createTextNode(t);
        const k = document.createElement('kbd'); k.textContent = t; return k;
      });
      const box = document.createElement('div');
      box.className = 'pc-help-box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'pc-help-title');
      const h2 = document.createElement('h2');
      h2.id = 'pc-help-title';
      h2.textContent = 'Maus und Tastatur';
      const dl = document.createElement('dl');
      for (const [k, v] of HELP.filter((h) => h[2]())) {
        const dt = document.createElement('dt'); dt.append(...mitTasten(k));
        const dd = document.createElement('dd'); dd.textContent = v;
        dl.append(dt, dd);
      }
      const weiter = document.createElement('button');
      weiter.type = 'button';
      weiter.className = 'hud-btn';
      weiter.dataset.close = '';
      weiter.textContent = 'Weiter';
      box.append(h2, dl, weiter);
      help.replaceChildren(box);
    }
    help.hidden = !show;
    document.body.classList.toggle('help-open', show);
    if (show) help.querySelector('[data-close]').focus({ preventScroll: true });
  }

  function badges() {
    for (const [id, key] of Object.entries(KEY_BADGES)) {
      const el = byId(id);
      if (el && el.dataset.key !== key) {
        el.dataset.key = key;
        el.title = `${el.textContent.trim()} (${key})`;
      }
    }
  }
  badges();
  game.on('ready', badges);

  const hudTop = byId('hud-top');
  if (hudTop && !byId('btn-help')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'btn-help';
    b.className = 'hud-btn pc-help-btn';
    b.textContent = '?';
    b.title = 'Maus und Tastatur (?)';
    b.setAttribute('aria-label', 'Maus und Tastatur');
    b.addEventListener('click', () => toggleHelp());
    hudTop.appendChild(b);
  }

  function showTooltip(text, e) {
    tooltip.textContent = text;
    tooltip.hidden = false;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, e.clientX + 16);
    const y = e.clientY + 22 + h > window.innerHeight ? e.clientY - h - 12 : e.clientY + 22;
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }
  const hideTooltip = () => { tooltip.hidden = true; };

  // ---------- Maus auf der Karte ----------
  // Rechte und mittlere Taste übernimmt dieses Modul ganz (Capture auf window, vor core/input.js).
  let gesture = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || !isMouse(e)) return;
    hideTooltip();
    if (e.button !== 1 && e.button !== 2) return;
    gesture = { kind: e.button === 2 ? 'right' : 'middle', id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
    e.stopPropagation();
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!isMouse(e)) return;
    if (gesture && gesture.id === e.pointerId) {
      e.stopPropagation();
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      gesture.x = e.clientX;
      gesture.y = e.clientY;
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) < DRAG_PX) return;
      gesture.moved = true;
      if (cam.rotateFree) {
        // Wie in 3D-Programmen: Maus nach links/rechts dreht, nach oben/unten neigt
        // (Maus nach oben = flacher, mehr Horizont; nach unten = steiler, mehr von oben)
        if (Math.abs(dx) > Math.abs(dy) * 0.25) cam.rotateFree(-dx * 0.006);
        if (cam.tiltFree && Math.abs(dy) > Math.abs(dx) * 0.25) cam.tiltFree(dy * 0.005);
        canvas.style.cursor = 'move';
      } else {
        cam.panBy(dx, dy);
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    if (e.target !== canvas || e.buttons) return;
    const p = local(e);
    const hit = pick(p);
    canvas.style.cursor = !hit ? '' : waiting(hit) ? 'grab' : hit.type === 'coin' ? 'copy' : 'pointer';
    const text = describe(hit);
    if (text) showTooltip(text, e); else hideTooltip();
    game.emit('hover', { x: p.x, y: p.y, world: world(p), hit });
  }, true);

  const endGesture = (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    e.stopPropagation();
    const g = gesture;
    gesture = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* egal */ }
    canvas.style.cursor = '';
    if (g.kind === 'right' && !g.moved && e.type === 'pointerup') game.emit('ui:cancel');
    else if (g.moved) (cam.release ?? cam.snapRotation)?.call(cam);
  };
  window.addEventListener('pointerup', endGesture, true);
  window.addEventListener('pointercancel', endGesture, true);
  canvas.addEventListener('pointerleave', hideTooltip);

  canvas.addEventListener('dblclick', (e) => {
    const p = local(e);
    const hit = pick(p);
    if (waiting(hit)) {
      document.querySelector('.hm-einfahren')?.remove();
      game.emit('ui:auto-einfahren', { boot: hit.id });
      return;
    }
    if (hit) return;
    const w = world(p);
    if (w && cam.flyTo) cam.flyTo(w.x, w.z);
    else cam.zoomAt(1.8, p.x, p.y);
  });

  // Mausrad und Trackpad. core/input.js zoomt auch, rechnet aber Firefox-Zeilen (deltaMode 1)
  // und Trackpad-Pinch (ctrlKey) nicht um. Deshalb übernimmt der PC das Rad.
  window.addEventListener('wheel', (e) => {
    if (e.target !== canvas) return;
    e.preventDefault();
    e.stopPropagation();
    const p = local(e);
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const dy = e.deltaY * unit;
    if (e.shiftKey && !e.ctrlKey && cam.rotateFree) {
      cam.rotateFree((dy || e.deltaX * unit) * 0.002);
      return;
    }
    if (e.altKey && !e.ctrlKey && cam.tiltFree) {
      cam.tiltFree(-(dy || e.deltaX * unit) * 0.0015);
      return;
    }
    cam.zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    hideTooltip();
  }, { capture: true, passive: false });

  // ---------- Tastatur ----------
  const held = new Set();
  const queueButtons = () => [...document.querySelectorAll('#queue [data-boat]')].filter(visible);
  // Wartende Boote per Taste: über die Knöpfe in #queue, sonst direkt über game.sim
  const waitingIds = () => (game.sim?.waitingBoats?.() ?? []).map((b) => b.id);
  function selectWaiting(index, dir) {
    const btns = queueButtons();
    if (btns.length) {
      const cur = btns.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
      const i = index ?? (cur + dir + btns.length) % btns.length;
      if (!btns[i]) return false;
      btns[i].click();
      return true;
    }
    const ids = waitingIds();
    if (!ids.length || !game.sim?.select) return false;
    const cur = ids.indexOf(game.sim.selected);
    const i = index ?? (cur + dir + ids.length) % ids.length;
    if (ids[i] == null) return false;
    game.sim.select(game.sim.selected === ids[i] && index != null ? null : ids[i]);
    return true;
  }
  const cardButtons = () => [...document.querySelectorAll('#card button:not(:disabled)')]
    .filter((b) => !b.matches('.card-close, [aria-label="Schließen"]'));
  const center = () => ({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });

  function setFast(on) {
    // Über die Oberfläche, damit Knöpfe, Ton und Pause mitgehen
    if (game.oberflaeche?.tempo) { game.oberflaeche.tempo(on ? FAST : 1); return; }
    game.speed = on ? FAST : 1;
    document.body.classList.toggle('vorspulen', on);
    game.emit('ui:vorspulen', { speed: game.speed });
  }

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (!help.hidden && k !== '?' && e.code !== 'F1') {
      if (k === 'Escape' || k === 'Enter' || e.code === 'Space') { toggleHelp(false); e.preventDefault(); }
      return;
    }
    // Knöpfe und Fenster anderer Module bekommen Enter und Leertaste selbst
    if ((k === 'Enter' || e.code === 'Space') && t !== document.body && t.closest && t.closest('button, a, [role="button"], [role="slider"]')) return;
    if (PAN_KEYS[e.code]) { held.add(e.code); e.preventDefault(); return; }
    const cardOpen = document.body.classList.contains('card-open');
    if (/^[1-9]$/.test(k)) {
      const el = cardOpen ? cardButtons()[Number(k) - 1] : null;
      if (el) el.click();
      else if (!selectWaiting(Number(k) - 1)) return;
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'Space': if (!game.setPaused) return; game.setPaused(!game.paused); break;
      case 'KeyB': { const b = byId('btn-build'); if (!visible(b)) return; b.click(); break; }
      case 'KeyQ': if (!cam.rotateBy) return; cam.rotateBy(Math.PI / 4); break;
      case 'KeyE': if (!cam.rotateBy) return; cam.rotateBy(-Math.PI / 4); break;
      case 'KeyR': case 'PageUp': if (!cam.tiltBy) return; cam.tiltBy(8 * Math.PI / 180); break;
      case 'KeyV': case 'PageDown': if (!cam.tiltBy) return; cam.tiltBy(-8 * Math.PI / 180); break;
      case 'KeyM': game.emit('ui:mute'); break;
      case 'KeyF': setFast(!(game.speed > 1)); break;
      case 'KeyG': if (game.oberflaeche?.tempo) game.oberflaeche.tempo(game.speed >= 8 ? 1 : 8); break;
      case 'KeyK': { const c = byId('btn-collect'); if (!visible(c)) return; c.click(); break; }
      case 'KeyL': if (!game.spielstand?.oeffnen) return; game.spielstand.oeffnen(); break;
      case 'Escape': game.emit('ui:cancel'); break;
      case 'Home': case 'Digit0': case 'Numpad0': cam.reset(); break;
      case 'F1': toggleHelp(); break;
      case 'Tab': {
        // Nur wenn kein Eingabefeld oder Knopf den Fokus hat, sonst bleibt Tab die normale Fokus-Taste
        if (t !== document.body && !t.closest('#queue')) return;
        if (!selectWaiting(null, e.shiftKey ? -1 : 1)) return;
        break;
      }
      case 'Enter': case 'NumpadEnter': {
        const chip = document.querySelector('.hm-einfahren');
        const target = chip || (cardOpen ? cardButtons()[0] : null);
        if (target) target.click();
        else if (game.sim?.selected != null) game.emit('ui:auto-einfahren', { boot: game.sim.selected });
        else return;
        break;
      }
      default: {
        const c = center();
        if (k === '+' || e.code === 'NumpadAdd') cam.zoomAt(1.25, c.x, c.y);
        else if (k === '-' || e.code === 'NumpadSubtract') cam.zoomAt(0.8, c.x, c.y);
        else if (k === '?') toggleHelp();
        else return;
      }
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  // Verschieben mit gehaltenen Tasten, läuft auch in der Pause
  let lastT = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (held.size) {
      let x = 0; let y = 0;
      held.forEach((c) => { x += PAN_KEYS[c][0]; y += PAN_KEYS[c][1]; });
      cam.panBy(x * PAN_SPEED * dt, y * PAN_SPEED * dt);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return { toggleHelp };
}
