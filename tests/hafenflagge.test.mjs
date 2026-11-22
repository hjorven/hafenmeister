// P44 Hafenname und eigene Flagge: Namen säubern (Audit C05), Flagge prüfen, Speichern und Umbau alter Stände.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAME_MAX, hafenNameSauber, zeichenKuerzen, FLAGGE_B, FLAGGE_H, FLAGGEN_MUSTER, FLAGGEN_FARBEN, FLAGGEN_ZEICHEN,
  flaggeAusSeed, flaggeSauber, flaggenPixel, flaggeBeschreibung, gleicheFlagge, passendeZeichenFarbe,
} from '../web/js/data/hafenflagge.js';
import { createState, deserialize } from '../web/js/state.js';
import { unwrap, wrap, SAVE_VERSION } from '../web/js/save/storage.js';
import { nameSauber } from '../web/js/save/plaetze.js';

// Präparierte Namen: HTML, Script, Attribute, Steuerzeichen, Richtungszeichen, lange Namen, Emoji
const BOESE = [
  '<img src=x onerror=alert(1)>',
  '<script>alert("x")</script>Hafen',
  '"><svg onload=alert(1)>',
  "'; DROP TABLE plaetze; --",
  'javascript:alert(1)',
  '&lt;b&gt;fett&lt;/b&gt;',
  'Hafen\u0000\u0007\u001b[31mrot',
  'Hafen‮egasseb‬',       // Rechts-nach-links-Umschaltung
  'Null​breite﻿Zeichen',  // unsichtbare Zeichen
  '\uD800kaputt',                   // einzelnes Surrogat
  'Möwenhafen 🚢⚓',
  'x'.repeat(5000),
  '😀'.repeat(40),
  '   ',
  '\n\t\r',
  '{{constructor.constructor("alert(1)")()}}',
  '${alert(1)}',
  '__proto__',
];

test('Hafenname: präparierte Namen werden zu reinem Text ohne gefährliche Zeichen', () => {
  for (const roh of BOESE) {
    const n = hafenNameSauber(roh);
    assert.equal(typeof n, 'string');
    assert.ok(n.length > 0, `leer: ${JSON.stringify(roh)}`);
    assert.ok(Array.from(n).length <= NAME_MAX, `zu lang: ${JSON.stringify(roh)}`);
    assert.doesNotMatch(n, /[<>"`{}$=;\\]/, `verbotenes Zeichen in ${JSON.stringify(n)}`);
    assert.doesNotMatch(n, /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/u, `Steuerzeichen in ${JSON.stringify(n)}`);
    assert.doesNotMatch(n, /[\uD800-\uDFFF]/u, `Surrogat in ${JSON.stringify(n)}`);
    assert.equal(n, n.trim());
    assert.doesNotMatch(n, / {2}/);
  }
  assert.equal(hafenNameSauber('<img src=x onerror=alert(1)>'), 'img srcx onerroralert(1)');
  assert.equal(hafenNameSauber('Möwenhafen 🚢⚓'), 'Möwenhafen');
  assert.equal(hafenNameSauber('Hafen‮egasseb‬'), 'Hafenegasseb');
  assert.equal(hafenNameSauber('   '), 'Mein Hafen');
  assert.equal(hafenNameSauber('😀😀', ''), '');
});

test('Hafenname: normale Namen bleiben, wie sie sind', () => {
  for (const n of ['Möwenhafen', 'Hafen Großenbrode Süd', 'Sankt Peter-Ording', "Peter's Hafen", 'Kiel 2', 'Ærøskøbing', 'Łeba', 'Świnoujście', 'Hafen & Co.', 'Strandkorb (Nord)', 'Ä Ö Ü ß']) {
    assert.equal(hafenNameSauber(n), n);
  }
  // Leerraum zusammengefasst, Unicode-Normalform NFC (a + Trema wird ä)
  assert.equal(hafenNameSauber('  Haff   wiek  '), 'Haff wiek');
  assert.equal(hafenNameSauber('Häfen'), 'Häfen');
  assert.equal(hafenNameSauber('Hafen am Meer'), 'Hafen am Meer');
});

test('Hafenname: Länge nach Zeichen, nie mitten durch ein Zeichen', () => {
  assert.equal(Array.from(hafenNameSauber('ä'.repeat(100))).length, NAME_MAX);
  assert.equal(zeichenKuerzen('𝔄'.repeat(40), 5), '𝔄'.repeat(5));
  const lang = hafenNameSauber('𝔄'.repeat(40));   // Buchstabe außerhalb der Grundebene (zwei UTF-16-Einheiten)
  assert.equal(Array.from(lang).length, NAME_MAX);
  assert.doesNotMatch(lang, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
  // Kein Leerzeichen am Ende nach dem Kürzen
  assert.equal(hafenNameSauber(`${'a'.repeat(31)} b`), 'a'.repeat(31));
});

test('Speicherplätze nutzen dieselbe Säuberung', () => {
  for (const roh of BOESE) assert.equal(nameSauber(roh), hafenNameSauber(roh));
  assert.equal(nameSauber('', 'Ersatz'), 'Ersatz');
});

test('Spielstand: präparierter Name wird beim Laden gesäubert, Länge begrenzt', () => {
  for (const roh of BOESE) {
    const s = createState({ seed: 3 });
    s.harborName = roh;
    const d = deserialize(JSON.stringify(s));
    assert.ok(Array.from(d.harborName).length <= NAME_MAX);
    assert.doesNotMatch(d.harborName, /[<>"]/);
  }
  const s = createState({ seed: 3 });
  s.harborName = 42;
  assert.throws(() => deserialize(JSON.stringify(s)), /harborName/);
});

test('Flagge: jedes Muster und jedes Zeichen ist gültig gezeichnet', () => {
  for (const z of FLAGGEN_ZEICHEN) {
    if (!z.pixel) continue;
    assert.equal(z.pixel.length, 9, z.id);
    for (const zeile of z.pixel) assert.equal(zeile.length, 9, `${z.id}: ${zeile}`);
  }
  const hex = new Set(FLAGGEN_FARBEN.map((f) => f.hex));
  for (const m of FLAGGEN_MUSTER) {
    for (const zeichen of FLAGGEN_ZEICHEN) {
      const f = flaggeSauber({ muster: m.id, farben: ['rot', 'weiss', 'blau'], zeichen: zeichen.id });
      const px = flaggenPixel(f);
      assert.equal(px.length, FLAGGE_B * FLAGGE_H);
      assert.ok(px.every((c) => c === null || hex.has(c)), `${m.id}/${zeichen.id}`);
      if (m.id !== 'stander') assert.ok(px.every((c) => c !== null), `${m.id} hat Löcher`);
      // Am Mast (x = 0) hängt immer Tuch
      assert.ok(px[Math.floor(FLAGGE_H / 2) * FLAGGE_B] !== null, `${m.id} hängt nicht am Mast`);
    }
    // Ein Muster mit n Feldern nutzt genau n Farben
    const f = flaggeSauber({ muster: m.id, farben: ['rot', 'weiss', 'blau'], zeichen: 'keins' });
    const genutzt = new Set(flaggenPixel(f).filter(Boolean));
    assert.equal(genutzt.size, m.felder, m.id);
  }
});

test('Flagge: präparierte Flaggen fallen auf erlaubte Werte zurück', () => {
  const basis = flaggeAusSeed(9);
  const faelle = [
    null, undefined, 'rot', 42, [], { muster: '<script>' }, { muster: 'quer', farben: 'rot' },
    { muster: 'quer', farben: ['#ff0000', 'url(javascript:1)', null, 'rot'] },
    { muster: '__proto__', farben: ['constructor', 'toString', 'hasOwnProperty'], zeichen: 'valueOf', zeichenFarbe: '__proto__' },
    JSON.parse('{"__proto__":{"muster":"kreuz"},"zeichen":"anker"}'),
  ];
  const muster = new Set(FLAGGEN_MUSTER.map((m) => m.id));
  const farben = new Set(FLAGGEN_FARBEN.map((m) => m.id));
  const zeichen = new Set(FLAGGEN_ZEICHEN.map((m) => m.id));
  for (const roh of faelle) {
    const f = flaggeSauber(roh, 9);
    assert.ok(muster.has(f.muster), JSON.stringify(roh));
    assert.equal(f.farben.length, 3);
    assert.ok(f.farben.every((x) => farben.has(x)), JSON.stringify(f.farben));
    assert.ok(zeichen.has(f.zeichen));
    assert.ok(farben.has(f.zeichenFarbe));
    assert.deepEqual(Object.keys(f).sort(), ['farben', 'muster', 'zeichen', 'zeichenFarbe']);
  }
  assert.deepEqual(flaggeSauber(null, 9), basis);
  assert.equal(flaggeSauber({ muster: 'quer', farben: ['#ff0000', 'gelb'] }, 9).farben[1], 'gelb');
  assert.equal(flaggeSauber({ muster: 'quer', farben: ['#ff0000', 'gelb'] }, 9).farben[0], basis.farben[0]);
});

test('Flagge aus dem Seed: gleich bei gleichem Seed, vielfältig, mit Kontrast', () => {
  assert.deepEqual(flaggeAusSeed(123), flaggeAusSeed(123));
  const viele = Array.from({ length: 300 }, (_, i) => flaggeAusSeed(i * 7919 + 1));
  const verschieden = new Set(viele.map((f) => JSON.stringify(f)));
  assert.ok(verschieden.size > 250, `nur ${verschieden.size} verschiedene Flaggen`);
  assert.ok(new Set(viele.map((f) => f.muster)).size >= FLAGGEN_MUSTER.length - 1);
  for (const f of viele) {
    assert.notEqual(f.farben[0], f.farben[1]);
    assert.equal(f.zeichenFarbe, passendeZeichenFarbe(f));
    assert.ok(gleicheFlagge(f, flaggeSauber(f)));
    assert.match(flaggeBeschreibung(f), /^[A-ZÄÖÜ]/);
  }
});

test('Speichern: neue Häfen haben eine Flagge, alte bekommen beim Laden die Flagge zum Seed', () => {
  const s = createState({ seed: 77 });
  assert.deepEqual(s.flagge, flaggeAusSeed(77));
  assert.ok(SAVE_VERSION >= 4);
  // Stand aus Version 3 ohne Flagge
  const alt = { ...createState({ seed: 77 }) };
  delete alt.flagge;
  const geladen = unwrap({ format: 'hafenmeister-spielstand', version: 3, spiel: alt }).game;
  assert.deepEqual(geladen.flagge, flaggeAusSeed(77));
  // Auch ein Stand aus Version 1 läuft durch alle Umbauten
  const v1 = { ...createState({ seed: 5 }) };
  delete v1.flagge;
  assert.deepEqual(unwrap({ format: 'hafenmeister-spielstand', version: 1, spiel: v1 }).game.flagge, flaggeAusSeed(5));
  // Eigene Flagge reist durch Speichern und Laden
  const eigen = { muster: 'kreuz', farben: ['blau', 'gelb', 'rot'], zeichen: 'anker', zeichenFarbe: 'weiss' };
  const t = JSON.stringify(wrap({ ...createState({ seed: 1 }), flagge: eigen, harborName: 'Nordhafen' }));
  const zurueck = deserialize(JSON.stringify(unwrap(JSON.parse(t)).game));
  assert.deepEqual(zurueck.flagge, eigen);
  assert.equal(zurueck.harborName, 'Nordhafen');
  // Kaputte Flagge im Stand: lädt trotzdem, mit Flagge zum Seed
  const kaputt = deserialize(JSON.stringify({ ...createState({ seed: 8 }), flagge: '<b>' }));
  assert.deepEqual(kaputt.flagge, flaggeAusSeed(8));
});
