// Vorschau aller Pixel-Symbole aus web/js/ui/pixel-symbole.js als Bild.
// Aufruf (aus dem Repo-Ordner):  node tools/pixel-symbole-vorschau.mjs [ziel.png]
// Braucht Playwright aus tests/node_modules (bash tests/pruefen.sh installiert es).
import { createRequire } from 'node:module';
import { PIXEL, pixelSvg } from '../web/js/ui/pixel-symbole.js';

const require = createRequire(import.meta.url);
const { chromium } = require('../tests/node_modules/playwright');
const ziel = process.argv[2] || 'pixel-symbole.png';

// Einfache Anführungszeichen: die url() steht in einem style="..."-Attribut
const url = (svg) => `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
const istMaske = (r) => r.some((z) => z.includes('#'));
const NAMEN = {
  pause: 'Pause', tempo1: '1x', tempo2: '3x', tempo3: '8x', menue: 'Menü', uebersicht: 'Übersicht', foto: 'Fotomodus',
  ton: 'Ton', stumm: 'Stumm', spielstand: 'Spielstand', tasten: 'Tastatur', bauen: 'Bauen', ziele: 'Tagesziele',
  flagge: 'Ausbau', zu: 'Schließen', zahnrad: 'Einstellungen', haken: 'Erledigt', kreis: 'Offen', pfeil: 'Pfeil',
  pfeilschraeg: 'Pfeil schräg', warnung: 'Achtung', hinweis: 'Neuigkeit', muenze: 'Geld', stern: 'Ruf', sonne: 'Sonne',
  mond: 'Mond', wolke: 'Wolken', regen: 'Regen', sturm: 'Sturm', nebel: 'Nebel', schnee: 'Schnee', regatta: 'Regatta',
  fest: 'Hafenfest', schiff: 'Kreuzfahrt',
};

const kachel = ([k, r]) => {
  const bild = istMaske(r)
    ? `<i style="background:#24364a;-webkit-mask:${url(pixelSvg(r))} center/48px 48px no-repeat"></i>
       <div class="dunkel"><i style="background:#fffaf0;-webkit-mask:${url(pixelSvg(r))} center/48px 48px no-repeat"></i></div>`
    : `<i style="background:${url(pixelSvg(r))} center/48px 48px no-repeat"></i>`;
  return `<div class="k"><div class="b">${bild}</div><span>${NAMEN[k] ?? k}</span></div>`;
};
const eintraege = Object.entries(PIXEL);
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; background: #9fc7bd; font: 600 14px system-ui, sans-serif; color: #24364a; width: 1032px; }
  h1 { margin: 0 0 4px; font-size: 22px; } p { margin: 0 0 16px; }
  h2 { margin: 18px 0 8px; font-size: 16px; }
  .g { display: grid; grid-template-columns: repeat(8, 120px); gap: 9px; }
  .k { background: #fffaf0; border: 3px solid #24364a; box-shadow: 0 4px 0 rgba(20,32,48,.3); padding: 10px 4px 8px; text-align: center; }
  .b { display: flex; justify-content: center; gap: 6px; height: 52px; align-items: center; }
  i { display: block; width: 48px; height: 48px; image-rendering: pixelated; }
  .dunkel { background: #2e4560; }
  span { display: block; margin-top: 6px; }
</style>
<h1>Hafenmeister: Pixel-Symbole</h1>
<p>12 x 12 Pixel, hier 4-fach. Bedienknöpfe sind Masken (links auf Papier, rechts auf Tinte), Anzeigen haben feste Farben mit Tintenumriss.</p>
<h2>Bedienung</h2><div class="g">${eintraege.filter(([, r]) => istMaske(r)).map(kachel).join('')}</div>
<h2>Anzeigen, Wetter und Ereignisse</h2><div class="g">${eintraege.filter(([, r]) => !istMaske(r)).map(kachel).join('')}</div>`;

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1080, height: 600 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: ziel, fullPage: true });
await b.close();
console.log(`Vorschau geschrieben: ${ziel}`);
