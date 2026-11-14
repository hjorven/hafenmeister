// Prüft viele Seeds je Küstentyp: Fahrwasser, Wartebojen, Ankerplätze, Liegeplatztiefen, Leuchttürme an Land, Seeweg.
// Aufruf: node tools/seeds-pruefen.mjs [Seeds je Typ, Standard 50] [erster Seed, Standard 1]
// Gibt jeden Seed aus, der durchfällt, und endet dann mit Fehlercode 1.
import { FORMEN, formSetzen } from '../web/js/render/landschaft/formen.js';
import { punkt, warteplaetze, warteplatzTiefe, leuchttuerme } from '../web/js/render/landschaft/gelaende.js';
import { festePunkte } from '../web/js/render/landschaft/karte.js';
import { REGIONEN } from '../web/js/render/landschaft/regionen.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { seezugaenge } from '../web/js/render/landschaft/zonen.js';

const anzahl = Number(process.argv[2] || 50), ab = Number(process.argv[3] || 1);
const fehler = [];
const t0 = Date.now();
for (const F of FORMEN) {
  for (let seed = ab; seed < ab + anzahl; seed++) {
    formSetzen(F.nr, seed);
    const f = [];
    for (const R of ['ostsee', 'nordsee']) {
      const reg = REGIONEN[R];
      for (const st of [1, 2, 3, 4, 5, 6]) {
        for (const [px, py] of festePunkte(st).fahrwasser) if (-punkt(px, py, st, reg).h < (st <= 2 ? 1.6 : 3)) f.push(`${R} Stufe ${st} Fahrwasser ${px},${py}`);
        const w = warteplaetze(st);
        for (const b of w.bojen) if (-punkt(b.px, b.py, st, reg).h <= 1.2) f.push(`${R} Stufe ${st} Boje ${b.id}`);
        for (const a of w.ankerplaetze) if (-punkt(a.px, a.py, st, reg).h <= 1.0) f.push(`${R} Stufe ${st} Anker ${a.id}`);
        // ganzer Schwoikreis im Wasser, nicht nur die Mitte
        for (const o of [...w.bojen, ...w.ankerplaetze]) if (warteplatzTiefe(o, st, reg) < 0.8) f.push(`${R} Stufe ${st} Schwoikreis ${o.id} am Ufer`);
      }
      // Seeweg: von außerhalb der Karte über mindestens 2,5 m tiefes Wasser bis vor die Einfahrt, aus mehreren Richtungen
      for (const st of R === 'ostsee' ? [1, 3, 6] : [3]) {
        const zug = seezugaenge(st, R);
        if (!zug.length || zug.some((q) => q.aufKarte)) f.push(`${R} Stufe ${st} kein Seeweg von außerhalb der Karte`);
        else if (zug[0].tiefeM < 2.5) f.push(`${R} Stufe ${st} Seeweg nur ${zug[0].tiefeM} m tief`);
        else if (new Set(zug.map((q) => q.richtung)).size < 3) f.push(`${R} Stufe ${st} Seeweg aus zu wenigen Richtungen`);
      }
      for (const p of HAFEN.plaetze) for (const [st, l] of Object.entries(p.lage)) {
        const soll = p.tiefe?.[st];
        if (soll != null && -punkt(l[0], l[1], Number(st), reg).h < soll - 0.4) f.push(`${R} ${p.id} Stufe ${st} zu flach`);
      }
      for (const [x, y] of leuchttuerme()) if (punkt(x, y, 3, reg).h <= 0.3) f.push(`${R} Leuchtturm ${x},${y} im Wasser`);
    }
    if (f.length) { fehler.push(`Typ ${F.nr} Seed ${seed}: ${f.slice(0, 4).join('; ')}${f.length > 4 ? ` (+${f.length - 4})` : ''}`); console.log(fehler[fehler.length - 1]); }
  }
  console.log(`Typ ${F.nr} (${F.name}): ${anzahl} Seeds geprüft`);
}
console.log(`${FORMEN.length * anzahl} Seeds in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${fehler.length} durchgefallen.`);
process.exit(fehler.length ? 1 : 0);
