// Fotoaufträge und Postkarten (P43, Roadmap F22/L6, docs/fotoauftraege.md): Regeln ohne Browser.
//
// Ein Postkartenverlag bestellt ab und zu ein Foto vom Hafen. Es gibt höchstens zwei offene Aufträge:
//   auftrag  wechselnder Auftrag (Sonnenuntergang, Anleger, voller Steg ...), gilt ECONOMY.fotoauftraege.dauerTage
//   sonder   Sonderauftrag für einen besonderen Tag (seltener Besucher, Großschiff, Nebel, Regatta, Fest), nur heute
// Im Fotomodus wird das Bild zur Postkarte (features/fotoauftraege.js prüft das Bild), der Verlag zahlt einmal.
// Die Postkarten sammeln sich im Logbuch (Reiter "Postkarten"), je Motiv eine.
//
// Spielstand: state.modules.fotoauftraege = {
//   tag        Spieltag, an dem pruefen() zuletzt den Morgen erledigt hat
//   auftrag    { motiv, ab, bis } | null
//   sonder     { motiv, tag } | null
//   frei       erster Tag, an dem wieder ein wechselnder Auftrag kommt
//   karten     { [motiv]: { tag, stufe, mal, bild? } }   bild: JPEG als data:-URL, kleiner als BILD_MAX
//   erledigt, summe   Zahl der Postkarten und Honorar zusammen
//   letztes    Motiv des letzten wechselnden Auftrags (nie zweimal hintereinander), sonderTag: Tag des letzten Sonderauftrags
//   neu        [motiv]   noch nicht im Logbuch angesehen
// }
// Zufall nur aus Seed und Tag (verbraucht den Spielzufall nicht), keine neue SAVE_VERSION (saeubern()).

import { ECONOMY } from '../data/economy.js';
import { MOTIVE, MOTIV_IDS } from '../data/fotoauftraege.js';
import { seasonOf } from '../events/scheduler.js';

export const FA = ECONOMY.fotoauftraege;
export const BILD_MAX = 48000;      // Zeichen einer Postkarte im Spielstand (rund 36 KB JPEG)
const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ganz = (v) => Number.isInteger(v);

export function faState(state) {
  state.modules ||= {};
  let f = state.modules.fotoauftraege;
  if (!istObjekt(f)) f = state.modules.fotoauftraege = {};
  if (!istObjekt(f.karten)) f.karten = {};
  if (!Array.isArray(f.neu)) f.neu = [];
  if (f.auftrag !== null && !istObjekt(f.auftrag)) f.auftrag = null;
  if (f.sonder !== null && !istObjekt(f.sonder)) f.sonder = null;
  f.auftrag ??= null;
  f.sonder ??= null;
  if (!ganz(f.tag)) f.tag = null;
  if (!ganz(f.frei)) f.frei = null;
  if (!ganz(f.erledigt) || f.erledigt < 0) f.erledigt = 0;
  if (!Number.isFinite(f.summe) || f.summe < 0) f.summe = 0;
  return f;
}

/** Unsinn aus einem geladenen Spielstand entfernen (fremde Motive, kaputte Einträge, zu große Bilder). */
export function saeubern(state) {
  const f = faState(state);
  for (const k of Object.keys(f.karten)) {
    const k0 = f.karten[k];
    if (!MOTIVE[k] || !istObjekt(k0)) { delete f.karten[k]; continue; }
    const bild = typeof k0.bild === 'string' && k0.bild.startsWith('data:image/') && k0.bild.length < BILD_MAX ? k0.bild : null;
    f.karten[k] = { tag: ganz(k0.tag) ? k0.tag : null, stufe: ganz(k0.stufe) ? k0.stufe : null, mal: ganz(k0.mal) && k0.mal > 0 ? k0.mal : 1, ...(bild ? { bild } : {}) };
  }
  if (f.auftrag && (!MOTIVE[f.auftrag.motiv] || !ganz(f.auftrag.ab) || !ganz(f.auftrag.bis))) f.auftrag = null;
  if (f.auftrag) f.auftrag = { motiv: f.auftrag.motiv, ab: f.auftrag.ab, bis: f.auftrag.bis };
  if (f.sonder && (!MOTIVE[f.sonder.motiv] || !ganz(f.sonder.tag))) f.sonder = null;
  if (f.sonder) f.sonder = { motiv: f.sonder.motiv, tag: f.sonder.tag };
  f.neu = [...new Set(f.neu.filter((m) => MOTIVE[m] && f.karten[m]))];
  if (!MOTIVE[f.letztes]) delete f.letztes;
  if (!ganz(f.sonderTag)) delete f.sonderTag;
  return f;
}

// Fester Zufall aus Seed und Tag (mulberry32, wie features/besucher-regeln.js), eigenes Salz
function zufall(seed, tag, salz = 43) {
  let a = ((seed >>> 0) ^ Math.imul(tag + 1, 0x9e3779b1) ^ Math.imul(salz + 13, 0x85ebca6b)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lage des Tages, die die Oberfläche liefert (ohne Browser im Test frei setzbar):
 * { stufe, winter, ereignis (id aus data/events.js oder null), besucher (bool), grossschiff (bool) }
 */
export function lageAus(state, extra = {}) {
  return {
    stufe: state.stage ?? 1,
    winter: !!seasonOf(state.day ?? 1).winter,
    ereignis: null, besucher: false, grossschiff: false,
    ...extra,
  };
}

/** Geht dieses Motiv bei dieser Lage? (Stufe, Winter, besonderer Tag) */
export function moeglich(motiv, lage) {
  const m = MOTIVE[motiv];
  if (!m || !lage) return false;
  if ((m.abStufe ?? 1) > (lage.stufe ?? 1)) return false;
  if (m.art === 'regel') return !!m.nurWinter === !!lage.winter;
  if (lage.winter) return false;
  if (motiv === 'besucher') return !!lage.besucher;
  if (motiv === 'grossschiff') return !!lage.grossschiff;
  return !!m.ereignisse?.includes(lage.ereignis);
}

/** Honorar in Euro (auf 5 € gerundet): Stufe, Sonderauftrag, Nachdruck eines Motivs, das schon da ist. */
export function honorar(state, motiv, sonder = false) {
  const f = faState(state);
  const stufe = Math.min(6, Math.max(1, state.stage ?? 1));
  let h = FA.honorar[stufe] ?? FA.honorar[1];
  if (sonder) h *= FA.sonderFaktor;
  if (f.karten[motiv]) h *= FA.nachdruckFaktor;
  return Math.max(5, Math.round(h / 5) * 5);
}

/** Offene Aufträge: [{ motiv, sonder, bis, honorar }], Sonderauftrag zuerst. */
export function offen(state) {
  const f = faState(state);
  const out = [];
  if (f.sonder && f.sonder.tag === state.day) out.push({ motiv: f.sonder.motiv, sonder: true, bis: f.sonder.tag, honorar: honorar(state, f.sonder.motiv, true) });
  if (f.auftrag && state.day >= f.auftrag.ab && state.day <= f.auftrag.bis) out.push({ motiv: f.auftrag.motiv, sonder: false, bis: f.auftrag.bis, honorar: honorar(state, f.auftrag.motiv) });
  return out;
}

/** Wechselnden Auftrag wählen: lieber ein Motiv, das noch keine Postkarte hat; nie dasselbe zweimal hintereinander. */
export function waehle(state, lage, letztes = null) {
  const f = faState(state);
  const arten = MOTIV_IDS.filter((m) => MOTIVE[m].art === 'regel' && moeglich(m, lage));
  if (!arten.length) return null;
  const kandidaten = arten.length > 1 ? arten.filter((m) => m !== letztes) : arten;
  const gewicht = (m) => (f.karten[m] ? 1 : 4);
  const summe = kandidaten.reduce((s, m) => s + gewicht(m), 0);
  let r = zufall(state.seed ?? 1, state.day ?? 1)() * summe;
  for (const m of kandidaten) { r -= gewicht(m); if (r < 0) return m; }
  return kandidaten[kandidaten.length - 1];
}

/**
 * Einmal je Sekunde aus der Oberfläche (billig, wiederholbar): am Morgen Aufträge verfallen lassen und neue
 * vergeben, über den Tag Sonderaufträge anbieten, sobald der besondere Anlass da ist.
 * Gibt Ereignisse zurück: [{ typ: 'neu' | 'verfallen', motiv, sonder }].
 */
export function pruefen(state, lage) {
  const out = [];
  if (!state || !Number.isInteger(state.day)) return out;
  const f = faState(state);
  const tag = state.day;
  if (f.tag !== tag) {
    f.tag = tag;
    if (f.sonder && f.sonder.tag !== tag) f.sonder = null;
    if (f.auftrag && (tag > f.auftrag.bis || !moeglich(f.auftrag.motiv, lage))) {
      out.push({ typ: 'verfallen', motiv: f.auftrag.motiv, sonder: false });
      f.letztes = f.auftrag.motiv;
      // Abgelaufen: Pause. Passt das Motiv nicht mehr zur Jahreszeit (der Winter ist nur zwei Tage lang),
      // kommt gleich ein neuer Auftrag.
      f.frei = moeglich(f.auftrag.motiv, lage) ? Math.max(f.frei ?? 0, f.auftrag.bis + 1 + FA.pauseTage) : tag;
      f.auftrag = null;
    }
    // Jahreszeit gewechselt, während Pause war: die Pause gilt nicht für das neue Motiv der Jahreszeit
    if (!f.auftrag && f.letztes && MOTIVE[f.letztes] && !moeglich(f.letztes, lage) && MOTIVE[f.letztes].art === 'regel') f.frei = Math.min(f.frei ?? tag, tag);
    if (!f.auftrag && tag >= FA.abTag && tag >= (f.frei ?? 0)) {
      const m = waehle(state, lage, f.letztes);
      if (m) {
        f.auftrag = { motiv: m, ab: tag, bis: tag + FA.dauerTage - 1 };
        out.push({ typ: 'neu', motiv: m, sonder: false });
      }
    }
  }
  // Sonderauftrag: nur ein Motiv, das noch keine Postkarte hat, höchstens einer am Tag
  if (!f.sonder && tag >= FA.abTag && f.sonderTag !== tag) {
    const m = MOTIV_IDS.find((id) => MOTIVE[id].art === 'sonder' && !f.karten[id] && moeglich(id, lage));
    if (m) {
      f.sonder = { motiv: m, tag };
      f.sonderTag = tag;
      out.push({ typ: 'neu', motiv: m, sonder: true });
    }
  }
  return out;
}

/** Auftrag mit diesem Motiv (zum Ausprobieren und in Tests) sofort vergeben. */
export function setze(state, motiv, { sonder = null } = {}) {
  if (!MOTIVE[motiv]) return null;
  const f = faState(state);
  const s = sonder ?? MOTIVE[motiv].art === 'sonder';
  if (s) { f.sonder = { motiv, tag: state.day }; f.sonderTag = state.day; }
  else f.auftrag = { motiv, ab: state.day, bis: state.day + FA.dauerTage - 1 };
  f.tag ??= state.day;
  return offen(state).find((a) => a.motiv === motiv && a.sonder === s) ?? null;
}

/**
 * Foto als Postkarte abliefern. Nur für einen offenen Auftrag mit diesem Motiv.
 * Gibt { motiv, honorar, erstes, sonder } zurück oder null. Das Geld bucht der Aufrufer (addIncome).
 */
export function erfuellen(state, motiv, bild = null) {
  const a = offen(state).find((x) => x.motiv === motiv);
  if (!a) return null;
  const f = faState(state);
  const alt = f.karten[motiv];
  const ok = typeof bild === 'string' && bild.startsWith('data:image/') && bild.length < BILD_MAX;
  f.karten[motiv] = {
    tag: state.day, stufe: state.stage ?? 1, mal: (alt?.mal ?? 0) + 1,
    ...(ok ? { bild } : alt?.bild ? { bild: alt.bild } : {}),
  };
  if (a.sonder) f.sonder = null;
  else { f.auftrag = null; f.frei = state.day + 1 + FA.pauseTage; f.letztes = motiv; }
  f.erledigt += 1;
  f.summe += a.honorar;
  if (!f.neu.includes(motiv)) f.neu.push(motiv);
  return { motiv, honorar: a.honorar, erstes: !alt, sonder: a.sonder };
}

/** Fortschritt für Logbuch und Erfolge. */
export function fortschritt(state) {
  const f = faState(state);
  return { karten: MOTIV_IDS.filter((m) => f.karten[m]).length, gesamt: MOTIV_IDS.length, erledigt: f.erledigt, summe: f.summe };
}

/** Uhrzeit (Stunden) im Fenster des Motivs? Motive ohne Fenster: immer. */
export function zeitPasst(motiv, stunde) {
  const f = motiv === 'abendrot' ? FA.abend : motiv === 'morgen' ? FA.morgen : null;
  return !f || (stunde >= f[0] && stunde <= f[1]);
}
