// Gemeinsamer Aufbau für alle Regeltests (node --test, ohne Browser).
// Alle Tests rechnen mit den echten Spielzahlen aus web/js/data/economy.js: RULES ist
// rulesFromEconomy(ECONOMY), genau wie im Spiel (bridge.js). Wer eine Zahl ändert, sieht hier,
// welche Regel sich ändert.
import { ECONOMY } from '../web/js/data/economy.js';
import { RULES, rulesFromEconomy } from '../web/js/data/rules.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { createState } from '../web/js/state.js';
import * as sim from '../web/js/sim.js';

export { ECONOMY, RULES, rulesFromEconomy };

/** Kontext mit dem echten Hafen (data/harbor.js), dem Bootskatalog und den Regeln aus economy.js. */
export function echterHafen({ boatTypes = BOAT_CATALOG, harbor = HAFEN, economy = ECONOMY } = {}) {
  return sim.createContext({ boatTypes, harbor, rules: rulesFromEconomy(economy) });
}

/** Spielstand, in dem alle Stegprojekte und Stufenausbauten gebaut sind (alle Plätze des Katalogs). */
export function allesGebaut(seed = 1, rules = RULES) {
  const s = createState({ seed });
  for (const p of Object.keys(rules.berthProjects)) s.buildings[p] = 1;
  return s;
}

/** Spielstand, bei dem heute niemand mehr von selbst kommt. */
export function ruhigerStand(props = {}) {
  const s = createState({ seed: 1 });
  Object.assign(s, props);
  s.scheduledDay = s.day;
  s.upcoming = [];
  return s;
}

/** Testboot direkt in die Warteschlange legen (Standard: kleines Segelboot ohne Wünsche). */
export function testBoot(state, props = {}) {
  const boat = {
    id: state.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S',
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: state.clock, berthId: null,
    wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  };
  state.boats[boat.id] = boat;
  state.queue.push(boat.id);
  return boat;
}
