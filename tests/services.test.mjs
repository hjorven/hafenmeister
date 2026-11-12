// Tests fuer die Services-Regeln. Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, SERVICE_BY_ID, RUF_BONUS_MAX } from '../web/js/data/services.js';
import { erstelleRegeln, neuerZustand, mitZahlen } from '../web/js/services/rules.js';

const R = erstelleRegeln();
const boote = (n, klasse = 'M', antrieb = 'segel') => Array.from({ length: n }, () => ({ klasse, antrieb }));

test('Katalog ist vollstaendig und eindeutig', () => {
  const ids = new Set();
  for (const s of SERVICES) {
    assert.ok(!ids.has(s.id), `doppelte id ${s.id}`);
    ids.add(s.id);
    assert.ok(s.abStufe >= 1 && s.abStufe <= 6, s.id);
    assert.ok(s.stufen.length >= 1, s.id);
    assert.ok(Number.isFinite(s.lage.x) && Number.isFinite(s.lage.y), s.id);
    for (const st of s.stufen) {
      assert.ok(st.kosten > 0, `${s.id} kosten`);
      for (const b of st.braucht ?? []) assert.ok(SERVICE_BY_ID[b.id], `${s.id} braucht ${b.id}`);
      for (const syn of st.wirkung?.synergie ?? []) assert.ok(SERVICE_BY_ID[syn.id], `${s.id} synergie ${syn.id}`);
    }
  }
});

test('Freischalten nach Hafenstufe, Ruf, Voraussetzung und Geld', () => {
  const z = neuerZustand();
  assert.equal(R.pruefe(z, 'travellift', { stufe: 3, ruf: 5, geld: 1e6 }).ok, false);
  const ohneKran = R.pruefe(z, 'travellift', { stufe: 4, ruf: 5, geld: 1e6 });
  assert.equal(ohneKran.ok, false);
  assert.match(ohneKran.fehlt.join(), /Mastenkran/);
  assert.equal(R.bauen(z, 'mastenkran', { stufe: 4, ruf: 3, geld: 1e6 }).ok, true);
  assert.equal(R.pruefe(z, 'travellift', { stufe: 4, ruf: 3, geld: 10 }).geldFehlt, true);
  const ok = R.bauen(z, 'travellift', { stufe: 4, ruf: 3, geld: 1e6 });
  assert.equal(ok.ok, true);
  assert.equal(ok.kosten, 6000);
  assert.equal(z.gebaut.travellift, 1);
  assert.equal(R.pruefe(z, 'kreuzfahrtterminal', { stufe: 5, ruf: 5, geld: 1e9 }).ok, false);
});

test('Voll ausgebaut', () => {
  const z = neuerZustand();
  R.bauen(z, 'mastenkran', { stufe: 6, ruf: 5 });
  assert.equal(R.pruefe(z, 'mastenkran', { stufe: 6, ruf: 5 }).fertig, true);
});

test('Liste zeigt nur Services der erreichten Hafenstufe', () => {
  const ids = R.liste(neuerZustand(), { stufe: 1 }).map((x) => x.id);
  assert.deepEqual(ids, ['bootsverleih', 'baecker']);
  assert.ok(R.liste(neuerZustand(), { stufe: 6 }).length === SERVICES.length);
});

test('Einnahmen: Tagesgeschaeft mit Wetter, Kunden mit Filter, keine laufenden Kosten', () => {
  const z = neuerZustand();
  R.bauen(z, 'bootsverleih', { stufe: 1 });
  R.bauen(z, 'mastenkran', { stufe: 3, ruf: 3 });
  const sonne = R.tagesabschluss(z, { tag: 1, wetter: 'sonne', boote: [...boote(10), ...boote(10, 'M', 'motor')] }, () => 0.99);
  const verleih = sonne.einnahmen.find((e) => e.id === 'bootsverleih');
  assert.equal(verleih.betrag, 14);
  // 10 Segelboote x 0,08 = 0,8 Kunden, mit rng 0,99 abgerundet auf 0
  assert.equal(sonne.einnahmen.find((e) => e.id === 'mastenkran'), undefined);
  const mitKunde = R.tagesabschluss(z, { tag: 2, wetter: 'sonne', boote: boote(10) }, () => 0.1);
  assert.equal(mitKunde.einnahmen.find((e) => e.id === 'mastenkran').betrag, 35);
  const sturm = R.tagesabschluss(z, { tag: 3, wetter: 'sturm', boote: [] }, () => 0.5);
  assert.equal(sturm.einnahmen.length, 0);
  assert.equal(sturm.summe, 0);
});

test('Synergie: Segelmacher verdient mehr mit Mastenkran', () => {
  const z = neuerZustand();
  R.bauen(z, 'segelclub', { stufe: 4, ruf: 3 });
  R.bauen(z, 'segelmacher', { stufe: 4, ruf: 3 });
  const ohne = R.tagesabschluss(z, { tag: 1, boote: boote(100) }, () => 0).einnahmen.find((e) => e.id === 'segelmacher').betrag;
  R.bauen(z, 'mastenkran', { stufe: 4, ruf: 3 });
  const mit = R.tagesabschluss(z, { tag: 2, boote: boote(100) }, () => 0).einnahmen.find((e) => e.id === 'segelmacher').betrag;
  assert.equal(ohne, 7 * 90);
  assert.equal(mit, Math.round(7 * 90 * 1.2));
});

test('Winter: nur Werft und Winterlager verdienen', () => {
  const z = neuerZustand();
  const k = { stufe: 4, ruf: 4 };
  R.bauen(z, 'bootsverleih', k);
  R.bauen(z, 'mastenkran', k);
  R.bauen(z, 'travellift', k);
  R.bauen(z, 'travellift', k);
  R.bauen(z, 'winterlager', k);
  const r = R.tagesabschluss(z, { tag: 31, winter: true, boote: [] }, () => 0);
  assert.deepEqual(r.einnahmen.map((e) => e.id).sort(), ['travellift', 'winterlager']);
});

test('Kreuzfahrtschiff kommt regelmaessig, wird angekuendigt und weicht dem Sturm aus', () => {
  const z = neuerZustand();
  const k = { stufe: 6, ruf: 5, tag: 10 };
  R.bauen(z, 'fahrgastanleger', k);
  R.bauen(z, 'kreuzfahrtterminal', k);
  assert.equal(z.besuche.kreuzfahrtterminal, 13);
  const vorher = R.tagesabschluss(z, { tag: 12, boote: [] }, () => 0);
  assert.ok(vorher.angekuendigt.some((a) => a.id === 'kreuzfahrtterminal' && a.tag === 13));
  const sturm = R.tagesabschluss(z, { tag: 13, wetter: 'sturm', boote: [] }, () => 0);
  assert.equal(sturm.besuche.filter((b) => b.art === 'kreuzfahrt').length, 0);
  const da = R.tagesabschluss(z, { tag: 14, boote: [] }, () => 0);
  const b = da.besuche.find((x) => x.art === 'kreuzfahrt');
  assert.equal(b.einnahme, 6500);
  assert.equal(z.besuche.kreuzfahrtterminal, 21);
  assert.equal(z.anzahl.kreuzfahrt, 1);            // Zähler für das Stufenziel, Sturmtag zählt nicht
  assert.equal(R.naechsteBesuche(z, 14).find((x) => x.id === 'kreuzfahrtterminal').inTagen, 7);
});

test('Effekte: Ruf gedeckelt, Gaeste multipliziert, Freischaltungen', () => {
  const z = neuerZustand();
  for (const s of SERVICES) z.gebaut[s.id] = s.stufen.length;
  const e = R.effekte(z);
  assert.equal(e.ruf, RUF_BONUS_MAX);
  assert.ok(e.sturmschutz <= 0.8);
  assert.ok(e.gaeste.M > 1);
  for (const f of ['kreuzfahrtschiff', 'marine', 'traditionssegler', 'regatta']) assert.ok(e.freischalten.includes(f), f);
  assert.ok(e.hafengeld.segel > 1);
});

test('Zahlen aus dem Balancing ueberschreiben Startwerte', () => {
  const R2 = erstelleRegeln(mitZahlen(SERVICES, { bootsverleih: { stufen: [{ kosten: 99, wirkung: { proTag: 50 } }] } }));
  const s = R2.byId.bootsverleih.stufen[0];
  assert.equal(s.kosten, 99);
  assert.equal(s.wirkung.proTag, 50);
  assert.equal(s.wirkung.wetter.regen, 0.3);
  assert.equal(SERVICE_BY_ID.bootsverleih.stufen[0].kosten, 120);
});

test('Zustand bleibt JSON', () => {
  const z = neuerZustand();
  R.bauen(z, 'bootsverleih', { stufe: 1, tag: 1 });
  R.tagesabschluss(z, { tag: 1, boote: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(z)), z);
});

test('Angebote an Land: Bäcker ab Stufe 1, Café ab 2, Eisdiele erst ab 4', () => {
  const ids = (stufe) => R.liste(neuerZustand(), { stufe }).map((x) => x.id);
  assert.ok(ids(1).includes('baecker'));
  assert.ok(!ids(1).includes('hafencafe'));
  assert.ok(ids(2).includes('hafencafe') && ids(2).includes('grillplatz'));
  assert.ok(!ids(3).includes('eisdiele') && ids(3).includes('fahrradverleih'));
  assert.ok(ids(4).includes('eisdiele'));
  // Eisdiele verdient bei Regen weniger als bei Sonne
  const z = neuerZustand();
  R.bauen(z, 'eisdiele', { stufe: 4, ruf: 5, tag: 1 });
  const boote = Array.from({ length: 20 }, () => ({ klasse: 'M', antrieb: 'segel' }));
  const sonne = R.tagesabschluss(z, { tag: 2, wetter: 'sonne', boote }, () => 0).summe;
  const regen = R.tagesabschluss(z, { tag: 3, wetter: 'regen', boote }, () => 0).summe;
  assert.ok(sonne > regen, `${sonne} > ${regen}`);
});

test('Windjammertreffen: dritte Stufe des Museumshafens erst in Stufe 6, Besuch alle 12 Tage für zwei Tage', () => {
  const z = neuerZustand();
  const k5 = { stufe: 5, ruf: 5, tag: 1, geld: 1e9 };
  R.bauen(z, 'museumshafen', k5);
  R.bauen(z, 'museumshafen', k5);
  assert.equal(z.gebaut.museumshafen, 2);
  assert.equal(R.pruefe(z, 'museumshafen', k5).ok, false);              // Treffen erst ab Hafenstufe 6
  const k6 = { stufe: 6, ruf: 5, tag: 10, geld: 1e9 };
  assert.equal(R.bauen(z, 'museumshafen', k6).ok, true);
  assert.equal(z.besuche.museumshafen, 14);
  const r = R.tagesabschluss(z, { tag: 14, boote: [] }, () => 0);
  const b = r.besuche.find((x) => x.art === 'windjammer');
  assert.equal(b.dauer, 2);
  assert.equal(z.besuche.museumshafen, 26);
  assert.ok(R.effekte(z).freischalten.includes('traditionssegler'));
});

test('Barkasse: ab Stufe 6, braucht den Fahrgastanleger, verdient nicht bei Sturm', () => {
  const z = neuerZustand();
  const k = { stufe: 6, ruf: 5, tag: 1, geld: 1e9 };
  assert.equal(R.liste(z, { stufe: 5 }).some((x) => x.id === 'barkasse'), false);
  const ohne = R.pruefe(z, 'barkasse', k);
  assert.equal(ohne.ok, false);
  assert.match(ohne.fehlt.join(), /Fahrgastanleger/);
  R.bauen(z, 'fahrgastanleger', k);
  assert.equal(R.bauen(z, 'barkasse', k).ok, true);
  const sonne = R.tagesabschluss(z, { tag: 2, boote: [] }, () => 0).einnahmen.find((e) => e.id === 'barkasse');
  assert.equal(sonne.betrag, 220);
  const sturm = R.tagesabschluss(z, { tag: 3, wetter: 'sturm', boote: [] }, () => 0).einnahmen.find((e) => e.id === 'barkasse');
  assert.equal(sturm, undefined);
});

test('Liste der Großschiffbesuche fürs Abschlussziel passt zum Katalog', async () => {
  const { GROSSSCHIFF_BESUCHE } = await import('../web/js/data/services.js');
  const arten = new Set(SERVICES.flatMap((s) => s.stufen.map((st) => st.wirkung?.besuch?.art).filter(Boolean)));
  for (const a of GROSSSCHIFF_BESUCHE) assert.ok(arten.has(a), `Besuchsart ${a} gibt es nicht`);
  assert.ok(!GROSSSCHIFF_BESUCHE.includes('windjammer'));
  // Der Marinestützpunkt bringt mehr zählende Besuche als der Anleger (Roadmap Svc F6)
  const [anleger, stuetzpunkt] = SERVICE_BY_ID.marineanleger.stufen.map((st) => st.wirkung.besuch);
  assert.ok(GROSSSCHIFF_BESUCHE.includes(stuetzpunkt.art));
  assert.ok(stuetzpunkt.alleTage < anleger.alleTage);
});
