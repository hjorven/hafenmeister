// Neue Gästewünsche (Roadmap P31, F9 und B8, docs/gaestewuensche.md): Frischwasser am Steg, WLAN,
// Waschmaschine, Absaugstation und Hafenrundfahrt mit der Barkasse. Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { WUNSCH_TEXTE, VERSORGUNG_TEXTE } from '../web/js/data/wuensche-texte.js';
import { ANGEBOT_BILDER, NEUE_BILDER } from '../web/js/ui/wunsch-bilder.js';
import { GRUND, satz } from '../web/js/ui/gaestebuch-daten.js';
import { angebote, kaufen, haengeEin, betroffenePlaetze } from '../web/js/features/nachruesten.js';
import { waehleSchritt } from '../web/js/ui/bauen-rat.js';

const NEU = ['wasser', 'wlan', 'waesche', 'absaugen'];

function neu({ seed = 4, stufe = 5, offers = {}, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  sim.addHook(ctx, 'modifiers', () => ({ offers }));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  state.money = money;
  haengeEin((n, f) => sim.addHook(ctx, n, f), () => state);
  return { ctx, state };
}

// Ein wartendes Boot einer Art mit festen Wünschen und Nächten
function boot(state, ctx, { typ = 'L1', wishes, nights = 2 } = {}) {
  const t = ctx.typeById[typ];
  const b = sim.rollBoat(state, ctx);
  Object.assign(b, { id: state.nextId++, typeId: t.id, size: t.size, kind: t.kind, motor: t.motor,
    length: t.length[0], beam: t.beam[0], draft: t.draft[0], wishes: [...wishes], nights, status: 'waiting', waitingSince: 0 });
  delete b.stay;
  state.boats[b.id] = b;
  state.queue.push(b.id);
  return b;
}

test('B8: in jeder Ausbaustufe kommt mindestens ein neuer Wunsch dazu', () => {
  const stufen = ECONOMY.stufen.map((s) => s.stufe);
  const alle = { ...ECONOMY.wuensche, ...ECONOMY.angebotWunsch.wuensche };
  for (const st of stufen) {
    const neuHier = Object.entries(alle).filter(([, w]) => w.abStufe === st).map(([k]) => k);
    assert.ok(neuHier.length >= 1, `Stufe ${st} ohne neuen Wunsch`);
  }
  assert.equal(ECONOMY.wuensche.wasser.abStufe, 2);
  assert.equal(ECONOMY.wuensche.wlan.abStufe, 3);
  assert.equal(ECONOMY.wuensche.waesche.abStufe, 4);
  assert.equal(ECONOMY.wuensche.absaugen.abStufe, 5);
  assert.equal(ECONOMY.angebotWunsch.wuensche.barkasse.abStufe, 6);
  assert.ok(ECONOMY.angebotWunsch.wuensche.broetchen, 'Brötchen gibt es seit P19');
});

test('Jeder Wunsch hat Text, Bild, Gästebuch-Grund und Sätze; Versorgungswünsche ein Bauwerk', () => {
  for (const k of [...NEU, 'barkasse']) {
    const t = WUNSCH_TEXTE[k];
    assert.ok(t?.kurz && t.mit && t.fehlt && t.lang, `${k}: Texte`);
    assert.ok(t.saetze?.length >= 2, `${k}: Sätze`);
    const bild = NEUE_BILDER[k] ?? ANGEBOT_BILDER[k];
    assert.equal(bild?.raster.length, 12, `${k}: Bild 12 Zeilen`);
    assert.ok(bild.raster.every((z) => z.length === 12), `${k}: Bild 12 Spalten`);
    assert.ok(/^#[0-9a-f]{6}$/.test(bild.farbe), `${k}: Farbe`);
    assert.ok(GRUND[k]?.text, `${k}: Grund im Gästebuch`);
    assert.ok(satz({ id: 1, tag: 1, gruende: [{ key: k, n: 1 }], note: 2.5 }), `${k}: Satz im Gästebuch`);
  }
  for (const k of ['wlan', 'waesche', 'absaugen']) {
    assert.equal(ECONOMY.wuensche[k].durch, k);
    const b = ECONOMY.bauwerke[k];
    assert.ok(b?.stufen.length >= 2, `${k}: Bauwerk mit Stufen`);
    assert.equal(b.stufen[0].abStufe, ECONOMY.wuensche[k].abStufe, `${k}: baubar ab der Stufe, ab der man es wünscht`);
    for (let i = 1; i < b.stufen.length; i++) {
      assert.ok(b.stufen[i].versorgt > b.stufen[i - 1].versorgt && b.stufen[i].kosten > b.stufen[i - 1].kosten, `${k}: Stufe ${i + 1} größer und teurer`);
    }
  }
  assert.ok(VERSORGUNG_TEXTE.wasser, 'Frischwasser zählt zur Versorgung');
  assert.equal(ECONOMY.nachruesten.wasser.wunsch, 'wasser');
});

test('Bootsarten: neue Wünsche nur bei passenden Arten, nie bei Jollen, Fischern und Behördenbooten', () => {
  const art = Object.fromEntries(BOAT_CATALOG.map((t) => [t.id, t]));
  for (const t of BOAT_CATALOG) {
    for (const k of NEU) {
      if (!t.wishes?.includes(k)) continue;
      assert.ok(ECONOMY.wuensche[k].klassen.includes(t.size), `${t.id} (${t.size}) darf ${k} nicht haben`);
    }
  }
  assert.ok(!art.M4.wishes.length && !art.L4.wishes.length, 'Fischer und Behörden ohne Wünsche');
  assert.ok(BOAT_CATALOG.filter((t) => t.size === 'S').every((t) => !NEU.some((k) => t.wishes?.includes(k))));
  assert.ok(art.L1.wishes.includes('waesche') && art.L3.wishes.includes('absaugen') && art.M3.wishes.includes('wlan'));
});

test('Würfeln: neue Wünsche erst ab ihrer Stufe, Waschmaschine nur bei mindestens 3 Nächten', () => {
  for (const stufe of [2, 3, 4, 5, 6]) {
    const { ctx, state } = neu({ stufe, seed: 10 + stufe });
    const n = {};
    let kurzMitWaesche = 0;
    for (let i = 0; i < 600; i++) {
      const b = sim.rollBoat(state, ctx);
      if (!b) continue;
      for (const w of b.wishes) n[w] = (n[w] || 0) + 1;
      if (b.wishes.includes('waesche') && b.nights < ECONOMY.wuensche.waesche.abNaechte) kurzMitWaesche++;
    }
    assert.equal(kurzMitWaesche, 0, `Stufe ${stufe}: Wäsche bei kurzem Aufenthalt`);
    for (const k of NEU) {
      if (ECONOMY.wuensche[k].abStufe > stufe) assert.ok(!n[k], `Stufe ${stufe}: ${k} zu früh`);
    }
    if (stufe >= 3) assert.ok(n.wasser > 0 && n.wlan > 0, `Stufe ${stufe}: Wasser ${n.wasser}, WLAN ${n.wlan}`);
    if (stufe >= 5) assert.ok(n.waesche > 0 && n.absaugen > 0, `Stufe ${stufe}: Wäsche ${n.waesche}, Absaugen ${n.absaugen}`);
    if (stufe >= 6) assert.ok(n.barkasse > 0, 'Stufe 6: Hafenrundfahrt');
    if (stufe < 6) assert.ok(!n.barkasse, `Stufe ${stufe}: Barkasse zu früh`);
  }
});

test('Kurzhalt und Flottille: Waschmaschine fällt weg, wenn die Crew nicht lange bleibt', () => {
  const { ctx } = neu();
  const b = { wishes: ['dusche', 'waesche', 'wlan'], nights: 0 };
  sim.dropStayWishes(ctx, b);
  assert.deepEqual(b.wishes, ['dusche', 'wlan']);
  const c = { wishes: ['waesche'], nights: 3 };
  sim.dropStayWishes(ctx, c);
  assert.deepEqual(c.wishes, ['waesche']);
});

test('Frischwasser: Wasserhähne am Steg erfüllen den Wunsch, ohne sie fehlt er', () => {
  const { ctx, state } = neu({ stufe: 3 });
  const liste = angebote(state, ctx).filter((a) => a.art === 'wasser');
  // auch Steg A: kurze Kleinkreuzer (M) passen in die S-Boxen und wünschen sich Wasser
  assert.ok(liste.some((a) => a.steg === 'A') && liste.length >= 3, 'Wasserhähne an jedem Gaststeg');
  assert.ok(!liste.some((a) => a.steg === 'F'), 'Fischersteg ist fest vergeben');
  // ohne Wasserhähne
  const b1 = boot(state, ctx, { typ: 'M1', wishes: ['wasser'] });
  const p1 = sim.fittingBerths(state, ctx, b1.id)[0];
  const steg = ctx.berthById[p1].jetty;
  sim.assign(state, ctx, b1.id, p1);
  assert.equal(state.boats[b1.id].wishesMet, 0);
  assert.equal(state.boats[b1.id].missed.wasser, 1);
  // Wasserhähne an diesem Steg kaufen: nächster Gast dort bekommt Wasser, Platz leuchtet gold
  const geld = state.money;
  const r = kaufen(state, ctx, 'wasser', steg);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(state.money, geld - r.angebot.kosten);
  assert.ok(sim.berthHas(state, ctx, ctx.berthById[p1], 'water'));
  const b2 = boot(state, ctx, { typ: 'M1', wishes: ['wasser'] });
  // Die Platzwahl (Büro, Selbst-Einfahren, Goldplätze) zieht den Steg mit Wasser vor
  const beste = sim.fittingBerths(state, ctx, b2.id)[0];
  assert.equal(ctx.berthById[beste].jetty, steg, 'bester Platz am Steg mit Wasser');
  assert.equal(sim.berthWishHits(state, ctx, b2, ctx.berthById[beste]), 1);
  sim.assign(state, ctx, b2.id, beste);
  assert.equal(state.boats[b2.id].wishesMet, 1);
  // zweimal kaufen geht nicht
  assert.equal(kaufen(state, ctx, 'wasser', steg).grund, 'schon');
  assert.ok(!angebote(state, ctx).some((a) => a.art === 'wasser' && a.steg === steg));
});

test('WLAN, Waschmaschine, Absaugen: Versorgung mit Kapazität je Tag wie die Dusche', () => {
  const { ctx, state } = neu({ stufe: 5 });
  Object.assign(state.facilities, { wlan: 0, waesche: 0, absaugen: 0 });
  for (const k of ['wlan', 'waesche', 'absaugen']) {
    const b0 = boot(state, ctx, { typ: 'L1', wishes: [k], nights: 4 });
    sim.assign(state, ctx, b0.id, sim.fittingBerths(state, ctx, b0.id)[0]);
    assert.equal(state.boats[b0.id].wishesMet, 0, `${k}: ohne Bauwerk nicht erfüllt`);
    const u = sim.upgradeFacility(state, ctx, k);
    assert.ok(u.ok, `${k}: baubar in Stufe 5 (${JSON.stringify(u)})`);
    const b1 = boot(state, ctx, { typ: 'L1', wishes: [k], nights: 4 });
    sim.assign(state, ctx, b1.id, sim.fittingBerths(state, ctx, b1.id)[0]);
    assert.equal(state.boats[b1.id].wishesMet, 1, `${k}: mit Bauwerk erfüllt`);
    const last = sim.facilityLoad(state, ctx)[k];
    assert.equal(last.versorgt, 1);
    assert.equal(last.kapazitaet, ECONOMY.bauwerke[k].stufen[0].versorgt);
    // Kapazität voll: der Nächste geht leer aus
    state.served[k] = last.kapazitaet;
    const b2 = boot(state, ctx, { typ: 'L1', wishes: [k], nights: 4 });
    sim.assign(state, ctx, b2.id, sim.fittingBerths(state, ctx, b2.id)[0]);
    assert.equal(state.boats[b2.id].wishesMet, 0, `${k}: voll`);
  }
  // Wäscherei in Stufe 4 baubar, Absaugstation erst in Stufe 5
  const s4 = neu({ stufe: 4 });
  assert.ok(sim.upgradeFacility(s4.state, s4.ctx, 'waesche').ok);
  assert.equal(sim.upgradeFacility(s4.state, s4.ctx, 'absaugen').ok, false);
});

test('Barkasse: Hafenrundfahrt ist erfüllt, sobald die Barkasse gebaut ist', () => {
  for (const gebaut of [false, true]) {
    const { ctx, state } = neu({ stufe: 6, offers: gebaut ? { barkasse: 1 } : {} });
    const b = boot(state, ctx, { typ: 'L1', wishes: ['barkasse'] });
    sim.assign(state, ctx, b.id, sim.fittingBerths(state, ctx, b.id)[0]);
    assert.equal(state.boats[b.id].wishesMet, gebaut ? 1 : 0);
  }
});

test('Als Nächstes: fehlt Frischwasser, schlägt die Tafel Wasserhähne vor', () => {
  const eintraege = [
    { key: 'nachruesten:wasser:C', art: 'steg', nachruesten: 'wasser', wunsch: 'wasser', name: 'Wasserhähne an Hauptsteg C', kosten: 300 },
    { key: 'versorgung:wlan', art: 'versorgung', wunsch: 'wlan', stufeNeu: 1, name: 'WLAN am Hafenbüro', kosten: 650 },
  ];
  const s = waehleSchritt({ geld: 1000, eintraege, bedarf: { weg: 0, offen: { wasser: 4, wlan: 2 }, belegt: 3, plaetze: 20 }, stufe: null });
  assert.equal(s.ziel, 'nachruesten:wasser:C');
  assert.match(s.text, /Frischwasser/);
});

test('Spielstand: Wasserhähne bleiben nach Speichern und Laden erhalten', async () => {
  const { ctx, state } = neu({ stufe: 3 });
  const a = angebote(state, ctx).find((x) => x.art === 'wasser' && !x.gesperrt);
  assert.ok(kaufen(state, ctx, 'wasser', a.steg).ok);
  const kopie = JSON.parse(JSON.stringify(state));
  assert.deepEqual(kopie.modules.nachruesten.wasser, [a.steg]);
  const p = betroffenePlaetze(kopie, ctx, 'wasser', a.steg)[0];
  assert.ok(sim.berthHas(kopie, ctx, p, 'water') || sim.berthHas(state, ctx, p, 'water'));
});
