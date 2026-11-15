# Ereignisse und Jahreslauf

Stand: 14.11.2026. Status: gebaut. P24 fertig: Vorbereiten für Sturm und Regatta (Teil 1: G1, G2, G6), neue Ereignisse, Bauten, Nachspiel und Hanse-Woche (Teil 2: F17, G3, G7, G9); Winter mit Aufgaben P20 ([Roadmap](roadmap.md)). Umsetzung von [Plan Abschnitt 7](plan.md#7-ereignisse-und-jahreslauf).

## Was es gibt

| Ereignis | Ab Stufe | Dauer | Etwa alle | Wirkung |
|---|---|---|---|---|
| Nebel | 1 | 1 Tag | 9 Tage | 30 % weniger Ankünfte, Gäste bleiben eine Nacht länger |
| Sommertag | 1 | 1 Tag | 8 Tage (nur Saisontag 3 bis 14) | mehr kleine Boote und Badegäste, Kiosk verdient mehr |
| Sturm | 3 | 1 Tag | 8 Tage | niemand läuft von See ein, Gäste bleiben eine Nacht länger, Gäste an offenen Plätzen (Stirnplätze am Stegkopf, Kai) -1 Anker; Seenotretter-Station mindert das |
| Regatta | 3, mit Segelclub | 1 Tag (morgens raus, abends zurück), 2 Tage vorher angekündigt | 9 Tage | 1,6x Ankünfte, vor allem Segelboote, mehr Besucher, etwas Ruf |
| Hafenfest | 4 | 1 Tag | 11 Tage (Hochsommer) | Traditionssegler und Marine, doppelt so viele Besucher, abends Feuerwerk |
| Heringstage | 2, mit Räucherei | 1 Tag | einmal im Jahr, fest am Saisontag 3 | 1,5x Besucher, mehr Menschen im Ort; Räucherei und Fischhalle verdienen extra |
| Mittsommer | 2 | 1 Tag | einmal im Jahr, fest am Saisontag 7 | 1,6x Besucher, doppelt so viele Badegäste, abends bleiben sie am Strand; Gäste bleiben eine Nacht länger; mit Grillplatz brennt abends das Mittsommerfeuer |
| Holzboot-Treffen | 3 | 1 Tag | 11 Tage (Saisontag 3 bis 15) | Klassiker aus Holz (5x) und Ruderboote, Gäste bewerten etwas besser; mit Museumshafen auch Traditionssegler |
| Hanse-Woche | 5 | 2 Tage, 5 Tage vorher angekündigt | einmal im Jahr (Saisontag 11 bis 15) | großes Fest: Traditionssegler, große Schiffe, 2,2x Besucher, Ruf, abends Feuerwerk |

Kreuzfahrtschiffe, Marinebesuche und Ausflugsfahrten plant das Services-Modul als regelmäßige Besuche.

**Leitlinien:** jedes Ereignis wird angekündigt, keins kostet Geld oder zerstört etwas, nie zwei gleichzeitig, danach mindestens ein ruhiger Tag. Seit P17 (16 Saisontage zu rund 5 Minuten) kommen ab Stufe 6 mit allen Bauten im Schnitt knapp 8 Ereignisse je Saison (Mittsommer, Heringstage und Hanse-Woche jedes Jahr, Regatta etwa zweimal, Sturm, Nebel, Sommertag, Holzboote und Hafenfest je etwa einmal; 20 Samen, 10 Jahre). Abstände in der Tabelle sind Spieltage, Stand P17.

**Feste Tage und große Ereignisse (P24 Teil 2):** Mittsommer und Heringstage haben einen festen Saisontag (`amTag`), die anderen Ereignisse halten davor und danach Abstand. Ereignisse mit mindestens fünf Tagen Ankündigung (Hanse-Woche) haben im Planer einen eigenen Platz: Sie werden lange vorher angekündigt, die kleinen laufen bis kurz davor weiter. Der Wetterknopf zeigt "Hanse-Woche in 4 Tagen", der Wetterbericht hat eine Zeile dafür.

**Nachspiel (G3):** Nach Sturm, Regatta, Hafenfest und Hanse-Woche wirkt das Ereignis nach (`ECONOMY.ereignisse.nachspiel`): nach dem Sturm einen Tag 1,4x Ankünfte (wer draußen gewartet hat), nach der Regatta Nachzügler unter den Seglern, nach Hafenfest und Hanse-Woche zwei Tage mehr Besucher. Wer vorbereitet war (sturmklar, Plätze freigehalten), bekommt dazu einen kleinen Bewertungsbonus. Am Morgen kommt eine kurze Karte ("Nach dem Sturm").

**Bauten (G7):** Gebaute Services machen ein Ereignis größer (`ECONOMY.ereignisse.<id>.bauten`): An jedem Ereignistag bringt jeder passende Bau abends Geld (Tagesabschluss: Services, beim Bau), manche auch mehr Wirkung (Museumshafen beim Holzboot-Treffen: Traditionssegler). Die Ankündigung sagt, was die eigenen Bauten bringen ("Grillplatz und Eisdiele: +100 € am Tag"), oder nennt den passenden Bau als Tipp ("Mit Grillplatz: ..."). Das Ergebnis am Abend nennt die Beträge.

| Ereignis | Bauten (Geld je Tag nach Ausbaustufe) |
|---|---|
| Mittsommer | Grillplatz 60 € (Mittsommerfeuer), Eisdiele 40 / 70 € |
| Heringstage | Räucherei 70 / 140 €, Fischhalle 120 / 200 € |
| Holzboot-Treffen | Museumshafen 150 / 250 € und Traditionssegler, Slipanlage 30 / 50 €, Segelmacher 60 / 90 € |
| Hanse-Woche | Museumshafen 300 / 500 €, Hafencafé 80 / 120 € |

**Mehr Menschen im Bild:** Ereignisse mit `menschen` (Mittsommer, Heringstage, Holzboot-Treffen, Hanse-Woche) lassen mehr Spaziergänger und Badegäste kommen (`render/people.js`), am Mittsommerabend bleiben dreimal so viele am Strand.

**Jahreslauf:** 16 Saisontage (1 bis 4 Frühling, 5 bis 12 Sommer, 13 bis 16 Herbst; seit P17, ein Tag dauert jetzt rund 5 Minuten), danach 2 Tage Winter mit Schnee, ohne Ereignisse, mit wenig Ankünften (`winter: true` in den Modifikatoren).

## Vorbereiten (P24)

Am Tag der Ankündigung erscheint statt des Schilds eine Karte mit Knopf (`#ev-vorbereiten`, Meldungs-Ordnung Vorrang 60). Derselbe Knopf steht im Wetterbericht unter dem Ereignis, solange es angekündigt ist. Am Abend vor dem Ereignis erinnert die Karte noch einmal, wenn nichts vorbereitet ist.

| Ereignis | Knopf | Was passiert | Ergebnis am Abend des letzten Tags |
|---|---|---|---|
| Sturm (ab Stufe 3) | Sturmklar machen | Gäste von offenen Plätzen fahren auf freie Plätze innen (die Boote verholen sichtbar), offene Plätze bleiben bis nach dem Sturm für Gäste gesperrt (Schild "reserviert"). Gäste auf Tagestörn bleiben auf ihrem Platz. "Offene Plätze freigeben" hebt die Sperre auf. | wie viele innen lagen, wie viele draußen und ob sie schlechter bewerten (die Seenotretter mindern das) |
| Hanse-Woche (ab Stufe 5) | Plätze freihalten (ab zwei Tagen vorher) | 3 bis 4 große Plätze (für L und XL) bleiben bis zum Start leer, während des Fests nur für große Schiffe. Jedes zahlt einmal Festgeld (L 40 €, XL 90 €; Tagesabschluss: Sonstiges). Bei der Ankündigung zehn Tage vorher nur ein Hinweis, zwei Tage vorher die Karte mit Knopf. | wie viele große Schiffe auf den Plätzen lagen und das Festgeld, dazu die Bauten |
| Regatta (ab Stufe 3, mit Segelclub) | Plätze freihalten | 3 bis 6 freie Plätze (je Stufe) bleiben bis zum Start leer, während der Regatta legen dort nur Segelboote an. Jedes Segelboot darauf zahlt einmal Startgeld (S 8 €, M 15 €, L 25 €; Tagesabschluss: Sonstiges). "Plätze freigeben" hebt das auf. | wie viele Regattaboote auf den freigehaltenen Plätzen lagen und das Startgeld |

Während der Regatta und der Hanse-Woche fahren passende Boote bevorzugt auf die freigehaltenen Plätze (Hook `score` der Spielregeln, gilt für Selbst-Einfahren, Büro und die beste Box), sonst nähmen Segler erst andere freie Plätze und das Freihalten brächte nichts (Fund aus dem Feature-Test von PR 281). Ist kein passender Platz frei, sagt die Karte das und der Knopf steht im Wetterbericht, sobald einer frei wird. Die Zahlen auf der Karte (zum Beispiel wie viele Gäste offen liegen) bleiben live.

Ohne Vorbereitung passiert nichts Schlimmes: der Sturm kostet nur Anker bei den Gästen draußen, die Regatta läuft wie bisher. Zahlen: `ECONOMY.platzarten.stirn.offen`, `ECONOMY.ereignisse.regatta.vorbereiten`. Regeln als reine Funktionen in `web/js/events/vorbereiten.js` (Hooks `fit`, `evening`, `night` der Spielregeln), Karte und Knöpfe in `web/js/events/vorbereiten-ui.js`. Der Stand liegt in `state.modules.vorbereitung` und wird mitgespeichert.

Sim-Ereignisse (über `game.sim.dispatch`, also als `sim:<type>`): `relocated` mit `grund: 'sturm'` (die 3D-Ansicht fährt das Boot hinüber), `sturmklar`, `regattaPlaetze`, `ereignisErgebnis` `{ art, vorbereitet, verholt, draussen, anker }` bzw. `{ art, plaetze, teilnehmer, startgeld }`.

Berührungspunkte: Die Karte meldet sich am gemeinsamen Meldeplatz an (`game.meldungen.anmelden('#ev-vorbereiten', 'ereignis')`, Thread "Handy-Oberfläche neu und ruhig gestalten"); Morgen-Zettel und Dauerlieger mit Frist gehen vor. Steht das Nachspiel, wartet eine Ankündigung desselben Morgens dahinter. Dauerplätze (`features/dauerlieger.js`) bleiben unberührt, weil fest liegende Boote die Sperre nicht betrifft und freigehaltene Plätze nur aus freien Gastplätzen gewählt werden. Das Büro und das Selbst-Einfahren fragen die Passregel und meiden gesperrte Plätze von selbst. Die Wetterflagge zeigt den Sturm weiter wie bisher.

## Was schon wirkt

`main.js` lädt das Modul, `sim.js` fragt `game.events.modifiers()` jeden Morgen und Abend ab (siehe [spielregeln.md](spielregeln.md)). Das Modul folgt `game.state.day` und `game.state.phase` und speichert seinen Stand unter `game.state.modules.events`. Ohne Spielregeln läuft eine Ersatzuhr.

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/data/events.js` | alle Zahlen: Ereignisse, Standardwerte, Jahreslauf |
| `web/js/events/scheduler.js` | Planer, reine Logik ohne Three.js und DOM, läuft in Node |
| `web/js/events/events.js` | Anbindung an `game` (Modul für `main.js`) |
| `web/js/events/effects.js` | Regen, Schnee, Nebel, Blitze, Feuerwerk als ein Shader-Durchgang in der 3D-Szene (Netz `wetter-effekte`, Punkte `wetter-feuerwerk`) |
| `web/js/events/vorbereiten.js` | Vorbereiten für Sturm und Regatta: Regeln ohne DOM, läuft in Node |
| `web/js/events/vorbereiten-ui.js` | Karte `#ev-vorbereiten`, Knopf im Wetterbericht, Ergebnis am Abend |
| `web/js/events/banner.js` | Ankündigungsschild `#event-banner`, Wetterknopf `#weather-chip`, Wetterbericht `#weather-panel` |
| `web/css/events.css` | Aussehen, wird von `events.js` nachgeladen |
| `tests/ereignisse.test.mjs` | Tests |
| `tests/vorbereiten.test.mjs` | Tests zum Vorbereiten |

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
node --test tests/ereignisse.test.mjs tests/vorbereiten.test.mjs
```

```bash
bash tools/check-pages.sh web
```

Im Browser in der Konsole Tage vorspulen:

```js
for (let d = 1; d < 60; d++) hafenmeister.emit('day:start', { day: d, stage: 4 });
```


## Leistung der Wettereffekte (12.11.2026)

Bis dahin lag eine zweite 2D-Leinwand `#weather-fx` über dem Spiel, die jedes Bild neu gemalt
wurde (doppelte Pixeldichte, Nebel mit sechs großen Verläufen je Bild). Jedes Wetter außer
Sonne ließ das Spiel dadurch ruckeln. Außerdem lief sie mit dem Spieltempo, bei 8x sprangen
Regen und Schwaden.

Jetzt:
- Ein Dreieck über den ganzen Bildschirm (`renderOrder` 1e6, ohne Tiefentest, nicht antippbar)
  zeichnet Tönung, Nebel, Regen, Schnee und Blitz in einem Shader-Durchgang. Ist nichts zu
  sehen, wird es nicht gezeichnet.
- Feuerwerk sind höchstens 384 Punkte im selben Bild.
- Alle Bewegungen laufen nach echter Uhr, unabhängig von Pause und Tempo.
- Nebelwerte aus PR 91: Schleier 8 %, Rand 38 %, Schwaden 10 %, Mitte klar.
- `game.wetterEffekte.stand` und `.sofort()` zum Prüfen.
- 'weather' trägt zusätzlich `wetter` ('ruhig' | 'wind' | 'sturm') für den Ton.

Gemessen mit Software-Grafik (Bilder je Sekunde, Standardwetter zum Vergleich):

| Gerät, Stufe | Standard | Sturm vorher | Sturm nachher | Nebel vorher | Nebel nachher |
|---|---|---|---|---|---|
| Handy, 1 | 13,8 | 7,3 | 12,4 | 8,9 | 12,2 |
| Handy, 6 | 11,6 | 5,5 | 10,9 | 7,4 | 11,6 |
| PC, 1 | 7,6 | 5,6 | 6,6 | 6,1 | 7,1 |
| PC, 6 | 6,6 | 3,8 | 6,2 | 5,7 | 7,1 |

Hinweis für die Pixel-Fassung: Die Effekte sind ein `ShaderMaterial` und werden dort nicht
automatisch übernommen.
