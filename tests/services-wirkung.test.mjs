// Tests fuer die eigene Wirkung der Services (Roadmap P23: F2, F3, F5, F7, F9). Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, SERVICE_BY_ID, WAHLPLAETZE, DIENST_TEXTE } from '../web/js/data/services.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { erstelleRegeln, neuerZustand, TAGESGAESTE_BESUCHE } from '../web/js/services/rules.js';

const R = erstelleRegeln();
const S6 = { stufe: 6, ruf: 5 };
const boote = (n, klasse = 'M', antrieb = 'segel') => Array.from({ length: n }, (_, i) => ({ id: i + 1, klasse, antrieb }));
const wirkung = (id, stufe = 1) => ECONOMY.services[id].stufen[stufe - 1].wirkung;

test('F2: jeder genannte Service hat eine Wirkung auf das Spiel, nicht nur Geld', () => {
  assert.ok(wirkung('slip').trailer, 'Slip: Trailerboote');
  assert.ok(wirkung('mastenkran').dienst?.naechte >= 1, 'Mastenkran: Segler bleiben länger');
  assert.ok(wirkung('fahrradverleih').dienst?.naechte >= 1, 'Fahrradverleih: eine Nacht mehr');
  assert.ok(wirkung('raeucherei').abendgaeste, 'Räucherei: Abendgäste');
  for (let st = 1; st <= 3; st++) assert.ok(wirkung('travellift', st).dienst, `Werft Stufe ${st}: Reparaturboote`);
  // Jeder Dienst hat einen Satz für die Bootskarte
  for (const s of SERVICES) for (const st of s.stufen) if (st.wirkung?.dienst) assert.ok(DIENST_TEXTE[s.id], s.id);
});

test('F5: Angebote an Land verdienen nach Auslastung, nicht mit festem Betrag', () => {
  for (const id of ['hafencafe', 'eisdiele', 'baecker', 'raeucherei', 'fahrradverleih']) {
    for (const st of ECONOMY.services[id].stufen) {
      assert.equal(st.wirkung.proTag, undefined, `${id} hat noch einen Festbetrag`);
      assert.ok(st.wirkung.kunden, `${id} ohne Kunden`);
    }
  }
  const z = neuerZustand();
  R.bauen(z, 'hafencafe', S6);
  const leer = R.tagesabschluss(z, { tag: 1, boote: [] }, () => 0.5).summe;
  const voll = R.tagesabschluss(z, { tag: 2, boote: boote(40) }, () => 0.5).summe;
  assert.equal(leer, 0, 'leerer Hafen, leeres Café');
  assert.ok(voll >= 40 * 0.5 * 5 - 5, `voller Hafen: ${voll}`);
  // Regen: weniger Kunden
  const regen = R.tagesabschluss(z, { tag: 3, wetter: 'regen', boote: boote(40) }, () => 0.5).summe;
  assert.ok(regen < voll && regen > 0, `Regen ${regen} gegen ${voll}`);
});

test('F2 Dienste: Ankunft verlängert den Aufenthalt, Abrechnung genau einmal am ersten Abend', () => {
  const z = neuerZustand();
  R.bauen(z, 'mastenkran', { stufe: 3, ruf: 3 });
  // Viele Segelboote: etwa der Anteil will den Mast legen
  let treffer = 0;
  for (let id = 1; id <= 2000; id++) if (R.dienstBeiAnkunft(z, { id, klasse: 'M', antrieb: 'segel', nights: 1 }, { tag: 4 })) treffer++;
  const p = wirkung('mastenkran').dienst.anteil;
  assert.ok(Math.abs(treffer / 2000 - p) < 0.04, `Anteil ${treffer / 2000} statt ${p}`);
  // Motorboote, Kurzhalter, Sondergäste und Fischer nie
  for (let id = 1; id <= 200; id++) {
    assert.equal(R.dienstBeiAnkunft(z, { id, klasse: 'M', antrieb: 'motor', nights: 1 }), null);
    assert.equal(R.dienstBeiAnkunft(z, { id, klasse: 'M', antrieb: 'segel', nights: 0 }), null);
    assert.equal(R.dienstBeiAnkunft(z, { id, klasse: 'M', antrieb: 'segel', nights: 1, special: true }), null);
    assert.equal(R.dienstBeiAnkunft(z, { id, klasse: 'M', antrieb: 'segel', nights: 1, stationed: true }), null);
  }
  // Fester Zufall: gleicher Spielstand, gleiche Reihe von Ankünften, gleiches Ergebnis. Die Spielregeln
  // vergeben die Boots-id erst nach dem Haken (id 0): die laufende Nummer sorgt trotzdem für Abwechslung.
  const reihe = (zz) => Array.from({ length: 50 }, () => !!R.dienstBeiAnkunft(zz, { id: 0, klasse: 'L', antrieb: 'segel', nights: 2 }, { tag: 9 }));
  const z1 = neuerZustand(), z2 = neuerZustand();
  R.bauen(z1, 'mastenkran', { stufe: 3, ruf: 3 }); R.bauen(z2, 'mastenkran', { stufe: 3, ruf: 3 });
  const folge = reihe(z1);
  assert.deepEqual(reihe(z2), folge);
  assert.ok(folge.some(Boolean) && !folge.every(Boolean), 'gemischt, nicht alle gleich');
  // Abrechnung: offen zahlt, bezahlt nicht mehr
  const boot = { id: 5, klasse: 'M', antrieb: 'segel', dienste: { mastenkran: 'offen' } };
  const r1 = R.tagesabschluss(z, { tag: 5, boote: [boot] }, () => 0.5);
  assert.equal(r1.dienstBezahlt.length, 1);
  assert.equal(r1.einnahmen.find((e) => e.id === 'mastenkran').betrag, wirkung('mastenkran').dienst.preis);
  assert.match(r1.einnahmen[0].text, /Mast gelegt/);
  const r2 = R.tagesabschluss(z, { tag: 6, boote: [{ ...boot, dienste: { mastenkran: 'bezahlt' } }] }, () => 0.5);
  assert.equal(r2.dienstBezahlt.length, 0);
  // Dienst eines inzwischen abgerissenen Service: nichts
  const leer = neuerZustand();
  assert.equal(R.tagesabschluss(leer, { tag: 5, boote: [boot] }).summe, 0);
});

test('F2 Fahrradverleih: nur bei kurzen Aufenthalten und gutem Wetter', () => {
  const z = neuerZustand();
  R.bauen(z, 'fahrradverleih', { stufe: 3, ruf: 3 });
  const zaehle = (nights, wetter) => {
    let n = 0;
    for (let id = 1; id <= 1000; id++) if (R.dienstBeiAnkunft(z, { id, klasse: 'S', antrieb: 'motor', nights }, { tag: 2, wetter })) n++;
    return n;
  };
  assert.ok(zaehle(1, 'sonne') > 100);
  assert.equal(zaehle(3, 'sonne'), 0, 'lange Aufenthalte hängen keine Radtour an');
  assert.ok(zaehle(1, 'regen') < zaehle(1, 'sonne') / 2);
  assert.equal(zaehle(1, 'sturm'), 0);
});

test('F2 Slip und Räucherei: feste Zahl je Tag, abends abgerechnet, im Winter nichts', () => {
  const z = neuerZustand();
  R.bauen(z, 'slip', { stufe: 2, ruf: 3 });
  R.bauen(z, 'raeucherei', { stufe: 2, ruf: 3 });
  for (let tag = 1; tag <= 20; tag++) {
    const n = R.mengeHeute(z, 'slip', 'trailer', tag, 'sonne');
    assert.equal(n, R.mengeHeute(z, 'slip', 'trailer', tag, 'sonne'), 'gleicher Tag, gleiche Zahl');
    const r = R.tagesabschluss(z, { tag, wetter: 'sonne', boote: [] }, () => 0.99);
    assert.equal(r.mengen.slip?.trailer ?? 0, n, `Tag ${tag}`);
    assert.equal(r.einnahmen.find((e) => e.id === 'slip')?.betrag ?? 0, n * wirkung('slip').trailer.preis);
    const g = R.mengeHeute(z, 'raeucherei', 'abendgaeste', tag, 'sonne');
    assert.equal(r.mengen.raeucherei?.abendgaeste ?? 0, g);
  }
  assert.equal(R.mengeHeute(z, 'slip', 'trailer', 3, 'sturm'), 0);
  assert.equal(R.tagesabschluss(z, { tag: 30, winter: true, boote: [] }).summe, 0);
});

test('F7: Tagesgäste großer Schiffe lassen Geld bei Café, Eisdiele und Fischhalle', () => {
  assert.ok(TAGESGAESTE_BESUCHE.includes('kreuzfahrt'));
  assert.ok(!TAGESGAESTE_BESUCHE.includes('ausflugsfahrt'), 'die tägliche Ausflugsfahrt zählt nicht');
  const mit = neuerZustand(), ohne = neuerZustand();
  for (const z of [mit, ohne]) {
    R.bauen(z, 'raeucherei', S6); R.bauen(z, 'fischhalle', S6); R.bauen(z, 'hafencafe', S6);
  }
  R.bauen(mit, 'fahrgastanleger', { ...S6, tag: 1 });
  R.bauen(mit, 'kreuzfahrtterminal', { ...S6, tag: 1 });
  const tagBesuch = mit.besuche.kreuzfahrtterminal;
  const a = R.tagesabschluss(mit, { tag: tagBesuch, boote: [] }, () => 0.5);
  const b = R.tagesabschluss(ohne, { tag: tagBesuch, boote: [] }, () => 0.5);
  assert.ok(a.tagesgaeste > 0);
  for (const id of ['fischhalle', 'hafencafe']) {
    const x = a.einnahmen.find((e) => e.id === id)?.betrag ?? 0;
    const y = b.einnahmen.find((e) => e.id === id)?.betrag ?? 0;
    assert.ok(x > y, `${id}: ${x} mit Kreuzfahrtschiff, ${y} ohne`);
    assert.match(a.einnahmen.find((e) => e.id === id).text, /Tagesgäste/);
  }
});

test('F3: Wahlplätze, nur eine Option, Umbau statt Sperre', () => {
  assert.ok(WAHLPLAETZE.length >= 3 && WAHLPLAETZE.length <= 4);
  for (const w of WAHLPLAETZE) {
    assert.equal(w.optionen.length, 2, w.id);
    for (const o of w.optionen) assert.ok(SERVICE_BY_ID[o.id]?.stufen[o.stufe - 1], `${w.id}: ${o.id} Stufe ${o.stufe}`);
  }
  const z = neuerZustand();
  assert.equal(R.bauen(z, 'hafencafe', S6).ok, true);
  const p = R.pruefe(z, 'eisdiele', S6);
  assert.equal(p.freigeschaltet, true);
  assert.equal(p.umbau.id, 'hafencafe');
  assert.equal(p.umbau.auf, 0);
  R.bauen(z, 'eisdiele', S6);
  assert.equal(z.gebaut.hafencafe, undefined, 'Café weicht der Eisdiele');
  assert.equal(z.gebaut.eisdiele, 1);
  // Wunsch geteilt: wer ein Café wünscht, ist mit der Eisdiele zufrieden
  assert.ok(R.effekte(z).angebote.hafencafe);
  // Halle: Travellift bis Stufe 2 bleibt, nur die große Halle ist die Wahl
  const h = neuerZustand();
  R.bauen(h, 'mastenkran', S6);
  R.bauen(h, 'travellift', S6); R.bauen(h, 'travellift', S6);
  R.bauen(h, 'winterlager', S6);
  assert.equal(R.pruefe(h, 'travellift', S6).umbau, undefined, 'Winterlager Stufe 1 belegt den Hallenplatz nicht');
  R.bauen(h, 'travellift', S6);
  const q = R.pruefe(h, 'winterlager', S6);
  assert.equal(q.umbau.id, 'travellift');
  assert.equal(q.umbau.auf, 2);
  R.bauen(h, 'winterlager', S6);
  assert.equal(h.gebaut.travellift, 2, 'Werfthalle zurück zum Travellift');
  assert.equal(h.gebaut.winterlager, 2);
  // Großhafen: Besuchsplan des zurückgebauten Anlegers bleibt (Stufe 1 hat auch Besuche)
  const g = neuerZustand();
  R.bauen(g, 'fahrgastanleger', S6); R.bauen(g, 'seenotretter', S6);
  R.bauen(g, 'kreuzfahrtterminal', { ...S6, tag: 1 }); R.bauen(g, 'kreuzfahrtterminal', { ...S6, tag: 1 });
  R.bauen(g, 'marineanleger', { ...S6, tag: 1 });
  assert.equal(R.pruefe(g, 'marineanleger', S6).umbau.id, 'kreuzfahrtterminal');
  R.bauen(g, 'marineanleger', { ...S6, tag: 2 });
  assert.equal(g.gebaut.kreuzfahrtterminal, 1);
  assert.ok(g.besuche.kreuzfahrtterminal != null);
});

test('F9: Bilanz mit bezahlt, verdient und Tagen bis bezahlt; Schätzung für den nächsten Bau', () => {
  const z = neuerZustand();
  R.bauen(z, 'hafencafe', S6);
  let b = R.bilanz(z, 'hafencafe');
  assert.equal(b.bezahlt, ECONOMY.services.hafencafe.stufen[0].kosten);
  assert.equal(b.verdient, 0);
  assert.equal(b.tage, null);
  for (let tag = 1; tag <= 3; tag++) R.tagesabschluss(z, { tag, boote: boote(20) }, () => 0.5);
  b = R.bilanz(z, 'hafencafe');
  assert.ok(b.verdient > 0 && b.proTag > 0);
  assert.equal(b.tage, b.verdient >= b.bezahlt ? 0 : Math.ceil((b.bezahlt - b.verdient) / (b.verdient / 3)));
  // Alter Spielstand ohne bezahlt: aus dem Katalog
  const alt = { gebaut: { segelclub: 2 }, besuche: {}, summe: {} };
  assert.equal(R.bilanz(alt, 'segelclub').bezahlt, ECONOMY.services.segelclub.stufen[0].kosten + ECONOMY.services.segelclub.stufen[1].kosten);
  // Schätzung: Café-Ausbau mit 20 Crews bringt etwas, Mastenkran mit Seglern unter den Ankünften auch
  const s = R.schaetzung(z, 'hafencafe', { boote: boote(20), ankuenfte: [] });
  assert.ok(s.proTag > 0 && s.tage > 0);
  const k = R.schaetzung(neuerZustand(), 'mastenkran', { boote: [], ankuenfte: boote(10) });
  assert.ok(k.proTag > 0);
  assert.equal(R.schaetzung(z, 'hafencafe', null), null);
});
