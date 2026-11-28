// Nordsee mit Ebbe und Flut im Browser (Roadmap P57, docs/nordsee.md). Die Regeln stehen in
// features/gezeiten-regeln.js (ohne DOM, auch für Tests und Balancing); dieses Modul hängt sie in die
// Spielregeln, meldet den Pegel an die Landschaft und gibt game.gezeiten für Anzeige und Bootskarte.
//
// game.gezeiten:
//   aktiv()            hat der Hafen Ebbe und Flut (Nordsee)?
//   wasserstand()      Meter über Seekartennull (mittleres Niedrigwasser)
//   pegel()            Meter um das mittlere Wasser (Wasserlinie der 3D-Szene, y = 0)
//   steigt()           läuft gerade Flut auf?
//   zufahrt()          Tiefe der Zufahrt bei Niedrigwasser (Meter)
//   offen(boatId)      kommt dieses Boot jetzt durch die Zufahrt?
//   abUhr(boatId)      Uhrzeit (Text), ab der es einlaufen kann, oder null
//   scheitel()         Hoch- und Niedrigwasser heute: [{ art: 'hw'|'nw', uhr, hoehe }]
// Ereignisse: 'pegel' (Meter um das Mittel, für die Landschaft) und 'gezeiten' ({ hoehe, steigt, pegel })
// etwa zweimal je Sekunde, nur in der Nordsee.
import * as G from './gezeiten-regeln.js';
import { regelnBereit } from './regeln-bereit.js';
import { uhrzeitText } from '../ui/vorschau.js';

export async function init(game) {
  const leer = { aktiv: () => false, wasserstand: () => 0, pegel: () => 0, steigt: () => false, zufahrt: () => 0,
    offen: () => true, abUhr: () => null, scheitel: () => [] };
  game.gezeiten = leer;
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  G.haengeEin(api.addHook);

  const boot = (id) => st()?.boats?.[id] ?? null;
  const hub = G.NORDSEE?.gezeiten?.hub ?? 0;
  game.gezeiten = {
    aktiv: () => G.hatTide(st()),
    wasserstand: () => G.wasserstand(st(), ctx()),
    pegel: () => (G.hatTide(st()) ? G.wasserstand(st(), ctx()) - hub / 2 : 0),
    steigt: () => G.hatTide(st()) && G.steigt(st(), ctx()),
    zufahrt: () => G.zufahrtTiefe(st()),
    offen: (id) => G.zufahrtOffen(st(), ctx(), boot(id)),
    abUhr(id) {
      const b = boot(id);
      if (!b || G.zufahrtOffen(st(), ctx(), b)) return null;
      const t = G.naechstesFenster(st(), ctx(), b);
      return t == null ? null : uhrzeitText(t, ctx().rules);
    },
    scheitel: () => G.scheitel(st(), ctx()).map((s) => ({ ...s, uhr: uhrzeitText(s.clock, ctx().rules) })),
  };

  // Pegel für die Landschaft (Wasserfläche, trockenfallendes Watt). region.js sendet ohne dieses Modul nichts.
  let warte = 0;
  let warAktiv = false;
  const melde = () => {
    const aktiv = G.hatTide(st());
    if (!aktiv) {
      if (warAktiv) game.emit('pegel', 0);
      warAktiv = false;
      return;
    }
    warAktiv = true;
    const p = game.gezeiten.pegel();
    game.emit('pegel', p);
    game.emit('gezeiten', { hoehe: game.gezeiten.wasserstand(), steigt: game.gezeiten.steigt(), pegel: p });
  };
  game.onTick?.((dt) => {
    warte -= dt;
    if (warte > 0) return;
    warte = 0.5;
    melde();
  });
  for (const ev of ['region', 'spielstand-geladen', 'ready', 'stufe']) game.on(ev, () => setTimeout(melde, 0));
  melde();
}
