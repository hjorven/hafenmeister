#!/usr/bin/env node
// Übersicht über mehrere Zeitraffer-Läufe (zum Beispiel je Geländeform ein Unterordner mit
// ergebnis-pc.json und ergebnis-handy.json). Schreibt uebersicht.md in den Hauptordner.
//
//   node tools/zeitraffer/uebersicht.cjs /tmp/zeitraffer-serie
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || '.');
const zeilen = [];
const ordner = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
  .map((d) => d.name).sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
const anz = (R, k) => Object.keys(R.treffer?.[k] ?? {}).length;
let commit = null;
for (const o of ordner) {
  for (const f of fs.readdirSync(path.join(DIR, o)).filter((x) => /^ergebnis-.*\.json$/.test(x)).sort()) {
    const R = JSON.parse(fs.readFileSync(path.join(DIR, o, f), 'utf8'));
    commit ||= R.commit;
    const v = R.verlauf; const letzt = v[v.length - 1] ?? {};
    const ziel = v.find((x) => x.ziel?.ok);
    const tage = [2, 3, 4, 5, 6].map((s) => R.stufen.find((x) => x.stufe === s)?.tag ?? '-').join(' / ');
    const speichern = R.speichern.filter((s) => !s.gespeichert || s.abweichungen.length).length;
    zeilen.push(`| ${o} | ${R.geraet} | ${tage} | ${ziel ? ziel.tag : `nein (Stufe ${letzt.stufe})`} | ${anz(R, 'steg')} | ${anz(R, 'land')} | ${anz(R, 'fest')} | ${anz(R, 'ueberlapp')} | ${anz(R, 'haengt')} | ${anz(R, 'sim')} | ${R.fehler.length} | ${speichern}/${R.speichern.length} | [Bericht](${o}/bericht.html) |`);
  }
}
const md = [
  '# Zeitraffer-Serie', '',
  `Stand: ${commit ?? 'lokal'}. Je Zeile ein Lauf von Stufe 1 bis zum Ziel von Stufe 6. Zahlen bei den Prüfungen: verschiedene Boote oder Fälle mit Treffer.`, '',
  '| Lauf | Gerät | Aufstieg an Tag (Stufe 2/3/4/5/6) | Ziel Stufe 6 an Tag | durch Steg | über Land | ineinander fest | liegend überlappt | hängt | Regeln | Konsolenfehler | Speichern abweichend | |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...zeilen, '',
  'Erwartung aus tools/balance.mjs: Stufe 2/3/4/5/6 an Tag 14 / 51 / 94 / 143 / 194, Ziel an Tag 248.', '',
];
fs.writeFileSync(path.join(DIR, 'uebersicht.md'), md.join('\n'));
console.log(md.join('\n'));
