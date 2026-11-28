# Ruhiger Abend und Serien-Akkord

Stand: 22.11.2026, Paket P46 (F29, F30, L1). Status: erledigt.

## Was der Spieler sieht und hört

### Ruhiger Abend (F29)

- An jedem Steg und am Kai hängen Lichterketten: dünne Pfosten an der Stegkante, dazwischen eine durchhängende Leitung mit Birnen. Tagsüber sind die Birnen aus.
- Ist am Abend **alles kassiert und sind alle versorgt**, gehen die Ketten an: vom Land nach außen, Birne für Birne, mit kurzem Aufblitzen. Warmweiß überwiegt, dazwischen rote, grüne, rosa und blaue Birnen. Je dunkler es wird, desto stärker der Schein. Weit herausgezoomt wird aus jeder Kette ein warmes Lichterband entlang des Stegs.
- Dazu klingen drei weiche Glockentöne mit einem warmen Akkord darunter, und die Musik wird wärmer: langsamer, Septakkorde, die Fläche hinter einem tieferen Filter, sparsamer gezupft.
- Die Ketten leuchten bis zum Morgen, auch wenn danach noch ein Boot einläuft. Am Morgen gehen sie in drei Sekunden aus, die Musik spielt wieder Tagesmusik.
- "Weniger Bewegung" (Einstellungen): die Birnen flackern nicht.

Wann "alles kassiert und alle versorgt" gilt:

| Bedingung | Warum |
|---|---|
| Der Spieltag steht im Abend | tagsüber kommen noch Boote |
| Mindestens ein Gast liegt im Hafen | ein leerer Hafen ist nicht ruhig, sondern leer (im Winter also nie) |
| Jeder Gast hat sein Liegegeld bezahlt | Münzen eingestrichen, über das Hafenhorn, "Alle kassieren" oder das Büro |
| Kein Boot wartet an einer Boje oder im Ankerfeld, für das eine passende Box frei ist | wer keinen Platz bekommen kann, wartet über Nacht; dafür kann der Hafenmeister nichts |

Fischer und Dauerlieger zahlen Pacht und zählen nicht mit. Kassieren in der Pause zählt sofort.

Entscheidungen (Jorven antwortet nicht, Thread entscheidet selbst):

- Kein Geld und kein Ruf als Belohnung. Der ruhige Abend ist Stimmung, keine weitere Pflicht; die Zahlen in `data/economy.js` bleiben unverändert, die Zeitraffer-Rechnung auch.
- Die Ketten hängen immer, nicht nur am ruhigen Abend. So sieht man tagsüber, dass da etwas angehen kann, und sie tauchen nicht aus dem Nichts auf.
- Keine Meldung im Meldeplatz: Lichter, Glocken und Musik sagen es. Menüs sollen wenig verdecken.
- Ein voller Hafen mit Wartenden, für die nichts frei ist, verhindert den ruhigen Abend nicht.

### Serien-Akkord (F30)

- Drei **passgenaue** Zuweisungen hintereinander ergeben einen Akkord. Passgenau heißt wie beim Tagesziel: die Box ist höchstens ein Fünftel länger als das Boot, und es gäbe größere freie Boxen (`sim.isSnug`).
- Es zählt, was der Spieler selbst entscheidet: ein Boot in eine Box ziehen oder einen Gast selbst umlegen. Büro, "Einfahren lassen" und Boote, die selbst einfahren, ändern die Serie nicht.
- Erste Zuweisung: ein Glockenton (Grundton), zweite: die Terz, dritte: der ganze Akkord nach oben gebrochen, danach klingt er weich aus. Der Grundton kommt aus dem Akkord, den die Musik gerade spielt, und bleibt für die ganze Serie gleich.
- Über der Box steigen eine, zwei oder drei goldene Pixelnoten auf; beim Akkord stehen drei Noten übereinander wie im Notensatz. Die Noten sitzen über der Box (dort ist der Finger), nicht über dem Boot, das vielleicht noch an der Boje liegt.
- Ohne Druck: keine Zeitgrenze, kein Zähler auf dem Bildschirm, kein Abzug. Eine Zuweisung, die nicht passgenau ist, fängt die Serie leise neu an.
- In Stufe 1 haben alle Boxen dieselbe Größe; dort gibt es nichts zu entscheiden und also keine Serie (gleiche Regel wie das Tagesziel "passgenau einweisen").

### Töne (L1)

| Anlass | Klang | Wo |
|---|---|---|
| Bewertung | `bewertung` (Anker steigen) | schon vorher, `ui/gaestebuch.js` |
| Tagesziel geschafft | `fertig` | schon vorher, `features/tagesziele.js` |
| Neues Bootsmodell im Logbuch | `hinweis` | schon vorher, `ui/logbuch.js` |
| Neue Ausbaustufe | `stufe` (Fanfare) | schon vorher, `audio.js` |
| **Neuer Stammgast** | `stammgast`, freundlicher Gruß | neu, `features/stimmung.js` |
| **Stufenziel erreicht** | `stufenziel`, kurzes Signal, leiser als die Fanfare | neu, einmal je Stufe (die Regeln melden `stageReady` jeden Morgen erneut) |

## Ausprobieren

- `https://hjorven.github.io/hafenmeister/?stufe=3&abend=jetzt` spult bis kurz vor den Abend. Alle Wartenden in eine Box ziehen und alle Münzen einstreichen, dann gehen die Lichter an. Auf dem iPhone ist der Ton erst nach der ersten Berührung an.
- Serie: ab `?stufe=2` drei Boote nacheinander in Boxen ziehen, die beim Antippen "passgenau" zeigen (beim Ziehen steht "passgenau" in der Vorschau über dem Boot).
- Alle Klänge einzeln: Tonprobe `js/audio/test.html` (`serie` mit `stufe` 1 bis 3, `abendruhe`, `stammgast`, `stufenziel`).

## Technik

- Regeln ohne Browser: `web/js/features/stimmung-regeln.js` (`abendStand(state, hatPlatz)`, `serieZaehlen(m, e)`, `stimmungState(state)`). Tests: `tests/stimmung.test.mjs`, im Browser `tests/specs/stimmung.spec.mjs`.
- Modul: `web/js/features/stimmung.js`, eine Zeile in `main.js`. Lichterketten aus `game.stege.gebaut()` (nur gebaute Teilstücke), neu bei `'stege'`. Pfosten als ein Mesh, Leitung als `LineSegments`, Birnen und Schein als zwei `Points` mit Farben je Birne (Schein mit Deckkraft je Birne, ohne Nebel). Alles ohne Strahltest (`raycast` leer), Antippen geht durch.
- Ton: `audio.setRuhig(an)` wählt abends `MUSIK.ruhig` (Fest und Sturm gehen vor, tagsüber nie). Neue Klänge in `SOUNDS`: `serie`, `abendruhe`, `stammgast`, `stufenziel`.
- Spielstand: `state.modules.stimmung = { serie, akkorde, ruhigeAbende, zielStufe }`, kaputte Werte werden beim Lesen geheilt. Kein neues `SAVE_VERSION` nötig (neues Feld unter `modules`).
- Schnittstelle: `game.stimmung = { stand(), an(), serie(), akkorde(), zuenden(), loeschen(), ketten() }`.
- Ereignisse: `'stimmung:ruhig' { tag }`, `'stimmung:serie' { boatId, schritt }`, `'stimmung:akkord' { boatId }`.

## Zusammenspiel und mögliche Kollisionen

- `ui/gesten.js` zeigt bei passgenauer Zuweisung "Passgenau +¼ Anker" über dem Boot; die Noten stehen darüber an der Box. Beide bleiben.
- `features/tagesziele.js` (Tagesziel "passgenau einweisen") und `features/erfolge.js` (Maßarbeit) zählen dieselben Zuweisungen weiter selbst.
- Zu Beginn des Abends schlägt die Schiffsglocke (`audio.js`, `ui/hafengesten.js`). Ist der Abend gleich ruhig (Büro kassiert selbst), klingen die Glockentöne des ruhigen Abends drei Sekunden später.
- Hafenfest (P38) mit Kapelle: die Festmusik geht vor der ruhigen Abendmusik. Sturm: Sturmmusik geht vor. Die Lichterketten gehen trotzdem an.
- Nachrüsten (P30): Steglaternen und Stromsäulen stehen an den Boxen, die Pfosten der Lichterkette an der Stegkante. An einzelnen Stellen können sie nah beieinander stehen.
- Fußgänger (`people/`) laufen auf der Stegmitte, die Pfosten stehen an der Kante.
- Wer künftig Stege anders zeichnet (`render/stege.js`), muss `gebaut()` mit `stege[].punkte`, `breite` und `bauart` beibehalten.
- Zeitraffer und Balancing: keine Wirkung auf Geld oder Ruf, die Rechnung bleibt gleich.
