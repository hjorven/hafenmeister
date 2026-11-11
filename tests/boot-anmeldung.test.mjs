// Prüft, dass sich jedes Schiffs-Modul unter derselben Schreibweise anmeldet:
// game.boatTypes.<größe in Kleinbuchstaben> (docs/grundgeruest.md). Die Module brauchen
// Three.js aus dem Netz, deshalb wird hier der Quelltext geprüft statt das Modul geladen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const GROESSEN = ['s', 'm', 'l', 'xl', 'xxl'];

for (const g of GROESSEN) {
  const datei = new URL(`../web/js/render/boats/${g}.js`, import.meta.url);
  test(`render/boats/${g}.js meldet sich als game.boatTypes.${g} an`, { skip: !existsSync(datei) && 'Datei fehlt noch' }, () => {
    const src = readFileSync(datei, 'utf8');
    const re = new RegExp(`game\\.boatTypes(\\.${g}|\\[['"]${g}['"]\\])\\s*=(?!=)`);
    assert.match(src, re, `erwartet: game.boatTypes.${g} = { ... }`);
  });
}
