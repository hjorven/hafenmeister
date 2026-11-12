// Flächen, die das Gelände für Anlagen planiert (Kai, Terminalvorplatz, Marinebasis ...).
// Gehört dem Thread "Marinebasis und Anlagen neu platzieren". Reine Daten, kein Three.js.
// web/js/render/landschaft/gelaende.js planiert jede Fläche auf `hoehe` (Meter über mittlerem Wasser,
// Standard 1,2) und gibt ihr den Oberflächentyp `typ` ('pflaster' oder 'gras'); liegt sie im Wasser,
// wird aufgeschüttet. tests/landschaft.test.mjs prüft, dass keine Fläche Engpass oder Fahrwasser berührt.
// Bewuchs und Hügel (render/landschaft/vielfalt.js) bleiben draußen.
//
//   anlagenFlaechen(stufe) -> [{ id, poly: [[px, py], ...], hoehe?, typ? }]   Planeinheiten wie harbor.js
//   istAnlagenFlaeche(px, py, stufe, rand = 0) -> true, wenn der Punkt in einer Fläche liegt (mit Rand)
//
// Lage der Anlagen selbst: web/js/data/services.js (lage). Die Nehrungsstraße (Stufe 6, y 192) legt
// render/landschaft/gelaende.js an; alle Flächen auf der Nehrung beginnen nördlich davon bei y 196.

const rechteck = (id, x0, y0, x1, y1, extra = {}) => ({ id, poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], hoehe: 1.3, typ: 'pflaster', ...extra });

// ab: erste Hafenstufe, in der die Fläche planiert ist
const FLAECHEN = [
  // Segelclub und Räucherei am Westende der Promenade (außerhalb der HAFENFLAECHE)
  { ab: 2, ...rechteck('segelclub', -218, -56, -166, -9, { hoehe: 1.2, typ: 'gras' }) },
  // Seenotretter-Station an der Ostmole (Boot am Dienststeg an der Innenseite der Ostmole)
  { ab: 4, ...rechteck('seenotretter-ost', 214, 204, 236, 222) },
  // Fischhalle an der Wurzel der Westmole, neben dem Fischereikai
  { ab: 5, ...rechteck('fischhalle', -44, 196, -16, 222) },
  // Stufe 6: Seenotretter-Station an der Westmole (Kreuzer an SK01), Kreuzfahrtterminal an der Wurzel
  // der Kreuzfahrtpier, eingezäunter Marinestützpunkt an der Wurzel der Marinepier
  { ab: 6, ...rechteck('seenotretter-west', -2, 198, 14, 214) },
  { ab: 6, ...rechteck('kreuzfahrt', -185, 196, -115, 226) },
  { ab: 6, ...rechteck('marine', -352, 196, -280, 226) },
];

export function anlagenFlaechen(stufe) {
  return FLAECHEN.filter((f) => stufe >= f.ab).map(({ ab: _ab, ...f }) => ({ ...f, poly: f.poly.map((q) => [...q]) }));
}

export function istAnlagenFlaeche(px, py, stufe, rand = 0) {
  return anlagenFlaechen(stufe).some((f) => {
    const xs = f.poly.map((q) => q[0]), ys = f.poly.map((q) => q[1]);
    return px >= Math.min(...xs) - rand && px <= Math.max(...xs) + rand && py >= Math.min(...ys) - rand && py <= Math.max(...ys) + rand;
  });
}
