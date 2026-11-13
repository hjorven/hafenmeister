// Bezahlt-Wimpel am Bug: wann weht er? Reine Regel ohne Three.js, getestet in tests/wimpel.test.mjs.
//
// - Gast in den Spielregeln (state.boats): Wimpel, solange game.sim.istBezahlt(id) gilt.
// - Nachts abgerechneter Gast ('sim:departed'): Er steht nicht mehr in state.boats, liegt aber bis zum
//   Ablegen am Vormittag ('sim:castOff' / 'boot-faehrt') noch in der Box. Abgerechnet heisst bezahlt
//   (was offen war, holt der Hafenmeister nachts), also weht der Wimpel bis zum Ablegen.
// - Nie bei Dauerliegern, an der Boje, unterwegs oder nach dem Ablegen.
export function wimpelAn({ imSpiel, dauerlieger = false, bezahlt = false, abgerechnet = false, faehrt = false, anBoje = false, fest = false, legtAb = false }) {
  if (dauerlieger || faehrt || anBoje) return false;
  if (!fest && !legtAb) return false;
  return imSpiel ? !!bezahlt : !!abgerechnet;
}
