// Wege und Liegeplätze der Besuchsschiffe (web/js/data/besuchswege.js) und Lage der Anlagen
// (web/js/data/services.js, anlagen-flaechen.js) gegen Gelände, Stege und Liegeplätze aller Stegbilder.
// Ausführen im Repo-Ordner:  node --test tests/besuchswege.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAFEN } from '../web/js/data/harbor.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { AUFTRITTE, RUNDFAHRTEN, seenotPlatz, seenotEinsatzWeg, SEENOT_MASSE } from '../web/js/data/besuchswege.js';
import { SERVICES } from '../web/js/data/services.js';
import { anlagenFlaechen } from '../web/js/data/anlagen-flaechen.js';
import { punkt, BEREICH } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';

const U = 0.62;
const ostsee = region('ostsee');
const RAD = Math.PI / 180;
const kopie = () => JSON.parse(JSON.stringify(HAFEN));
const ANZAHL_BILDER = STEGBILDER.varianten.length;

// Tiefgang in Metern je Modell (data/boats/xxl.js, xl.js), mit 0,3 m Luft
const TIEFGANG = { kreuzfahrtschiff: 7.2, korvette: 4.0, minenjagdboot: 2.8, ausflugsschiff: 1.8, xl: 3.0, barkasse: 1.2, seenot: 1.9 };
const tiefgang = (modell) => (modell.startsWith('xl:') ? TIEFGANG.xl : TIEFGANG[modell] ?? 2) + 0.3;

// Punkte eines Schiffsrumpfs (Rechteck Länge x Breite in Metern) um (px, py) mit Kurs in Grad
function rumpf(px, py, kurs, [lm, bm]) {
  const l = lm / U, b = bm / U, c = Math.cos(kurs * RAD), s = Math.sin(kurs * RAD), pts = [];
  const nl = Math.max(2, Math.ceil(l / 4)), nb = Math.max(1, Math.ceil(b / 4));
  for (let i = 0; i <= nl; i++) for (let j = 0; j <= nb; j++) {
    const u = (i / nl - 0.5) * l, v = (j / nb - 0.5) * b;
    pts.push([px + u * c - v * s, py + u * s + v * c]);
  }
  return pts;
}

// Schiffslagen entlang eines Wegs (alle 3 Einheiten) mit dem Kurs, den render/services-besuch.js fährt
function lagen(weg, kursVon) {
  const out = [];
  for (let i = 1; i < weg.length; i++) {
    const [ax, ay] = weg[i - 1], [bx, by] = weg[i];
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 3));
    const fahrt = Math.atan2(by - ay, bx - ax) / RAD;
    for (let k = 0; k <= n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, kurs: kursVon(i - 1, fahrt), seg: i - 1 });
  }
  return out;
}

// Alle Fahrten eines Schiffs: am Platz, Ablegen, Einlaufen
function fahrten(d, lage) {
  const [vx, vy] = d.liegeVersatz ?? [0, 0];
  const platz = lage ? [lage[0] + vx, lage[1] + vy] : d.weg[0];
  const weg = [platz, ...d.weg.slice(1)];
  const ankunft = d.ankunft ? [...d.ankunft.slice(0, -1), platz] : [...weg].reverse();
  const raus = lagen(weg, (seg, fahrt) => (d.raus === 'rueckwaerts' || seg === 0 ? d.liegeKurs : fahrt));
  const rein = lagen(ankunft, (seg, fahrt) => (d.rein === 'rueckwaerts' || seg === ankunft.length - 2 ? d.liegeKurs : fahrt));
  return { platz, liegen: { x: platz[0], y: platz[1], kurs: d.liegeKurs }, raus, rein };
}

const imBereich = ([x, y]) => x > BEREICH.x0 + 2 && x < BEREICH.x1 - 2 && y > BEREICH.y0 + 2 && y < BEREICH.y1 - 2;

function abstandStrecke(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

// Steglinien einer Stufe (mit halber Stegbreite in Planeinheiten), Kaikanten haben Breite 0
function stegLinien(h, stufe, ohne = []) {
  const out = [];
  for (const l of h.stufen[stufe]?.stege ?? []) {
    if (ohne.includes(l.steg)) continue;
    for (let i = 1; i < l.punkte.length; i++) out.push({ a: l.punkte[i - 1], b: l.punkte[i], r: (l.breite ?? 2) / 2, steg: l.steg });
  }
  return out;
}

// Boote an Liegeplätzen einer Stufe als Rumpfpunkte (Höchstmaße des Platzes)
function liegeplatzBoote(h, stufe, ohne = []) {
  const out = [];
  for (const p of h.plaetze) {
    const l = p.lage?.[stufe];
    if (!l || ohne.includes(p.id)) continue;
    out.push({ id: p.id, x: l[0], y: l[1], kurs: l[2], l: p.maxLaenge, b: p.maxBreite });
  }
  return out;
}
function inBoot(px, py, bo, rand = 0) {
  const c = Math.cos(bo.kurs * RAD), s = Math.sin(bo.kurs * RAD), dx = px - bo.x, dy = py - bo.y;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return Math.abs(u) <= bo.l / U / 2 + rand && Math.abs(v) <= bo.b / U / 2 + rand;
}

// Prüft eine Fahrt; gibt die ersten Fehler als Text zurück
function pruefeFahrt(name, lagenListe, masse, tief, { stufe, h, stegeOhne = [], plaetzeOhne = [], tiefeAb = 0 }) {
  const fehler = [];
  const linien = stegLinien(h, stufe, stegeOhne);
  const boote = liegeplatzBoote(h, stufe, plaetzeOhne);
  for (const q of lagenListe) {
    for (const [x, y] of rumpf(q.x, q.y, q.kurs, masse)) {
      if (!imBereich([x, y])) continue;
      const t = -punkt(x, y, stufe, ostsee).h;
      if (t < tief - tiefeAb) { fehler.push(`${name}: Grund bei (${x.toFixed(0)}, ${y.toFixed(0)}), ${t.toFixed(1)} m < ${tief.toFixed(1)} m, Schiff bei (${q.x.toFixed(0)}, ${q.y.toFixed(0)}) Kurs ${q.kurs.toFixed(0)}`); break; }
      const st = linien.find((s) => abstandStrecke(x, y, s.a, s.b) < s.r + 0.5);
      if (st) { fehler.push(`${name}: über Steg ${st.steg} bei (${x.toFixed(0)}, ${y.toFixed(0)}), Schiff bei (${q.x.toFixed(0)}, ${q.y.toFixed(0)}) Kurs ${q.kurs.toFixed(0)}`); break; }
      const bo = boote.find((b) => inBoot(x, y, b, -0.5));
      if (bo) { fehler.push(`${name}: berührt Liegeplatz ${bo.id} bei (${x.toFixed(0)}, ${y.toFixed(0)})`); break; }
    }
    if (fehler.length >= 3) break;
  }
  return fehler;
}

// Stege, an denen ein Schiff selbst liegt (die darf es am Platz berühren)
const EIGENER_STEG = { P01: ['P'], MA01: ['MA'], MA02: ['MA'], K01: ['K'] };

function pruefeAuftritte(nr) {
  const h = stegbildSetzen(kopie(), nr);
  const fehler = [];
  for (const [id, a] of Object.entries(AUFTRITTE)) {
    for (const d of a.schiffe) {
      const stufe = d.stufe ?? 6;
      const lage = d.platz ? h.plaetze.find((q) => q.id === d.platz)?.lage?.[stufe] : null;
      if (d.platz) assert.ok(lage, `${id}: Liegeplatz ${d.platz} fehlt in harbor.js Stufe ${stufe}`);
      const f = fahrten(d, lage);
      const name = `Stegbild ${nr}, ${id} ${d.modell}`;
      const opt = { stufe, h, stegeOhne: EIGENER_STEG[d.platz] ?? [], plaetzeOhne: [d.platz] };
      // Ablegen und Einlaufen ohne das erste/letzte Wegstück am eigenen Steg
      // Am Platz liegt das Schiff dicht an Kai oder Pier: Rumpf dort um ein Viertel schmaler pruefen
      fehler.push(...pruefeFahrt(`${name} liegt`, [f.liegen], [d.masse[0], d.masse[1] * 0.75], tiefgang(d.modell), opt));
      fehler.push(...pruefeFahrt(`${name} legt ab`, f.raus.filter((q) => q.seg > 0), d.masse, tiefgang(d.modell), { ...opt, stegeOhne: [] }));
      fehler.push(...pruefeFahrt(`${name} läuft ein`, f.rein.filter((q, i, arr) => q.seg < arr[arr.length - 1].seg), d.masse, tiefgang(d.modell), { ...opt, stegeOhne: [] }));
    }
  }
  return fehler;
}

test('Besuchsschiffe liegen und fahren im tiefen Wasser, ohne Stege und belegte Liegeplätze zu berühren (Grundbild)', () => {
  const fehler = pruefeAuftritte(0);
  assert.deepEqual(fehler, []);
});

test('Besuchsschiffe kommen in jedem Stegbild frei an ihren Platz', () => {
  const fehler = [];
  for (let nr = 1; nr <= ANZAHL_BILDER; nr++) fehler.push(...pruefeAuftritte(nr));
  assert.deepEqual(fehler, []);
});

test('Großschiffe am Platz überdecken sich nicht', () => {
  const liste = [];
  for (const [id, a] of Object.entries(AUFTRITTE)) for (const d of a.schiffe) {
    const lage = d.platz ? HAFEN.plaetze.find((q) => q.id === d.platz)?.lage?.[d.stufe ?? 6] : d.weg[0];
    if ((d.stufe ?? 6) === 6) liste.push({ id: `${id}/${d.modell}`, x: lage[0], y: lage[1], kurs: d.liegeKurs, l: d.masse[0], b: d.masse[1] });
  }
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    const beruehrt = rumpf(a.x, a.y, a.kurs, [a.l, a.b]).some(([x, y]) => inBoot(x, y, b, 6));
    assert.ok(!beruehrt, `${a.id} und ${b.id} liegen weniger als 6 Einheiten auseinander`);
  }
});

test('Seenotretter fahren frei durch die Einfahrt hinaus', () => {
  for (let nr = 0; nr <= ANZAHL_BILDER; nr++) {
    const h = stegbildSetzen(kopie(), nr);
    for (const [gross, stufe] of [[false, 4], [false, 5], [true, 6]]) {
      const weg = seenotEinsatzWeg(gross);
      const masse = gross ? SEENOT_MASSE.gross : SEENOT_MASSE.klein;
      const ls = lagen(weg, (seg, fahrt) => fahrt).filter((q) => q.seg > 0 || Math.hypot(q.x - weg[0][0], q.y - weg[0][1]) > 12);
      const fehler = pruefeFahrt(`Stegbild ${nr} Stufe ${stufe} Seenotretter`, ls, masse, TIEFGANG.seenot + 0.3, { stufe, h, plaetzeOhne: gross ? ['SK01'] : [] });
      assert.deepEqual(fehler, []);
    }
  }
  assert.ok(seenotPlatz(true).x < 100 && seenotPlatz(false).x > 150);
});

test('Barkasse fährt auf beiden Rundfahrten im Wasser und an keinem Steg vorbei durch (alle Stegbilder)', () => {
  for (let nr = 0; nr <= ANZAHL_BILDER; nr++) {
    const h = stegbildSetzen(kopie(), nr);
    for (const r of RUNDFAHRTEN) {
      const ls = lagen(r.weg, (seg, fahrt) => fahrt);
      const fehler = pruefeFahrt(`Stegbild ${nr} Barkasse ${r.name}`, ls, [16, 4.4], TIEFGANG.barkasse + 0.3, { stufe: 6, h });
      assert.deepEqual(fehler, []);
    }
  }
});

test('Bauplätze der Services liegen an Land, nicht auf Stegen, nicht im Wasser', () => {
  const fehler = [];
  for (const s of SERVICES) {
    const lagenListe = [s.lage, ...s.stufen.map((st) => st.lage).filter(Boolean)];
    for (const l of lagenListe) for (let stufe = Math.max(1, s.abStufe); stufe <= 6; stufe++) {
      const h = punkt(l.x, l.y, stufe, ostsee).h;
      // Slip und Bootsverleih stehen mit Absicht an der Wasserkante
      if (h < (['slip', 'bootsverleih'].includes(s.id) ? -0.6 : 0.3)) fehler.push(`${s.id} Stufe ${stufe}: Boden ${h.toFixed(2)} m bei (${l.x}, ${l.y})`);
      const st = stegLinien(HAFEN, stufe).find((q) => abstandStrecke(l.x, l.y, q.a, q.b) < q.r + 3);
      if (st) fehler.push(`${s.id} Stufe ${stufe}: auf Steg ${st.steg}`);
    }
  }
  assert.deepEqual(fehler, []);
});

test('Anlagenflächen sind auf der Höhe planiert, die gelaende.js daraus macht', () => {
  for (let stufe = 1; stufe <= 6; stufe++) for (const f of anlagenFlaechen(stufe)) {
    const xs = f.poly.map((q) => q[0]), ys = f.poly.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const h = punkt(cx, cy, stufe, ostsee).h;
    assert.ok(Math.abs(h - (f.hoehe ?? 1.2)) < 0.25, `${f.id} Stufe ${stufe}: Mitte auf ${h.toFixed(2)} m statt ${f.hoehe}`);
  }
});
