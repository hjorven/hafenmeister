# Ton und Musik

Alles in diesem Ordner gehört zum Ton-Modul. Alle Klänge werden zur Laufzeit mit der Web Audio API im Browser erzeugt. Es gibt **keine Audiodateien**, also keine Lizenzfragen, nichts zu laden und fast keine Dateigröße.

| Datei | Inhalt |
|---|---|
| `audio.js` | Modul: Atmosphäre, Musik, Effekte, Lautstärke, Stummschalten |
| `audio.css` | Aussehen von Knopf und Regler-Feld (UI-Threads dürfen überschreiben) |
| `test.html` | Tonprobe: jeden Klang einzeln anhören, Tageszeit und Wetter umschalten |

Tonprobe lokal:

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000/js/audio/test.html` öffnen. Nach dem Deploy liegt sie unter `https://hjorven.github.io/hafenmeister/js/audio/test.html`.

## Was man hört

- **Hafen (Atmosphäre):** Wellen, Plätschern an Stegen, Wind, Möwen (tagsüber, abends seltener, nachts keine), klappernde Fallen an den Masten (mehr Boote = öfter), ab Stufe 4 ein fernes Schiffshorn, ab Stufe 5 die Glockentonne an der Ansteuerung, bei Sturm Regen und ferner Donner.
- **Musik:** ruhige, immer neu erzeugte Melodie im 6/8-Takt (Seemannslied-Stimmung) mit Flöte, gezupfter Begleitung, Fläche und Bass. Abends langsamer, nachts sparsam, bei Sturm in Moll. Nach 8 Takten Melodie folgen 8 Takte nur Begleitung, damit sie nicht nervt.
- **Effekte:** siehe Liste unten.

## Einbindung

`main.js` lädt `js/audio/audio.js` und ruft `init(game)` auf. Danach gibt es `game.audio`. Module ohne Import können auch Ereignisse senden.

```js
game.audio.sfx('muenze', { combo: 3, pan: -0.4 });   // gleich wie game.audio.play(...)
game.audio.horn('XL');                               // 'S', 'M', 'L', 'XL', 'XXL'
game.emit('sound', 'bauen');
game.emit('sound', { name: 'bewertung', anker: 4 });
game.emit('horn', { groesse: 'L', stoesse: 2 });
game.emit('weather', 'sturm');                       // 'ruhig', 'wind', 'sturm'
game.emit('harbor', { stufe: 3, boote: 14 });         // wie belebt es klingt
```

Optionen für jeden Effekt: `pan` (-1 links bis 1 rechts), `volume` (0 bis 1,5), `delay` (Sekunden).

**Darauf hört das Modul von selbst**

| Ereignis | Reaktion |
|---|---|
| `phase` (`'tag'`, `'abend'`, `'nacht'`) | Musik und Hafen wechseln die Stimmung, beim Wechsel Tag zu Abend schlägt die Schiffsglocke. `body[data-phase]` wird ebenfalls gelesen. |
| `stufe` | Hafen klingt größer, beim Aufstieg die Fanfare `stufe` (nicht beim Laden) |
| `pause` | Musik und Hafen werden leiser, Effekte bleiben |
| `ui:mute` | ohne Daten umschalten, mit `true`/`false` oder `{ stumm }` gezielt |
| `ui:collect` mit `{ horn: true }` | Hafenhorn |
| `ui:tow`, `ui:tow-end` | nichts, die Gesten-Module rufen ihre Klänge selbst auf |

**Knopf:** `init` legt einen Knopf „Ton“ (`#btn-sound`) in `#hud-top`, der Stummschalter und Regler öffnet. Wer den Knopf selbst bauen will, ruft `init(game, { button: false })` auf und nutzt `game.audio.createPanel()` oder `game.audio.toggleMute()`.

**Regler:** `setVolume(bus, 0..1)` mit `bus` = `'master'`, `'musik'`, `'atmo'` (Hafen), `'effekte'`. Musik und Effekte sind getrennt regelbar. Einstellungen bleiben im Browser gespeichert (`localStorage`, Schlüssel `hafenmeister.audio.v1`).

## Effekte

| Name | Wofür | Optionen |
|---|---|---|
| `klick` | Antippen allgemein | |
| `auswahl` | Boot ausgewählt | |
| `abbrechen` | Auswahl aufgehoben | |
| `platz` | Platz zugewiesen | |
| `leine-greifen` | Boot an der Leine greifen | |
| `leine-einrasten` | Finger über einem passenden Platz | |
| `anlegen` | Boot liegt fest (Fender, Wasser, Leine) | |
| `ablegen` | Boot fährt los (Außenborder) | |
| `platsch` | etwas fällt ins Wasser | |
| `muenze` | eine Münze | `combo`: Nummer im Strich, Ton steigt |
| `strich-ende` | Münzstrich beendet | `anzahl`: Münzen im Strich |
| `kasse` | alles auf einmal kassiert | |
| `hafenhorn` | Signalhorn des Hafenbüros (Kassieren) | `lang` |
| `bauen` | Hämmern | |
| `fertig` | Bau fertig | |
| `stufe` | neue Ausbaustufe | |
| `bewertung` | Gast bewertet | `anker`: 1 bis 5 |
| `abgelehnt` | Boot fährt weiter | |
| `fehler` | geht nicht | |
| `hinweis` | Tutorial-Hinweis | |
| `glocke` | Schiffsglocke | `schlaege`: 1 bis 8 |
| `horn` | Schiffshorn | `groesse`, `stoesse`, `kurz` |
| `vorspulen-start`, `vorspulen-ende` | Zeit vorspulen über die Tempo-Knöpfe (3x, 8x) oder Taste F | |
| `sturmwarnung` | Sturm angekündigt | |
| `regatta` | Startschuss | |
| `seenot` | Seenotretter läuft aus | |

## Handy und Tablet

- Browser spielen Ton erst nach einer Berührung. Das Modul hört dafür auf die erste Berührung oder Taste. Effekte, die im selben Moment ausgelöst werden, werden kurz gemerkt und nachgeholt.
- Geht die Seite in den Hintergrund (App-Wechsel, Bildschirmsperre), hält der Ton an und spart Akku. Danach läuft er weiter, auf iOS spätestens nach der nächsten Berührung.
- Auf dem iPhone respektiert der Ton den Lautlos-Schalter und lässt eigene Musik (z.B. Spotify) weiterlaufen.
- Tiefe Töne (Bass, große Hörner) sind auf Handy-Lautsprechern leise, mit Kopfhörern voll.
