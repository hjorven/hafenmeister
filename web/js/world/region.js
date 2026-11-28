// Hafenmeister: aktuelles Revier und Lichtfarben.
// Daten: js/data/regions.js, Beschreibung: docs/regionen.md
// Ebbe und Flut (Wasserstand, Zufahrt, Pegel für die Landschaft) rechnet features/gezeiten-regeln.js aus der
// Spieluhr, im Browser meldet features/gezeiten.js den Pegel (P57, docs/nordsee.md). Hier gibt es keine
// zweite Gezeitenrechnung mehr.
//
// Ereignisse, die dieses Modul sendet:
//   'region'  mit der id als Text ('ostsee' oder 'nordsee')
//             -> Landschaft und Gebaeude faerben sich um
import { REVIERE, REVIER_REIHENFOLGE } from '../data/regions.js';
import { ECONOMY } from '../data/economy.js';

export function revier(id) {
  return REVIERE[id] ?? REVIERE[REVIER_REIHENFOLGE[0]];
}

// Ist ein Revier frei? `stufen` = { revierId: erreichte Stufe }. Die Stufe steht in ECONOMY.nordsee.start
// (im Spiel entscheidet save/reviere.js mit dem besten Stand je Gerät).
export function istFrei(r, stufen = {}) {
  const f = r.freischalten;
  if (f.start) return true;
  return (stufen[f.nach] ?? 0) >= (ECONOMY.nordsee?.start?.abStufe ?? 5);
}

/** Küstentypen (natur.js), aus denen ein neuer Hafen in diesem Revier wählt; null heißt alle. */
export function kuestenFuer(id) {
  return revier(id).kuesten ?? null;
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

  const region = {
    alle: REVIERE,
    reihenfolge: REVIER_REIHENFOLGE,
    get daten() { return aktuell; },
    get id() { return aktuell.id; },
    setzen(id) {
      if (!REVIERE[id]) { console.warn('Unbekanntes Revier:', id); return; }
      aktuell = REVIERE[id];
      anwenden();
      game.emit('region', aktuell.id);
    },
    // Ebbe und Flut: game.gezeiten (features/gezeiten.js)
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

  // Wechselt jemand anderes das Revier (z. B. Spielregeln oder Spielstand), mitgehen ohne erneut zu senden.
  game.on('region', (id) => {
    if (id === aktuell.id || !REVIERE[id]) return;
    aktuell = REVIERE[id];
    anwenden();
  });
  game.on('phase', () => anwenden());

  // Erst wenn alle Module geladen sind, das Startrevier melden, damit Landschaft und Gebaeude es hoeren.
  // Ein geladener Spielstand (game.state.region) hat Vorrang, ausser ?revier= steht in der Adresse.
  game.on('ready', () => {
    const gespeichert = game.state?.region;
    if (!revierAusAdresse() && gespeichert && REVIERE[gespeichert]) aktuell = REVIERE[gespeichert];
    anwenden();
    game.emit('region', aktuell.id);
  });
  anwenden();
}
