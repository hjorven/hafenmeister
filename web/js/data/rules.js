// Regelzahlen des Spiels. Alle Werte sind Startwerte fürs Balancing.
// Quelle: docs/plan.md (Abschnitte 3 bis 7) und docs/hafen-und-schiffe.md.
// sim.js liest nur diese Datei, nichts ist im Code verstreut.

export const RULES = {
  // Ein Spieltag: 90 s Tag, 30 s Abend (Sekunden Spielzeit bei normaler Geschwindigkeit)
  dayLength: 90,
  eveningLength: 30,
  // Ankünfte verteilen sich auf diesen Anteil des Tages, damit niemand kurz vor Abend einläuft
  arrivalWindow: 0.8,
  // Am ersten Tag eines neuen Spiels kommt das erste Boot schon nach so vielen Sekunden (und es kommt sicher eines)
  firstArrivalAt: 3,

  // Hafengeld pro Nacht = Grundpreis × (1 + wishBonus × erfüllte Wünsche)
  baseFee: { S: 10, M: 20, L: 40, XL: 100 },
  wishBonus: 0.25,
  // Nicht kassierte Münzen: dieser Anteil landet nachts trotzdem in der Kasse (Kasse des Vertrauens)
  uncollectedShare: 0.5,

  // Aufenthalt in Nächten (min, max)
  nights: [1, 3],

  // Passregel: Wassertiefe muss mindestens so viel größer sein als der Tiefgang (Meter)
  underKeelClearance: 0.3,

  // Boote pro Tag bei Ruf 3. Die Werte stammen aus dem alten Plan mit 54 Plätzen
  // und müssen für 94 Plätze neu gerechnet werden.
  arrivalsPerDay: { 1: 3, 2: 7, 3: 11, 4: 15, 5: 19 },
  // Anteil der Größen je Ausbaustufe
  sizeMix: {
    1: { S: 1 },
    2: { S: 0.6, M: 0.4 },
    3: { S: 0.35, M: 0.4, L: 0.25 },
    4: { S: 0.25, M: 0.4, L: 0.35 },
    5: { S: 0.2, M: 0.35, L: 0.35, XL: 0.1 },
  },

  // Wünsche, die ab einer Ausbaustufe auftreten, und wie viele ein Boot hat (min, max)
  wishes: {
    1: ['wc'],
    2: ['wc', 'dusche', 'essen'],
    3: ['wc', 'dusche', 'essen', 'strom'],
    4: ['wc', 'dusche', 'essen', 'strom', 'diesel'],
    5: ['wc', 'dusche', 'essen', 'strom', 'diesel'],
  },
  wishCount: { 1: [0, 1], 2: [1, 2], 3: [1, 3], 4: [1, 3], 5: [2, 3] },
  // Diesel wünschen nur Motorboote
  motorOnlyWishes: ['diesel'],

  // Versorgung: Stufe -> wie viele Boote pro Abend den Wunsch erfüllt bekommen.
  // strom kommt nicht von einem Gebäude, sondern vom Liegeplatz (berth.power).
  facilities: {
    wc: { levels: { 1: 6, 2: 15, 3: 30, 4: 60 }, cost: { 1: 80, 2: 400, 3: 1800, 4: 6000 }, fromStage: { 1: 1, 2: 2, 3: 3, 4: 4 } },
    dusche: { levels: { 1: 6, 2: 15, 3: 30, 4: 60 }, cost: { 1: 200, 2: 700, 3: 2500, 4: 8000 }, fromStage: { 1: 2, 2: 2, 3: 3, 4: 4 } },
    essen: { levels: { 1: 8, 2: 20, 3: 45 }, cost: { 1: 500, 2: 1500, 3: 6000 }, fromStage: { 1: 2, 2: 3, 3: 4 } },
    diesel: { levels: { 1: 10, 2: 25 }, cost: { 1: 3000, 2: 8000 }, fromStage: { 1: 4, 2: 5 } },
    // Weitere Services hängt das Services-Modul mit addService ein.
  },
  // Wunsch -> Eigenschaft des Liegeplatzes, die ihn erfüllt (statt eines Gebäudes)
  berthWishes: { strom: 'power' },

  // Tagesgäste (Fahrgastschiff, Kreuzfahrtschiff, Barkasse) geben abends Geld an Kiosk und Restaurant aus.
  // Einnahme = Tagesgäste × visitorSpend × Stufe von 'essen' (ohne Kiosk nichts).
  visitorSpend: 2,
  // Sondergäste (Marinebesuch, Behördenboote, Traditionssegler) zählen bei der Bewertung so viel extra
  specialGuestRatingBonus: 1,
  // Stationierte Einheiten (Seenotretter, Polizei, Fischer) zahlen eine feste Pacht pro Nacht,
  // als Anteil des normalen Hafengelds. Sie haben keine Wünsche und reisen nicht ab.
  stationedFeeShare: 0.5,

  // Hafenbüro: ab welcher Stufe was passiert
  office: {
    collectAllButton: 1, // Knopf "Alles kassieren"
    autoCollect: 2, // kassiert abends von selbst
    autoAssign: 3, // weist Boote selbst zu, schaltet Vorspulen frei
    cost: { 1: 600, 2: 2000, 3: 5000 },
    fromStage: { 1: 2, 2: 3, 3: 3 },
  },

  // Ruf: Schnitt der letzten `window` Bewertungen. Zum Start liegen `startSamples` neutrale Bewertungen vor,
  // damit der erste Gast den Ruf nicht allein bestimmt.
  reputation: { window: 20, start: 3, startSamples: 5, min: 1, max: 5 },
  // Bewertung: alle Wünsche erfüllt 5, keiner 1, keine Wünsche 4
  rating: { noWishes: 4, min: 1, max: 5 },
  // Bequemer Platz (berth.comfort) hebt die Bewertung um diesen Wert je Komfortstufe
  comfortBonus: 0.5,
  // Ankünfte je Ruf: 1 Anker 0,5-fach, 3 Anker 1-fach, 5 Anker 1,5-fach (linear)
  arrivalFactorAtRep: { 1: 0.5, 5: 1.5 },

  // Wer keinen Platz bekommt, fährt weiter. Mit dieser Wahrscheinlichkeit gibt er eine schlechte Bewertung ab.
  turnAway: { rating: 2, chance: 0.3 },
  // Warten vor dem Hafen: Boote liegen an Wartebojen oder im Ankerfeld, bis sie einen Platz bekommen.
  // spots = Zahl der Warteplätze je Stufe, patience = Sekunden an der Boje, bis ein Boot weiterfährt.
  // Die Geduld zählt erst, wenn das Boot an der Boje fest ist (Meldung der 3D-Ansicht).
  // Meldet niemand etwas, gilt es nach approachMax Sekunden als angekommen.
  queue: { spots: { 1: 3, 2: 4, 3: 6, 4: 6, 5: 8 }, patience: 50, approachMax: 35, selfEnterAfter: 8 },
  // selfEnterAfter: so lange liegt ein Boot an der Boje, bevor es sich selbst eine freie Box sucht
  // (Zeit für den Spieler, es selbst zu lenken). null schaltet das ab.
  // Tagestörn: Gäste mit 2 oder mehr Nächten fahren mit dieser Wahrscheinlichkeit tagsüber hinaus.
  // out und back sind Anteile des Tages. Die Box bleibt reserviert.
  trips: { chance: 0.35, out: [0.12, 0.3], back: [0.6, 0.85] },
  // Ein abreisendes Boot hält seine Box, bis die 3D-Ansicht 'boot:aus-box' meldet,
  // spätestens leaveMax Sekunden nach dem Ablegen.
  leaveMax: 20,
  // Vorschau: so viele kommende Boote sind sichtbar
  previewCount: 3,

  // Ziele für die nächste Ausbaustufe (Gäste, Mindestruf, Kosten der Erweiterung).
  // Noch aus dem alten Plan, müssen neu gerechnet werden.
  stageGoals: {
    1: { guests: 25, reputation: 2.5, cost: 400 },
    2: { guests: 150, reputation: 3.0, cost: 3000 },
    3: { guests: 500, reputation: 3.5, cost: 14000 },
    4: { guests: 1300, reputation: 4.0, cost: 45000 },
  },
  maxStage: 5,

  // Jahreslauf: eine Saison hat seasonDays Spieltage, danach winterDays Wintertage ohne Gäste
  seasonDays: 30,
  winterDays: 3,

  // Eigenschaften je Platzart aus data/harbor.js (art)
  berthKinds: {
    box: {},
    finger: { comfort: 1, power: true },
    stirn: {},
    kai: { power: true, exposed: true, sizes: ['XL'] },
    fischer: { reserved: true },
  },
  // Eigenschaften je Steg aus data/harbor.js (steg): Strom ab Hauptsteg C (Schwimmsteg im Becken)
  berthJetties: {
    C: { power: true },
    CS: { power: true },
    D: { power: true },
  },
  // Bauprojekte, die einzelne Liegeplätze freischalten: { projektId: ['D01', 'D02'] }.
  // Leer heißt: alle Plätze einer Stufe gibt es sofort. Füllt der Balancing-Thread.
  berthProjects: {},

};
