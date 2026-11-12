# Spielregeln: Schnittstelle für alle Module

Stand: 11.11.2026. Die Regeln laufen ohne Grafik und ohne DOM und sind mit Node testbar. Die Zahlen kommen aus `web/js/data/economy.js` (Balancing-Thread). `sim.rulesFromEconomy(ECONOMY)` bringt sie in das Format der Regeln, was dort fehlt, kommt aus `web/js/data/rules.js`.

## Dateien

| Datei | Aufgabe |
|---|---|
| `web/js/sim.js` | Regeln: Ankunft, Warten an der Boje, Passregel, Zuweisen, Hafengeld, Ruf, Jahreslauf, Ausbau |
| `web/js/state.js` | Spielstand als JSON, Zufall mit Seed, eigenes Speichern als Rückfall, `init(game)` |
| `web/js/random.js` | Zufall mit Seed (mulberry32), Zustand liegt im Spielstand |
| `web/js/bridge.js` | Verbindet die Regeln mit `game` (Ereignisse, Gesten, Speichermodul) |
| `web/js/data/rules.js` | Grundwerte der Regeln, die economy.js nicht festlegt |
| `web/js/data/boat-catalog.js` | Ersatzkatalog der Bootsarten, bis alle Schiffs-Threads liefern |
| `web/js/ui/hud.js` | Geld, Ruf, Tag, Übersicht der Wartenden, Karten für Boot und Bauen, Knöpfe Kassieren und Spielstand |
| `tests/sim.test.mjs`, `tests/state.test.mjs`, `tests/harbor-sim.test.mjs` | Tests |

## Ablauf eines Tages

1. Morgens würfelt `sim.js` die Ankünfte des Tages aus: Zahl = Boote pro Tag der Stufe × Ruf-Faktor × Modifikatoren. Im Winter (Tag 31 bis 33 jeder Saison) kommt niemand.
2. Ein Boot kommt an und legt sich an eine freie **Warteboje** vor dem Hafen (`boat.waitSpot`, 0 = erste Boje). Sind alle Bojen belegt, fährt es weiter. Die 3D-Ansicht meldet mit `game.emit('boot:an-boje', { id })`, wenn das Boot fest ist. Erst ab dann zählt seine Geduld. Meldet niemand etwas, gilt es nach 35 s als angekommen.
3. Der Spieler zieht das Boot auf einen Platz oder tippt „Einfahren“, auch schon während der Anfahrt. Tut er nichts, sucht sich das Boot nach 8 s an der Boje (`queue.selfEnterAfter`) selbst die knappste passende freie Box (`sim:selfEntered`). Wünsche wie Strom beachtet es dabei nicht, das lohnt sich nur von Hand oder mit dem Hafenbüro. Ein ausgewähltes Boot (`boat.held`) wartet. Passt keine Box, fährt es nach Ablauf der Geduld weiter.
3a. Tagestörn: Gäste mit 2 oder mehr Nächten fahren an manchen Tagen hinaus (`sim:tripOut`, `sim:tripBack`, `boat.trip.away`). Die Box bleibt belegt. Kein Törn bei Sturm und im Winter.
4. Sobald ein Boot angelegt hat, wird sein Liegegeld für die kommende Nacht fällig (Münze, `boat.paid = false`). Nach dem Kassieren gilt es als bezahlt (`boat.paid = true`, in `game.sim.boote` als `bezahlt`). Wer mehrere Nächte bleibt, zahlt jeden Morgen die nächste Nacht. Am ersten Tag eines neuen Spiels kommt das erste Boot schon nach 3 s (`rules.firstArrivalAt`).
4a. Tagesrhythmus: Boote kommen zwischen 35 % und 95 % des Tages, am häufigsten um 70 % (`arrivalFrom`, `arrivalWindow`, `arrivalPeak`; aus `ECONOMY.zeit.ankunftVon/ankunftBis/ankunftSpitze`). Wer abends noch an der Boje liegt, bleibt über Nacht und hat morgens wieder volle Geduld (`queue.overnight`, `ECONOMY.warten.ueberNacht`).
4b. Abends (ab 90 s): Pacht der stationierten Einheiten, Tagesgäste und Services werden abgerechnet.
5. Nachts (ab 120 s): nicht kassierte Münzen zählen zur Hälfte, Boote mit 0 Nächten werden abgerechnet und bewerten den Hafen (`sim:departed` mit `leaveAt`). Sie legen aber erst am nächsten Vormittag ab, jedes zu seiner Zeit zwischen 7 % und 30 % des Tages (`departWindow`, `ECONOMY.zeit.abreiseVon/abreiseBis`): dann kommt `sim:castOff` und für die Grafik `boot-faehrt`. Bis das Boot heraus ist, bleibt die Box belegt. Der Spielstand wird gespeichert.

**Liegeplätze:** Zu Beginn gibt es nur die Plätze aus `ECONOMY.start`. Jedes Stegprojekt (`ECONOMY.stegprojekte`, unter „Bauen“) und jeder Stufenausbau schaltet seine Plätze frei. Fischerplätze bekommen ihr Fischerboot von selbst, es zahlt Pacht. Für die nächste Ausbaustufe zählen die Gäste, die in der aktuellen Stufe abgereist sind.

**Passregel:** Ein Boot passt an einen Platz, wenn es nicht länger und nicht breiter ist als der Platz und die Wassertiefe der aktuellen Stufe mindestens 0,3 m größer ist als sein Tiefgang. Fischerplätze sind fest vergeben, der Kai ist nur für XL.

**Hafengeld:** Grundpreis der Größe × (1 + 0,25 × erfüllte Wünsche). **Ruf:** Schnitt der letzten 20 Bewertungen.

## `game.sim` (im Browser)

| Aufruf | Ergebnis |
|---|---|
| `game.sim.state` | Spielstand, dasselbe Objekt wie `game.state` |
| `game.sim.ctx` | Regeln, Bootsarten und Liegeplätze |
| `select(bootId)` | Boot auswählen, liefert passende freie Platz-ids, sendet `sim:select` |
| `assign(bootId, platzId)` | zuweisen, `{ ok, reason }` |
| `autoEnter(bootId)` | automatisch einfahren (bester freier Platz) |
| `dismiss(bootId)` | wartendes Boot wegschicken |
| `collect(bootId)`, `collectAll()` | Münze einstreichen |
| `fastForward(sekunden)` | Spielzeit vorspulen, höchstens bis zum nächsten Abend oder Morgen |
| `upgradeFacility(key)`, `upgradeOffice()`, `build(id, kosten, stufe)`, `advanceStage()` | Bauen |
| `openJettyProjects()`, `buildJettyProject(id)` | Stegprojekte der aktuellen Stufe. Angeboten wird nur, was in dieser Stufe Liegeplätze bringt; sonst `reason: 'noBerths'` |
| `spend(betrag)`, `addIncome(betrag)` | Geld für andere Module |
| `waitingBoats()`, `mooredBoats()`, `preview()`, `waitSpotCount()` | Lesen |
| `boote` | alle wartenden und liegenden Boote im Format von `boot-kommt`, zum Aufbauen nach dem Laden |
| `fittingBerths(bootId)`, `whyNotFit(bootId, platzId)`, `availableBerths()` | Plätze |
| `reputation()`, `season()`, `canAdvanceStage()`, `facilityUpgrade(key)`, `modifiers()` | Lesen |
| `geduld(bootId)` | restliche Sekunden an der Boje |
| `platzZustand(platzId)`, `platzZustaende()` | Zustand für das Grün-Rot-Schild: `'frei'`, `'belegt'`, `'ausflug'`, `'reserviert'`, `'aus'` |
| `aufAusflug(bootId)` | Gast ist gerade auf Tagestörn |
| `regionGoal()` | Abschlussziel der letzten Stufe: `{ active, ok, missing, visits, reputation, openBerths, goal }` |
| `istBezahlt(bootId)` | Liegegeld für die kommende Nacht kassiert (für Bändchen am Bug und Rundgang) |
| `wartet(bootId)`, `passendePlaetze(bootId)`, `tagesAnteil()` | für die Gesten (`tagesAnteil` 0 = Morgen, 1 = Nacht) |
| `addHook(name, fn)`, `addService(key, def)` | Erweiterungen (unten) |
| `newGame(seed)`, `setRegion(id)` | neues Spiel, Region |

Boot-ids sind Zahlen. `'b17'` wird auch verstanden. Platz-ids sind die aus `web/js/data/harbor.js` (`'A01'`).

## Spielstand `game.state`

Einfaches JSON. Wichtige Felder: `day`, `phase` (`'day'` oder `'evening'`), `clock` (Sekunden im Tag), `stage`, `region`, `money`, `guests`, `ratings`, `facilities`, `office`, `buildings` (`{ id: stufe }`, zum Beispiel `mole`), `berths` (`{ platzId: bootId }`), `boats` (`{ id: boot }`), `queue`, `upcoming`, `logbook`, `stats`, `modules` (Platz für Spielstände anderer Module).

Deutsche Namen als Verweise (nicht im JSON): `game.state.stufe`, `game.state.geld`, `game.state.tag`.

Ein Boot: `{ id, typeId, modelId, name, size, kind, length, beam, draft, motor, special, dayVisitors, stationed, wishes, nights, status: 'expected' | 'waiting' | 'moored', waitSpot, berthId, pendingFee, paid, feeDay, ... }`.

## Ereignisse, die die Regeln senden

| Ereignis | Daten |
|---|---|
| `sim:change` | etwas hat sich geändert, Oberfläche neu zeichnen |
| `sim:arrived` | `{ boatId, waitSpot }`, Boot liegt an der Boje |
| `sim:moored` | `{ boatId, berthId }` |
| `sim:turnedAway` | `{ boatId, reason: 'queueFull' \| 'patience' \| 'evening', rated }` |
| `sim:dismissed` | `{ boatId }` |
| `sim:atBuoy` | `{ boatId }`, Geduld läuft |
| `sim:selfEntered` | `{ boatId, berthId }` Boot hat sich selbst eine Box gesucht (zusätzlich zu `sim:moored`) |
| `sim:tripOut`, `sim:tripBack` | `{ boatId, berthId }` Tagestörn eines Gastes. Für die Grafik zusätzlich `dauer:auslaufen { id, platzId, tage: 0, gast: true }` und `dauer:einlaufen { id, platzId, gast: true }` |
| `sim:berthState` | `{ plaetze: { A01: 'frei' \| 'belegt' \| 'ausflug' \| 'reserviert' } }` nach jeder Änderung und beim Laden, für das Grün-Rot-Schild |
| `sim:regionDone` | `{ region, day }` Abschlussziel der Region erreicht (letzte Stufe) |
| `sim:castOff` | `{ boatId, berthId }` abgerechnetes Boot legt jetzt ab (Vormittag) |
| `sim:berthFreed` | `{ berthId, boatId }` Box nach der Abreise wieder frei (bis dahin gilt sie als belegt, `state.leaving`) |
| `sim:feeReady` | `{ boatId, amount, wishesMet }`, Liegegeld fällig: direkt beim Anlegen (im selben Schritt wie `sim:moored`) und für Bleibende am Morgen. Münze erscheint, Boot ist unbezahlt |
| `sim:collected` | `{ boatId, amount }` |
| `sim:departed` | `{ boatId, berthId, typeId, rating }` |
| `sim:dayStart`, `sim:evening`, `sim:dayEnd` | Tageslauf |
| `sim:select` | `{ boatId, berths }` |
| `sim:assignFailed` | `{ boatId, berthId, reason }` |
| `sim:logbookNew`, `sim:built`, `sim:stageUp`, `sim:stageReady` | Fortschritt |
| `boot-kommt` | `{ id, groesse, art, modell, palette, name, boje, zustand }`, Boot fährt zur Warteboje (`groesse` wie `'S'`) |
| `boot-zugewiesen` | `{ id, platz }` |
| `boot:angelegt` | wie `boot-kommt`, mit `platz` |
| `boot-faehrt`, `boot:ablegen` | `{ id }`, Boot legt ab oder fährt weiter |
| `stufe`, `region`, `phase` | wie in `docs/grundgeruest.md`, auch einmal nach dem Laden |
| `day:start` | `{ day, stage, winter }` |
| `tag:ende` | `{ tag, stufe, ruf, boote: [{ id, art, kind, klasse, antrieb }] }` am Abend |
| `stage` | `{ stage }` |
| `build` | `{ id, level }` |

## Ereignisse, auf die die Regeln hören

| Ereignis | Wirkung |
|---|---|
| `tap` mit `pick` | Boot antippen wählt es aus oder kassiert seine Münze, Platz antippen weist das gewählte Boot zu |
| `ui:tow` | `{ boot }` Boot auswählen |
| `ui:tow-end` | `{ boot, platz }` zuweisen |
| `ui:auto-einfahren` | `{ boot }` automatisch einfahren |
| `ui:collect` | `{ coin }` eine Münze, ohne Daten alle |
| `ui:cancel` | Auswahl aufheben |
| `hafenmeister:halt` | `{ boot }` Rundgang am Abend: unbezahltes Boot zahlt die Hälfte (`sim:collected` mit `round: true`) |
| `services:besuch` | `{ art }` mit `kreuzfahrt` oder `flottenbesuch` zählt für das Abschlussziel |
| `boot:an-boje` | `{ id }` Boot ist an der Warteboje fest, ab jetzt zählt seine Geduld |
| `boot:aus-box` | `{ id }` oder `{ platz }` abreisendes Boot ist aus der Box heraus, der Platz ist wieder frei. Ohne Meldung nach 20 s (`rules.leaveMax`) |
| `services:abrechnung` | `{ summe }` wird gutgeschrieben |
| `spielstand-geladen` | Spielstand neu übernehmen |

## Wartende Boote im HUD

Solange niemand die Boote im Wasser zeigt, listet `#queue` die wartenden Boote als Knöpfe. Das Modul, das die Boote an den Wartebojen zeichnet, setzt `game.boatsVisible = true` und sendet danach `sim:change`; dann blendet das HUD die Leiste aus.

## Erweiterungen für andere Module

**Modifikatoren** (Ereignisse, Services): Die Regeln fragen jeden Morgen und Abend `game.events?.modifiers()` und `game.services?.effekte()` ab. Alternativ `game.sim.addHook('modifiers', fn)`. Alle Felder sind freiwillig:

```js
{
  arrivalFactor: 1,                 // mehr oder weniger Boote
  seaArrivals: true,                // false: niemand kommt über die Ostsee (Sturm)
  extraNights: 0,                   // liegende Boote bleiben länger (Sturm)
  sizeFactor: { L: 2 },             // mehr Boote einer Größe
  kindFactor: { segelyacht: 3 },    // mehr Boote einer Art (type.kind oder type.id)
  visitorFactor: 1,                 // Tagesgäste
  serviceIncomeFactor: 1,           // Einnahmen der Tagesgäste
  priceFactor: 1,                   // Hafengeld
  satisfaction: { outer: 0, all: 0 }, // negativ: Zufriedenheit sinkt (outer = ungeschützte Plätze)
  ratingBonus: 0,                   // auf jede Bewertung
  unlock: { kreuzfahrt: true },     // schaltet Bootsarten mit type.unlock frei
}
```

Faktoren mehrerer Module werden multipliziert, Zahlen addiert.

**Hooks:** `game.sim.addHook(name, fn)` mit `arrival` (`{ state, ctx, boat }`, Boot ändern), `evening` (`{ state, ctx, boats, addIncome, events }`), `night` (`{ state, ctx, events }`). Rückgabe: Funktion zum Aushängen.

**Neuer Wunsch:** `game.sim.addService(key, { levels, cost, fromStage, wishFromStage })`, oder mit `berthProp` für Wünsche, die der Liegeplatz erfüllt.

## Bootsdaten

`bridge.js` lädt `web/js/data/boats/s.js`, `m.js`, `l.js`, `xl.js`, falls vorhanden, und mischt sie über den Ersatzkatalog (gleiche id: die Datei gewinnt, fehlende Felder kommen aus dem Katalog). Erkannt wird das Format der Schiffs-Threads (`export const TYPES`, `export const MODELS` mit `typeId`, `fromStage`, `length`, `beam`, `draft`). Deutsche Feldnamen (`groesse`, `laenge`, `breite`, `tiefgang`, `abStufe`) gehen auch.

Zusätzliche Felder einer Bootsart: `kind`, `motor`, `sail`, `weight`, `fee`, `nights`, `noWishes`, `special` (Sondergast, bessere Bewertung), `dayVisitors` (Tagesgäste), `stationed` (fest stationiert, zum Beispiel Fischer), `unlock`, `fromSea`.

## Ohne Browser benutzen (Balancing, Tests)

```js
import { createState } from './web/js/state.js';
import * as sim from './web/js/sim.js';
import { HAFEN } from './web/js/data/harbor.js';
import { BOAT_CATALOG } from './web/js/data/boat-catalog.js';

const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN /*, rules: eigeneRegeln */ });
const state = createState({ seed: 42 });
state.office = 3;                 // Hafenbüro weist selbst zu
for (let d = 0; d < 100; d++) {
  sim.runDay(state, ctx);         // ein ganzer Tag
  sim.collectAll(state, ctx, true);
  sim.advanceStage(state, ctx);
}
console.log(state.day, state.stage, state.money, sim.reputation(state));
```

Gleicher Seed und gleiche Aktionen ergeben dasselbe Spiel.

## Prüfen

```bash
node --test tests/*.test.mjs
```

Im Browser:

```bash
python3 -m http.server 8000 --directory web
```

`http://localhost:8000` öffnen, warten, bis unten ein Boot erscheint, es antippen, „Automatisch einfahren“, dann „Kassieren“ antippen oder über die Münze streichen: das Geld oben steigt sofort.
