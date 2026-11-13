// Flächen, die das Gelände für Anlagen planiert (Kai, Terminalvorplatz, Marinebasis ...).
// Gehört dem Thread "Marinebasis und Anlagen neu platzieren". Reine Daten, kein Three.js.
// web/js/render/landschaft/gelaende.js planiert jede Fläche auf `hoehe` (Meter über mittlerem Wasser,
// Standard 1,2) und gibt ihr den Oberflächentyp `typ` ('pflaster' oder 'gras'); liegt sie im Wasser,
// wird aufgeschüttet. tests/landschaft.test.mjs prüft, dass keine Fläche Engpass oder Fahrwasser berührt.
//
//   anlagenFlaechen(stufe) -> [{ id, poly: [[px, py], ...], hoehe?, typ? }]   Planeinheiten wie harbor.js

export function anlagenFlaechen(stufe) {
  return [];
}
