// Wege der Besuchsschiffe der Services (Kreuzfahrt, Marine, Windjammer, Ausflugsschiff, Barkasse,
// Seenotretter-Einsatz). Reine Daten, kein Three.js; render/services-besuch.js fährt sie ab,
// tests/besuchswege.test.mjs prüft sie gegen Gelände, Stege und Liegeplätze aller Stegbilder.
//
import { HAFEN } from './harbor.js';

// Alle Punkte in Planeinheiten wie harbor.js (x Osten, y Norden). Kurse in Grad: 0 = Bug nach Osten,
// 90 = Norden, 180 = Westen, -90 = Süden.
//
// Je Schiff:
//   platz        Liegeplatz aus harbor.js (lage[6]); ohne platz gilt der erste Punkt von weg
//   liegeKurs    Kurs am Liegeplatz
//   weg          Ablegen: vom Liegeplatz nach See (letzter Punkt außerhalb der Karte)
//   ankunft      Einlaufen: von See zum Liegeplatz; fehlt es, wird weg rückwärts gefahren
//   raus         'vorwaerts' (Standard): nach dem ersten Wegstück fährt der Bug voraus;
//                'rueckwaerts': das Schiff hält den liegeKurs und fährt achteraus hinaus
//   rein         'vorwaerts' (Standard): Bug voraus, im letzten Stück dreht es auf den liegeKurs;
//                'rueckwaerts': es hält den liegeKurs die ganze Ankunft
//   masse        [Länge, Breite] in Metern, für Hindernis und Prüfung
//   liegeVersatz [dx, dy] in Planeinheiten: so weit liegt das Schiff neben der Mitte seines Platzes

// Stufe 6 hat zwei Piers Nord-Sued (harbor.js): Kreuzfahrtpier bei x -140 (Schiff an der Ostseite) und
// Marinepier bei x -310. Die grossen Schiffe laufen gerade von Norden mit dem Bug voraus ein und legen abends
// achteraus wieder ab (mit Schleppern), ganz ohne zu drehen: Zwischen den Piers ist kein Platz zum Wenden.

export const AUFTRITTE = {
  fahrgastanleger: {
    art: 'ausflugsfahrt', jedenTag: true,
    // Ausflugsschiff am Kai K01 (harbor.js, Stufe 5). Legt seitlich vom Kai ab, dreht vor dem Kai und faehrt
    // noerdlich am Seenotkreuzer vorbei durch die Einfahrt hinaus.
    // 18 m Schiff, 2,4 Einheiten östlich der Platzmitte: so bleibt es frei von der Fischerbox FK01 an der
    // Kaiecke und vom größten Schiff an K02.
    schiffe: [{ modell: 'ausflugsschiff', platz: 'K01', stufe: 5, liegeKurs: 180, masse: [18, 5.6], liegeVersatz: [2.4, 0],
      weg: [[21.6, 234.4], [28, 252], [64, 270], [116, 290], [140, 326], [142, 420], [146, 600]] }],
    plan: { ab: 0.22, zurueck: 0.5 },
  },
  kreuzfahrtterminal: {
    art: 'kreuzfahrt',
    schiffe: [{ modell: 'kreuzfahrtschiff', platz: 'P01', liegeKurs: -90, masse: [180, 29], raus: 'rueckwaerts',
      weg: [[-112, 371], [-112, 760]] }],
    plan: { an: 0.03, ab: 0.68 },
  },
  marineanleger: {
    art: 'flottenbesuch',
    schiffe: [
      { modell: 'korvette', platz: 'MA01', liegeKurs: -90, masse: [90, 13], raus: 'rueckwaerts',
        weg: [[-294.8, 298.7], [-294.8, 640]] },
      { modell: 'minenjagdboot', platz: 'MA02', liegeKurs: -90, masse: [55, 9.2], raus: 'rueckwaerts', versatz: 0.02,
        weg: [[-324.4, 297.1], [-324.4, 640]] },
    ],
    plan: { an: 0.05, ab: 0.62 },
  },
  museumshafen: {
    art: 'windjammer', abStufe: 3,
    // Drei Traditionssegler ankern in einer Reihe zwischen Marinepier und Kreuzfahrtpier, Bug nach Norden
    // (in den Wind). Sie kommen nacheinander ueber eine eigene Fahrspur (x -240) und laufen auch so wieder aus,
    // ohne an den anderen vorbeizumuessen.
    schiffe: [
      { modell: 'xl:XL1-4', liegeKurs: 90, masse: [36, 8], versatz: 0, weg: [[-200, 300], [-238, 316], [-240, 470], [-240, 640]] },
      { modell: 'xl:XL1-2', liegeKurs: 90, masse: [36, 8], versatz: 0.035, weg: [[-200, 372], [-238, 388], [-240, 470], [-240, 640]] },
      { modell: 'xl:XL1-1', liegeKurs: 90, masse: [36, 8], versatz: 0.07, weg: [[-200, 444], [-240, 470], [-240, 640]] },
    ],
    plan: { an: 0.12, ab: 0.58 },
    fahrt: 0.2,
  },
};

// Liegepunkt eines Schiffs [x, y]: Platzmitte aus harbor.js plus liegeVersatz, sonst der erste Wegpunkt
export function liegePunkt(d) {
  const lage = d.platz ? HAFEN.plaetze?.find((q) => q.id === d.platz)?.lage?.[d.stufe ?? 6] : null;
  const [dx, dy] = d.liegeVersatz ?? [0, 0];
  return lage ? [lage[0] + dx, lage[1] + dy] : d.weg[0];
}

// Seenotretter: Das Boot gehoert zum Stationsmodell (render/services-models.js). Stufe 1 liegt am Dienstplatz
// aus harbor.js (dienste, art 'seenotretter', Innenseite der Ostmole), der Kreuzer an SK01 an der Westmole.
export const SEENOT_MASSE = { klein: [10.5, 3.6], gross: [20, 5] };
export function seenotPlatz(gross) {
  if (gross) {
    const l = HAFEN.plaetze?.find((q) => q.id === 'SK01')?.lage?.[6];
    return l ? { x: l[0], y: l[1], dreh: l[2] } : { x: 57, y: 302.6, dreh: 6 };
  }
  const d = (HAFEN.stufen?.[6]?.dienste ?? HAFEN.stufen?.[4]?.dienste ?? []).find((q) => q.art === 'seenotretter');
  return d ? { x: d.x, y: d.y, dreh: d.richtung ?? 85 } : { x: 197, y: 243, dreh: 85 };
}
// Einsatz bei Sturm: vom Liegeplatz durch die Hafeneinfahrt nach See (und denselben Weg zurueck)
export function seenotEinsatzWeg(gross) {
  const p = seenotPlatz(gross);
  return gross
    ? [[p.x, p.y], [108, 296], [140, 330], [146, 430]]
    : [[p.x, p.y], [p.x - 2, p.y + 36], [174, 300], [146, 332], [146, 430]];
}

// Barkasse: zwei Hafenrundfahrten am Tag (Anteil des Spieltags), Wege ab dem Ponton am Ostufer des Sees.
// Zeiten so gelegt, dass sie das Ausflugsschiff im Außenhafen nicht trifft (raus 0,22, zurück 0,5 bis 0,62).
export const RUNDFAHRTEN = [
  { ab: 0.3, dauer: 0.28, name: 'binnen',
    // am Ostufer nach Norden, an den Stegköpfen entlang nach Westen und in einer Schleife durch das weite Wasser
    // vor dem Durchstich zurück. Weiter nach Westen geht es nicht: Dort ist der See flacher als 1,5 m, und zwischen
    // Flachwasser und Stegköpfen (je nach Stegbild) bleibt kein Platz zum Wenden.
    weg: [[214, 40], [217, 100], [216, 158], [206, 174], [194, 179], [170, 179], [164, 186], [167, 195], [179, 199],
      [190, 195], [198, 186], [205, 175], [214, 158], [215, 100], [212, 44]] },
  { ab: 0.64, dauer: 0.28, name: 'aussen',
    // am Ostufer nach Norden, durch die Mitte des Durchstichs in den Außenhafen und an der Westmole vorbei
    weg: [[214, 40], [217, 100], [217, 150], [196, 174], [177, 186], [174, 205], [172, 240], [150, 264], [40, 268], [22, 276],
      [60, 281], [140, 279], [168, 250], [170, 205], [174, 186], [200, 175], [214, 150], [215, 100], [212, 44]] },
];
