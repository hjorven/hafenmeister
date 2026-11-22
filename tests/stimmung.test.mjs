// Paket P46 (docs/stimmung.md): ruhiger Abend (F29) und Serien-Akkord (F30), Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abendStand, ruhigerAbend, serieZaehlen, stimmungState, SERIE_LAENGE } from '../web/js/features/stimmung-regeln.js';
import { audio, SOUNDS } from '../web/js/audio/audio.js';

const boot = (id, x = {}) => ({ id, status: 'moored', paid: true, pendingFee: 0, ...x });
const hafen = (boote, x = {}) => ({ phase: 'evening', day: 4, queue: [], boats: Object.fromEntries(boote.map((b) => [b.id, b])), ...x });

test('ruhiger Abend: alles bezahlt, niemand wartet', () => {
  assert.equal(ruhigerAbend(hafen([boot(1), boot(2)])), true);
});

test('nur am Abend, nicht tagsüber', () => {
  assert.equal(ruhigerAbend(hafen([boot(1)], { phase: 'day' })), false);
  assert.equal(abendStand(hafen([boot(1)], { phase: 'day' })).abend, false);
});

test('leerer Hafen ist kein ruhiger Abend', () => {
  assert.equal(ruhigerAbend(hafen([])), false);
  // nur fest vergebene Plätze (Fischer, Dauerlieger) zählen nicht als Gäste
  assert.equal(ruhigerAbend(hafen([boot(1, { stationed: true })])), false);
});

test('offenes Liegegeld hält den ruhigen Abend auf', () => {
  const s = hafen([boot(1), boot(2, { pendingFee: 24 })]);
  assert.deepEqual({ ruhig: abendStand(s).ruhig, offen: abendStand(s).offen }, { ruhig: false, offen: 1 });
  assert.equal(ruhigerAbend(hafen([boot(1), boot(2, { paid: false })])), false);
  // Fischer mit Pacht zählen nicht, auch wenn sie nichts Offenes haben
  assert.equal(ruhigerAbend(hafen([boot(1), boot(2, { stationed: true, paid: false })])), true);
});

test('wartende Boote: nur wenn für sie eine Box frei ist', () => {
  const s = hafen([boot(1), { id: 9, status: 'waiting' }], { queue: [9] });
  assert.equal(ruhigerAbend(s), false);                       // ohne Angabe zählt jedes wartende Boot
  assert.equal(ruhigerAbend(s, () => true), false);           // es gäbe einen Platz
  assert.equal(ruhigerAbend(s, () => false), true);           // Hafen voll: bleibt über Nacht an der Boje
  assert.equal(abendStand(s, (id) => id !== 9).warten, 0);
  // Ids in der Warteschlange ohne wartendes Boot zählen nicht
  assert.equal(ruhigerAbend(hafen([boot(1)], { queue: [77] })), true);
});

test('ohne Spielstand kein Fehler', () => {
  assert.equal(ruhigerAbend(null), false);
  assert.equal(ruhigerAbend({}), false);
});

test('Serie: drei passgenaue Zuweisungen ergeben einen Akkord', () => {
  const m = {};
  const e = (x = {}) => ({ type: 'moored', hand: true, passgenau: true, boatId: 1, ...x });
  assert.equal(serieZaehlen(m, e()), 1);
  assert.equal(serieZaehlen(m, e()), 2);
  assert.equal(serieZaehlen(m, e()), SERIE_LAENGE);
  assert.equal(m.serie, 0);
  assert.equal(m.akkorde, 1);
  assert.equal(serieZaehlen(m, e()), 1);   // die nächste Serie beginnt
});

test('Serie: nicht passgenau fängt neu an, fremde Zuweisungen zählen nicht', () => {
  const m = {};
  serieZaehlen(m, { type: 'moored', hand: true, passgenau: true });
  serieZaehlen(m, { type: 'moored', hand: true, passgenau: true });
  // Büro, "Einfahren lassen" (hand: false) und Selbst-Einfahren ändern nichts
  assert.equal(serieZaehlen(m, { type: 'moored', hand: false, passgenau: true }), null);
  assert.equal(serieZaehlen(m, { type: 'moored', passgenau: false }), null);
  assert.equal(serieZaehlen(m, { type: 'relocated', grund: 'sturm', passgenau: true }), null);
  assert.equal(serieZaehlen(m, { type: 'departed' }), null);
  assert.equal(m.serie, 2);
  // selbst gezogen, aber zu große Box: leise von vorn
  assert.equal(serieZaehlen(m, { type: 'moored', hand: true }), 0);
  assert.equal(m.serie, 0);
  assert.equal(m.akkorde ?? 0, 0);
});

test('Serie: selbst umlegen zählt wie zuweisen', () => {
  const m = {};
  assert.equal(serieZaehlen(m, { type: 'relocated', grund: 'hand', passgenau: true }), 1);
  assert.equal(serieZaehlen(m, { type: 'moored', hand: true, passgenau: true }), 2);
  assert.equal(serieZaehlen(m, { type: 'relocated', grund: 'hand', passgenau: true }), 3);
  assert.equal(m.akkorde, 1);
});

test('Serie: kaputter Spielstand wird geheilt', () => {
  const s = { modules: { stimmung: { serie: 7, akkorde: -2, ruhigeAbende: 'x' } } };
  const m = stimmungState(s);
  assert.deepEqual([m.serie, m.akkorde, m.ruhigeAbende], [0, 0, 0]);
  assert.equal(serieZaehlen(m, { type: 'moored', hand: true, passgenau: true }), 1);
  const leer = {};
  assert.equal(stimmungState(leer).serie, 0);
  assert.ok(leer.modules.stimmung);
});

test('Ton: neue Klänge sind da, ruhige Musik schaltet nur abends um', () => {
  for (const n of ['serie', 'abendruhe', 'stammgast', 'stufenziel']) {
    assert.ok(SOUNDS[n], n);
    assert.equal(typeof audio._sfx[n], 'function', n);
  }
  audio.setWeather('ruhig');
  audio.setFest(false);
  audio.setPhase('tag');
  audio.setRuhig(true);
  assert.equal(audio._musProg().padCut, undefined);   // tagsüber bleibt die Tagesmusik
  audio.setPhase('abend');
  assert.equal(audio._musProg().padCut, 650);         // abends warm
  audio.setWeather('sturm');
  assert.notEqual(audio._musProg().padCut, 650);      // Sturm geht vor
  audio.setWeather('ruhig');
  audio.setRuhig(false);
  assert.notEqual(audio._musProg().padCut, 650);
  // Grundton der Serie liegt eine Lage über der Melodie, auch ohne laufende Musik
  const [root, q] = audio._serieAkkord();
  assert.ok(root >= 74 && root <= 85, String(root));
  assert.ok(Array.isArray(q) && q.length >= 3);
});
