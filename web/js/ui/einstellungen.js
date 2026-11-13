// Einstellungen für Sicht und Bewegung (roadmap.md F25, Paket P50).
// Gilt je Gerät (localStorage), nicht je Spielstand: wer am Handy größere Schrift braucht, braucht sie in jedem Hafen.
//
// Schalter                Klasse am body     Wirkung
//   formen                hm-formen          Platzschilder zeigen den Zustand auch über die Form (rot mit weißem Balken)
//   ruhig                 hm-ruhig           keine Oberflächen-Animationen, weniger Regen, Schnee und Funken
//   gross                 hm-gross           Schrift der Oberfläche etwa ein Fünftel größer
//   links                 hand-links         Touch: Bauen links, Zeit rechts (Linkshänder)
//   einfahren             (keine)            Boote fahren selbst ein: normal (8 s), langsam (20 s), aus (roadmap A7)
//                                            setzt game.sim.ctx.rules.queue.selfEnterAfter
//
// Schnittstelle: game.einstellungen = { wert(name), setze(name, an), alle() }, Ereignis 'einstellungen' { name, an, alle }
// Die Tafel öffnet ui/oberflaeche.js aus dem Menü (Eintrag "Einstellungen").

const SCHLUESSEL = 'hafenmeister:einstellungen';

export const SCHALTER = [
  { name: 'formen', klasse: 'hm-formen', titel: 'Schilder mit Form', text: 'Belegte Plätze bekommen zusätzlich einen weißen Balken, nicht nur die rote Farbe.' },
  { name: 'ruhig', klasse: 'hm-ruhig', titel: 'Weniger Bewegung', text: 'Knöpfe und Tafeln springen nicht, Regen und Schnee fallen sparsamer.' },
  { name: 'gross', klasse: 'hm-gross', titel: 'Größere Schrift', text: 'Texte der Oberfläche und der Karten werden größer.' },
  { name: 'links', klasse: 'hand-links', titel: 'Linkshänder', text: 'Bauen wandert nach unten links, die Zeit nach unten rechts.', nurTouch: true },
];

// Auswahl mit mehreren Stufen
export const WAHLEN = [
  {
    name: 'einfahren', titel: 'Boote fahren selbst ein', text: 'Wie lange ein Boot an der Boje auf dich wartet, bevor es sich selbst eine freie Box sucht.',
    stufen: [['normal', 'Normal'], ['langsam', 'Langsam'], ['aus', 'Nie']],
  },
];
const LANGSAM = 2.5;   // Faktor auf ECONOMY.warten.selbstEinfahrenNach (8 s -> 20 s)

function lesen() {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL) || '{}') || {}; } catch { return {}; }
}
function schreiben(werte) {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(werte)); } catch { /* privates Fenster: gilt nur bis zum Neuladen */ }
}

export function initEinstellungen(game) {
  const systemRuhig = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const werte = { formen: false, ruhig: systemRuhig, gross: false, links: false, einfahren: 'normal', ...lesen() };

  // Selbst-Einfahren: Grundwert aus den Regeln merken, dann je nach Wahl verlängern oder abschalten
  let grundwert;
  function einfahrenAnwenden() {
    const q = game.sim?.ctx?.rules?.queue;
    if (!q) return;
    if (grundwert === undefined) grundwert = q.selfEnterAfter;
    if (grundwert == null) return;   // Regeln ohne Selbst-Einfahren: nichts zu ändern
    q.selfEnterAfter = werte.einfahren === 'aus' ? null : werte.einfahren === 'langsam' ? grundwert * LANGSAM : grundwert;
  }

  function anwenden() {
    for (const s of SCHALTER) document.body.classList.toggle(s.klasse, !!werte[s.name]);
    einfahrenAnwenden();
  }
  anwenden();
  // game.sim entsteht erst nach dem Laden der Bootsdaten (bridge.js)
  if (!game.sim) {
    const t = setInterval(() => { if (game.sim) { clearInterval(t); einfahrenAnwenden(); } }, 100);
    setTimeout(() => clearInterval(t), 30000);
  }

  game.einstellungen = {
    wert: (name) => (WAHLEN.some((w) => w.name === name) ? werte[name] : !!werte[name]),
    alle: () => ({ ...werte }),
    setze(name, an) {
      const wahl = WAHLEN.find((w) => w.name === name);
      if (wahl) {
        if (!wahl.stufen.some(([id]) => id === an)) return;
        werte[name] = an;
      } else if (SCHALTER.some((s) => s.name === name)) {
        werte[name] = !!an;
      } else return;
      schreiben(werte);
      anwenden();
      game.emit?.('einstellungen', { name, an: werte[name], alle: { ...werte } });
    },
  };
  // Module, die vor diesem geladen wurden, bekommen den gespeicherten Stand einmal mitgeteilt
  game.emit?.('einstellungen', { name: null, an: null, alle: { ...werte } });
  return game.einstellungen;
}
