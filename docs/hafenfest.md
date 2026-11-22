# Eigenes Hafenfest (P38, F12)

Stand: 22.11.2026. Status: gebaut. Paket P38 aus der [Roadmap](roadmap.md), Welle 3 (Höhepunkte).

Ab Stufe 3 setzt du einmal je Saison selbst ein Hafenfest an. Du wählst den Tag und was dazugehört, die Vorbereitung kostet sofort Geld. Am Festtag kommen Boote von überall und viele Besucher, der Hafen wird voll. Das zufällige Hafenfest ab Stufe 4 gibt es dafür nicht mehr: Das Fest kommt nur, wenn du es ansetzt.

## So spielt es sich

- **Fragen:** Zu Beginn jeder Saison (ab Saisontag 2) und beim ersten Mal ab Stufe 3 fragt eine kurze Meldung, ob du ein Fest planen willst ("Fest planen" oder "Später"). Jederzeit geht es im Wetterbericht: Wetterknopf oben links, unterste Zeile "Eigenes Hafenfest", Knopf "Fest planen".
- **Tag wählen:** Der Planer zeigt die Saisontage 3 bis 15 als Kacheln (Sommertage gelb). Frühestens übermorgen. Nicht möglich (durchgestrichen, Antippen sagt warum): zu kurzfristig, zu nah an einem angekündigten Ereignis (ein ruhiger Tag Abstand), an Mittsommer und den Heringstagen samt Tag davor und danach, und ab Stufe 5 im Fenster der Hanse-Woche, solange sie in dieser Saison noch kommen kann.
- **Was gehört dazu:** Grundpreis für Anmeldung und Werbung, dazu frei wählbar:

| Teil | Wirkung am Festtag | Im Hafen |
|---|---|---|
| Grundfest | 1,5-mal so viele Ankünfte, 1,6-mal Besucher, Versorgung 1,3-mal, +0,1 Anker; ab Stufe 5 sechsmal so oft Traditionssegler | viele Leute an Land, Schild "Hafenfest" am Wetterknopf |
| Schmuck | +0,25 Anker auf jede Bewertung | Wimpelketten an Masten über allen gebauten Stegen |
| Musik | Besucher noch einmal 1,5-mal, mehr Leute an Land | Bühne mit rot-weißem Dach beim Hafenmeisterhaus, Festmusik (schneller, zum Schunkeln) |
| Marktstände | Versorgung 1,3-mal, abends Standgeld (mehr als die Stände kosten) | drei Stände rund um die Bühne |
| Feuerwerk | Crews bleiben eine Nacht länger (mehr Liegegeld) | Feuerwerk am Abend |

- **Kosten** je Ausbaustufe (3 / 4 / 5 / 6): Grundpreis 150 / 350 / 600 / 900 €, Schmuck 80 / 180 / 320 / 480 €, Musik 120 / 260 / 450 / 650 €, Marktstände 100 / 220 / 380 / 560 € (Standgeld 160 / 340 / 560 / 820 €), Feuerwerk 180 / 380 / 650 / 950 €. Steht im Tagesabschluss unter Ausgaben "Hafenfest vorbereiten".
- **Absagen:** Bis zum Vorabend im Planer ("Fest ändern oder absagen"), die Hälfte der Kosten kommt zurück (Einnahmen: Sonstiges). Danach kannst du in derselben Saison neu ansetzen.
- **Vorabend:** Meldung "Morgen ist dein Hafenfest", am Abend wird aufgebaut (Wimpel, Bühne, Stände).
- **Festtag:** Ankündigung "Heute: Hafenfest", Festmusik mit Musik, Feuerwerk am Abend, wenn gebucht. Mehr Boote, als Plätze frei sind: Wartebojen und Päckchen werden gebraucht.
- **Päckchen (P27):** Wer am Festabend im Päckchen liegt, bekommt den Abzug von −0,5 Anker zurück. Am Festtag liegt man gern im Päckchen.
- **Bilanz am Abend:** Boote im Hafen und wie viele sonst an einem normalen Abend liegen, Anteil belegter Plätze, Besucher, Standgeld, Kosten der Vorbereitung. Was der Tag insgesamt brachte, steht danach im Tagesabschluss.
- **Danach:** Nachspiel wie bisher, zwei Tage mehr Besucher ("Nach dem Hafenfest"). In dieser Saison kein zweites Fest.

## Technik

| Datei | Inhalt |
|---|---|
| `web/js/features/hafenfest-regeln.js` | Regeln ohne DOM: Tage, Kosten, Wirkung, ansetzen, absagen, Hooks `evening` und `rating` |
| `web/js/features/hafenfest.js` | Modul (eine MODULES-Zeile): Planer `#hm-fest`, Meldung `#hm-fest-karte` (Meldeplatz, Vorrang 58), Zeilen im Wetterbericht, Festmusik |
| `web/js/render/fest-deko.js` | Wimpelketten (InstancedMesh), Bühne und Stände über `game.zielDeko.zusatz` |
| `web/js/events/scheduler.js` | eigener Platz `eigen` im Planer: `eigenFrei`, `ansetzen`, `absetzen`, `eigen`; Ereignisse mit `selbst` planen sich nicht selbst; die anderen halten Abstand |
| `tests/hafenfest.test.mjs` | Tests |

- Das Fest ist das Ereignis `hafenfest` des Planers. Wetter (sonnig), Wetterbericht, Ankündigung, Wirkung auf die Spielregeln, Nachspiel und Logbuch kommen von dort. Die gebuchten Teile stehen in `current.extra` (Wirkung), `current.evening` (Feuerwerk oder nicht) und `current.menschen` (Leute an Land).
- Zahlen: `ECONOMY.ereignisse.hafenfest` (`selbst`, `saison`, `wirkung`, `menschen`, `eigen.kosten`, `eigen.teile`, `eigen.vorlauf`, `eigen.erstattung`).
- Stand: `state.modules.hafenfest` (`jahr`, `tag`, `teile`, `kosten`, `gefeiert`, `letztes`, `gesehen`, `abende`), der Planer in `state.modules.events.eigen`. Nach Ansetzen und Absagen wird der Planer sofort in den Spielstand gelegt. Alte Spielstände ohne diese Felder laufen weiter, kein neuer SAVE_VERSION nötig.
- Sim-Ereignisse: `sim:hafenfestAngesetzt`, `sim:hafenfestAbgesagt`, `sim:hafenfestVorabend`, `sim:hafenfestErgebnis` `{ boote, sonst, besucher, einnahmen, standgeld, kosten, paeckchen, voll }`. Für die Ansicht: `hafenfest:aufbau` `{ teile }` und `hafenfest:abbau`.
- Schnittstelle: `game.hafenfest = { oeffnen(), schliessen(), stand(), aufgebaut(), zeile(entry), berichtZeile(tag) }`, `game.events.eigen`, `game.festDeko.stand()`, `game.audio.setFest(an)`.

## Zusammenspiel (geprüft)

- **Andere Ereignisse:** halten einen ruhigen Tag Abstand (Planer). Mittsommer, Heringstage und Hanse-Woche fallen nie aus (Test über 25 Samen, Stufen 3 bis 6, drei Jahre).
- **Sturm:** kann nicht auf den Festtag fallen, das Festwetter ist sonnig.
- **Speichern und Laden:** Fest und bezahltes Geld bleiben (im Browser geprüft: ansetzen, speichern, neu laden, absagen).
- **Stufenausbau zwischen Ansetzen und Fest:** die Kosten bleiben, das Standgeld richtet sich nach der Stufe am Festtag.
- **Bauten:** Museumshafen macht das Fest wie bisher größer (`services.hafenfest`, Besucher und Versorgung).
- **Bootsgeschichten:** "Zum Hafenfest" jetzt ab Stufe 3.
- **Möglicher Konflikt:** P31 Gästewünsche und P35 Preisstufe ändern `economy.js` und `sim.js`; der Hafenfest-Block in `economy.js` steht für sich unter `ereignisse.hafenfest`.
- **Zeitraffer-Bot:** setzt kein Fest an (wie der Balancing-Spieler, siehe unten).

## Balancing

Das zufällige Hafenfest kam vorher ab Stufe 4 etwa einmal je Saison. Jetzt kommt es nur, wenn der Spieler es ansetzt; die Rechnung (`tools/balance.mjs`) setzt keins an. Gemessen am 22.11.2026 mit `node tools/balance.mjs --laeufe 30` und `--spieler zeitraffer` (Median der Spieltage bis zum Regionsabschluss):

| Spielertyp | vorher | nachher |
|---|---|---|
| zeitraffer | 105 | 105 |
| geschickt | 101 | 101 |
| gemütlich | 119 | 121 |

Das Ziel von rund 105 Tagen bleibt. Wer das Fest ansetzt, ist etwas schneller: Am Festtag lagen im Browser-Durchlauf (Stufe 4, alle Teile, 1.390 €) 45 Boote im Hafen statt rund 21 bis 26 an normalen Abenden, dazu 340 € Standgeld und eine Nacht länger für alle Crews.

## Prüfen

```bash
node --test tests/hafenfest.test.mjs tests/ereignisse.test.mjs tests/vorbereiten.test.mjs
```

Im Browser in der Konsole:

```js
hafenmeister.sim.state.money = 5000; hafenmeister.hafenfest.oeffnen();
```
