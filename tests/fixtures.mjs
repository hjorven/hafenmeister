// Kleine Testdaten. Die echten Daten kommen aus web/js/data/boats/*.js und web/js/data/harbor.js.

export const boatTypes = [
  { id: 'S1', name: 'Ruderboot', size: 'S', minStage: 1, length: [3, 4.5], beam: [1.2, 1.5], draft: 0.2,
    models: [{ id: 'S1-1', name: 'Holzruderboot' }, { id: 'S1-2', name: 'Kunststoff-Ruderboot' }] },
  { id: 'S5', name: 'Offenes Motorboot', size: 'S', minStage: 2, length: [4, 6], beam: [1.7, 2.4], draft: [0.3, 0.5], motor: true },
  { id: 'M1', name: 'Kleinkreuzer', size: 'M', minStage: 2, length: [6, 8.5], beam: [2.2, 2.8], draft: [0.3, 1.4] },
  { id: 'L1', name: 'Fahrtenyacht', size: 'L', minStage: 3, length: [9.5, 14], beam: [3.2, 4.3], draft: [1.6, 2.1] },
  { id: 'L2', name: 'Mehrrumpfboot', size: 'L', minStage: 4, length: [10, 13], beam: [6, 7.5], draft: [1.0, 1.3] },
  { id: 'XL3', name: 'Fahrgastschiff', size: 'XL', minStage: 5, length: [20, 35], beam: [6, 8], draft: [1.3, 2.5], dayVisitors: 40, motor: true },
  { id: 'XL4', name: 'Marinebesuch', size: 'XL', minStage: 5, length: [30, 40], beam: [6, 8], draft: [2.5, 3.5], special: true, noWishes: true, fee: 50, motor: true },
  { id: 'L4', name: 'Seenotrettungsboot', size: 'L', minStage: 4, length: 14, beam: 4.5, draft: 1.5, stationed: true, motor: true },
];

function many(prefix, n, props) {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, ...props }));
}

export const berths = [
  ...many('A', 6, { kind: 'box-s', stage: 1, maxLength: 6, maxBeam: 2.4, depth: 1.5 }),
  ...many('B', 19, { kind: 'box-m', stage: 2, maxLength: 9, maxBeam: 3.2, depth: 2.0 }),
  ...many('C', 14, { kind: 'box-l', stage: 3, maxLength: 14, maxBeam: 4.5, depth: 3.5, power: true }),
  ...many('D', 10, { kind: 'finger-l', stage: 4, maxLength: 14, maxBeam: 4.5, depth: 3.5, power: true, comfort: 1, requires: 'steg-d' }),
  { id: 'T1', kind: 'stirn', stage: 3, maxLength: 14, maxBeam: 7.5, depth: 3.5, power: true },
  { id: 'R1', kind: 'retter', stage: 4, maxLength: 16, maxBeam: 5, depth: 3.5, reserved: true },
  ...many('K', 3, { kind: 'kai', stage: 5, maxLength: 40, maxBeam: 8, depth: 5.0, power: true, sizes: ['XL'], exposed: true }),
];
