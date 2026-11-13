// Abwechslung im Gelände (Landschaftsart je Ort und Spiel). Gehört dem Thread "Gelände abwechslungsreicher gestalten".
// Reines JS ohne Three.js. gelaende.js ruft die Haken in punkt() auf:
//   land(px, py, h, typ, d, kontext)  -> { h, typ }   im Festland-Zweig (d = Abstand zur Uferlinie in Planeinheiten)
//   nehrung(px, py, h, typ, kontext)  -> typ          auf der Nehrung (nur die Art, Höhen bleiben bei gelaende.js)
// kontext = { stufe, region, uferAbstandM, hafenAbstand, offeneSee }
// Regel: befahrbares Wasser, Strand und Uferlinie nicht verändern (Höhenzuschläge nur an Land über 0,3 m
// und mit Abstand zum Ufer), Hafen- und Bauflächen bleiben eben (karte.js bauflaechen).

export function land(px, py, h, typ) {
  return { h, typ };
}

export function nehrung(px, py, h, typ) {
  return typ;
}
