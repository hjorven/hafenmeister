# Erfolge

Stand: 14.11.2026. Status: gebaut (Paket P22, Roadmap: I6 Erfolge als Dinge im Hafen, I7 Meilensteine mit Ton und Bild).

## Was der Spieler sieht

**Meldung.** Ein neuer Erfolg erscheint rechts oben als kleine Meldung: Symbol (Wimpel, Pokal), fette Zeile mit dem Titel, darunter, wofür es ihn gab. Am Handy hochkant nur Symbol und Titel. Dazu ein eigener Ton (zwei Glockenschläge, beim Pokal mit Schlussakkord). Kommen mehrere zugleich (Vorspulen), fasst eine Meldung sie zusammen ("4 neue Erfolge", der Pokal vorn). Die Meldung folgt der Meldungs-Ordnung (Vorrang 30: nach Feier, Kartenwahl, Tagesabschluss, Winter, Dauerliegern, Einstieg und Tipps; vor Logbuch und Gästebuch) und wartet, bis sie dran ist. Antippen öffnet den Reiter "Erfolge" im Logbuch. Die Stufenschilder haben keine eigene Meldung, der Aufstieg wird schon groß gefeiert.

**Logbuch, Reiter "Erfolge".** Oben der Stand ("9 von 30 Erfolgen · im Hafen: 6 Wimpel, 1 Pokal, 2 Schilder") mit Balken. Darunter sechs Gruppen: Hafenbetrieb, Gäste und Ruf, Kasse, Ausbau, Logbuch, Jahreslauf. Erreichte Erfolge stehen hell mit Tag und Stufe, neue mit "neu"; offene sind ausgegraut und zeigen ihren Fortschritt ("7 / 25"). Der Reiter trägt einen Punkt, solange es Ungelesenes gibt, und die Zahl im Menü "Logbuch" zählt die neuen Erfolge mit.

**Chronik.** Jeder Erfolg steht in der Zeile seines Tages ("Erfolg: Maßarbeit.").

**Dinge im Hafen (I6).** Beim Hafenmeisterhaus, nach denselben Regeln wie die Deko der Tagesziele (nie auf Wegen, Bauplätzen, im Wasser oder am Hang):

- **Erfolgsmast**: weißer Mast mit zwei Flaggenleinen; je Wimpel-Erfolg ein Wimpel in der Farbe seiner Gruppe, die im Wind flattern.
- **Pokaltreppe**: Holzpodest mit drei Stufen, je Pokal-Erfolg ein goldener Pokal.
- **Ehrentafel**: Tafel mit fünf Plätzen, je Ausbaustufe 2 bis 6 ein Messingschild.

Jedes Stück erscheint mit seinem ersten Ding; ein neuer Erfolg lässt sein Ding hüpfen.

## Die Erfolge

Schwellen stehen in `data/economy.js` unter `erfolge` (Zahlenregel). 30 Erfolge:

| Gruppe | Erfolge |
|---|---|
| Hafenbetrieb | Erste Leine fest, Maßarbeit (25 passgenau), Ausgebucht (jede Gastbox abends belegt, ab 12 Boxen), Zuverlässig (10 Tagesziele), Gute Woche (Wochenziel) |
| Gäste und Ruf | Volles Gästebuch (100 Gäste), Beliebter Hafen (1.000, Pokal), Kommt gern wieder (1. Stammgast), Bekannte Gesichter (25 Stammgäste), Ein Abend mit 5 Sternen (mindestens 2 Abreisen, alle 5 Sterne, Pokal), Bester Ruf an der Küste (Ruf 4,5), Eine Woche nur Lob (7 Tage in Folge jeder Abreisende 4 Sterne oder mehr; Tage ohne Abreise unterbrechen nicht) |
| Kasse | Guter Tag (1.000 € an einem Tag), Großer Zahltag (10.000 €, Pokal), Gut gewirtschaftet (100.000 € insgesamt), Hafenmillionär (1.000.000 €, Pokal) |
| Ausbau | Grundstein (erstes Bauwerk), Schilder Stufe 2 bis 6 (Dorfhafen, Zur Ostsee, Marina, Küstenmarina, Seehafen), Hafenmeister der Ostsee (Ziel der letzten Stufe, Pokal) |
| Logbuch | Bootskenner (10 Modelle), Hafenkieker (30), Wandelndes Bootslexikon (60, Pokal), Von klein bis groß (S, M, L, XL), Großer Bahnhof (2 Traditionssegler zugleich) |
| Jahreslauf | Erste Saison (der erste Winter beginnt), Sturmerprobt (einen Sturm überstanden) |

Entscheidungen (Thread P22, ohne Rückfrage, nach "Fertig heißt spielbar"):

- Plan.md nannte "alle drei Traditionssegler gleichzeitig". Drei zugleich kam in den simulierten Partien nie vor; zwei kommen gegen Ende von Stufe 6 vor. Darum zwei.
- "Ein Abend mit 5,0" heißt: mindestens zwei Gäste reisen ab und jeder gibt 5 Sterne (einer allein wäre Zufall). Das Spiel zeigt Sterne, darum "Sterne".
- "Ausgebucht" erst ab 12 Gastboxen: am alten Steg mit 4 Boxen wäre es am ersten Abend geschenkt.
- Bekannte Gesichter 25 statt 10: 10 Stammgäste kamen in Stufe 3 schon nach vier Tagen.
- Hafenmillionär und Hafenmeister der Ostsee sind Ziele fürs Endlosspiel (am Abschluss der letzten Stufe stehen rund 80 % der Million).

Erreichbarkeit: `tests/erfolge.test.mjs` spielt zwei ganze Partien (geschickter Spieler aus `tools/balance.mjs`) und prüft, dass jeder Erfolg aus den Spielregeln erreicht wird, in sinnvoller Reihenfolge (Seed 1: Erste Leine Tag 1, Ausgebucht Tag 36, Maßarbeit Tag 71, Beliebter Hafen Tag 119, Großer Zahltag Tag 221). Erfolge aus Oberflächen-Modulen (Tagesziele, Stammgäste, Sturm) werden einzeln geprüft.

## Technik

- `web/js/features/erfolge-daten.js` (ohne Browser): `ERFOLGE`, `GRUPPEN`, `pruefen(state, h)`, `zaehle(state, events, h)`, `zaehleExtra(state, art)`, `ansicht`, `dinge`, `ausgebuchtJetzt(state, ctx)`.
- `web/js/features/erfolge.js` (MODULES-Zeile nach dem Logbuch): zählt Ereignisse der Spielregeln (`moored` passgenau, `departed` Bewertungen, `evening` ausgebucht, `dayEnd`, `dayStart` Winter, `regionDone`), dazu `ziel:erreicht`, `wochenziel:erreicht`, `event:end` (Sturm). Nach jedem `sim:change` prüft es alle offenen Erfolge (billig).
- `web/js/features/erfolge-dinge.js` (Three.js, nachgeladen) meldet die drei Stücke über `game.zielDeko.zusatz(id, { lage, radius, objekt, da })` an (neu in `features/ziel-deko.js`).
- Ton `erfolg` in `audio/audio.js`.
- Logbuch: neuer Reiter über `game.logbuch.reiter({ id, name, teil, zahl })` (neu in `ui/logbuch.js`).
- Meldung: `#hm-ef-meldung`, `VORRANG.erfolg = 30`, ruft `game.meldungen.anmelden?.('#hm-ef-meldung', 'erfolg')` für den gemeinsamen Meldeplatz auf (Thread "Handy-Oberfläche neu und ruhig gestalten").
- Schnittstelle: `game.erfolge = { ansicht(), dinge(), erreicht(id), oeffnen(), pruefen(), aufbauen() }`, Ereignis `erfolg:neu { id, titel, ding, gruppe }`.

## Speichern

`state.modules.erfolge = { erreicht: { id: { tag, stufe, nach? } }, z: { Zähler }, neu: [ids] }`. Keine neue `SAVE_VERSION`: das Feld entsteht beim ersten Prüfen, `erfolgeState()` säubert es. Ein alter Spielstand ohne Erfolge bekommt beim Laden alles, was schon erfüllt ist (Stufen, Gäste, Geld), still nachgetragen (`nach: true`, keine Meldungsflut). Zähler, die es vorher nicht gab (passgenau, Tagesziele, Serie), beginnen bei 0.

## Wo es mit anderen kollidieren kann

- **Gemeinsamer Meldeplatz** (Handy-Oberfläche): die Meldung meldet sich mit `anmelden?.()` an; bis der Platz auf main ist, steht sie rechts oben wie Logbuch und Gästebuch.
- **Neue Stufen (Welle 6, Stufe 7 bis 20)**: die Ehrentafel hat fünf Plätze (2 bis 6). Für mehr Stufen braucht es eine zweite Tafel oder ein anderes Ding; die Liste `ERFOLGE` lässt sich erweitern, gespeichert wird nur die id.
- **Neue Dinge bei der Deko**: die drei Stücke suchen ihren Platz nach der Tagesziel-Deko; je mehr dort steht, desto weiter wandern sie.
- **Tagesziele/Ereignisse**: Zähler hängen an `ziel:erreicht`, `wochenziel:erreicht`, `event:end` mit `event.id === 'sturm'`. Wer diese Namen ändert, muss sie hier nachziehen.
