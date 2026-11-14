// P55 "Versteckte Regeln sichtbar machen": Geduldsring, Auslastung der Versorgung, Zeiger am Bildrand.
// Reine Rechnungen aus ui/geduldsring.js und ui/hafenzeichen.js, dazu die Regeln in sim.js
// (Geduld ruht abends, Auslastung je Versorgung).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as sim from '../web/js/sim.js';
import { ringZustand, ringRaster, ringBild, RING_SCHRITTE } from '../web/js/ui/geduldsring.js';
import { auslastungStufe, auslastungText, randPunkt, randWeg, punktAmRand, buendeln } from '../web/js/ui/hafenzeichen.js';

const rules = sim.rulesFromEconomy(ECONOMY);
const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });

function quietState(stage = 1) {
  const s = sim.applyTestStage(createState({ seed: 3, rules }), ctx, stage);
  s.scheduledDay = s.day;
  s.upcoming = [];
  s.queue = [];
  for (const [id, b] of Object.entries(s.boats)) if (!b.stationed) delete s.boats[id];
  for (const [pid, bid] of Object.entries(s.berths)) if (!s.boats[bid]) delete s.berths[pid];
  s.leaving = {};
  return s;
}
function waitingBoat(s, props = {}) {
  const boat = {
    id: s.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S',
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: s.clock, atBuoy: true, atBuoySince: s.clock,
    berthId: null, waitSpot: s.queue.length, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  };
  s.boats[boat.id] = boat;
  s.queue.push(boat.id);
  return boat;
}

test('Ring: Farbe nach Dritteln, nie leer solange Geduld bleibt, ruht grau', () => {
  assert.deepEqual(ringZustand(30, 30), { anteil: 1, schritt: RING_SCHRITTE, farbe: 'gruen', eilig: false });
  assert.equal(ringZustand(20.5, 30).farbe, 'gruen');
  assert.equal(ringZustand(20, 30).farbe, 'gelb', 'genau zwei Drittel ist schon gelb');
  assert.equal(ringZustand(10.5, 30).farbe, 'gelb');
  const rot = ringZustand(10, 30);
  assert.equal(rot.farbe, 'rot');
  assert.equal(rot.eilig, true);
  assert.equal(ringZustand(0.01, 30).schritt, 1, 'ein Rest Geduld zeigt mindestens einen Schritt');
  assert.equal(ringZustand(0, 30).schritt, 0);
  assert.equal(ringZustand(-5, 30).anteil, 0);
  assert.equal(ringZustand(99, 30).anteil, 1);
  const ruht = ringZustand(5, 30, false);
  assert.equal(ruht.farbe, 'pause');
  assert.equal(ruht.eilig, false, 'ruhende Geduld blinkt nicht');
  assert.equal(ringZustand(5, 0).anteil, 0, 'ohne Geduld kein Teilen durch null');
  // Schritte steigen mit der Geduld, nie sinkend
  let vorher = -1;
  for (let r = 0; r <= 30; r += 0.25) {
    const z = ringZustand(r, 30);
    assert.ok(z.schritt >= vorher, `Schritt fällt bei ${r}`);
    vorher = z.schritt;
  }
});

test('Ringbild: 12 x 12, voller Ring hat keine leeren Stellen, leerer keine vollen', () => {
  const voll = ringRaster(RING_SCHRITTE);
  const leer = ringRaster(0);
  assert.equal(voll.length, 12);
  assert.ok(voll.every((z) => z.length === 12));
  const zaehle = (r, c) => r.join('').split('').filter((x) => x === c).length;
  assert.equal(zaehle(voll, '-'), 0);
  assert.equal(zaehle(leer, '#'), 0);
  assert.equal(zaehle(voll, '#'), zaehle(leer, '-'));
  assert.ok(zaehle(voll, '#') > 30, 'der Ring ist gut sichtbar');
  // halb: etwa die Hälfte der Ringpunkte, rechte Hälfte (Uhrzeigersinn ab oben)
  const halb = ringRaster(RING_SCHRITTE / 2);
  const n = zaehle(halb, '#');
  assert.ok(Math.abs(n - zaehle(voll, '#') / 2) <= 2, `halb: ${n}`);
  assert.ok(halb.every((z) => !z.slice(0, 5).includes('#')), 'linke Hälfte ist abgelaufen');
  // Bilder werden zwischengespeichert
  assert.equal(ringBild(ringZustand(10, 30)), ringBild(ringZustand(10, 30)));
  assert.notEqual(ringBild(ringZustand(10, 30)), ringBild(ringZustand(10, 30, false)));
  assert.match(ringBild(ringZustand(30, 30)), /^url\("data:image\/svg\+xml,/);
});

test('Auslastung: frei, knapp ab dem letzten Fünftel, voll', () => {
  assert.equal(auslastungStufe(0, 20), 'frei');
  assert.equal(auslastungStufe(15, 20), 'frei');
  assert.equal(auslastungStufe(16, 20), 'knapp');
  assert.equal(auslastungStufe(19, 20), 'knapp');
  assert.equal(auslastungStufe(20, 20), 'voll');
  assert.equal(auslastungStufe(25, 20), 'voll');
  // kleine Anlage: der letzte Platz ist knapp
  assert.equal(auslastungStufe(3, 6), 'frei');
  assert.equal(auslastungStufe(4, 6), 'knapp');
  assert.equal(auslastungStufe(5, 6), 'knapp');
  assert.equal(auslastungStufe(0, 1), 'knapp');
  assert.equal(auslastungStufe(3, 0), 'frei', 'nicht gebaut: kein Schild, keine Warnung');
  const t = auslastungText('dusche', 14, 20);
  assert.equal(t.kurz, '14/20');
  assert.match(t.titel, /^Dusche: heute 14 von 20 Booten versorgt/);
  assert.equal(auslastungText('wc', 25, 20).kurz, '20/20', 'nie mehr als die Kapazität');
  assert.match(auslastungText('essen', 20, 20).titel, /für heute voll/);
});

test('Zeiger: Randpunkt in Richtung des Boots, Weg entlang des Rands hin und zurück', () => {
  const r = { l: 30, t: 30, r: 370, b: 630 };
  const oben = randPunkt({ x: 200, y: -400 }, r);
  assert.equal(oben.y, 30);
  assert.ok(Math.abs(oben.winkel + 90) < 8, `nach oben: ${oben.winkel}`);
  const rechts = randPunkt({ x: 2000, y: 330 }, r);
  assert.equal(rechts.x, 370);
  assert.equal(Math.round(rechts.winkel), 0);
  const links = randPunkt({ x: -500, y: 600 }, r);
  assert.equal(links.x, 30);
  // Mittelpunkt selbst: kein Fehler, zeigt nach oben
  const mitte = randPunkt({ x: 200, y: 330 }, r);
  assert.ok(Number.isFinite(mitte.x) && Number.isFinite(mitte.y));
  for (const p of [oben, rechts, links, randPunkt({ x: 380, y: 700 }, r), randPunkt({ x: 10, y: 10 }, r)]) {
    const q = punktAmRand(p.s, r);
    assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 0.6, `Weg ${p.s}`);
    assert.ok(Math.abs(randWeg(q.x, q.y, r) - p.s) < 0.6);
  }
  // Weg über den Umfang hinaus läuft ringsum weiter
  const U = 2 * (340 + 600);
  const a = punktAmRand(10, r), b = punktAmRand(10 + U, r), c = punktAmRand(10 - U, r);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('Zeiger bündeln: nah beieinander wird einer, auch über die Ecke links oben', () => {
  const g = buendeln([{ s: 100 }, { s: 120 }, { s: 300 }, { s: 330 }, { s: 900 }], 44);
  assert.deepEqual(g.map((x) => x.length), [2, 2, 1]);
  const ring = buendeln([{ s: 5 }, { s: 1870 }, { s: 600 }], 44, 1880);
  assert.equal(ring.length, 2);
  const ecke = ring.find((x) => x.length === 2);
  assert.ok(ecke && ecke.some((z) => z.s === 5) && ecke.some((z) => z.s === 1870 - 1880), 'Gruppe über die Ecke');
  const mitte = ecke.reduce((t, z) => t + z.s, 0) / ecke.length;
  assert.ok(Math.abs(mitte) < 10, 'Mitte der Gruppe liegt an der Ecke, nicht gegenüber');
  assert.deepEqual(buendeln([], 44), []);
});

test('Geduld ruht abends: Wert bleibt stehen, Boot fährt nicht weg', () => {
  const s = quietState(1);
  s.clock = rules.dayLength - 10;
  const b = waitingBoat(s);
  s.clock = rules.dayLength - 4;
  // keine passende Box: alle belegt markieren, damit es nicht selbst einfährt
  for (const p of sim.availableBerths(s, ctx)) if (!s.berths[p.id]) s.berths[p.id] = -1;
  const amAbend = rules.queue.patience - 6;
  assert.equal(sim.patienceLeft(s, ctx, b.id), amAbend);
  assert.equal(sim.patienceRunning(s, ctx, b.id), true);
  sim.tick(s, ctx, 8);
  assert.equal(s.phase, 'evening');
  assert.equal(s.boats[b.id].status, 'waiting');
  assert.equal(sim.patienceRunning(s, ctx, b.id), false);
  const a1 = sim.patienceLeft(s, ctx, b.id);
  sim.tick(s, ctx, Math.min(40, rules.eveningLength - 20));
  assert.equal(sim.patienceLeft(s, ctx, b.id), a1, 'abends steht die Geduld');
  assert.equal(a1, rules.queue.patience - 10, 'genau der Stand bei Tagesende');
  assert.equal(s.boats[b.id].status, 'waiting');
});

test('Geduld nach einer Nacht an der Boje ruht bis zum Vormittag, Anfahrt zählt nicht', () => {
  const s = quietState(1);
  const b = waitingBoat(s, { overnight: 1, atBuoySince: 0 });
  s.clock = 5;
  s.phase = 'day';
  assert.equal(sim.patienceRunning(s, ctx, b.id), false);
  assert.equal(sim.patienceLeft(s, ctx, b.id), rules.queue.patience);
  s.clock = sim.patienceFrom(s, ctx, b) + 3;
  assert.equal(sim.patienceRunning(s, ctx, b.id), true);
  assert.equal(sim.patienceLeft(s, ctx, b.id), rules.queue.patience - 3);
  const anfahrt = waitingBoat(s, { atBuoy: false });
  assert.equal(sim.patienceRunning(s, ctx, anfahrt.id), false);
  assert.equal(sim.patienceLeft(s, ctx, anfahrt.id), rules.queue.patience);
  assert.equal(sim.patienceRunning(s, ctx, 99999), false);
});

test('Auslastung aus den Regeln: nur gebaute Versorgung, zählt mit dem Anlegen und neu am Morgen', () => {
  const s = quietState(3);
  const last = sim.facilityLoad(s, ctx);
  for (const [key, v] of Object.entries(last)) {
    assert.ok(v.kapazitaet > 0, key);
    assert.equal(v.kapazitaet, sim.facilityCapacity(s, ctx, key));
    assert.equal(v.versorgt, 0);
  }
  assert.ok(!('strom' in last), 'Strom ist ein Platz-Wunsch, keine Versorgung mit Kapazität');
  for (const key of Object.keys(rules.facilities)) {
    if (sim.facilityCapacity(s, ctx, key) === 0) assert.ok(!(key in last), `${key} ungebaut ohne Schild`);
  }
  const key = Object.keys(last)[0];
  s.served = { [key]: 3 };
  assert.equal(sim.facilityLoad(s, ctx)[key].versorgt, 3);
});
