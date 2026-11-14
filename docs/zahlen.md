# Spielzahlen

Erzeugt aus `web/js/data/economy.js` mit `node tools/zahlen.mjs --schreiben`. Nicht von Hand ändern:
Zahlen in economy.js ändern und die Datei neu schreiben. `tests/zahlen.test.mjs` meldet, wenn sie veraltet ist.

## Zeit

| Was | Wert |
|---|---|
| Tag / Abend | 90 s / 30 s |
| Saison / Winter | 30 / 3 Tage |
| Ankünfte | 0,05 bis 0,95 des Tages, Abstand 3 bis 8 s, an vollen Tagen 4 s im Mittel |
| Abreise | 0,07 bis 0,3 des Tages |
| Erstes Boot | nach 3 s |
| Geduld an der Boje | 30 s, selbst einfahren nach 8 s |

## Ausbaustufen

| Stufe | Name | Ankünfte/Tag | Mix | Ziel | Ausbau |
|---|---|---|---|---|---|
| 1 | Bootssteg am See | 4 | S 1 | 20 Gäste, Ruf 2,5 | Dorfhafen am See, 400 € |
| 2 | Dorfhafen am See | 11 | S 0,45, M 0,55 | 120 Gäste, Ruf 3 | Durchstich zur Ostsee, 5.000 € |
| 3 | Durchstich zur Ostsee | 16 | S 0,32, M 0,4, L 0,28 | 360 Gäste, Ruf 3,5 | Schwimmsteg D, 20.000 € |
| 4 | Marina | 18 | S 0,24, M 0,34, L 0,42 | 560 Gäste, Ruf 3,8 | Außenhafen mit Kai, 42.000 € |
| 5 | Küstenmarina | 20 | S 0,2, M 0,33, L 0,41, XL 0,06 | 840 Gäste, Ruf 4,2 | Pier für Großschiffe, 70.000 € |
| 6 | Seehafen | 20 | S 0,18, M 0,32, L 0,42, XL 0,08 | 6 Großschiffbesuche, Ruf 4,5, alle Plätze | - |

## Liegegeld je Klasse

| Klasse | je Meter | Grundpreis | Nächte | Wünsche |
|---|---|---|---|---|
| S | 2,5 € | 11 € | 1 bis 3 | 0 bis 2 |
| M | 2,7 € | 22 € | 2 bis 4 | 1 bis 2 |
| L | 3,7 € | 45 € | 2 bis 5 | 1 bis 3 |
| XL | 4,2 € | 120 € | 1 bis 3 | 2 bis 3 |
| XXL | - | 0 € | 1 bis 1 | 0 bis 0 |

Liegegeld je angefangenem Meter Bootslänge (B10); der Grundpreis ist der Schnitt der Klasse und gilt für Boote ohne Länge. Je erfülltem Wunsch +25 %.

## Stegprojekte

| Projekt | ab Stufe | Kosten | Plätze |
|---|---|---|---|
| Haken an Steg A | 1 | 180 € | 4 |
| Steg A verlängern | 2 | 500 € | 5 |
| Steg B | 2 | 700 € | 10 |
| Steg B verlängern | 2 | 1.400 € | 10 |
| T-Kopf an Steg B | 2 | 600 € | 6 |
| Steg A ausbauen | 3 | 2.200 € | 6 |
| Hauptsteg C | 3 | 5.000 € | 6 |
| Hauptsteg C verlängern | 3 | 7.000 € | 7 |
| T-Kopf an Steg C | 3 | 3.300 € | 4 |
| Hauptsteg C mit Knick | 4 | 12.000 € | 7 |
| Stichsteg an C | 4 | 6.000 € | 4 |
| Schwimmsteg D verlängern | 4 | 10.500 € | 4 |
| Stirnplatz an D | 4 | 4.000 € | 2 |
| Kai verlängern | 5 | 33.000 € | 2 |
| Gabelung an Steg D | 5 | 24.000 € | 7 |
| Steg B verlängern | 5 | 9.000 € | 6 |

## Versorgung

| Bauwerk | Stufe | Name | ab Hafenstufe | Kosten | versorgt |
|---|---|---|---|---|---|
| Toilette | 1 | Toilettenhäuschen | 1 | 80 € | 6 |
|  | 2 | WC-Haus | 2 | 450 € | 20 |
|  | 3 | Sanitärgebäude | 3 | 3.300 € | 45 |
|  | 4 | Großes Sanitärgebäude | 4 | 10.500 € | 100 |
| Dusche | 1 | Kaltwasserdusche | 2 | 250 € | 10 |
|  | 2 | Duschhaus mit Warmwasser | 2 | 900 € | 22 |
|  | 3 | Großes Duschhaus | 3 | 5.000 € | 45 |
|  | 4 | Duschhaus mit Sauna | 4 | 14.000 € | 100 |
| Gastronomie | 1 | Kiosk | 2 | 500 € | 12 |
|  | 2 | Imbiss | 3 | 3.600 € | 35 |
|  | 3 | Hafenrestaurant | 4 | 12.000 € | 70 |
|  | 4 | Restaurant mit Terrasse | 5 | 24.000 € | 100 |
| Tankstelle | 1 | Zapfsäule | 4 | 6.000 € | 15 |
|  | 2 | Bootstankstelle | 5 | 13.500 € | 40 |
| Stromsäulen | 1 | Stromsäulen an Steg B | 3 | 2.400 € | - |

## Hafenbüro

| Stufe | Name | ab Hafenstufe | Kosten | schaltet frei |
|---|---|---|---|---|
| 1 | Hafenmeister mit Funk | 2 | 600 € | allesKassieren, vorschau, anmeldung |
| 2 | Kassenautomat | 2 | 1.800 € | sofortKassieren |
| 3 | Hafenbüro | 3 | 3.800 € | vorschlag, nebenkosten |
| 4 | Hafenleitstelle | 4 | 9.500 € | automatik |

Trinkgeld beim Selbst-Abholen (L, XL, XXL): 15 % des Liegegelds. Nebenkosten ab der Stufe mit nebenkosten: 10 % auf jedes kassierte Liegegeld. Von Hand eingewiesen: +0,25 Anker. Sonderfälle fahren nach 25 s selbst ein.

## Services

| Service | Stufe | Name | ab Hafenstufe | Kosten | Mindestruf | Wirkung |
|---|---|---|---|---|---|---|
| Bootsverleih | 1 | Ruderboote am Strand | 1 | 150 € | - | proTag 8; wetter {regen:0.3, sturm:0} |
|  | 2 | Tretboote und Kanus | 2 | 900 € | - | proTag 25; wetter {regen:0.3, sturm:0}; ruf 0,03 |
|  | 3 | SUP- und Jollenverleih | 3 | 2.600 € | - | proTag 95; wetter {regen:0.25, sturm:0}; ruf 0,06; gaeste {S:1.05} |
| Slipanlage | 1 | Slipanlage | 2 | 700 € | - | proTag 16; wetter {regen:0.4, sturm:0}; kunden {anteil:0.1, preis:6, nur:{klasse:[S, M]}}; gaeste {S:1.1} |
|  | 2 | Slip mit Trailerparkplatz | 3 | 1.600 € | - | proTag 60; wetter {regen:0.4, sturm:0}; kunden {anteil:0.12, preis:10, nur:{klasse:[S, M]}}; gaeste {S:1.05} |
| Räucherei | 1 | Räucherkate | 2 | 1.200 € | - | proTag 20; kunden {anteil:0.15, preis:4}; ruf 0,05 |
|  | 2 | Räucherei mit Fischladen | 4 | 8.000 € | - | proTag 60; kunden {anteil:0.2, preis:6}; ruf 0,08 |
| Fischhalle | 1 | Fischhalle | 5 | 13.500 € | - | proTag 60; kunden {anteil:0.3, preis:5}; ruf 0,08; besucherFuerVersorgung 40 |
|  | 2 | Fischhalle mit Fischmarkt | 5 | 16.000 € | - | proTag 260; kunden {anteil:0.4, preis:6}; ruf 0,12; besucherFuerVersorgung 90 |
| Bäcker | 1 | Brötchenservice | 1 | 80 € | - | kunden {anteil:0.3, preis:3}; ruf 0,03 |
|  | 2 | Hafenbäcker | 3 | 3.200 € | - | proTag 30; kunden {anteil:0.4, preis:3}; ruf 0,06 |
| Hafencafé | 1 | Hafencafé | 2 | 800 € | - | proTag 18; wetter {regen:0.5, sturm:0.3}; kunden {anteil:0.2, preis:4}; ruf 0,03 |
|  | 2 | Café mit Terrasse | 3 | 4.800 € | - | proTag 70; wetter {regen:0.4, sturm:0.2}; kunden {anteil:0.3, preis:5}; ruf 0,06 |
| Grillplatz | 1 | Grillplatz | 2 | 400 € | - | ruf 0,05 |
| Fahrradverleih | 1 | Fahrradverleih | 3 | 2.000 € | - | proTag 25; wetter {regen:0.3, sturm:0}; kunden {anteil:0.15, preis:8} |
| Eisdiele | 1 | Eisdiele | 4 | 5.000 € | - | proTag 90; wetter {regen:0.2, sturm:0}; kunden {anteil:0.25, preis:3}; ruf 0,03 |
| Segelclub | 1 | Segelclub | 3 | 5.000 € | - | proTag 20; ruf 0,08; gaeste {S:1.2}; freischalten [regatta] |
|  | 2 | Segelschule | 4 | 14.500 € | - | proTag 120; wetter {regen:0.6, sturm:0}; ruf 0,12; gaeste {S:1.3, M:1.05}; freischalten [regatta] |
|  | 3 | Regattaverein | 4 | 15.000 € | 3,8 | proTag 150; wetter {regen:0.6, sturm:0}; ruf 0,16; gaeste {S:1.15, M:1.1, L:1.05}; freischalten [regatta]; regatta 1,3 |
| Mastenkran | 1 | Mastenkran | 3 | 4.000 € | - | kunden {anteil:0.08, preis:35, nur:{antrieb:segel}}; gaeste {M:1.2} |
| Bootsausrüster | 1 | Bootsausrüster | 3 | 4.500 € | - | kunden {anteil:0.25, preis:8} |
|  | 2 | Yachtausrüster mit Motorenwerkstatt | 4 | 9.000 € | - | kunden {anteil:0.25, preis:24}; synergie [{id:travellift, faktor:1.15}]; ruf 0,04 |
| Travellift und Werft | 1 | Bootsschuppen mit Werkstatt | 4 | 12.500 € | - | kunden {anteil:0.06, preis:120}; winter {proTag:400}; proTag 40 |
|  | 2 | Travellift | 4 | 14.000 € | - | kunden {anteil:0.08, preis:170}; gaeste {L:1.1}; winter {proTag:600} |
|  | 3 | Werfthalle mit Slipwagen | 4 | 26.000 € | 3,8 | kunden {anteil:0.1, preis:190}; gaeste {L:1.12}; ruf 0,08; winter {proTag:1100} |
| Winterlager | 1 | Freilager mit Böcken | 4 | 10.000 € | - | winter {proTag:900} |
|  | 2 | Winterlagerhalle | 5 | 27.000 € | - | winter {proTag:2200}; ruf 0,06; gaeste {L:1.05} |
| Segelmacher | 1 | Segelmacherei | 4 | 7.500 € | - | kunden {anteil:0.07, preis:90, nur:{antrieb:segel}}; hafengeld {segel:1.15}; synergie [{id:mastenkran, faktor:1.2}] |
|  | 2 | Segelloft | 5 | 11.000 € | - | kunden {anteil:0.1, preis:120, nur:{antrieb:segel}}; hafengeld {segel:1.2}; synergie [{id:mastenkran, faktor:1.2}, {id:segelclub, faktor:1.1}]; ruf 0,05 |
| Seenotretter-Station | 1 | Seenotrettungsboot | 4 | 8.000 € | - | sturmschutz 0,5; ruf 0,15 |
|  | 2 | Seenotrettungskreuzer | 6 | 20.000 € | - | sturmschutz 0,8; ruf 0,25; freischalten [seenotkreuzer]; Besuch alle 28 Tage, 900 € |
| Fahrgastanleger | 1 | Fahrgastanleger | 5 | 21.000 € | - | freischalten [fahrgastschiff]; wetter {regen:0.6, sturm:0}; proTag 150; Besuch alle 1 Tage, 160 € |
|  | 2 | Ausflugsflotte | 5 | 26.000 € | 4 | freischalten [fahrgastschiff]; wetter {regen:0.6, sturm:0}; ruf 0,05; Besuch alle 1 Tage, 360 € |
| Museumshafen | 1 | Museumshafen | 5 | 22.000 € | 4 | proTag 80; freischalten [traditionssegler]; ruf 0,12; gaeste {XL:1.5} |
|  | 2 | Museumshafen mit Speicher | 5 | 30.000 € | 4,2 | proTag 160; freischalten [traditionssegler]; ruf 0,18; gaeste {XL:1.5}; hafenfest 1,5 |
|  | 3 | Windjammertreffen | 6 | 34.000 € | - | proTag 280; freischalten [traditionssegler]; ruf 0,18; gaeste {XL:1.6}; hafenfest 1,5; Besuch alle 12 Tage, 5.000 € |
| Barkasse | 1 | Barkasse | 6 | 9.000 € | - | proTag 220; wetter {regen:0.5, sturm:0}; ruf 0,03 |
| Kreuzfahrtterminal | 1 | Kreuzfahrtpier | 6 | 60.000 € | 4 | freischalten [kreuzfahrtschiff]; Besuch alle 7 Tage, 6.500 € |
|  | 2 | Kreuzfahrtterminal | 6 | 120.000 € | 4,5 | freischalten [kreuzfahrtschiff]; ruf 0,1; Besuch alle 4 Tage, 9.500 € |
| Marineanleger | 1 | Marineanleger | 6 | 50.000 € | 4 | freischalten [marine]; sturmschutz 0,1; Besuch alle 10 Tage, 3.600 € |
|  | 2 | Marinestützpunkt | 6 | 100.000 € | 4,6 | proTag 450; freischalten [marine]; sturmschutz 0,2; ruf 0,08; Besuch alle 6 Tage, 4.200 € |

## Ereignisse

| Ereignis | ab Stufe | alle Tage | Dauer | Saison | Wirkung |
|---|---|---|---|---|---|
| Nebel | 1 | 13 | 1 | 1 bis 30 | arrivalFactor 0,7; extraNights 1 |
| Sommertag | 1 | 11 | 1 | 7 bis 24 | arrivalFactor 1,25; sizeFactor {S:2, M:1.2}; visitorFactor 1,5; serviceIncomeFactor 1,3 |
| Sturm | 3 | 12 | 1 | 3 bis 30 | seaArrivals false; extraNights 1; satisfaction {outer:-1} |
| Regatta | 3 | 14 | 2 | 6 bis 26 | arrivalFactor 1,6; kindFactor {jolle:3, segelyacht:3, mehrrumpf:2}; visitorFactor 1,5; serviceIncomeFactor 1,3; ratingBonus 0,25 |
| Hafenfest | 4 | 20 | 1 | 10 bis 24 | arrivalFactor 1,3; kindFactor {traditionssegler:6}; sizeFactor {XL:2}; visitorFactor 2; serviceIncomeFactor 1,5; ratingBonus 0,25 |

