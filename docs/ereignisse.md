# Ereignisse und Jahreslauf

Stand: 11.11.2026. Umsetzung von [Plan Abschnitt 7](plan.md#7-ereignisse-und-jahreslauf).

## Was es gibt

| Ereignis | Ab Stufe | Dauer | Etwa alle | Wirkung |
|---|---|---|---|---|
| Nebel | 1 | 1 Tag | 13 Tage | 30 % weniger Ankünfte, Gäste bleiben eine Nacht länger |
| Sommertag | 1 | 1 Tag | 11 Tage (nur Saisontag 7 bis 24) | mehr kleine Boote und Badegäste, Kiosk verdient mehr |
| Sturm | 3 | 1 Tag | 12 Tage | niemand läuft von See ein, Gäste bleiben eine Nacht länger, Außenhafen -1 Anker; Seenotretter-Station mindert das |
| Regatta | 3, mit Segelclub | 2 Tage, 2 Tage vorher angekündigt | 14 Tage | 1,6x Ankünfte, vor allem Segelboote, mehr Besucher, etwas Ruf |
| Hafenfest | 4 | 1 Tag | 20 Tage (Hochsommer) | Traditionssegler und Marine, doppelt so viele Besucher, abends Feuerwerk |

Kreuzfahrtschiffe, Marinebesuche und Ausflugsfahrten plant das Services-Modul als regelmäßige Besuche.

**Leitlinien:** jedes Ereignis wird angekündigt, keins kostet Geld oder zerstört etwas, nie zwei gleichzeitig, danach mindestens zwei ruhige Tage. Im Schnitt 4 Ereignisse pro Saison in Stufe 1 und 2, etwa 8 ab Stufe 3.

**Jahreslauf:** 30 Saisontage (1 bis 8 Frühling, 9 bis 22 Sommer, 23 bis 30 Herbst), danach 3 Tage Winter mit Schnee, ohne Ereignisse, mit wenig Ankünften (`winter: true` in den Modifikatoren).

## Was schon wirkt

`main.js` lädt das Modul, `sim.js` fragt `game.events.modifiers()` jeden Morgen und Abend ab (siehe [spielregeln.md](spielregeln.md)). Das Modul folgt `game.state.day` und `game.state.phase` und speichert seinen Stand unter `game.state.modules.events`. Ohne Spielregeln läuft eine Ersatzuhr.

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/data/events.js` | alle Zahlen: Ereignisse, Standardwerte, Jahreslauf |
| `web/js/events/scheduler.js` | Planer, reine Logik ohne Three.js und DOM, läuft in Node |
| `web/js/events/events.js` | Anbindung an `game` (Modul für `main.js`) |
| `web/js/events/effects.js` | Regen, Schnee, Nebel, Blitze, Feuerwerk als 2D-Ebene `#weather-fx` über `#stage` |
| `web/js/events/banner.js` | Ankündigungsschild `#event-banner`, Wetterknopf `#weather-chip`, Wetterbericht `#weather-panel` |
| `web/css/events.css` | Aussehen, wird von `events.js` nachgeladen |
| `tests/ereignisse.test.mjs` | Tests |

## Schnittstelle

**Eingänge**

| Ereignis | Von | Bedeutung |
|---|---|---|
| `game.state.day`, `day:start` `{ day, stage }` | Sim | neuer Spieltag. Ohne Spielregeln zählt eine Ersatzuhr (120 s pro Tag) |
| `stufe` Zahl 1 bis 6 | Sim | neue Ausbaustufe, sonst wird `game.state.stufe` gelesen |
| `build` `{ id, level }` | Bauen | z. B. `segelclub`, `seenotretter` |
| `phase` `'tag' \| 'abend'` | Sim | Tageszeit, alternativ `body[data-phase]` |
| `game.services.effekte()` | Services | `freischalten` mit `'regatta'`, `sturmschutz` 0 bis 1, `regatta`, `hafenfest` als Faktoren |

**Ausgänge**

| Ereignis | Daten |
|---|---|
| `event:announce` | `{ event, day, startDay, endDay }` |
| `event:start` | `{ event, day, endDay }` |
| `event:end` | `{ event, day }` |
| `sturm` | `{ tag }` am Sturmtag, Seenotretter laufen aus |
| `weather` | `{ wind, fog, rain, snow, sun, event, part }` bei jedem Tageswechsel |
| `wetter` | `{ bewoelkung, wind }` im Format von `render/landscape.js` |
| `season` | `{ year, seasonDay, winterDay, part, winter }` beim Wechsel der Jahreszeit |
| `sound` | `{ id: 'feuerwerk' \| 'donner' }` für das Ton-Modul |

**Abfrage** über `game.events`

```js
game.events.modifiers()   // Wirkung heute, immer vollständig:
// { arrivalFactor, seaArrivals, extraNights, sizeFactor: {S,M,L,XL}, kindFactor: {art: faktor},
//   visitorFactor, serviceIncomeFactor, priceFactor, satisfaction: { outer, all }, winter, ratingBonus }
game.events.season(tag)   // { year, seasonDay, winterDay, part, winter }
game.events.forecast(3)   // heute und die nächsten 3 Tage
game.events.current       // { id, startDay, endDay, event } oder null
game.events.save()        // für den Spielstand, z. B. unter state.events
game.events.load(daten)
```

## Prüfen

```bash
node --test tests/ereignisse.test.mjs
```

```bash
bash tools/check-pages.sh web
```

Im Browser in der Konsole Tage vorspulen:

```js
for (let d = 1; d < 60; d++) hafenmeister.emit('day:start', { day: d, stage: 4 });
```
