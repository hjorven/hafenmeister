// Bauen mit Vorschau (docs/bauen.md): Wahl des naechsten Schritts und Wirkungstexte, ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waehleSchritt, wirkungText, leer } from '../web/js/ui/bauen-rat.js';

const steg = (id, kosten, plaetzeNeu, gesperrt = null) => ({ key: `steg:${id}`, art: 'steg', name: id, kosten, plaetzeNeu, gesperrt, nutzen: [] });
const vers = (id, kosten, stufeNeu = 1, gesperrt = null) => ({ key: `versorgung:${id}`, art: 'versorgung', name: id, wunsch: id, kosten, stufeNeu, gesperrt, nutzen: [] });
const stufe = (missing, extra = {}) => ({ ok: missing.length === 0, missing, guests: 5, reputation: 3, goal: { name: 'Dorfhafen', guests: 20, reputation: 2.5, cost: 400 }, ...extra });

test('Ausbaustufe bereit geht vor', () => {
  const r = waehleSchritt({ geld: 500, eintraege: [steg('a', 100, 4), { key: 'hafen:stufe', art: 'hafen', name: 'Dorfhafen', kosten: 400, nutzen: [] }], bedarf: { ...leer(), weg: 5 }, stufe: stufe([]) });
  assert.equal(r.ziel, 'hafen:stufe');
  assert.equal(r.leistbar, true);
});

test('Weggeschickte Boote: Steg mit den meisten Plaetzen, den man sich leisten kann', () => {
  const r = waehleSchritt({ geld: 1000, eintraege: [steg('klein', 200, 2), steg('gross', 900, 8), steg('teuer', 5000, 12)], bedarf: { ...leer(), weg: 3 }, stufe: null });
  assert.equal(r.ziel, 'steg:gross');
  assert.match(r.text, /3 Boote weitergefahren/);
  assert.match(r.text, /8 Plätze/);
});

test('Zu wenig Geld: Hinweis nennt, wie viel noch fehlt', () => {
  const r = waehleSchritt({ geld: 100, eintraege: [steg('a', 400, 4)], bedarf: { ...leer(), weg: 2 }, stufe: null });
  assert.equal(r.leistbar, false);
  assert.match(r.text, /Noch 300 € sparen/);
});

test('Offene Wuensche fuehren zur passenden Versorgung, gesperrte zaehlen nicht', () => {
  const r = waehleSchritt({ geld: 2000, eintraege: [vers('wc', 450, 2), vers('dusche', 900, 2), vers('essen', 500, 1, 'ab Ausbaustufe 2')], bedarf: { ...leer(), offen: { essen: 6, dusche: 4 } }, stufe: null });
  assert.equal(r.ziel, 'versorgung:dusche');
  assert.match(r.text, /4 Gäste wollten eine Dusche/);
});

test('Ohne Bedarf: fehlende Grundversorgung, sonst das Ziel der Stufe', () => {
  const a = waehleSchritt({ geld: 100, eintraege: [vers('wc', 80)], bedarf: leer(), stufe: stufe(['guests']) });
  assert.equal(a.ziel, 'versorgung:wc');
  const b = waehleSchritt({ geld: 100, eintraege: [vers('wc', 450, 2), { key: 'hafen:stufe', art: 'hafen', name: 'Dorfhafen', kosten: 400, nutzen: [], gesperrt: 'fehlt' }], bedarf: leer(), stufe: stufe(['guests']) });
  assert.match(b.text, /Noch 15 zufriedene Gäste bis zum Dorfhafen/);
});

test('Nichts zu tun: null', () => {
  assert.equal(waehleSchritt({ geld: 0, eintraege: [], bedarf: leer(), stufe: null }), null);
});

test('Wirkung eines Services als Satz, ohne Zahl fuer Tagesgaeste', () => {
  assert.equal(wirkungText({ proTag: 8 }), 'Bringt 8 € pro Saisontag.');
  const t = wirkungText({ gaeste: { XL: 1.5 }, tagesgaeste: 80, proTag: 80 });
  assert.match(t, /50 % mehr Boote der Größe XL/);
  assert.doesNotMatch(t, /80 Tagesgäste/);
  assert.equal(wirkungText({}), '');
});
