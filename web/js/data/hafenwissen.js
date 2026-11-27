// Hafenwissen zum Sammeln (Roadmap P49, F34, docs/signalflaggen.md): Seezeichen, Feuer und Lichter,
// Knoten. Jeder Eintrag gehört zu etwas, das im Spiel wirklich zu sehen ist, und wird gesammelt, sobald
// es im eigenen Hafen vorkommt (features/hafenwissen.js erkennt es). Dazu kommen die Signalflaggen aus
// data/signalflaggen.js. Ohne Browser nutzbar (Tests: tests/signalflaggen.test.mjs).
//
// Bilder: 16 x 16 Pixel, je Buchstabe eine Farbe aus PALETTE, '.' ist leer.

import { ECONOMY } from './economy.js';
import { WUNSCH_FLAGGE, SIGNALBUCH, FLAGGEN_IM_SPIEL, AUSLAUFEN } from './signalflaggen.js';
import { VERSORGUNG_TEXTE, ANGEBOT_TEXTE } from './wuensche-texte.js';

export const PALETTE = {
  k: '#24364a', r: '#c8202f', g: '#2e9b4f', y: '#f2c014', w: '#f6f3ea', b: '#8a5a2b', l: '#8fcbe0',
  s: '#9aa3ad', o: '#d9a441', n: '#1f4fa0', h: '#fff3b0', d: '#5d6670',
};

export const GRUPPEN = [
  { id: 'flaggen', name: 'Signalflaggen' },
  { id: 'seezeichen', name: 'Seezeichen und Bojen' },
  { id: 'lichter', name: 'Feuer und Lichter' },
  { id: 'knoten', name: 'Knoten' },
];

// id, gruppe, name, text (was es ist), wo (wo man es im Spiel sieht, auch als Hinweis, solange es fehlt)
export const WISSEN = [
  {
    id: 'warteboje', gruppe: 'seezeichen', name: 'Warteboje',
    text: 'Eine gelbe Boje vor den Stegen. Hier macht ein Boot fest und wartet, bis du ihm eine Box gibst.',
    wo: 'Sobald das erste Boot an der Warteboje wartet.',
    bild: [
      '................', '................', '.......kk.......', '.......kk.......', '......kddk......', '.....kyyyyk.....',
      '....kyyyyyyk....', '...kyyyyyyyyk...', '...krrrrrrrrk...', '...kyyyyyyyyk...', '..llkyyyyyykll..', 'llllllkkkkkllll.',
      '.llllllllllllll.', '...llll..llll...', '................', '................'],
  },
  {
    id: 'pricke', gruppe: 'seezeichen', name: 'Pricke',
    text: 'Ein Reisigbesen auf einer Stange. Pricken stecken am Rand flacher Rinnen in Bodden und Haff, damit niemand auf Grund läuft.',
    wo: 'An Küsten mit flacher Rinne in Stufe 1 und 2, sobald ein Boot hindurchfährt.',
    bild: [
      '................', '....b.b..b......', '.....bbbb.b.....', '...b.bbbbb......', '....bbbbbbb.....', '.....bbbbb......',
      '.......k........', '.......k........', '.......k........', '.......k........', '.......k........', '.......k........',
      '..lllllkllll....', '.llllllkllllll..', '...llll.llll....', '................'],
  },
  {
    id: 'muringboje', gruppe: 'seezeichen', name: 'Muringboje',
    text: 'Eine Boje an einer schweren Kette mit einem Betonklotz am Grund. Wer hier festmacht, liegt günstig und dreht sich mit dem Wind um die Boje.',
    wo: 'Im Bojenfeld (ab Stufe 2 zu bauen), sobald dort ein Boot festmacht.',
    bild: [
      '................', '................', '.......kkk......', '......k...k.....', '.......kkk......', '.....kwwwwwk....',
      '....kwwwwwwwk...', '..llkrrrrrrrkll.', 'llllllkkkkkllll.', '.lllllllslllll..', '........s.......', '........s.......',
      '.......s........', '.......s........', '.....kkkkkk.....', '.....kddddk.....'],
  },
  {
    id: 'regattatonne', gruppe: 'seezeichen', name: 'Regattatonne',
    text: 'Eine große gelbe Tonne als Wendemarke. Die Luvtonne liegt gegen den Wind, dorthin kreuzen die Boote hinauf und laufen dann vor dem Wind zurück.',
    wo: 'Draußen vor dem Hafen, wenn eine Regatta läuft.',
    bild: [
      '................', '.......kk.......', '......kyyk......', '......kyyk......', '.....kyyyyk.....', '.....kyyyyk.....',
      '....kyyyyyyk....', '....kyyyyyyk....', '...kyyyyyyyyk...', '...kyyyyyyyyk...', '..lkkkkkkkkkkl..', 'lllllllllllllll.',
      '.lllll.llll.lll.', '................', '................', '................'],
  },
  {
    id: 'molenfeuer', gruppe: 'lichter', name: 'Molenfeuer',
    text: 'Zwei kleine Türme auf den Molenköpfen. Wer in den Hafen einläuft, hat Grün an Steuerbord und Rot an Backbord. Nachts blinken beide und zeigen die Einfahrt.',
    wo: 'Nachts an den Molenköpfen, ab Stufe 3.',
    bild: [
      '..h..........h..', '.hrh........hgh.', '..kk........kk..', '.krrk......kggk.', '.krrk......kggk.', '.kwwk......kwwk.',
      '.krrk......kggk.', '.kwwk......kwwk.', '.krrk......kggk.', 'kssssk....kssssk', 'kssssk....kssssk', 'lllllllllllllll.',
      '.llll.llll.llll.', '................', '................', '................'],
  },
  {
    id: 'leuchtfeuer', gruppe: 'lichter', name: 'Leuchtfeuer',
    text: 'Jeder Leuchtturm hat seine Kennung. Dieser blitzt einmal alle sechs Sekunden („Fl 6s“). So weiß man nachts, welcher Turm es ist.',
    wo: 'Nachts an Küsten mit Leuchtturm.',
    bild: [
      'hh.....kk.....hh', '..hhh.khhk.hhh..', '.....kkkkkk.....', '......krrk......', '......krrk......', '.....kwwwwk.....',
      '.....kwwwwk.....', '.....krrrrk.....', '.....krrrrk.....', '....kwwwwwwk....', '....kwwwwwwk....', '....krrrrrrk....',
      '...kssssssssk...', '..kssssssssssk..', 'lllllllllllllll.', '.llll.llll.llll.'],
  },
  {
    id: 'ankerlicht', gruppe: 'lichter', name: 'Ankerlicht',
    text: 'Ein weißes Rundumlicht oben am Mast. Wer nachts vor Anker oder an einer Boje liegt, zeigt es, damit andere ihn sehen.',
    wo: 'Nachts an Booten, die an einer Boje liegen.',
    bild: [
      '......hhh.......', '.....hhwhh......', '......hhh.......', '.......k........', '.......k........', '.......k........',
      '.......k........', '.......k........', '.......k........', '.......k........', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..',
      '...kwwwwwwwwk...', 'llllkkkkkkkkllll', '.llllllllllllll.', '................'],
  },
  {
    id: 'positionslichter', gruppe: 'lichter', name: 'Positionslichter',
    text: 'Rot an Backbord, Grün an Steuerbord, Weiß am Heck. Wer nachts ein rotes Licht sieht, blickt auf die Backbordseite eines Boots und weiß, wohin es fährt.',
    wo: 'Abends und nachts an Booten, die fahren.',
    bild: [
      '................', '.......hh.......', '.......hh.......', '.......kk.......', '.......kk.......', '......kddk......',
      '.....kwwwwk.....', '....kwwwwwwk....', '.rr.kwwwwwwk.gg.', 'rrrrkwwwwwwkgggg', '.rr.kwwwwwwk.gg.', '...kwwwwwwwwk...',
      '...kkkkkkkkkk...', 'llllllllllllllll', '.llll.llll.llll.', '................'],
  },
  {
    id: 'klampenschlag', gruppe: 'knoten', name: 'Klampenschlag',
    text: 'Die Leine einmal um die Klampe, dann in Achten darüber und mit einem Kopfschlag sichern. So macht man ein Boot am Steg fest, und es lässt sich schnell wieder lösen.',
    wo: 'Sobald das erste Boot in einer Box festmacht.',
    bild: [
      '................', '................', '................', '...oo......oo...', '....oo....oo....', '.....oo..oo.....',
      '..kkkkooookkkk..', '.ksssssoossssk..', '..kkkooookkkk...', '....oo.kk.oo....', '...oo..kk..oo...', '..oo..kkkk..oo..',
      '.oo..kddddk.....', 'oo..kddddddk....', '...kkkkkkkkkk...', '................'],
  },
  {
    id: 'palstek', gruppe: 'knoten', name: 'Palstek',
    text: 'Der König der Knoten: ein festes Auge, das sich nicht zuzieht und trotzdem leicht wieder aufgeht. Damit legt man die Leine um eine Boje oder einen Pfahl.',
    wo: 'Wenn ein Boot an einer Muringboje im Bojenfeld festmacht.',
    bild: [
      '.......oo.......', '.......oo.......', '.......oo.......', '......oooo......', '.....oo..oo.....', '.....ooooooo....',
      '.....o.oo..o....', '....oo..oo.oo...', '...oo......oo...', '..oo........oo..', '..o..........o..', '..o..........o..',
      '..oo........oo..', '...oo......oo...', '....oooooooo....', '................'],
  },
  {
    id: 'webeleinstek', gruppe: 'knoten', name: 'Webeleinstek',
    text: 'Zwei Törns über Kreuz um eine Stange. Damit hängen die Fender an der Reling, und ihre Höhe lässt sich leicht verstellen.',
    wo: 'Wenn zwei Boote im Päckchen liegen und Fender dazwischen hängen.',
    bild: [
      '................', 'kkkkkkkkkkkkkkkk', 'sssssosssossssss', 'kkkkoookoookkkkk', '.....oo.oo......', '......ooo.......',
      '.......o........', '.......o........', '......kkk.......', '.....kwwwk......', '.....kwwwk......', '.....kwwwk......',
      '.....kwwwk......', '.....kwwwk......', '......kkk.......', '................'],
  },
  {
    id: 'achtknoten', gruppe: 'knoten', name: 'Achtknoten',
    text: 'Ein Stopperknoten in Form einer Acht am Ende der Schot. Er hält die Leine im Block, damit sie nicht ausrauscht. Den lernen die Kinder im Opti zuerst.',
    wo: 'Beim Jugendtraining, wenn die Optis auf dem Wasser sind.',
    bild: [
      '................', '.....oooo.......', '....oo..oo......', '....o....o......', '....oo..oo......', '.....oooo.......',
      '.....oooo.......', '....oo..oo......', '....o....o......', '....oo..oo......', '.....oooo.......', '........oo......',
      '.........oo.....', '..........oo....', '...........oo...', '................'],
  },
  {
    id: 'rundtoern', gruppe: 'knoten', name: 'Rundtörn mit zwei halben Schlägen',
    text: 'Die Leine einmal ganz um den Poller und mit zwei halben Schlägen sichern. Hält auch unter Zug, darum nimmt man ihn für die Schleppleine.',
    wo: 'Wenn ein Havarist eingeschleppt wird.',
    bild: [
      '................', '.....kkkkkk.....', '....kddddddk....', '.....kddddk.....', '.....kddddk.....', 'ooooooooooooo...',
      '....oddddddo....', '....oooooooo....', '.....kddddk.oo..', '.....kddddk..oo.', '.....kddddk...oo', '....kddddddk....',
      '...kssssssssk...', '..kssssssssssk..', '................', '................'],
  },
];

// Ab welcher Stufe ein Wunsch vorkommt (für den Hinweis bei fehlenden Flaggen)
function wunschAbStufe(w) {
  if (ECONOMY.wuensche?.[w]) return ECONOMY.wuensche[w].abStufe ?? 1;
  if (ECONOMY.angebotWunsch?.wuensche?.[w]) return ECONOMY.angebotWunsch.wuensche[w].abStufe ?? 1;
  if (w === 'ehrenplatz') return 2;
  return 1;
}
const wunschText = (w) => VERSORGUNG_TEXTE[w] ?? ANGEBOT_TEXTE[w] ?? null;

/** Lexikon-Einträge der Signalflaggen: { id: 'flagge-A', buchstabe, name, echt, hier, merk, wo, ab } */
export const FLAGGEN_WISSEN = FLAGGEN_IM_SPIEL.map((b) => {
  const wunsch = Object.keys(WUNSCH_FLAGGE).find((w) => WUNSCH_FLAGGE[w].flagge === b) ?? null;
  const t = wunsch ? wunschText(wunsch) : null;
  const ab = wunsch ? wunschAbStufe(wunsch) : 1;
  return {
    id: `flagge-${b}`, gruppe: 'flaggen', buchstabe: b, wunsch,
    name: `${b} · ${SIGNALBUCH[b].name}`,
    echt: SIGNALBUCH[b].echt,
    hier: b === AUSLAUFEN
      ? 'Das Boot legt gleich ab: Die Box wird bald frei.'
      : `Der Gast wünscht sich ${t?.mit ?? wunsch}. Ist der Wunsch erfüllt, holt die Crew die Flagge ein.`,
    merk: b === AUSLAUFEN ? 'P wie Peter, der Blaue Peter' : WUNSCH_FLAGGE[wunsch].merk,
    wo: b === AUSLAUFEN ? 'Vor dem Auslaufen, an Booten, die heute abreisen.' : `Kommt ab Stufe ${ab}, wenn ein Gast ${t?.mit ?? wunsch} möchte.`,
    ab,
  };
});

/** Alle Einträge (Flaggen zuerst), je mit gruppe. */
export const ALLES = [...FLAGGEN_WISSEN, ...WISSEN];
export const IDS = new Set(ALLES.map((e) => e.id));
const NACH_ID = new Map(ALLES.map((e) => [e.id, e]));
export const eintrag = (id) => NACH_ID.get(id) ?? null;

// ------------------------------------------------------------------ Spielstand
// state.modules.hafenwissen = { gesehen: { id: { tag, stufe } }, neu: [id] }

/** Zustand anlegen und säubern (nur bekannte IDs, Zahlen als Zahlen). */
export function wissenState(state) {
  const mods = (state.modules ||= {});
  let m = mods.hafenwissen;
  if (!m || typeof m !== 'object' || Array.isArray(m)) m = mods.hafenwissen = { gesehen: {}, neu: [] };
  if (!m.gesehen || typeof m.gesehen !== 'object' || Array.isArray(m.gesehen)) m.gesehen = {};
  const sauber = {};
  for (const [id, v] of Object.entries(m.gesehen)) {
    if (!IDS.has(id)) continue;
    const tag = Number(v?.tag);
    const stufe = Number(v?.stufe);
    sauber[id] = { tag: Number.isFinite(tag) ? tag : null, stufe: Number.isFinite(stufe) ? stufe : null };
  }
  m.gesehen = sauber;
  m.neu = Array.isArray(m.neu) ? [...new Set(m.neu.filter((id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(sauber, id)))] : [];
  return m;
}

/** Eintrag sammeln. Gibt true zurück, wenn er neu ist. */
export function sammeln(state, id) {
  if (!state || !IDS.has(id)) return false;
  const m = wissenState(state);
  if (Object.prototype.hasOwnProperty.call(m.gesehen, id)) return false;
  m.gesehen[id] = { tag: state.day ?? null, stufe: state.stage ?? null };
  m.neu.push(id);
  return true;
}

export const gesammelt = (state, id) => !!state?.modules?.hafenwissen?.gesehen && Object.prototype.hasOwnProperty.call(state.modules.hafenwissen.gesehen, id);

/** { gesehen, gesamt, je: { gruppe: { gesehen, gesamt } } } */
export function fortschritt(state) {
  const je = {};
  let n = 0;
  for (const g of GRUPPEN) je[g.id] = { gesehen: 0, gesamt: 0 };
  for (const e of ALLES) {
    je[e.gruppe].gesamt++;
    if (gesammelt(state, e.id)) { je[e.gruppe].gesehen++; n++; }
  }
  return { gesehen: n, gesamt: ALLES.length, je };
}
