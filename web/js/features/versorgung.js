// Wege zur Versorgung zählen (Roadmap P19 Teil 2, B9, docs/ruf.md). Die Auslastung der Versorgung
// zeigt ui/hafenzeichen.js (P55, docs/hafenzeichen.md).
//
// Wege: Die Spielregeln fragen über den Hook 'walk', wie weit eine Box vom nächsten
//    Gebäude für WC oder Dusche entfernt ist (Luftlinie Box bis Tür). Weiter als ECONOMY.ruf.wege.weit
//    zählt der Wunsch für die Note nur halb. Das Sanitärgebäude (WC Stufe 3) hat auch Duschen.
//
// Liest: game.sim (state, addHook), game.buildings (eingang), game.stege (platz).
// Schreibt nichts in den Spielstand.
// Schnittstelle: game.versorgung = { weg(berthId, wunsch) -> Meter | null, gebaeude(wunsch) -> [ids] }
import { regelnBereit } from './regeln-bereit.js';

// Welche Gebäude welchen Wunsch erfüllen, ab welcher Stufe der Versorgung (state.facilities)
export const GEBAEUDE = {
  wc: [{ id: 'toilette', art: 'wc', ab: 1 }, { id: 'sanitaer', art: 'wc', ab: 3 }],
  dusche: [{ id: 'dusche', art: 'dusche', ab: 1 }, { id: 'sanitaer', art: 'wc', ab: 3 }],
  essen: [{ id: 'kiosk', art: 'essen', ab: 1 }, { id: 'restaurant', art: 'essen', ab: 3 }],
};

/** Gebaute Gebäude für einen Wunsch (ohne Browser testbar). */
export function gebauteFuer(wunsch, facilities = {}) {
  return (GEBAEUDE[wunsch] || []).filter((g) => (facilities[g.art] || 0) >= g.ab).map((g) => g.id);
}

/** Kürzeste Luftlinie von einem Punkt zu einer Liste von Türen ({ x, z }), null ohne Tür. */
export function kuerzesterWeg(p, tueren) {
  let best = null;
  for (const t of tueren) {
    if (!t) continue;
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (best == null || d < best) best = d;
  }
  return best;
}



export async function init(game) {
  const api = await regelnBereit(game).catch(() => null);
  if (!api) return;

  // ------------------------------------------------------------ Wege (Hook für die Spielregeln)
  // Türen ändern sich nur beim Bauen, Stufenwechsel oder Laden: kurz zwischenspeichern
  let tuerCache = new Map();
  let cacheZeit = 0;
  const leeren = () => { tuerCache = new Map(); cacheZeit = 0; };
  for (const ev of ['build', 'stufe', 'region', 'sim:built', 'sim:stageUp', 'spielstand-geladen']) game.on(ev, leeren);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') leeren(); });
  function tuer(id) {
    const jetzt = performance.now();
    if (jetzt - cacheZeit > 3000) { tuerCache = new Map(); cacheZeit = jetzt; }
    if (!tuerCache.has(id)) tuerCache.set(id, game.buildings?.eingang?.(id) ?? null);
    return tuerCache.get(id);
  }
  function weg(berthId, wunsch) {
    const st = game.sim?.state;
    const p = game.stege?.platz?.(berthId);
    if (!st || !p || !Number.isFinite(p.x)) return null;
    return kuerzesterWeg(p, gebauteFuer(wunsch, st.facilities).map(tuer));
  }
  api.addHook?.('walk', ({ berth, wish }) => weg(berth.id, wish));
  game.versorgung = { weg, gebaeude: (w) => gebauteFuer(w, game.sim?.state?.facilities) };
}
