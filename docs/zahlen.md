# Spielzahlen

Erzeugt aus `web/js/data/economy.js` mit `node tools/zahlen.mjs --schreiben`. Nicht von Hand ändern:
Zahlen in economy.js ändern und die Datei neu schreiben. `tests/zahlen.test.mjs` meldet, wenn sie veraltet ist.

## Zeit

| Was | Wert |
|---|---|
| Tag / Abend | 270 s / 30 s |
| Saison / Winter | 16 / 2 Tage |
| Ankünfte | 0,05 bis 0,95 des Tages, Abstand 3 bis 12 s, an vollen Tagen 4 s im Mittel |
| Abreise | 0,07 bis 0,3 des Tages |
| Erstes Boot | nach 3 s |
| Geduld an der Boje | 30 s, selbst einfahren nach 8 s |

## Ausbaustufen

| Stufe | Name | Ankünfte/Tag | Mix | Ziel | Ausbau |
|---|---|---|---|---|---|
| 1 | Bootssteg am See | 8 | S 1 | 20 Gäste, Ruf 2,5 | Dorfhafen am See, 140 € |
| 2 | Dorfhafen am See | 18 | S 0,45, M 0,55 | 90 Gäste, Ruf 3 | Durchstich zur Ostsee, 2.200 € |
| 3 | Durchstich zur Ostsee | 25 | S 0,32, M 0,4, L 0,28 | 340 Gäste, Ruf 3,5 | Schwimmsteg D, 9.000 € |
| 4 | Marina | 29 | S 0,24, M 0,34, L 0,42 | 530 Gäste, Ruf 3,8 | Außenhafen mit Kai, 19.000 € |
| 5 | Küstenmarina | 31 | S 0,2, M 0,33, L 0,41, XL 0,06 | 740 Gäste, Ruf 4,2 | Pier für Großschiffe, 31.500 € |
| 6 | Seehafen | 31 | S 0,18, M 0,32, L 0,42, XL 0,08 | 6 Großschiffbesuche, Ruf 4,5, alle Plätze | - |

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
| Haken an Steg A | 1 | 80 € | 4 |
| Steg A verlängern | 2 | 220 € | 5 |
| Steg B | 2 | 200 € | 10 |
| Steg B verlängern | 2 | 630 € | 10 |
| T-Kopf an Steg B | 2 | 270 € | 6 |
| Steg A ausbauen | 3 | 990 € | 6 |
| Hauptsteg C | 3 | 2.200 € | 6 |
| Hauptsteg C verlängern | 3 | 3.200 € | 7 |
| T-Kopf an Steg C | 3 | 1.500 € | 4 |
| Hauptsteg C mit Knick | 4 | 5.400 € | 7 |
| Stichsteg an C | 4 | 2.700 € | 4 |
| Schwimmsteg D verlängern | 4 | 4.700 € | 4 |
| Stirnplatz an D | 4 | 1.800 € | 2 |
| Kai verlängern | 5 | 15.000 € | 2 |
| Gabelung an Steg D | 5 | 11.000 € | 7 |
| Steg B verlängern | 5 | 4.000 € | 6 |
| Yachtsteg | 6 | 13.500 € | 2 |

## Versorgung

| Bauwerk | Stufe | Name | ab Hafenstufe | Kosten | versorgt |
|---|---|---|---|---|---|
| Toilette | 1 | Toilettenhäuschen | 1 | 35 € | 12 |
|  | 2 | WC-Haus | 2 | 200 € | 40 |
|  | 3 | Sanitärgebäude | 3 | 1.500 € | 90 |
|  | 4 | Großes Sanitärgebäude | 4 | 4.700 € | 200 |
| Dusche | 1 | Kaltwasserdusche | 2 | 110 € | 20 |
|  | 2 | Duschhaus mit Warmwasser | 2 | 400 € | 44 |
|  | 3 | Großes Duschhaus | 3 | 2.200 € | 90 |
|  | 4 | Duschhaus mit Sauna | 4 | 6.300 € | 200 |
| Gastronomie | 1 | Kiosk | 2 | 220 € | 24 |
|  | 2 | Imbiss | 3 | 1.600 € | 70 |
|  | 3 | Hafenrestaurant | 4 | 5.400 € | 140 |
|  | 4 | Restaurant mit Terrasse | 5 | 11.000 € | 200 |
| Tankstelle | 1 | Zapfsäule | 4 | 2.700 € | 30 |
|  | 2 | Bootstankstelle | 5 | 6.100 € | 80 |
| WLAN | 1 | WLAN am Hafenbüro | 3 | 400 € | 12 |
|  | 2 | WLAN-Antennen an den Stegen | 4 | 1.200 € | 40 |
| Wäscherei | 1 | Waschmaschine und Trockner | 4 | 600 € | 6 |
|  | 2 | Waschsalon | 5 | 1.400 € | 20 |
| Absaugstation | 1 | Absaugstation | 5 | 900 € | 12 |
|  | 2 | Zweite Absaugstation | 6 | 1.800 € | 30 |
| Stromsäulen | 1 | Stromsäulen an Steg B | 3 | 1.100 € | - |

## Hafenbüro

| Stufe | Name | ab Hafenstufe | Kosten | schaltet frei |
|---|---|---|---|---|
| 1 | Hafenmeister mit Funk | 2 | 270 € | allesKassieren, vorschau, anmeldung |
| 2 | Kassenautomat | 2 | 810 € | sofortKassieren |
| 3 | Hafenbüro | 3 | 1.700 € | vorschlag, nebenkosten |
| 4 | Hafenleitstelle | 4 | 4.300 € | automatik |

Trinkgeld beim Selbst-Abholen (L, XL, XXL): 15 % des Liegegelds. Nebenkosten ab der Stufe mit nebenkosten: 10 % auf jedes kassierte Liegegeld. Von Hand eingewiesen: +0,25 Anker. Sonderfälle fahren nach 25 s selbst ein.

## Wind

| Was | Wert |
|---|---|
| Starkwind | ab Windstärke 0,55, Windlage zählt ab Stufe 2 (nicht am Sturmtag) |
| Windlage | offen ab 90 m Wellenweg (−0,5 Anker), geschützt bis 35 m (+0,5 Anker), Schwimmsteg dämpft auf 60 % |
| Große Boote | L, XL: Wind von achtern (Kosinus unter -0,5) −0,25 Anker, Anlegen mit 60 % Tempo |
| Richtungen | west 24 %, suedwest 20 %, nordwest 14 %, sued 8 %, nord 8 %, ost 10 %, nordost 8 %, suedost 8 %; Wetterlage 3 Tage, ±20 Grad je Tag, Sturm aus west, nordwest |

## Flottillen

| Was | Wert |
|---|---|
| ab Hafenstufe | 3 |
| Tage mit Flottille | Stufe 3: 15 %, Stufe 4: 20 %, Stufe 5: 22 %, Stufe 6: 25 % |
| Ankunft | 0,35 bis 0,75 des Tages, im Konvoi alle 2,5 s |
| Bewertung je Crew | alle an einem Steg +0,5 Anker, aufgeteilt −0,5 Anker |

## Preisstufe

Am Hafenbüro ab Hafenbüro-Stufe 1, eine Wahl je Saison (im Winter für die kommende) und nach jedem Ausbau, Start: normal.

| Stufe | Liegegeld | Ankünfte | Klassen | Anker | Anspruch |
|---|---|---|---|---|---|
| guenstig | −10 % | +20 % | S +15 % | +0,25 | Nachsicht bis +0,5 Anker, wenn kein Wunsch erfüllt |
| normal | - | - | - | - | - |
| gehoben | +30 % | −15 % | S −20 %, L +20 % | −0,25 | bis −1 Anker, wenn kein Wunsch erfüllt |

## Seltene Besucher

| Was | Wert |
|---|---|
| Tage mit Besuch | Stufe 1: 0 %, Stufe 2: 10 %, Stufe 3: 12 %, Stufe 4: 12 %, Stufe 5: 12 %, Stufe 6: 12 %; mindestens 3 Tage Abstand, nie am ersten Tag, nie im Winter |
| Noch nie gesehen | 4-faches Gewicht bei der Wahl |
| Ankunft | 0,3 bis 0,7 des Tages |
| weltumsegler | ab Stufe 2, 3 Nächte, Gewicht 1, Wünsche ehrenplatz, wasser, dusche, waesche |
| museumsschiff | ab Stufe 3, 2 Nächte, Gewicht 1, Wünsche ehrenplatz, wasser, 12 Tagesgäste |
| forschungsschiff | ab Stufe 4, 2 Nächte, Gewicht 1, Wünsche ehrenplatz, strom, wlan |
| koenigsyacht | ab Stufe 5, 1 Nacht, Gewicht 0,7, Wünsche ehrenplatz, strom, wasser, essen |
| Schaulustige am Ehrenplatz | je Abend Stufe 1: 0 €, Stufe 2: 30 €, Stufe 3: 60 €, Stufe 4: 110 €, Stufe 5: 180 €, Stufe 6: 260 €; koenigsyacht ×2, museumsschiff ×1,5; 10 Leute |
| schwaene | ab Stufe 1, an 15 % der Tage, Saisontag 2 bis 13, 0,1 bis 0,55 des Tages, 160 s im Bild |
| schweinswal | ab Stufe 3, an 12 % der Tage, Saisontag 1 bis 16, 0,1 bis 0,6 des Tages, 100 s im Bild |
| Foto | Motiv mindestens 6 % der kürzeren Bildseite, 8 % Rand frei |

## Services

| Service | Stufe | Name | ab Hafenstufe | Kosten | Mindestruf | Wirkung |
|---|---|---|---|---|---|---|
| Bootsverleih | 1 | Ruderboote am Strand | 1 | 70 € | - | proTag 8; wetter {regen:0.3, sturm:0} |
|  | 2 | Tretboote und Kanus | 2 | 400 € | - | proTag 25; wetter {regen:0.3, sturm:0}; ruf 0,03 |
|  | 3 | SUP- und Jollenverleih | 3 | 1.200 € | - | proTag 95; wetter {regen:0.25, sturm:0}; ruf 0,06; gaeste {S:1.05} |
| Slipanlage | 1 | Slipanlage | 2 | 320 € | - | trailer {anzahl:4, preis:8, wetter:{regen:0.4, sturm:0}} |
|  | 2 | Slip mit Trailerparkplatz | 3 | 720 € | - | trailer {anzahl:7, preis:12, wetter:{regen:0.4, sturm:0}} |
| Räucherei | 1 | Räucherkate | 2 | 540 € | - | kunden {anteil:0.25, preis:5}; abendgaeste {anzahl:4, preis:4, wetter:{regen:0.5, sturm:0}}; ruf 0,05 |
|  | 2 | Räucherei mit Fischladen | 4 | 3.600 € | - | kunden {anteil:0.3, preis:6}; abendgaeste {anzahl:10, preis:5, wetter:{regen:0.5, sturm:0}}; tagesgaeste 12; ruf 0,08 |
| Fischhalle | 1 | Fischhalle | 5 | 6.100 € | - | proTag 60; kunden {anteil:0.3, preis:5}; tagesgaeste 20; ruf 0,08; besucherFuerVersorgung 40 |
|  | 2 | Fischhalle mit Fischmarkt | 5 | 7.200 € | - | proTag 260; kunden {anteil:0.4, preis:6}; tagesgaeste 25; ruf 0,12; besucherFuerVersorgung 90 |
| Bäcker | 1 | Brötchenservice | 1 | 35 € | - | kunden {anteil:0.3, preis:3}; ruf 0,03 |
|  | 2 | Hafenbäcker | 3 | 1.400 € | - | kunden {anteil:0.6, preis:4}; tagesgaeste 6; ruf 0,06 |
| Hafencafé | 1 | Hafencafé | 2 | 360 € | - | kunden {anteil:0.5, preis:5, wetter:{regen:0.7, sturm:0.4}}; tagesgaeste 12; ruf 0,03 |
|  | 2 | Café mit Terrasse | 3 | 2.200 € | - | kunden {anteil:0.75, preis:5, wetter:{regen:0.6, sturm:0.3}}; tagesgaeste 15; ruf 0,06 |
| Grillplatz | 1 | Grillplatz | 2 | 180 € | - | ruf 0,05 |
| Fahrradverleih | 1 | Fahrradverleih | 3 | 900 € | - | kunden {anteil:0.12, preis:8, wetter:{regen:0.3, sturm:0}}; dienst {anteil:0.18, nur:{klasse:[S, M, L], naechteMax:2}, naechte:1, preis:30, wetter:{regen:0.3, sturm:0}}; tagesgaeste 8 |
| Eisdiele | 1 | Eisdiele | 4 | 2.200 € | - | kunden {anteil:1.1, preis:3.5, wetter:{regen:0.2, sturm:0}}; tagesgaeste 20; gaeste {S:1.1}; ruf 0,03 |
| Segelclub | 1 | Segelclub | 3 | 2.200 € | - | proTag 20; ruf 0,08; gaeste {S:1.2}; freischalten [regatta]; jugend 5 |
|  | 2 | Segelschule | 4 | 6.500 € | - | proTag 120; wetter {regen:0.6, sturm:0}; ruf 0,12; gaeste {S:1.3, M:1.05}; freischalten [regatta]; jugend 8 |
|  | 3 | Regattaverein | 4 | 6.800 € | 3,8 | proTag 150; wetter {regen:0.6, sturm:0}; ruf 0,16; gaeste {S:1.15, M:1.1, L:1.05}; freischalten [regatta]; regatta 1,3; jugend 11 |
| Mastenkran | 1 | Mastenkran | 3 | 1.800 € | - | dienst {anteil:0.3, nur:{antrieb:segel, klasse:[M, L]}, naechte:1, preis:45}; gaeste {M:1.2}; dauerlieger {krantage:true, preis:45, nur:{antrieb:segel}} |
| Bootsausrüster | 1 | Bootsausrüster | 3 | 2.000 € | - | kunden {anteil:0.25, preis:8} |
|  | 2 | Yachtausrüster mit Motorenwerkstatt | 4 | 4.000 € | - | kunden {anteil:0.25, preis:24}; synergie [{id:travellift, faktor:1.15}]; ruf 0,04 |
| Travellift und Werft | 1 | Bootsschuppen mit Werkstatt | 4 | 5.600 € | - | dienst {anteil:0.12, nur:{klasse:[M, L, XL]}, naechte:1, preis:220}; winter {proTag:400}; proTag 40; dauerlieger {krantage:true, preis:60} |
|  | 2 | Travellift | 4 | 6.300 € | - | dienst {anteil:0.15, nur:{klasse:[M, L, XL]}, naechte:1, preis:300}; gaeste {L:1.1}; winter {proTag:600}; dauerlieger {krantage:true, preis:60} |
|  | 3 | Werfthalle mit Slipwagen | 4 | 11.500 € | 3,8 | dienst {anteil:0.2, nur:{klasse:[M, L, XL]}, naechte:2, preis:450}; gaeste {L:1.12}; ruf 0,08; winter {proTag:1100}; dauerlieger {krantage:true, preis:70} |
| Winterlager | 1 | Freilager mit Böcken | 4 | 4.500 € | - | winter {proTag:900}; dauerlieger {winter:50} |
|  | 2 | Winterlagerhalle | 5 | 12.000 € | - | winter {proTag:2200}; ruf 0,06; gaeste {L:1.05}; dauerlieger {winter:80} |
| Segelmacher | 1 | Segelmacherei | 4 | 3.400 € | - | kunden {anteil:0.07, preis:90, nur:{antrieb:segel}}; hafengeld {segel:1.15}; synergie [{id:mastenkran, faktor:1.2}]; dauerlieger {anteil:0.1, preis:90, nur:{antrieb:segel}} |
|  | 2 | Segelloft | 5 | 5.000 € | - | kunden {anteil:0.1, preis:120, nur:{antrieb:segel}}; hafengeld {segel:1.2}; synergie [{id:mastenkran, faktor:1.2}, {id:segelclub, faktor:1.1}]; ruf 0,05; dauerlieger {anteil:0.12, preis:120, nur:{antrieb:segel}} |
| Seenotretter-Station | 1 | Seenotrettungsboot | 4 | 3.600 € | - | sturmschutz 0,5; ruf 0,15 |
|  | 2 | Seenotrettungskreuzer | 6 | 9.000 € | - | sturmschutz 0,8; ruf 0,25; freischalten [seenotkreuzer]; Besuch alle 15 Tage, 900 € |
| Fahrgastanleger | 1 | Fahrgastanleger | 5 | 9.400 € | - | freischalten [fahrgastschiff]; wetter {regen:0.6, sturm:0}; proTag 150; Besuch alle 1 Tage, 160 € |
|  | 2 | Ausflugsflotte | 5 | 11.500 € | 4 | freischalten [fahrgastschiff]; wetter {regen:0.6, sturm:0}; ruf 0,05; Besuch alle 1 Tage, 360 € |
| Museumshafen | 1 | Museumshafen | 5 | 9.900 € | 4 | proTag 80; freischalten [traditionssegler]; ruf 0,12; gaeste {XL:1.5} |
|  | 2 | Museumshafen mit Speicher | 5 | 13.500 € | 4,2 | proTag 160; freischalten [traditionssegler]; ruf 0,18; gaeste {XL:1.5}; hafenfest 1,5 |
|  | 3 | Windjammertreffen | 6 | 15.500 € | - | proTag 280; freischalten [traditionssegler]; ruf 0,18; gaeste {XL:1.6}; hafenfest 1,5; Besuch alle 6 Tage, 5.000 € |
| Barkasse | 1 | Barkasse | 6 | 4.000 € | - | proTag 220; wetter {regen:0.5, sturm:0}; ruf 0,03 |
| Kreuzfahrtterminal | 1 | Kreuzfahrtpier | 6 | 27.000 € | 4 | freischalten [kreuzfahrtschiff]; Besuch alle 4 Tage, 6.500 € |
|  | 2 | Kreuzfahrtterminal | 6 | 54.000 € | 4,5 | freischalten [kreuzfahrtschiff]; ruf 0,1; Besuch alle 2 Tage, 9.500 € |
| Marineanleger | 1 | Marineanleger | 6 | 22.500 € | 4 | freischalten [marine]; sturmschutz 0,1; Besuch alle 5 Tage, 3.600 € |
|  | 2 | Marinestützpunkt | 6 | 45.000 € | 4,6 | proTag 450; freischalten [marine]; sturmschutz 0,2; ruf 0,08; Besuch alle 3 Tage, 4.200 € |

## Jugendtraining

| Was | Wert |
|---|---|
| braucht | Segelclub und Slipanlage |
| Trainingstage | jeden 4. Saisontag ab dem 3.; nicht bei Sturm, Starkwind oder Regatta |
| Zeit | ins Wasser bei 0,25 des Tages, ohne Bild 0,4 des Tages draußen |
| Trainerboot | S3-3, 4,8 m, braucht eine Box für den Tag |
| Belohnung | +0,2 Anker für jeden Gast im Hafen, Beitrag 15 € / 25 € / 40 € |
| Gruppe je Ausbau | 1: 5 Optis; 2: 6 Optis und 2 Jollen; 3: 8 Optis und 3 Jollen |

## Ereignisse

| Ereignis | ab Stufe | alle Tage | Dauer | Saison | Wirkung |
|---|---|---|---|---|---|
| Nebel | 1 | 9 | 1 | 1 bis 16 | arrivalFactor 0,7; extraNights 1 |
| Sommertag | 1 | 8 | 1 | 3 bis 14 | arrivalFactor 1,25; sizeFactor {S:2, M:1.2}; visitorFactor 1,5; serviceIncomeFactor 1,3 |
| Sturm | 3 | 8 | 1 | 2 bis 16 | seaArrivals false; extraNights 1; satisfaction {outer:-1} |
| Regatta | 3 | 9 | 1 | 2 bis 16 | arrivalFactor 1,6; kindFactor {jolle:3, segelyacht:3, mehrrumpf:2}; visitorFactor 1,5; serviceIncomeFactor 1,3; ratingBonus 0,25 |
| Hafenfest | 3 | 18 | 1 | 3 bis 15 | arrivalFactor 1,5; kindFactor {traditionssegler:6}; sizeFactor {XL:2}; visitorFactor 1,6; serviceIncomeFactor 1,3; ratingBonus 0,1 |
| Mittsommer | 2 | 18 | 1 | 7 bis 7 | arrivalFactor 1,15; visitorFactor 1,6; serviceIncomeFactor 1,3; extraNights 1 |
| Heringstage | 2 | 18 | 1 | 3 bis 3 | visitorFactor 1,5; serviceIncomeFactor 1,2; kindFactor {M4:2} |
| Holzboot-Treffen | 3 | 11 | 1 | 3 bis 15 | arrivalFactor 1,2; kindFactor {M2:5, S1:2}; visitorFactor 1,3; ratingBonus 0,15 |
| Hanse-Woche | 5 | 18 | 2 | 11 bis 15 | arrivalFactor 1,5; kindFactor {traditionssegler:6, M2:2}; sizeFactor {XL:2, L:1.3}; visitorFactor 2,2; serviceIncomeFactor 1,6; ratingBonus 0,3 |

