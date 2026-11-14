// Ersatzkatalog der Bootsarten aus docs/hafen-und-schiffe.md.
// Damit laufen die Spielregeln, bevor die Schiffs-Threads ihre Daten in data/boats/*.js liefern.
// Liefert ein Schiffs-Thread eine Art mit derselben id, gilt dessen Eintrag (state.js mischt beides).
// Maße in Metern als [min, max]. Felder: docs/spielregeln.md

import * as S from './boats/s.js';
import * as M from './boats/m.js';
import * as L from './boats/l.js';
import * as XL from './boats/xl.js';
import * as XXL from './boats/xxl.js';

const ERSATZ = [
  // Größe S
  { id: 'S1', name: 'Ruderboot', size: 'S', minStage: 1, kind: 'ruderboot', length: [3, 4.5], beam: [1.2, 1.5], draft: [0.2, 0.2] },
  { id: 'S2', name: 'Paddel- und Tretboot', size: 'S', minStage: 1, kind: 'paddelboot', length: [2.5, 5.2], beam: [0.6, 1.8], draft: [0.1, 0.1], nights: [1, 1] },
  { id: 'S3', name: 'Beiboot und Schlauchboot', size: 'S', minStage: 1, kind: 'beiboot', length: [2.3, 5], beam: [1.3, 2.0], draft: [0.2, 0.4], motor: true },
  { id: 'S4', name: 'Segeljolle', size: 'S', minStage: 2, kind: 'jolle', sail: true, length: [2.3, 5.5], beam: [1.1, 2.0], draft: [0.1, 0.3] },
  { id: 'S5', name: 'Offenes Motorboot', size: 'S', minStage: 2, kind: 'motorboot', motor: true, length: [4, 6], beam: [1.7, 2.4], draft: [0.3, 0.5] },
  // Größe M
  { id: 'M1', name: 'Kleinkreuzer', size: 'M', minStage: 2, kind: 'segelyacht', sail: true, length: [6, 8.5], beam: [2.2, 2.8], draft: [0.3, 1.4] },
  { id: 'M2', name: 'Klassiker aus Holz', size: 'M', minStage: 3, kind: 'segelyacht', sail: true, length: [7, 9], beam: [2.0, 2.8], draft: [1.1, 1.5] },
  { id: 'M3', name: 'Kajütmotorboot', size: 'M', minStage: 2, kind: 'motorboot', motor: true, length: [6.5, 9], beam: [2.5, 3.2], draft: [0.6, 0.9] },
  { id: 'M4', name: 'Fischerboot', size: 'M', minStage: 2, kind: 'fischer', motor: true, stationed: true, length: [6, 9], beam: [2.4, 3.2], draft: [0.6, 1.0] },
  // Größe L
  { id: 'L1', name: 'Fahrtenyacht', size: 'L', minStage: 3, kind: 'segelyacht', sail: true, length: [9.5, 14], beam: [3.2, 4.3], draft: [1.6, 2.1] },
  { id: 'L2', name: 'Mehrrumpfboot', size: 'L', minStage: 4, kind: 'mehrrumpf', sail: true, length: [10, 13], beam: [6, 7.5], draft: [1.0, 1.3], weight: 0.5 },
  { id: 'L3', name: 'Motoryacht', size: 'L', minStage: 3, kind: 'motoryacht', motor: true, length: [10, 14], beam: [3.6, 4.5], draft: [0.9, 1.3] },
  { id: 'L4', name: 'Arbeits- und Behördenboot', size: 'L', minStage: 4, kind: 'behoerde', motor: true, special: true, noWishes: true, fee: 15, length: [10, 14], beam: [3.5, 4.5], draft: [1.0, 1.6], weight: 0.3 },
  // Größe XL
  { id: 'XL1', name: 'Traditionssegler', size: 'XL', minStage: 5, kind: 'traditionssegler', sail: true, special: true, length: [20, 40], beam: [5.5, 8], draft: [2.2, 3.5] },
  { id: 'XL2', name: 'Großyacht', size: 'XL', minStage: 5, kind: 'grossyacht', motor: true, length: [20, 35], beam: [5.5, 7.5], draft: [2.0, 3.5] },
  { id: 'XL3', name: 'Fahrgast- und Arbeitsschiff', size: 'XL', minStage: 5, kind: 'fahrgast', motor: true, dayVisitors: 40, nights: [1, 1], length: [20, 35], beam: [6, 8], draft: [1.3, 2.5] },
];

/** Arten einer Datendatei (TYPES, MODELS mit typeId) im Format der Regeln; die Größe steckt in der id. */
function ausDatei(mod) {
  const models = Array.isArray(mod.MODELS) ? mod.MODELS : [];
  return (mod.TYPES || []).map((t) => ({
    ...t,
    size: t.size ?? String(t.id).match(/^[A-Z]+/)?.[0],
    models: t.models ?? models.filter((m) => m.typeId === t.id),
  }));
}

// Ersatzkatalog und Datendateien gemischt (gleiche id: die Datei gewinnt, fehlende Felder aus dem
// Ersatz). So rechnen Spiel, Tests und tools/balance.mjs mit denselben Arten, Modellen und Gästeprofilen
// (wishes, feeFactor, arrivalWeight, Roadmap P19).
const DATEIEN = [S, M, L, XL, XXL].flatMap(ausDatei);
const byId = new Map(ERSATZ.map((t) => [t.id, t]));
for (const t of DATEIEN) byId.set(t.id, { ...(byId.get(t.id) || {}), ...t });
export const BOAT_CATALOG = [...byId.values()];

export default BOAT_CATALOG;
