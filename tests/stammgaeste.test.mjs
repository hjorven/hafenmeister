// Stammgäste (docs/neue-features.md, Abschnitt 4): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { STAMM, haengeEin, stammState, stammZahl, beschreibung, nachtHook, namenNachtragen, freierName, ankunftHook, wachsen, treuewimpel, hinweise, platzHook } from '../web/js/features/stammgaeste.js';
import { BOOTSNAMEN } from '../web/js/data/bootsnamen.js';
import * as dauer from '../web/js/features/dauerlieger.js';

function neu(seed = 7, stufe = 2) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  haengeEin((n, f) => sim.addHook(ctx, n, f));
  dauer.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  state.office = 3;   // Hafenbüro weist zu, damit Tage ohne Spieler laufen
  Object.assign(state.facilities, { wc: 4, dusche: 4, essen: 4, diesel: 4 });   // Wünsche erfüllbar, Gäste zufrieden
  return { ctx, state };
}

function spiele(state, ctx, tage) {
  for (let i = 0; i < tage; i++) {
    sim.runDay(state, ctx);
    sim.collectAll(state, ctx, true);
  }
}

test('jedes Gastboot hat Namen am Heck und Heimathafen', () => {
  const { ctx, state } = neu();
  sim.tick(state, ctx, 0);
  assert.ok(state.upcoming.length > 0);
  for (const b of state.upcoming) {
    assert.equal(typeof b.bootsname, 'string');
    assert.equal(typeof b.heimathafen, 'string');
    assert.ok(b.besuche >= 1);
  }
});

test('kleine Boote kommen aus der Nähe, große auch von weiter her, je nach Region', async () => {
  const { HEIMAT_NACH_REGION, heimathaefen } = await import('../web/js/data/bootsnamen.js');
  const o = HEIMAT_NACH_REGION.ostsee;
  assert.deepEqual(heimathaefen('ostsee', 'S'), o.nah);
  assert.ok(!heimathaefen('ostsee', 'S').includes('Husum'));
  assert.ok(heimathaefen('ostsee', 'XL').includes('Visby'));
  assert.ok(heimathaefen('nordsee', 'S').includes('Husum'));
  // Im Spiel: jedes S-Boot an der Ostsee hat einen nahen Heimathafen
  const { ctx, state } = neu(3, 1);
  state.region = 'ostsee';
  for (let i = 0; i < 4; i++) {
    sim.tick(state, ctx, 0);
    for (const b of state.upcoming) if (b.size === 'S' && b.besuche === 1) assert.ok(o.nah.includes(b.heimathafen), b.heimathafen);
    sim.runDay(state, ctx);
  }
});

test('zufriedene Gäste werden Stammgäste und kommen wieder', () => {
  const { ctx, state } = neu(21);
  spiele(state, ctx, 40);
  const s = stammState(state);
  assert.ok(s.liste.length > 0, 'nach 40 Tagen sollte es Stammgäste geben');
  assert.ok(s.liste.length <= STAMM.maxListe);
  const wiederkehrer = s.liste.filter((g) => g.besuche > 1);
  assert.ok(wiederkehrer.length > 0, 'mindestens ein Stammgast war schon zweimal da');
  for (const g of s.liste) assert.ok(g.bootsname && g.heimathafen && g.typeId);
});

test('nur Bewertungen ab 4 Ankern merken sich den Hafen, Stammgast erst beim Wiederkommen', () => {
  const state = createState({ seed: 1 });
  const s = stammState(state);
  s.abend = {
    1: { stammId: null, bootsname: 'Möwe', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 1 },
    2: { stammId: null, bootsname: 'Butt', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 1 },
  };
  const events = [{ type: 'departed', boatId: 1, rating: 4.5 }, { type: 'departed', boatId: 2, rating: 3 }];
  nachtHook({ state, events });
  assert.deepEqual(s.liste.map((g) => g.bootsname), ['Möwe']);
  // Zusammenspiel K2: der erste zufriedene Besuch macht noch keinen Stammgast
  assert.ok(!events.some((e) => e.type === 'stammgastNeu'));
  assert.equal(stammZahl(state), 0);
  // Kommt wieder und ist zufrieden: jetzt Stammgast, genau einmal gemeldet
  const id = s.liste[0].stammId;
  s.abend = { 3: { stammId: id, bootsname: 'Möwe', besuche: 2 } };
  const ev2 = [{ type: 'departed', boatId: 3, rating: 5 }];
  nachtHook({ state, events: ev2 });
  assert.ok(ev2.some((e) => e.type === 'stammgastNeu' && e.bootsname === 'Möwe'));
  assert.equal(stammZahl(state), 1);
  s.abend = { 4: { stammId: id, bootsname: 'Möwe', besuche: 3 } };
  const ev3 = [{ type: 'departed', boatId: 4, rating: 5 }];
  nachtHook({ state, events: ev3 });
  assert.ok(!ev3.some((e) => e.type === 'stammgastNeu'));
  // Wiedergekommen, aber unzufrieden: kein Stammgast
  s.liste.push({ stammId: 77, bootsname: 'Butt', besuche: 1, zuletzt: 1, stamm: false });
  s.abend = { 5: { stammId: 77, bootsname: 'Butt', besuche: 2 } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 5, rating: 3 }] });
  assert.equal(stammZahl(state), 1);
});

test('volle Liste: echte Stammgäste bleiben, zufriedene Erstbesucher rücken nach', () => {
  const state = createState({ seed: 1 });
  const s = stammState(state);
  for (let i = 0; i < STAMM.maxListe; i++) s.liste.push({ stammId: 100 + i, bootsname: `B${i}`, besuche: i < 10 ? 3 : 1, zuletzt: 1, stamm: i < 10 });
  s.naechsteId = 500;
  s.abend = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, { stammId: null, bootsname: `N${i}`, besuche: 1 }]));
  state.day = 9;
  nachtHook({ state, events: Array.from({ length: 20 }, (_, i) => ({ type: 'departed', boatId: i + 1, rating: 5 })) });
  assert.equal(s.liste.length, STAMM.maxListe);
  assert.equal(stammZahl(state), 10, 'alle zehn Stammgäste sind noch da');
  assert.equal(s.liste.filter((g) => g.zuletzt === 9).length, 20);
});

test('zweimal unzufrieden: Stammgast kommt nicht mehr', () => {
  const state = createState({ seed: 1 });
  const s = stammState(state);
  s.liste.push({ stammId: 5, bootsname: 'Butt', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 2, zuletzt: 1 });
  for (const besuche of [3, 4]) {
    s.abend = { 9: { stammId: 5, bootsname: 'Butt', besuche } };
    nachtHook({ state, events: [{ type: 'departed', boatId: 9, rating: 2 }] });
  }
  assert.equal(s.liste.length, 0);
});

test('Beschreibung für die Karte', () => {
  assert.equal(beschreibung({ bootsname: 'Möwe', heimathafen: 'Kappeln', besuche: 1 }), '„Möwe“ aus Kappeln');
  assert.equal(beschreibung({ bootsname: 'Möwe', heimathafen: 'Kappeln', besuche: 3, stamm: true }), '„Möwe“ aus Kappeln · Stammgast, 3. Besuch');
  // wiedergekommen, aber noch kein Stammgast (erst nach dem zweiten zufriedenen Besuch)
  assert.equal(beschreibung({ bootsname: 'Möwe', heimathafen: 'Kappeln', besuche: 2 }), '„Möwe“ aus Kappeln · kommt wieder, 2. Besuch');
  assert.equal(beschreibung({}), '');
});

test('ab dem 5. Besuch als Dauerlieger behalten', () => {
  const { ctx, state } = neu(4);
  sim.tick(state, ctx, 0);
  const platz = sim.availableBerths(state, ctx).find((b) => sim.isFree(state, b.id) && b.size === 'S');
  const gast = { id: 900, typeId: 'S1', size: 'S', length: 3, beam: 1.2, draft: 0.2, wishes: ['wc'], nights: 2,
    status: 'moored', berthId: platz.id, stationed: false, besuche: 4, pendingFee: 0, wishesMet: 0, wishesTotal: 0, penalty: 0 };
  state.boats[900] = gast;
  state.berths[platz.id] = 900;
  assert.equal(dauer.kannBehalten(state, ctx, platz.id), false);
  gast.besuche = 5;
  assert.equal(dauer.kannBehalten(state, ctx, platz.id), true);
  const r = dauer.behalte(state, ctx, platz.id);
  assert.ok(r.ok);
  assert.equal(gast.stationed, true);
  assert.ok(dauer.istDauerplatz(state, platz.id));
  // Reist nachts nicht ab
  spiele(state, ctx, 3);
  assert.ok(state.boats[900] || dauer.draussenBis(state, platz.id) != null);
});

test('Boote ohne Namen (vor dem Einhängen gewürfelt) bekommen Namen nach, ohne den Würfel zu bewegen', () => {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const state = createState({ seed: 3 });
  state.stage = 2;
  sim.tick(state, ctx, 0);   // ohne Stammgäste-Hook: keine Namen
  assert.ok(state.upcoming.length > 0);
  assert.ok(state.upcoming.every((b) => !b.bootsname));
  const rng = JSON.stringify(state.rng ?? state.seed);
  const n = namenNachtragen(state);
  assert.equal(n, state.upcoming.length);
  for (const b of state.upcoming) {
    assert.equal(typeof b.bootsname, 'string');
    assert.equal(typeof b.heimathafen, 'string');
  }
  assert.equal(JSON.stringify(state.rng ?? state.seed), rng);
  assert.equal(namenNachtragen(state), 0, 'zweimal ändert nichts');
});

test('Bootsnamen sind im Hafen eindeutig, auch in Stufe 6 mit vielen Booten', () => {
  for (const stufe of [2, 6]) {
    const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
    haengeEin((n, f) => sim.addHook(ctx, n, f));
    const state = sim.applyTestStage(createState({ seed: 21 }), ctx, stufe);
    state.office = 3;
    let meist = 0;
    for (let tag = 0; tag < 25; tag++) {
      for (let t = 0; t < 400; t++) {
        sim.tick(state, ctx, 1);
        const namen = [...Object.values(state.boats), ...state.upcoming].filter((b) => !b.stationed).map((b) => b.bootsname);
        meist = Math.max(meist, namen.length);
        assert.equal(new Set(namen).size, namen.length, `Stufe ${stufe} Tag ${state.day}: ${namen.join(', ')}`);
      }
      sim.runDay(state, ctx);
      sim.collectAll(state, ctx, true);
    }
    assert.ok(meist > 3, `Stufe ${stufe}: genug Boote gleichzeitig (${meist})`);
  }
});

test('freierName: zuletzt vergebene Namen kommen nicht gleich wieder, volle Liste bekommt Zusatz', () => {
  const state = createState({ seed: 4 });
  const reihe = [];
  for (let i = 0; i < STAMM.namenGedaechtnis; i++) reihe.push(freierName(state, 0));
  assert.equal(new Set(reihe).size, reihe.length);
  // Alle Grundnamen liegen im Hafen: ein Zusatz macht den Namen eindeutig
  state.boats = {};
  BOOTSNAMEN.forEach((name, i) => { state.boats[i + 1] = { id: i + 1, bootsname: name }; });
  const n = freierName(state, 0.5);
  assert.match(n, / II$/);
  assert.ok(!BOOTSNAMEN.includes(n));
});

// ------------------------------------------------------------------ P25: Stammgäste mit Wirkung

/** Stammgast auf die Liste setzen und als nächstes Boot schicken (chance 1). */
function stammKommt(state, ctx, eintrag) {
  const s = stammState(state);
  // Name, den kein Boot im Hafen trägt (sonst kommt der Stammgast heute nicht)
  s.liste = [{ stammId: 1, bootsname: 'Probefahrt', heimathafen: 'Kiel', besuche: 2, zuletzt: 1, stamm: true, ...eintrag }];
  const alt = STAMM.chance;
  STAMM.chance = 1;
  try { return sim.rollBoat(state, ctx); } finally { STAMM.chance = alt; }
}

function sBoot(ctx) {
  const t = ctx.types.find((x) => x.size === 'S' && !x.special && x.models?.length);
  const m = t.models[0];
  return { typeId: t.id, modelId: m.id, name: m.name, size: 'S', kind: t.kind, motor: t.motor, length: m.length, beam: m.beam, draft: m.draft, wishes: [] };
}

test('C8: echte Stammgäste zählen beim Ruf doppelt, Wiederkehrer ohne Stammstatus einfach', () => {
  const { ctx, state } = neu(5);
  state.ratings = [];
  state.ratingDays = [];
  const b = stammKommt(state, ctx, sBoot(ctx));
  assert.equal(b.stamm, true);
  assert.equal(b.stammId, 1);
  // Gewicht unmittelbar prüfen: ein Gast mit stamm zählt rufGewicht-mal
  const r0 = state.ratings.length;
  const gast = { id: 99, stamm: true, wishes: [], wishesMet: 0, wishesTotal: 0, berthId: null, status: 'waiting', size: 'S', length: 3, beam: 1.2, draft: 0.3 };
  state.boats[99] = gast;
  state.queue.push(99);
  const altChance = ctx.rules.turnAway.chance;
  ctx.rules.turnAway.chance = 1;
  sim.dismiss(state, ctx, 99);
  ctx.rules.turnAway.chance = altChance;
  assert.equal(state.ratings.length - r0, STAMM.rufGewicht);
  const r1 = state.ratings.length;
  const fremd = { ...gast, id: 98, stamm: undefined };
  state.boats[98] = fremd;
  state.queue.push(98);
  ctx.rules.turnAway.chance = 1;
  sim.dismiss(state, ctx, 98);
  ctx.rules.turnAway.chance = altChance;
  assert.equal(state.ratings.length - r1, 1);
});

test('H6: Lieblingsplatz wird gemerkt, bringt Anker und wird bei der Platzwahl bevorzugt', () => {
  const state = createState({ seed: 1 });
  const s = stammState(state);
  // Zufrieden in A03: Erstbesucher merkt sich die Box
  s.abend = { 1: { stammId: null, bootsname: 'Möwe', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 1, platz: 'A03' } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 1, rating: 4.5 }] });
  assert.equal(s.liste[0].lieblingsplatz, 'A03');
  assert.ok(!('platz' in s.liste[0]));
  // Nächster Besuch zufrieden in A05: neuer Lieblingsplatz; unzufrieden in A07: bleibt A05
  const id = s.liste[0].stammId;
  s.abend = { 2: { stammId: id, bootsname: 'Möwe', besuche: 2, platz: 'A05' } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 2, rating: 4 }] });
  assert.equal(s.liste[0].lieblingsplatz, 'A05');
  s.abend = { 3: { stammId: id, bootsname: 'Möwe', besuche: 3, platz: 'A07' } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 3, rating: 3 }] });
  assert.equal(s.liste[0].lieblingsplatz, 'A05');
  // Päckchen merkt sich niemand
  s.abend = { 4: { stammId: null, bootsname: 'Butt', besuche: 1, platz: null } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 4, rating: 5 }] });
  assert.equal(s.liste.find((g) => g.bootsname === 'Butt').lieblingsplatz, null);

  // Anker: am Lieblingsplatz platzBonus mehr, sonst gleich
  const { ctx } = neu(3);
  const boot = { wishes: [], wishesMet: 0, wishesTotal: 0, berthId: 'A03', lieblingsplatz: 'A03', penalty: 0 };
  const ohne = sim.ratingParts(ctx, { ...boot, lieblingsplatz: null });
  const mit = sim.ratingParts(ctx, boot);
  assert.equal(mit.stammPlatz, STAMM.platzBonus);
  assert.ok(Math.abs(Math.min(5, ohne.value + STAMM.platzBonus) - mit.value) < 0.051);
  assert.equal(sim.ratingParts(ctx, { ...boot, berthId: 'A04' }).stammPlatz, 0);
  // Platzwahl: unter gleich guten Boxen gewinnt der Lieblingsplatz, ein Platz-Wunsch zählt mehr
  assert.equal(platzHook({ boat: { lieblingsplatz: 'A03' }, berth: { id: 'A03' } }), STAMM.platzVorliebe);
  assert.equal(platzHook({ boat: { lieblingsplatz: 'A03' }, berth: { id: 'A04' } }), 0);
  assert.ok(STAMM.platzVorliebe < 1000);
});

test('H6 im Spiel: Büro und Einfahren nehmen den freien Lieblingsplatz, Platzwert zeigt ihn', () => {
  const { ctx, state } = neu(8);
  sim.tick(state, ctx, 0);
  const frei = sim.availableBerths(state, ctx).filter((b) => sim.isFree(state, b.id) && b.size === 'S');
  assert.ok(frei.length >= 2);
  const ziel = frei[frei.length - 1].id;
  const b = stammKommt(state, ctx, { ...sBoot(ctx), lieblingsplatz: ziel, besuche: 1 });   // 2. Besuch: wächst noch nicht
  b.id = 5000; b.status = 'waiting'; b.wishes = [];
  state.boats[b.id] = b;
  const liste = sim.fittingBerths(state, ctx, b.id);
  assert.equal(liste[0], ziel, 'Lieblingsplatz steht vorn');
  const wert = sim.berthValue(state, ctx, b.id, ziel);
  assert.equal(wert.lieblingsplatz, true);
  assert.ok(wert.anchors > sim.berthValue(state, ctx, b.id, liste[1]).anchors);
  const h = hinweise(state, ctx, b);
  assert.equal(h[0].art, 'platz');
  assert.match(h[0].text, new RegExp(`Box ${ziel} ist frei`));
  // belegt: Hinweis sagt es, kein Fehler
  state.berths[ziel] = 1234;
  assert.match(hinweise(state, ctx, b)[0].text, /belegt/);
  delete state.berths[ziel];
  // Box gibt es nicht (mehr): kein Hinweis
  b.lieblingsplatz = 'Z99';
  assert.equal(hinweise(state, ctx, b).length, 0);
});

test('H7: ein Treuewimpel je fünf Besuche, nicht für Erstbesucher und Dauerlieger', () => {
  assert.equal(treuewimpel({ stammId: 1, besuche: 4 }), 0);
  assert.equal(treuewimpel({ stammId: 1, besuche: 5 }), 1);
  assert.equal(treuewimpel({ stammId: 1, besuche: 14 }), 2);
  assert.equal(treuewimpel({ stammId: 1, besuche: 15 }), 3);
  assert.equal(treuewimpel({ besuche: 9 }), 0);
  assert.equal(treuewimpel({ stammId: 1, besuche: 10, dauer: true }), 0);
  assert.equal(treuewimpel(null), 0);
});

test('H8: Stammgäste wachsen mit (größeres Modell oder ein Wunsch mehr) und behalten es', () => {
  const { ctx, state } = neu(11, 3);
  const alt = STAMM.wachsen.chance;
  STAMM.wachsen.chance = 1;
  try {
    // Kleinstes Modell einer Art mit mehreren Modellen: wird größer, gleiche Art
    const t = ctx.types.find((x) => !x.special && (x.models || []).filter((m) => (m.minStage ?? x.minStage) <= 3).length >= 2 && x.minStage <= 3 && x.size === 'M');
    const ms = t.models.filter((m) => (m.minStage ?? t.minStage) <= 3).sort((a, b) => a.length - b.length);
    const boot = { id: 1, typeId: t.id, modelId: ms[0].id, name: ms[0].name, size: t.size, kind: t.kind, motor: t.motor, length: ms[0].length, beam: ms[0].beam, draft: ms[0].draft, wishes: [], besuche: STAMM.wachsen.abBesuch, stammId: 3 };
    const g = wachsen(state, ctx, boot);
    assert.equal(g?.art, 'boot');
    assert.ok(boot.length > ms[0].length);
    assert.equal(boot.vorher, undefined);
    assert.equal(g.vorher, ms[0].name);
    assert.ok(sim.couldEverFit(state, ctx, boot));
    // Vor abBesuch wächst niemand
    const jung = { ...boot, length: ms[0].length, besuche: STAMM.wachsen.abBesuch - 1 };
    assert.equal(wachsen(state, ctx, jung), null);
    // Größtes Modell ohne größere Art: ein Wunsch mehr, höchstens maxWuensche
    const gross = ctx.types.filter((x) => !x.special && !x.noWishes && x.minStage <= 3 && x.size === 'L')[0];
    const gm = [...gross.models].filter((m) => (m.minStage ?? gross.minStage) <= 3).sort((a, b) => b.length - a.length)[0];
    const b2 = { id: 2, typeId: gross.id, modelId: gm.id, name: gm.name, size: 'L', kind: gross.kind, motor: gross.motor, length: gm.length, beam: gm.beam, draft: gm.draft, wishes: [], besuche: 6, stammId: 4 };
    let r = wachsen(state, ctx, b2);
    // Entweder größere Art (XL derselben Bootsart) oder ein Wunsch
    assert.ok(r, 'wächst');
    if (r.art === 'wunsch') assert.equal(b2.wishes.length, 1);
    b2.wishes = ['wc', 'dusche', 'essen', 'strom'].slice(0, STAMM.wachsen.maxWuensche);
    b2.length = 999;   // kein größeres Modell
    b2.typeId = gross.id; b2.size = 'L';
    const vorherW = b2.wishes.length;
    r = wachsen(state, ctx, b2);
    if (r?.art !== 'boot') assert.equal(b2.wishes.length, vorherW, 'nicht mehr als maxWuensche');
  } finally { STAMM.wachsen.chance = alt; }
  // Das gewachsene Boot steht nach der Abreise auf der Liste (kommt so wieder)
  const s = stammState(state);
  s.liste = [{ stammId: 9, bootsname: 'Möwe', typeId: 'S1', modelId: 'a', name: 'Jolle', size: 'S', length: 4, wishes: [], besuche: 3, zuletzt: 1, stamm: true }];
  s.abend = { 7: { stammId: 9, bootsname: 'Möwe', typeId: 'M1', modelId: 'b', name: 'Kajütboot', size: 'M', kind: 'motor', motor: true, length: 7, beam: 2.5, draft: 0.7, wishes: ['strom'], besuche: 4, platz: 'B02' } };
  nachtHook({ state, events: [{ type: 'departed', boatId: 7, rating: 4.5 }] });
  const e = s.liste[0];
  assert.deepEqual([e.typeId, e.size, e.length, e.wishes, e.besuche, e.lieblingsplatz], ['M1', 'M', 7, ['strom'], 4, 'B02']);
});

test('P25: Stammgäste über viele Tage im Spiel, Spielstand bleibt JSON, alles passt in den Hafen', () => {
  for (const seed of [2, 9, 31]) {
    const { ctx, state } = neu(seed, 3);
    let gewachsen = 0, amPlatz = 0, stammAbreisen = 0;
    for (let tag = 0; tag < 60; tag++) {
      sim.tick(state, ctx, 0);
      for (const b of state.upcoming) {
        if (b.gewachsen) gewachsen++;
        assert.ok(sim.couldEverFit(state, ctx, b), `${b.name} passt`);
        if (b.stamm) assert.ok(b.stammId);
      }
      const vorher = state.ratings.length;
      const ev = sim.runDay(state, ctx);
      // C8: jede Bewertung eines echten Stammgasts steht zweimal in den Ruf-Bewertungen
      const soll = ev.filter((e) => typeof e.rating === 'number' && (e.type === 'departed' || e.rated))
        .reduce((n, e) => n + (e.guest?.stamm ? STAMM.rufGewicht : 1), 0);
      if (vorher + soll < ctx.rules.reputation.window) assert.equal(state.ratings.length - vorher, soll, `Tag ${state.day}`);
      for (const e of ev) {
        if (e.type !== 'departed' || !e.guest?.stamm) continue;
        stammAbreisen++;
        if (e.parts.stammPlatz > 0) amPlatz++;
      }
      sim.collectAll(state, ctx, true);
      assert.ok(state.ratings.length <= ctx.rules.reputation.window);
    }
    const kopie = JSON.parse(JSON.stringify(state));
    assert.deepEqual(kopie.modules.stamm, state.modules.stamm);
    assert.ok(stammAbreisen > 0, `Seed ${seed}: Stammgäste reisen ab`);
    assert.ok(amPlatz > 0, `Seed ${seed}: Büro legt Stammgäste an ihren Lieblingsplatz (${amPlatz}/${stammAbreisen})`);
    void gewachsen;
  }
});
