// Stammgäste (docs/neue-features.md, Abschnitt 4): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { STAMM, haengeEin, stammState, beschreibung, nachtHook } from '../web/js/features/stammgaeste.js';
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
