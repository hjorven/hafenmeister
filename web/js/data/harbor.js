// Hafenmeister: Liegeplaetze und Stege je Ausbaustufe.
// ERZEUGT von skripte/liegeplaetze_export.py aus skripte/konzeptbilder/hafen_von_oben.py.
// Nicht von Hand aendern, sondern das Layout in der Zeichnung aendern und neu exportieren:
//   python3 skripte/liegeplaetze_export.py
//
// Koordinaten in Planeinheiten (1 Einheit = 0,62 m, wie in web/js/main.js), x nach Osten,
// y nach Norden.
// plaetze[]: ein Eintrag je Liegeplatz ueber alle Stufen. Liegt ein Platz in zwei Stufen an
//   derselben Stelle, behaelt er seine id. stufen = in welchen Stufen es ihn gibt.
//   lage[n]     [x, y, richtung] in Stufe n: Mitte des Platzes und Grad, wohin der Bug zeigt
//               (0 = Osten, 90 = Norden; bei Boxen zum Steg hin). Ein Ausbau kann einen Platz
//               um bis zu eine halbe Boxbreite verschieben, er behaelt dabei seine id.
//   laenge,     Groesse des Platzes in der Zeichnung (Planeinheiten, letzte Stufe). Bei Boxen
//   breite      die Box, laengsseits die Flaeche des gezeichneten Boots.
//   maxLaenge,  Hoechstmasse fuer Boote in Metern (docs/hafen-und-schiffe.md, Abschnitt 2)
//   maxBreite
//   tiefe       Wassertiefe in Metern je Stufe (kleinster Wert auf der Mittellinie)
//   art         box (Heckpfaehle), finger (Schwimmsteg mit Fingern), stirn (laengsseits am
//               T-Kopf oder Stegende), kai (XL im Aussenhafen), fischer (fest vergeben),
//               ab Stufe 6 (Klasse XXL): pier (Kreuzfahrtpier), marine (Marineanleger),
//               seenotretter (fester Platz des stationierten Seenotrettungskreuzers)
// stufen[n].stege[]: Steglinien zum Zeichnen und Antippen (ohne Fingerstege). steg = null bei
//   Dienststegen (Tankstelle, Seenotretter, Travellift). Kai und Fischereikai: bauart kai, die
//   Linie ist die Kante, an der die Schiffe liegen.
// stufen[n].dienste[]: Plaetze fuer Dienste (Tankstelle, Seenotretter), keine Liegeplaetze.
// id, region: Kennung dieses Hafens. Weitere Haefen (andere Regionen) liefern dieselbe Form
//   in eigenen Dateien mit eigener id.
//
// 3D: Die Daten liegen in der Wasserebene (Hoehe 0 = Wasserlinie). In der 3D-Szene des
// Grundgeruests (Meter, y nach oben, Norden = -z) gilt: 3D-x = x * 0.62, 3D-z = -y * 0.62,
// Drehung um die Hochachse = richtung in Grad (gegen den Uhrzeigersinn von oben gesehen).
// Erweiterbar: neue Platzarten (z. B. Kreuzfahrtanleger) bekommen eine neue art und Klasse,
// neue Felder werden nur angehaengt; format zaehlt hoch, wenn sich Bedeutungen aendern.

import { stegbildAnwenden } from './stegbild.js';

export const HAFEN = {
 "format": 1,
 "id": "nehrung",
 "name": "Hafen an der Nehrung",
 "region": "ostsee",
 "quelle": "skripte/konzeptbilder/hafen_von_oben.py",
 "einheiten": {
  "meterProEinheit": 0.62,
  "x": "nach Osten",
  "y": "nach Norden",
  "wasserlinie": 0,
  "richtung": "Grad, 0 = Osten, 90 = Norden, zeigt wohin der Bug zeigt"
 },
 "stege": {
  "A": "Steg A",
  "B": "Steg B",
  "C": "Hauptsteg C",
  "CS": "Stichsteg",
  "D": "Schwimmsteg D",
  "F": "Fischersteg",
  "K": "Kai",
  "FK": "Fischereikai",
  "P": "Kreuzfahrtpier",
  "MA": "Marineanleger",
  "SK": "Seenotkreuzer"
 },
 "plaetze": [
  {
   "id": "A01",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2
   ],
   "lage": {
    "1": [
     -100.0,
     7.4,
     184
    ],
    "2": [
     -100.4,
     6.7,
     186
    ]
   },
   "tiefe": {
    "1": 0.9,
    "2": 0.9
   }
  },
  {
   "id": "A02",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2
   ],
   "lage": {
    "1": [
     -100.3,
     12.2,
     184
    ],
    "2": [
     -100.9,
     11.5,
     186
    ]
   },
   "tiefe": {
    "1": 1.1,
    "2": 1.1
   }
  },
  {
   "id": "A03",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "1": [
     -100.6,
     17.0,
     184
    ],
    "2": [
     -101.3,
     16.3,
     186
    ],
    "3": [
     -100.8,
     18.3,
     187
    ],
    "4": [
     -100.8,
     18.3,
     187
    ],
    "5": [
     -100.8,
     18.3,
     187
    ],
    "6": [
     -100.8,
     18.3,
     187
    ]
   },
   "tiefe": {
    "1": 1.3,
    "2": 1.3,
    "3": 1.4,
    "4": 1.4,
    "5": 1.4,
    "6": 1.4
   }
  },
  {
   "id": "A04",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "1": [
     -100.9,
     21.8,
     184
    ],
    "2": [
     -101.8,
     21.1,
     186
    ],
    "3": [
     -101.4,
     23.0,
     187
    ],
    "4": [
     -101.4,
     23.0,
     187
    ],
    "5": [
     -101.4,
     23.0,
     187
    ],
    "6": [
     -101.4,
     23.0,
     187
    ]
   },
   "tiefe": {
    "1": 1.5,
    "2": 1.5,
    "3": 1.5,
    "4": 1.5,
    "5": 1.5,
    "6": 1.5
   }
  },
  {
   "id": "A05",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "1": [
     -101.2,
     26.5,
     184
    ],
    "2": [
     -102.3,
     25.8,
     186
    ],
    "3": [
     -102.0,
     27.8,
     187
    ],
    "4": [
     -102.0,
     27.8,
     187
    ],
    "5": [
     -102.0,
     27.8,
     187
    ],
    "6": [
     -102.0,
     27.8,
     187
    ]
   },
   "tiefe": {
    "1": 1.6,
    "2": 1.6,
    "3": 1.6,
    "4": 1.6,
    "5": 1.6,
    "6": 1.6
   }
  },
  {
   "id": "A06",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    1,
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "1": [
     -101.5,
     31.3,
     184
    ],
    "2": [
     -102.7,
     30.6,
     186
    ],
    "3": [
     -102.6,
     32.5,
     187
    ],
    "4": [
     -102.6,
     32.5,
     187
    ],
    "5": [
     -102.6,
     32.5,
     187
    ],
    "6": [
     -102.6,
     32.5,
     187
    ]
   },
   "tiefe": {
    "1": 1.7,
    "2": 1.7,
    "3": 1.8,
    "4": 1.8,
    "5": 1.8,
    "6": 1.8
   }
  },
  {
   "id": "A07",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -103.2,
     35.4,
     186
    ],
    "3": [
     -103.3,
     37.3,
     187
    ],
    "4": [
     -103.3,
     37.3,
     187
    ],
    "5": [
     -103.3,
     37.3,
     187
    ],
    "6": [
     -103.3,
     37.3,
     187
    ]
   },
   "tiefe": {
    "2": 1.8,
    "3": 1.8,
    "4": 1.8,
    "5": 1.8,
    "6": 1.8
   }
  },
  {
   "id": "A08",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -117.3,
     45.6,
     9
    ],
    "3": [
     -117.3,
     44.0,
     12
    ],
    "4": [
     -117.3,
     44.0,
     12
    ],
    "5": [
     -117.3,
     44.0,
     12
    ],
    "6": [
     -117.3,
     44.0,
     12
    ]
   },
   "tiefe": {
    "2": 2.0,
    "3": 2.0,
    "4": 2.0,
    "5": 2.0,
    "6": 2.0
   }
  },
  {
   "id": "A09",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -118.1,
     50.3,
     9
    ],
    "3": [
     -118.2,
     48.7,
     12
    ],
    "4": [
     -118.2,
     48.7,
     12
    ],
    "5": [
     -118.2,
     48.7,
     12
    ],
    "6": [
     -118.2,
     48.7,
     12
    ]
   },
   "tiefe": {
    "2": 2.1,
    "3": 2.1,
    "4": 2.1,
    "5": 2.1,
    "6": 2.1
   }
  },
  {
   "id": "A10",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -104.9,
     47.7,
     189
    ],
    "3": [
     -104.9,
     46.5,
     192
    ],
    "4": [
     -104.9,
     46.5,
     192
    ],
    "5": [
     -104.9,
     46.5,
     192
    ],
    "6": [
     -104.9,
     46.5,
     192
    ]
   },
   "tiefe": {
    "2": 2.0,
    "3": 2.0,
    "4": 2.0,
    "5": 2.0,
    "6": 2.0
   }
  },
  {
   "id": "A11",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -105.7,
     52.4,
     189
    ],
    "3": [
     -105.9,
     51.2,
     192
    ],
    "4": [
     -105.9,
     51.2,
     192
    ],
    "5": [
     -105.9,
     51.2,
     192
    ],
    "6": [
     -105.9,
     51.2,
     192
    ]
   },
   "tiefe": {
    "2": 2.1,
    "3": 2.1,
    "4": 2.1,
    "5": 2.1,
    "6": 2.1
   }
  },
  {
   "id": "A12",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -119.2,
     53.4,
     12
    ],
    "4": [
     -119.2,
     53.4,
     12
    ],
    "5": [
     -119.2,
     53.4,
     12
    ],
    "6": [
     -119.2,
     53.4,
     12
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.2,
    "5": 2.2,
    "6": 2.2
   }
  },
  {
   "id": "A13",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -120.2,
     58.1,
     12
    ],
    "4": [
     -120.2,
     58.1,
     12
    ],
    "5": [
     -120.2,
     58.1,
     12
    ],
    "6": [
     -120.2,
     58.1,
     12
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.2,
    "5": 2.2,
    "6": 2.2
   }
  },
  {
   "id": "A14",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -121.1,
     62.8,
     12
    ],
    "4": [
     -121.1,
     62.8,
     12
    ],
    "5": [
     -121.1,
     62.8,
     12
    ],
    "6": [
     -121.1,
     62.8,
     12
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.3,
    "5": 2.3,
    "6": 2.3
   }
  },
  {
   "id": "A15",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -122.1,
     67.5,
     12
    ],
    "4": [
     -122.1,
     67.5,
     12
    ],
    "5": [
     -122.1,
     67.5,
     12
    ],
    "6": [
     -122.1,
     67.5,
     12
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.3,
    "5": 2.3,
    "6": 2.3
   }
  },
  {
   "id": "A16",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -106.8,
     55.9,
     192
    ],
    "4": [
     -106.8,
     55.9,
     192
    ],
    "5": [
     -106.8,
     55.9,
     192
    ],
    "6": [
     -106.8,
     55.9,
     192
    ]
   },
   "tiefe": {
    "3": 2.1,
    "4": 2.1,
    "5": 2.1,
    "6": 2.1
   }
  },
  {
   "id": "A17",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -107.8,
     60.6,
     192
    ],
    "4": [
     -107.8,
     60.6,
     192
    ],
    "5": [
     -107.8,
     60.6,
     192
    ],
    "6": [
     -107.8,
     60.6,
     192
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.2,
    "5": 2.2,
    "6": 2.2
   }
  },
  {
   "id": "A18",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -108.8,
     65.3,
     192
    ],
    "4": [
     -108.8,
     65.3,
     192
    ],
    "5": [
     -108.8,
     65.3,
     192
    ],
    "6": [
     -108.8,
     65.3,
     192
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.3,
    "5": 2.3,
    "6": 2.3
   }
  },
  {
   "id": "A19",
   "steg": "A",
   "klasse": "S",
   "art": "box",
   "laenge": 8.8,
   "breite": 4.8,
   "maxLaenge": 6.0,
   "maxBreite": 2.4,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -109.7,
     70.0,
     192
    ],
    "4": [
     -109.7,
     70.0,
     192
    ],
    "5": [
     -109.7,
     70.0,
     192
    ],
    "6": [
     -109.7,
     70.0,
     192
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.3,
    "5": 2.3,
    "6": 2.3
   }
  },
  {
   "id": "B01",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -63.7,
     8.3,
     0
    ]
   },
   "tiefe": {
    "2": 1.0
   }
  },
  {
   "id": "B02",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -63.7,
     14.6,
     0
    ]
   },
   "tiefe": {
    "2": 1.3
   }
  },
  {
   "id": "B03",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     20.8,
     0
    ],
    "3": [
     -63.7,
     18.9,
     0
    ],
    "4": [
     -63.7,
     18.9,
     0
    ],
    "5": [
     -63.7,
     17.6,
     0
    ],
    "6": [
     -63.7,
     17.6,
     0
    ]
   },
   "tiefe": {
    "2": 1.5,
    "3": 1.4,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B04",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     27.1,
     0
    ],
    "3": [
     -63.7,
     25.2,
     0
    ],
    "4": [
     -63.7,
     25.2,
     0
    ],
    "5": [
     -63.7,
     23.8,
     0
    ],
    "6": [
     -63.7,
     23.8,
     0
    ]
   },
   "tiefe": {
    "2": 1.6,
    "3": 1.6,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B05",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     33.3,
     0
    ],
    "3": [
     -63.7,
     31.4,
     0
    ],
    "4": [
     -63.7,
     31.4,
     0
    ],
    "5": [
     -63.7,
     30.0,
     0
    ],
    "6": [
     -63.7,
     30.0,
     0
    ]
   },
   "tiefe": {
    "2": 1.8,
    "3": 1.7,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B06",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     39.5,
     0
    ],
    "3": [
     -63.7,
     37.6,
     0
    ],
    "4": [
     -63.7,
     37.6,
     0
    ],
    "5": [
     -63.7,
     36.3,
     0
    ],
    "6": [
     -63.7,
     36.3,
     0
    ]
   },
   "tiefe": {
    "2": 1.9,
    "3": 1.8,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B07",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     45.8,
     0
    ],
    "3": [
     -63.7,
     43.9,
     0
    ],
    "4": [
     -63.7,
     43.9,
     0
    ],
    "5": [
     -63.7,
     42.5,
     0
    ],
    "6": [
     -63.7,
     42.5,
     0
    ]
   },
   "tiefe": {
    "2": 2.0,
    "3": 1.9,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B08",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -63.7,
     52.0,
     0
    ],
    "3": [
     -63.7,
     50.1,
     0
    ],
    "4": [
     -63.7,
     50.1,
     0
    ],
    "5": [
     -63.7,
     48.8,
     0
    ],
    "6": [
     -63.7,
     48.8,
     0
    ]
   },
   "tiefe": {
    "2": 2.0,
    "3": 2.0,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B09",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -46.3,
     8.3,
     180
    ]
   },
   "tiefe": {
    "2": 1.0
   }
  },
  {
   "id": "B10",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -46.3,
     14.6,
     180
    ]
   },
   "tiefe": {
    "2": 1.3
   }
  },
  {
   "id": "B11",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     20.8,
     180
    ],
    "3": [
     -46.3,
     18.9,
     180
    ],
    "4": [
     -46.3,
     18.9,
     180
    ],
    "5": [
     -46.3,
     17.6,
     180
    ],
    "6": [
     -46.3,
     17.6,
     180
    ]
   },
   "tiefe": {
    "2": 1.5,
    "3": 1.4,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B12",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     27.1,
     180
    ],
    "3": [
     -46.3,
     25.2,
     180
    ],
    "4": [
     -46.3,
     25.2,
     180
    ],
    "5": [
     -46.3,
     23.8,
     180
    ],
    "6": [
     -46.3,
     23.8,
     180
    ]
   },
   "tiefe": {
    "2": 1.7,
    "3": 1.6,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B13",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     33.3,
     180
    ],
    "3": [
     -46.3,
     31.4,
     180
    ],
    "4": [
     -46.3,
     31.4,
     180
    ],
    "5": [
     -46.3,
     30.0,
     180
    ],
    "6": [
     -46.3,
     30.0,
     180
    ]
   },
   "tiefe": {
    "2": 1.8,
    "3": 1.8,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B14",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     39.5,
     180
    ],
    "3": [
     -46.3,
     37.6,
     180
    ],
    "4": [
     -46.3,
     37.6,
     180
    ],
    "5": [
     -46.3,
     36.3,
     180
    ],
    "6": [
     -46.3,
     36.3,
     180
    ]
   },
   "tiefe": {
    "2": 1.9,
    "3": 1.9,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B15",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     45.8,
     180
    ],
    "3": [
     -46.3,
     43.9,
     180
    ],
    "4": [
     -46.3,
     43.9,
     180
    ],
    "5": [
     -46.3,
     42.5,
     180
    ],
    "6": [
     -46.3,
     42.5,
     180
    ]
   },
   "tiefe": {
    "2": 2.0,
    "3": 2.0,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B16",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2,
    3,
    4,
    5,
    6
   ],
   "lage": {
    "2": [
     -46.3,
     52.0,
     180
    ],
    "3": [
     -46.3,
     50.1,
     180
    ],
    "4": [
     -46.3,
     50.1,
     180
    ],
    "5": [
     -46.3,
     48.8,
     180
    ],
    "6": [
     -46.3,
     48.8,
     180
    ]
   },
   "tiefe": {
    "2": 2.1,
    "3": 2.0,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B17",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 16.0,
   "breite": 4.2,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -65.0,
     66.8,
     0
    ]
   },
   "tiefe": {
    "2": 2.2
   }
  },
  {
   "id": "B18",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 14.4,
   "breite": 5.1,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -45.8,
     67.3,
     0
    ]
   },
   "tiefe": {
    "2": 2.2
   }
  },
  {
   "id": "B19",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -63.7,
     56.4,
     0
    ],
    "4": [
     -63.7,
     56.4,
     0
    ],
    "5": [
     -63.7,
     55.0,
     0
    ],
    "6": [
     -63.7,
     55.0,
     0
    ]
   },
   "tiefe": {
    "3": 2.1,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B20",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -63.7,
     62.6,
     0
    ],
    "4": [
     -63.7,
     62.6,
     0
    ],
    "5": [
     -63.7,
     61.2,
     0
    ],
    "6": [
     -63.7,
     61.2,
     0
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B21",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -63.7,
     68.8,
     0
    ],
    "4": [
     -63.7,
     68.8,
     0
    ],
    "5": [
     -63.7,
     67.5,
     0
    ],
    "6": [
     -63.7,
     67.5,
     0
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B22",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -63.7,
     75.1,
     0
    ],
    "4": [
     -63.7,
     75.1,
     0
    ],
    "5": [
     -63.7,
     73.7,
     0
    ],
    "6": [
     -63.7,
     73.7,
     0
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B23",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -46.3,
     56.4,
     180
    ],
    "4": [
     -46.3,
     56.4,
     180
    ],
    "5": [
     -46.3,
     55.0,
     180
    ],
    "6": [
     -46.3,
     55.0,
     180
    ]
   },
   "tiefe": {
    "3": 2.1,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B24",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -46.3,
     62.6,
     180
    ],
    "4": [
     -46.3,
     62.6,
     180
    ],
    "5": [
     -46.3,
     61.2,
     180
    ],
    "6": [
     -46.3,
     61.2,
     180
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B25",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -46.3,
     68.8,
     180
    ],
    "4": [
     -46.3,
     68.8,
     180
    ],
    "5": [
     -46.3,
     67.5,
     180
    ],
    "6": [
     -46.3,
     67.5,
     180
    ]
   },
   "tiefe": {
    "3": 2.2,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B26",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -46.3,
     75.1,
     180
    ],
    "4": [
     -46.3,
     75.1,
     180
    ],
    "5": [
     -46.3,
     73.7,
     180
    ],
    "6": [
     -46.3,
     73.7,
     180
    ]
   },
   "tiefe": {
    "3": 2.3,
    "4": 2.6,
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B27",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 16.0,
   "breite": 4.2,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    3,
    4
   ],
   "lage": {
    "3": [
     -65.0,
     88.8,
     0
    ],
    "4": [
     -65.0,
     88.8,
     0
    ]
   },
   "tiefe": {
    "3": 2.5,
    "4": 2.6
   }
  },
  {
   "id": "B28",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 14.4,
   "breite": 5.1,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    3,
    4
   ],
   "lage": {
    "3": [
     -45.8,
     89.3,
     0
    ],
    "4": [
     -45.8,
     89.3,
     0
    ]
   },
   "tiefe": {
    "3": 2.4,
    "4": 2.6
   }
  },
  {
   "id": "B29",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -63.7,
     80.0,
     0
    ],
    "6": [
     -63.7,
     80.0,
     0
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B30",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -63.7,
     86.2,
     0
    ],
    "6": [
     -63.7,
     86.2,
     0
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B31",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -63.7,
     92.4,
     0
    ],
    "6": [
     -63.7,
     92.4,
     0
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B32",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -46.3,
     80.0,
     180
    ],
    "6": [
     -46.3,
     80.0,
     180
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B33",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -46.3,
     86.2,
     180
    ],
    "6": [
     -46.3,
     86.2,
     180
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B34",
   "steg": "B",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -46.3,
     92.4,
     180
    ],
    "6": [
     -46.3,
     92.4,
     180
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B35",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 16.0,
   "breite": 4.2,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -65.0,
     104.8,
     0
    ],
    "6": [
     -65.0,
     104.8,
     0
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "B36",
   "steg": "B",
   "klasse": "M",
   "art": "stirn",
   "laenge": 14.4,
   "breite": 5.1,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     -45.8,
     105.3,
     0
    ],
    "6": [
     -45.8,
     105.3,
     0
    ]
   },
   "tiefe": {
    "5": 2.6,
    "6": 2.6
   }
  },
  {
   "id": "C01",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     21.0,
     0
    ],
    "4": [
     0.8,
     21.0,
     0
    ],
    "5": [
     0.8,
     21.0,
     0
    ],
    "6": [
     0.8,
     21.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.5,
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "C02",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     29.0,
     0
    ],
    "4": [
     0.8,
     29.0,
     0
    ],
    "5": [
     0.8,
     29.0,
     0
    ],
    "6": [
     0.8,
     29.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.5,
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "C03",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     37.0,
     0
    ],
    "4": [
     0.8,
     37.0,
     0
    ],
    "5": [
     0.8,
     37.0,
     0
    ],
    "6": [
     0.8,
     37.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C04",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     45.0,
     0
    ],
    "4": [
     0.8,
     45.0,
     0
    ],
    "5": [
     0.8,
     45.0,
     0
    ],
    "6": [
     0.8,
     45.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C05",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     53.0,
     0
    ],
    "4": [
     0.8,
     53.0,
     0
    ],
    "5": [
     0.8,
     53.0,
     0
    ],
    "6": [
     0.8,
     53.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C06",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     0.8,
     61.0,
     0
    ],
    "4": [
     0.8,
     61.0,
     0
    ],
    "5": [
     0.8,
     61.0,
     0
    ],
    "6": [
     0.8,
     61.0,
     0
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C07",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     25.2,
     21.0,
     180
    ],
    "4": [
     25.2,
     21.0,
     180
    ],
    "5": [
     25.2,
     21.0,
     180
    ],
    "6": [
     25.2,
     21.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C08",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     25.2,
     29.0,
     180
    ],
    "4": [
     25.2,
     29.0,
     180
    ],
    "5": [
     25.2,
     29.0,
     180
    ],
    "6": [
     25.2,
     29.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C09",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     25.2,
     37.0,
     180
    ],
    "4": [
     25.2,
     37.0,
     180
    ],
    "5": [
     25.2,
     37.0,
     180
    ],
    "6": [
     25.2,
     37.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C10",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     25.2,
     45.0,
     180
    ],
    "4": [
     25.2,
     45.0,
     180
    ],
    "5": [
     25.2,
     45.0,
     180
    ],
    "6": [
     25.2,
     45.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C11",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     25.2,
     53.0,
     180
    ],
    "4": [
     25.2,
     53.0,
     180
    ],
    "5": [
     25.2,
     53.0,
     180
    ],
    "6": [
     25.2,
     53.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4,
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C12",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    3
   ],
   "lage": {
    "3": [
     25.2,
     61.0,
     180
    ]
   },
   "tiefe": {
    "3": 3.4
   }
  },
  {
   "id": "C13",
   "steg": "C",
   "klasse": "L",
   "art": "stirn",
   "laenge": 20.0,
   "breite": 10.6,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    3
   ],
   "lage": {
    "3": [
     0.7,
     81.4,
     355
    ]
   },
   "tiefe": {
    "3": 3.4
   }
  },
  {
   "id": "C14",
   "steg": "C",
   "klasse": "L",
   "art": "stirn",
   "laenge": 22.4,
   "breite": 6.7,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    3
   ],
   "lage": {
    "3": [
     25.6,
     77.4,
     355
    ]
   },
   "tiefe": {
    "3": 3.4
   }
  },
  {
   "id": "C15",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -0.9,
     79.2,
     9
    ],
    "5": [
     -0.9,
     79.2,
     9
    ],
    "6": [
     -0.9,
     79.2,
     9
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C16",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -2.3,
     87.1,
     9
    ],
    "5": [
     -2.3,
     87.1,
     9
    ],
    "6": [
     -2.3,
     87.1,
     9
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C17",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -3.6,
     95.0,
     9
    ],
    "5": [
     -3.6,
     95.0,
     9
    ],
    "6": [
     -3.6,
     95.0,
     9
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C18",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -4.9,
     102.9,
     9
    ],
    "5": [
     -4.9,
     102.9,
     9
    ],
    "6": [
     -4.9,
     102.9,
     9
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C19",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -6.2,
     110.8,
     9
    ],
    "5": [
     -6.2,
     110.8,
     9
    ],
    "6": [
     -6.2,
     110.8,
     9
    ]
   },
   "tiefe": {
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "C20",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     20.2,
     101.0,
     189
    ],
    "5": [
     20.2,
     101.0,
     189
    ],
    "6": [
     20.2,
     101.0,
     189
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "C21",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     18.9,
     108.9,
     189
    ],
    "5": [
     18.9,
     108.9,
     189
    ],
    "6": [
     18.9,
     108.9,
     189
    ]
   },
   "tiefe": {
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "C22",
   "steg": "C",
   "klasse": "L",
   "art": "box",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     17.6,
     116.8,
     189
    ],
    "5": [
     17.6,
     116.8,
     189
    ],
    "6": [
     17.6,
     116.8,
     189
    ]
   },
   "tiefe": {
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "C23",
   "steg": "C",
   "klasse": "L",
   "art": "stirn",
   "laenge": 20.0,
   "breite": 10.6,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     -8.9,
     134.7,
     352
    ],
    "5": [
     -8.9,
     134.7,
     352
    ],
    "6": [
     -8.9,
     134.7,
     352
    ]
   },
   "tiefe": {
    "4": 2.2,
    "5": 2.2,
    "6": 2.2
   }
  },
  {
   "id": "C24",
   "steg": "C",
   "klasse": "L",
   "art": "stirn",
   "laenge": 22.4,
   "breite": 6.7,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     15.7,
     129.2,
     352
    ],
    "5": [
     15.7,
     129.2,
     352
    ],
    "6": [
     15.7,
     129.2,
     352
    ]
   },
   "tiefe": {
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "CS01",
   "steg": "CS",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     43.2,
     90.2,
     280
    ],
    "5": [
     43.2,
     90.2,
     280
    ],
    "6": [
     43.2,
     90.2,
     280
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "CS02",
   "steg": "CS",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     49.4,
     91.3,
     280
    ],
    "5": [
     49.4,
     91.3,
     280
    ],
    "6": [
     49.4,
     91.3,
     280
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "CS03",
   "steg": "CS",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     46.3,
     73.1,
     100
    ],
    "5": [
     46.3,
     73.1,
     100
    ],
    "6": [
     46.3,
     73.1,
     100
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "CS04",
   "steg": "CS",
   "klasse": "M",
   "art": "box",
   "laenge": 13.6,
   "breite": 6.2,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     52.4,
     74.1,
     100
    ],
    "5": [
     52.4,
     74.1,
     100
    ],
    "6": [
     52.4,
     74.1,
     100
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D01",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     99.4,
     19.8,
     354
    ],
    "5": [
     99.4,
     19.8,
     354
    ],
    "6": [
     99.4,
     19.8,
     354
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D02",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     100.2,
     27.8,
     354
    ],
    "5": [
     100.2,
     27.8,
     354
    ],
    "6": [
     100.2,
     27.8,
     354
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D03",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     101.0,
     35.8,
     354
    ],
    "5": [
     101.0,
     35.8,
     354
    ],
    "6": [
     101.0,
     35.8,
     354
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D04",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     101.8,
     43.7,
     354
    ],
    "5": [
     101.8,
     43.7,
     354
    ],
    "6": [
     101.8,
     43.7,
     354
    ]
   },
   "tiefe": {
    "4": 3.3,
    "5": 3.3,
    "6": 3.3
   }
  },
  {
   "id": "D05",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     102.7,
     51.7,
     354
    ],
    "5": [
     102.7,
     51.7,
     354
    ],
    "6": [
     102.7,
     51.7,
     354
    ]
   },
   "tiefe": {
    "4": 3.3,
    "5": 3.3,
    "6": 3.3
   }
  },
  {
   "id": "D06",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     124.0,
     17.3,
     174
    ],
    "5": [
     124.0,
     17.3,
     174
    ],
    "6": [
     124.0,
     17.3,
     174
    ]
   },
   "tiefe": {
    "4": 3.5,
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "D07",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     124.9,
     25.2,
     174
    ],
    "5": [
     124.9,
     25.2,
     174
    ],
    "6": [
     124.9,
     25.2,
     174
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D08",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     125.7,
     33.2,
     174
    ],
    "5": [
     125.7,
     33.2,
     174
    ],
    "6": [
     125.7,
     33.2,
     174
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D09",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     126.5,
     41.2,
     174
    ],
    "5": [
     126.5,
     41.2,
     174
    ],
    "6": [
     126.5,
     41.2,
     174
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D10",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    4,
    5,
    6
   ],
   "lage": {
    "4": [
     127.3,
     49.1,
     174
    ],
    "5": [
     127.3,
     49.1,
     174
    ],
    "6": [
     127.3,
     49.1,
     174
    ]
   },
   "tiefe": {
    "4": 3.4,
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D11",
   "steg": "D",
   "klasse": "L",
   "art": "stirn",
   "laenge": 20.8,
   "breite": 7.0,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    4
   ],
   "lage": {
    "4": [
     116.3,
     66.8,
     351
    ]
   },
   "tiefe": {
    "4": 3.4
   }
  },
  {
   "id": "D12",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     100.7,
     69.8,
     15
    ],
    "6": [
     100.7,
     69.8,
     15
    ]
   },
   "tiefe": {
    "5": 3.3,
    "6": 3.3
   }
  },
  {
   "id": "D13",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     98.6,
     77.5,
     15
    ],
    "6": [
     98.6,
     77.5,
     15
    ]
   },
   "tiefe": {
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D14",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     96.5,
     85.2,
     15
    ],
    "6": [
     96.5,
     85.2,
     15
    ]
   },
   "tiefe": {
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D15",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     94.5,
     93.0,
     15
    ],
    "6": [
     94.5,
     93.0,
     15
    ]
   },
   "tiefe": {
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D16",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     92.4,
     100.7,
     15
    ],
    "6": [
     92.4,
     100.7,
     15
    ]
   },
   "tiefe": {
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "D17",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     126.3,
     97.9,
     327
    ],
    "6": [
     126.3,
     97.9,
     327
    ]
   },
   "tiefe": {
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "D18",
   "steg": "D",
   "klasse": "L",
   "art": "finger",
   "laenge": 20.0,
   "breite": 8.0,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     130.7,
     104.6,
     327
    ],
    "6": [
     130.7,
     104.6,
     327
    ]
   },
   "tiefe": {
    "5": 3.5,
    "6": 3.5
   }
  },
  {
   "id": "D19",
   "steg": "D",
   "klasse": "L",
   "art": "stirn",
   "laenge": 18.4,
   "breite": 9.9,
   "maxLaenge": 14.0,
   "maxBreite": 7.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     144.9,
     87.2,
     56
    ],
    "6": [
     144.9,
     87.2,
     56
    ]
   },
   "tiefe": {
    "5": 3.4,
    "6": 3.4
   }
  },
  {
   "id": "F01",
   "steg": "F",
   "klasse": "M",
   "art": "fischer",
   "laenge": 12.0,
   "breite": 4.6,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    2
   ],
   "lage": {
    "2": [
     -133.3,
     16.4,
     93
    ]
   },
   "tiefe": {
    "2": 1.0
   }
  },
  {
   "id": "F02",
   "steg": "F",
   "klasse": "M",
   "art": "fischer",
   "laenge": 12.0,
   "breite": 4.6,
   "maxLaenge": 9.0,
   "maxBreite": 3.2,
   "stufen": [
    3,
    4,
    5,
    6
   ],
   "lage": {
    "3": [
     -133.6,
     26.3,
     94
    ],
    "4": [
     -133.6,
     26.3,
     94
    ],
    "5": [
     -133.6,
     26.3,
     94
    ],
    "6": [
     -133.6,
     26.3,
     94
    ]
   },
   "tiefe": {
    "3": 1.5,
    "4": 1.5,
    "5": 1.5,
    "6": 1.5
   }
  },
  {
   "id": "K01",
   "steg": "K",
   "klasse": "XL",
   "art": "kai",
   "laenge": 35.2,
   "breite": 9.3,
   "maxLaenge": 40.0,
   "maxBreite": 8.0,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     21.6,
     234.4,
     0
    ],
    "6": [
     21.6,
     234.4,
     0
    ]
   },
   "tiefe": {
    "5": 5.0,
    "6": 5.0
   }
  },
  {
   "id": "K02",
   "steg": "K",
   "klasse": "XL",
   "art": "kai",
   "laenge": 57.6,
   "breite": 12.2,
   "maxLaenge": 40.0,
   "maxBreite": 8.0,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     72.0,
     235.9,
     0
    ],
    "6": [
     72.0,
     235.9,
     0
    ]
   },
   "tiefe": {
    "5": 5.0,
    "6": 5.0
   }
  },
  {
   "id": "K03",
   "steg": "K",
   "klasse": "XL",
   "art": "kai",
   "laenge": 41.6,
   "breite": 9.9,
   "maxLaenge": 40.0,
   "maxBreite": 8.0,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     125.6,
     234.8,
     0
    ],
    "6": [
     125.6,
     234.8,
     0
    ]
   },
   "tiefe": {
    "5": 5.0,
    "6": 5.0
   }
  },
  {
   "id": "FK01",
   "steg": "FK",
   "klasse": "L",
   "art": "fischer",
   "laenge": 17.6,
   "breite": 6.2,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     3.9,
     244.8,
     97
    ],
    "6": [
     3.9,
     244.8,
     97
    ]
   },
   "tiefe": {
    "5": 5.0,
    "6": 8.5
   }
  },
  {
   "id": "FK02",
   "steg": "FK",
   "klasse": "L",
   "art": "fischer",
   "laenge": 16.0,
   "breite": 5.9,
   "maxLaenge": 14.0,
   "maxBreite": 4.5,
   "stufen": [
    5,
    6
   ],
   "lage": {
    "5": [
     1.3,
     264.4,
     97
    ],
    "6": [
     1.3,
     264.4,
     97
    ]
   },
   "tiefe": {
    "5": 5.0,
    "6": 8.5
   }
  },
  {
   "id": "P01",
   "steg": "P",
   "klasse": "XXL",
   "art": "pier",
   "laenge": 288.0,
   "breite": 46.4,
   "maxLaenge": 182.0,
   "maxBreite": 30.0,
   "stufen": [
    6
   ],
   "lage": {
    "6": [
     -122.0,
     370.3,
     90
    ]
   },
   "tiefe": {
    "6": 8.5
   }
  },
  {
   "id": "MA01",
   "steg": "MA",
   "klasse": "XXL",
   "art": "marine",
   "laenge": 144.0,
   "breite": 20.8,
   "maxLaenge": 92.0,
   "maxBreite": 14.0,
   "stufen": [
    6
   ],
   "lage": {
    "6": [
     -294.8,
     298.7,
     90
    ]
   },
   "tiefe": {
    "6": 8.5
   }
  },
  {
   "id": "MA02",
   "steg": "MA",
   "klasse": "XXL",
   "art": "marine",
   "laenge": 140.8,
   "breite": 19.2,
   "maxLaenge": 92.0,
   "maxBreite": 14.0,
   "stufen": [
    6
   ],
   "lage": {
    "6": [
     -324.4,
     297.1,
     90
    ]
   },
   "tiefe": {
    "6": 8.5
   }
  },
  {
   "id": "SK01",
   "steg": "SK",
   "klasse": "XXL",
   "art": "seenotretter",
   "laenge": 73.6,
   "breite": 16.0,
   "maxLaenge": 48.0,
   "maxBreite": 11.0,
   "stufen": [
    6
   ],
   "lage": {
    "6": [
     57.0,
     302.6,
     6
    ]
   },
   "tiefe": {
    "6": 5.0
   }
  }
 ],
 "stufen": {
  "1": {
   "name": "Bootssteg am See",
   "anzahl": {
    "S": 6,
    "gesamt": 6
   },
   "plaetze": [
    "A01",
    "A02",
    "A03",
    "A04",
    "A05",
    "A06"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -105.0,
       -11.0
      ],
      [
       -108.0,
       36.0
      ],
      [
       -97.0,
       38.0
      ]
     ]
    }
   ],
   "dienste": []
  },
  "2": {
   "name": "Dorfhafen am See",
   "anzahl": {
    "S": 11,
    "M": 19,
    "gesamt": 30
   },
   "plaetze": [
    "A01",
    "A02",
    "A03",
    "A04",
    "A05",
    "A06",
    "A07",
    "A08",
    "A09",
    "A10",
    "A11",
    "B01",
    "B02",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B09",
    "B10",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B17",
    "B18",
    "F01"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -105.0,
       -11.0
      ],
      [
       -110.0,
       40.0
      ],
      [
       -113.0,
       58.0
      ],
      [
       -96.0,
       62.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -55.0,
       -9.6
      ],
      [
       -55.0,
       62.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -74.0,
       62.0
      ],
      [
       -36.0,
       62.0
      ]
     ]
    },
    {
     "steg": "F",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -137.0,
       -6.8
      ],
      [
       -139.0,
       34.0
      ]
     ]
    }
   ],
   "dienste": []
  },
  "3": {
   "name": "Durchstich zur Ostsee",
   "anzahl": {
    "S": 17,
    "M": 23,
    "L": 14,
    "gesamt": 54
   },
   "plaetze": [
    "A03",
    "A04",
    "A05",
    "A06",
    "A07",
    "A08",
    "A09",
    "A10",
    "A11",
    "A12",
    "A13",
    "A14",
    "A15",
    "A16",
    "A17",
    "A18",
    "A19",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B19",
    "B20",
    "B21",
    "B22",
    "B23",
    "B24",
    "B25",
    "B26",
    "B27",
    "B28",
    "C01",
    "C02",
    "C03",
    "C04",
    "C05",
    "C06",
    "C07",
    "C08",
    "C09",
    "C10",
    "C11",
    "C12",
    "C13",
    "C14",
    "F02"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -105.0,
       2.0
      ],
      [
       -110.0,
       40.0
      ],
      [
       -117.0,
       74.0
      ],
      [
       -100.0,
       78.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -55.0,
       2.0
      ],
      [
       -55.0,
       84.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -74.0,
       84.0
      ],
      [
       -36.0,
       84.0
      ]
     ]
    },
    {
     "steg": "F",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -137.0,
       3.0
      ],
      [
       -139.0,
       34.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       13.0,
       2.0
      ],
      [
       13.0,
       72.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       -11.0,
       74.0
      ],
      [
       37.0,
       70.0
      ]
     ]
    }
   ],
   "dienste": []
  },
  "4": {
   "name": "Marina",
   "anzahl": {
    "S": 17,
    "M": 27,
    "L": 32,
    "gesamt": 76
   },
   "plaetze": [
    "A03",
    "A04",
    "A05",
    "A06",
    "A07",
    "A08",
    "A09",
    "A10",
    "A11",
    "A12",
    "A13",
    "A14",
    "A15",
    "A16",
    "A17",
    "A18",
    "A19",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B19",
    "B20",
    "B21",
    "B22",
    "B23",
    "B24",
    "B25",
    "B26",
    "B27",
    "B28",
    "C01",
    "C02",
    "C03",
    "C04",
    "C05",
    "C06",
    "C07",
    "C08",
    "C09",
    "C10",
    "C11",
    "C15",
    "C16",
    "C17",
    "C18",
    "C19",
    "C20",
    "C21",
    "C22",
    "C23",
    "C24",
    "CS01",
    "CS02",
    "CS03",
    "CS04",
    "D01",
    "D02",
    "D03",
    "D04",
    "D05",
    "D06",
    "D07",
    "D08",
    "D09",
    "D10",
    "D11",
    "F02"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -105.0,
       2.0
      ],
      [
       -110.0,
       40.0
      ],
      [
       -117.0,
       74.0
      ],
      [
       -100.0,
       78.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -55.0,
       2.0
      ],
      [
       -55.0,
       84.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -74.0,
       84.0
      ],
      [
       -36.0,
       84.0
      ]
     ]
    },
    {
     "steg": "F",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -137.0,
       3.0
      ],
      [
       -139.0,
       34.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       13.0,
       2.0
      ],
      [
       13.0,
       70.0
      ],
      [
       4.0,
       124.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       -21.0,
       128.0
      ],
      [
       28.0,
       121.0
      ]
     ]
    },
    {
     "steg": "CS",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       13.0,
       76.0
      ],
      [
       58.0,
       84.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 3.0,
     "punkte": [
      [
       110.0,
       2.0
      ],
      [
       116.0,
       60.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 3.0,
     "punkte": [
      [
       103.0,
       62.0
      ],
      [
       129.0,
       58.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 3.2,
     "punkte": [
      [
       112.0,
       178.0
      ],
      [
       142.0,
       178.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 2.0,
     "punkte": [
      [
       201.0,
       232.0
      ],
      [
       203.0,
       254.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       149.0,
       6.0
      ],
      [
       149.0,
       24.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       163.0,
       6.0
      ],
      [
       163.0,
       24.0
      ]
     ]
    }
   ],
   "dienste": [
    {
     "art": "tankstelle",
     "x": 125.2,
     "y": 172.1,
     "richtung": 0,
     "laenge": 14.4,
     "breite": 5.1
    },
    {
     "art": "seenotretter",
     "x": 196.6,
     "y": 243.2,
     "richtung": 85,
     "laenge": 17.6,
     "breite": 6.1
    }
   ]
  },
  "5": {
   "name": "Küstenmarina",
   "anzahl": {
    "S": 17,
    "M": 33,
    "L": 41,
    "XL": 3,
    "gesamt": 94
   },
   "plaetze": [
    "A03",
    "A04",
    "A05",
    "A06",
    "A07",
    "A08",
    "A09",
    "A10",
    "A11",
    "A12",
    "A13",
    "A14",
    "A15",
    "A16",
    "A17",
    "A18",
    "A19",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B19",
    "B20",
    "B21",
    "B22",
    "B23",
    "B24",
    "B25",
    "B26",
    "B29",
    "B30",
    "B31",
    "B32",
    "B33",
    "B34",
    "B35",
    "B36",
    "C01",
    "C02",
    "C03",
    "C04",
    "C05",
    "C06",
    "C07",
    "C08",
    "C09",
    "C10",
    "C11",
    "C15",
    "C16",
    "C17",
    "C18",
    "C19",
    "C20",
    "C21",
    "C22",
    "C23",
    "C24",
    "CS01",
    "CS02",
    "CS03",
    "CS04",
    "D01",
    "D02",
    "D03",
    "D04",
    "D05",
    "D06",
    "D07",
    "D08",
    "D09",
    "D10",
    "D12",
    "D13",
    "D14",
    "D15",
    "D16",
    "D17",
    "D18",
    "D19",
    "F02",
    "FK01",
    "FK02",
    "K01",
    "K02",
    "K03"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -105.0,
       2.0
      ],
      [
       -110.0,
       40.0
      ],
      [
       -117.0,
       74.0
      ],
      [
       -100.0,
       78.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -55.0,
       2.0
      ],
      [
       -55.0,
       100.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -74.0,
       100.0
      ],
      [
       -36.0,
       100.0
      ]
     ]
    },
    {
     "steg": "F",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -137.0,
       3.0
      ],
      [
       -139.0,
       34.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       13.0,
       2.0
      ],
      [
       13.0,
       70.0
      ],
      [
       4.0,
       124.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       -21.0,
       128.0
      ],
      [
       28.0,
       121.0
      ]
     ]
    },
    {
     "steg": "CS",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       13.0,
       76.0
      ],
      [
       58.0,
       84.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 3.0,
     "punkte": [
      [
       110.0,
       2.0
      ],
      [
       116.0,
       60.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 3.2,
     "punkte": [
      [
       112.0,
       178.0
      ],
      [
       142.0,
       178.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 2.0,
     "punkte": [
      [
       201.0,
       232.0
      ],
      [
       203.0,
       254.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       149.0,
       6.0
      ],
      [
       149.0,
       24.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       163.0,
       6.0
      ],
      [
       163.0,
       24.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 2.8,
     "punkte": [
      [
       116.0,
       60.0
      ],
      [
       102.0,
       112.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 2.8,
     "punkte": [
      [
       116.0,
       60.0
      ],
      [
       145.0,
       104.0
      ]
     ]
    },
    {
     "steg": "K",
     "bauart": "kai",
     "breite": 0.0,
     "punkte": [
      [
       2.0,
       229.0
      ],
      [
       150.0,
       229.0
      ]
     ]
    },
    {
     "steg": "FK",
     "bauart": "kai",
     "breite": 0.0,
     "punkte": [
      [
       -3.0,
       232.0
      ],
      [
       -9.0,
       280.0
      ]
     ]
    }
   ],
   "dienste": [
    {
     "art": "tankstelle",
     "x": 125.2,
     "y": 172.1,
     "richtung": 0,
     "laenge": 14.4,
     "breite": 5.1
    },
    {
     "art": "seenotretter",
     "x": 196.6,
     "y": 243.2,
     "richtung": 85,
     "laenge": 17.6,
     "breite": 6.1
    }
   ]
  },
  "6": {
   "name": "Seehafen",
   "anzahl": {
    "S": 17,
    "M": 33,
    "L": 41,
    "XL": 3,
    "XXL": 4,
    "gesamt": 98
   },
   "plaetze": [
    "A03",
    "A04",
    "A05",
    "A06",
    "A07",
    "A08",
    "A09",
    "A10",
    "A11",
    "A12",
    "A13",
    "A14",
    "A15",
    "A16",
    "A17",
    "A18",
    "A19",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B19",
    "B20",
    "B21",
    "B22",
    "B23",
    "B24",
    "B25",
    "B26",
    "B29",
    "B30",
    "B31",
    "B32",
    "B33",
    "B34",
    "B35",
    "B36",
    "C01",
    "C02",
    "C03",
    "C04",
    "C05",
    "C06",
    "C07",
    "C08",
    "C09",
    "C10",
    "C11",
    "C15",
    "C16",
    "C17",
    "C18",
    "C19",
    "C20",
    "C21",
    "C22",
    "C23",
    "C24",
    "CS01",
    "CS02",
    "CS03",
    "CS04",
    "D01",
    "D02",
    "D03",
    "D04",
    "D05",
    "D06",
    "D07",
    "D08",
    "D09",
    "D10",
    "D12",
    "D13",
    "D14",
    "D15",
    "D16",
    "D17",
    "D18",
    "D19",
    "F02",
    "FK01",
    "FK02",
    "K01",
    "K02",
    "K03",
    "MA01",
    "MA02",
    "P01",
    "SK01"
   ],
   "stege": [
    {
     "steg": "A",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -105.0,
       2.0
      ],
      [
       -110.0,
       40.0
      ],
      [
       -117.0,
       74.0
      ],
      [
       -100.0,
       78.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -55.0,
       2.0
      ],
      [
       -55.0,
       100.0
      ]
     ]
    },
    {
     "steg": "B",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       -74.0,
       100.0
      ],
      [
       -36.0,
       100.0
      ]
     ]
    },
    {
     "steg": "F",
     "bauart": "holz",
     "breite": 2.2,
     "punkte": [
      [
       -137.0,
       3.0
      ],
      [
       -139.0,
       34.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       13.0,
       2.0
      ],
      [
       13.0,
       70.0
      ],
      [
       4.0,
       124.0
      ]
     ]
    },
    {
     "steg": "C",
     "bauart": "holz",
     "breite": 2.8,
     "punkte": [
      [
       -21.0,
       128.0
      ],
      [
       28.0,
       121.0
      ]
     ]
    },
    {
     "steg": "CS",
     "bauart": "holz",
     "breite": 2.4,
     "punkte": [
      [
       13.0,
       76.0
      ],
      [
       58.0,
       84.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 3.0,
     "punkte": [
      [
       110.0,
       2.0
      ],
      [
       116.0,
       60.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 3.2,
     "punkte": [
      [
       112.0,
       178.0
      ],
      [
       142.0,
       178.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 2.0,
     "punkte": [
      [
       201.0,
       232.0
      ],
      [
       203.0,
       254.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       149.0,
       6.0
      ],
      [
       149.0,
       24.0
      ]
     ]
    },
    {
     "steg": null,
     "bauart": "schwimmsteg",
     "breite": 1.2,
     "punkte": [
      [
       163.0,
       6.0
      ],
      [
       163.0,
       24.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 2.8,
     "punkte": [
      [
       116.0,
       60.0
      ],
      [
       102.0,
       112.0
      ]
     ]
    },
    {
     "steg": "D",
     "bauart": "schwimmsteg",
     "breite": 2.8,
     "punkte": [
      [
       116.0,
       60.0
      ],
      [
       145.0,
       104.0
      ]
     ]
    },
    {
     "steg": "P",
     "bauart": "pier",
     "breite": 5.0,
     "punkte": [
      [
       -150.0,
       218.3
      ],
      [
       -150.0,
       430.0
      ]
     ]
    },
    {
     "steg": "MA",
     "bauart": "pier",
     "breite": 5.0,
     "punkte": [
      [
       -310.0,
       220.7
      ],
      [
       -310.0,
       390.0
      ]
     ]
    },
    {
     "steg": "K",
     "bauart": "kai",
     "breite": 0.0,
     "punkte": [
      [
       2.0,
       229.0
      ],
      [
       150.0,
       229.0
      ]
     ]
    },
    {
     "steg": "FK",
     "bauart": "kai",
     "breite": 0.0,
     "punkte": [
      [
       -3.0,
       232.0
      ],
      [
       -9.0,
       280.0
      ]
     ]
    }
   ],
   "dienste": [
    {
     "art": "tankstelle",
     "x": 125.2,
     "y": 172.1,
     "richtung": 0,
     "laenge": 14.4,
     "breite": 5.1
    },
    {
     "art": "seenotretter",
     "x": 196.6,
     "y": 243.2,
     "richtung": 85,
     "laenge": 17.6,
     "breite": 6.1
    }
   ]
  }
 }
};

// Stegbild dieses Spiels einsetzen (docs/stegbilder.md). Ohne Browser bleibt das Grundbild.
stegbildAnwenden(HAFEN);

// Plan -> Spielwelt (Meter, x Osten, z Sueden, y oben), siehe docs/grundgeruest.md.
export function inWelt(x, y) {
  const m = HAFEN.einheiten.meterProEinheit;
  return { x: x * m, z: -y * m };
}

// Lage eines Platzes in Stufe n in der Spielwelt. winkel in Bogenmass fuer
// object.rotation.y, wenn das Bootsmodell mit dem Bug nach +x gebaut ist.
// Gibt null zurueck, wenn es den Platz in dieser Stufe nicht gibt.
export function platzInWelt(platz, stufe) {
  const l = platz.lage[String(stufe)];
  if (!l) return null;
  const p = inWelt(l[0], l[1]);
  return { x: p.x, z: p.z, winkel: l[2] * Math.PI / 180 };
}

// Alle Plaetze einer Stufe.
export function plaetzeInStufe(stufe) {
  return HAFEN.plaetze.filter((p) => p.stufen.includes(stufe));
}

export default HAFEN;
