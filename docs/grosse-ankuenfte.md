# Große Ankünfte (P47, F31)

Stand: 22.11.2026. Status: gebaut. Code: `web/js/features/grosse-ankunft.js`, Tests `tests/grosse-ankunft.test.mjs`
und `tests/specs/grosse-ankunft.spec.mjs`.

Wenn ein großes Schiff einläuft, wird das ein kleines Ereignis: Das Schiff tutet, eine kurze Meldung sagt, wer
kommt, und die Kamera fährt kurz hin und wieder zurück. Die Kamera stört dabei nie: Sie fährt nur, wenn der Spieler
gerade nichts tut, und jede Berührung beendet die Fahrt.

## Welche Schiffe

| Schiff | Woher | Horn |
|---|---|---|
| Kreuzfahrtschiff | Kreuzfahrtterminal (Besuch, `render/services-besuch.js`) | XXL, ein langer Ton |
| Flottenbesuch (Korvette, Minenjagdboot) | Marineanleger | XXL, zwei kurze |
| Windjammer (drei Traditionssegler) | Museumshafen | XL, zwei kurze |
| Weltumsegler, Museumsdampfer, Forschungskutter, Königsyacht | Seltene Besucher (P40, `boat.besucher`) | M bis XL je Schiff |

Ein Besuch mit mehreren Schiffen (Flotte, Windjammer) zählt als eine Ankunft: Das erste Schiff führt.
Nicht dabei: das tägliche Ausflugsschiff (kommt jeden Tag, wäre bald lästig) und Gastboote der Größe XL (zu häufig
in Stufe 5 und 6). Entschieden in diesem Paket, weil Jorven nicht gefragt werden soll.

## Wann

- Dienste-Besuche: sobald das Schiff in den Spielbereich (`game.gelaende.spielRect()`) einläuft. Im Seehafen sind
  das beim Kreuzfahrtschiff rund 20 Sekunden bei normalem Tempo, bevor es fest ist.
- Seltene Besucher: Gastboote reisen lange über See an. Angesagt wird an der Einfahrt ins Revier (`boat:im-revier`,
  danach springt das Boot ungesehen bis kurz vor den Bildrand) oder sobald es im Bild ist.
- Nach dem Laden: Ein Schiff, das schon fast am Platz ist, tutet nicht mehr. Jede Ankunft tutet je Tag einmal.

## Kamerafahrt

- Weich hin (1,8 s), 5 s mitfahren, weich zurück (1,6 s) an die alte Stelle und den alten Zoom. Drehung und
  Neigung bleiben. Die Breite zeigt das Schiff mit Wasser drumherum (dreifache Länge, mindestens 110 m; Windjammer 220 m, damit mehr als ein Segler im Bild ist).
- Von selbst nur, wenn: Einstellung "Mit Kamera", Seite sichtbar, nicht angehalten, kein Finger auf dem
  Bildschirm, 4 s keine Eingabe, nicht im Bauen, keine Karte offen, nicht im Fotomodus (außer "Hafen schauen"),
  kein Schritt des Einstiegs, kein Boot gewählt, keine andere Kamerafahrt, höchstens eine je Minute und keine
  wichtige Meldung (Vorrang ab 60, z. B. Notruf, Tagesabschluss, Feier). Sonst steht nur die Meldung mit "Ansehen".
- Jede Berührung, jedes Mausrad und jede Taste beenden die Fahrt sofort; die Kamera bleibt dann, wo sie ist.
  "Zurück" in der Meldung bringt die Kamera an die alte Stelle, auch nach "Ansehen".
- "Hafen schauen": Der Rundflug ruht während der Fahrt und läuft danach weiter (`features/hafen-schauen.js`).
- Das Tempo ändert sich nie von selbst.

## Meldung

`#hm-ankunft` im Meldeplatz, Vorrang `ankunft` 53 (unter Ankündigungen 55, über dem Einstieg 50). Steht 9 s
sichtbare Zeit; während der Kamerafahrt läuft die Zeit nicht. Wartet sie hinter einer anderen Meldung, bis das
Schiff längst liegt, entfällt sie.

## Einstellung

Einstellungen, "Große Ankünfte": Mit Kamera (Standard), Nur Horn, Aus. Gilt je Gerät
(`game.einstellungen.wert('ankuenfte')`). Mit "Aus" gibt es weder Horn noch Kamerafahrt, die Meldung bleibt.

## Schnittstellen

- `render/services-besuch.js` sendet `'besuch:einlaufen' { id, art, modell, laenge, gruppe, amPlatz() }`, wenn ein
  Besuchsschiff draußen mit dem Einlaufen beginnt.
- `game.ankunft = { laeuft, ansehen(key?), zurueck(), aktuelle(), meldung(), lage(), probe(art) }`.
- Ereignisse: `'ankunft:angesagt' { key, titel, kamera }`, `'ankunft:kamera' { key, an, auto }`. P43
  (Fotoaufträge) kann darauf aufbauen, z. B. "Fotografiere das einlaufende Kreuzfahrtschiff".
- Horn über `game.emit('horn', { groesse, stoesse, kurz, pan })` (Audio-Modul, links/rechts nach Lage im Bild).

## Ausprobieren

- `?stufe=6&services=alle&ankunft=kreuzfahrt` (auch `flottenbesuch`, `windjammer`): Besuch heute, Ankunft nach
  rund 20 s.
- `?stufe=5&besucher=koenigsyacht`: Königsyacht kommt heute.

## Kollisionen mit anderen Teilen

- Andere Kamerafahrten (Meldungen mit "Zeigen", Einstieg, Besucher-Foto): Läuft schon eine (`camera._fly`), fährt
  die Ankunft nicht von selbst. Startet eine andere während der Fahrt, gewinnt die zuletzt gesetzte; die Ankunft
  kehrt danach nicht mehr zurück, wenn eine Eingabe dazwischen war.
- P40 Besucher: eigene Meldung am Morgen (Funk) und am Ehrenplatz; diese Ankunft-Meldung kommt dazwischen beim
  Einlaufen. Beide im Meldeplatz, nie gleichzeitig.
- P43 Fotoaufträge: soll die Ereignisse oben nutzen und keine zweite Kamerafahrt bauen.
- P46 Ruhiger Abend: Horn kommt über das Audio-Modul und folgt dessen Lautstärke und Stummschaltung.
- Kamera-Test `kamera.spec.mjs` lädt Stufe 1 ohne Besuche, dort fährt nichts.
