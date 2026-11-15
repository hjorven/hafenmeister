# Statistik und Saisonbilanz

Stand: 14.11.2026. Status: gebaut (Paket P41, Roadmap F19 Statistikseite, F20 Saisonbilanz nach dem Winter).
Code: `web/js/ui/statistik.js` (Karte), `web/js/features/statistik-daten.js` (Rechnung ohne Browser), Aussehen `web/css/statistik.css`.
Tests: `tests/statistik.test.mjs`, `tests/specs/statistik.spec.mjs`.

## Was der Spieler sieht

**Statistik** (Menü "Statistik", Taste T, Antippen der Säulen im Tagesabschluss, Knopf in der Winterpause). Eine Karte über dem Hafen, kein Vollbild:

- Kopf: welcher Zeitraum ("Tag 30 bis heute (Tag 59)").
- Drei Kacheln: eingenommen im Zeitraum, Schnitt je Saisontag (Wintertage zählen nicht), Belegung nachts im Schnitt.
- **Einnahmen nach Quelle:** je Tag eine Säule, gestapelt nach Liegegeld, Pacht, Gastronomie, Services, Tagesziele, Saisonziele, Sonstiges (gleiche Namen wie im Tagesabschluss). Der beste Tag hat eine goldene Kappe, Wintertage sind gestreift, eine Linie trennt die Saisons, der laufende Tag ist blass. Darunter die Legende mit Betrag und Anteil.
- **Belegung der Liegeplätze:** je Nacht eine Säule, Gäste und Dauerlieger getrennt. Ganz volle Nächte (ab 95 %) haben eine rote Kappe.
- Antippen einer Säule (oder Pfeiltasten) zeigt den Tag: Saison und Saisontag, Einnahmen je Quelle, Belegung ("38 von 54 Plätzen, 3 Dauerlieger"), weitergefahrene Boote, Knopf "Tagesabschluss dieses Tages".
- Ein Hinweis, höchstens einer: viele volle Nächte (mehr Plätze lohnen sich), viele weitergefahrene Boote, oder viele leere Plätze.
- **Saisons:** Tabelle der letzten fünf gemerkten Saisons mit Einnahmen (und Prozent zur Saison davor), Belegung und Anker.

**Saisonbilanz** (Winterpause, `features/winter.js`): keine zweite Tafel, die vorhandene Bilanz bekommt den Vergleich zur Saison davor, einen Streifen mit den Einnahmen nach Quelle, die Belegung im Schnitt mit vollen Nächten und den Knopf zur Statistik.

## Zahlen und Begriffe

- Einnahmen je Quelle kommen aus `state.stats.verlauf` (Tagesberichte, `sim.tagesbericht`). Geschenke (erstes Bauwerk) zählen nicht, wie in der Tagessumme.
- Belegung einer Nacht = (Gastboote + Dauerlieger) / Liegeplätze ohne die fest vergebenen (Fischer, Dienste). Gemessen im Hook `night`, also nach der Abreise; die heute Abgereisten zählen mit, sie liegen bis zum Vormittag.
- Ältere Spielstände ohne Nachtliste schätzen die Belegung aus dem Tagesbericht (liegend + abgereist durch alle Plätze); dann steht "belegt, geschätzt".
- Bilanz einer Saison wird in der Nacht des letzten Saisontags gemerkt. Vorher fehlte am zweiten und dritten Wintertag der erste Saisontag, weil der Verlauf nur 30 Tage hält.

## Spielstand

`state.modules.statistik = { nacht: [{ tag, gaeste, dauer, plaetze }], saisons: [Bilanz] }`. Höchstens 30 Nächte und 20 Saisons. Keine neue SAVE_VERSION: fehlt der Eintrag oder ist er kaputt, wird er still neu angelegt.

## Schnittstelle

- `game.statistik = { oeffnen(tag?), schliessen(), offen(), bereit }`. Ereignis `statistik:offen { offen }`.
- `features/statistik-daten.js`: `tage`, `quellenSumme`, `zusammenfassung`, `saison`, `saisons`, `vergleich`, `nachtMerken`, `haengeEin(addHook)`.
- `saisonBilanz` in `features/winter.js` ruft `statistik.saison` auf (gleiche Felder wie bisher, dazu `quellen`, `belegung`, `volleNaechte`, `stufe`).

## Entscheidungen (Thread, selbst entschieden)

- Karte statt Vollbild: Der Hafen bleibt zu sehen. Am Handy hochkant höchstens die halbe Höhe, der Rest scrollt; am Handy quer 380 px breit zwischen den Knöpfen. Verdeckung siehe [ui/verdeckung.md](ui/verdeckung.md).
- Meldungs-Ordnung: Die Karte zählt als Fenster mit Vorrang 85. Solange sie steht, warten Tagesabschluss (80) und Winterpause (75); Feier und Kartenwahl gehen vor.
- Taste T (frei; S ist Kamera).
- Belegung ohne Fischerplätze: die sind immer belegt und würden die Zahl schönen.
- Kein Eingriff in `economy.js` und `sim.js`: alles hängt sich über den Hook `night` ein.

## Randfälle

- Erster Tag ohne Verlauf: nur die Säule "heute" und die Zahlen bis jetzt; ganz ohne Daten "Die Statistik füllt sich ab dem ersten Abend."
- Ausbau mitten im Zeitraum: Belegung je Nacht mit den Plätzen jener Nacht.
- Winterlager: Dauerlieger im Winterlager zählen nicht (sie liegen nicht im Hafen).
- Möglicher Zusammenstoß: P20-Rest (Winter, `winter.js`) baut an derselben Karte; die Bilanz steht in einem eigenen Block `.hm-wi-bilanz`. Wer `VERLAUF_TAGE` in `sim.js` ändert, muss `NACHT_MAX` mitziehen.
