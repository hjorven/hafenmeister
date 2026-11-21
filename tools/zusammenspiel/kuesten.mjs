// Zusammenspiel 3 (P85): Was baut der Ausbau zu Stufe 3 auf jeder Küste? Je Küste und Seed die Art des
// Engpasses (formen.js engpassArt: 'durchstich' = Land auf beiden Seiten, 'einfahrt' = Hafen am offenen
// Wasser) und die Zahl der Wellenbrecher in Stufe 3. Ergebnis als Markdown-Tabelle für docs/zusammenspiel.md.
// Aufruf im Repo-Ordner:
//   node tools/zusammenspiel/kuesten.mjs [--seeds 1-24]
import { FORMEN, formSetzen, engpassArt } from '../../web/js/render/landschaft/formen.js';
import { wellenbrecher } from '../../web/js/render/landschaft/gelaende.js';

const arg = process.argv.indexOf('--seeds');
const [a, b] = (arg > 0 ? process.argv[arg + 1] : '1-24').split('-').map(Number);
const seeds = Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);
console.log(`| Küste | Durchstich (Seeds von ${seeds.length}) | Molen und Wellenbrecher | Wellenbrecher in Stufe 3 (min bis max) |`);
console.log('|---|---|---|---|');
for (const f of FORMEN) {
  let d = 0, wmin = Infinity, wmax = 0;
  for (const s of seeds) {
    formSetzen(f.nr, s);
    if (engpassArt() === 'durchstich') d++;
    const w = wellenbrecher(3).length; wmin = Math.min(wmin, w); wmax = Math.max(wmax, w);
  }
  console.log(`| ${f.nr} ${f.name} | ${d} | ${seeds.length - d} | ${wmin} bis ${wmax} |`);
}
