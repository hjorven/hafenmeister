// Gästepost (Roadmap P25, F37, docs/stammgaeste.md): Stammgäste schreiben Karten, die im Hafenbüro an
// der Pinnwand hängen (ui/gaestepost.js zeigt sie im Gästebuch). Jede Karte hat eine Wirkung:
//
// - Ankündigung: „Wir kommen am Tag 34 wieder.“ An diesem Tag kommt der Stammgast sicher, mit seinen
//   Wünschen und seinem Lieblingsplatz. Fällt der Tag in den Winter, kommt er zum Saisonbeginn.
// - Empfehlung: „Unsere Freunde von der Butt kommen auch.“ Am genannten Tag kommt ein Boot mehr, aus
//   demselben Heimathafen. Wer zufrieden ist, merkt sich den Hafen wie jeder Gast.
//
// Wer schreibt: ein echter Stammgast (zweiter zufriedener Besuch, features/stammgaeste.js), der zufrieden
// abreist, mit der Wahrscheinlichkeit ECONOMY.stammgaeste.post.chance; höchstens eine offene Karte je Gast.
// Die Karte kommt ein paar Tage später morgens an (Ereignis 'postNeu').
//
// Spielstand: state.modules.post = { naechsteId, karten: [Karte], unterwegs: [Karte] }
//   Karte = { id, art: 'ankuendigung'|'empfehlung', stammId, bootsname, heimathafen, geschrieben, ankunft,
//             besuchTag, freund?: { bootsname }, platz?, wuensche?, gelesen, stand: 'offen'|'da'|'verpasst' }
// Würfel nur über random(state) (kein Math.random), Texte mit festem Zufall aus der Karten-id.
// Die Logik läuft ohne Browser (tests/gaestepost.test.mjs).

import * as sim from '../sim.js';
import { random, randomInt } from '../random.js';
import { ECONOMY } from '../data/economy.js';
import { stammState, istStamm, istDa, alsStammgast, freierName } from './stammgaeste.js';
import { heimathaefen } from '../data/bootsnamen.js';

export const POST = ECONOMY.stammgaeste.post;

export function postState(state) {
  state.modules ||= {};
  const p = (state.modules.post ||= {});
  p.naechsteId ??= 1;
  if (!Array.isArray(p.karten)) p.karten = [];
  if (!Array.isArray(p.unterwegs)) p.unterwegs = [];
  return p;
}

const offen = (p, stammId) => [...p.unterwegs, ...p.karten].some((k) => k.stammId === stammId && k.stand === 'offen');

/**
 * Hook 'night' (nach features/stammgaeste.js, die Liste ist schon fortgeschrieben):
 * 1. zufriedene Stammgäste schreiben vielleicht, 2. Karten, die heute ankommen, an die Pinnwand.
 * Der neue Tag ist dann state.day + 1 (die Nacht gehört noch zum alten Tag).
 */
export function nachtHook({ state, events }) {
  if (!POST) return;
  const p = postState(state);
  const s = stammState(state);
  const morgen = state.day + 1;
  for (const e of events) {
    if (e.type !== 'departed' || e.guest?.stammId == null || !(e.rating >= ECONOMY.stammgaeste.abBewertung)) continue;
    const g = s.liste.find((x) => x.stammId === e.guest.stammId);
    if (!g || !istStamm(g) || offen(p, g.stammId)) continue;
    if (random(state) >= POST.chance) continue;
    const ankunft = morgen + randomInt(state, POST.unterwegs[0], POST.unterwegs[1]);
    const empfehlung = random(state) < POST.empfehlung;
    const bereich = empfehlung ? POST.besuchFreunde : POST.besuchNach;
    const karte = {
      id: p.naechsteId++, art: empfehlung ? 'empfehlung' : 'ankuendigung', stammId: g.stammId,
      bootsname: g.bootsname, heimathafen: g.heimathafen, geschrieben: state.day, ankunft,
      besuchTag: ankunft + randomInt(state, bereich[0], bereich[1]), gelesen: false, stand: 'offen',
    };
    if (!empfehlung) {
      karte.platz = g.lieblingsplatz ?? null;
      karte.wuensche = [...(g.wishes || [])];
    }
    p.unterwegs.push(karte);
  }
  // Karten, die morgen früh ankommen
  for (const k of [...p.unterwegs]) {
    if (k.ankunft > morgen) continue;
    p.unterwegs.splice(p.unterwegs.indexOf(k), 1);
    // Freunde brauchen einen Namen, der morgen frei ist: erst beim Ankommen der Karte vergeben
    if (k.art === 'empfehlung') k.freund = { bootsname: freundesName(state, k) };
    p.karten.unshift(k);
    events.push({ type: 'postNeu', karteId: k.id, art: k.art, bootsname: k.bootsname, heimathafen: k.heimathafen, besuchTag: k.besuchTag });
  }
  // Pinnwand: die neuesten zuerst, erledigte fallen zuerst ab
  while (p.karten.length > POST.pinnwand) {
    const i = p.karten.map((k) => k.stand !== 'offen').lastIndexOf(true);
    p.karten.splice(i >= 0 ? i : p.karten.length - 1, 1);
  }
}

// Fester Zufall aus der Karten-id: derselbe Spielstand, derselbe Name (der Würfel der Regeln bleibt unberührt)
function freundesName(state, k) {
  let h = 2166136261 ^ k.id;
  for (const c of `${k.bootsname}:${k.geschrieben}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const name = freierName(state, (Math.abs(h) % 1000) / 1000);
  // freierName merkt sich den Namen als heute vergeben; für den Besuchstag gilt er erst dann
  const heute = stammState(state).heute;
  if (heute?.namen) heute.namen = heute.namen.filter((n) => n !== name);
  return name;
}

/** Hook 'arrival': am angekündigten Tag wird das erste passende Boot zum angekündigten Stammgast. */
export function ankunftHook({ state, ctx, boat }) {
  if (!POST || boat.stationed || boat.stammId != null || boat.special || boat.freundVon || boat.flotte) return;
  const p = state.modules?.post;
  if (!p?.karten?.length) return;
  const s = stammState(state);
  if (s.ohneStamm) return;    // gerade werden Freunde gewürfelt (ankuenfteHook)
  for (const k of p.karten) {
    if (k.art !== 'ankuendigung' || k.stand !== 'offen' || k.besuchTag > state.day) continue;
    const g = s.liste.find((x) => x.stammId === k.stammId);
    // Nicht mehr auf der Liste (zweimal unzufrieden) oder schon da: Karte ist erledigt
    if (!g) { k.stand = 'verpasst'; continue; }
    if (istDa(state, g.stammId)) continue;
    if (!alsStammgast(state, ctx, boat, g)) { k.stand = 'verpasst'; continue; }
    boat.angekuendigt = k.id;
    boat.nights = Math.max(1, boat.nights || 1);   // wer sich ankündigt, bleibt über Nacht
    // Die Geschichte gehörte zum gewürfelten Boot (Kurzer Halt, Ziel): der Anlass ist jetzt die Karte
    for (const f of ['stay', 'story', 'arrivalWish', 'tripPlan']) delete boat[f];
    k.stand = 'da';
    return;
  }
}

/** Hook 'arrivals': am Besuchstag einer Empfehlung kommt ein Boot mehr (die Freunde). */
export function ankuenfteHook({ state, ctx, list }) {
  if (!POST) return;
  const p = state.modules?.post;
  if (!p?.karten?.length) return;
  for (const k of p.karten) {
    if (k.art !== 'empfehlung' || k.stand !== 'offen' || k.besuchTag > state.day) continue;
    if (sim.season(state, ctx).winter) continue;    // im Winter kommt niemand: zum Saisonbeginn
    const s = stammState(state);
    s.ohneStamm = true;
    let boot = null;
    try { boot = sim.rollBoat(state, ctx); } finally { s.ohneStamm = false; }
    if (!boot) { k.stand = 'verpasst'; continue; }
    boot.id = state.nextId++;
    boot.freundVon = { karteId: k.id, stammId: k.stammId, bootsname: k.bootsname };
    // Name aus der Karte, falls er gerade frei ist; Heimathafen wie der Stammgast, wenn die Größe dorthin passt
    const belegt = new Set([...Object.values(state.boats), ...state.upcoming, ...list].map((b) => b?.bootsname));
    if (k.freund?.bootsname && !belegt.has(k.freund.bootsname)) boot.bootsname = k.freund.bootsname;
    else k.freund = { bootsname: boot.bootsname };
    if (heimathaefen(state.region, boot.size).includes(k.heimathafen)) boot.heimathafen = k.heimathafen;
    boot.nights = Math.max(1, boot.nights || 1);
    for (const f of ['stay', 'story', 'arrivalWish']) delete boot[f];
    boot.arriveAt = luecke(ctx, list, state);
    list.push(boot);
    list.sort((a, b) => a.arriveAt - b.arriveAt);
    k.stand = 'da';
  }
}

/** Ankunftszeit in der größten Lücke des Tages (keine zwei Boote zugleich), Nachmittag bevorzugt. */
function luecke(ctx, list, state) {
  const L = ctx.rules.dayLength;
  const von = L * Math.max(ctx.rules.arrivalFrom ?? 0, 0.3);
  const bis = L * (ctx.rules.arrivalWindow ?? 0.9);
  const zeiten = list.map((b) => b.arriveAt).filter((t) => t >= von && t <= bis).sort((a, b) => a - b);
  const punkte = [von, ...zeiten, bis];
  let best = von, weite = -1;
  for (let i = 1; i < punkte.length; i++) {
    const w = punkte[i] - punkte[i - 1];
    if (w > weite) { weite = w; best = punkte[i - 1] + w * (0.35 + random(state) * 0.3); }
  }
  return Math.round(best * 10) / 10;
}

/** Ungelesene Karten an der Pinnwand. */
export function ungelesen(state) {
  return (state?.modules?.post?.karten || []).filter((k) => !k.gelesen).length;
}

/** Alle Karten als gelesen markieren (Pinnwand angesehen). */
export function allesGelesen(state) {
  for (const k of state?.modules?.post?.karten || []) k.gelesen = true;
}

export function haengeEin(addHook) {
  const ab = [addHook('night', nachtHook), addHook('arrival', ankunftHook), addHook('arrivals', ankuenfteHook)];
  return () => ab.forEach((f) => f());
}

// ------------------------------------------------------------------ Texte

function wahl(liste, k, salz = 0) {
  let h = 2166136261 ^ salz;
  for (const c of `${k.id}:${k.bootsname}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return liste[Math.abs(h) % liste.length];
}

const GRUSS = ['Moin aus', 'Viele Grüße aus', 'Herzliche Grüße aus', 'Ahoi aus'];
const WANN = (k, heute) => {
  const d = k.besuchTag - heute;
  return d <= 0 ? 'heute' : d === 1 ? 'morgen' : d === 2 ? 'übermorgen' : `am Tag ${k.besuchTag}`;
};

/**
 * Text einer Karte, zum Beispiel „Moin aus Kappeln! Wir kommen am Tag 34 wieder, gern wieder in Box B05.“
 * wunschName(key) liefert den Namen eines Wunschs („Strom“), heute ist der aktuelle Spieltag.
 */
export function kartenText(k, heute, wunschName = (w) => w) {
  const gruss = `${wahl(GRUSS, k)} ${k.heimathafen ?? 'der Ferne'}!`;
  if (k.art === 'empfehlung') {
    const f = k.freund?.bootsname ? `der „${k.freund.bootsname}“` : 'einem anderen Boot';
    if (k.stand === 'da') return `${gruss} Wir haben unseren Freunden von ${f} von euch erzählt. Sie waren schon da.`;
    return `${gruss} Wir haben unseren Freunden von ${f} von euch erzählt. Sie kommen ${WANN(k, heute)}.`;
  }
  const platz = k.platz ? `, gern wieder in Box ${k.platz}` : '';
  const w = k.wuensche?.length ? ` Wir brauchen wieder ${k.wuensche.map(wunschName).join(' und ')}.` : '';
  if (k.stand === 'da') return `${gruss} Wir sind wieder da${platz ? ` und hoffen auf Box ${k.platz}` : ''}.`;
  if (k.stand === 'verpasst') return `${gruss} Leider wird es diesmal nichts mit dem Besuch.`;
  return `${gruss} Wir kommen ${WANN(k, heute)} wieder${platz}.${w}`;
}

/** Kurzer Status für die Pinnwand, zum Beispiel „kommt morgen“ oder „ist da“. */
export function kartenStand(k, heute) {
  if (k.stand === 'da') return k.art === 'empfehlung' ? 'Freunde sind da' : 'ist da';
  if (k.stand === 'verpasst') return 'kommt nicht';
  return k.art === 'empfehlung' ? `Freunde kommen ${WANN(k, heute)}` : `kommt ${WANN(k, heute)}`;
}
