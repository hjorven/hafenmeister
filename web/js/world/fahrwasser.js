// Fahrwasser: Wege fuer Boote, berechnet aus der Karte des Gelaendes statt aus festen Wegpunkten.
//
// Reine Rechnung ohne Three.js und ohne game, damit die Spiellogik und node --test sie nutzen koennen.
// Weltmeter wie ueberall im Spiel: x = Osten, z = Sueden (Norden ist -z).
//
// Ablauf:
// 1. baueKarte(): Raster ueber das Revier. Jede Zelle kennt ihre Wassertiefe und ihren Abstand zum
//    naechsten Hindernis (Land, Mole, Strand, Steg, Liegeplatz). Hindernisse kommen als Linien
//    (Steg mit Breite) und gedrehte Rechtecke (Liegeplaetze) herein.
// 2. route(): kuerzester Weg (A*) fuer ein Boot mit Radius r und Tiefgang t. Eine Zelle ist nur
//    befahrbar, wenn der Abstand zum naechsten Hindernis >= r ist und das Wasser tief genug ist.
//    Der Weg bleibt bevorzugt in der Mitte des freien Wassers und meidet weiche Zonen (Bojenfeld,
//    Ankerfeld). Danach wird er geglaettet (Sichtlinien) und, wo Platz ist, nach Steuerbord versetzt
//    (rechts fahren wie im echten Fahrwasser).
// 3. engstellen: Bereiche, in denen zwei Boote der Referenzgroesse nicht aneinander vorbei passen.
//    route() meldet, welche Engstellen ein Weg durchfaehrt (Einbahn-Freigabe in boat-anim.js).

const SQRT2 = Math.SQRT2;

/**
 * Raster bauen.
 * @param {object} o
 * @param {(x:number, z:number) => number} o.tiefe  Wassertiefe in Metern (0 oder negativ = Land)
 * @param {{x0:number,x1:number,z0:number,z1:number}} o.bereich  Weltmeter
 * @param {number} [o.zelle]  Kantenlaenge einer Zelle in Metern
 * @param {Array} [o.linien]  [{ punkte: [{x,z},...], breite }]  z. B. Stege, Molen als Linie
 * @param {Array} [o.rechtecke]  [{ x, z, h, l, b, id }]  h = Kurs in Bogenmass (wie boat-anim), l/b Meter
 * @param {Array} [o.weich]  [{ x, z, r, kosten }]  Zonen, die Wege nach Moeglichkeit meiden
 * @param {number} [o.mindestTiefe]  flacher gilt als Land (Strand, Sandbank)
 * @param {number} [o.engRadius]  Referenzradius fuer Engstellen (Boot halbe Breite plus Abstand)
 */
export function baueKarte(o) {
  const zelle = o.zelle ?? 1.5;
  const { x0, x1, z0, z1 } = o.bereich;
  const nx = Math.ceil((x1 - x0) / zelle), nz = Math.ceil((z1 - z0) / zelle);
  const n = nx * nz;
  const tiefe = new Float32Array(n);
  const hart = new Uint8Array(n);        // 1 = Hindernis
  const sperre = new Uint8Array(n);      // 1 = Steg oder Liegeplatz (fuer die Pruefung, ohne Land)
  const mt = o.mindestTiefe ?? 0.25;
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * zelle;
    for (let i = 0; i < nx; i++) {
      const t = o.tiefe(x0 + (i + 0.5) * zelle, z);
      const k = j * nx + i;
      tiefe[k] = t;
      if (!(t >= mt)) hart[k] = 1;
    }
  }
  const karte = { zelle, nx, nz, x0, z0, x1: x0 + nx * zelle, z1: z0 + nz * zelle, tiefe, hart, sperre };
  for (const l of o.linien ?? []) zeichneLinie(karte, l.punkte, l.breite);
  for (const r of o.rechtecke ?? []) zeichneRechteck(karte, r);
  karte.frei = abstandsfeld(karte);
  karte.weich = new Float32Array(n);
  for (const w of o.weich ?? []) weicheZone(karte, w);
  karte.engRadius = o.engRadius ?? 3.5;
  karte.eng = engstellen(karte, karte.engRadius);
  return karte;
}

const idx = (k, x, z) => {
  const i = Math.floor((x - k.x0) / k.zelle), j = Math.floor((z - k.z0) / k.zelle);
  if (i < 0 || j < 0 || i >= k.nx || j >= k.nz) return -1;
  return j * k.nx + i;
};
const mitte = (k, c) => ({ x: k.x0 + ((c % k.nx) + 0.5) * k.zelle, z: k.z0 + (Math.floor(c / k.nx) + 0.5) * k.zelle });

function markiere(k, c) { if (c >= 0) { k.hart[c] = 1; k.sperre[c] = 1; } }

function zeichneLinie(k, pts, breite) {
  const r = breite / 2 + k.zelle * 0.5;
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1], b = pts[s];
    const minx = Math.min(a.x, b.x) - r, maxx = Math.max(a.x, b.x) + r;
    const minz = Math.min(a.z, b.z) - r, maxz = Math.max(a.z, b.z) + r;
    const dx = b.x - a.x, dz = b.z - a.z, ll = dx * dx + dz * dz || 1;
    for (let z = minz; z <= maxz + k.zelle; z += k.zelle) {
      for (let x = minx; x <= maxx + k.zelle; x += k.zelle) {
        const c = idx(k, x, z);
        if (c < 0) continue;
        const m = mitte(k, c);
        const t = Math.max(0, Math.min(1, ((m.x - a.x) * dx + (m.z - a.z) * dz) / ll));
        if (Math.hypot(m.x - a.x - t * dx, m.z - a.z - t * dz) <= r) markiere(k, c);
      }
    }
  }
}

function zeichneRechteck(k, r) {
  const fx = Math.cos(r.h), fz = -Math.sin(r.h);
  const l = r.l / 2 + k.zelle * 0.35, b = r.b / 2 + k.zelle * 0.35;
  const rad = Math.hypot(l, b);
  for (let z = r.z - rad; z <= r.z + rad + k.zelle; z += k.zelle) {
    for (let x = r.x - rad; x <= r.x + rad + k.zelle; x += k.zelle) {
      const c = idx(k, x, z);
      if (c < 0) continue;
      const m = mitte(k, c);
      const rx = m.x - r.x, rz = m.z - r.z;
      if (Math.abs(rx * fx + rz * fz) <= l && Math.abs(rx * -fz + rz * fx) <= b) markiere(k, c);
    }
  }
}

function weicheZone(k, w) {
  const rr = w.r + k.zelle;
  for (let z = w.z - rr; z <= w.z + rr; z += k.zelle) {
    for (let x = w.x - rr; x <= w.x + rr; x += k.zelle) {
      const c = idx(k, x, z);
      if (c < 0) continue;
      const m = mitte(k, c);
      const d = Math.hypot(m.x - w.x, m.z - w.z);
      if (d <= w.r) k.weich[c] = Math.max(k.weich[c], (w.kosten ?? 2) * (1 - (d / w.r) * 0.5));
    }
  }
}

// Abstand jeder Zelle zum naechsten Hindernis in Metern (Chamfer 3-4, auf 2 % genau genug).
// Der Kartenrand zaehlt nicht als Hindernis (dort geht das offene Wasser weiter).
function abstandsfeld(k) {
  const { nx, nz, hart } = k;
  const d = new Float32Array(nx * nz);
  const INF = 1e9;
  for (let c = 0; c < d.length; c++) d[c] = hart[c] ? 0 : INF;
  const a = 1, b = SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i;
    let v = d[c];
    if (v === 0) continue;
    if (i > 0) v = Math.min(v, d[c - 1] + a);
    if (j > 0) {
      v = Math.min(v, d[c - nx] + a);
      if (i > 0) v = Math.min(v, d[c - nx - 1] + b);
      if (i < nx - 1) v = Math.min(v, d[c - nx + 1] + b);
    }
    d[c] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const c = j * nx + i;
    let v = d[c];
    if (v === 0) continue;
    if (i < nx - 1) v = Math.min(v, d[c + 1] + a);
    if (j < nz - 1) {
      v = Math.min(v, d[c + nx] + a);
      if (i < nx - 1) v = Math.min(v, d[c + nx + 1] + b);
      if (i > 0) v = Math.min(v, d[c + nx - 1] + b);
    }
    d[c] = v;
  }
  // Zellmitte zu Hinderniskante: eine halbe Zelle abziehen
  for (let c = 0; c < d.length; c++) d[c] = d[c] >= INF ? 999 : Math.max(0, (d[c] - 0.5) * k.zelle);
  return d;
}

// Engstellen: befahrbar fuer ein Boot mit Radius r, aber zwei Boote passen nicht nebeneinander.
// Das ist der Fall, wo das freie Wasser schmaler als 4 r ist, also der Abstand zur Kante in der
// Mitte unter 2 r liegt. Zusammenhaengende Zellen bilden eine Engstelle mit eigener Nummer.
function engstellen(k, r) {
  const { nx, nz, frei } = k;
  const id = new Int32Array(nx * nz).fill(-1);
  const liste = [];
  // Nur Zellen auf dem "Kamm" des freien Wassers: Mittellinie eines Kanals
  const eng = (c) => frei[c] >= r && frei[c] < 2 * r + 0.5;
  // Kanalmitte: kein Nachbar hat deutlich mehr freien Abstand in Querrichtung
  const stapel = [];
  for (let c = 0; c < nx * nz; c++) {
    if (id[c] !== -1 || !eng(c)) continue;
    // Ist hier ueberhaupt Kanal und nicht nur Rand einer weiten Flaeche? Pruefen, ob innerhalb
    // von 2 r + 1 m eine Zelle mit viel Platz liegt.
    if (weitInDerNaehe(k, c, 2 * r + 0.5, r * 2 + 2)) continue;
    const nr = liste.length;
    const e = { nr, zellen: 0, sx: 0, sz: 0, sxx: 0, szz: 0, sxz: 0 };
    stapel.length = 0;
    stapel.push(c);
    id[c] = nr;
    while (stapel.length) {
      const q = stapel.pop();
      const m = mitte(k, q);
      e.zellen++; e.sx += m.x; e.sz += m.z; e.sxx += m.x * m.x; e.szz += m.z * m.z; e.sxz += m.x * m.z;
      const i = q % nx, j = (q - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const w = jj * nx + ii;
        if (id[w] !== -1 || !eng(w) || weitInDerNaehe(k, w, 2 * r + 0.5, r * 2 + 2)) continue;
        id[w] = nr;
        stapel.push(w);
      }
    }
    // Hauptachse der Engstelle (Kovarianz), Richtung der Durchfahrt
    const cx = e.sx / e.zellen, cz = e.sz / e.zellen;
    const vxx = e.sxx / e.zellen - cx * cx, vzz = e.szz / e.zellen - cz * cz, vxz = e.sxz / e.zellen - cx * cz;
    const ang = 0.5 * Math.atan2(2 * vxz, vxx - vzz);
    liste.push({ nr, x: cx, z: cz, ax: Math.cos(ang), az: Math.sin(ang), laenge: Math.sqrt(Math.max(vxx, vzz)) * 3.4, zellen: e.zellen });
  }
  // Winzige Flecken (einzelne Zellen am Rand eines Stegkopfs) sind keine Engstelle
  for (const e of liste) if (e.zellen * k.zelle * k.zelle < 30) e.klein = true;
  for (let c = 0; c < id.length; c++) if (id[c] >= 0 && liste[id[c]].klein) id[c] = -1;
  return { id, liste: liste.filter((e) => !e.klein) };
}

function weitInDerNaehe(k, c, grenze, radius) {
  const n = Math.ceil(radius / k.zelle);
  const i0 = c % k.nx, j0 = (c - i0) / k.nx;
  for (let dj = -n; dj <= n; dj++) {
    const j = j0 + dj;
    if (j < 0 || j >= k.nz) continue;
    for (let di = -n; di <= n; di++) {
      const i = i0 + di;
      if (i < 0 || i >= k.nx || di * di + dj * dj > n * n) continue;
      if (k.frei[j * k.nx + i] >= grenze) return true;
    }
  }
  return false;
}

/** Ist ein Boot mit Radius r und Tiefgang t an (x, z) in freiem, tiefem Wasser? */
export function befahrbar(k, x, z, r, t = 0) {
  const c = idx(k, x, z);
  if (c < 0) return true;                     // ausserhalb der Karte: offenes Wasser
  return k.frei[c] >= r && k.tiefe[c] >= t;
}

/** Abstand zum naechsten Hindernis an (x, z) in Metern. */
export function freiBei(k, x, z) {
  const c = idx(k, x, z);
  return c < 0 ? 999 : k.frei[c];
}

/** Liegt (x, z) auf einem Steg oder Liegeplatz der Karte (nicht Land)? */
export function gesperrt(k, x, z) {
  const c = idx(k, x, z);
  return c >= 0 && k.sperre[c] === 1;
}

// Naechste befahrbare Zelle zu (x, z), Breitensuche bis maxM Meter.
function naechsteFreie(k, x, z, r, t, maxM = 80) {
  let c = idx(k, x, z);
  if (c < 0) {
    // ausserhalb: auf den Rand klemmen
    const i = Math.max(0, Math.min(k.nx - 1, Math.floor((x - k.x0) / k.zelle)));
    const j = Math.max(0, Math.min(k.nz - 1, Math.floor((z - k.z0) / k.zelle)));
    c = j * k.nx + i;
  }
  const ok = (q) => k.frei[q] >= r && k.tiefe[q] >= t;
  if (ok(c)) return c;
  const n = Math.ceil(maxM / k.zelle);
  const i0 = c % k.nx, j0 = (c - i0) / k.nx;
  for (let ring = 1; ring <= n; ring++) {
    let best = -1, bd = Infinity;
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= k.nx || j >= k.nz) continue;
        const q = j * k.nx + i;
        if (!ok(q)) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = q; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

// Von s aus erreichbare Zelle, die (x, z) am naechsten liegt (Flutfuellung).
function naechsteErreichbare(k, s, x, z, r, t) {
  const { nx, nz, frei, tiefe } = k;
  const seen = new Uint8Array(nx * nz);
  const q = [s];
  seen[s] = 1;
  let best = -1, bd = Infinity;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const m = mitte(k, c);
    const d = (m.x - x) ** 2 + (m.z - z) ** 2;
    if (d < bd) { bd = d; best = c; }
    const i = c % nx, j = (c - i) / nx;
    if (i > 0 && !seen[c - 1] && frei[c - 1] >= r && tiefe[c - 1] >= t) { seen[c - 1] = 1; q.push(c - 1); }
    if (i < nx - 1 && !seen[c + 1] && frei[c + 1] >= r && tiefe[c + 1] >= t) { seen[c + 1] = 1; q.push(c + 1); }
    if (j > 0 && !seen[c - nx] && frei[c - nx] >= r && tiefe[c - nx] >= t) { seen[c - nx] = 1; q.push(c - nx); }
    if (j < nz - 1 && !seen[c + nx] && frei[c + nx] >= r && tiefe[c + nx] >= t) { seen[c + nx] = 1; q.push(c + nx); }
  }
  return best;
}

/** Zusammenhaengende befahrbare Flaeche ab (x, z) fuer Radius r und Tiefgang t, als Uint8Array je Zelle. */
export function erreichbar(k, x, z, r, t = 0) {
  const s = naechsteFreie(k, x, z, r, t);
  const seen = new Uint8Array(k.nx * k.nz);
  if (s < 0) return seen;
  const { nx, nz, frei, tiefe } = k;
  const q = [s];
  seen[s] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const i = c % nx, j = (c - i) / nx;
    for (const w of [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, j > 0 ? c - nx : -1, j < nz - 1 ? c + nx : -1]) {
      if (w < 0 || seen[w] || frei[w] < r || tiefe[w] < t) continue;
      seen[w] = 1;
      q.push(w);
    }
  }
  return seen;
}

/** Zellindex und Zellmitte fuer Aufrufer (Startpunkte am Rand suchen). */
export const zelleBei = idx;
export const zellMitte = mitte;

// Binaerer Heap fuer A*
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/**
 * Weg von a nach b fuer ein Boot.
 * @param {object} k  Karte aus baueKarte
 * @param {{x,z}} a  Start (Weltmeter)
 * @param {{x,z}} b  Ziel
 * @param {object} [o]  r: Radius (halbe Breite plus Abstand), t: Tiefgang plus Reserve,
 *   rechts: Versatz nach Steuerbord in Metern, mitte: wie stark die Kanalmitte bevorzugt wird
 * @returns {{ punkte: Array<{x,z}>, engstellen: Array<{nr, ein, aus, richtung}>, ok: boolean, laenge: number }}
 *   punkte ohne a, mit b. ok = false, wenn es keinen Weg gibt (dann direkte Linie).
 */
export function route(k, a, b, o = {}) {
  const erst = routeMit(k, a, b, o);
  // Ist das Ziel fuer den vollen Tiefgang nicht erreichbar (zu flaches Wasser auf dem Weg), lieber
  // flach fahren als quer ueber Land: zweiter Versuch mit kleinem Tiefgang, als 'flach' markiert.
  if ((!erst.ok || !erst.amZiel) && (o.t ?? 0.5) > 0.6 && o.flachErlaubt !== false) {
    const zweit = routeMit(k, a, b, { ...o, t: 0.5 });
    if (zweit.ok && zweit.amZiel) return { ...zweit, flach: true };
  }
  return erst;
}

function routeMit(k, a, b, o) {
  const r = o.r ?? 3, t = o.t ?? 0.5;
  // Engster erlaubter Abstand (Rumpf plus Handbreit): nur am Anfang und Ende eines Wegs, in der
  // Gasse vor einer Box oder beim Ablegen. Unterwegs kostet jede Zelle unter r viel.
  const rMin = Math.min(r, o.rMin ?? r);
  const s = naechsteFreie(k, a.x, a.z, rMin, t);
  const g = naechsteFreie(k, b.x, b.z, rMin, t);
  if (s < 0 || g < 0) return { punkte: [{ x: b.x, z: b.z }], engstellen: [], ok: false, laenge: Math.hypot(b.x - a.x, b.z - a.z) };
  let zellen = astern(k, s, g, r, t, o.mitte ?? 1, rMin);
  let zielErreicht = !!zellen;
  if (!zellen) {
    // Ziel liegt in einer abgeschnittenen Tasche (zwischen Stegen, hinter einer Mole): zur
    // naechsten vom Start erreichbaren Zelle fahren, den Rest erledigt das Anlegen.
    const g2 = naechsteErreichbare(k, s, b.x, b.z, rMin, t);
    if (g2 >= 0) zellen = astern(k, s, g2, r, t, o.mitte ?? 1, rMin);
  }
  if (!zellen) return { punkte: [{ x: b.x, z: b.z }], engstellen: [], ok: false, laenge: Math.hypot(b.x - a.x, b.z - a.z) };
  // Glaetten: nur Zellen behalten, zwischen denen eine freie Sichtlinie liegt
  // Bedarf je Zelle: r, aber nie mehr, als an dieser Stelle des gefundenen Wegs frei ist
  const bedarf = zellen.map((c) => Math.max(rMin, Math.min(r, k.frei[c])));
  let pts = glaetten(k, zellen, bedarf, t).map(({ c, need }) => ({ ...mitte(k, c), need }));
  // Zielpunkt genau setzen, wenn die letzte Strecke dorthin frei ist (sonst endet der Weg davor)
  const letzter = pts[pts.length - 1];
  if (zielErreicht && sichtlinie(k, letzter, b, rMin - 0.05, t)) pts[pts.length - 1] = { x: b.x, z: b.z, need: Math.min(letzter.need, Math.max(rMin, freiBei(k, b.x, b.z))) };
  else zielErreicht = false;          // Ziel selbst liegt nicht frei: Weg endet davor
  pts = verdichten(pts, Math.max(8, r * 3));
  if (o.rechts) pts = rechtsHalten(k, pts, o.rechts, t);
  pts = pts.map((p) => ({ x: p.x, z: p.z }));
  // Startpunkt (Zelle des Starts) nicht wiederholen, wenn das Boot schon dort ist
  if (pts.length > 1 && Math.hypot(pts[0].x - a.x, pts[0].z - a.z) < k.zelle * 1.5) pts.shift();
  let laenge = 0, px = a.x, pz = a.z;
  for (const p of pts) { laenge += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
  return { punkte: pts, engstellen: engstellenAuf(k, a, pts), ok: true, amZiel: zielErreicht, laenge };
}

function astern(k, s, g, r, t, mitteGewicht, rMin = r) {
  const { nx, nz, frei, tiefe, weich } = k;
  const n = nx * nz;
  const gx = g % nx, gz = (g - gx) / nx;
  const kosten = new Float32Array(n).fill(Infinity);
  const von = new Int32Array(n).fill(-1);
  const zu = new Uint8Array(n);
  const h = new Heap();
  kosten[s] = 0;
  h.push(0, s);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];
  // Kanalmitte bevorzugen: Zellen nah an einer Kante kosten mehr (bis 4 r)
  const zusatz = (c) => {
    const f = frei[c] - r;
    if (f < 0) return 12 + 30 * (-f / Math.max(0.5, r - rMin)) + weich[c];   // enger als gewuenscht
    const kante = f < 3 * r ? mitteGewicht * (1 - f / (3 * r)) * 1.5 : 0;
    return kante + weich[c];
  };
  let schritte = 0;
  while (h.size) {
    const c = h.pop();
    if (zu[c]) continue;
    if (c === g) break;
    zu[c] = 1;
    if (++schritte > n) break;
    const ci = c % nx, cj = (c - ci) / nx;
    for (const [di, dj, w] of NB) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const q = j * nx + i;
      if (zu[q] || frei[q] < rMin || tiefe[q] < t) continue;
      // diagonal nicht zwischen zwei Hinderniszellen hindurch
      if (w > 1 && (frei[cj * nx + i] < rMin || frei[j * nx + ci] < rMin)) continue;
      const neu = kosten[c] + w * (1 + zusatz(q));
      if (neu < kosten[q]) {
        kosten[q] = neu;
        von[q] = c;
        const hx = Math.abs(i - gx), hz = Math.abs(j - gz);
        h.push(neu + (Math.max(hx, hz) + (SQRT2 - 1) * Math.min(hx, hz)), q);
      }
    }
  }
  if (von[g] === -1 && g !== s) return null;
  const out = [];
  for (let c = g; c !== -1; c = von[c]) out.push(c);
  return out.reverse();
}

// Ist die Strecke p-q fuer Radius r frei? Probe alle halbe Zelle.
export function sichtlinie(k, p, q, r, t = 0) {
  // Jede Zelle, die die Strecke beruehrt (Zellen-Durchlauf nach Amanatides/Woo), nicht nur
  // Stichproben: sonst schneidet die Gerade unbemerkt die Ecke einer zu engen Zelle.
  const ok = (i, j) => {
    if (i < 0 || j < 0 || i >= k.nx || j >= k.nz) return true;
    const c = j * k.nx + i;
    return k.frei[c] >= r && k.tiefe[c] >= t;
  };
  const fx = (p.x - k.x0) / k.zelle, fz = (p.z - k.z0) / k.zelle;
  const gx = (q.x - k.x0) / k.zelle, gz = (q.z - k.z0) / k.zelle;
  let i = Math.floor(fx), j = Math.floor(fz);
  const iEnd = Math.floor(gx), jEnd = Math.floor(gz);
  const dx = gx - fx, dz = gz - fz;
  const si = dx > 0 ? 1 : dx < 0 ? -1 : 0, sj = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tdx = si ? Math.abs(1 / dx) : Infinity, tdz = sj ? Math.abs(1 / dz) : Infinity;
  let tx = si > 0 ? (i + 1 - fx) * tdx : si < 0 ? (fx - i) * tdx : Infinity;
  let tz = sj > 0 ? (j + 1 - fz) * tdz : sj < 0 ? (fz - j) * tdz : Infinity;
  if (!ok(i, j)) return false;
  for (let n = 0; n < 100000 && (i !== iEnd || j !== jEnd); n++) {
    if (Math.abs(tx - tz) < 1e-9) {
      // genau durch eine Ecke: beide Nachbarn pruefen
      if (!ok(i + si, j) || !ok(i, j + sj)) return false;
      i += si; j += sj; tx += tdx; tz += tdz;
    } else if (tx < tz) { i += si; tx += tdx; } else { j += sj; tz += tdz; }
    if (tx > 1 + tdx && tz > 1 + tdz) break;
    if (!ok(i, j)) return false;
  }
  return true;
}

// Sichtlinien-Glaettung: von einer Zelle so weit wie moeglich geradeaus. Die Gerade darf nirgends
// enger werden als der gefundene Weg dazwischen (need = kleinster Bedarf auf dem Stueck).
function glaetten(k, zellen, bedarf, t) {
  const out = [{ c: zellen[0], need: bedarf[0] }];
  if (zellen.length <= 2) { if (zellen.length === 2) out.push({ c: zellen[1], need: bedarf[1] }); return out; }
  let i = 0;
  while (i < zellen.length - 1) {
    const p = mitte(k, zellen[i]);
    let need = bedarf[i], best = i + 1, bestNeed = Math.min(need, bedarf[i + 1]);
    for (let j = i + 1; j < zellen.length; j++) {
      need = Math.min(need, bedarf[j]);
      // nur jede vierte Zelle (und die letzte) pruefen, das reicht fuer gerade Stuecke
      if (j !== zellen.length - 1 && (j - i) % 4 !== 0) continue;
      if (sichtlinie(k, p, mitte(k, zellen[j]), need - 0.05, t)) { best = j; bestNeed = need; }
      else if (j - best > 24) break;
    }
    out.push({ c: zellen[best], need: bestNeed });
    i = best;
  }
  return out;
}

// Lange gerade Stuecke unterteilen, damit der Rechts-Versatz und die Kurven sauber werden
function verdichten(pts, maxL) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / maxL);
    for (let s = 1; s < n; s++) out.push({ x: a.x + ((b.x - a.x) * s) / n, z: a.z + ((b.z - a.z) * s) / n, need: b.need ?? a.need });
    out.push(b);
  }
  return out;
}

// Nach Steuerbord versetzen, so weit das freie Wasser es erlaubt. Erster und letzter Punkt bleiben.
function rechtsHalten(k, pts, d, t) {
  const out = pts.map((p) => ({ ...p }));
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], c = pts[i + 1];
    const dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz) || 1;
    // Steuerbord zur Fahrtrichtung (dx, dz) ist (-dz, dx) in x/z
    const sx = -dz / l, sz = dx / l;
    let off = d;
    while (off > 0.4) {
      const q = { x: pts[i].x + sx * off, z: pts[i].z + sz * off, need: pts[i].need };
      if (befahrbar(k, q.x, q.z, pts[i].need + 0.5, t)) { out[i] = q; break; }
      off *= 0.6;
    }
  }
  // Der Versatz darf keine Strecke enger machen: sonst Punkt zurueck auf die Mitte
  for (let n = 0; n < 12; n++) {
    let geaendert = false;
    for (let i = 1; i < out.length; i++) {
      if (out[i - 1] === pts[i - 1] && out[i] === pts[i]) continue;
      const need = Math.min(pts[i - 1].need, pts[i].need) - 0.05;
      if (!sichtlinie(k, out[i - 1], out[i], need, t)) { out[i - 1] = pts[i - 1]; out[i] = pts[i]; geaendert = true; }
    }
    if (!geaendert) break;
  }
  return out;
}

// Welche Engstellen liegen auf dem Weg, mit Weglaenge bei Ein- und Austritt und Fahrtrichtung (+1/-1 zur Achse)
function engstellenAuf(k, a, pts) {
  const out = [];
  if (!k.eng?.liste.length) return out;
  let s = 0, px = a.x, pz = a.z, akt = null;
  for (const p of pts) {
    const d = Math.hypot(p.x - px, p.z - pz);
    const n = Math.max(1, Math.ceil(d / (k.zelle * 0.5)));
    for (let i = 1; i <= n; i++) {
      const x = px + ((p.x - px) * i) / n, z = pz + ((p.z - pz) * i) / n;
      const c = idx(k, x, z);
      const e = c >= 0 ? k.eng.id[c] : -1;
      const ss = s + (d * i) / n;
      if (akt && e !== akt.nr) {
        // erst nach ein paar Metern ausserhalb gilt die Engstelle als verlassen
        if (ss - akt.zuletzt > 6) { akt.aus = akt.zuletzt; akt = null; }
      }
      if (e >= 0) {
        if (akt && akt.nr === e) akt.zuletzt = ss;
        else if (!akt) {
          const vor = out.find((q) => q.nr === e && ss - q.aus < 12);
          if (vor) { akt = vor; akt.zuletzt = ss; continue; }
          const eng = k.eng.liste.find((q) => q.nr === e);
          const dir = (p.x - px) * eng.ax + (p.z - pz) * eng.az;
          akt = { nr: e, ein: ss, zuletzt: ss, aus: ss, richtung: dir >= 0 ? 1 : -1 };
          out.push(akt);
        }
      }
    }
    s += d; px = p.x; pz = p.z;
  }
  if (akt) akt.aus = akt.zuletzt;
  for (const q of out) delete q.zuletzt;
  return out;
}

/** Radius und Tiefgang fuer ein Boot aus { beam, draft, size }. */
export function bootMass(info) {
  const B = info.beam ?? (info.length ?? 6) * 0.33;
  const rand = { S: 1.2, M: 1.4, L: 1.6, XL: 2.5, XXL: 4 }[info.size] ?? 1.5;
  // r: Abstand der Bahn zu allem. Dazu ein Anteil der Laenge, weil Bug und Heck in Kurven (um
  // Molenkoepfe, Stegenden) nach aussen schwenken.
  const L = info.length ?? B * 3;
  return { r: B / 2 + rand + 0.15 * L, rMin: B / 2 + 0.35, t: (info.draft ?? 1) + 0.3 };
}

/**
 * Hindernisse einer Stufe aus den Hafendaten (harbor.js, nach Stegbild): Steglinien mit Breite und
 * alle Liegeplaetze als Rechtecke. Planeinheiten werden in Weltmeter umgerechnet.
 * @param {object} hafen  HAFEN
 * @param {number} stufe
 * @param {object} [o]  nurIds: Set der Liegeplatz-ids, die als Rechteck zaehlen (sonst alle der Stufe)
 */
export function hindernisseAusHafen(hafen, stufe, o = {}) {
  const U = hafen.einheiten?.meterProEinheit ?? 0.62;
  const st = hafen.stufen?.[stufe] ?? hafen.stufen?.[String(stufe)];
  const linien = (st?.stege ?? []).map((l) => ({
    punkte: l.punkte.map(([x, y]) => ({ x: x * U, z: -y * U })),
    // Holzsteg mit Pfaehlen an der Seite, Schwimmsteg mit Dalben: etwas breiter als die Planken
    breite: Math.max(1.2, (l.breite ?? 2) * U) + (l.bauart === 'kai' ? 0.5 : 0.8),
    steg: l.steg ?? null,
  }));
  const rechtecke = [];
  for (const p of hafen.plaetze ?? []) {
    const lage = p.lage?.[stufe] ?? p.lage?.[String(stufe)];
    if (!lage) continue;
    if (o.nurIds && !o.nurIds.has(p.id)) continue;
    const [x, y, richtung] = lage;
    rechtecke.push({ id: p.id, x: x * U, z: -y * U, h: (richtung * Math.PI) / 180, l: p.laenge * U, b: p.breite * U, art: p.art });
  }
  return { linien, rechtecke };
}
