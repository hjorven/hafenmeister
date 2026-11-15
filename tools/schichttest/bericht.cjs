// Schichttest: Bericht als Markdown aus ergebnis-<gerät>.json (wird von lauf.cjs geschrieben).
// Einzeln: node tools/schichttest/bericht.cjs DIR/ergebnis-pc.json
const fs = require('fs');

function bericht(R) {
  const z = [];
  z.push(`# Schichttest ${R.geraet}`, '');
  z.push(`Stand ${R.commit ?? '?'}, gestartet ${R.start}, ${R.dauerMin} min.`);
  if (R.ausgangslage) z.push(`Ausgangslage: Geländeform ${R.ausgangslage.gelaende}, Seed ${R.ausgangslage.seed}, Stegbild ${R.ausgangslage.stegbild}.`);
  z.push('', '| Schicht | Name | Prüfpunkte | Funde | Konsolenfehler | Dauer |', '|---|---|---|---|---|---|');
  for (const s of R.schichten) z.push(`| ${s.nr} | ${s.name} | ${s.punkte} | ${s.funde} | ${s.fehler} | ${s.sekunden} s |`);
  z.push('', '## Funde', '');
  if (!R.funde.length) z.push('Keine.');
  for (const f of R.funde) z.push(`- **${f.schicht} ${f.name}** (${f.schwere}): ${f.detail}${f.bild ? ` [Bild](${f.bild})` : ''}`);
  if (R.fehler.length) {
    z.push('', '## Konsolenfehler', '');
    const zaehl = new Map();
    for (const f of R.fehler) { const k = f.text; zaehl.set(k, { n: (zaehl.get(k)?.n ?? 0) + 1, f }); }
    for (const [k, v] of zaehl) z.push(`- ${v.f.schicht}, ${v.n}x: ${k}${v.f.stack ? ` (${v.f.stack})` : ''}`);
  }
  z.push('', '## Alle Prüfpunkte', '');
  for (const p of R.punkte) z.push(`- ${p.hinweis ? 'Info' : p.ok ? 'ok' : '**Fund**'} ${p.schicht} ${p.name}${p.detail ? ': ' + p.detail : ''}${p.bild ? ` [Bild](${p.bild})` : ''}`);
  return z.join('\n') + '\n';
}

module.exports = { bericht };
if (require.main === module) process.stdout.write(bericht(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))));
