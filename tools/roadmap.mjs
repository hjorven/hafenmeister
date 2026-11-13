#!/usr/bin/env node
// Erzeugt aus docs/roadmap.md die Übersichten der Roadmap:
//   - web/roadmap/daten.json       Daten für die interaktive Seite (Pages: /roadmap/)
//   - docs/roadmap-fortschritt.svg Fortschrittsbild für die README
//   - README.md                    Abschnitt zwischen <!-- roadmap:start --> und <!-- roadmap:end -->
//
// Aufruf im Hauptordner:
//   node tools/roadmap.mjs            schreibt alle drei Dateien
//   node tools/roadmap.mjs --pruefen  schreibt nichts, Fehler, wenn etwas veraltet ist
//   node tools/roadmap.mjs --json     gibt nur die Daten aus (zum Nachsehen)
//
// Quelle bleibt allein docs/roadmap.md. Erkannt werden:
//   - Pakettabellen: erste Spalte "Paket", Zeilen "P01" usw. Die Welle kommt aus der
//     Überschrift ("Welle 2: ...") oder aus einer Spalte "Welle".
//   - Punkttabellen: erste Spalte "Nr" oder "Kürzel" (Ü1, F12, T3, C05, A1, Svc F2, Bed P3)
//     mit einer Spalte "Paket"; der Status steht in der Spalte "Status", sonst im Text.
// Der Status eines Pakets kommt aus seiner eigenen Zeile; steht dort nichts Eindeutiges,
// aus seinen Punkten (alle erledigt = erledigt, ein Teil = teilweise).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'docs/roadmap.md');
const ZIEL_JSON = join(WURZEL, 'web/roadmap/daten.json');
const ZIEL_SVG = join(WURZEL, 'docs/roadmap-fortschritt.svg');
const ZIEL_README = join(WURZEL, 'README.md');
const REPO = 'https://github.com/hjorven/hafenmeister';
const SEITE = 'https://hjorven.github.io/hafenmeister/roadmap/';

export const STATUS = {
  erledigt: { name: 'erledigt', farbe: '#23897d' },
  teilweise: { name: 'teilweise', farbe: '#e8b23a' },
  arbeit: { name: 'in Arbeit', farbe: '#3a7cc4' },
  frage: { name: 'Frage', farbe: '#9a5bc4' },
  offen: { name: 'offen', farbe: '#9aa7b1' },
  entfaellt: { name: 'entfällt', farbe: '#c9cfd4' },
};
const REIHENFOLGE = ['erledigt', 'teilweise', 'arbeit', 'frage', 'offen', 'entfaellt'];

// ---------- Hilfen ----------

function zellen(zeile) {
  // "| a | b `x|y` | c |" -> ["a", "b `x|y`", "c"]; | in Codespannen bleibt erhalten
  const s = zeile.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let akt = '';
  let code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') code = !code;
    if (c === '\\' && s[i + 1] === '|') { akt += '|'; i++; continue; }
    if (c === '|' && !code) { out.push(akt.trim()); akt = ''; continue; }
    akt += c;
  }
  out.push(akt.trim());
  return out;
}

export function klasse(text) {
  const t = (text || '').toLowerCase();
  if (/aufgegangen|entfällt|entfaellt/.test(t)) return 'entfaellt';
  const fertig = /erledigt|gebaut|behoben/.test(t);
  const rest = /\boffen\b|bis auf|teilweise|\bteils\b|\bnoch\b/.test(t);
  if (fertig && rest) return 'teilweise';
  if (fertig) return 'erledigt';
  if (/in arbeit/.test(t)) return 'arbeit';
  if (/^frage\b|wartet auf jorven/.test(t)) return 'frage';
  return null; // nichts Eindeutiges
}

function prs(text) {
  const out = new Set();
  // "PR 149", "PR 146 und 151", "(PR 112)", "PR 81, PR 91"
  for (const m of (text || '').matchAll(/PRs?\s+((?:\d+(?:\s*(?:,|und|bis)\s*)?)+)/g)) {
    for (const n of m[1].matchAll(/\d+/g)) out.add(Number(n[0]));
  }
  return [...out].sort((a, b) => a - b);
}

function paketRefs(text) {
  // Nur Verweise außerhalb von Klammern zählen als Zuordnung: "P02 (verknüpft P28)" -> P02
  const ohneKlammern = (text || '').replace(/\([^)]*\)/g, '');
  const refs = [...ohneKlammern.matchAll(/\bP(\d{2})\b/g)].map((m) => 'P' + m[1]);
  return [...new Set(refs)];
}

function klartext(md) {
  // Markdown in einfachen Text: Links, Code, Fett
  return (md || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function welleTitel(ueberschrift) {
  const m = ueberschrift.match(/Welle\s+(\d+)\s*:?\s*(.*)$/i);
  if (!m) return null;
  let titel = m[2].replace(/\s*\([^)]*\)\s*$/, '').trim();
  return { nr: Number(m[1]), titel };
}

const KUERZEL = /^(Ü\d+|F\d+|T\d+|C\d+|[A-Q]\d+|Svc F\d+|Bed P\d+)$/;

// ---------- Einlesen ----------

export function lese(md) {
  const zeilen = md.split('\n');
  let h2 = '';
  let h3 = '';
  const pakete = new Map();
  const punkte = [];
  const wellenTitel = new Map();

  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (z.startsWith('## ')) { h2 = z.slice(3).trim(); h3 = ''; continue; }
    if (z.startsWith('### ')) { h3 = z.slice(4).trim(); continue; }
    if (!z.startsWith('|') || !zeilen[i + 1] || !/^\|\s*:?-{3,}/.test(zeilen[i + 1])) continue;

    // Tabelle gefunden
    const kopf = zellen(z).map((k) => k.toLowerCase());
    const reihen = [];
    let j = i + 2;
    while (j < zeilen.length && zeilen[j].startsWith('|')) { reihen.push(zellen(zeilen[j])); j++; }
    i = j - 1;

    // Welle dieser Überschrift
    let welle = welleTitel(h3) || welleTitel(h2);
    if (!welle && /welle\s+0/i.test(h3 + ' ' + h2)) welle = { nr: 0, titel: '' };
    if (welle && h2.match(/\(Welle\s+0\)/i)) welle = { nr: 0, titel: h2.replace(/^\d+\.\s*/, '').replace(/\s*\(Welle\s+0\)/i, '') };
    if (welle && welle.titel && !wellenTitel.has(welle.nr)) wellenTitel.set(welle.nr, welle.titel);

    const iTitel = kopf.findIndex((k) => k.startsWith('titel'));
    if (kopf[0] === 'paket' && iTitel > 0 && reihen.some((r) => /^P\d{2}$/.test(r[0]))) {
      const iInhalt = kopf.indexOf('inhalt');
      const iWelle = kopf.indexOf('welle');
      const iThread = kopf.indexOf('thread');
      for (const r of reihen) {
        if (!/^P\d{2}$/.test(r[0])) continue;
        const nr = iWelle >= 0 ? Number(r[iWelle]) : welle ? welle.nr : null;
        const titel = klartext(r[iTitel] || '');
        const inhalt = klartext(r[iInhalt] || '');
        const thread = klartext(iThread >= 0 ? r[iThread] : '');
        const eigen = [titel, inhalt, thread].join(' ; ');
        pakete.set(r[0], {
          id: r[0],
          titel: titel.replace(/\s*\((erledigt|aufgegangen[^)]*)\)\s*$/i, ''),
          inhalt,
          thread,
          welle: Number.isFinite(nr) ? nr : null,
          statusZeile: klasse(eigen),
          prs: prs(eigen),
          abschnitt: h3 || h2,
        });
      }
      continue;
    }

    const iPaket = kopf.indexOf('paket');
    if ((kopf[0] === 'nr' || kopf[0] === 'kürzel') && iPaket > 0) {
      const iStatus = kopf.indexOf('status');
      for (const r of reihen) {
        const code = r[0];
        if (!KUERZEL.test(code)) continue;
        const text = klartext(r[1]);
        // Status: Spalte "Status", sonst Paket-Spalte und übrige Spalten ("P08, erledigt (PR 177)")
        const statusText = iStatus > 0 ? r[iStatus] : r.slice(2).join(' ; ');
        const st = klasse(statusText) || (iStatus > 0 ? 'offen' : null);
        punkte.push({
          code,
          text,
          status: st,
          statusText: klartext(iStatus > 0 ? r[iStatus] : ''),
          pakete: paketRefs(r[iPaket]),
          prs: prs(r.join(' ')),
          abschnitt: (h3 || h2).replace(/^\d+\.\s*/, ''),
        });
      }
    }
  }

  // Paketstatus: eigene Zeile, sonst aus den Punkten
  for (const p of pakete.values()) {
    const eigene = punkte.filter((x) => x.pakete.includes(p.id) && x.status);
    p.punkte = punkte.filter((x) => x.pakete.includes(p.id)).map((x) => x.code);
    let st = p.statusZeile;
    if (!st || st === 'arbeit') {
      const fertig = eigene.filter((x) => x.status === 'erledigt' || x.status === 'entfaellt').length;
      const teil = eigene.filter((x) => x.status === 'teilweise').length;
      if (eigene.length && fertig === eigene.length) st = 'erledigt';
      else if (fertig || teil) st = st === 'arbeit' ? 'arbeit' : 'teilweise';
    }
    p.status = st || 'offen';
    for (const x of eigene) for (const n of x.prs) if (!p.prs.includes(n)) p.prs.push(n);
    p.prs.sort((a, b) => a - b);
    delete p.statusZeile;
  }

  // Wellen zusammenstellen
  const wellen = new Map();
  for (const p of [...pakete.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const nr = p.welle ?? 99;
    if (!wellen.has(nr)) wellen.set(nr, { nr, titel: wellenTitel.get(nr) || (nr === 99 ? 'Ohne Welle' : ''), pakete: [] });
    wellen.get(nr).pakete.push(p.id);
  }
  const wellenListe = [...wellen.values()].sort((a, b) => a.nr - b.nr);
  for (const w of wellenListe) w.zaehler = zaehle(w.pakete.map((id) => pakete.get(id)));

  return {
    pakete: [...pakete.values()].sort((a, b) => a.id.localeCompare(b.id)),
    punkte,
    wellen: wellenListe,
    gesamt: zaehle([...pakete.values()]),
    punkteGesamt: zaehle(punkte.filter((x) => x.status)),
  };
}

function zaehle(liste) {
  const z = Object.fromEntries(REIHENFOLGE.map((k) => [k, 0]));
  for (const x of liste) z[x.status || 'offen']++;
  z.alle = liste.length;
  return z;
}

// Anteil "geschafft": erledigt zählt voll, teilweise und in Arbeit halb; entfällt zählt nicht mit
export function anteil(z) {
  const basis = z.alle - z.entfaellt;
  if (!basis) return 0;
  return (z.erledigt + 0.5 * (z.teilweise + z.arbeit)) / basis;
}

// ---------- Stand ----------

function stand() {
  try {
    // Flache Klone (Pages-Build) kennen nur den letzten Commit: dann dessen Datum
    const git = (a) => execSync(`git log -1 --format=%cs%n%h ${a}`, { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const out = (git('-- docs/roadmap.md') || git('')).split('\n');
    if (out[0]) {
      const [y, m, d] = out[0].split('-');
      return { datum: `${d}.${m}.${y}`, commit: out[1] || '' };
    }
  } catch { /* ohne git */ }
  return { datum: '', commit: '' };
}

// ---------- SVG ----------

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function svg(daten) {
  const B = 760;
  const zeileH = 34;
  const oben = 74;
  const H = oben + daten.wellen.length * zeileH + 46;
  const barX = 330;
  const barW = 340;
  const t = [];
  t.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif">`);
  t.push(`<rect width="${B}" height="${H}" rx="10" fill="#f4efe3" stroke="#d8cdb4"/>`);
  const g = daten.gesamt;
  t.push(`<text x="20" y="32" font-size="19" font-weight="700" fill="#16324a">Roadmap: ${g.erledigt} von ${g.alle - g.entfaellt} Paketen erledigt</text>`);
  t.push(`<text x="20" y="54" font-size="13" fill="#4a5d6c">${esc(`${g.teilweise} teilweise, ${g.arbeit} in Arbeit, ${g.offen + g.frage} offen${g.entfaellt ? `, ${g.entfaellt} zusammengelegt` : ''}${daten.stand.datum ? ` · Stand ${daten.stand.datum}` : ''}`)}</text>`);
  daten.wellen.forEach((w, i) => {
    const y = oben + i * zeileH;
    const name = w.nr === 99 ? w.titel : `Welle ${w.nr}${w.titel ? ': ' + w.titel : ''}`;
    const kurz = name.length > 42 ? name.slice(0, 41) + '…' : name;
    t.push(`<text x="20" y="${y + 17}" font-size="13" fill="#16324a">${esc(kurz)}</text>`);
    t.push(`<rect x="${barX}" y="${y + 4}" width="${barW}" height="18" rx="4" fill="#e3dccb"/>`);
    let x = barX;
    const basis = w.zaehler.alle || 1;
    for (const k of REIHENFOLGE) {
      if (k === 'offen' || !w.zaehler[k]) continue;
      const breite = (w.zaehler[k] / basis) * barW;
      t.push(`<rect x="${x.toFixed(1)}" y="${y + 4}" width="${breite.toFixed(1)}" height="18" fill="${STATUS[k].farbe}"/>`);
      x += breite;
    }
    t.push(`<text x="${barX + barW + 12}" y="${y + 17}" font-size="13" fill="#16324a">${w.zaehler.erledigt}/${w.zaehler.alle - w.zaehler.entfaellt}</text>`);
  });
  // Legende
  const ly = oben + daten.wellen.length * zeileH + 20;
  let lx = 20;
  for (const k of ['erledigt', 'teilweise', 'arbeit', 'offen', 'entfaellt']) {
    t.push(`<rect x="${lx}" y="${ly - 10}" width="12" height="12" rx="2" fill="${k === 'offen' ? '#e3dccb' : STATUS[k].farbe}"${k === 'offen' ? ' stroke="#b9ad92"' : ''}/>`);
    t.push(`<text x="${lx + 17}" y="${ly}" font-size="12" fill="#4a5d6c">${STATUS[k].name}</text>`);
    lx += 34 + STATUS[k].name.length * 7;
  }
  t.push('</svg>');
  return t.join('\n') + '\n';
}

// ---------- README ----------

function balken(z) {
  const n = 10;
  const voll = Math.round(anteil(z) * n);
  return '█'.repeat(voll) + '░'.repeat(n - voll);
}

function prLinks(liste) {
  return liste.map((n) => `[#${n}](${REPO}/pull/${n})`).join(' ');
}

export function readmeAbschnitt(daten) {
  const g = daten.gesamt;
  const r = [];
  r.push('<!-- roadmap:start -->');
  r.push('<!-- Dieser Abschnitt wird aus docs/roadmap.md erzeugt (tools/roadmap.mjs). Bitte dort ändern, nicht hier. -->');
  r.push('## Roadmap');
  r.push('');
  r.push(`**[Roadmap interaktiv ansehen](${SEITE})**: alle Pakete mit Filter nach Welle und Status, Suche und den Einzelpunkten je Paket. Quelle ist [docs/roadmap.md](docs/roadmap.md).`);
  r.push('');
  r.push(`<a href="${SEITE}"><img src="docs/roadmap-fortschritt.svg" alt="Fortschritt der Roadmap: ${g.erledigt} von ${g.alle - g.entfaellt} Paketen erledigt" width="100%"></a>`);
  r.push('');
  r.push('| Welle | Thema | Fortschritt | erledigt | angefangen | offen |');
  r.push('|---|---|---|---|---|---|');
  for (const w of daten.wellen) {
    const z = w.zaehler;
    const link = `${SEITE}#welle=${w.nr}`;
    r.push(`| [${w.nr === 99 ? '-' : w.nr}](${link}) | ${w.titel} | \`${balken(z)}\` ${Math.round(anteil(z) * 100)} % | ${z.erledigt} | ${z.teilweise + z.arbeit} | ${z.offen + z.frage} |`);
  }
  r.push('');
  for (const w of daten.wellen) {
    const z = w.zaehler;
    const name = w.nr === 99 ? w.titel : `Welle ${w.nr}: ${w.titel}`;
    r.push(`<details><summary><b>${esc(name)}</b> (${z.erledigt} von ${z.alle - z.entfaellt} erledigt)</summary>`);
    r.push('');
    r.push('| Paket | Titel | Status | PRs |');
    r.push('|---|---|---|---|');
    for (const id of w.pakete) {
      const p = daten.pakete.find((x) => x.id === id);
      const st = p.status === 'erledigt' ? '**erledigt**' : STATUS[p.status].name;
      r.push(`| [${p.id}](${SEITE}#paket=${p.id}) | ${p.titel.replace(/\|/g, '/')} | ${st} | ${prLinks(p.prs.slice(-4))} |`);
    }
    r.push('');
    r.push('</details>');
    r.push('');
  }
  r.push('<!-- roadmap:end -->');
  return r.join('\n');
}

export function readmeEinsetzen(readme, abschnitt) {
  const a = readme.indexOf('<!-- roadmap:start -->');
  const e = readme.indexOf('<!-- roadmap:end -->');
  if (a >= 0 && e > a) return readme.slice(0, a) + abschnitt + readme.slice(e + '<!-- roadmap:end -->'.length);
  // Noch kein Abschnitt: vor "## Wegweiser" einsetzen, sonst ans Ende
  const w = readme.indexOf('\n## Wegweiser');
  if (w >= 0) return readme.slice(0, w + 1) + abschnitt + '\n\n' + readme.slice(w + 1);
  return readme.trimEnd() + '\n\n' + abschnitt + '\n';
}

// ---------- Hauptteil ----------

export function erzeuge(md, st = { datum: '', commit: '' }) {
  const d = lese(md);
  return { stand: st, quelle: `${REPO}/blob/main/docs/roadmap.md`, repo: REPO, status: STATUS, ...d };
}

function main() {
  const arg = process.argv.slice(2);
  const daten = erzeuge(readFileSync(QUELLE, 'utf8'), stand());
  if (arg.includes('--json')) { process.stdout.write(JSON.stringify(daten, null, 2) + '\n'); return; }

  const dateien = [
    [ZIEL_JSON, JSON.stringify(daten, null, 1) + '\n'],
    [ZIEL_SVG, svg(daten)],
    [ZIEL_README, readmeEinsetzen(readFileSync(ZIEL_README, 'utf8'), readmeAbschnitt(daten))],
  ];
  // Datum und Commit allein machen nichts veraltet: Vergleich ohne Stand
  const ohneStand = (s) => s.replace(/"stand": \{[^}]*\}/, '').replace(/ · Stand [0-9.]+/, '');
  let veraltet = 0;
  for (const [pfad, inhalt] of dateien) {
    let alt = '';
    try { alt = readFileSync(pfad, 'utf8'); } catch { /* neu */ }
    if (ohneStand(alt) === ohneStand(inhalt)) continue;
    veraltet++;
    if (arg.includes('--pruefen')) { console.log(`veraltet: ${pfad.slice(WURZEL.length + 1)}`); continue; }
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, inhalt);
    console.log(`geschrieben: ${pfad.slice(WURZEL.length + 1)}`);
  }
  const g = daten.gesamt;
  console.log(`Roadmap: ${daten.pakete.length} Pakete in ${daten.wellen.length} Wellen, ${g.erledigt} erledigt, ${g.teilweise} teilweise, ${g.arbeit} in Arbeit, ${g.offen} offen; ${daten.punkte.length} Einzelpunkte.`);
  if (arg.includes('--pruefen') && veraltet) {
    console.log('Bitte im Hauptordner ausführen: node tools/roadmap.mjs');
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
