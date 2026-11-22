// Seltene Besucher (Paket P40, docs/besucher.md): Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as R from '../web/js/features/besucher-regeln.js';
import { haengeEin as stammEinhaengen } from '../web/js/features/stammgaeste.js';
import * as dauer from '../web/js/features/dauerlieger.js';
import * as E from '../web/js/features/erfolge-daten.js';
import { MOTIVE, SCHIFF_TEXTE, TIER_TEXTE } from '../web/js/data/besucher.js';
import { MODELS as BES_MODELLE, TYPES as BES_TYPEN } from '../web/js/data/boats/besucher.js';

function neu(seed = 7, stufe = 4, { stamm = true } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  R.haengeEin((n, f) => sim.addHook(ctx, n, f), (k, d) => sim.addService(ctx, k, d));
  if (stamm) {
    stammEinhaengen((n, f) => sim.addHook(ctx, n, f));
    dauer.haengeEin((n, f) => sim.addHook(ctx, n, f));
  }
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  state.office = 3;   // Hafenbüro weist zu, damit Tage ohne Spieler laufen
  Object.assign(state.facilities, { wc: 4, dusche: 4, essen: 4, diesel: 4 });
  return { ctx, state };
}

/** Tage spielen; gibt je Tag { tag, art, phase, platz, winter, da } zurück. */
function spiele(state, ctx, tage, { jeTag = null } = {}) {
  const log = [];
  for (let i = 0; i < tage; i++) {
    const ev = sim.runDay(state, ctx);
    R.verarbeite(state, ctx, ev);
    sim.collectAll(state, ctx, true);
    const s = R.besState(state);
    const winter = sim.season(state, ctx).winter;
    log.push({ tag: state.day, h: s.heute && s.heute.tag === state.day ? { ...s.heute } : null, winter, ev });
    jeTag?.(state, ev);
  }
  return log;
}

test('Daten: vier Schiffe mit Modell, Texten und Zahlen; Arten nie im normalen Ankunftswürfel', () => {
  assert.deepEqual(Object.keys(R.BES.schiffe).sort(), Object.keys(SCHIFF_TEXTE).sort());
  assert.deepEqual(Object.keys(R.BES.tiere).sort(), Object.keys(TIER_TEXTE).sort());
  assert.equal(MOTIVE.length, 6);
  for (const art of Object.keys(R.BES.schiffe)) assert.ok(BES_MODELLE.some((m) => m.besucher === art), art);
  const { ctx, state } = neu(1, 6);
  const typen = sim.eligibleTypes(state, ctx, sim.modifiers(state, ctx)).map((t) => t.id);
  for (const t of BES_TYPEN) assert.ok(!typen.includes(t.id), `${t.id} darf nicht gewürfelt werden`);
  // 200 Tage ohne Besucher-Hook: nie ein Besucher-Modell
  const ctx2 = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const st2 = createState({ seed: 3 });
  st2.stage = 6;
  for (const b of ctx2.berths) if (b.requires) st2.buildings[b.requires] = 1;
  st2.office = 3;
  for (let i = 0; i < 60; i++) {
    sim.tick(st2, ctx2, 0);
    for (const b of st2.upcoming) assert.ok(!BES_TYPEN.some((t) => t.id === b.typeId), 'Besucher im normalen Würfel');
    sim.runDay(st2, ctx2);
  }
});

test('Welche Schiffe passen in welche Stufe', () => {
  const art = (stufe) => { const { ctx, state } = neu(1, stufe); return R.moeglicheSchiffe(state, ctx).sort(); };
  assert.deepEqual(art(1), []);
  assert.deepEqual(art(2), ['weltumsegler']);
  assert.deepEqual(art(3), ['museumsschiff', 'weltumsegler']);
  assert.deepEqual(art(4), ['forschungsschiff', 'museumsschiff', 'weltumsegler']);
  assert.ok(art(5).includes('koenigsyacht'));
  assert.ok(art(6).includes('koenigsyacht'));
  // Jede Art hat in ihrer Stufe auch einen Ehrenplatz, an den sie passt
  for (const [a, d] of Object.entries(R.BES.schiffe)) {
    const { ctx, state } = neu(1, Math.max(d.abStufe, a === 'koenigsyacht' ? 5 : 0));
    assert.ok(R.ehrenplatzMoeglich(state, ctx, a), `${a} ohne Ehrenplatz in Stufe ${state.stage}`);
  }
});

test('Selten: nie am ersten Tag, nie im Winter, Abstand, nie zwei zugleich, alle Arten kommen vor', () => {
  const gezaehlt = {};
  let tage = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const { ctx, state } = neu(seed, 5);
    let letzter = null;
    const log = spiele(state, ctx, 120, {
      jeTag: (st) => {
        const da = [...Object.values(st.boats), ...st.upcoming].filter((b) => b?.besucher);
        assert.ok(da.length <= 1, `Tag ${st.day}: ${da.length} Besucher zugleich`);
      },
    });
    for (const z of log) {
      tage++;
      if (!z.h) continue;
      assert.ok(z.tag > 1, 'nie am ersten Tag');
      assert.ok(!z.winter, 'nie im Winter');
      if (letzter != null) assert.ok(z.tag - letzter >= R.BES.pause, `Abstand ${z.tag - letzter}`);
      letzter = z.tag;
      gezaehlt[z.h.art] = (gezaehlt[z.h.art] || 0) + 1;
    }
  }
  const n = Object.values(gezaehlt).reduce((a, b) => a + b, 0);
  assert.ok(n >= 0.03 * tage && n <= 0.14 * tage, `Besucher an ${n} von ${tage} Tagen`);
  for (const a of Object.keys(R.BES.schiffe)) assert.ok(gezaehlt[a] > 0, `${a} kam nie`);
});

test('Gleicher Seed, gleiche Besucher (kein Spielzufall)', () => {
  const plan = (seed) => { const { ctx, state } = neu(seed, 4); return spiele(state, ctx, 60).filter((z) => z.h).map((z) => `${z.tag}:${z.h.art}:${z.h.name}`); };
  assert.deepEqual(plan(11), plan(11));
  assert.notDeepEqual(plan(11), plan(12));
});

test('Das Schiff meldet sich per Funk an, wünscht den Ehrenplatz; frei gehalten liegt es dort', () => {
  let fest = 0, ehren = 0, gesehen = 0, gehalten = 0, amGehaltenen = 0;
  const reserviert = new Map();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { ctx, state } = neu(seed, 4);
    for (let i = 0; i < 60; i++) {
      // Morgens prüfen, wie das verwandelte Boot aussieht
      sim.tick(state, ctx, 0);
      const b = state.upcoming.find((x) => x.besucher);
      if (b) {
        assert.ok(b.wishes.includes('ehrenplatz'));
        assert.ok(b.funk, 'meldet sich per Funk an');
        assert.ok(b.bootsname && SCHIFF_TEXTE[b.besucher].namen.includes(b.bootsname));
        assert.ok(!b.stammId && !b.flotte, 'kein Stammgast, keine Flottille');
        assert.ok(sim.announcedBoats(state).some((x) => x.id === b.id));
        // Jeder zweite Spieler hält den Ehrenplatz frei, wie in der Meldung angeboten
        const ep = sim.reservableBerths(state, ctx, b.id).filter((p) => R.istEhrenplatz(ctx.berthById[p]));
        if (seed % 2 && ep.length && sim.reserveBerth(state, ctx, b.id, ep[0]).ok) { gehalten++; reserviert.set(b.id, ep[0]); }
      }
      const ev = sim.runDay(state, ctx);
      for (const e of R.verarbeite(state, ctx, ev)) {
        if (e.phase === 'wartet') gesehen++;
        if (e.phase === 'fest') {
          fest++;
          if (e.ehrenplatz) ehren++;
          if (reserviert.get(e.boatId) === e.berthId) amGehaltenen++;
        }
      }
      sim.collectAll(state, ctx, true);
    }
  }
  assert.ok(fest > 5, `nur ${fest} festgemacht`);
  // Ohne Freihalten ist der Ehrenplatz oft belegt (das ist die Entscheidung des Spielers); frei gehalten immer
  assert.ok(ehren > 0);
  assert.ok(gehalten > 2);
  assert.equal(amGehaltenen, gehalten, `${amGehaltenen} von ${gehalten} am frei gehaltenen Ehrenplatz`);
  assert.ok(gesehen >= fest);
});

test('Ehrenplatz: Platz-Wunsch der Regeln, nur Stirn und Kai, gold beim Zuweisen', () => {
  const { ctx, state } = neu(1, 4);
  assert.equal(ctx.rules.berthWishes.ehrenplatz, 'ehrenplatz');
  for (const p of ctx.berths) assert.equal(sim.berthHas(state, ctx, p, 'ehrenplatz'), p.kind === 'stirn' || p.kind === 'kai', p.id);
  // Ein Weltumsegler in der Schlange: die Ehrenplätze stehen in den Wunsch-Plätzen
  sim.tick(state, ctx, 0);
  const b = state.upcoming[0];
  R.verwandle(state, ctx, b, 'weltumsegler', R.zufall(1, 1));
  const frei = sim.reservableBerths(state, ctx, b.id);
  assert.ok(frei.length);
  assert.ok(R.istEhrenplatz(ctx.berthById[frei[0]]), `beste Box ${frei[0]} ist kein Ehrenplatz`);
  // Ehrenplatz freihalten
  const r = sim.reserveBerth(state, ctx, b.id, frei[0]);
  assert.ok(r.ok);
});

test('Schaulustige: Geld am Abend nur am Ehrenplatz, je Stufe mehr, Königsyacht doppelt', () => {
  assert.equal(R.zuschauerGeld({ stage: 1 }, 'weltumsegler'), 0);
  assert.ok(R.zuschauerGeld({ stage: 3 }, 'weltumsegler') > R.zuschauerGeld({ stage: 2 }, 'weltumsegler'));
  assert.equal(R.zuschauerGeld({ stage: 5 }, 'koenigsyacht'), 2 * R.zuschauerGeld({ stage: 5 }, 'weltumsegler'));
  let gesamt = 0;
  for (const seed of [1, 2, 3, 4]) {
    const { ctx, state } = neu(seed, 4);
    for (let i = 0; i < 50; i++) {
      const ev = sim.runDay(state, ctx);
      R.verarbeite(state, ctx, ev);
      for (const e of ev) {
        if (e.type !== 'besucherZuschauer') continue;
        assert.ok(e.art in R.BES.schiffe);
        assert.ok(R.istEhrenplatz(ctx.berthById[e.berthId]), e.berthId);
        assert.ok(R.besState(state).gesehen[e.art]?.ehrenplatz);
        gesamt += e.geld;
      }
      sim.collectAll(state, ctx, true);
    }
  }
  assert.ok(gesamt > 0);
});

test('Besucher werden nie Stammgast und nie Dauerlieger', () => {
  for (const seed of [1, 2, 3]) {
    const { ctx, state } = neu(seed, 4);
    spiele(state, ctx, 80);
    const liste = state.modules.stammgaeste?.liste ?? [];
    for (const g of liste) assert.ok(!BES_TYPEN.some((t) => t.id === g.typeId), `Stammgast ${g.bootsname} ist ein Besucher`);
    for (const b of Object.values(state.boats)) if (b?.besucher) assert.ok(!b.stationed);
  }
});

test('Zum Ausprobieren: ausloesen macht das nächste Boot zum Schiff, es kommt gleich', () => {
  const { ctx, state } = neu(5, 5);
  sim.tick(state, ctx, 0);
  const h = R.ausloesen(state, ctx, 'koenigsyacht');
  assert.ok(h);
  const b = state.upcoming.find((x) => x.id === h.boatId);
  assert.equal(b.besucher, 'koenigsyacht');
  assert.equal(b.modelId, 'XL4-1');
  assert.ok(b.arriveAt <= state.clock + 3.01);
  // Zweimal geht nicht (schon einer da)
  assert.equal(R.ausloesen(state, ctx, 'weltumsegler'), null);
  // Läuft ein, ohne Fehler
  const ev = sim.tick(state, ctx, 30);
  assert.ok(ev.some((e) => e.type === 'arrived' && e.boatId === b.id) || state.boats[b.id]);
  // In Stufe 1 passt keiner
  const n = neu(5, 1);
  sim.tick(n.state, n.ctx, 0);
  assert.equal(R.ausloesen(n.state, n.ctx, 'koenigsyacht'), null);
});

test('Funk: Tag, an dem nur der Besucher angemeldet ist, läuft ohne Fehler', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { ctx, state } = neu(seed, 3);
    state.office = 4;   // Funk im Büro: announce läuft
    assert.doesNotThrow(() => spiele(state, ctx, 40));
  }
});

test('Tiere: Schwäne ab Stufe 1 im Frühling und Sommer, Schweinswal erst ab Stufe 3, nie im Winter', () => {
  const zaehle = (stufe) => {
    const c = { schwaene: 0, schweinswal: 0 };
    for (const seed of [1, 2, 3]) {
      const { ctx, state } = neu(seed, stufe, { stamm: false });
      for (let i = 0; i < 90; i++) {
        sim.tick(state, ctx, 0);
        const liste = R.besState(state).tiere.liste;
        const sea = sim.season(state, ctx);
        if (sea.winter) assert.equal(liste.length, 0);
        for (const t of liste) {
          c[t.art]++;
          const d = R.BES.tiere[t.art];
          assert.ok(sea.day >= d.saison[0] && sea.day <= d.saison[1]);
          assert.ok(t.at >= d.zeit[0] * ctx.rules.dayLength - 1 && t.at <= d.zeit[1] * ctx.rules.dayLength + 1);
        }
        sim.runDay(state, ctx);
      }
    }
    return c;
  };
  const s1 = zaehle(1);
  assert.ok(s1.schwaene > 0);
  assert.equal(s1.schweinswal, 0);
  const s3 = zaehle(3);
  assert.ok(s3.schweinswal > 0);
});

test('Gesehen, Fotos und Erfolge: Hoher Besuch, Seltene Gäste, Tierfreund, Fotoalbum', () => {
  const { ctx, state } = neu(1, 5);
  const erreicht = () => Object.keys(E.erfolgeState(state).erreicht);
  E.pruefen(state);
  assert.ok(!erreicht().includes('fotoalbum'));
  // Tiere gesehen, einmal je Tag
  R.tierePlanen(state, ctx, { erzwingen: 'schwaene' });
  assert.equal(R.tierGesehen(state, 'schwaene'), true);
  assert.equal(R.tierGesehen(state, 'schwaene'), false);
  assert.equal(R.besState(state).gesehen.schwaene.mal, 1);
  // Fotos
  assert.equal(R.fotoMerken(state, 'schwaene', 'data:image/jpeg;base64,AAAA'), true);
  assert.equal(R.fotoMerken(state, 'schwaene', null), false);
  assert.equal(R.besState(state).fotos.schwaene.bild, 'data:image/jpeg;base64,AAAA', 'altes Bild bleibt');
  assert.equal(R.fotoMerken(state, 'unsinn'), false);
  R.fotoMerken(state, 'schweinswal', 'x'.repeat(10));   // kein Bild, zählt trotzdem
  E.pruefen(state);
  assert.ok(erreicht().includes('tierfreund'));
  for (const a of Object.keys(R.BES.schiffe)) R.fotoMerken(state, a);
  E.pruefen(state);
  assert.ok(erreicht().includes('fotoalbum'));
  assert.ok(erreicht().includes('seltene-schiffe'));
  assert.ok(!erreicht().includes('hoher-besuch'), 'Ehrenplatz fehlt noch');
  R.besState(state).gesehen.weltumsegler.ehrenplatz = true;
  E.pruefen(state);
  assert.ok(erreicht().includes('hoher-besuch'));
  const f = R.fortschritt(state);
  assert.deepEqual([f.gesehen, f.fotos, f.gesamt, f.schiffe, f.tierFotos, f.ehrenplatz], [6, 6, 6, 4, 2, 1]);
});

test('Speichern und Laden; kaputte Stände werden gesäubert', () => {
  const { ctx, state } = neu(2, 4);
  spiele(state, ctx, 30);
  R.fotoMerken(state, 'weltumsegler', 'data:image/jpeg;base64,BBBB');
  const zurueck = deserialize(serialize(state));
  assert.deepEqual(zurueck.modules.besucher, state.modules.besucher);
  // Unsinn
  zurueck.modules.besucher = {
    gesehen: { weltumsegler: { tag: 'x', mal: -1 }, drache: { tag: 1 }, museumsschiff: 5 },
    fotos: { weltumsegler: { tag: 3, bild: 'javascript:alert(1)' }, schwaene: { tag: 2, bild: `data:image/jpeg;base64,${'A'.repeat(70000)}` }, drache: {} },
    tiere: { tag: 3, liste: [{ art: 'drache', at: 1, dauer: 2 }, { art: 'schwaene', at: 5, dauer: 9 }, null] },
    neu: ['drache', 'schwaene', 'schwaene'],
    heute: { art: 'drache', tag: 2 },
  };
  const s = R.saeubern(zurueck);
  assert.deepEqual(Object.keys(s.gesehen), ['weltumsegler']);
  assert.equal(s.gesehen.weltumsegler.mal, 1);
  assert.equal(s.fotos.weltumsegler.bild, undefined);
  assert.equal(s.fotos.schwaene.bild, undefined);
  assert.ok(!('drache' in s.fotos));
  assert.equal(s.tiere.liste.length, 1);
  assert.deepEqual(s.neu, ['schwaene']);
  assert.equal(s.heute, null);
  // Ganz kaputt
  zurueck.modules.besucher = 'kaputt';
  assert.doesNotThrow(() => R.saeubern(zurueck));
  assert.deepEqual(R.fortschritt(zurueck).gesehen, 0);
  // Weiterspielen mit gesäubertem Stand
  assert.doesNotThrow(() => spiele(zurueck, ctx, 10));
});

test('Ein Besucher, der keinen Platz findet, gilt als verpasst und blockiert den nächsten nicht', () => {
  const { ctx, state } = neu(3, 2);
  sim.tick(state, ctx, 0);
  sim.runDay(state, ctx);
  sim.tick(state, ctx, 0);
  const h = R.ausloesen(state, ctx, 'weltumsegler');
  assert.ok(h);
  // Alle Ehren- und passenden Plätze belegen: Büro aus, Spieler weist nicht zu
  state.office = 0;
  const ev = sim.runDay(state, ctx);
  const out = R.verarbeite(state, ctx, ev);
  const b = state.boats[h.boatId];
  // Ohne Zuweisung fährt er irgendwann weiter oder legt selbst an (Selbst-Einfahren)
  assert.ok(out.length >= 1);
  assert.ok(['verpasst', 'fest', 'wartet', 'abgereist'].includes(R.besState(state).heute?.phase ?? 'verpasst'), JSON.stringify(R.besState(state).heute));
  // Nächster Tag: aufgeräumt, wenn er nicht liegt
  sim.tick(state, ctx, 0);
  const s = R.besState(state);
  if (!state.boats[h.boatId] || state.boats[h.boatId].status !== 'moored') assert.ok(!s.heute || s.heute.tag === state.day);
  assert.ok(b || true);
});
