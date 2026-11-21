// Tests für die Figuren selbst (web/js/render/people.js): Crews an Bord und an Land, Rundgang des
// Hafenmeisters. Das Modul läuft hier ohne Browser: Three.js kommt aus web/vendor/, das Spiel ist
// eine kleine Attrappe mit Ereignissen und Takt.
// Ausführen im Repo-Ordner:  node --test tests/menschen-figuren.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'package.json'), 'utf8')).devDependencies.three;
const THREE_URL = pathToFileURL(path.join(ROOT, 'web', 'vendor', `three-${VERSION}`, 'build', 'three.module.js')).href;
// Im Browser löst die Importmap 'three' auf, hier ein kleiner Lade-Haken
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s, c, next) { return s === 'three' ? { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true } : next(s, c); }`,
));
globalThis.location ??= { search: '' };

const THREE = await import('three');
const { init } = await import('../web/js/render/people.js');
const { formSetzen } = await import('../web/js/render/landschaft/formen.js');
const { HAFEN } = await import('../web/js/data/harbor.js');

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const mikro = () => new Promise((r) => setImmediate(r));

// Spiel-Attrappe: Ereignisse, Takt, Szene. services: Angebote an Land mit Lage in Planeinheiten.
async function spiel({ stufe = 3, services = [], sim = null, suche = '' } = {}) {
  formSetzen(1, 1);
  globalThis.location = { search: suche };
  const hoerer = new Map(), takte = [];
  const gruppe = new THREE.Group();
  for (const s of services) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    m.name = `service-${s.id}`;
    m.position.set(s.x * U, 1, -s.y * U);
    gruppe.add(m);
  }
  gruppe.updateMatrixWorld(true);
  const game = {
    time: 0,
    scene: { add() {}, getObjectByName: () => null },
    services: { gruppe },
    sim,
    on(name, fn) { if (!hoerer.has(name)) hoerer.set(name, []); hoerer.get(name).push(fn); },
    emit(name, daten) { for (const fn of hoerer.get(name) ?? []) fn(daten); },
    onTick(fn) { takte.push(fn); },
  };
  const api = init(game);
  game.emit('stufe', stufe);
  await mikro();
  // sek Sekunden Spielzeit in Schritten wie im Spiel
  const tick = (sek, dt = 0.25) => { for (let t = 0; t < sek; t += dt) { game.time += dt; for (const fn of takte) fn(dt); } };
  const crew = (id) => api._agenten.filter((a) => a.boot === String(id) && a.zustand !== 'entfernt');
  return { game, api, tick, crew };
}

// Plätze der Stufe, die am Land hängen
function plaetzeAmLand(api) {
  const fest = api.netz.flaechen.festland;
  return [...api.netz.plaetze].filter(([, p]) => api.netz.komp[p.einstieg] === fest).map(([id]) => id);
}

test('Umgelegtes Boot: die Crew gehört danach zum neuen Platz und geht dort wieder an Land', async () => {
  const { game, api, tick, crew } = await spiel();
  const ids = plaetzeAmLand(api);
  const alt = ids[0], neu = ids[ids.length - 1];
  assert.notEqual(alt, neu);
  game.emit('boot:angelegt', { id: 7, platz: alt, groesse: 'M', crew: 4 });
  game.emit('boat:moored', { id: 7, berth: alt, size: 'm' });
  tick(40);
  assert.ok(crew(7).some((a) => a.zustand !== 'anbord'), 'Crew geht nach dem Anlegen an Land');
  // Umlegen wie boat-anim.js dock() aus dem Zustand "festgemacht": Leinen los, kein boat:left
  game.emit('boat:cast-off', { id: 7 });
  tick(5);
  game.emit('boat:moored', { id: 7, berth: neu, size: 'm' });
  const knoten = api.netz.plaetze.get(neu).node;
  assert.equal(crew(7).length, 4, 'Crew bleibt gleich groß');
  assert.ok(crew(7).every((a) => a.node === knoten), 'Crew ist am neuen Platz an Bord');
  let anLand = false;
  for (let k = 0; k < 200 && !anLand; k++) { tick(1); anLand = crew(7).some((a) => a.zustand !== 'anbord'); }
  assert.ok(anLand, 'Crew geht am neuen Platz wieder an Land');
});

test('Voller Hafen (alle Figuren vergeben): der Hafenmeister geht abends trotzdem seine Runde', async () => {
  const offen = new Set();
  const sim = { istBezahlt: (boot, platz) => !offen.has(platz) };
  const { game, api, tick } = await spiel({ stufe: 5, sim, suche: '?stufe=5&leute=voll' });
  game.emit('ready');
  await mikro(); await mikro();
  tick(5);
  const lebend = () => api._agenten.filter((a) => a.zustand !== 'entfernt').length;
  // Auffüllen bis zur Obergrenze: so viele Boote anlegen, bis keine Figur mehr frei ist
  const ids = plaetzeAmLand(api);
  for (let k = 0; k < ids.length && lebend() < 299; k++) {
    game.emit('boot:angelegt', { id: 1000 + k, platz: ids[k], groesse: 'L', crew: 8 });
    game.emit('boat:moored', { id: 1000 + k, berth: ids[k], size: 'l' });
  }
  tick(60);
  assert.equal(lebend(), 299, 'alle Figuren bis auf die des Hafenmeisters sind vergeben');
  for (const id of ids.slice(0, 5)) offen.add(id);
  let halte = 0;
  game.on('hafenmeister:halt', () => { halte++; });
  game.emit('phase', 'abend');
  assert.ok(api.rundgang, 'Rundgang ist gestartet');
  tick(40);
  assert.ok(halte > 0, 'der Hafenmeister hält an offenen Booten');
});
