// Prüft, dass jedes liegende Boot ganz frei liegt: kein Rumpf schneidet einen Steg, eine Kaikante,
// Heckpfähle, die Seebrücke, festes Gerät (Slip, Mastenkran, Travellift), einen Dienstplatz, das Boot
// an einem anderen Platz oder Land. Gerechnet wird mit dem größten Boot, das die Spielregeln an den
// Platz lassen (Länge und Breite getrennt, also eher zu streng), an der Lage aus data/liegelage.js,
// die auch die Bootsanimation nimmt (render/boat-anim.js finalPose).
//
//   node tools/liegeplaetze/pruefen.mjs                  alle Stegbilder, Stufen und Küstenformen
//   node tools/liegeplaetze/pruefen.mjs --stegbild 3     nur ein Stegbild (Küstenform 1)
//   node tools/liegeplaetze/pruefen.mjs --form 4 --seed 53
//
// Als Modul: pruefeLiegeplaetze(hafen, stufe, { land }) -> [{ stufe, id, regel, text }]
import { HAFEN } from '../../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../../web/js/data/boat-catalog.js';
import { RULES } from '../../web/js/data/rules.js';
import { berthsFromHarbor, whyNotFit } from '../../web/js/sim.js';
import { liegeGeometrie, liegeRumpf, liegeVersatz, stegTeile, schneiden, strecke, zugleich, ABSTAND_M, U } from '../../web/js/data/liegelage.js';

const KLASSEN = ['S', 'M', 'L', 'XL'];
// Alle Modelle, die als Gast oder fester Lieger kommen können (XXL gehört zu den Services)
const MODELLE = BOAT_CATALOG.filter((t) => KLASSEN.includes(t.size)).flatMap((t) =>
  (t.models?.length ? t.models : [{ length: t.length[1], beam: t.beam[1], draft: t.draft[1] }]).map((m) => ({
    id: m.id ?? t.id, size: t.size, length: m.length, beam: m.beam, draft: m.draft ?? t.draft?.[1] ?? 1, stationed: !!t.stationed,
  })));

/** Größte Maße der Boote, die die Spielregeln an diesen Platz lassen: { laenge, breite, modelle } oder null. */
export function groesstesBoot(berth, stufe) {
  // Fest vergebene Plätze der Services (Pier, Marine, Seenotretter) haben eigene Schiffe (besuchswege.js)
  if (berth.reserved && berth.kind !== 'fischer') return null;
  let laenge = 0, breite = 0, n = 0;
  for (const m of MODELLE) {
    if (whyNotFit(m, berth, RULES, stufe)) continue;
    laenge = Math.max(laenge, m.length); breite = Math.max(breite, m.beam); n++;
  }
  return n ? { laenge, breite, modelle: n } : null;
}

/** Seebrücke als Fläche wie world/fahrwasser.js: vom Fuß (2 m an Land) bis 4,5 m hinter den Kopf, 10,5 m breit. */
export function brueckenFlaeche(sb) {
  if (!sb?.fuss || !sb?.kopf) return null;
  const dx = sb.kopf[0] - sb.fuss[0], dy = sb.kopf[1] - sb.fuss[1], l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l, hinten = 2 / U, vorn = 4.5 / U;
  return strecke([sb.fuss[0] - ux * hinten, sb.fuss[1] - uy * hinten], [sb.kopf[0] + ux * vorn, sb.kopf[1] + uy * vorn], Math.max(sb.breite ?? 14, 10.5 / U) / 2);
}

function punkteIm(poly, schritt = 1.2) {
  const [a, b, , d] = poly;
  const ex = [b[0] - a[0], b[1] - a[1]], ey = [d[0] - a[0], d[1] - a[1]];
  const nx = Math.max(2, Math.ceil(Math.hypot(...ex) / schritt)), ny = Math.max(1, Math.ceil(Math.hypot(...ey) / schritt));
  const out = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) out.push([a[0] + ex[0] * (i / nx) + ey[0] * (j / ny), a[1] + ex[1] * (i / nx) + ey[1] * (j / ny)]);
  return out;
}

/**
 * Alle Funde einer Stufe: [{ stufe, id, regel, text }]. opts.land(x, y) -> true auf Land (Planeinheiten),
 * opts.bruecke: Polygon der Seebrücke oder null, opts.nurPlaetze: nur diese Plätze prüfen.
 */
export function pruefeLiegeplaetze(hafen, stufe, opts = {}) {
  const fehler = [];
  const geo = liegeGeometrie(hafen, stufe);
  const berths = new Map(berthsFromHarbor(hafen, RULES).map((b) => [b.id, b]));
  const plaetze = new Map(hafen.plaetze.map((p) => [p.id, p]));
  const rumpf = new Map();
  for (const g of geo.values()) {
    const b = berths.get(g.id);
    const gross = b && groesstesBoot(b, stufe);
    if (!gross) continue;
    // Für den Landtest 0,3 m schmaler und kürzer: Bug und Heck laufen spitz zu, die Uferlinie im Bild ist weich
    rumpf.set(g.id, { poly: liegeRumpf(g, gross.laenge, gross.breite), kern: liegeRumpf(g, gross.laenge, gross.breite, -0.3 / U), gross, eigen: liegeVersatz(g, gross.laenge, gross.breite).eigen });
  }
  const teile = stegTeile(hafen, stufe);
  const ids = opts.nurPlaetze ? [...rumpf.keys()].filter((id) => opts.nurPlaetze.includes(id)) : [...rumpf.keys()];
  const melde = (id, regel, text) => fehler.push({ stufe, id, regel, text: `Stufe ${stufe} ${id}: ${text}` });
  for (const id of ids) {
    const r = rumpf.get(id), p = plaetze.get(id), g = geo.get(id);
    const masse = `${r.gross.laenge} x ${r.gross.breite} m`;
    for (const t of teile) {
      if (t.platz === id) continue;
      const tp = t.platz ? plaetze.get(t.platz) : null;
      if (tp && (p.doppel?.includes(tp.id) || tp.doppel?.includes(id) || !zugleich(p, tp))) continue;
      if (schneiden(r.poly, t.poly)) melde(id, 'steg', `Boot ${masse} schneidet ${t.name}`);
    }
    for (const [jd, s] of rumpf) {
      if (jd <= id) continue;
      const q = plaetze.get(jd);
      if (p.doppel?.includes(jd) || q.doppel?.includes(id) || !zugleich(p, q)) continue;
      // Nachbarn am selben Steg: Wer Platz vom Nachbarn braucht, prüft die Passregel (liegelage nachbarFrei)
      if (g.nachbarn?.includes(jd) && (!r.eigen || !s.eigen)) continue;
      if (schneiden(r.poly, s.poly)) melde(id, 'boot', `Boot ${masse} schneidet das Boot an ${jd} (${s.gross.laenge} x ${s.gross.breite} m)`);
    }
    if (opts.bruecke && schneiden(r.poly, opts.bruecke)) melde(id, 'bruecke', `Boot ${masse} liegt unter der Seebrücke`);
    if (opts.land) {
      const an = punkteIm(r.kern).filter(([x, y]) => opts.land(x, y));
      if (an.length) melde(id, 'land', `Boot ${masse}: ${an.length} Rumpfpunkte auf Land, etwa bei (${an[0][0].toFixed(0)}, ${an[0][1].toFixed(0)})`);
    }
  }
  return fehler;
}

// ---------------------------------------------------------------------------- Aufruf von der Kommandozeile
async function main() {
  const args = process.argv.slice(2);
  const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const { stegbildSetzen } = await import('../../web/js/data/stegbild.js');
  const { STEGBILDER } = await import('../../web/js/data/stegbilder.js');
  const { punkt } = await import('../../web/js/render/landschaft/gelaende.js');
  const { region } = await import('../../web/js/render/landschaft/regionen.js');
  const { FORMEN, formSetzen } = await import('../../web/js/render/landschaft/formen.js');
  const { seebrueckeStrecke } = await import('../../web/js/render/landschaft/strand.js');
  const ostsee = region('ostsee');
  const kopie = () => JSON.parse(JSON.stringify(HAFEN));
  const bilder = arg('--stegbild') != null ? [Number(arg('--stegbild'))] : [...Array(STEGBILDER.varianten.length + 1).keys()];
  const formen = arg('--form') != null ? [Number(arg('--form'))] : (arg('--stegbild') != null ? [1] : FORMEN.map((f) => f.nr));
  const seed = arg('--seed') != null ? Number(arg('--seed')) : undefined;
  const alle = [];
  for (const nr of bilder) {
    for (const f of nr === 0 || arg("--form") != null ? formen : [1]) {
      formSetzen(f, seed ?? 1);
      const h = stegbildSetzen(kopie(), nr);
      for (let stufe = 1; stufe <= 6; stufe++) {
        const sb = seebrueckeStrecke(stufe);
        const bruecke = brueckenFlaeche(sb);
        const land = (x, y) => punkt(x, y, stufe, ostsee).h >= 0;
        for (const e of pruefeLiegeplaetze(h, stufe, { land, bruecke })) alle.push(`Stegbild ${nr}, Form ${f}${seed != null ? ` Seed ${seed}` : ''}: ${e.text}`);
      }
    }
  }
  formSetzen(1);
  const gesehen = new Set();
  for (const z of alle) if (!gesehen.has(z)) { gesehen.add(z); console.log(z); }
  console.log(`${gesehen.size} Funde.`);
  process.exitCode = gesehen.size ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
