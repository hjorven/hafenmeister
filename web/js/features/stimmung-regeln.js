// Regeln für Paket P46 (F29, F30), ohne Browser und ohne Three.js, damit die Tests sie direkt prüfen.
//
// Ruhiger Abend (F29): Am Abend ist alles kassiert und alle sind versorgt, wenn
//   - der Spieltag im Abend steht (state.phase 'evening'; im Winter liegen keine Gäste, also nie),
//   - mindestens ein Gast im Hafen liegt (ein leerer Hafen ist nicht ruhig, sondern leer),
//   - jeder liegende Gast sein Liegegeld bezahlt hat (kein offenes Geld, kein Bändchen fehlt),
//   - kein Boot mehr an einer Boje oder im Ankerfeld wartet, für das eine passende Box frei ist.
//     Ist der Hafen voll, kann der Hafenmeister nichts mehr tun: Wer dann über Nacht an der Boje
//     bleibt, hält den ruhigen Abend nicht auf.
// Fest vergebene Plätze (Fischer, Dauerlieger) zahlen Pacht und zählen nicht.
//
// Serie (F30): Drei passgenaue Zuweisungen hintereinander ergeben einen Akkord. Zählt nur, was der
// Spieler selbst entscheidet (Boot in eine Box ziehen oder selbst umlegen). Was das Büro, "Einfahren
// lassen" oder ein Boot selbst entscheidet, ändert die Serie nicht. Eine Zuweisung, die nicht
// passgenau ist, fängt die Serie leise von vorn an. Es gibt keine Zeitgrenze ("ohne Druck").

export const SERIE_LAENGE = 3;

/** Gäste, die im Hafen liegen (ohne fest vergebene Plätze). */
function gaeste(state) {
  return Object.values(state?.boats ?? {}).filter((b) => b && b.status === 'moored' && !b.stationed);
}

/** Hat der Gast sein Liegegeld bezahlt? Gleiche Regel wie game.sim.istBezahlt. */
export function bezahlt(b) {
  return b.paid !== false && !(b.pendingFee > 0);
}

/**
 * Stand des Abends: { abend, ruhig, offen, warten, gaeste }.
 * offen: Gäste mit offenem Liegegeld, warten: Boote an Bojen oder im Ankerfeld, die noch einen Platz
 * bekommen könnten. hatPlatz(boatId) sagt, ob für ein wartendes Boot eine passende Box frei ist
 * (im Spiel sim.fittingBerths); ohne Angabe zählt jedes wartende Boot.
 */
export function abendStand(state, hatPlatz = () => true) {
  const abend = !!state && state.phase === 'evening';
  const liste = gaeste(state);
  const offen = liste.filter((b) => !bezahlt(b)).length;
  const warten = (state?.queue ?? []).filter((id) => state.boats?.[id]?.status === 'waiting' && hatPlatz(id)).length;
  return { abend, ruhig: abend && liste.length > 0 && offen === 0 && warten === 0, offen, warten, gaeste: liste.length };
}

/** Kurz: Ist jetzt ein ruhiger Abend? */
export function ruhigerAbend(state, hatPlatz) {
  return abendStand(state, hatPlatz).ruhig;
}

/**
 * Zählt ein Ereignis der Spielregeln in die Serie. m = { serie } wird verändert.
 * Gibt den Schritt zurück: 1 bis SERIE_LAENGE (SERIE_LAENGE = Akkord), 0 = Serie fängt neu an,
 * null = das Ereignis zählt nicht.
 */
export function serieZaehlen(m, e) {
  if (!m || !e) return null;
  const selbst = (e.type === 'moored' && e.hand === true) || (e.type === 'relocated' && e.grund === 'hand');
  if (!selbst) return null;
  if (!e.passgenau) {
    m.serie = 0;
    return 0;
  }
  m.serie = ((m.serie ?? 0) % SERIE_LAENGE) + 1;
  const schritt = m.serie;
  if (schritt === SERIE_LAENGE) {
    m.serie = 0;
    m.akkorde = (m.akkorde ?? 0) + 1;
  }
  return schritt;
}

/** Modulstand im Spielstand: state.modules.stimmung = { serie, akkorde, ruhigeAbende, zielStufe }. */
export function stimmungState(state) {
  state.modules ??= {};
  const m = (state.modules.stimmung ??= {});
  for (const k of ['serie', 'akkorde', 'ruhigeAbende']) if (!Number.isFinite(m[k]) || m[k] < 0) m[k] = 0;
  if (m.serie >= SERIE_LAENGE) m.serie = 0;
  return m;
}
