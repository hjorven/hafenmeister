#!/usr/bin/env node
// Zusammenspiel 1 (P85): Bericht aus den Läufen von kernschleife.cjs.
// Aufruf: node tools/zusammenspiel/bericht.cjs DIR   (DIR enthält Unterordner mit ergebnis.json)
// Schreibt DIR/bericht.md: je Regel aus Welle 1 und 2, wie oft sie je Lauf gegriffen hat, und alle Zähler.

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || '/tmp/zusammenspiel');

// Regeln der Kernschleife mit dem Zählerschlüssel, an dem man sie im Spiel erkennt.
// aktiv: kommt nur vor, wenn der Spieler selbst handelt (darum beim passiven Spieler kein Fund).
const REGELN = [
  ['A', 'Ankunft von See, Warten an der Boje', 'sim:atBuoy'],
  ['A', 'Boot meldet sich an (Vorschau)', 'sim:announced'],
  ['P10 Ü8', 'Selbst-Einfahren nach 8 s an der Boje', 'sim:selfEntered'],
  ['P10 Ü8', 'Selbst-Einfahren direkt (alle Bojen voll)', 'sim:selfEntered.direct=true'],
  ['P10', 'Zuweisen von Hand', 'sim:moored.hand=true', 'aktiv'],
  ['P10 Ü9', 'Boot liegt in Box, die einen Wunsch erfüllt', 'sim:feeReady.wuensche=1'],
  ['P10 Ü13', 'Abweisen von Hand', 'sim:dismissed', 'aktiv'],
  ['P10 Ü13', 'Wegfahren aus Ungeduld', 'sim:turnedAway'],
  ['Liegegeld', 'Liegegeld beim Festmachen fällig', 'sim:feeReady'],
  ['P12', 'Münze von Hand eingestrichen', 'sim:collected.hand=true', 'aktiv'],
  ['P12 Ü12', 'Rundgang des Hafenmeisters kassiert am Abend', 'sim:collected.round=true', 'aktiv'],
  ['P12 B5', 'Trinkgeld großer Boote (Euro)', 'sum:sim:collected.tip'],
  ['P12', 'Trinkgeld beim Wischen über Münzen', 'sim:strokeTip', 'selten'],
  ['B', 'Ehrlichkeitskasse (Kurzhalter, Abend)', 'sim:honestyBox', 'aktiv'],
  ['B', 'Bojengeld', 'sim:buoyFee'],
  ['Kurzhalter', 'Kurzhalter (Liegegeld ohne Nacht)', 'sim:feeReady.kurz=ja'],
  ['P27', 'Päckchen längsseits', 'sim:moored.paeckchen=ja', 'aktiv'],
  ['P33', 'Gast von Hand umgelegt', 'sim:relocated.grund=hand', 'aktiv'],
  ['P28', 'Box für Funk-Anmeldung freigehalten', 'sim:reserved', 'aktiv'],
  ['P28', 'Freigehaltene Box genutzt', 'sim:reservationKept', 'aktiv'],
  ['Tagestörn', 'Gast auf Tagestörn', 'sim:tripOut'],
  ['P01', 'Dauerplatz vergeben', 'sim:dauerNeu', 'aktiv'],
  ['P01 Ü1', 'Pacht der Dauerlieger und Fischer', 'sim:stationedFee'],
  ['P02 Ü11', 'Hafenbüro lässt Sonderfall dem Spieler', 'sim:officeSpecial'],
  ['P05 Ü5', 'Boot zieht beim Stufenausbau um', 'sim:relocated.grund=umbau'],
  ['P05 Ü5', 'Gast reist wegen Umbau ab', 'sim:departed.reason=rebuild', 'selten'],
  ['P13', 'Tagesziel gewählt', 'ziel:gewaehlt', 'aktiv'],
  ['P13', 'Tagesziel erreicht', 'ziel:erreicht', 'aktiv'],
  ['P13', 'Wochenziel erreicht', 'wochenziel:erreicht', 'aktiv'],
  ['P14', 'Bewertung im Gästebuch', 'gaestebuch:bewertung'],
  ['P15', 'Tagesabschluss gezeigt', 'tagesabschluss:fertig'],
  ['P16', 'Aufstieg', 'sim:stageUp'],
  ['P16', 'Regionsabschluss', 'sim:regionDone'],
  ['P18', 'Bauabschnitt beauftragt', 'bauen:abschnitt', 'aktiv'],
  ['P18', 'Bauabschnitt fertig', 'bauen:abschnittFertig', 'aktiv'],
  ['P18', 'Gebaut über das Bauen-Menü', 'bauen:gebaut', 'aktiv'],
  ['P30', 'Steg nachgerüstet', 'nachruesten:gebaut', 'aktiv'],
  ['P19', 'Auszeichnung steigt', 'sim:awardUp'],
  ['P19', 'Auszeichnung sinkt', 'sim:awardDown', 'selten'],
  ['P20', 'Winter beginnt', 'winter:karte'],
  ['P21', 'Neuer Eintrag im Logbuch', 'sim:logbookNew'],
  ['P22', 'Erfolg erreicht', 'erfolg:neu'],
  ['P25', 'Neuer Stammgast', 'stammgast:neu'],
  ['P24', 'Ereignis beginnt', 'event:start'],
  ['P04', 'Großschiffbesuch', 'services:besuch'],
  ['P86', 'Bootsgeschichte', 'geschichte:neu'],
];

const laeufe = [];
for (const d of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const f = path.join(DIR, d.name, 'ergebnis.json');
  if (fs.existsSync(f)) laeufe.push({ name: d.name, r: JSON.parse(fs.readFileSync(f, 'utf8')) });
}
laeufe.sort((a, b) => a.name.localeCompare(b.name));
if (!laeufe.length) { console.error('Keine ergebnis.json unter', DIR); process.exit(1); }

const z = (r, k) => (k.startsWith('sum:') ? Math.round(r.sum[k.slice(4)] || 0) : r.z[k] || 0);
const L = [];
L.push(`# Zusammenspiel: Kernschleife und Regeln (Zähllauf)`, '');
L.push(`Läufe aus \`${DIR}\`, erzeugt ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, '');
L.push('| Lauf | Spieler | Gerät | Adresse | Ende | Dauer | Fehler |', '|---|---|---|---|---|---|---|');
for (const { name, r } of laeufe) L.push(`| ${name} | ${r.spieler} | ${r.geraet} | \`${r.query}\` | ${r.ende} | ${r.dauerMin} min | ${r.fehler.length} |`);
L.push('', '## Tag des Aufstiegs je Stufe', '', `| Lauf | ${[2, 3, 4, 5, 6].map((s) => 'Stufe ' + s).join(' | ')} |`, '|---|---|---|---|---|---|');
for (const { name, r } of laeufe) L.push(`| ${name} | ${[2, 3, 4, 5, 6].map((s) => r.stufen.find((x) => x.stufe === s)?.tag ?? '-').join(' | ')} |`);

L.push('', '## Wie oft greift jede Regel', '', 'Fund = 0 mal, obwohl der Spieler es auslösen konnte. Bei Regeln mit "aktiv" handelt der passive Spieler nie selbst, dort ist 0 erwartet. "selten": darf in einem Spiel fehlen (Randfall oder nur über eine Geste, die der Spieler-Bot nicht macht; Gesten prüfen tests/specs/).', '');
L.push(`| Paket | Regel | Zähler | ${laeufe.map((l) => l.name).join(' | ')} |`, `|---|---|---|${laeufe.map(() => '---').join('|')}|`);
const funde = [];
for (const [p, t, k, nur] of REGELN) {
  const zellen = laeufe.map(({ name, r }) => {
    const n = z(r, k);
    const erwartet = nur !== 'selten' && (nur !== 'aktiv' || r.spieler === 'aktiv');
    if (!n && erwartet) funde.push(`${t} (\`${k}\`) in ${name}`);
    const e = r.erst[k.split(/[.=]/)[0]] ;
    return n ? `${n}` : erwartet ? '**0**' : '0';
  });
  L.push(`| ${p} | ${t}${nur ? ` (${nur})` : ''} | \`${k}\` | ${zellen.join(' | ')} |`);
}
L.push('', '### Bojen je Stufe', '', 'Ankünfte, davon an einer Boje angekommen, direkt in eine Box (alle Warteplätze belegt), abgedreht weil alle Warteplätze belegt (queueFull), von Hand zugewiesen.', '');
L.push(`| Lauf | ${[1, 2, 3, 4, 5, 6].map((s) => 'S' + s).join(' | ')} |`, '|---|---|---|---|---|---|---|');
for (const { name, r } of laeufe) L.push(`| ${name} | ${[1, 2, 3, 4, 5, 6].map((s) => { const q = r.zStufe[s] || {}; return `${q['sim:arrived'] || 0} / ${q['sim:atBuoy'] || 0} / ${q['sim:selfEntered.direct=true'] || 0} / ${q['sim:turnedAway.reason=queueFull'] || 0} / ${q['sim:moored.hand=true'] || 0}`; }).join(' | ')} |`);
L.push('', '### Je Stufe (erster Lauf jedes Spielers)', '');
for (const sp of ['aktiv', 'passiv']) {
  const l = laeufe.find((x) => x.r.spieler === sp); if (!l) continue;
  L.push(`#### ${l.name}`, '', '| Regel | ' + [1, 2, 3, 4, 5, 6].map((s) => 'S' + s).join(' | ') + ' |', '|---|---|---|---|---|---|---|');
  for (const [, t, k] of REGELN) L.push(`| ${t} | ${[1, 2, 3, 4, 5, 6].map((s) => l.r.zStufe[s]?.[k] || 0).join(' | ')} |`);
  L.push('');
}
L.push('## Aktionen des Spielers', '', `| Aktion | ${laeufe.map((l) => l.name).join(' | ')} |`, `|---|${laeufe.map(() => '---').join('|')}|`);
const ak = [...new Set(laeufe.flatMap((l) => Object.keys(l.r.aktion)))].sort();
for (const k of ak) L.push(`| ${k} | ${laeufe.map((l) => l.r.aktion[k] || 0).join(' | ')} |`);
L.push('', '## Summen', '', `| Summe | ${laeufe.map((l) => l.name).join(' | ')} |`, `|---|${laeufe.map(() => '---').join('|')}|`);
const sk = [...new Set(laeufe.flatMap((l) => Object.keys(l.r.sum)))].sort();
for (const k of sk) L.push(`| \`${k}\` | ${laeufe.map((l) => Math.round(l.r.sum[k] || 0)).join(' | ')} |`);
L.push('', '## Stand am Ende', '');
for (const { name, r } of laeufe) { const s = r.staende[r.staende.length - 1]; L.push(`- ${name}: \`${JSON.stringify({ ...s, stats: undefined, services: undefined })}\``); }
L.push('', '## Fehler aus der Konsole', '');
for (const { name, r } of laeufe) for (const f of r.fehler.slice(0, 20)) L.push(`- ${name}, ${f.wann}: ${f.text.replace(/\n/g, ' ')}`);
L.push('', '## Alle Zähler', '', `| Schlüssel | ${laeufe.map((l) => l.name).join(' | ')} |`, `|---|${laeufe.map(() => '---').join('|')}|`);
const alle = [...new Set(laeufe.flatMap((l) => Object.keys(l.r.z)))].sort();
for (const k of alle) L.push(`| \`${k}\` | ${laeufe.map((l) => l.r.z[k] || 0).join(' | ')} |`);
L.splice(L.indexOf('## Wie oft greift jede Regel'), 0, '## Funde (Regel greift nie)', '', ...(funde.length ? funde.map((f) => '- ' + f) : ['- keine']), '');
fs.writeFileSync(path.join(DIR, 'bericht.md'), L.join('\n') + '\n');
console.log(`${DIR}/bericht.md: ${laeufe.length} Läufe, ${funde.length} Funde`);
