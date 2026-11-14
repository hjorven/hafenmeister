# Anmeldung per Funk

Paket P28 der [Roadmap](roadmap.md) (F2, E8). Baut auf der Funk-Vorschau aus P11 auf ([vorschau.md](vorschau.md)).
Regeln: `web/js/sim.js` (Abschnitt "Anmeldung per Funk"), Oberfläche: `web/js/ui/funk-anmeldung.js`,
Funk-Liste: `web/js/ui/vorschau.js`, Zahlen: `ECONOMY.funkAnmeldung` in `web/js/data/economy.js`,
Test ohne Browser: `tests/funk-anmeldung.test.mjs`.

## Was der Spieler sieht

Ab der ersten Stufe des Hafenbüros ("Hafenmeister mit Funk", `schaltetFrei: 'anmeldung'`) melden sich
jeden Morgen ein bis zwei der heute erwarteten Gäste per Funk an. Eine Meldung nennt Bootsname, Art, Länge,
ungefähre Ankunftszeit und Wünsche:

> Funk: „Holm“ meldet sich an
> Sportkielboot, 8 m, gegen 16:40, möchte Strom und Grillplatz. Box frei halten? Bonus 11 €.
> [Box C11 freihalten] [Andere] [Nein]

- Die angebotene Box leuchtet gold im Hafen. Es ist die beste passende Box (erfüllte Platz-Wünsche wie Strom,
  Komfort, möglichst knapp), frei oder gerade beim Ablegen eines abreisenden Gastes.
- **Andere** zeigt die nächstbeste Box und fährt die Kamera hin.
- **Freihalten**: Die Box zeigt am Schild rot (reserviert), die Kamera fährt hin, die Meldung bestätigt
  "Box C11 ist frei gehalten" mit dem Bonus. Danach kann man die Box noch tauschen (Andere) oder freigeben.
- **Nein**: Das Boot kommt wie jedes andere an die Warteboje.
- Ohne Antwort verschwindet die Meldung nach 25 Sekunden sichtbarer Zeit. Im Funk rechts stehen angemeldete
  Boote blau gestrichelt mit "angemeldet", mit frei gehaltener Box gold mit "Box C11". Antippen öffnet die Meldung wieder.

**Kommt das Boot**, fährt es ohne Halt an der Boje direkt in seine Box, auch wenn alle Bojen belegt sind.
Es zahlt sofort einen Bonus (halbes Liegegeld einer Nacht ohne Wünsche, im Tagesabschluss unter Liegegeld
"Bonus für frei gehaltene Boxen") und gibt beim Abreisen einen Viertelanker mehr. Ist es fest, steigt über ihm
"Box frei gehalten: +11 €" auf.

**Der Preis:** Bis das Boot da ist, passt kein anderes Boot in die Box. Wer am Nachmittag einen vollen Hafen
hat, verliert vielleicht einen anderen Gast. Das ist die Entscheidung.

## Regeln im Einzelnen

| Fall | Was passiert |
|---|---|
| Anmeldung | morgens beim Tagesbeginn, nur ab Büro-Stufe 1, nicht im Winter, nur Boote mit Ankunft ab 35 % des Tages (etwa 12 Uhr, nach den Morgenabreisen); 40 % der Tage zwei Boote |
| Zufall | Auswahl aus Seed und Tag, verbraucht keinen Spielzufall: Spielstände und Balancing bleiben gleich |
| Box noch belegt bei Ankunft (Gast legt noch ab) | Boot wartet an der Boje, Geduld läuft nicht ab, Büro-Automatik und Selbst-Einfahren lassen es in Ruhe, es fährt hinein, sobald die Box frei ist |
| Spieler zieht das Boot in eine andere Box | Reservierung verfällt, kein Bonus |
| Freigeben | Box wieder frei, keine Folgen für die Bewertung |
| Abweisen an der Boje | wie bei jedem Boot; Reservierung verfällt |
| Abend | Reservierungen für Boote, die nicht mehr kommen, verfallen |
| Stufenausbau | Reservierung auf einem Platz, den es nicht mehr gibt (oder an den das Boot nicht mehr passt), verfällt |
| Dauerplatz vermieten | geht nicht für eine frei gehaltene Box ("heute für ein angemeldetes Boot frei gehalten") |
| Speichern und Laden | Anmeldung (`boat.funk`) und Box stehen im Spielstand am Boot, nichts geht verloren, nichts doppelt |
| Hafen schauen, Leitstelle | nehmen die frei gehaltene Box keinem anderen Boot und weisen das angemeldete nicht woanders hin |
| Tempo | ändert sich nie von selbst |

## Schnittstelle

- Spielstand: `boat.funk = { platz: 'C11' | null, kept?: true, bonus?: 11 }` an Booten in `state.upcoming` und `state.boats`.
- sim.js: `announcementsOpen`, `announcedBoats`, `reservedFor(platz)`, `reservableBerths(boot)`, `reserveBerth(boot, platz?)`,
  `releaseBerth(boot)`, `reservationBonus(boot)`; `hookWhyNotFit` gibt `'funk'` für eine fremde frei gehaltene Box.
- Ereignisse: `sim:announced { boatIds }`, `sim:reserved { boatId, berthId }`, `sim:reservationReleased { boatId, berthId, reason }`
  (`moved`, `released`, `elsewhere`, `dismissed`, `patience`, `queueFull`, `evening`, `rebuild`),
  `sim:reservationKept { boatId, berthId, amount }`; `sim:arrived` hat `direct: true, reserved: platz`.
- Bewertung: `ratingParts(...).funk` (rules.funk.rating).
- Brücke (`game.sim`): `anmeldungFrei()`, `angemeldet()`, `freihaltbar(boot)`, `freihalten(boot, platz?)`, `freigeben(boot)`,
  `freigehaltenFuer(platz)`, `funkBonus(boot)`.
- Oberfläche: `game.funkAnmeldung = { zeige(bootId), offen() }`, Meldung `#hm-funk-anmeldung` im Meldeplatz,
  Vorrang `VORRANG.funk` = 57 ([meldungen.md](meldungen.md)).

## Wo es mit anderen kollidieren kann

- Meldeplatz (ui/meldungen.js): eine Meldung zur Zeit; die Funk-Meldung wartet hinter Zettel, Dauerlieger mit Frist und Ereignis.
- `game.stege.highlight` teilt sich die Box-Markierung mit dem Zuweisen (ui/gesten.js); ein gewähltes Boot hat Vorrang.
- P27 Päckchen, P32 Flottillen, P33 Verholen: eine frei gehaltene Box ist für sie belegt (`hookWhyNotFit` 'funk').
- P35 Preisstufe: der Bonus rechnet mit `nightlyFee`, folgt also dem Preis.

## Prüfen

```bash
node --test tests/funk-anmeldung.test.mjs
```

Im Spiel: `?stufe=3`, im Baumenü unter "Hafen" den Hafenmeister mit Funk bauen, bis zum nächsten Morgen spielen.
