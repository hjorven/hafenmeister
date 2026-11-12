// Wartet, bis bridge.js game.sim gesetzt hat. bridge.js lädt die Bootsdaten asynchron und meldet
// 'sim:change' schon beim Laden des Spielstands, also bevor game.sim existiert. Darum hier nachsehen,
// statt auf ein Ereignis zu vertrauen. Kein Listener darf vorher auf game.sim zugreifen.
export function regelnBereit(game, { timeoutMs = 30000 } = {}) {
  if (game.sim) return Promise.resolve(game.sim);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (game.sim) { clearInterval(t); resolve(game.sim); }
      else if (Date.now() - start > timeoutMs) { clearInterval(t); reject(new Error('game.sim fehlt')); }
    }, 50);
  });
}
