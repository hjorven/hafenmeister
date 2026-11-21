// Bootsansicht ohne Browser: boat-anim.js und boat-view.js mit einem nachgebauten game (Ereignisse,
// Tick, Szene). 'three' kommt aus web/vendor, damit die Tests ohne npm ci laufen.
import { register } from 'node:module';

const THREE_URL = new URL('../web/vendor/three-0.187.0/build/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
     if (spec === 'three') return { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true };
     return next(spec, ctx);
   }`));

const THREE = await import('three');
const anim = await import('../web/js/render/boat-anim.js');
const view = await import('../web/js/render/boat-view.js');

// stufe: Ausbaustufe des Hafens; extra: weitere Felder fuer game (z. B. gelaende, geschichten, services)
export function bootsansicht({ stufe = 2, extra = {} } = {}) {
  const hs = new Map(), ticks = [], log = [];
  const boote = [];
  const { sim: simExtra, ...rest } = extra;
  const game = {
    scene: new THREE.Scene(), time: 0,
    on(n, f) { (hs.get(n) ?? hs.set(n, []).get(n)).push(f); },
    emit(n, d) {
      if (n.startsWith('boot:') || n.startsWith('boat:')) log.push({ t: game.time, name: n, ...(d ?? {}) });
      for (const f of hs.get(n) ?? []) f(d);
    },
    onTick(f) { ticks.push(f); },
    state: { stage: stufe },
    ...rest,
  };
  game.sim = { get boote() { return boote; }, state: { day: 5, clock: 100, boats: {} }, waitSpotCount: () => 4, ...(simExtra ?? {}) };
  anim.init(game);
  view.init(game);
  // sekunden Spielzeit in Schritten von 50 ms
  const laufe = (sekunden, dt = 0.05) => {
    for (let i = 0; i < Math.round(sekunden / dt); i++) { game.time += dt; for (const f of ticks) f(dt, game.time); }
  };
  return { game, boote, log, laufe, boot: (id) => game.boatView.boot(id) };
}
