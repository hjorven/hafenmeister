// Stammgäste (docs/neue-features.md, Abschnitt 4): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { STAMM, haengeEin, stammState, beschreibung, nachtHook, namenNachtragen, freierName } from '../web/js/features/stammgaeste.js';
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

test('nur Bewertungen ab 4 Ankern machen Stammgäste', () => {
  const state = createState({ seed: 1 });
  const s = stammState(state);
  s.abend = {
    1: { stammId: null, bootsname: 'Möwe', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 1 },
    2: { stammId: null, bootsname: 'Butt', heimathafen: 'Kiel', typeId: 'S1', wishes: [], besuche: 1 },
  };
  const events = [{ type: 'departed', boatId: 1, rating: 4.5 }, { type: 'departed', boatId: 2, rating: 3 }];
  nachtHook({ state, events });
  assert.deepEqual(s.liste.map((g) => g.bootsname), ['Möwe']);
  assert.ok(events.some((e) => e.type === 'stammgastNeu'));
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
  assert.equal(beschreibung({ bootsname: 'Möwe', heimathafen: 'Kappeln', besuche: 3 }), '„Möwe“ aus Kappeln · Stammgast, 3. Besuch');
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
