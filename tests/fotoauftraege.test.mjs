// Fotoaufträge und Postkarten (Paket P43, docs/fotoauftraege.md): Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../web/js/state.js';
import * as R from '../web/js/features/fotoauftraege-regeln.js';
import * as E from '../web/js/features/erfolge-daten.js';
import { MOTIVE, MOTIV_IDS, FEHLT } from '../web/js/data/fotoauftraege.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { EVENTS, YEAR } from '../web/js/data/events.js';
import { seasonOf } from '../web/js/events/scheduler.js';
import { PIXEL } from '../web/js/ui/pixel-symbole.js';

const FA = ECONOMY.fotoauftraege;
const BILD = `data:image/jpeg;base64,${'A'.repeat(200)}`;

function neu(seed = 5, stufe = 1) {
  const state = createState({ seed });
  state.stage = stufe;
  return state;
}
/** Tage durchgehen, jeden Tag einmal pruefen (wie die Oberfläche am Morgen). */
function tage(state, von, bis, lageFn = () => ({}), jeTag = null) {
  const log = [];
  for (let d = von; d <= bis; d++) {
    state.day = d;
    const ev = R.pruefen(state, R.lageAus(state, lageFn(d)));
    log.push({ tag: d, ev, offen: R.offen(state) });
    jeTag?.(state, d);
  }
  return log;
}

test('Daten: zwölf Motive mit Texten, Symbol und Art; Zahlen in economy.js', () => {
  assert.equal(MOTIV_IDS.length, 12);
  for (const [id, m] of Object.entries(MOTIVE)) {
    assert.ok(m.titel && m.auftrag && m.hinweis, `${id}: Texte`);
    assert.ok(['regel', 'sonder'].includes(m.art), `${id}: Art`);
    assert.ok(PIXEL[m.sym], `${id}: Symbol ${m.sym} fehlt in pixel-symbole.js`);
    for (const e of m.ereignisse ?? []) assert.ok(EVENTS.some((x) => x.id === e), `${id}: Ereignis ${e}`);
  }
  for (let s = 1; s <= 6; s++) assert.ok(FA.honorar[s] > 0);
  for (let s = 2; s <= 6; s++) assert.ok(FA.honorar[s] > FA.honorar[s - 1], 'Honorar wächst mit der Stufe');
  assert.ok(FEHLT.zeit && FEHLT.boote);
});

test('Erster Auftrag am Morgen von Tag 2, nie an Tag 1; gilt dauerTage, dann Pause', () => {
  const s = neu();
  const log = tage(s, 1, 12);
  assert.equal(log[0].offen.length, 0, 'Tag 1 gehört dem Einstieg');
  assert.equal(log[1].ev[0]?.typ, 'neu');
  const a = log[1].offen[0];
  assert.equal(a.bis, 2 + FA.dauerTage - 1);
  // läuft ab und kommt nach der Pause wieder
  const verfallen = log.find((l) => l.ev.some((e) => e.typ === 'verfallen'));
  assert.equal(verfallen.tag, a.bis + 1);
  const naechster = log.find((l) => l.tag > a.bis && l.ev.some((e) => e.typ === 'neu' && !e.sonder));
  assert.equal(naechster.tag, a.bis + 1 + FA.pauseTage);
  assert.notEqual(naechster.offen[0].motiv, a.motiv, 'nie dasselbe Motiv zweimal hintereinander');
});

test('Wiederholt prüfen am selben Tag ändert nichts (einmal je Sekunde aus der Oberfläche)', () => {
  const s = neu();
  s.day = 2;
  const e1 = R.pruefen(s, R.lageAus(s));
  const vorher = JSON.stringify(s.modules.fotoauftraege);
  for (let i = 0; i < 50; i++) assert.deepEqual(R.pruefen(s, R.lageAus(s)), []);
  assert.equal(JSON.stringify(s.modules.fotoauftraege), vorher);
  assert.equal(e1.length, 1);
});

test('Gleicher Seed, gleiche Aufträge; anderer Seed, andere Reihenfolge', () => {
  const folge = (seed) => tage(neu(seed), 1, 40).flatMap((l) => l.ev.filter((e) => e.typ === 'neu').map((e) => e.motiv)).join(',');
  assert.equal(folge(3), folge(3));
  const alle = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(folge));
  assert.ok(alle.size > 1);
});

test('Erfüllen: Honorar je Stufe, Postkarte im Spielstand, Pause danach; Nachdruck halb', () => {
  const s = neu(5, 3);
  s.day = 2;
  R.pruefen(s, R.lageAus(s));
  const a = R.offen(s)[0];
  assert.equal(a.honorar, FA.honorar[3]);
  assert.equal(R.erfuellen(s, a.motiv === 'abendrot' ? 'morgen' : 'abendrot', BILD), null, 'nur das bestellte Motiv');
  const r = R.erfuellen(s, a.motiv, BILD);
  assert.deepEqual(r, { motiv: a.motiv, honorar: FA.honorar[3], erstes: true, sonder: false });
  assert.equal(R.erfuellen(s, a.motiv, BILD), null, 'nur einmal');
  const f = R.faState(s);
  assert.equal(f.karten[a.motiv].bild, BILD);
  assert.equal(f.karten[a.motiv].stufe, 3);
  assert.deepEqual(f.neu, [a.motiv]);
  assert.equal(R.fortschritt(s).karten, 1);
  // nächster Auftrag erst nach der Pause
  s.day = 3;
  assert.deepEqual(R.pruefen(s, R.lageAus(s)), []);
  s.day = 3 + FA.pauseTage;
  assert.equal(R.pruefen(s, R.lageAus(s))[0]?.typ, 'neu');
  // Nachdruck eines vorhandenen Motivs: halbes Honorar, alte Karte bleibt, wenn das neue Bild fehlt
  R.setze(s, a.motiv);
  assert.equal(R.offen(s).find((x) => x.motiv === a.motiv).honorar, Math.round((FA.honorar[3] * FA.nachdruckFaktor) / 5) * 5);
  const r2 = R.erfuellen(s, a.motiv, null);
  assert.equal(r2.erstes, false);
  assert.equal(f.karten[a.motiv].bild, BILD);
  assert.equal(f.karten[a.motiv].mal, 2);
});

test('Wechselnde Aufträge bevorzugen neue Motive: nach 60 Tagen mit Fotos sind alle sechs Sommer-Motive da', () => {
  for (const seed of [1, 2, 3]) {
    const s = neu(seed, 2);
    tage(s, 1, 60, () => ({}), (st) => { for (const a of R.offen(st)) R.erfuellen(st, a.motiv, BILD); });
    const regel = MOTIV_IDS.filter((m) => MOTIVE[m].art === 'regel' && !MOTIVE[m].nurWinter);
    for (const m of regel) assert.ok(R.faState(s).karten[m], `Seed ${seed}: ${m} fehlt`);
  }
});

test('Winter: nur "Hafen im Schnee"; Wechsel der Jahreszeit beendet den alten Auftrag sofort', () => {
  const s = neu(4, 2);
  const winterTag = YEAR.seasonDays + 1;
  assert.ok(seasonOf(winterTag).winter);
  const log = tage(s, 1, YEAR.seasonDays + YEAR.winterDays + 2);
  for (const l of log) {
    const w = seasonOf(l.tag).winter;
    for (const a of l.offen) assert.equal(a.motiv === 'winter', w, `Tag ${l.tag}: ${a.motiv} im ${w ? 'Winter' : 'Sommer'}`);
  }
  const w1 = log.find((l) => l.tag === winterTag);
  assert.equal(w1.offen[0]?.motiv, 'winter', 'am ersten Wintertag gleich der Winterauftrag');
  const fruehling = log.find((l) => l.tag === winterTag + YEAR.winterDays);
  assert.ok(fruehling.offen.length && fruehling.offen[0].motiv !== 'winter');
});

test('Sonderaufträge: nur am besonderen Tag, nur neue Motive, nur heute, ab ihrer Stufe', () => {
  const s = neu(6, 3);
  s.day = 4;
  const ev = R.pruefen(s, R.lageAus(s, { ereignis: 'nebel' }));
  assert.ok(ev.some((e) => e.sonder && e.motiv === 'nebel'));
  const so = R.offen(s).find((a) => a.sonder);
  assert.equal(so.honorar, Math.round((FA.honorar[3] * FA.sonderFaktor) / 5) * 5);
  assert.equal(R.offen(s)[0].sonder, true, 'Sonderauftrag steht vorn');
  s.day = 5;
  R.pruefen(s, R.lageAus(s, { ereignis: 'nebel' }));
  assert.equal(R.offen(s).filter((a) => a.sonder).length, 1, 'am nächsten Nebeltag wieder (noch keine Karte)');
  R.erfuellen(s, 'nebel', BILD);
  s.day = 6;
  R.pruefen(s, R.lageAus(s, { ereignis: 'nebel' }));
  assert.ok(!R.offen(s).some((a) => a.sonder), 'Motiv schon da: kein Sonderauftrag mehr');
  // Stufe: Großschiff nur im Seehafen, Besucher ab Stufe 2
  assert.equal(R.moeglich('grossschiff', { stufe: 5, grossschiff: true }), false);
  assert.equal(R.moeglich('grossschiff', { stufe: 6, grossschiff: true }), true);
  assert.equal(R.moeglich('besucher', { stufe: 1, besucher: true }), false);
  assert.equal(R.moeglich('regatta', { stufe: 2, ereignis: 'regatta' }), false);
  assert.equal(R.moeglich('fest', { stufe: 3, ereignis: 'mittsommer' }), true);
  assert.equal(R.moeglich('fest', { stufe: 3, ereignis: 'sturm' }), false);
  assert.equal(R.moeglich('nebel', { stufe: 3, ereignis: 'nebel', winter: true }), false);
  // Sonderauftrag verfällt am nächsten Tag still
  const t = neu(6, 4);
  t.day = 8;
  R.pruefen(t, R.lageAus(t, { besucher: true }));
  assert.ok(R.offen(t).some((a) => a.motiv === 'besucher'));
  t.day = 9;
  R.pruefen(t, R.lageAus(t));
  assert.ok(!R.offen(t).some((a) => a.sonder));
});

test('Ein Besucher am Nachmittag: Sonderauftrag kommt auch mitten am Tag dazu', () => {
  const s = neu(2, 3);
  s.day = 3;
  R.pruefen(s, R.lageAus(s));
  assert.ok(!R.offen(s).some((a) => a.sonder));
  const ev = R.pruefen(s, R.lageAus(s, { besucher: true }));
  assert.deepEqual(ev.map((e) => e.motiv), ['besucher']);
  // nach dem Erfüllen am selben Tag kein zweiter
  R.erfuellen(s, 'besucher', BILD);
  assert.deepEqual(R.pruefen(s, R.lageAus(s, { ereignis: 'regatta' })), []);
});

test('Uhrzeit: Sonnenuntergang 18:30 bis 21:30, Morgen bis 8:30, andere immer', () => {
  assert.equal(R.zeitPasst('abendrot', 18.4), false);
  assert.equal(R.zeitPasst('abendrot', 19), true);
  assert.equal(R.zeitPasst('abendrot', 21.6), false);
  assert.equal(R.zeitPasst('morgen', 6.5), true);
  assert.equal(R.zeitPasst('morgen', 9), false);
  assert.equal(R.zeitPasst('anlegen', 3), true);
});

test('Erfolg "Postkartenständer": erst mit allen zwölf Postkarten', () => {
  const s = neu(1, 6);
  const e = E.ERFOLG_BY_ID.postkarten;
  assert.ok(e && e.ding === 'wimpel');
  assert.equal(E.stand(s, e).fertig, false);
  for (const m of MOTIV_IDS.slice(0, 11)) { R.setze(s, m); R.erfuellen(s, m, BILD); }
  assert.deepEqual(E.stand(s, e), { ist: 11, soll: 12, fertig: false });
  R.setze(s, MOTIV_IDS[11]);
  R.erfuellen(s, MOTIV_IDS[11], BILD);
  assert.equal(E.stand(s, e).fertig, true);
});

test('Speichern und Laden; kaputte Stände werden gesäubert', () => {
  const s = neu(9, 2);
  s.day = 2;
  R.pruefen(s, R.lageAus(s));
  const a = R.offen(s)[0];
  R.erfuellen(s, a.motiv, BILD);
  const t = deserialize(serialize(s));
  R.saeubern(t);
  assert.deepEqual(t.modules.fotoauftraege.karten, s.modules.fotoauftraege.karten);
  // kaputt
  t.modules.fotoauftraege = {
    karten: { fremd: { tag: 1 }, abendrot: { tag: 'x', bild: 'javascript:alert(1)', mal: -3 }, morgen: 5, anlegen: { tag: 2, bild: `data:image/jpeg;base64,${'A'.repeat(R.BILD_MAX)}` } },
    auftrag: { motiv: 'gibtsnicht', ab: 1, bis: 3 }, sonder: 'kaputt', neu: ['fremd', 'abendrot', 'abendrot', 'nebel'], erledigt: -1, summe: 'viel', tag: 'heute',
  };
  R.saeubern(t);
  const f = t.modules.fotoauftraege;
  assert.deepEqual(Object.keys(f.karten).sort(), ['abendrot', 'anlegen']);
  assert.deepEqual(f.karten.abendrot, { tag: null, stufe: null, mal: 1 });
  assert.equal(f.karten.anlegen.bild, undefined, 'zu großes Bild fällt weg');
  assert.equal(f.auftrag, null);
  assert.equal(f.sonder, null);
  assert.deepEqual(f.neu, ['abendrot']);
  assert.equal(f.erledigt, 0);
  assert.equal(f.summe, 0);
  assert.equal(f.tag, null);
  // danach läuft alles weiter
  t.day = 20;
  assert.ok(Array.isArray(R.pruefen(t, R.lageAus(t))));
  // ganz ohne Modul-Stand
  const u = neu(1, 1);
  delete u.modules;
  assert.deepEqual(R.offen(u), []);
});

test('Nie zweimal dasselbe Motiv hintereinander, auch über verfallene Aufträge und den Winter', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = neu(seed, 2);
    const folge = tage(s, 1, 80).flatMap((l) => l.ev.filter((e) => e.typ === 'neu' && !e.sonder).map((e) => e.motiv));
    assert.ok(folge.length > 10, `Seed ${seed}: genug Aufträge`);
    for (let i = 1; i < folge.length; i++) assert.notEqual(folge[i], folge[i - 1], `Seed ${seed}: ${folge.join(',')}`);
  }
});
