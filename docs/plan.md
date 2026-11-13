# Hafenmeister: Spielplan

Stand: 12.11.2026, Version 3, abgeglichen mit `main` nach PR 144. Status: Abschnitt 13 sagt, was gebaut ist, was als Nächstes kommt und was nach 1.0 kommt; in den Abschnitten 3 bis 12 ist alles, was noch nicht im Spiel ist, mit **(geplant, Pnn)** markiert (Pnn = Paket der [Roadmap](roadmap.md)). Dieses Dokument ist der einzige gültige Plan. Es fasst den alten Spielplan ([archiv/plan-v1.md](archiv/plan-v1.md)), [hafen-und-schiffe.md](hafen-und-schiffe.md) und die Bestandsaufnahme zusammen und nimmt Jorvens Vision vom 11.11.2026 auf. Wo etwas widerspricht, gilt dieses Dokument.

`hafen-und-schiffe.md` bleibt als **Katalog** bestehen: Stufenbilder, Liegeplatzarten, Einlaufen und die 80 Schiffsmodelle mit ihren Formen. Dieses Dokument verweist dorthin, statt es zu wiederholen.

**Weitere Dokumente**

| Dokument | Inhalt |
|---|---|
| [roadmap.md](roadmap.md) | Arbeitsliste: was fehlt, was falsch ist, was weg soll, welches Paket es erledigt (Stand 12.11.2026) |
| [aenderungen.md](aenderungen.md) | Was ist neu im Spiel, für Spieler |
| [ui/oberflaeche.md](ui/oberflaeche.md) | Oberfläche und Bedienung auf allen Geräten |
| [tests.md](tests.md) | Tests, Testmodus und alle Adresszusätze |
| [hafen-und-schiffe.md](hafen-und-schiffe.md) | Katalog: Stufen, Liegeplätze, Schiffsarten und Modelle |
| [grundgeruest.md](grundgeruest.md) | Technik: Spielobjekt, Module, Koordinaten, Dateibesitz |
| [veroeffentlichen.md](veroeffentlichen.md) | GitHub Pages, Pfadregeln |
| [stile/README.md](stile/README.md) | Stilvergleich, Entscheidung Flat Vector |
| [pixel-art.md](pixel-art.md) | Pixel-Fassung unter `pixel/` |

---

## 1. Vision

Ein kleines, gemütliches Aufbauspiel in 3D. Du fängst mit einem Badesteg an einem Dünensee an und arbeitest dich hoch zu einer großen Marina, in der Traditionssegler, Kreuzfahrtschiffe und Marineschiffe festmachen und die Seenotretter ihre Station haben. Eine Art Tycoon, nur ruhiger, schöner und ohne Verwaltungskram.

**Was das Spiel ist**

- **Cozy:** kein Scheitern, kein Zeitdruck, keine Story, keine Figuren mit Namen. Höchstens ein kurzer Einstieg am Anfang („Der alte Steg gehört jetzt dir“).
- **3D:** Der ganze Hafen ist eine echte 3D-Szene im Flat-Vector-Stil (flache Farben, weiche Schatten), drehbar, frei zoombar. Die Oberfläche darüber ist im Pixel-Stil (Abschnitt 10). Die Draufsichten in `docs/hafen/` sind nur Bauplan, nicht das Aussehen.
- **Genug Tiefe, dass es interessant bleibt:** Passregel nach Länge, Breite und Tiefgang, Wünsche der Gäste, Ruf, Ausbauentscheidungen, Ereignisse, Sammelziele.
- **Genug Inhalt für lange Zeit:** sechs Ausbaustufen, über 20 Schiffsarten, viele Services, dazu (geplant) ein Logbuch zum Sammeln (P21) und eine zweite Hafenregion, die Nordsee, für einen neuen Durchgang (P57).
- **Lebendig:** Schiffe laufen sichtbar ein, legen an, werfen Leinen, bergen Segel. Möwen, Wellen, Abendlicht, Fenster, die angehen. Soundeffekte und ruhige Hintergrundmusik.
- **Überraschend gute Steuerung:** kleine Gesten, die sich gut anfühlen (Abschnitt 8).
- **Überall spielbar:** PC, Tablet und Handy, hoch und quer, im Browser über GitHub Pages (https://hjorven.github.io/hafenmeister/), installierbar als Web-App.

**Was das Spiel nicht ist**

- Kein Logistik-Puzzle, keine Lieferketten, kein Personal mit Gehältern.
- Keine Story-Kampagne, keine Dialoge, keine Charaktere.
- Kein Echtzeit-Mehrspieler.

## 2. Leitlinien

- **Eine Ansicht.** Keine Untermenüs, keine zweite Karte. Zoomen und Verschieben ja, aber immer derselbe Hafen.
- **Höchstens zwei Tipps pro Aktion.** Boot antippen, Steg antippen. Bauplatz antippen, Preis bestätigen.
- **Nur zwei Zahlen:** Geld und Ruf.
- **Kein Scheitern.** Kein Bankrott, keine laufenden Kosten. Schlechte Entscheidungen bremsen nur.
- **Feste Bauplätze.** Nichts wird frei platziert. Die Stegformen kommen aus dem Katalog.
- **Pro Ausbaustufe nur wenige neue Dinge**, damit man nie viel auf einmal lernen muss.
- **Jede Aktion hat eine sichtbare und hörbare Antwort** (Animation plus Ton).

## 3. Spielablauf

Ein Spieltag dauert 2 Minuten bei normaler Geschwindigkeit: 90 Sekunden Tag, 30 Sekunden Abend. Tempo von Anfang an mit vier Knöpfen unten links: Pause, 1x, 3x, 8x; am PC schaltet Taste F 3x an und aus (Jorven, 12.11.2026: "Tempo so bleiben").

1. **Vormittags** legen die Gäste der Nacht ab, Dauerlieger fahren zum Tagestörn hinaus. **Ab Mittag** laufen neue Boote ein und warten an Wartebojen oder im Ankerfeld vor dem Hafen. Du tippst ein Boot an (oder ziehst es an der Schleppleine), die passenden Plätze leuchten, du tippst einen an. Tust du nichts, fährt das Boot nach 8 Sekunden selbst in eine passende freie Box. Wer abends noch wartet, bleibt über Nacht an der Boje.
2. **Kassieren:** Liegegeld wird beim Anlegen fällig, Gäste zahlen alle Nächte auf einmal. Über dem Boot erscheint eine Münze, eingestrichen bekommt das Boot einen Bezahlt-Wimpel; streichst du sie selbst ein, fliegt ihr Wert hoch („22 € + 11 €“ mit Wunschbonus), ein langer Strich über viele Münzen bringt Trinkgeld. Was liegen bleibt, holt abends der Hafenmeister auf seinem Rundgang, er bringt aber nur vier Fünftel. Ab dem Hafenbüro (erste Stufe "Hafenmeister") gibt es den Knopf "Alle kassieren", ab dem Kassenautomaten kommt das Geld von selbst. Sammelkassieren mit dem Hafenhorn (Abschnitt 8) ist geplant (P26).
3. **Jederzeit** kannst du bauen und ausbauen: Baumodus mit Vorschau und Bestätigung ([bauen.md](bauen.md)).

**Regeln**

- Ein Boot passt an einen Platz, wenn es nicht länger und nicht breiter ist als der Platz und die Wassertiefe mindestens 0,3 m größer ist als sein Tiefgang. Rechnen muss niemand, es leuchten nur passende Stege.
- Jedes Boot hat bis zu 3 Wünsche. Heute stehen sie in der Bootskarte; als Symbole über dem Boot sind sie geplant (P11).
- Hafengeld pro Nacht = Grundpreis der Art × (1 + 0,25 × erfüllte Wünsche). Die Zahlen stehen in `web/js/data/economy.js`, Erklärung in [balancing.md](balancing.md).
- Boote bleiben 1 bis 3 Nächte.
- Bei der Abreise bewertet jeder Gast mit 1 bis 5 Ankern: alle Wünsche erfüllt ergibt 5, keiner erfüllt ergibt 1, ein Boot ohne Wünsche gibt 4. Fingerplätze geben einen halben Anker extra.
- **Ruf** ist der Schnitt der letzten 20 Gäste. Bei 1 Anker kommen halb so viele Boote, bei 3 normal viele, bei 5 anderthalbmal so viele.
- Wer keinen Platz bekommt, fährt weiter und drückt den Ruf leicht.
- Eine Vorschau zeigt die nächsten 3 Boote (geplant, P11).

Die kleine Entscheidung, die das Spiel trägt: Gebe ich den Stirnplatz jetzt der Motoryacht, oder halte ich ihn für den Katamaran frei, der gleich kommt?

**Hafenbüro in vier Stufen:** 1 Hafenmeister mit Funk (Knopf „Kassieren“ und Vorschau der nächsten Boote), 2 Kassenautomat (kassiert S und M; große Boote zahlen persönlich mit Trinkgeld), 3 Hafenbüro (schlägt für jedes Boot die beste Box vor, goldene Raute, der Spieler bestätigt; rechnet Strom, Wasser und Duschen ab, 10 % auf jedes Liegegeld), 4 Hafenleitstelle ab Ausbaustufe 4 (volle Automatik, je Größe abschaltbar). Ohne Büro nimmt „Einfahren lassen“ die Box, die sich das Boot selbst suchen würde. Von Hand eingewiesene Gäste geben einen Viertelanker mehr.

**Automatik:** Die Leitstelle weist Standardfälle selbst zu. Sonderfälle bleiben beim Spieler und werden mit einer orangen Raute hervorgehoben: Mehrrumpfboote, Sondergäste, große Schiffe und Boote, für die nur noch ein einziger Platz passt. Sie fahren erst nach 25 Sekunden an der Boje selbst ein. So bleibt die Kernentscheidung bis zum Schluss erhalten.

## 4. Ausbaustufen

Die Stufen 1 bis 5 stehen mit Bildern und Liegeplätzen im [Katalog](hafen-und-schiffe.md#1-vom-bootssteg-am-see-zur-küstenmarina). Neu ist Stufe 6 für die große Marina aus der Vision.

| Stufe | Name | Liegeplätze | Neue Schiffe | Großes Bauprojekt |
|---|---|---|---|---|
| 1 | Bootssteg am See | 6 | S | |
| 2 | Dorfhafen am See | 30 | M | |
| 3 | Durchstich zur Ostsee | 54 | L | Durchstich mit Molen und Fahrrinne |
| 4 | Marina | 76 | Mehrrumpf, Behördenboote | Schwimmsteg D |
| 5 | Küstenmarina | 94 | XL | Außenhafen mit Kai |
| 6 | Seehafen | 94 plus Großschiffsliegeplätze | XXL | Pier für Großschiffe |

**Stufe 6: Seehafen (neu)**

Der Außenhafen bekommt eine lange Pier im tiefen Wasser. Dort machen Kreuzfahrtschiffe fest, an einem eigenen Anleger besuchen Marineschiffe den Hafen. Die Seenotrettungsstation bekommt einen großen Seenotrettungskreuzer. Großschiffe bringen keine Liegeplatzgebühr pro Nacht, sondern Tagesgäste, die Kiosk, Restaurant, Läden und Ausflugsboote füllen. Die Wirtschaft der Stufe 6 dreht sich also um Services, nicht um Plätze.

Für die nächste Stufe braucht man eine Gästezahl, einen Mindestruf und das Geld für das Bauprojekt. Stufe 6 endet mit dem Abschlussziel der Region (Großschiffbesuche, Ruf 4,5, alle Plätze). Nach dem Ausbau zeigt die Startansicht den größeren Hafen, neue Bauplätze erscheinen. Ziele und Preise rechnet `tools/balance.mjs` ([balancing.md](balancing.md)).

## 5. Schiffe

Grundlage ist der [Schiffskatalog](hafen-und-schiffe.md#4-schiffe): 4 Größen, 16 Arten, je 5 Modelle. Neu dazu kommt die Größe XXL für Stufe 6.

| Größe | Länge | Arten | Ab Stufe | Liegt an |
|---|---|---|---|---|
| S | bis 6 m | Ruderboot, Paddel- und Tretboot, Beiboot, Segeljolle, offenes Motorboot | 1 | Steg A |
| M | 6 bis 9 m | Kleinkreuzer, Holzklassiker, Kajütmotorboot, Fischerboot | 2 | Steg B, Stichsteg |
| L | 9 bis 14 m | Fahrtenyacht, Mehrrumpfboot, Motoryacht, Arbeits- und Behördenboot | 3 | Hauptsteg C, Schwimmsteg D, Stirnplätze |
| XL | 14 bis 40 m | Traditionssegler, Großyacht, Fahrgast- und Arbeitsschiff | 5 | Kai im Außenhafen |
| XXL | über 40 m | Kreuzfahrtschiff, Marineschiff, Seenotrettungskreuzer | 6 | Pier für Großschiffe |

**XXL im Überblick (neu)**

| Art | Modelle | Rolle im Spiel |
|---|---|---|
| Kreuzfahrtschiff | kleines Expeditionsschiff, Flusskreuzer-Format, mittleres Kreuzfahrtschiff | kommt angekündigt für einen Tag, bringt viele Tagesgäste |
| Marineschiff | Minenjagdboot, Korvette, Segelschulschiff | Hafenbesuch zu Festtagen, hebt den Ruf stark, zieht Zuschauer an |
| Seenotrettungskreuzer | 20-m-Klasse, 28-m-Klasse | wird stationiert, läuft bei Sturm aus und kommt zurück, kein Gast |

Seenotrettungsboote der kleineren Klassen gehören zu L4 (Arbeits- und Behördenboot) und kommen schon ab Stufe 4.

**Für Version 1.0** baut jeder Schiffs-Thread je Art 2 Modelle, dazu Farbvarianten. Die übrigen Modelle kommen danach. Die Modelle werden aus Teilen zusammengesetzt, siehe [Baukasten](hafen-und-schiffe.md#5-baukasten-für-die-modelle).

**Grundpreise pro Nacht** (Richtwerte; was gilt, steht in `web/js/data/economy.js`)

| Größe | Grundpreis |
|---|---|
| S | 10 € |
| M | 20 € |
| L | 40 € |
| XL | 100 € |
| XXL | kein Liegegeld, dafür Tagesgäste |

Sondergäste (Behördenboote, Marineschiffe) zahlen wenig und heben den Ruf.

## 6. Wünsche und Services

**Die 5 Wünsche der Gäste** bleiben, wie sie sind:

| Wunsch | Erfüllt durch | Ab Stufe |
|---|---|---|
| WC | Toilette, später Sanitärgebäude | 1 |
| Dusche | Dusche, später Duschhaus | 2 |
| Essen | Kiosk, Imbiss, Hafenrestaurant | 2 |
| Strom | Liegeplatz an Schwimmsteg oder Kai | 3 |
| Diesel | Tankstelle (nur Motorboote) | 4 |

Ein Bauwerk „versorgt n Boote“ heißt: pro Abend bekommen n Boote diesen Wunsch erfüllt. Kosten und Kapazitäten stehen in `web/js/data/economy.js` und [balancing.md](balancing.md). Weitere Wünsche (WLAN, Waschmaschine, Frischwasser, Absaugstation, Brötchen) sind geplant (P31).

**Services:** Gebäude, die keinen Wunsch erfüllen, sondern etwas Neues ins Spiel bringen. Jedes hat eine eigene kleine Animation. Im Spiel sind 20 Services mit ein bis drei Ausbaustufen, dazu die Angebote an Land (Bäcker, Hafencafé, Grillplatz, Fahrradverleih, Eisdiele); alle mit Stufen, Kosten und Wirkung in [services.md](services.md). Die Tabelle zeigt die wichtigsten:

| Service | Ab Stufe | Wirkung |
|---|---|---|
| Bootsverleih | 1 | kleines Einkommen pro Tag, Leihboote fahren über den See |
| Slip | 2 | Trailerboote kommen über Land, zusätzliche S-Gäste ohne Liegeplatz |
| Hafenmeisterbüro | 2 bis 4 | Stufe 1: Knopf "Kassieren" und Funk-Vorschau (vorher streicht man Münzen einzeln), 2: Kassenautomat für S und M, 3: Vorschläge und Nebenkosten (+10 % Liegegeld), 4: Leitstelle mit Automatik für Standardfälle |
| Mastenkran | 3 | Segelboote aus dem Binnenland kommen, mehr M-Gäste |
| Segelclub | 3 | Regatten möglich, mehr Jollen |
| Seenotretter-Station | 4 | Sturm richtet weniger Schaden an, Rettungsboot rückt sichtbar aus |
| Travellift und Werft | 4 | Reparaturaufträge bringen Geld außerhalb der Saison |
| Winterlager | 4 | Einnahmen im Winter (Abschnitt 7) |
| Segelmacher | 4 | Segelyachten zahlen mehr |
| Fischhalle | 5 | Fischerboote bringen Besucher an Kiosk und Restaurant |
| Fahrgastanleger | 5 | Ausflugsschiffe bringen Tagesgäste |
| Kreuzfahrtterminal | 6 | Kreuzfahrtschiffe möglich |
| Marineanleger | 6 | Marinebesuche möglich |

## 7. Ereignisse und Jahreslauf

Ereignisse werden einen Tag vorher angekündigt. Keines bestraft hart.

| Ereignis | Ab Stufe | Was passiert |
|---|---|---|
| Sturm | 3 | Niemand läuft von See ein, Boote im See bleiben eine Nacht länger, die Seenotretter rücken aus |
| Regatta | 3 (mit Segelclub) | Zwei Tage lang doppelt so viele Segelboote |
| Hafenfest | 4 | Traditionssegler und ein Marinebesuch, viele Tagesgäste |
| Nebel, Sommertag | 1 | weniger Ankünfte; mehr kleine Boote und Badegäste |
| Kreuzfahrttag | 6 | Ein Kreuzfahrtschiff kommt, der Ort ist voll (Besuch über das Kreuzfahrtterminal) |

Einzelheiten in [ereignisse.md](ereignisse.md). Weitere Ereignisse (Mittsommer, Holzboot-Treffen, Heringstage) sind geplant (P24).

**Jahreslauf:** Eine Saison hat 30 Spieltage. Danach kommt ein kurzer Winter von 3 Tagen mit Schnee und wenig Gästen; ein gebautes Winterlager verdient in dieser Zeit Geld. Das gibt dem langen Spiel einen Rhythmus und Abwechslung im Bild. Ein Winter mit eigenen Aufgaben (Winterarbeiten, Krantage) ist geplant (P20).

## 8. Steuerung, die positiv überrascht

Ziel: Jede Geste fühlt sich an wie mit echten Booten. Alle Gesten haben eine Alternative mit einfachem Antippen.

| Geste | Was passiert | Stand |
|---|---|---|
| Boot antippen, Platz antippen | Grundbedienung, funktioniert immer | gebaut |
| Boot an der Schleppleine zum Platz ziehen | Das Boot hängt an einer Leine, über einem passenden Platz rastet sie ein, dann fährt es selbst hinein | gebaut |
| Kassierstrich | Abends in einem Strich über alle Münzen streichen, jede klingt einen Ton höher | gebaut |
| Zwei Finger drehen, rechte Maustaste | Hafen drehen, rastet in 45-Grad-Schritten ein | gebaut; frei neigen und drehen in Arbeit (Kamera-Thread, P47) |
| Boot gedrückt halten | Boot hupt | gebaut |
| Hafenhorn gedrückt halten | Kassiert alle Münzen, die Münzen fliegen hörbar in die Kasse | geplant (P26) |
| Doppeltipp auf ein Boot | Fernglas: Kamera fährt heran und folgt dem Boot, Steckbrief mit Art, Länge, Heimathafen (heute zoomt Doppeltipp) | geplant (P26) |
| Kurz am Handy schütteln oder Taste H | Möwen fliegen auf (reine Freude, kein Nutzen) | geplant (P26) |
| Lange auf das Wasser drücken | Wellenring und leises Plätschern | geplant (P26) |
| Glocke am Hafenbüro antippen | Glocke läutet | geplant (P26); Vorspulen läuft über die Tempo-Knöpfe |

Kleine Rückmeldungen: Haptik auf dem Handy (`navigator.vibrate`), wo verfügbar. Alle Gesten je Gerät stehen in [ui/oberflaeche.md](ui/oberflaeche.md#bedienung-je-gerät).

## 9. Inhalt für lange Zeit

- **Dauerlieger, Stammgäste und Tagesziele** (Abschnitt 9a) geben dem Alltag im Hafen Abwechslung.
- **Logbuch** (geplant, P21): Jede Schiffsart und jedes Modell wird beim ersten Anlegen eingetragen, mit Bild. Bei über 100 Modellen ein langes Sammelziel.
- **Zwei Hafenregionen (Entscheidung Jorven, 11.11.2026; Nordsee geplant, P57):** Ostsee und Nordsee. Keine länderspezifischen Regionen. Gebäude und Stimmung sind ein Mix aus deutschen, dänischen und schwedischen Häfen (rote Holzhäuser, Reetdächer, Backstein, Fachwerk), weil sich die Hafenkulturen nicht stark genug unterscheiden, um eigene Regionen zu tragen. Der erste Durchgang spielt an der Ostsee, nach dessen Abschluss wird die Nordsee frei.

| Region | Landschaft | Besonderheit |
|---|---|---|
| Ostsee | Binnensee hinter einer Nehrung, Dünen, Kiefern, Schären-Felsen am Rand | Startregion, wie im Katalog, kaum Gezeiten |
| Nordsee | Deich, Watt, Sielhafen, Priele | Gezeiten: bei Ebbe liegen Boote trocken, Tiefgang zählt doppelt |

- **Erfolge** (geplant, P22): zum Beispiel „Alle drei Traditionssegler gleichzeitig im Hafen“, „Ein Abend mit 5,0 Ankern“.
- **Endlosmodus** nach dem Spielziel: jede Saison vier Saisonziele mit Sternen, Belohnung und Rang (im Spiel, P16, [aufstieg.md](aufstieg.md)); Bestenliste online (geplant, P58, Abschnitt 12).

### 9a. Neue Features (Entscheidung Jorven, 11.11.2026)

Alle sechs sind gebaut, Einzelheiten in [neue-features.md](neue-features.md). Hier nur die Kurzfassung; was noch fehlt, steht dahinter.

| Feature | Was es ist |
|---|---|
| **Dauerlieger** | Ein Teil der Plätze wird fest vermietet. Dauerlieger zahlen pro Saison, fahren tagsüber hinaus zum Segeln oder Angeln und kommen abends zurück. Solange sie draußen sind, zeigt ihr Platz ein grünes Schild und darf für einen Gast genutzt werden (Rot-Grün-System echter Ostseehäfen). Kommt der Dauerlieger früher zurück, muss der Gast umgelegt werden. Das ist die zweite Einnahmequelle neben dem Hafengeld. Heute zahlen Dauerlieger pauschal 15 € pro Abend; Saisonpacht, festlegbare Dauerplätze und Umlegen sind geplant (P01). |
| **Stammgäste** | Gäste, die zufrieden waren, kommen wieder, erkennbar am Bootsnamen und einem kleinen Symbol. Sie bringen Ruf, wenn sie ihren alten Platz bekommen (Ruf am alten Platz geplant, P25). |
| **Wetter an der Flagge** | Die Flagge am Hafenbüro zeigt Wind und Wetter für morgen. Wer hinsieht, kann sich auf Sturm oder Regatta vorbereiten. |
| **Fotomodus** | Leisten ausblenden, Kamera frei drehen, Bild speichern. |
| **Hafen schauen** | Nichts tun und zusehen: Die Kamera fährt langsam durch den Hafen, Musik läuft, das Spiel geht weiter. |
| **Tagesziele** | Jeden Morgen drei Karten (leicht, mittel, schwer), der Spieler nimmt eine, zum Beispiel „3 Segelboote an Plätze mit Strom legen“. Es zählt nur, was er selbst tut. Belohnung: Geld, ein halber Anker, ein seltener Gast, ein Gutschein oder ein Deko-Stück im Hafen. Dazu ein Wochenziel ([neue-features.md](neue-features.md), Abschnitt 6). |

Dauerlieger und Menschen im Hafen (Abschnitt 11a) hängen zusammen: Die Crew der Dauerlieger geht morgens an Bord und abends an Land.

## 10. Oberfläche

Pixel-Oberfläche über der 3D-Welt (PR 119, 134, 138), auf PC, Tablet und Handy gleich aufgebaut, nur die Größen ändern sich. Keine weißen Leisten, sondern kleine Pixel-Schilder, zwischen denen der Hafen sichtbar bleibt. Einzelheiten in [ui/oberflaeche.md](ui/oberflaeche.md).

```
+------------------------------------------------------------+
| (Geld) (Ruf)                              [Übersicht][Menü]|
| [Wetter]                                                   |
| [Ziele]            Hafen in 3D, zoombar                    |
| [Nächste Stufe]                                            |
|                                                            |
| [Tag 3 ~~Sonne~~ ][II][1x][3x][8x]   [Kassieren]   [Bauen] |
+------------------------------------------------------------+
```

- **Oben links:** Geld und Ruf. **Oben rechts:** Übersicht und Menü (Fotomodus, Ton, Spielstand, am PC Maus und Tastatur).
- **Links:** Schilder für Wetter, Tagesziele und das Ziel der nächsten Stufe, je mit einer Tafel zum Aufklappen.
- **Unten links:** Tag, Himmelsbalken mit Sonne und Mond, Tempo Pause, 1x, 3x, 8x. **Unten Mitte:** Kassieren, nur wenn Münzen offen sind. **Unten rechts:** Bauen.
- **Wartende Boote** liegen sichtbar an Wartebojen und im Ankerfeld, nicht in einer Leiste.
- **Infokarte** (`#card`): auf großen Bildschirmen rechts, sonst als Blatt von unten, am Handy quer als Seitenblatt.
- **Einstieg:** kein Tutorial-Text. Ein pulsierender Kreis zeigt die ersten Handgriffe (Boot, Platz, Münze, Bauen, Tagesziele), danach je einmal bei jeder neuen Sache ([einstieg.md](einstieg.md)).
- **Geräte:** PC `(min-width: 1024px) and (pointer: fine)`, Tablet ab 600 x 500 px mit Touch, Handy darunter. Alles Antippbare am Touchgerät mindestens 44 Pixel.

## 11. Grafik, Ton und Animationen

**Stil:** Die Welt ist Flat Vector in 3D: flache Farben ohne Texturen, weiche lange Schatten als halbdurchsichtige Flächen, Pastellwasser mit kurzen weißen Wellenstrichen. Vorbild ist [02-flat-vector-max.png](stile/bilder/02-flat-vector-max.png). Die Oberfläche darüber ist im Pixel-Stil (Abschnitt 10). Daneben gibt es eine eigene **Pixel-Fassung** des ganzen Spiels unter https://hjorven.github.io/hafenmeister/pixel/ , nach festen Regeln gezeichnet statt gefiltert ([pixel-art.md](pixel-art.md)). Ob sie das Hauptspiel wird, entscheidet Jorven (offene Frage 9 der Roadmap); bis dahin bleibt sie eine eigene Fassung.

**Kamera:** Schrägsicht, frei zoombar, drehbar mit Einrasten in 45-Grad-Schritten. Frei neigen und drehen (Jorvens Wunsch) baut der Kamera-Thread (P47).

**Animationen** (je mit Ton)

| Was | Animation |
|---|---|
| Einlaufen | Boot fährt den betonnten Weg aus dem [Katalog](hafen-und-schiffe.md#3-einlaufen), Bugwelle, Kielwasser |
| Anlegen | Boot dreht in die Box, Fender raus, Leinen fliegen an die Pfähle |
| Segelboote | Segel werden vor dem Hafen geborgen und beim Auslaufen gesetzt |
| Abend | Licht wird warm, Fenster gehen an, Molenfeuer blinken grün und rot |
| Wetter | Wolkenschatten, Regen, bei Sturm Gischt an den Molen |
| Leben | Möwen, Leihboote auf dem See, Menschen als kleine Figuren ohne Gesicht (Abschnitt 11a) |

### 11a. Menschen im Hafen (Entscheidung Jorven, 11.11.2026)

Jedes Schiff bringt eine zufällige Zahl Menschen mit, die zu seiner Größe passt. Sie gehen an Land und laufen im Hafen herum. Keine Namen, keine Gesichter, keine Dialoge, nur kleine Figuren, die den Hafen lebendig machen.

| Schiff | Menschen an Bord |
|---|---|
| S | 1 bis 3 |
| M | 2 bis 5 |
| L | 2 bis 8 |
| XL | 6 bis 40 (Traditionssegler mit Gästen, Fahrgastschiff mehr) |
| Kreuzfahrtschiff | 80 bis 200 (im Spiel gebündelt dargestellt) |
| Marineschiff | 20 bis 60, gehen in Gruppen |

Die genaue Obergrenze steht je Schiffsart in den Schiffsdaten (Feld `crew: [min, max]`).

**Verhalten**

- Menschen verlassen ihr Boot über den Steg und laufen auf einem Wegenetz (Stege, Promenade, Wege zwischen den Gebäuden). Der Weg wird mit A* auf diesem Netz gesucht.
- Sie wählen zufällige Ziele: Toilette, Dusche, Kiosk, Restaurant, Läden, Aussichtspunkte, Bank an der Mole. Abends gehen die meisten zurück an Bord, ein paar sitzen noch im Restaurant.
- Erfüllte Wünsche sind sichtbar: Wer zur Dusche will, geht zur Dusche.
- Tagesgäste von Großschiffen laufen als Gruppe vom Anleger in den Ort und füllen Kiosk, Restaurant und Läden. Das bringt mehr Einnahmen, aber keine eigene Zahl in der Oberfläche.
- Leistung: höchstens etwa 300 Figuren gleichzeitig sichtbar, als `InstancedMesh`. Bei mehr wird gebündelt (eine Figur steht für mehrere Menschen).

**Ton:** Soundeffekte (Wellen, Möwen, Tauwerk, Glocke, Hafenhorn, Münzen, Motoren) und ruhige Hintergrundmusik, die sich mit Tag und Abend ändert. Musik und Effekte getrennt einstellbar. Ton startet erst nach dem ersten Antippen, sonst bleibt er auf iPhone und iPad stumm.

## 12. Technik

Die Schnittstellen stehen in [grundgeruest.md](grundgeruest.md), das Veröffentlichen in [veroeffentlichen.md](veroeffentlichen.md).

- **Three.js 0.187.0** per Import-Map, kein Build-Schritt, Ordner `web/` wird auf GitHub Pages veröffentlicht.
- **Spielregeln getrennt von der Grafik:** `web/js/sim.js` kennt kein Three.js. So lässt sich das Balancing per Skript testen.
- **Alle Zahlen in Daten-Dateien** unter `web/js/data/`.
- **Leistung auf Handys:** Stege, Services und Gebäude gebündelt, keine Schattenberechnung, Pixeldichte höchstens 1,5.
- **Speichern:** nach jedem Abend in `localStorage`, dazu Export und Import als Text ([speichern.md](speichern.md)). Mehrere Speicherplätze und "Neues Spiel" sind geplant (P09). Safari löscht Website-Daten nach 7 Tagen ohne Besuch, deshalb ist das Spiel als Web-App installierbar (Manifest und Service Worker), dann gilt das nicht.
- **Online mit Supabase** (Nach 1.0, als letzter Schritt, P58; nichts davon ist gebaut): Hafenname, Bestenliste, Gastboote mit den Hafennamen anderer Spieler als Heimathafen. Anonyme Anmeldung, Tabelle mit Präfix `hafen_`. SQL und Verbindung stehen in [archiv/plan-v1.md](archiv/plan-v1.md#11-online-mit-supabase). Die Supabase-Bibliothek wird mit fester Version eingebunden: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm`.

**Lokal testen**

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen. Vor jedem Merge (Anleitung in [tests.md](tests.md)):

```bash
bash tests/pruefen.sh
```

## 13. Stand: Gebaut, Als Nächstes, Nach 1.0

**Reihenfolge seit 12.11.2026 abends (Jorven):** Zuerst wird das Gelände mit den Bootswegen komplett überarbeitet (Welle 0 in [roadmap.md](roadmap.md), fünf Threads), alle anderen Arbeiten ruhen so lange. Danach die Grundprobleme, dann die Kernschleife, zuletzt die Extras. Jeder Thread prüft sein Feature vor dem Weiterbauen sehr oft und mit Randfällen und schreibt auf, wo es mit anderen kollidieren kann.

Die Arbeitsliste mit allen Punkten, Paketen und Threads ist die [Roadmap](roadmap.md). Hier nur die Übersicht. Was für Spieler neu ist, steht in [aenderungen.md](aenderungen.md).

### Gebaut (auf `main`, spielbar unter https://hjorven.github.io/hafenmeister/)

- **Grundgerüst:** 3D-Szene, Kamera mit Zoom, Verschieben und Drehen, Startansicht je Stufe und Gerät, Modul-Lader, GitHub Pages, Web-App, automatische Tests auf Handy, Tablet und PC.
- **Spielschleife Stufe 1 bis 6 an der Ostsee:** echte Liegeplatzdaten, 12 Stegbilder, Passregel, Wartebojen und Ankerfeld, Selbst-Einfahren nach 8 s, Tagesrhythmus (vormittags Ablegen, nachmittags Ankunft, über Nacht an der Boje), Liegegeld beim Festmachen mit Bezahlt-Wimpel, Grün-Rot-Schild an jeder Gastbox, Tagesausflüge mit reservierter Box, Hafenmeister-Rundgang, Ruf, Stufenziele, Abschlussziel Stufe 6.
- **Bauen:** Baumodus mit Vorschau, Bestätigen und Hinweis "Als Nächstes", Stegprojekte, Versorgung, Hafenbüro in drei Stufen, 20 Services, Angebote an Land, Großschiffpier.
- **Schiffe:** S, M, L, XL und XXL als 3D-Modelle, Einlaufen, Anlegen, Ablegen, Segel bergen, Vorbeifahrer, Kreuzfahrt- und Marinebesuche.
- **Leben:** Menschen mit Wegfindung, Badegäste, Ereignisse (Nebel, Sommertag, Sturm, Regatta, Hafenfest), Jahreslauf mit Winter, Ton und Musik.
- **Features aus 9a:** Dauerlieger, Stammgäste, Wetter an der Flagge, Fotomodus, Hafen schauen, Tagesziele.
- **Oberfläche:** Pixel-Oberfläche für alle Geräte, Tempo Pause, 1x, 3x, 8x, Einstieg mit Hinweis-Kreisen, Speichern mit Export und Import, Tagesabschluss mit Einnahmen je Quelle und Münzen über den Services ([tagesabschluss.md](tagesabschluss.md)).
- **Pixel-Fassung** als eigene Seite unter `pixel/`.
- **Balancing:** `tools/balance.mjs` mit den echten Regeln; etwa 257 Spieltage, rund 8,5 Stunden bis zum Abschluss der Ostsee.

### Als Nächstes (Roadmap, Wellen 1 bis 4)

- **Welle 1, Fehler und Fundament:** Dauerlieger als echte Entscheidung (P01), Hafenbüro mit eigenen Aufgaben (P02), Einstieg (P03), Services (P04), Spielregeln (P05), eine Zahlenquelle (P06), Oberfläche (P07), Doku (P08), Speicherplätze und Neues Spiel (P09).
- **Welle 2, Kernspiel:** Zuweisen als Entscheidung, Wünsche und Vorschau, Kassieren, Tagesziele, Bewertungen und Gästebuch, Tagesabschluss, Aufstieg feiern, Ruf, Winter, Logbuch, Erfolge, Bauen, Balancing (P10 bis P22).
- **Welle 3, neue Features:** Ereignisse, Stammgäste, Hafenhorn und Fernglas, Päckchen, Funk-Anmeldung, Baggern, Stege nachrüsten, neue Wünsche, Flottillen, Verholen, Windseite, Preisstufe, Bojenfeld, Havarist, Hafenfest, Jugendtraining, seltene Besucher (P23 bis P40).
- **Welle 4, Langzeit und Feinschliff:** Statistik und Saisonbilanz, Herausforderungen, Hafenname, Kreativmodus, Ton, Kamera, Animationen, Signalflaggen, Einstellungen, Menschen, Landschaft (P41 bis P53). Dazu verteilt auf die Wellen: Ausweichen beim Ausfahren (P54), versteckte Regeln sichtbar machen (P55), Stege umbauen (P59), Hafen verschönern (P60), offline startbar (P61).

### Nach 1.0 (Welle 5)

- **Nordsee** mit Deich, Watt und Gezeiten (P57).
- **Online** mit Hafenname, Bestenliste und Gastbooten anderer Spieler (P58), als letzter Schritt, erst alles lokal.

## 14. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Stil | Welt in Flat Vector 3D, Oberfläche im Pixel-Stil; Pixel-Fassung als eigene Seite (ob sie Hauptspiel wird: offen, Frage 9) |
| Zuweisen von Hand oder automatisch | von Hand, ab Hafenbüro Vorschläge, ab Hafenleitstelle Automatik nur für Standardfälle |
| "Alle kassieren" | erst ab Hafenbüro Stufe 1, vorher streicht man Münzen ein (12.11.2026) |
| Wartende Boote | an Wartebojen oder im Ankerfeld, keine Leiste |
| Liegegeld | beim Festmachen, bezahlte Boote tragen einen Wimpel |
| Oberfläche | Pixel-Schilder statt weißer Leisten, Knöpfe in Daumenreichweite |
| Kamera | frei neigen und drehen, am PC mit gedrückter Maus (in Arbeit, P47) |
| Vorspulen | Pause, 1x, 3x, 8x von Anfang an, Taste F für 3x (Jorven, 12.11.2026) |
| Schauplatz | Zwei Regionen: Ostsee (Start) und Nordsee (danach). Gebäude als Mix aus deutschen, dänischen und schwedischen Häfen |
| Dritte Zahl für Tagesgäste | nein. Tagesgäste bringen mehr Einnahmen und sind als Menschen im Hafen zu sehen |
| Tretboote und Kanus als Gäste | in Stufe 1 zahlende Gäste (Paddel- und Tretboot S2), sonst Kulisse (12.11.2026) |
| Klappbrücke über den Durchstich | nicht in 1.0 |
| Dauerlieger | ja, schon in 1.0 (Abschnitt 9a) |
| Stammgäste, Wetter an der Flagge, Fotomodus, Hafen schauen, Tagesziele | ja, alle fünf (Abschnitt 9a, Einzelheiten in [neue-features.md](neue-features.md)) |
| Story und Figuren | keine, nur ein kurzer Einstieg |
| Selbst-Einfahren | nach 8 s in die nächste oder eine der freien Boxen am Steg, nicht mehr in die knappste; Boote berühren sich dabei nie (12.11.2026) |
| Dauerlieger | Spieler legt fest, welche Boxen Dauerplätze sind, höchstens ein Viertel der Gastboxen, Saisonpacht im Voraus (12.11.2026, Einzelheiten Roadmap P01) |
| Feature-Vorschläge aus dem Überblick | alle 42 werden gebaut ([roadmap.md](roadmap.md)) |
| Online | als letzter Schritt, erst alles lokal |

**Noch offen:** Frage 9 (Stil und Rolle der Pixel-Fassung, siehe [Roadmap](roadmap.md#offene-fragen-an-jorven)). Die Arbeitsliste steht in [roadmap.md](roadmap.md).

## 15. Bewusst weggelassen

- Personal, Gehälter, laufende Kosten
- freies Platzieren und Drehen von Gebäuden
- Story, Dialoge, benannte Figuren
- Einnahmen, während das Spiel geschlossen ist
- Echtzeit-Mehrspieler
- Spielstand über mehrere Geräte (Export und Import als Ersatz)
