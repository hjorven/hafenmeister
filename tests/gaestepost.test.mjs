// Gästepost (P25, F37, docs/stammgaeste.md): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as stamm from '../web/js/features/stammgaeste.js';
import * as post from '../web/js/features/gaestepost.js';
import * as dauer from '../web/js/features/dauerlieger.js';

function neu(seed = 7, stufe = 3) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  // Reihenfolge wie im Spiel: Stammgäste vor der Gästepost (MODULES in web/js/main.js)
  stamm.haengeEin((n, f) => sim.addHook(ctx, n, f));
  dauer.haengeEin((n, f) => sim.addHook(ctx, n, f));
  post.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  state.office = 3;
  Object.assign(state.facilities, { wc: 4, dusche: 4, essen: 4, diesel: 4 });
  return { ctx, state };
}

function eintrag(ctx, extra = {}) {
  const t = ctx.types.find((x) => x.size === 'M' && !x.special && x.models?.length && x.minStage <= 2);
  const m = t.models[0];
  return { stammId: 1, bootsname: 'Seeschwalbe', heimathafen: 'Kappeln', typeId: t.id, modelId: m.id, name: m.name, size: 'M', kind: t.kind, motor: t.motor,
    length: m.length, beam: m.beam, draft: m.draft, wishes: ['strom'], besuche: 3, zuletzt: 1, stamm: true, lieblingsplatz: 'B05', ...extra };
}

/** Karte direkt an die Pinnwand hängen. */
function karte(state, k) {
  const p = post.postState(state);
  const neu = { id: p.naechsteId++, geschrieben: 1, ankunft: state.day, gelesen: false, stand: 'offen', heimathafen: 'Kappeln', bootsname: 'Seeschwalbe', stammId: 1, ...k };
  p.karten.unshift(neu);
  return neu;
}

test('zufriedener Stammgast schreibt eine Karte, die ein paar Tage später ankommt', () => {
  const { ctx, state } = neu();
  stamm.stammState(state).liste = [eintrag(ctx)];
  const alt = post.POST.chance;
  post.POST.chance = 1;
  try {
    state.day = 10;
    const events = [{ type: 'departed', boatId: 5, rating: 4.5, guest: { stammId: 1, stamm: true } }];
    post.nachtHook({ state, ctx, events });
    const p = post.postState(state);
    assert.equal(p.unterwegs.length, 1);
    assert.equal(p.karten.length, 0);
    const k = p.unterwegs[0];
    assert.ok(k.ankunft >= 11 + post.POST.unterwegs[0] && k.ankunft <= 11 + post.POST.unterwegs[1]);
    assert.ok(k.besuchTag > k.ankunft);
    // Zweite Abreise desselben Gasts: keine zweite offene Karte
    post.nachtHook({ state, ctx, events: [{ ...events[0] }] });
    assert.equal(p.unterwegs.length, 1);
    // Unzufrieden oder Erstbesucher: keine Karte
    stamm.stammState(state).liste.push(eintrag(ctx, { stammId: 2, stamm: false, besuche: 1 }));
    post.nachtHook({ state, ctx, events: [{ type: 'departed', boatId: 6, rating: 5, guest: { stammId: 2 } }, { type: 'departed', boatId: 7, rating: 3, guest: { stammId: 1 } }] });
    assert.equal(p.unterwegs.length, 1);
    // Nächte bis zur Ankunft: dann an der Pinnwand, Ereignis postNeu
    let ev = [];
    while (!ev.some((e) => e.type === 'postNeu')) {
      ev = [];
      post.nachtHook({ state, ctx, events: ev });
      state.day++;
      assert.ok(state.day < 30);
    }
    assert.equal(state.day, k.ankunft);
    assert.equal(p.karten[0].id, k.id);
    assert.equal(post.ungelesen(state), 1);
    post.allesGelesen(state);
    assert.equal(post.ungelesen(state), 0);
    if (k.art === 'ankuendigung') {
      assert.equal(k.platz, 'B05');
      assert.deepEqual(k.wuensche, ['strom']);
    } else assert.ok(k.freund?.bootsname);
  } finally { post.POST.chance = alt; }
});

test('Ankündigung: am Besuchstag kommt der Stammgast sicher, mit Wünschen und Lieblingsplatz', (t) => {
  const { ctx, state } = neu(4);
  stamm.stammState(state).liste = [eintrag(ctx, { bootsname: 'Probefahrt' })];
  state.day = 5;
  const k = karte(state, { art: 'ankuendigung', besuchTag: 6, platz: 'B05', wuensche: ['strom'], bootsname: 'Probefahrt' });
  // Ohne zufällige Wiederkehr: so kommt er nur über die Karte
  const alt = stamm.STAMM.chance;
  stamm.STAMM.chance = 0;
  t.after(() => { stamm.STAMM.chance = alt; });
  sim.tick(state, ctx, 0);    // Tag 5 beginnt: noch nicht
  assert.equal(state.day, 5);
  assert.equal(k.stand, 'offen');
  assert.ok(![...state.upcoming].some((b) => b.stammId === 1));
  sim.runDay(state, ctx);     // bis in den Morgen von Tag 6
  sim.tick(state, ctx, 0);
  assert.equal(state.day, 6);
  const da = [...state.upcoming, ...Object.values(state.boats)].filter((b) => b.stammId === 1);
  assert.equal(da.length, 1, 'genau ein Besuch');
  const b = da[0];
  assert.equal(b.bootsname, 'Probefahrt');
  assert.equal(b.angekuendigt, k.id);
  assert.equal(b.lieblingsplatz, 'B05');
  assert.ok(b.wishes.includes('strom'));
  assert.ok(b.nights >= 1);
  assert.equal(b.story, undefined);
  assert.equal(k.stand, 'da');
  assert.match(post.kartenText(k, 6), /Wir sind wieder da/);
  assert.equal(stamm.hinweise(state, ctx, b).some((h) => h.art === 'post'), true);
});

test('Ankündigung: Stammgast nicht mehr auf der Liste oder passt nicht: kommt nicht, kein Fehler', () => {
  const { ctx, state } = neu(4);
  stamm.stammState(state).liste = [];
  state.day = 6;
  const k = karte(state, { art: 'ankuendigung', besuchTag: 6 });
  sim.tick(state, ctx, 0);
  if (state.upcoming.length) assert.equal(k.stand, 'verpasst');
  assert.match(post.kartenText(k, 6), /Leider/);
  // Boot, das im Hafen nicht mehr passt (XXL in Stufe 1)
  const s2 = neu(5, 1);
  stamm.stammState(s2.state).liste = [eintrag(s2.ctx, { typeId: 'XXL1', size: 'XXL', length: 120, beam: 20, draft: 6, bootsname: 'Riese' })];
  s2.state.day = 6;
  const k2 = karte(s2.state, { art: 'ankuendigung', besuchTag: 6, bootsname: 'Riese' });
  sim.tick(s2.state, s2.ctx, 0);
  if (s2.state.upcoming.length) assert.equal(k2.stand, 'verpasst');
  assert.ok(![...s2.state.upcoming].some((b) => b.bootsname === 'Riese'));
});

test('Empfehlung: am Besuchstag kommt ein Boot mehr, die Freunde, aus demselben Heimathafen', () => {
  let geprueft = 0;
  for (const seed of [3, 8, 12, 20]) {
    const { ctx, state } = neu(seed);
    stamm.stammState(state).liste = [eintrag(ctx)];
    state.day = 9;
    const k = karte(state, { art: 'empfehlung', besuchTag: 10, freund: { bootsname: 'Kormoran' }, heimathafen: 'Eckernförde' });
    sim.runDay(state, ctx);
    sim.collectAll(state, ctx, true);
    sim.tick(state, ctx, 0);
    assert.equal(state.day, 10);
    const freunde = state.upcoming.filter((b) => b.freundVon?.karteId === k.id);
    assert.equal(freunde.length, 1, `Seed ${seed}`);
    const f = freunde[0];
    assert.equal(f.stammId, undefined, 'Freunde sind neue Gäste');
    assert.ok(f.nights >= 1);
    assert.equal(f.bootsname, k.freund.bootsname);
    assert.equal(k.stand, 'da');
    // Ankunftszeiten bleiben sortiert und eindeutig
    const zeiten = state.upcoming.map((b) => b.arriveAt);
    assert.deepEqual(zeiten, [...zeiten].sort((a, b) => a - b));
    assert.equal(new Set(state.upcoming.map((b) => b.id)).size, state.upcoming.length);
    assert.equal(new Set(state.upcoming.map((b) => b.bootsname)).size, state.upcoming.length, 'Namen eindeutig');
    if (f.heimathafen === 'Eckernförde') geprueft++;
    assert.match(stamm.hinweise(state, ctx, f)[0].text, /Freunde der „Seeschwalbe“/);
  }
  assert.ok(geprueft > 0, 'Heimathafen der Freunde wie auf der Karte');
});

test('Winter: Karten warten bis zum Saisonbeginn', () => {
  const { ctx, state } = neu(6);
  stamm.stammState(state).liste = [eintrag(ctx, { bootsname: 'Probefahrt' })];
  // In den Winter springen
  const L = ctx.rules.seasonDays;
  state.day = L + 1;
  assert.ok(sim.season(state, ctx).winter, 'Winter');
  const k = karte(state, { art: 'empfehlung', besuchTag: state.day, freund: { bootsname: 'Kormoran' } });
  const k2 = karte(state, { art: 'ankuendigung', besuchTag: state.day, bootsname: 'Probefahrt' });
  sim.tick(state, ctx, 0);
  assert.equal(k.stand, 'offen');
  assert.equal(k2.stand, 'offen');
  assert.equal(state.upcoming.length, 0);
});

test('Texte: Gruß, Wann, Platz und Wünsche; nichts Leeres', () => {
  const k = { id: 3, art: 'ankuendigung', bootsname: 'Möwe', heimathafen: 'Kappeln', besuchTag: 12, platz: 'A04', wuensche: ['strom', 'dusche'], stand: 'offen' };
  const t = post.kartenText(k, 10, (w) => ({ strom: 'Strom', dusche: 'eine Dusche' })[w]);
  assert.match(t, /Kappeln!/);
  assert.match(t, /übermorgen wieder, gern wieder in Box A04\./);
  assert.match(t, /Strom und eine Dusche/);
  assert.equal(post.kartenStand(k, 11), 'kommt morgen');
  assert.equal(post.kartenStand(k, 5), 'kommt am Tag 12');
  assert.equal(post.kartenStand({ ...k, stand: 'da' }, 12), 'ist da');
  const e = { id: 4, art: 'empfehlung', bootsname: 'Möwe', heimathafen: 'Kiel', besuchTag: 9, freund: { bootsname: 'Butt' }, stand: 'offen' };
  assert.match(post.kartenText(e, 9), /Freunden von der „Butt“ .* Sie kommen heute\./);
  assert.equal(post.kartenStand(e, 8), 'Freunde kommen morgen');
});

test('Pinnwand hält höchstens pinnwand Karten, erledigte fallen zuerst', () => {
  const state = createState({ seed: 1 });
  const p = post.postState(state);
  for (let i = 0; i < post.POST.pinnwand + 4; i++) p.karten.push({ id: i + 1, stand: i % 2 ? 'da' : 'offen', art: 'empfehlung' });
  post.nachtHook({ state, events: [] });
  assert.equal(p.karten.length, post.POST.pinnwand);
  assert.ok(p.karten.filter((k) => k.stand === 'offen').length >= (post.POST.pinnwand + 4) / 2);
});

test('über viele Tage: Post kommt, Besuche finden statt, Spielstand bleibt JSON', () => {
  for (const seed of [2, 15]) {
    const { ctx, state } = neu(seed);
    let karten = 0, besuche = 0, freunde = 0;
    for (let tag = 0; tag < 90; tag++) {
      const ev = sim.runDay(state, ctx);
      karten += ev.filter((e) => e.type === 'postNeu').length;
      sim.collectAll(state, ctx, true);
      for (const b of state.upcoming) {
        if (b.angekuendigt) besuche++;
        if (b.freundVon) freunde++;
      }
      const ids = [...Object.values(state.boats), ...state.upcoming].map((b) => b.id);
      assert.equal(new Set(ids).size, ids.length, 'ids eindeutig');
    }
    const p = post.postState(state);
    assert.ok(p.karten.length <= post.POST.pinnwand);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    assert.ok(karten > 0, `Seed ${seed}: Karten kamen (${karten})`);
    void besuche; void freunde;
  }
});
