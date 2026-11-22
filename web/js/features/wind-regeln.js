// Wind im Hafen (P34): Regeln ohne Browser und ohne Three.js (features/wind.js hängt sie ein,
// tests/wind.test.mjs prüft sie). Beschreibung: docs/wind.md

/** Starkwind heute? heute = { wind, richtung, event }. */
export function istStark(heute, rules) {
  const w = rules?.wind;
  return !!(w && heute && heute.wind >= w.strong);
}

/** Zählt die Windlage der Plätze heute? Nicht am Sturmtag (dort gilt das Sturm-Ereignis mit satisfaction.outer). */
export function lageZaehlt(state, heute, rules) {
  return istStark(heute, rules) && heute.event !== 'sturm' && (state.stage ?? 1) >= (rules.wind.from ?? 1);
}

/**
 * Einmal je Spielsekunde: liegende Gäste merken sich Windlage und Rückenwind beim Anlegen.
 * lageVon(platzId) -> 'offen' | 'normal' | 'geschuetzt' | null, bugVon(platzId) -> Kosinus Bug zu Wind oder null.
 */
export function windTick(state, ctx, heute, lageVon, bugVon) {
  const w = ctx.rules.wind;
  if (!w || !istStark(heute, ctx.rules) || (state.stage ?? 1) < (w.from ?? 1)) return;
  const zaehlt = lageZaehlt(state, heute, ctx.rules);
  for (const b of Object.values(state.boats)) {
    // Dauerlieger zählen nicht, wer auf Tagestörn ist, liegt gerade nicht am Platz
    if (b.status !== 'moored' || b.stationed || !b.berthId || b.trip?.away) continue;
    if (zaehlt) {
      const l = lageVon(b.berthId);
      // die letzte Lage bei Starkwind zählt: wer aus dem offenen Platz verholt wird, liegt danach ruhig
      if (l === 'offen' || l === 'geschuetzt') b.windLage = l;
      else if (l === 'normal' && b.windLage) b.windLage = null;
    }
    // Anlegen: einmal je Platz, an dem das Boot festmacht (auch nach dem Umlegen)
    if (b.windBox !== b.berthId) {
      b.windBox = b.berthId;
      if (w.sizes.includes(b.size)) {
        const c = bugVon(b.berthId);
        if (c != null && c < w.tailwindBelow) b.windRuecken = true;
      }
    }
  }
}

/** Vorliebe der Platzwahl (Hook 'score'): geschützt vor offen, große Boote mit dem Bug gegen den Wind. */
export function windScore(state, ctx, boat, berth, heute, lageVon, bugVon) {
  const w = ctx.rules.wind;
  if (!w || !istStark(heute, ctx.rules) || (state.stage ?? 1) < (w.from ?? 1)) return 0;
  let n = 0;
  if (lageZaehlt(state, heute, ctx.rules)) {
    const l = lageVon(berth.id);
    if (l === 'geschuetzt') n += w.score.geschuetzt ?? 0;
    else if (l === 'offen') n += w.score.offen ?? 0;
  }
  if (w.sizes.includes(boat.size)) {
    const c = bugVon(berth.id);
    if (c != null && c >= w.headwindFrom) n += w.score.gegenWind ?? 0;
    else if (c != null && c < w.tailwindBelow) n -= w.score.gegenWind ?? 0;
  }
  return n;
}

/** Was ein Platz für ein Boot heute bei Wind bedeutet: 'offen' | 'geschuetzt' | 'rueckenwind' | null. */
export function platzZeichen(state, rules, heute, boat, platzId, lageVon, bugVon) {
  const w = rules.wind;
  if (!w || !istStark(heute, rules) || (state.stage ?? 1) < (w.from ?? 1)) return null;
  if (boat && w.sizes.includes(boat.size)) {
    const c = bugVon(platzId);
    if (c != null && c < w.tailwindBelow) return 'rueckenwind';
  }
  if (!lageZaehlt(state, heute, rules)) return null;
  const l = lageVon(platzId);
  return l === 'offen' || l === 'geschuetzt' ? l : null;
}

/** Tempo-Faktor fürs Anlegen eines großen Boots: 1 mit dem Bug gegen den Wind, anlegenTempo mit Wind von achtern. */
export function anlegeTempo(cfg, stark, size, c) {
  if (!stark || !cfg.grosse.includes(size) || c == null) return 1;
  if (c >= cfg.gegenWindAb) return 1;
  if (c <= cfg.rueckenwindAb) return cfg.anlegenTempo;
  const t = (cfg.gegenWindAb - c) / (cfg.gegenWindAb - cfg.rueckenwindAb);
  return 1 - t * (1 - cfg.anlegenTempo);
}

