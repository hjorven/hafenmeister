#!/usr/bin/env node
// Bericht aus einem Zeitraffer-Lauf (tools/zeitraffer/lauf.cjs): bericht.md und bericht.html
// im selben Ordner. Mit --einbetten werden die Bilder verkleinert in die HTML-Datei gelegt
// (eine Datei zum Weitergeben), sonst verweist sie auf bilder/.
//
//   node tools/zeitraffer/bericht.cjs /tmp/zeitraffer [--einbetten]
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(process.argv[2] || '.');
const EINBETTEN = process.argv.includes('--einbetten');
const laeufe = fs.readdirSync(DIR).filter((f) => /^ergebnis-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
if (!laeufe.length) { console.error('Keine ergebnis-*.json in ' + DIR); process.exit(1); }

// Erwartung aus tools/balance.mjs (Spielertyp geschickt, Median, Stand PR 181): Tag, an dem die Stufe erreicht ist
const ERWARTET = { 2: 14, 3: 52, 4: 94, 5: 145, 6: 206, ziel: 258 };
const ART = {
  land: 'Boot fährt über Land (Strand, Gelände)',
  steg: 'Boot fährt durch Steg oder Kai',
  fest: 'Boote stecken ineinander fest',
  ueberlapp: 'Boote überlappen (beide liegend, oder kurz in Fahrt ohne festzustecken)',
  haengt: 'Boot hängt (fährt, bewegt sich aber nicht)',
  pulk: 'Pulk: 12 oder mehr fahrende Boote im Umkreis von 45 m (je Spieltag ein Eintrag)',
  lange: 'Ein- oder Auslaufen dauert im Hafen länger als 10 Spielminuten',
  sim: 'Spielregeln: Zustand hängt oder Geld falsch',
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bild = (datei) => {
  if (!EINBETTEN) return datei;
  const f = path.join(DIR, datei);
  return fs.existsSync(f) ? 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') : datei;
};

const md = [];
const fehlerliste = [];
md.push(`# Zeitraffer-Bericht`, '');
const L0 = laeufe[0];
md.push(`Stand: ${L0.commit ?? 'lokal'}, gestartet ${L0.start.slice(0, 16).replace('T', ' ')} UTC, Tempo ${L0.tempo} (Testschalter \`?testtempo=${L0.tempo}\`).`, '');

for (const R of laeufe) {
  const v = R.verlauf; const letzt = v[v.length - 1] ?? {};
  md.push(`## ${R.geraet}`, '');
  md.push(`- Ergebnis: ${R.ende}`, `- Dauer: ${R.dauerMin} min Echtzeit, ${R.bilder.length} Bilder, ${R.nahbilder.length} Nahbilder`);
  md.push(`- Ende: Stufe ${letzt.stufe}, Tag ${letzt.tag}, Geld ${Math.round(letzt.geld ?? 0)} €, Ruf ${(letzt.ruf ?? 0).toFixed(2)}, Gäste gesamt ${letzt.gaeste}, abgewiesen ${letzt.abgewiesen}`, '');

  md.push('### Aufstieg', '', '| Stufe | erreicht an Tag | Erwartung (balance.mjs) | Echtzeit |', '|---|---|---|---|');
  for (const s of R.stufen) md.push(`| ${s.stufe} | ${s.tag} | ${ERWARTET[s.stufe] ?? '-'} | ${Math.floor(s.w / 60)} min ${s.w % 60} s |`);
  const ziel = v.find((x) => x.ziel?.ok);
  md.push(`| Ziel Stufe 6 | ${ziel ? ziel.tag : 'nicht erreicht'} | ${ERWARTET.ziel} | |`, '');
  if (letzt.stufe < 6 || !ziel) {
    const fehlt = letzt.ziel ? `Ziel fehlt: ${letzt.ziel.fehlt.join(', ')} (Besuche ${letzt.ziel.besuche}, offene Plätze ${letzt.ziel.offen})` : `Aufstieg fehlt: ${(letzt.aufstieg || []).join(', ')}`;
    md.push(`Stand am Ende: ${fehlt}.`, '');
  }
  for (const s of R.stufen) {
    const e = ERWARTET[s.stufe];
    if (e && (s.tag < e * 0.4 || s.tag > e * 2)) fehlerliste.push({ geraet: R.geraet, art: 'Aufstieg', text: `Stufe ${s.stufe} an Tag ${s.tag} erreicht, balance.mjs erwartet etwa Tag ${e}. Spiel im Browser und Balancing-Werkzeug laufen auseinander.` });
  }

  // Geld
  const geld = v.map((x) => x.geld);
  md.push('### Geld', '', `Kleinster Stand ${Math.round(Math.min(...geld))} €, größter ${Math.round(Math.max(...geld))} €, Einnahmen gesamt ${Math.round(letzt.einnahmen ?? 0)} €. Käufe: ${R.kaeufe.length} (davon fehlgeschlagen ${R.kaeufe.filter((k) => !k.ok).length}).`, '');
  const ersterKauf = R.kaeufe.find((k) => k.ok && k.art !== 'stufe');
  const wc = R.kaeufe.find((k) => k.ok && k.id === 'wc');
  const kaufTage = new Set(R.kaeufe.filter((k) => k.ok).map((k) => k.tag)).size;
  md.push(`Erster Kauf an Tag ${ersterKauf?.tag ?? '-'} (${ersterKauf ? ersterKauf.art + ' ' + ersterKauf.id : 'keiner'}), WC ab Tag ${wc?.tag ?? '-'}. Der Bot prüft jeden Spieltag, ob er etwas kaufen kann, und hat an ${kaufTage} Tagen gekauft.`, '');
  md.push('| Stufe | Käufe | davon Stege | Bauwerke | Hafenbüro | Services |', '|---|---|---|---|---|---|');
  for (let st = 1; st <= 6; st++) {
    const k = R.kaeufe.filter((x) => x.ok && x.stufe === st && x.art !== 'stufe');
    if (k.length) md.push(`| ${st} | ${k.length} | ${k.filter((x) => x.art === 'steg').length} | ${k.filter((x) => x.art === 'bauwerk').length} | ${k.filter((x) => x.art === 'buero').length} | ${k.filter((x) => x.art === 'service').length} |`);
  }
  md.push('');
  for (const k of R.kaeufe.filter((x) => !x.ok)) fehlerliste.push({ geraet: R.geraet, art: 'Kauf', text: `Kauf ${k.art} ${k.id} für ${k.kosten} € an Tag ${k.tag} schlug fehl, obwohl das Spiel ihn angeboten hat.` });

  // Prüfungen
  md.push('### Prüfungen', '', '| Prüfung | verschiedene Fälle | Proben mit Treffer | erstes Mal |', '|---|---|---|---|');
  for (const [k, name] of Object.entries(ART)) {
    const e = Object.entries(R.treffer[k] || {});
    const proben = e.reduce((a, [, m]) => a + m.mal, 0);
    md.push(`| ${name} | ${e.length} | ${proben} | ${e[0]?.[1].erst ?? '-'} |`);
    if (e.length) {
      const jeStufe = {}; for (const [, m] of e) jeStufe[m.stufe] = (jeStufe[m.stufe] || 0) + 1;
      fehlerliste.push({ geraet: R.geraet, art: name, text: `${e.length} Fälle (je Stufe: ${Object.entries(jeStufe).map(([s, n]) => `S${s} ${n}`).join(', ')}). Beispiele: ${e.slice(0, 3).map(([n, m]) => `${n} bei ${m.p?.join('/') ?? '-'} (${m.erst})`).join('; ')}`, bild: e.find(([, m]) => m.bild)?.[1].bild });
    }
  }
  md.push('');

  // Konsole
  md.push('### Konsole und Dateien', '');
  const fGruppen = {}; for (const f of R.fehler) { const k = f.text.slice(0, 160); (fGruppen[k] ||= { n: 0, wann: f.wann }).n++; }
  if (!R.fehler.length) md.push('Keine Fehler in der Konsole.');
  for (const [t, g] of Object.entries(fGruppen)) {
    md.push(`- ${g.n}x ab ${g.wann}: \`${t.replace(/`/g, "'")}\``);
    fehlerliste.push({ geraet: R.geraet, art: 'Konsole', text: `${g.n}x ab ${g.wann}: ${t}` });
  }
  const wGruppen = {}; for (const f of R.warnungen) { const k = f.text.slice(0, 120); (wGruppen[k] ||= { n: 0, wann: f.wann }).n++; }
  if (Object.keys(wGruppen).length) md.push('', 'Warnungen:', ...Object.entries(wGruppen).map(([t, g]) => `- ${g.n}x ab ${g.wann}: \`${t.replace(/`/g, "'")}\``));
  const fehlend = [...new Set(R.fehlendeDateien.map((d) => `${d.status} ${d.url.replace(/^https?:\/\/localhost:\d+/, '')}`))];
  if (fehlend.length) { md.push('', 'Fehlende Dateien:', ...fehlend.map((d) => `- ${d}`)); for (const d of fehlend) fehlerliste.push({ geraet: R.geraet, art: 'Datei fehlt', text: d }); }
  md.push('');

  // Speichern
  md.push('### Speichern und Laden', '', '| Wann | gespeichert | Abweichung nach dem Laden |', '|---|---|---|');
  for (const s of R.speichern) {
    md.push(`| ${s.warum} | ${s.gespeichert ? 'ja' : 'nein'} | ${s.abweichungen.length ? s.abweichungen.map((k) => `${k} vorher ${s.vorher[k]}, nachher ${s.nachher[k]}`).join('; ').replace(/\|/g, '/') : 'keine'} |`);
    if (!s.gespeichert || s.abweichungen.length) fehlerliste.push({ geraet: R.geraet, art: 'Speichern', text: `${s.warum}: ${s.gespeichert ? '' : 'nicht gespeichert; '}${s.abweichungen.map((k) => `${k} vorher ${s.vorher[k]}, nachher ${s.nachher[k]}`).join('; ')}` });
  }
  md.push('');

  // Wetter und Leistung
  // Logbuch: angelegte Bootsmodelle (state.logbook)
  const lb = R.logbuch?.ende;
  if (lb) {
    const je = Object.entries(lb.je).map(([g, j]) => `${g} ${j.gesehen}/${j.gesamt}`).join(', ');
    md.push('### Logbuch (angelegte Bootsmodelle)', '', `${lb.gesehen} von ${lb.gesamt} Modellen haben angelegt (${je}).`, '');
    const stufen = Object.entries(R.logbuch.jeStufe || {}).map(([st, x]) => `Stufe ${st}: ${x?.gesehen ?? '?'}`).join(', ');
    if (stufen) md.push(`Stand am Ende jeder Stufe: ${stufen}.`, '');
    if (lb.fehlt.length) {
      md.push('| Größe | Art | Modell | ab Stufe | Hinweis |', '|---|---|---|---|---|', ...lb.fehlt.map((f) => `| ${f.g} | ${f.art} | ${f.name} (${f.modell}) | ${f.ab} | ${f.unlock ? 'braucht ' + f.unlock : f.fest ? 'liegt fest' : ''} |`), '');
      const xxl = lb.fehlt.filter((f) => f.g === 'XXL');
      if (xxl.length) fehlerliste.push({ geraet: R.geraet, art: 'Logbuch', text: `${xxl.length} XXL-Modelle haben in der ganzen Partie nie angelegt: ${xxl.map((f) => f.name).join(', ')}` });
    }
  }
  md.push('### Wetter, Ereignisse und Bildrate', '');
  const jeEreignis = {};
  for (const l of R.leistung) { const k = l.ereignis || 'normal'; (jeEreignis[k] ||= []).push(l.fps); }
  md.push('| Ereignis | Proben | Bilder je Sekunde (Median) |', '|---|---|---|');
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const [k, a] of Object.entries(jeEreignis)) md.push(`| ${k} | ${a.length} | ${median(a).toFixed(1)} |`);
  md.push('', `Gesehene Ereignisse (Zahl der Bot-Schritte): ${Object.entries(R.wetter).map(([k, n]) => `${k} ${n}`).join(', ') || 'keine'}.`, '');
  md.push('Hinweis: Bildrate mit Software-Grafik im Container und bei vielen Spielschritten je Bild, nur im Vergleich der Ereignisse untereinander aussagekräftig.', '');
}

md.splice(4, 0, '## Fehlerliste', '', ...(fehlerliste.length ? fehlerliste.map((f, i) => `${i + 1}. **${f.art}** (${f.geraet}): ${f.text}${f.bild ? ` Bild: \`${f.bild}\`` : ''}`) : ['Keine Fehler gefunden.']), '');
fs.writeFileSync(path.join(DIR, 'bericht.md'), md.join('\n'));

// ------------------------------------------------------------------ HTML
const h = [];
h.push(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zeitraffer-Bericht</title><style>
:root{--bg:#f4f1ea;--fg:#1d2a33;--mut:#5d6b7a;--kante:#d9d3c6;--rot:#b3261e;--karte:#fff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#141b20;--fg:#e6e1d6;--mut:#9aa7b2;--kante:#2d3a43;--rot:#ff8a80;--karte:#1c252b}}
:root[data-theme="dark"]{--bg:#141b20;--fg:#e6e1d6;--mut:#9aa7b2;--kante:#2d3a43;--rot:#ff8a80;--karte:#1c252b}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;max-width:1200px;margin-inline:auto}
h1{font-size:24px}h2{font-size:20px;margin-top:32px;border-bottom:1px solid var(--kante)}h3{font-size:16px;margin-top:20px}
table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow-x:auto}td,th{border:1px solid var(--kante);padding:4px 8px;text-align:left}
.raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}.raster figure{margin:0;background:var(--karte);border:1px solid var(--kante)}
.raster img{width:100%;display:block}.raster figcaption{font-size:12px;color:var(--mut);padding:4px 6px}
ol li{margin-bottom:6px}code{font-size:13px;word-break:break-word}.mut{color:var(--mut)}
</style></head><body>`);
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
let inTab = false; let inList = null;
const schliessen = () => { if (inTab) { h.push('</table>'); inTab = false; } if (inList) { h.push(`</${inList}>`); inList = null; } };
for (const z of md) {
  if (z.startsWith('|')) {
    if (/^\|[-| ]+\|$/.test(z)) continue;
    if (!inTab) { schliessen(); h.push('<table>'); inTab = true; }
    h.push('<tr>' + z.slice(1, -1).split('|').map((c) => `<td>${inline(c.trim())}</td>`).join('') + '</tr>');
    continue;
  }
  const li = z.match(/^(\d+\.|-) (.*)$/);
  if (li) { const t = li[1] === '-' ? 'ul' : 'ol'; if (inList !== t) { schliessen(); h.push(`<${t}>`); inList = t; } h.push(`<li>${inline(li[2])}</li>`); continue; }
  schliessen();
  if (z.startsWith('### ')) h.push(`<h3>${esc(z.slice(4))}</h3>`);
  else if (z.startsWith('## ')) h.push(`<h2>${esc(z.slice(3))}</h2>`);
  else if (z.startsWith('# ')) h.push(`<h1>${esc(z.slice(2))}</h1>`);
  else if (z.trim()) h.push(`<p>${inline(z)}</p>`);
}
schliessen();
for (const R of laeufe) {
  if (R.nahbilder.length) {
    h.push(`<h2>Nahbilder der Funde (${esc(R.geraet)})</h2><p class="mut">Roter Kreis: Stelle des Fundes. Das Spiel ist für das Bild angehalten.</p><div class="raster">`);
    for (const b of R.nahbilder) h.push(`<figure><img loading="lazy" src="${bild(b.datei)}" alt=""><figcaption>${esc(b.label)}</figcaption></figure>`);
    h.push('</div>');
  }
  h.push(`<h2>Verlauf in Bildern (${esc(R.geraet)})</h2><div class="raster">`);
  for (const b of R.bilder) h.push(`<figure><img loading="lazy" src="${bild(b.datei)}" alt=""><figcaption>${esc(b.label)}</figcaption></figure>`);
  h.push('</div>');
}
h.push('</body></html>');
fs.writeFileSync(path.join(DIR, 'bericht.html'), h.join('\n'));
console.log(`${fehlerliste.length} Punkte in der Fehlerliste, ${path.join(DIR, 'bericht.md')}`);
