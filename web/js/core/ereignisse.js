// Ereignisse des Spielobjekts (game.on / game.emit). Jeder Zuhörer läuft für sich: wirft einer
// einen Fehler, bekommen die übrigen das Ereignis trotzdem. Sonst hält ein Fehler in irgendeinem
// Modul die ganze Kette an, zum Beispiel 'sim:change' nach dem Kassieren, und die Geldanzeige
// oben bleibt stehen (CI tablet-quer, 13.11.). Der Fehler erscheint weiter in der Konsole, damit
// Tests ihn melden (tests/helpers.mjs sammelt console.error).

export function createEmitter({ melde = (name, err) => console.error(`Fehler im Zuhörer für '${name}':`, err) } = {}) {
  const listeners = new Map();
  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, data) {
      const set = listeners.get(name);
      if (!set) return;
      for (const fn of set) {
        try { fn(data); } catch (err) { melde(name, err); }
      }
    },
  };
}
