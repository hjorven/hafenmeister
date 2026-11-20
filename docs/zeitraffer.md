# Zeitraffer: das ganze Spiel automatisch durchspielen

Ein Lauf öffnet das echte Spiel im Browser (Playwright, Chromium mit Software-Grafik), lässt es stark beschleunigt von Stufe 1 bis zum Ziel von Stufe 6 laufen, macht regelmäßig Bildschirmfotos und prüft dabei alles, was im Spiel stören kann. Ergebnis ist ein Bericht mit Fehlerliste und Bildern.

Wofür: Nach jedem größeren Merge zeigt ein Lauf, ob alles Bestehende noch zusammen funktioniert. Er ersetzt nicht `bash tests/pruefen.sh` (Pflicht vor jedem Merge), sondern ergänzt es um einen langen Lauf durch alle Stufen.

## Befehle

Einmalig (installiert Playwright und Three.js für die Tests):

```bash
cd tests && npm ci && cd ..
```

Ein Lauf am PC und einer am Handy, danach der Bericht (im Hauptordner des Repos):

```bash
node tools/zeitraffer/lauf.cjs --geraet pc --minuten 120 --out /tmp/zeitraffer
node tools/zeitraffer/lauf.cjs --geraet handy --minuten 120 --out /tmp/zeitraffer
node tools/zeitraffer/bericht.cjs /tmp/zeitraffer
```

Der Bericht steht dann in `/tmp/zeitraffer/bericht.md` und `/tmp/zeitraffer/bericht.html` (Bilder in `/tmp/zeitraffer/bilder/`). Mit `--einbetten` am Ende des letzten Befehls landen alle Bilder in der HTML-Datei, dann ist sie allein weitergebbar.

Die Läufe können gleichzeitig laufen, werden dann aber jeder langsamer.

Mehrere Läufe, zum Beispiel je Geländeform ein Unterordner (`--out /tmp/zr-serie/gelaende-3` mit `--gelaende 3 --landbild 3`), fasst eine Tabelle zusammen:

```bash
node tools/zeitraffer/uebersicht.cjs /tmp/zr-serie
```

Sie steht dann in `/tmp/zr-serie/uebersicht.md`.

## Optionen von lauf.cjs

| Option | Standard | Bedeutung |
|---|---|---|
| `--geraet` | `pc` | `pc` (1440 x 900), `handy` (Pixel 7), `handyquer`, `tablet` |
| `--tempo` | `500` | Spielzeit je Sekunde Echtzeit (Testschalter `?testtempo=`) |
| `--minuten` | `120` | Höchstdauer in Echtzeit (ein ganzes Spiel braucht rund 115 Minuten) |
| `--bild` | `10` | alle n Sekunden ein Bildschirmfoto |
| `--stufe` | `1` | Startstufe. 1 = neues Spiel. Ab 2 Testmodus `?stufe=n`, der nicht speichert, darum entfällt dann die Speicherprüfung |
| `--bis` | `6` | Lauf endet, wenn diese Stufe erreicht und ihr Ziel erfüllt ist |
| `--gelaende`, `--seed`, `--stegbild`, `--landbild` | | werden an die Adresse gehängt (`?gelaende=n`, `?seed=s`, `?stegbild=n`, `?landbild=n`) |
| `--web` | `web` | Ordner mit dem Spiel. Für Läufe gegen `main`, während man selbst arbeitet: `git archive origin/main web \| tar -x -C /tmp/zr-main` und `--web /tmp/zr-main/web` |
| `--out` | `/tmp/zeitraffer` | Ausgabeordner |

## Der Testschalter `?testtempo=`

`web/js/core/game.js` liest `?testtempo=n` aus der Adresse. Ohne den Parameter ändert sich am Spiel nichts, im Spiel gibt es dafür keinen Knopf. Mit dem Parameter läuft die Spielzeit n-mal so schnell wie bei 1x. Die Spielzeit eines Bildes wird in Schritte von höchstens 0,8 s geteilt (so viel wie ein Bild bei 8x), damit Boote, Menschen und Regeln dieselben Schritte sehen wie im normalen Spiel. Höchstens 120 Schritte je Bild, damit die Seite bedienbar bleibt. Reicht die Rechenzeit nicht, läuft das Spiel langsamer als verlangt. Im Container mit Software-Grafik erreicht 500 etwa 400-fach in Stufe 1 und 150-fach in Stufe 6; ein ganzes Spiel dauert seit dem 5-Minuten-Tag (PR 331: Tag 270 s plus 30 s Abend, Saison 16 + 2 Tage, etwa 100 Spieltage bis zum Ende der Region) rund 115 Minuten an einem Gerät, weil je Spieltag 2,5-mal so viele Boote kommen wie vorher. Bildschirmfotos halten das Spiel kurz an; bleibt eines 90 s hängen, steht das als Fehler im Bericht, der Lauf geht weiter.

## Wer spielt

Ein einfacher Bot über `game.sim` und `game.services`, wie der Spielertyp "geschickt" in `tools/balance.mjs`: Er kassiert jede Münze sofort, kauft jeden Morgen das Sinnvollste (Stege zuerst, dann Hafenbüro, Bauwerke, Services, in der letzten Stufe Services zuerst), spart, wenn für die nächste Stufe nur Geld fehlt, und baut die nächste Stufe wie ein Mensch über das Bauen-Menü (`game.bauen`) aus: Hat der Ausbau mehrere Bauabschnitte, bezahlt er einen je Morgen, sobald das Geld für diesen Abschnitt reicht, und kauft dazwischen nur Dringendes, das höchstens ein Zehntel des Abschnitts kostet (wie `tools/balance.mjs` seit PR 361). Im Bericht stehen die Abschnitte als Kauf `abschnitt` mit `Stufe:Nr/Zahl`. Boote weist er nicht zu, sie fahren selbst ein (Selbst-Einfahren nach 8 s). Die Bedienung über Knöpfe und Gesten prüfen die Tests in `tests/specs/`, nicht dieser Lauf.

## Was geprüft wird

| Prüfung | Wie |
|---|---|
| Konsole | Jede Fehlermeldung, jeder Skriptfehler und jede fehlende Datei, mit Stufe und Tag |
| Boot über Land | Mindestens 2 von 7 Rumpfpunkten (85 % der Größe) liegen laut `game.landschaft.istWasser` auf Land |
| Boot durch Steg | Strahl von oben trifft `game.stege.group` an einem Rumpfpunkt (ein Punkt ist beim Festmachen erlaubt) |
| Boote ineinander fest | Rümpfe überlappen und eines steht seit 30 Spielsekunden still, obwohl es fährt |
| Boote überlappen | Zwei festgemachte Boote überlappen ("liegend"), oder zwei Boote berühren sich kurz in Fahrt, ohne festzustecken ("in Fahrt berührt", mit `+durchlass`, wenn eines gerade durchgelassen wird). Die Übersicht zählt beides getrennt |
| Boot hängt | Boot ist in Fahrt, bewegt sich aber seit 5 Spielminuten nicht |
| Pulk | 12 oder mehr fahrende Boote (nicht liegend, nicht an der Boje) im Umkreis von 45 m, auch wenn sich jedes noch langsam bewegt. Je Spieltag ein Eintrag mit der größten Zahl und den Zuständen (zum Beispiel "22 leaving, 4 docking") |
| Zu lange unterwegs | Ein- oder Auslaufen dauert innerhalb von 100 m um die Stege länger als 10 Spielminuten (lange Wege über die offene See zählen nicht) |
| Spielregeln | Boot wartet, kommt aber nicht an der Boje an, bis fast die Notbremse greift (90 % von `anfahrtMaxAnsicht`, also 540 Spielsekunden; die Anfahrt von See darf je nach Hafengröße Minuten dauern); Box bleibt nach der Abfahrt länger als 120 Spielsekunden belegt (Ablegen dauert seit PR 327 höchstens rund 50 s); Geld keine Zahl oder negativ. Bis P87 galten 400 s für beides, das passte zum 90-s-Tag, ist mit dem 5-Minuten-Tag aber für die Box zu lang und für die Anfahrt zu kurz |
| Aufstieg und Geld | Tag jedes Aufstiegs gegen die Erwartung aus `tools/balance.mjs --spieler zeitraffer` (Stand PR 331: Stufe 2 / 3 / 4 / 5 / 6 an Tag 6 / 18 / 38 / 60 / 85, Ende an Tag 103), Fund bei weniger als 40 % oder mehr als 200 %; fehlgeschlagene Käufe, Geldverlauf |
| Speichern und Laden | Nach jedem Aufstieg, an Tag 10 und dann jede Saison (16 Spieltage): speichern, mit fast angehaltener Zeit (`?testtempo=0.001`) neu laden, Stufe, Tag, Geld, Gäste, Hafenbüro, Bauwerke, Stege, Services, Ereignis und liegende Boote vergleichen. Mehr Geld nach dem Laden ist erlaubt: Boote auf dem Weg in ihre Box liegen sofort fest und zahlen |
| Logbuch | Welche Bootsmodelle in der ganzen Partie mindestens einmal angelegt haben (`state.logbook`, wie das Logbuch zählt), Stand je Stufe und am Ende, fehlende Modelle mit Größe und Grund. Fehlt ein XXL-Modell, steht das in der Fehlerliste |
| Wetter | Welche Ereignisse vorkamen (Nebel, Sturm, Regatta, Winter ...) und die Bildrate je Ereignis |

Jeder Fund bekommt beim ersten Mal ein Nahbild mit rotem Kreis (höchstens zwei je Art und Stufe). Die Prüfungen für Land, Steg und Ineinander stammen aus der Messlatte des Threads "Jedes neue Feature einzeln testen" (`/mnt/project-files/feature-tests/messlatte/`); dort gibt es auch Einzelprüfungen je Stegbild und für feste Wege.

## Grenzen

- Bildrate und "zu langsam" sagen mit Software-Grafik wenig über echte Geräte. Vergleiche zwischen Wetterlagen sind trotzdem brauchbar.
- Wasser und Land zählen nur, wo Rechnung und Bild übereinstimmen (Abschnitt "Bild und istWasser"). Ein Boot, das im Bild knapp über einer Sandbank unter einer Rasterzelle Breite fährt, fällt darum nicht auf; dafür gibt es `wasserbild.cjs`.
- Der Bot spielt immer gleich. Ob das Spiel für Menschen gut läuft, zeigt nur ein Spieltest.

## Bild und istWasser

`game.landschaft.istWasser(x, z)` rechnet die Geländeformel (`punkt()` in `render/landschaft/gelaende.js`) an jeder Stelle genau aus. Gezeichnet wird ein Netz aus dieser Formel mit 2 bis 3 m Rasterabstand (`terrain.js`, Qualität mittel 2,6 m), flache Flächen zusammengefasst, Zellen ganz unter Wasser weggelassen, darüber die Wasserfläche. Am Ufer weichen beide darum um bis zu eine Rasterzelle ab, und Dinge schmaler als eine Zelle (Sandbank, Riss) stehen nur in der Rechnung.

Darum zählen Zeitraffer und Härtetest seit P87 "Boot über Land" und "Großschiff über Land" nur, wo Rechnung **und** Bild Land zeigen, und "Mensch im Wasser" nur, wo beide Wasser zeigen. Das Bild liefert `tools/zeitraffer/bildwasser.cjs` (`window.__bildWasser(x, z)`, liest das gezeichnete Netz, wird per `addInitScript` in jede Seite gelegt).

Messung über alle Küsten und Stufen (rund 5 Minuten):

```bash
node tools/zeitraffer/wasserbild.cjs --kuesten 1-15 --stufen 3-6
```

Sie vergleicht Rechnung und Bild im Meterraster über Durchstich, Hafenbereich und die Pflicht-See vor der Einfahrt und meldet jede strittige Stelle, die mehr als `--grenze` Meter (Standard 3, etwa eine Rasterzelle) vom gezeichneten Ufer entfernt liegt. Exit-Code 1 bei solchen Stellen.

Ergebnis 15.11.2026 (P87, `main` 5dce72f, 15 Küsten, Stufe 3 bis 6, je 74.000 Proben):

| Fläche | strittig | weiter als 3 m vom Ufer |
|---|---|---|
| Durchstich | 1 bis 4 % (nur Uferkante, höchstens 2,3 m) | nirgends |
| See vor der Einfahrt | unter 0,6 % | nirgends |
| Hafenbereich | 0,8 bis 1,5 % | drei Stellen, alle schmaler als eine Rasterzelle (unten) |

Der alte Messlatte-Befund ("am Durchstich zeigt das Bild Wasser, istWasser Land", vor dem Geländeneubau vom 13.11.) besteht damit nicht mehr. Die drei Stellen stehen in `docs/arbeitsplan.md` unter "Bekannte Fehler" (Gelände):

1. Stufe 6, alle Küsten: In der Rechnung ein rund 0,5 m breiter Riss mit Wasser (-1,2 m) zwischen zwei Landflächen (1,3 m und 0,6 m hoch) bei Plan-y 196, x -170 bis -27 (Welt z -121,5). Das Bild zeigt Land. Für Menschen und Wege an Land kann das ein unsichtbarer Graben sein.
2. Küste 3 (Flussmündung), Stufe 3 bis 6: In der Rechnung eine 1,5 m breite Sandbank (+0,3 m) im Hafenwasser bei Welt x -40 bis -36, z -106 (Plan y 171). Das Bild zeigt Wasser. Boote, die ihr nach der Karte ausweichen, weichen einem unsichtbaren Hindernis aus.
3. Küste 10 (Inselhafen), Stufe 3 bis 6: ein einzelner Punkt Land in der Rechnung bei Welt x -105, z -43, im Bild Wasser.

