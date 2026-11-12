// Bahnen und Flotte der vorbeifahrenden Boote (render/boats/verkehr.js), ohne Grafik,
// damit tests/verkehr.test.mjs sie ohne three.js prüfen kann. Koordinaten in Planeinheiten
// (x nach Osten, y nach Norden) wie web/js/data/harbor.js.

export const U = 0.62;                                    // Meter je Planeinheit (wie harbor.js)
export const welt = (px, py) => ({ x: px * U, z: -py * U });

// --- Bahnen in Planeinheiten (x nach Osten, y nach Norden) ---------------------------------------
// Wartebojen und Ankerflächen: render/landschaft/gelaende.js warteplaetze(); Molen, Buhnen und
// Fahrrinne ebenda. "klein" für S bis L, "gross" für L bis XXL. Die Bahnen beginnen und enden weit
// außerhalb der Karte. Rechtsverkehr: ostwärts auf der Landseite, westwärts weiter draußen.
// Ab Stufe 3 biegen die kleinen Bahnen vor der Einfahrt nach Norden ab, damit sie in der Startansicht
// zu sehen sind und trotzdem Reede, Ankerflächen und Fahrrinne im Osten frei lassen.
export const SEE_X = 440;            // Ostende, außerhalb der Karte (Karte bis x 306)
// Im Westen liegt ab x -360 Land, die Küste zieht nach Norden. Dort kommen und gehen die Boote
// längs der Küste von Norden; innere (südliche) Bahnen biegen weiter westlich ab, damit sich nichts kreuzt.
const westen = (y, xKurve) => [[xKurve - 14, 760], [xKurve, y + 50], [xKurve + 40, y]];
const ostwaerts = (y, xKurve, rest = [[SEE_X, y]]) => [...westen(y, xKurve), ...rest];
const westwaerts = (y, xKurve, vorher = [[SEE_X, y]]) => [...vorher, ...westen(y, xKurve).reverse()];
export const SEE = {
  // Noch kein Durchstich: die See ist frei, Bahnen gut 6 m vor den Buhnenköpfen (y bis 254)
  1: [
    { pts: ostwaerts(264, -340), art: 'klein' }, { pts: westwaerts(278, -326), art: 'klein' },
    { pts: ostwaerts(306, -298), art: 'gross' }, { pts: westwaerts(326, -278), art: 'gross' },
  ],
  // Stufe 3 und 4: Molenköpfe bis y 268 (x 149 bis 187), Rinne bis y 356 (x 152 bis 212),
  // Reede ab x 222, Ankerfeld um (345, 385) mit Radius 62. Die kleinen Bahnen biegen vor der Einfahrt nach Norden ab.
  3: [
    { pts: ostwaerts(292, -340, [[50, 292], [112, 326], [176, 470], [206, 760]]), art: 'klein' },
    { pts: westwaerts(306, -326, [[192, 760], [162, 474], [100, 340], [46, 306]]), art: 'klein' },
    { pts: ostwaerts(472, -300), art: 'gross' }, { pts: westwaerts(492, -280), art: 'gross' },
  ],
  // Ab Stufe 5: Außenhafen mit Westmole bis (96, 320), Rinne bis y 356 (x 108 bis 184),
  // Ankerfeld für Große um (30, 440) mit Radius 85, Reede ab x 226, Ankerfeld um (360, 440). XXL (bis 29 m breit) nur auf der äußersten Bahn.
  5: [
    { pts: ostwaerts(268, -340, [[-112, 268], [-52, 294], [-34, 330], [30, 333], [86, 337], [118, 352], [140, 420], [170, 520], [196, 760]]), art: 'klein' },
    { pts: westwaerts(282, -326, [[182, 760], [154, 520], [124, 420], [104, 364], [78, 348], [30, 345], [-46, 342], [-66, 300], [-116, 282]]), art: 'klein' },
    { pts: ostwaerts(562, -300), art: 'gross' }, { pts: westwaerts(600, -250), art: 'gross', xxl: true },
  ],
  // Stufe 6: Großschiffspier P01 (x -371 bis -83, y 290, Schiff liegt nördlich davor) und
  // Marineanleger MA01/MA02 (y 247). Die kleinen Bahnen kommen im Westen nördlich davon herein.
  6: [
    { pts: ostwaerts(380, -340, [[-110, 380], [-56, 352], [-34, 330], [30, 333], [86, 337], [118, 352], [140, 420], [170, 520], [196, 760]]), art: 'klein' },
    { pts: westwaerts(394, -326, [[182, 760], [154, 520], [124, 420], [104, 364], [78, 348], [30, 345], [-46, 343], [-72, 370], [-116, 394]]), art: 'klein' },
    { pts: ostwaerts(562, -300), art: 'gross' }, { pts: westwaerts(600, -250), art: 'gross', xxl: true },
  ],
};

// Punkt auf einer Bahn bei Anteil f (0 bis 1) und die restlichen Eckpunkte danach
export function aufBahn(pts, f) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l); total += l;
  }
  let rest = total * f;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, rest / seg[i]) : 0;
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: [bx - ax, by - ay], weiter: pts.slice(i + 1) };
    }
    rest -= seg[i];
  }
  return { p: pts[0], dir: [1, 0], weiter: pts.slice(1) };
}

// Runden auf dem Binnensee (nur solange der See noch kein Hafenbecken ist).
// Superellipse: Mitte, Halbachsen; die Boote fahren mit seitlichem Versatz, damit sie sich nicht treffen.
export const SEE_RUNDE = {
  1: { cx: 172, cy: 132, rx: 120, ry: 28 },  // östlich des Ankerfelds (um -25, 102, Radius 44)
  2: { cx: 218, cy: 140, rx: 104, ry: 22 },  // östlich des Ankerfelds (um 42, 130, Radius 50)
};

// Ein Kanu oder Ruderboot paddelt in Ufernähe östlich der Stege hin und her (in der Startansicht zu sehen).
// Wassertiefe bei y 18 gut 1 m. Liegeplätze der Stufe 1 enden bei x -96, der Stufe 2 bei x -40;
// Gäste fahren nördlich davon (Bojen ab y 50) zu den Plätzen.
export const UFER = {
  1: { x0: -82, x1: -50, y: 18 },
  2: { x0: -26, x1: 60, y: 18 },
};

export const seeBahnen = (stufe) => SEE[stufe >= 6 ? 6 : stufe >= 5 ? 5 : stufe >= 3 ? 3 : 1];
export const seeRunde = (stufe) => (stufe <= 2 ? SEE_RUNDE[Math.max(1, stufe)] : null);

// --- Welche Boote wo fahren ---------------------------------------------------------------------
// Modell-ids aus web/js/data/boats/<größe>.js; steigende Stufe bringt größere Boote dazu.
export const FLOTTE = {
  ufer: ['S2-1', 'S2-2', 'S2-3', 'S1-1', 'S1-2', 'S1-4'],
  see: ['S4-2', 'S4-3', 'S4-4', 'S4-5', 'S2-1', 'S2-2', 'S2-3', 'S1-1', 'S5-4', 'M1-1'],
  klein: {
    1: ['S5-1', 'S5-2', 'S5-5', 'M2-1', 'M2-2', 'M2-4', 'M2-5', 'M4-2', 'M4-3'],
    2: ['M1-2', 'M1-3', 'M1-4', 'M3-1', 'M3-3', 'M4-4'],
    3: ['L1-1', 'L1-4', 'L3-2', 'L3-4'],
  },
  gross: {
    1: ['M4-4', 'M4-5', 'L1-1', 'L1-5', 'L4-4'],
    2: ['L1-3', 'L3-1', 'L3-2', 'L4-3'],
    3: ['L2-1', 'L2-2', 'L4-2', 'L4-5'],
    4: ['XL1-1', 'XL1-2', 'XL1-3', 'XL1-4', 'XL1-5', 'XL2-1', 'XL2-2', 'XL2-3', 'XL2-4', 'XL2-5', 'XL3-1', 'XL3-2', 'XL3-3', 'XL3-4', 'XL3-5'],
    5: ['XXL1-1', 'XXL1-2', 'XXL1-3', 'XXL2-1', 'XXL2-2', 'XXL2-3'],
  },
};
export const bisStufe = (table, stufe) => Object.entries(table).filter(([k]) => +k <= stufe).flatMap(([, v]) => v);

// Wie viele Boote gleichzeitig unterwegs sind
export const ANZAHL = {
  see: { 1: 3, 2: 3 },
  meer: { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5 },
};

