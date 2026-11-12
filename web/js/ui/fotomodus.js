// Fotomodus mit Rundflug. Siehe docs/neue-features.md.
// Blendet die Leisten aus, damit man den eigenen Hafen in Ruhe ansehen und als Bild sichern kann.
// "Rundflug" laesst die Kamera langsam ueber den Hafen gleiten (Grundlage fuer "Hafen schauen").
//
// Ereignisse: sendet 'foto:an', 'foto:aus', 'foto:bild' (fuer Ton, z. B. Ausloeser), hoert auf 'ui:cancel'.
// Taste P schaltet den Fotomodus, Escape beendet ihn (F ist Vorspulen, ui/input-pc.js).

const CSS = `
body.hm.foto .hud { display: none !important; }
#btn-foto { min-width: var(--tap, 44px); }
.hm-foto-leiste {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex; gap: 8px; padding: 8px; border-radius: 14px;
  background: rgba(255, 252, 246, 0.85); box-shadow: 0 2px 10px rgba(0,0,0,.15);
  transition: opacity .4s;
}
.hm-foto-leiste button {
  min-height: var(--tap, 44px); min-width: var(--tap, 44px); padding: 0 14px;
  border: 0; border-radius: 10px; background: #283648; color: #fff;
  font: 600 15px system-ui, sans-serif; cursor: pointer; white-space: nowrap;
}
@media (max-width: 599px) { .hm-foto-leiste button { padding: 0 10px; font-size: 14px; } }
.hm-foto-leiste button[aria-pressed="true"] { background: #ee6454; }
.hm-foto-leiste.leise { opacity: 0.15; }
.hm-foto-blitz {
  position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none;
  transition: opacity .35s ease-out;
}
.hm-foto-blitz.an { opacity: .8; transition: none; }
`;

// Rundflug: Geschwindigkeit in Bildschirmbreiten pro Sekunde und Dauer einer Zoom-Welle
const FLUG_TEMPO = 0.025;
const ZOOM_PERIODE = 40;
const LEISTE_LEISE_NACH = 3;   // Sekunden ohne Bewegung, dann wird die Leiste fast unsichtbar

export function init(game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.getElementById('game') || document.body;

  // Einstieg: Knopf in der oberen Leiste, vor "Übersicht"
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hud-btn';
  btn.id = 'btn-foto';
  btn.textContent = 'Foto';
  btn.setAttribute('aria-label', 'Fotomodus: Leisten ausblenden und Bild sichern');
  const top = document.getElementById('hud-top');
  const anchor = document.getElementById('btn-overview');
  if (top) top.insertBefore(btn, anchor && anchor.parentNode === top ? anchor : null);

  // Leiste im Fotomodus
  const leiste = document.createElement('div');
  leiste.className = 'hm-foto-leiste';
  leiste.hidden = true;
  const mk = (text, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    leiste.appendChild(b);
    return b;
  };
  const btnBild = mk('Bild sichern', 'Bild des Hafens als Datei sichern');
  const btnFlug = mk('Rundflug', 'Kamera langsam über den Hafen gleiten lassen');
  btnFlug.setAttribute('aria-pressed', 'false');
  const btnZurueck = mk('Zurück', 'Fotomodus beenden');
  root.appendChild(leiste);

  const blitz = document.createElement('div');
  blitz.className = 'hm-foto-blitz';
  root.appendChild(blitz);

  let aktiv = false;
  let flug = false;
  let flugZeit = 0;
  let flugRichtung = 1;
  let ruhe = 0;

  function setFlug(an) {
    flug = an;
    btnFlug.setAttribute('aria-pressed', String(an));
    flugZeit = 0;
  }

  function an() {
    if (aktiv) return;
    aktiv = true;
    document.body.classList.add('foto');
    leiste.hidden = false;
    ruhe = 0;
    game.emit('foto:an');
  }

  function aus() {
    if (!aktiv) return;
    aktiv = false;
    setFlug(false);
    document.body.classList.remove('foto');
    leiste.hidden = true;
    leiste.classList.remove('leise');
    game.emit('foto:aus');
  }

  function dateiname() {
    const d = new Date();
    const zwei = (n) => String(n).padStart(2, '0');
    return `hafenmeister-${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}.png`;
  }

  function herunterladen(url, name) {
    const a = document.createElement('a');
    a.download = name;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function bildSichern() {
    // Direkt nach dem Rendern auslesen, sonst ist der Puffer schon leer (kein preserveDrawingBuffer)
    game.renderer.render(game.scene, game.camera.camera);
    const url = game.canvas.toDataURL('image/png');
    blitz.classList.add('an');
    requestAnimationFrame(() => requestAnimationFrame(() => blitz.classList.remove('an')));
    if (navigator.vibrate) navigator.vibrate(15);
    game.emit('foto:bild');
    const name = dateiname();
    // Auf Handy und Tablet ueber das Teilen-Menue, dann landet das Bild direkt in den Fotos
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;   // Spieler hat das Teilen abgebrochen
      }
    }
    herunterladen(url, name);
  }

  btn.addEventListener('click', an);
  btnZurueck.addEventListener('click', aus);
  btnBild.addEventListener('click', bildSichern);
  btnFlug.addEventListener('click', () => setFlug(!flug));
  game.on('ui:cancel', aus);

  // Jede Bewegung des Spielers holt die Leiste zurueck und haelt den Rundflug an
  const wach = () => { ruhe = 0; leiste.classList.remove('leise'); };
  root.addEventListener('pointerdown', (e) => {
    wach();
    if (flug && !leiste.contains(e.target)) setFlug(false);
  });
  root.addEventListener('pointermove', wach);
  root.addEventListener('wheel', () => { wach(); if (flug) setFlug(false); }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) { aktiv ? aus() : an(); }
    else if (e.key === 'Escape') aus();
  });

  // Echte Zeit statt Spielzeit: der Rundflug laeuft auch in der Pause
  let last = performance.now();
  game.onTick(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!aktiv) return;
    ruhe += dt;
    if (ruhe > LEISTE_LEISE_NACH) leiste.classList.add('leise');
    if (!flug) return;
    flugZeit += dt;
    const rig = game.camera;
    // Seitlich gleiten, an den Kartengrenzen umkehren
    const x0 = rig.target.x;
    rig.panBy(flugRichtung * FLUG_TEMPO * rig.screenW * dt, 0);
    const b = rig.bounds;
    if (Math.abs(rig.target.x - x0) < 1e-4 || rig.target.x <= b.minX + 1 || rig.target.x >= b.maxX - 1) {
      flugRichtung *= -1;
    }
    // Sanftes Ein- und Auszoomen
    const welle = Math.sin((flugZeit / ZOOM_PERIODE) * Math.PI * 2);
    rig.zoomAt(1 + welle * 0.0015);
  });

  game.foto = {
    an, aus, bildSichern,
    get aktiv() { return aktiv; },
    get rundflugAktiv() { return flug; },
    rundflug: (ein) => setFlug(!!ein),
    leiste,   // andere Module (hafen-schauen.js) hängen hier eigene Knöpfe an
  };
}
