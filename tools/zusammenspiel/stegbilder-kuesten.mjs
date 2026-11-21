// Zusammenspiel 3 (P85): jedes Stegbild auf einer Küste, so wie das Spiel es setzt (data/stegbild.js).
// Prüft je Stufe die Regeln aus tools/stegbilder/pruefen.mjs (Überlappung, Gasse, Tiefe, Einfahrt vom
// offenen Wasser) und aus tools/liegeplaetze/pruefen.mjs (liegende Boote frei von Land, Steg und Nachbarn).
// Eine Küste je Aufruf, weil die Tiefenspeicher der Prüfungen nicht nach Küste getrennt sind.
//   node tools/zusammenspiel/stegbilder-kuesten.mjs --form 4 [--seed 1]
//   for f in $(seq 1 15); do node tools/zusammenspiel/stegbilder-kuesten.mjs --form $f; done
import { HAFEN } from '../../web/js/data/harbor.js';
import { STEGBILDER } from '../../web/js/data/stegbilder.js';
import { stegbildSetzen } from '../../web/js/data/stegbild.js';
import { formSetzen } from '../../web/js/render/landschaft/formen.js';
import { punkt } from '../../web/js/render/landschaft/gelaende.js';
import { region } from '../../web/js/render/landschaft/regionen.js';
import { seebrueckeStrecke } from '../../web/js/render/landschaft/strand.js';
import { pruefeStegbild } from '../stegbilder/pruefen.mjs';
import { pruefeLiegeplaetze, brueckenFlaeche } from '../liegeplaetze/pruefen.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const form = arg('--form', 1), seed = arg('--seed', 1);
formSetzen(form, seed);
const ostsee = region('ostsee');
const zeilen = [];
for (let nr = 0; nr <= STEGBILDER.varianten.length; nr++) {
  const h = stegbildSetzen(JSON.parse(JSON.stringify(HAFEN)), nr);
  const funde = [];
  funde.push(...pruefeStegbild(h, { stege: ['A', 'B', 'C', 'CS', 'D'], stufen: [1, 2, 3, 4, 5] }).map((e) => `Stufe ${e.stufe} ${e.id ?? e.steg}: ${e.regel}`));
  funde.push(...pruefeStegbild(h, { stege: ['A', 'B', 'C', 'CS', 'D', 'Y'], stufen: [6] }).map((e) => `Stufe ${e.stufe} ${e.id ?? e.steg}: ${e.regel}`));
  for (let stufe = 1; stufe <= 6; stufe++) {
    const land = (x, y) => punkt(x, y, stufe, ostsee).h >= 0;
    funde.push(...pruefeLiegeplaetze(h, stufe, { land, bruecke: brueckenFlaeche(seebrueckeStrecke(stufe)) }).map((e) => `Stufe ${stufe} ${e.id}: liegen ${e.regel ?? ''}`));
  }
  const eindeutig = [...new Set(funde)];
  zeilen.push({ form, seed, stegbild: nr, funde: eindeutig.length, beispiele: eindeutig.slice(0, 4) });
}
console.log(JSON.stringify(zeilen));
