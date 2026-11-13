#!/usr/bin/env node
// Hafenmeister: Spielzahlen prüfen und als Übersicht ausgeben. Alle Zahlen stehen in
// web/js/data/economy.js (ECONOMY), dieses Werkzeug liest nur.
//
// Aufruf (aus dem Repo-Hauptordner):
//   node tools/zahlen.mjs --pruefen      Fehler melden (Exit-Code 1): ungelesene Felder, Ja/Nein statt
//                                         Zahl, Ausbaustufe billiger als die davor
//   node tools/zahlen.mjs --tabellen     Zahlenübersicht als Markdown (Inhalt von docs/zahlen.md)
//   node tools/zahlen.mjs --schreiben    docs/zahlen.md neu schreiben
//
// tools/balance.mjs --pruefen und tests/zahlen.test.mjs rufen die Prüfung mit auf.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ECONOMY as E } from '../web/js/data/economy.js';
import { SERVICES } from '../web/js/data/services.js';
import { EVENTS } from '../web/js/data/events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ZAHLEN_DATEI = path.join(ROOT, 'docs', 'zahlen.md');

// ------------------------------------------------------------------ Prüfen

// Objekte, deren Schlüssel Namen sind (Ids, Klassen, Stufen), keine Feldnamen: deren direkte
// Schlüssel werden nicht im Code gesucht, ihre Werte aber schon.
const NAMENS_LISTEN = [
  /^klassen$/, /^wuensche$/, /^wunschAnzahl$/, /^platzarten$/, /^stromAnSteg$/, /^bauwerke$/, /^services$/,
  /^ereignisse$/, /^warten\.plaetze$/, /^stufen\.\d+\.mix$/, /\.gaeste$/, /\.wetter$/, /\.hafengeld$/,
  /^ereignisse\.\w+\.wirkung\.(sizeFactor|kindFactor|satisfaction)$/, /^tagesziele\.(geld|schwere|ziele|grossAb)$/,
  /^zeit\.jahreszeiten$/, /\.ankunftFaktor$/,
];
// Felder, die bewusst noch niemand liest (mit Paket, das sie anschließt oder löscht)
export const NOCH_UNGELESEN = {
  bautage: 'P18',
  winterBautempo: 'P18',
};
// Felder, die Ja/Nein sein dürfen. Alles andere ist eine Zahl, ein Text, eine Liste oder ein Objekt.
const JA_NEIN = new Set(['ueberNacht', 'vorauskasse', 'strom', 'offen', 'gast', 'allePlaetze', 'nurMotor', 'seaArrivals', 'winter',
  'C', 'CS', 'D', 'K', 'A', 'B']);

function quelltexte() {
  const out = [];
  const lauf = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) lauf(p);
      else if (f.name.endsWith('.js') && !p.endsWith(path.join('data', 'economy.js'))) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  lauf(path.join(ROOT, 'web', 'js'));
  return out.join('\n');
}

/** Alle Felder von ECONOMY als [pfad, schluessel, wert, elternpfad]. */
function felder(obj, pfad = '', out = []) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => { if (v && typeof v === 'object') felder(v, `${pfad}.${i}`.replace(/^\./, ''), out); });
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = pfad ? `${pfad}.${k}` : k;
    out.push([p, k, v, pfad]);
    if (v && typeof v === 'object') felder(v, p, out);
  }
  return out;
}

export function pruefeZahlen() {
  const fehler = [];
  const code = quelltexte();
  const gesucht = new Map();
  for (const [p, k, v, eltern] of felder(E)) {
    const namensListe = NAMENS_LISTEN.some((re) => re.test(eltern));
    // 1. Ungelesene Felder: Der Feldname kommt im Spielcode (web/js ohne economy.js) nicht vor
    if (!namensListe && !/^\d+$/.test(k) && !NOCH_UNGELESEN[k]) {
      if (!gesucht.has(k)) gesucht.set(k, new RegExp(`\\b${k}\\b`).test(code));
      if (!gesucht.get(k)) fehler.push(`${p}: Feld "${k}" liest kein Spielcode (löschen oder anschließen)`);
    }
    // 2. Ja/Nein, wo eine Zahl hingehört
    if (typeof v === 'boolean' && !JA_NEIN.has(k)) fehler.push(`${p}: ist ${v}, erwartet wird eine Zahl`);
  }
  // 3. Ausbaustufen: jede Stufe kostet mehr als die davor
  const steigend = (name, liste) => liste.forEach((st, i) => {
    if (i > 0 && !(st.kosten > liste[i - 1].kosten)) fehler.push(`${name}: Stufe ${i + 1} (${st.kosten} €) ist nicht teurer als Stufe ${i} (${liste[i - 1].kosten} €)`);
  });
  for (const [k, s] of Object.entries(E.services)) steigend(`services.${k}`, s.stufen);
  for (const [k, b] of Object.entries(E.bauwerke)) steigend(`bauwerke.${k}`, b.stufen);
  steigend('hafenbuero', E.hafenbuero.stufen);
  steigend('Hafenausbau', E.stufen.filter((s) => s.ausbau).map((s) => s.ausbau));
  // 4. Sturmschutz ist ein Anteil
  for (const [k, s] of Object.entries(E.services)) s.stufen.forEach((st, i) => {
    const w = st.wirkung?.sturmschutz;
    if (w != null && !(w >= 0 && w <= 1)) fehler.push(`services.${k}[${i}].wirkung.sturmschutz: ${w} liegt nicht zwischen 0 und 1`);
  });
  return fehler;
}

// ------------------------------------------------------------------ Übersicht
const euro = (n) => `${Number(n).toLocaleString('de-DE')} €`;
const zahl = (n) => String(n).replace('.', ',');
const tabelle = (kopf, zeilen) => [`| ${kopf.join(' | ')} |`, `|${kopf.map(() => '---').join('|')}|`, ...zeilen.map((z) => `| ${z.join(' | ')} |`)].join('\n');
const wirkungText = (w = {}) => Object.entries(w).filter(([k]) => k !== 'besuch').map(([k, v]) =>
  `${k} ${typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '').replace(/,/g, ', ') : zahl(v)}`).join('; ');

export function tabellen() {
  const t = [];
  t.push('# Spielzahlen', '');
  t.push('Erzeugt aus `web/js/data/economy.js` mit `node tools/zahlen.mjs --schreiben`. Nicht von Hand ändern:',
    'Zahlen in economy.js ändern und die Datei neu schreiben. `tests/zahlen.test.mjs` meldet, wenn sie veraltet ist.', '');
  const z = E.zeit;
  t.push('## Zeit', '', tabelle(['Was', 'Wert'], [
    ['Tag / Abend', `${z.tagSekunden} s / ${z.abendSekunden} s`],
    ['Saison / Winter', `${z.saisonTage} / ${z.winterTage} Tage`],
    ['Ankünfte', `${zahl(z.ankunftVon)} bis ${zahl(z.ankunftBis)} des Tages, Spitze ${zahl(z.ankunftSpitze)}`],
    ['Abreise', `${zahl(z.abreiseVon)} bis ${zahl(z.abreiseBis)} des Tages`],
    ['Erstes Boot', `nach ${z.erstesBootNach} s`],
    ['Geduld an der Boje', `${E.warten.geduld} s, selbst einfahren nach ${E.warten.selbstEinfahrenNach} s`],
  ]), '');
  t.push('## Ausbaustufen', '', tabelle(['Stufe', 'Name', 'Ankünfte/Tag', 'Mix', 'Ziel', 'Ausbau'], E.stufen.map((s) => [
    s.stufe, s.name, s.ankuenfte, Object.entries(s.mix).map(([k, v]) => `${k} ${zahl(v)}`).join(', '),
    s.ziel.gaeste != null ? `${s.ziel.gaeste} Gäste, Ruf ${zahl(s.ziel.ruf)}` : `${s.ziel.grossschiffBesuche} Großschiffbesuche, Ruf ${zahl(s.ziel.ruf)}${s.ziel.allePlaetze ? ', alle Plätze' : ''}`,
    s.ausbau ? `${s.ausbau.name}, ${euro(s.ausbau.kosten)}` : '-',
  ])), '');
  t.push('## Liegegeld je Klasse', '', tabelle(['Klasse', 'Grundpreis', 'Nächte', 'Wünsche'], Object.entries(E.klassen).map(([k, v]) => [
    k, euro(v.grundpreis), v.naechte.join(' bis '), (E.wunschAnzahl[k] ?? [0, 0]).join(' bis '),
  ])), '', `Je erfülltem Wunsch +${Math.round(E.wunschBonus * 100)} %.`, '');
  t.push('## Stegprojekte', '', tabelle(['Projekt', 'ab Stufe', 'Kosten', 'Plätze'], E.stegprojekte.map((p) => [p.name, p.stufe, euro(p.kosten), p.plaetze.length])), '');
  t.push('## Versorgung', '', tabelle(['Bauwerk', 'Stufe', 'Name', 'ab Hafenstufe', 'Kosten', 'versorgt'], Object.entries(E.bauwerke).flatMap(([k, b]) =>
    b.stufen.map((st, i) => [i === 0 ? b.name : '', i + 1, st.name, st.abStufe, euro(st.kosten), st.versorgt ?? '-']))), '');
  t.push('## Hafenbüro', '', tabelle(['Stufe', 'Name', 'ab Hafenstufe', 'Kosten', 'schaltet frei'], E.hafenbuero.stufen.map((st, i) => [
    i + 1, st.name, st.abStufe, euro(st.kosten), (st.schaltetFrei ?? []).join(', ')])), '');
  t.push('## Services', '', tabelle(['Service', 'Stufe', 'Name', 'ab Hafenstufe', 'Kosten', 'Mindestruf', 'Wirkung'], SERVICES.flatMap((s) =>
    s.stufen.map((st, i) => [i === 0 ? s.name : '', i + 1, st.name, st.abStufe ?? s.abStufe, euro(st.kosten), st.ruf != null ? zahl(st.ruf) : '-',
      wirkungText(st.wirkung) + (st.wirkung.besuch ? `; Besuch alle ${st.wirkung.besuch.alleTage} Tage, ${euro(st.wirkung.besuch.einnahme)}` : '')]))), '');
  t.push('## Ereignisse', '', tabelle(['Ereignis', 'ab Stufe', 'alle Tage', 'Dauer', 'Saison', 'Wirkung'], EVENTS.map((e) => [
    e.title, e.stage, e.every, e.duration, e.season.join(' bis '), wirkungText(e.mods)])), '');
  return t.join('\n');
}

// ------------------------------------------------------------------ Aufruf
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--tabellen')) console.log(tabellen());
  else if (args.includes('--schreiben')) { fs.writeFileSync(ZAHLEN_DATEI, tabellen() + '\n'); console.log(`geschrieben: ${path.relative(ROOT, ZAHLEN_DATEI)}`); }
  else {
    const f = pruefeZahlen();
    if (f.length) { console.error('Zahlenfehler:\n- ' + f.join('\n- ')); process.exit(1); }
    console.log('Zahlen in Ordnung.');
  }
}
