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
node tools/zeitraffer/lauf.cjs --geraet pc --minuten 40 --out /tmp/zeitraffer
node tools/zeitraffer/lauf.cjs --geraet handy --minuten 40 --out /tmp/zeitraffer
node tools/zeitraffer/bericht.cjs /tmp/zeitraffer
```

Der Bericht steht dann in `/tmp/zeitraffer/bericht.md` und `/tmp/zeitraffer/bericht.html` (Bilder in `/tmp/zeitraffer/bilder/`). Mit `--einbetten` am Ende des letzten Befehls landen alle Bilder in der HTML-Datei, dann ist sie allein weitergebbar.

Die Läufe können gleichzeitig laufen, werden dann aber jeder langsamer.

## Optionen von lauf.cjs

| Option | Standard | Bedeutung |
|---|---|---|
| `--geraet` | `pc` | `pc` (1440 x 900), `handy` (Pixel 7), `handyquer`, `tablet` |
| `--tempo` | `500` | Spielzeit je Sekunde Echtzeit (Testschalter `?testtempo=`) |
| `--minuten` | `60` | Höchstdauer in Echtzeit |
| `--bild` | `10` | alle n Sekunden ein Bildschirmfoto |
| `--stufe` | `1` | Startstufe. 1 = neues Spiel. Ab 2 Testmodus `?stufe=n`, der nicht speichert, darum entfällt dann die Speicherprüfung |
| `--bis` | `6` | Lauf endet, wenn diese Stufe erreicht und ihr Ziel erfüllt ist |
| `--gelaende`, `--stegbild`, `--landbild` | | werden an die Adresse gehängt (`?gelaende=n`, `?stegbild=n`, `?landbild=n`) |
| `--web` | `web` | Ordner mit dem Spiel. Für Läufe gegen `main`, während man selbst arbeitet: `git archive origin/main web \| tar -x -C /tmp/zr-main` und `--web /tmp/zr-main/web` |
| `--out` | `/tmp/zeitraffer` | Ausgabeordner |

## Der Testschalter `?testtempo=`

`web/js/core/game.js` liest `?testtempo=n` aus der Adresse. Ohne den Parameter ändert sich am Spiel nichts, im Spiel gibt es dafür keinen Knopf. Mit dem Parameter läuft die Spielzeit n-mal so schnell wie bei 1x. Die Spielzeit eines Bildes wird in Schritte von höchstens 0,8 s geteilt (so viel wie ein Bild bei 8x), damit Boote, Menschen und Regeln dieselben Schritte sehen wie im normalen Spiel. Höchstens 120 Schritte je Bild, damit die Seite bedienbar bleibt. Reicht die Rechenzeit nicht, läuft das Spiel langsamer als verlangt. Im Container mit Software-Grafik erreicht 500 etwa 400-fach in Stufe 1 und 150-fach in Stufe 6; ein ganzes Spiel (etwa 250 Spieltage) dauert so 5 bis 15 Minuten.

## Wer spielt

Ein einfacher Bot über `game.sim` und `game.services`, wie der Spielertyp "geschickt" in `tools/balance.mjs`: Er kassiert jede Münze sofort, kauft jeden Morgen das Sinnvollste (Stege zuerst, dann Hafenbüro, Bauwerke, Services, in der letzten Stufe Services zuerst), spart, wenn für die nächste Stufe nur Geld fehlt, und steigt auf, sobald es geht. Boote weist er nicht zu, sie fahren selbst ein (Selbst-Einfahren nach 8 s). Die Bedienung über Knöpfe und Gesten prüfen die Tests in `tests/specs/`, nicht dieser Lauf.

## Was geprüft wird

| Prüfung | Wie |
|---|---|
| Konsole | Jede Fehlermeldung, jeder Skriptfehler und jede fehlende Datei, mit Stufe und Tag |
| Boot über Land | Mindestens 2 von 7 Rumpfpunkten (85 % der Größe) liegen laut `game.landschaft.istWasser` auf Land |
| Boot durch Steg | Strahl von oben trifft `game.stege.group` an einem Rumpfpunkt (ein Punkt ist beim Festmachen erlaubt) |
| Boote ineinander fest | Rümpfe überlappen und eines steht seit 30 Spielsekunden still, obwohl es fährt |
| Liegende Boote überlappen | Zwei festgemachte Boote überlappen |
| Boot hängt | Boot ist in Fahrt, bewegt sich aber seit 5 Spielminuten nicht |
| Spielregeln | Boot wartet, kommt aber 400 Spielsekunden lang nicht an der Boje an; Box bleibt nach der Abfahrt 400 Spielsekunden belegt; Geld keine Zahl oder negativ |
| Aufstieg und Geld | Tag jedes Aufstiegs gegen die Erwartung aus `tools/balance.mjs`, fehlgeschlagene Käufe, Geldverlauf |
| Speichern und Laden | Nach jedem Aufstieg und alle 40 Spieltage: speichern, ohne Zeitraffer neu laden, Stufe, Tag, Geld, Gäste, Hafenbüro, Bauwerke, Stege, Services, Ereignis und liegende Boote vergleichen |
| Wetter | Welche Ereignisse vorkamen (Nebel, Sturm, Regatta, Winter ...) und die Bildrate je Ereignis |

Jeder Fund bekommt beim ersten Mal ein Nahbild mit rotem Kreis (höchstens zwei je Art und Stufe). Die Prüfungen für Land, Steg und Ineinander stammen aus der Messlatte des Threads "Jedes neue Feature einzeln testen" (`/mnt/project-files/feature-tests/messlatte/`); dort gibt es auch Einzelprüfungen je Stegbild und für feste Wege.

## Grenzen

- Bildrate und "zu langsam" sagen mit Software-Grafik wenig über echte Geräte. Vergleiche zwischen Wetterlagen sind trotzdem brauchbar.
- `istWasser` und das Bild stimmen am Durchstich nicht überall überein (siehe Messlatte). Funde "über Land" im Nahbild nachsehen.
- Der Bot spielt immer gleich. Ob das Spiel für Menschen gut läuft, zeigt nur ein Spieltest.
