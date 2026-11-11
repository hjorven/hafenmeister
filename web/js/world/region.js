// Hafenmeister: aktuelles Revier, Wasserstand (Ebbe und Flut) und Lichtfarben.
// Daten: js/data/regions.js, Beschreibung: docs/regionen.md
//
// Ereignisse, die dieses Modul sendet:
//   'region'  mit der id als Text ('ostsee' oder 'nordsee')
//             -> Landschaft und Gebaeude faerben sich um
//   'pegel'   mit Metern relativ zum mittleren Wasserstand (Wasserlinie der 3D-Szene, y = 0)
//             -> Landschaft hebt und senkt die Wasserflaeche, nur in Revieren mit Tide
//   'wasserstand' mit { hoehe, steigt, pegel }: hoehe in Metern ueber mittlerem Niedrigwasser
//             (Bezug der Tiefen in den Hafendaten), fuer Spielregeln und Anzeige
import { REVIERE, REVIER_REIHENFOLGE } from '../data/regions.js';

export const SICHERHEIT = 0.3;              // Meter Wasser unter dem Kiel, wie in docs/hafen-und-schiffe.md
export const SEKUNDEN_PRO_SPIELTAG = 120;   // docs/plan.md: ein Spieltag dauert 2 Minuten

export function revier(id) {
  return REVIERE[id] ?? REVIERE[REVIER_REIHENFOLGE[0]];
}

// Wasserstand in Metern ueber mittlerem Niedrigwasser zur Spielzeit `tage` (in Spieltagen).
// Ohne Tide immer 0. `hub` ueberschreibt den Tidenhub des Reviers (Feld gezeiten.tidenhub eines Hafens).
export function wasserstand(r, tage, hub) {
  const tide = r?.wasser?.tide;
  if (!tide) return 0;
  const h = hub ?? tide.hub;
  const spring = 1 + tide.springFaktor * Math.cos((2 * Math.PI * tage) / tide.springNippTage);
  return h / 2 + (h / 2) * spring * Math.sin(2 * Math.PI * (tage / tide.periodeTage + tide.phase));
}

// Wasserstand relativ zur mittleren Wasserlinie, fuer die 3D-Szene.
export function pegel(r, tage, hub) {
  const tide = r?.wasser?.tide;
  if (!tide) return 0;
  return wasserstand(r, tage, hub) - (hub ?? tide.hub) / 2;
}

// Steigt das Wasser gerade?
export function steigt(r, tage, hub) {
  return wasserstand(r, tage + 0.001, hub) > wasserstand(r, tage, hub);
}

// Passt ein Boot mit diesem Tiefgang jetzt an einen Platz mit dieser Kartentiefe?
export function passt(r, tage, tiefgang, tiefe, hub) {
  return tiefe + wasserstand(r, tage, hub) >= tiefgang + SICHERHEIT - 1e-9;
}

// In wie vielen Spieltagen ist genug Wasser da? 0 = jetzt, Infinity = in den naechsten 30 Tagen nie.
// Sucht in Schritten von 1/240 Spieltag (eine halbe Spielsekunde).
export function naechstesFenster(r, tage, tiefgang, tiefe, hub) {
  if (passt(r, tage, tiefgang, tiefe, hub)) return 0;
  if (!r?.wasser?.tide) return Infinity;
  const schritt = 1 / 240;
  for (let d = schritt; d <= 30; d += schritt) {
    if (passt(r, tage + d, tiefgang, tiefe, hub)) return d;
  }
  return Infinity;
}

// Ist ein Revier frei? `stufen` = { revierId: erreichte Stufe }
export function istFrei(r, stufen = {}) {
  const f = r.freischalten;
  if (f.start) return true;
  return (stufen[f.nach] ?? 0) >= f.stufe;
}

function revierAusAdresse() {
  try {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('revier') ?? q.get('region');
    return id && REVIERE[id] ? id : null;
  } catch { return null; }
}

export function init(game) {
  const THREE = game.THREE;
  let aktuell = revier(revierAusAdresse() ?? REVIER_REIHENFOLGE[0]);
  let hubHafen;          // optionaler Tidenhub des Hafens
  let warte = 0;

  const tage = () => game.time / SEKUNDEN_PRO_SPIELTAG;

  const region = {
    alle: REVIERE,
    reihenfolge: REVIER_REIHENFOLGE,
    get daten() { return aktuell; },
    get id() { return aktuell.id; },
    setzen(id, { tidenhub } = {}) {
      if (!REVIERE[id]) { console.warn('Unbekanntes Revier:', id); return; }
      aktuell = REVIERE[id];
      hubHafen = tidenhub;
      anwenden();
      game.emit('region', aktuell.id);
      sendePegel();
    },
    wasserstand: () => wasserstand(aktuell, tage(), hubHafen),
    pegel: () => pegel(aktuell, tage(), hubHafen),
    tiefeJetzt: (tiefe) => tiefe + wasserstand(aktuell, tage(), hubHafen),
    passt: (tiefgang, tiefe) => passt(aktuell, tage(), tiefgang, tiefe, hubHafen),
    naechstesFenster: (tiefgang, tiefe) => naechstesFenster(aktuell, tage(), tiefgang, tiefe, hubHafen),
    hatTide: () => !!aktuell.wasser.tide,
    licht: (phase = 'tag') => aktuell.licht[phase] ?? aktuell.licht.tag,
    istFrei: (id, stufen) => istFrei(revier(id), stufen),
  };
  game.region = region;

  // Himmelsfarbe setzen, solange es keine Landschaft gibt. Dunst, Licht und Wasser macht die
  // Landschaft selbst, sie bekommt dafuer das Ereignis 'region' und liest game.region.daten.
  function anwenden() {
    const phase = document.body.dataset.phase === 'abend' ? 'abend' : 'tag';
    if (!game.landschaft) {
      game.scene.background = new THREE.Color(phase === 'abend' ? region.licht('abend').himmel : aktuell.farben.himmel);
    }
    document.body.dataset.revier = aktuell.id;
  }

  function sendePegel() {
    if (!aktuell.wasser.tide) { game.emit('pegel', 0); return; }
    const t = tage();
    game.emit('pegel', pegel(aktuell, t, hubHafen));
    game.emit('wasserstand', {
      hoehe: wasserstand(aktuell, t, hubHafen),
      steigt: steigt(aktuell, t, hubHafen),
      pegel: pegel(aktuell, t, hubHafen),
    });
  }

  game.onTick((dt) => {
    if (!aktuell.wasser.tide || dt === 0) return;
    warte -= dt;
    if (warte > 0) return;
    warte = 0.5;
    sendePegel();
  });

  // Wechselt jemand anderes das Revier (z. B. Spielregeln oder Spielstand), mitgehen ohne erneut zu senden.
  game.on('region', (id) => {
    if (id === aktuell.id || !REVIERE[id]) return;
    aktuell = REVIERE[id];
    hubHafen = undefined;
    anwenden();
    sendePegel();
  });
  game.on('phase', () => anwenden());

  // Erst wenn alle Module geladen sind, das Startrevier melden, damit Landschaft und Gebaeude es hoeren.
  // Ein geladener Spielstand (game.state.region) hat Vorrang, ausser ?revier= steht in der Adresse.
  game.on('ready', () => {
    const gespeichert = game.state?.region;
    if (!revierAusAdresse() && gespeichert && REVIERE[gespeichert]) aktuell = REVIERE[gespeichert];
    anwenden();
    game.emit('region', aktuell.id);
    sendePegel();
  });
  anwenden();
}
