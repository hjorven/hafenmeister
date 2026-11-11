// Ersatzkatalog der Bootsarten aus docs/hafen-und-schiffe.md.
// Damit laufen die Spielregeln, bevor die Schiffs-Threads ihre Daten in data/boats/*.js liefern.
// Liefert ein Schiffs-Thread eine Art mit derselben id, gilt dessen Eintrag (state.js mischt beides).
// Maße in Metern als [min, max]. Felder: docs/spielregeln.md

export const BOAT_CATALOG = [
  // Größe S
  { id: 'S1', name: 'Ruderboot', size: 'S', minStage: 1, kind: 'ruderboot', length: [3, 4.5], beam: [1.2, 1.5], draft: [0.2, 0.2] },
  { id: 'S2', name: 'Paddel- und Tretboot', size: 'S', minStage: 1, kind: 'paddelboot', length: [2.5, 5.2], beam: [0.6, 1.8], draft: [0.1, 0.1], nights: [1, 1], fee: 6, weight: 0.7 },
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

export default BOAT_CATALOG;
