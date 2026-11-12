# Hafenmeister: Spielplan

Stand: 11.11.2026, Version 2. Dieses Dokument ist der einzige gültige Plan. Es fasst den alten Spielplan ([archiv/plan-v1.md](archiv/plan-v1.md)), [hafen-und-schiffe.md](hafen-und-schiffe.md) und die Bestandsaufnahme zusammen und nimmt Jorvens Vision vom 11.11.2026 auf. Wo etwas widerspricht, gilt dieses Dokument.

`hafen-und-schiffe.md` bleibt als **Katalog** bestehen: Stufenbilder, Liegeplatzarten, Einlaufen und die 80 Schiffsmodelle mit ihren Formen. Dieses Dokument verweist dorthin, statt es zu wiederholen.

**Weitere Dokumente**

| Dokument | Inhalt |
|---|---|
| [roadmap.md](roadmap.md) | Arbeitsliste: was fehlt, was falsch ist, was weg soll, welches Paket es erledigt (Stand 12.11.2026) |
| [hafen-und-schiffe.md](hafen-und-schiffe.md) | Katalog: Stufen, Liegeplätze, Schiffsarten und Modelle |
| [grundgeruest.md](grundgeruest.md) | Technik: Spielobjekt, Module, Koordinaten, Dateibesitz |
| [veroeffentlichen.md](veroeffentlichen.md) | GitHub Pages, Pfadregeln |
| [stile/README.md](stile/README.md) | Stilvergleich, Entscheidung Flat Vector |

---

## 1. Vision

Ein kleines, gemütliches Aufbauspiel in 3D. Du fängst mit einem Badesteg an einem Dünensee an und arbeitest dich hoch zu einer großen Marina, in der Traditionssegler, Kreuzfahrtschiffe und Marineschiffe festmachen und die Seenotretter ihre Station haben. Eine Art Tycoon, nur ruhiger, schöner und ohne Verwaltungskram.

**Was das Spiel ist**

- **Cozy:** kein Scheitern, kein Zeitdruck, keine Story, keine Figuren mit Namen. Höchstens ein kurzer Einstieg am Anfang („Der alte Steg gehört jetzt dir“).
- **3D:** Der ganze Hafen ist eine echte 3D-Szene im Flat-Vector-Stil (flache Farben, weiche Schatten), drehbar in festen Schritten, frei zoombar. Die Draufsichten in `docs/hafen/` sind nur Bauplan, nicht das Aussehen.
- **Genug Tiefe, dass es interessant bleibt:** Passregel nach Länge, Breite und Tiefgang, Wünsche der Gäste, Ruf, Ausbauentscheidungen, Ereignisse, Sammelziele.
- **Genug Inhalt für lange Zeit:** sechs Ausbaustufen, über 20 Schiffsarten, viele Services, ein Logbuch zum Sammeln und eine zweite Hafenregion (Nordsee) für einen neuen Durchgang.
- **Lebendig:** Schiffe laufen sichtbar ein, legen an, werfen Leinen, bergen Segel. Möwen, Wellen, Abendlicht, Fenster, die angehen. Soundeffekte und ruhige Hintergrundmusik.
- **Überraschend gute Steuerung:** kleine Gesten, die sich gut anfühlen (Abschnitt 8).
- **Überall spielbar:** PC, Tablet und Handy, hoch und quer, im Browser über GitHub Pages, installierbar als Web-App.

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

1. **Tagsüber** laufen Boote ein und warten vor den Stegen. Du tippst ein Boot an, die passenden Stege leuchten auf, du tippst einen Steg an. Das Spiel wählt die beste freie Box an diesem Steg. Wer hineinzoomt, kann auch eine bestimmte Box antippen.
2. **Abends** kassierst du das Hafengeld. In Stufe 1 mit einer Münze über jedem Boot, ab Stufe 2 mit dem Hafenhorn (Abschnitt 8) für alle auf einmal.
3. **Jederzeit** kannst du bauen und ausbauen.

**Regeln**

- Ein Boot passt an einen Platz, wenn es nicht länger und nicht breiter ist als der Platz und die Wassertiefe mindestens 0,3 m größer ist als sein Tiefgang. Rechnen muss niemand, es leuchten nur passende Stege.
- Jedes Boot hat bis zu 3 Wünsche, als Symbole über ihm.
- Hafengeld pro Nacht = Grundpreis der Art × (1 + 0,25 × erfüllte Wünsche).
- Boote bleiben 1 bis 3 Nächte.
- Bei der Abreise bewertet jeder Gast mit 1 bis 5 Ankern: alle Wünsche erfüllt ergibt 5, keiner erfüllt ergibt 1, ein Boot ohne Wünsche gibt 4. Fingerplätze geben einen halben Anker extra.
- **Ruf** ist der Schnitt der letzten 20 Gäste. Bei 1 Anker kommen halb so viele Boote, bei 3 normal viele, bei 5 anderthalbmal so viele.
- Wer keinen Platz bekommt, fährt weiter und drückt den Ruf leicht.
- Eine Vorschau zeigt die nächsten 3 Boote.

Die kleine Entscheidung, die das Spiel trägt: Gebe ich den Stirnplatz jetzt der Motoryacht, oder halte ich ihn für den Katamaran frei, der gleich kommt?

**Automatik:** Ab dem Hafenbüro (Stufe 3) weist das Büro Standardfälle selbst zu. Sonderfälle bleiben beim Spieler und werden hervorgehoben: Mehrrumpfboote, Sondergäste, große Schiffe und Boote, für die nur noch ein einziger Platz passt. So bleibt die Kernentscheidung bis zum Schluss erhalten.

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

Für die nächste Stufe braucht man eine Gästezahl, einen Mindestruf und das Geld für das Bauprojekt. Beim Erweitern fährt die Kamera ein Stück heraus, neue Bauplätze erscheinen. Ziele und Preise rechnet `tools/balance.mjs` neu (Abschnitt 13).

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

**Grundpreise pro Nacht** (Startwerte, werden im Balancing angepasst)

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

Ein Bauwerk „versorgt n Boote“ heißt: pro Abend bekommen n Boote diesen Wunsch erfüllt. Startwerte für Kosten und Kapazitäten stehen in [archiv/plan-v1.md](archiv/plan-v1.md#5-bauen-und-ausbauen) und werden im Balancing neu gerechnet.

**Services (neu):** Gebäude, die keinen Wunsch erfüllen, sondern etwas Neues ins Spiel bringen. Jedes hat eine eigene kleine Animation.

| Service | Ab Stufe | Wirkung |
|---|---|---|
| Bootsverleih | 1 | kleines Einkommen pro Tag, Leihboote fahren über den See |
| Slip | 2 | Trailerboote kommen über Land, zusätzliche S-Gäste ohne Liegeplatz |
| Hafenmeisterbüro | 2 bis 3 | Alles kassieren, später Automatik |
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
| Kreuzfahrttag | 6 | Ein Kreuzfahrtschiff kommt, der Ort ist voll |

**Jahreslauf (neu):** Eine Saison hat 30 Spieltage. Danach kommt ein kurzer Winter von 3 Tagen, in dem Boote im Winterlager stehen, Schnee auf den Stegen liegt und keine Gäste kommen; ein gebautes Winterlager verdient in dieser Zeit Geld. Das gibt dem langen Spiel einen Rhythmus und Abwechslung im Bild.

## 8. Steuerung, die positiv überrascht

Ziel: Jede Geste fühlt sich an wie mit echten Booten. Alle Gesten haben eine Alternative mit einfachem Antippen.

| Geste | Was passiert |
|---|---|
| Boot antippen, Steg antippen | Grundbedienung, funktioniert immer |
| Boot mit dem Finger zum Steg ziehen | Das Boot folgt dem Finger als gestrichelte Kurslinie und fährt dann selbst hinein |
| Hafenhorn gedrückt halten | Abends: kassiert alle Münzen, die Münzen fliegen hörbar in die Kasse |
| Doppeltipp auf ein Boot | Fernglas: Kamera fährt heran und folgt dem Boot, Steckbrief mit Art, Länge, Heimathafen |
| Zwei Finger drehen | Hafen in 90-Grad-Schritten drehen, Gebäude bekommen Tiefe |
| Kurz am Handy schütteln oder Taste H | Möwen fliegen auf (reine Freude, kein Nutzen) |
| Lange auf das Wasser drücken | Wellenring und leises Plätschern |
| Glocke am Hafenbüro antippen | Vorspulen an und aus |

Kleine Rückmeldungen: Haptik auf dem Handy (`navigator.vibrate`), wo verfügbar.

## 9. Inhalt für lange Zeit

- **Dauerlieger, Stammgäste und Tagesziele** (Abschnitt 9a) geben dem Alltag im Hafen Abwechslung.
- **Logbuch:** Jede Schiffsart und jedes Modell wird beim ersten Anlegen eingetragen, mit Bild. Bei über 100 Modellen ein langes Sammelziel.
- **Zwei Hafenregionen (Entscheidung Jorven, 11.11.2026):** Ostsee und Nordsee. Keine länderspezifischen Regionen. Gebäude und Stimmung sind ein Mix aus deutschen, dänischen und schwedischen Häfen (rote Holzhäuser, Reetdächer, Backstein, Fachwerk), weil sich die Hafenkulturen nicht stark genug unterscheiden, um eigene Regionen zu tragen. Der erste Durchgang spielt an der Ostsee, nach dessen Abschluss wird die Nordsee frei.

| Region | Landschaft | Besonderheit |
|---|---|---|
| Ostsee | Binnensee hinter einer Nehrung, Dünen, Kiefern, Schären-Felsen am Rand | Startregion, wie im Katalog, kaum Gezeiten |
| Nordsee | Deich, Watt, Sielhafen, Priele | Gezeiten: bei Ebbe liegen Boote trocken, Tiefgang zählt doppelt |

- **Erfolge:** zum Beispiel „Alle drei Traditionssegler gleichzeitig im Hafen“, „Ein Abend mit 5,0 Ankern“.
- **Endlosmodus** nach dem Spielziel, mit Bestenliste (Abschnitt 12).

### 9a. Neue Features (Entscheidung Jorven, 11.11.2026)

Der Thread „Fehlende Features und Qualität prüfen“ beschreibt sie in [neue-features.md](neue-features.md) und baut sie ein. Hier nur die Kurzfassung.

| Feature | Was es ist |
|---|---|
| **Dauerlieger** | Ein Teil der Plätze wird fest vermietet. Dauerlieger zahlen pro Saison, fahren tagsüber hinaus zum Segeln oder Angeln und kommen abends zurück. Solange sie draußen sind, zeigt ihr Platz ein grünes Schild und darf für einen Gast genutzt werden (Rot-Grün-System echter Ostseehäfen). Kommt der Dauerlieger früher zurück, muss der Gast umgelegt werden. Das ist die zweite Einnahmequelle neben dem Hafengeld. |
| **Stammgäste** | Gäste, die zufrieden waren, kommen wieder, erkennbar am Bootsnamen und einem kleinen Symbol. Sie bringen Ruf, wenn sie ihren alten Platz bekommen. |
| **Wetter an der Flagge** | Die Flagge am Hafenbüro zeigt Wind und Wetter für morgen. Wer hinsieht, kann sich auf Sturm oder Regatta vorbereiten. |
| **Fotomodus** | Leisten ausblenden, Kamera frei drehen, Bild speichern. |
| **Hafen schauen** | Nichts tun und zusehen: Die Kamera fährt langsam durch den Hafen, Musik läuft, das Spiel geht weiter. |
| **Tagesziele** | Jeden Tag ein kleines, freiwilliges Ziel (zum Beispiel „Drei Segelboote mit Dusche“), Belohnung in Geld oder Ruf. |

Dauerlieger und Menschen im Hafen (Abschnitt 11a) hängen zusammen: Die Crew der Dauerlieger geht morgens an Bord und abends an Land.

## 10. Oberfläche

```
+------------------------------------------------------------+
|  1.240 €        Ruf 3,5        Tag 37 ====      [II] [Ü]   |
|                                                            |
|                   Hafen in 3D, zoombar                     |
|                                                            |
|  [Boot M] [Boot S] [Boot L]                       [Bauen]  |
+------------------------------------------------------------+
```

- **Oben:** Geld, Ruf, Tag mit Fortschrittsbalken, Pause, Übersicht.
- **Unten:** wartende Boote und der Knopf „Bauen“.
- **Infokarte** (`#card`): auf PC und Tablet neben dem Bauwerk, auf dem Handy als Blatt von unten.
- **Symbole statt Text.**
- **Einstieg:** kein Tutorial-Text. Ein pulsierender Kreis zeigt die ersten drei Handgriffe (Boot, Steg, Münze), danach je einmal bei jeder neuen Sache.
- **Geräte:** PC `(min-width: 1024px) and (pointer: fine)`, Tablet `(min-width: 600px) and (min-height: 500px) and (pointer: coarse)`, Handy darunter. Alles Antippbare mindestens 44 Pixel.

Die Einzelheiten je Gerät stehen in `web/css/ui-pc.css`, `ui-tablet.css` und `ui-phone.css`.

## 11. Grafik, Ton und Animationen

**Stil:** Flat Vector in 3D. Flache Farben ohne Texturen, weiche lange Schatten als halbdurchsichtige Flächen, Pastellwasser mit kurzen weißen Wellenstrichen. Vorbild ist [02-flat-vector-max.png](stile/bilder/02-flat-vector-max.png).

**Kamera:** orthografische Schrägsicht, frei zoombar, in 90-Grad-Schritten drehbar.

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
- **Leistung auf Handys:** Boote als `InstancedMesh` je Modell, keine Schattenberechnung, Pixeldichte höchstens 2.
- **Speichern:** nach jedem Abend in `localStorage`, dazu Export und Import als Text. Safari löscht Website-Daten nach 7 Tagen ohne Besuch, deshalb ist das Spiel als Web-App installierbar (Manifest und Service Worker), dann gilt das nicht.
- **Online mit Supabase** (zuletzt): Hafenname, Bestenliste, Gastboote mit den Hafennamen anderer Spieler als Heimathafen. Anonyme Anmeldung, Tabelle mit Präfix `hafen_`. SQL und Verbindung stehen in [archiv/plan-v1.md](archiv/plan-v1.md#11-online-mit-supabase). Die Supabase-Bibliothek wird mit fester Version eingebunden: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm`.

**Lokal testen**

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen. Vor jedem Push:

```bash
bash tools/check-pages.sh web
```

## 13. Meilensteine

Der aktuelle Arbeitsstand und alle offenen Punkte stehen in [roadmap.md](roadmap.md). Die Haken unten werden mit Paket P08 der Roadmap nachgezogen.

Jeder Meilenstein endet mit etwas, das man auf PC, Tablet und Handy (hoch und quer) ausprobieren kann.

- [x] **0. Grundgerüst:** `web/`, 3D-Szene, Kamera, Zoom und Verschieben, Modul-Lader, Veröffentlichung.
- [ ] **1. Spielkern:** Stufe 1 mit echten Liegeplatzdaten, Boote laufen ein, Boot und Steg antippen, abends kassieren.
- [ ] **2. Bauen:** Bauplätze, Infokarte, Toilette, Dusche, Kiosk, Wünsche, Ruf.
- [ ] **3. Stufen 1 bis 3 und Speichern:** Passregel, Stegausbauten, Durchstich, Hafenbüro mit Automatik, Speichern, Export, Web-App.
- [ ] **4. Artstil, Animationen, Ton:** Flat Vector, Modelle, Anlegen mit Leinen, Abendlicht, Soundeffekte, Musik.
- [ ] **5. Stufen 4 bis 6:** Services, Außenhafen, Großschiffe, Ereignisse, Jahreslauf, Logbuch.
- [ ] **6. Balancing:** `tools/balance.mjs` nutzt `sim.js`, dazu Testspielen. Ziel: 6 bis 8 Stunden bis zum Abschluss der ersten Region.
- [ ] **7. Online:** Hafenname, Bestenliste, Gastboote.
- [ ] **8. Nordsee:** zweite Region mit Deich, Watt und Gezeiten.
- [ ] **9. Feinschliff:** überraschende Gesten, Einstieg, Erfolge, Test auf echten Geräten.

Nach Meilenstein 1 weiß man, ob Zuweisen und Kassieren Spaß macht. Wenn nicht, wird dort geändert, bevor irgendetwas hübsch gemacht wird.

## 14. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Stil | Flat Vector in 3D |
| Zuweisen von Hand oder automatisch | von Hand, ab Hafenbüro Automatik nur für Standardfälle |
| Vorspulen | Pause, 1x, 3x, 8x von Anfang an, Taste F für 3x (Jorven, 12.11.2026) |
| Schauplatz | Zwei Regionen: Ostsee (Start) und Nordsee (danach). Gebäude als Mix aus deutschen, dänischen und schwedischen Häfen |
| Dritte Zahl für Tagesgäste | nein. Tagesgäste bringen mehr Einnahmen und sind als Menschen im Hafen zu sehen |
| Tretboote und Kanus als Gäste | nur Kulisse am Strand |
| Klappbrücke über den Durchstich | nicht in 1.0 |
| Dauerlieger | ja, schon in 1.0 (Abschnitt 9a) |
| Stammgäste, Wetter an der Flagge, Fotomodus, Hafen schauen, Tagesziele | ja, alle fünf (Abschnitt 9a, Einzelheiten in [neue-features.md](neue-features.md)) |
| Story und Figuren | keine, nur ein kurzer Einstieg |

**Noch offen:** die Fragen am Ende von [roadmap.md](roadmap.md) (unter anderem Vorspulen und Tretboote). Bis zur Antwort gilt diese Tabelle.

## 15. Bewusst weggelassen

- Personal, Gehälter, laufende Kosten
- freies Platzieren und Drehen von Gebäuden
- Story, Dialoge, benannte Figuren
- Einnahmen, während das Spiel geschlossen ist
- Echtzeit-Mehrspieler
- Spielstand über mehrere Geräte (Export und Import als Ersatz)
