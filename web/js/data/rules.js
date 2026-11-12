// Regeln des Spiels, gebaut aus den Spielzahlen in data/economy.js.
// Diese Datei enthält keine eigenen Zahlen: Jede Zahl, die die Spielregeln (sim.js) brauchen,
// steht in ECONOMY. Hier steht nur, wie aus ECONOMY die Regeln für sim.js werden, dazu ein paar
// feste Begriffe (Ruf geht von 1 bis 5 Anker, Wunsch "strom" erfüllt der Liegeplatz).
import { ECONOMY } from './economy.js';

// Feste Begriffe, keine Balancing-Zahlen
const ANKER_MIN = 1;
const ANKER_MAX = 5;

/**
 * Baut aus ECONOMY die Regeln für sim.js. Fehlt ein Wert in E, wirft die Funktion keinen
 * Fehler, sondern die Regel bleibt aus (zum Beispiel keine Warteplätze).
 */
export function rulesFromEconomy(E = ECONOMY) {
  const r = {};
  const z = E.zeit || {};
  r.dayLength = z.tagSekunden;
  r.eveningLength = z.abendSekunden;
  // Ankunftsfenster als Anteile des Tages (0 bis 1) und Schwerpunkt am Nachmittag (0 bis 1)
  r.arrivalFrom = z.ankunftVon ?? 0;
  r.arrivalWindow = z.ankunftBis ?? 1;
  r.departWindow = [z.abreiseVon ?? 0, z.abreiseBis ?? 0];
  r.firstArrivalAt = z.erstesBootNach ?? null;
  // Mindestabstand zwischen zwei Ankünften in Sekunden (kleiner, wenn sonst nicht alle in den Tag passen)
  r.arrivalMinGap = z.ankunftAbstand ?? 0;
  r.arrivalMaxGap = z.ankunftAbstandMax ?? r.arrivalMinGap;
  r.arrivalDenseGap = z.ankunftDichte ?? r.arrivalMinGap;
  r.seasonDays = z.saisonTage;
  r.winterDays = z.winterTage ?? 0;

  // Hafengeld und Aufenthalt je Klasse
  r.baseFee = {};
  r.nightsBySize = {};
  for (const [size, k] of Object.entries(E.klassen || {})) {
    r.baseFee[size] = k.grundpreis;
    r.nightsBySize[size] = k.naechte;
  }
  r.nights = [1, 1];   // nur für Bootsarten ohne Klasse in E.klassen
  r.wishBonus = E.wunschBonus ?? 0;
  // Kassieren: Anteil beim Rundgang und nachts, Vorauszahlung, Trinkgeld für den langen Strich
  const ka = E.kassieren || {};
  r.roundShare = ka.rundgangAnteil ?? 0;
  r.uncollectedShare = r.roundShare;
  r.prepay = ka.vorausNaechte ?? 1;   // höchstens so viele Nächte beim Anlegen auf einmal
  r.strokeTip = ka.strichTrinkgeld
    ? { from: ka.strichTrinkgeld.abMuenzen, perCoin: ka.strichTrinkgeld.jeMuenze, max: ka.strichTrinkgeld.hoechstens }
    : null;
  r.underKeelClearance = E.passregel?.wasserUnterKiel ?? 0;

  // Wünsche
  const stages = (E.stufen || []).map((s) => s.stufe);
  r.wishes = {};
  r.wishSizes = {};
  r.motorOnlyWishes = [];
  for (const st of stages) {
    r.wishes[st] = Object.entries(E.wuensche || {}).filter(([, w]) => w.abStufe <= st).map(([k]) => k);
  }
  for (const [k, w] of Object.entries(E.wuensche || {})) {
    if (w.klassen) r.wishSizes[k] = w.klassen;
    if (w.nurMotor) r.motorOnlyWishes.push(k);
  }
  r.wishCountBySize = { ...(E.wunschAnzahl || {}) };
  r.wishCount = {};   // je Stufe, nur für Klassen ohne Eintrag in wunschAnzahl: keine Wünsche
  // Wunsch -> Eigenschaft des Liegeplatzes, die ihn erfüllt (statt eines Gebäudes)
  r.berthWishes = Object.fromEntries(Object.entries(E.wuensche || {}).filter(([, w]) => w.durch === 'platz').map(([k]) => [k, 'power']));

  // Liegeplätze: Platzarten, Strom an Stegen
  r.comfortBonus = 1;   // comfort eines Platzes ist direkt der Bonus in Ankern (platzarten.rufBonus)
  r.berthKinds = {};
  for (const [kind, p] of Object.entries(E.platzarten || {})) {
    const k = {};
    if (p.strom) k.power = true;
    if (p.rufBonus) k.comfort = p.rufBonus;
    if (p.gast === false) k.reserved = true;
    if (p.nurKlassen) k.sizes = [...p.nurKlassen];
    if (p.offen) k.exposed = true;
    r.berthKinds[kind] = k;
  }
  r.berthJetties = Object.fromEntries(Object.keys(E.stromAnSteg || {}).filter((k) => E.stromAnSteg[k]).map((k) => [k, { power: true }]));
  // Strom an weiteren Stegen über ein Bauwerk (zum Beispiel Stromsäulen an Steg B)
  r.jettyPowerBuildings = {};
  for (const st of E.bauwerke?.strom?.stufen || []) for (const steg of st.stege || []) r.jettyPowerBuildings[steg] = 'strom';

  // Ruf und Bewertung
  const f = E.ruf || {};
  r.reputation = { window: f.fenster, start: f.start, startSamples: f.startBewertungen ?? 0, min: ANKER_MIN, max: ANKER_MAX };
  r.rating = { noWishes: f.ohneWunsch, min: ANKER_MIN, max: ANKER_MAX, noneMet: f.wunschNote?.keiner ?? ANKER_MIN, allMet: f.wunschNote?.alle ?? ANKER_MAX };
  r.arrivalFactorAtRep = { 1: f.ankunftBasis, 5: f.ankunftBasis + 4 * f.ankunftJeAnker };
  r.turnAway = { chance: f.abgewiesen?.chance ?? 0, rating: f.abgewiesen?.wertung ?? ANKER_MIN };
  r.specialGuestRatingBonus = f.sondergastBonus ?? 0;

  // Ausbaustufen
  r.arrivalsPerDay = {};
  r.sizeMix = {};
  r.stageGoals = {};
  r.regionGoal = null;
  for (const s of E.stufen || []) {
    r.arrivalsPerDay[s.stufe] = s.ankuenfte;
    r.sizeMix[s.stufe] = s.mix;
    if (!s.ausbau && s.ziel?.grossschiffBesuche != null) {
      r.regionGoal = { bigVisits: s.ziel.grossschiffBesuche, reputation: s.ziel.ruf, allBerths: !!s.ziel.allePlaetze };
    }
    if (s.ausbau) {
      r.stageGoals[s.stufe] = { guests: s.ziel.gaeste, reputation: s.ziel.ruf, cost: s.ausbau.kosten, project: s.ausbau.id, name: s.ausbau.name, perStage: true };
    }
  }
  r.maxStage = stages.length ? Math.max(...stages) : 1;

  // Liegeplätze und Projekte
  r.startBerths = [...(E.start?.plaetze || [])];
  r.berthProjects = {};
  r.jettyProjects = [];
  for (const p of E.stegprojekte || []) {
    r.berthProjects[p.id] = [...p.plaetze];
    r.jettyProjects.push({ id: p.id, name: p.name, stage: p.stufe, cost: p.kosten });
  }
  for (const s of E.stufen || []) if (s.ausbau) r.berthProjects[s.ausbau.id] = [...(s.ausbau.plaetze || [])];

  // Versorgung (Bauwerke)
  r.facilities = {};
  r.facilityNames = {};
  for (const [key, b] of Object.entries(E.bauwerke || {})) {
    const fac = { levels: {}, cost: {}, fromStage: {}, names: {} };
    b.stufen.forEach((st, i) => {
      fac.levels[i + 1] = st.versorgt ?? 0;
      fac.cost[i + 1] = st.kosten;
      fac.fromStage[i + 1] = st.abStufe;
      fac.names[i + 1] = st.name;
    });
    r.facilities[key] = fac;
    r.facilityNames[key] = b.name;
  }
  // Besucher an Land (Fahrgastschiff, Kreuzfahrt) geben je Stufe von 'essen' so viel aus
  r.visitorSpend = E.besucher?.ausgabeJeKioskStufe ?? 0;

  // Stationierte Boote: Fischer zahlen eine feste Pacht, Dauerlieger einen Anteil ihres Gastpreises
  r.stationedFee = E.fischer?.pachtProTag ?? null;
  r.stationedFeeShare = E.dauerlieger?.anteilGastpreis ?? 0;
  // Dauerlieger (features/dauerlieger.js): alle Zahlen, über regeln(ctx) gelesen
  if (E.dauerlieger) r.dauer = { ...(r.dauer || {}), ...E.dauerlieger };

  // Warten vor dem Hafen
  const w = E.warten || {};
  r.queue = {
    spots: { ...(w.plaetze || {}) },
    patience: w.geduld,
    approachMax: w.anfahrtMax ?? 0,
    selfEnterAfter: w.selbstEinfahrenNach ?? null,
    overnight: !!w.ueberNacht,
    buoyFee: w.bojengeld ?? 0,   // Bojengeld über Nacht (P10)
  };
  // Passgenau zuweisen (P10)
  r.snug = E.passgenau ? { share: E.passgenau.hoechstensGroesser, rating: E.passgenau.ruf } : null;
  r.leaveMax = w.ausBoxMax ?? 0;
  r.previewCount = w.vorschau ?? 0;

  // Tagestörn
  const t = E.tagestoern;
  r.trips = t ? { chance: t.anteil, out: t.raus, back: t.zurueck } : null;

  // Hafenbüro (docs/spielregeln.md, Punkt 3b). Fehlt eine Wirkung in den Stufen, gibt es sie nie;
  // nur der Knopf "Kassieren" ist dann von Anfang an da.
  const stufen = E.hafenbuero?.stufen || [];
  const hat = (k) => stufen.some((st) => st.schaltetFrei?.includes(k));
  const o = { collectAllButton: Infinity, autoCollect: Infinity, autoAssign: Infinity, preview: Infinity, propose: Infinity, extras: Infinity, cost: {}, fromStage: {}, names: {} };
  stufen.forEach((st, i) => {
    o.cost[i + 1] = st.kosten;
    o.fromStage[i + 1] = st.abStufe;
    o.names[i + 1] = st.name;
    const frei = st.schaltetFrei || [];
    if (frei.includes('allesKassieren')) o.collectAllButton = i + 1;
    if (frei.includes('sofortKassieren')) {
      o.autoCollect = i + 1;
      if (st.klassen) o.autoCollectSizes = [...st.klassen];
    }
    if (frei.includes('automatik')) o.autoAssign = i + 1;
    if (frei.includes('vorschau')) o.preview = i + 1;
    if (frei.includes('vorschlag')) o.propose = i + 1;
    if (frei.includes('nebenkosten')) o.extras = i + 1;
  });
  // Ohne eigene Stufe für sofortKassieren kassiert die Automatik mit, ohne Vorschlagsstufe schlägt sie vor
  if (!hat('sofortKassieren')) o.autoCollect = o.autoAssign;
  if (!hat('vorschlag')) o.propose = o.autoAssign;
  if (!hat('allesKassieren')) o.collectAllButton = 0;
  const sf = E.hafenbuero?.sonderfaelle;
  if (sf) {
    o.special = {
      kinds: sf.arten ?? [],
      sizes: sf.klassen ?? [],
      specialGuests: (sf.auch ?? []).includes('sondergast'),
      onlyBerth: (sf.auch ?? []).includes('einzigerPlatz'),
      selfEnterAfter: sf.selbstEinfahrenNach ?? null,
    };
  }
  const tg = E.hafenbuero?.trinkgeld;
  r.tip = tg ? { sizes: [...tg.klassen], share: tg.anteil } : null;
  r.officeExtrasShare = E.hafenbuero?.nebenkosten?.anteil ?? 0;
  r.handAssignBonus = E.hafenbuero?.vonHandBonus ?? 0;
  r.office = o;
  return r;
}

/** Die Regeln mit den Zahlen aus data/economy.js. */
export const RULES = rulesFromEconomy(ECONOMY);
