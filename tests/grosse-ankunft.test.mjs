// P47 "Große Ankünfte ankündigen" (docs/grosse-ankuenfte.md): reine Regeln aus features/grosse-ankunft.js.
// Wann die Kamera von selbst fahren darf, welche Breite sie zeigt, Texte und Hörner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grundGegenKamera, zielBreite, imBereich, besucherText, DIENST_ARTEN, BESUCHER_HORN,
  IDLE_S, ABSTAND_S, WICHTIG_AB,
} from '../web/js/features/grosse-ankunft.js';
import { AUFTRITTE } from '../web/js/data/besuchswege.js';
import { SCHIFF_TEXTE } from '../web/js/data/besucher.js';
import { VORRANG } from '../web/js/ui/meldungen.js';
import { WAHLEN } from '../web/js/ui/einstellungen.js';

const ruhig = {
  wahl: 'kamera', versteckt: false, pause: false, gedrueckt: false, ruhe: IDLE_S + 1, bauen: false, karte: false,
  foto: false, schauen: false, einstieg: false, gewaehlt: false, fliegt: false, seitLetzter: null, vorrang: -Infinity,
};

test('Kamera fährt nur, wenn der Spieler nichts tut', () => {
  assert.equal(grundGegenKamera(ruhig), null);
  const faelle = {
    einstellung: { wahl: 'horn' }, versteckt: { versteckt: true }, pause: { pause: true }, beruehrt: { gedrueckt: true },
    beschaeftigt: { ruhe: IDLE_S - 0.1 }, bauen: { bauen: true }, karte: { karte: true }, foto: { foto: true },
    einstieg: { einstieg: true }, gewaehlt: { gewaehlt: true }, fliegt: { fliegt: true },
    abstand: { seitLetzter: ABSTAND_S - 1 }, meldung: { vorrang: WICHTIG_AB },
  };
  for (const [grund, aenderung] of Object.entries(faelle)) {
    assert.equal(grundGegenKamera({ ...ruhig, ...aenderung }), grund, grund);
  }
  assert.equal(grundGegenKamera({ ...ruhig, wahl: 'aus' }), 'einstellung');
  // Hafen schauen (Fotomodus mit Rundflug): dort darf sie
  assert.equal(grundGegenKamera({ ...ruhig, foto: true, schauen: true }), null);
  // Nach einer Minute wieder, kurze Meldungen (Erfolg, Post) halten sie nicht auf
  assert.equal(grundGegenKamera({ ...ruhig, seitLetzter: ABSTAND_S }), null);
  assert.equal(grundGegenKamera({ ...ruhig, vorrang: VORRANG.erfolg }), null);
  // Wichtige Meldungen halten sie auf: Notruf, Tagesabschluss, Feier
  for (const v of [VORRANG.havarie, VORRANG.abschluss, VORRANG.feier, VORRANG.ereignis]) assert.equal(grundGegenKamera({ ...ruhig, vorrang: v }), 'meldung');
});

test('Breite der Kamerafahrt: Schiff mit Wasser drumherum, nie kleiner als 110 m', () => {
  assert.equal(zielBreite(180), 540);
  assert.equal(zielBreite(37), 111);
  assert.equal(zielBreite(12), 110);
  assert.equal(zielBreite(180, 15, 420), 420);
  assert.equal(zielBreite(undefined), 110);
});

test('Spielbereich: drin, draußen, ohne Rechteck immer', () => {
  const r = { minX: -100, maxX: 100, minZ: -50, maxZ: 50 };
  assert.equal(imBereich({ x: 0, z: 0 }, r), true);
  assert.equal(imBereich({ x: -101, z: 0 }, r), false);
  assert.equal(imBereich({ x: -101, z: 0 }, r, 5), true);
  assert.equal(imBereich(null, r), false);
  assert.equal(imBereich({ x: 9999, z: 0 }, null), true);
});

test('Jeder große Besuch hat Text und Horn, das Ausflugsschiff nicht', () => {
  const arten = new Set(Object.values(AUFTRITTE).filter((a) => !a.jedenTag).map((a) => a.art));
  for (const art of arten) {
    const d = DIENST_ARTEN[art];
    assert.ok(d, art);
    assert.ok(d.titel.endsWith('ein'), d.titel);
    assert.ok(['L', 'XL', 'XXL'].includes(d.horn.groesse));
  }
  assert.equal(DIENST_ARTEN.ausflugsfahrt, undefined);
  for (const art of Object.keys(SCHIFF_TEXTE)) {
    assert.ok(BESUCHER_HORN[art], art);
    const t = besucherText(art, 'Nordstern');
    assert.match(t.titel, /^(Der|Die) .+ „Nordstern“ läuft ein$/);
    assert.ok(t.satz.length > 10);
  }
  assert.equal(besucherText('koenigsyacht', null, 'K02').satz, 'Sie fährt zum Ehrenplatz K02.');
  assert.equal(besucherText('weltumsegler', null, 'A1').satz, 'Er fährt zum Ehrenplatz A1.');
  assert.equal(besucherText('schwaene'), null);
});

test('Einstellung und Meldeplatz kennen die großen Ankünfte', () => {
  const w = WAHLEN.find((x) => x.name === 'ankuenfte');
  assert.ok(w);
  assert.deepEqual(w.stufen.map(([id]) => id), ['kamera', 'horn', 'aus']);
  assert.ok(VORRANG.ankunft > VORRANG.einstieg && VORRANG.ankunft < VORRANG.ankuendigung);
  assert.ok(VORRANG.ankunft < WICHTIG_AB);
});
