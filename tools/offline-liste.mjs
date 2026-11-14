// Schreibt die Liste aller Dateien, die das Spiel zum Start braucht, nach <ordner>/offline-liste.json.
// Der Service Worker (web/sw.js) lädt sie nach dem ersten Besuch komplett in den Speicher des
// Browsers, damit das Spiel danach auch ohne Netz startet (P61).
//
// Aufruf (macht tools/build-pages.sh automatisch):
//   node tools/offline-liste.mjs _site
//
// "stand" ist ein Fingerabdruck über Namen und Inhalt aller Dateien. Nur wenn er sich ändert,
// lädt der Service Worker die Dateien neu (ein neuer Deploy ohne Änderung am Spiel kostet nichts).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ordner = path.resolve(process.argv[2] || '_site');
// Was zum Spiel gehört. Nicht dabei: Roadmap, Pixel-Seite, Vorschauen (eigene Seiten, groß).
const EINZELN = ['index.html', 'manifest.webmanifest'];
const ORDNER = ['css', 'fonts', 'icons', 'js', 'vendor'];

function alle(rel) {
  const voll = path.join(ordner, rel);
  if (!fs.existsSync(voll)) return [];
  if (fs.statSync(voll).isFile()) return [rel];
  return fs.readdirSync(voll).sort().flatMap((n) => alle(path.posix.join(rel, n)));
}

const dateien = [...EINZELN, ...ORDNER].flatMap(alle)
  .filter((rel) => !path.posix.basename(rel).startsWith('.') && !rel.endsWith('.md'));
if (!dateien.includes('index.html')) {
  console.error(`offline-liste: ${ordner}/index.html fehlt.`);
  process.exit(1);
}

const hash = crypto.createHash('sha256');
let bytes = 0;
for (const rel of dateien) {
  const inhalt = fs.readFileSync(path.join(ordner, rel));
  bytes += inhalt.length;
  hash.update(rel + '\0').update(crypto.createHash('sha256').update(inhalt).digest());
}
const liste = { stand: hash.digest('hex').slice(0, 16), bytes, dateien };
fs.writeFileSync(path.join(ordner, 'offline-liste.json'), JSON.stringify(liste, null, 1) + '\n');
console.log(`offline-liste.json: ${dateien.length} Dateien, ${(bytes / 1e6).toFixed(1)} MB, Stand ${liste.stand}`);
