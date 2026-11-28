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
//   tiefgangJetzt()    größter Tiefgang, der jetzt durch die Zufahrt kommt (Meter)
//   chipText()         kurzer Pegel für den Wetterknopf ("Flut 2,4 m"), sonst ''
//   kartenSatz(boat)   Satz für die Bootskarte, solange es auf die Flut wartet, sonst null
//   berichtZeile()     Zeile "Gezeiten heute" für den Wetterbericht (Element) oder null
// Ereignisse: 'pegel' (Meter um das Mittel, für die Landschaft) und 'gezeiten' ({ hoehe, steigt, pegel })
// etwa zweimal je Sekunde, nur in der Nordsee.
import * as G from './gezeiten-regeln.js';
import { regelnBereit } from './regeln-bereit.js';
import { uhrzeitText } from '../ui/vorschau.js';
import { pixelBild } from '../ui/pixel-symbole.js';
import { setzeRevier } from '../data/kuestennamen.js';

const meter = (x) => `${(Math.round(x * 10) / 10).toFixed(1).replace('.', ',')} m`;

export async function init(game) {
  const leer = { aktiv: () => false, wasserstand: () => 0, pegel: () => 0, steigt: () => false, zufahrt: () => 0,
    offen: () => true, abUhr: () => null, scheitel: () => [], tiefgangJetzt: () => Infinity, chipText: () => '', berichtZeile: () => null, kartenSatz: () => null };
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
    tiefgangJetzt: () => G.tiefgangMoeglich(st(), ctx()),
    chipText: () => (G.hatTide(st()) ? `${game.gezeiten.steigt() ? 'Flut' : 'Ebbe'} ${meter(game.gezeiten.wasserstand())}` : ''),
    berichtZeile,
    kartenSatz(b) {
      if (!b || !G.hatTide(st()) || b.status !== 'waiting') return null;
      if (G.zufahrtOffen(st(), ctx(), b)) {
        // Schleuse (Teil 4): Tor gerade zu
        if (G.schleuseOffen(st())) return null;
        return `Die Schleuse ist gerade zu. Mit der nächsten Schleusung um etwa ${uhrzeitText(G.naechsteSchleusung(st()), ctx().rules)} Uhr läuft es ein.`;
      }
      const t = G.naechstesFenster(st(), ctx(), b);
      const tief = meter(b.draft);
      return t == null
        ? `Ebbe: Mit ${tief} Tiefgang kommt es heute nicht mehr durch die Zufahrt. Es wartet ohne Eile bis zur Flut morgen früh.`
        : `Ebbe: Mit ${tief} Tiefgang kommt es erst ab etwa ${uhrzeitText(t, ctx().rules)} Uhr durch die Zufahrt. Bis dahin wartet es ohne Eile.`;
    },
  };

  // Wetterbericht: Gezeiten heute mit kleiner Kurve, Hoch- und Niedrigwasser und was jetzt durchkommt
  function berichtZeile() {
    const s = st(), c = ctx();
    if (!G.hatTide(s)) return null;
    const row = document.createElement('div');
    row.className = 'wp-row wp-tide';
    row.append(pixelBild('welle', 24));
    const txt = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = `Gezeiten heute: ${game.gezeiten.chipText()}, ${game.gezeiten.steigt() ? 'steigt' : 'fällt'}`;
    txt.append(t, kurve(s, c));
    const sch = game.gezeiten.scheitel().filter((x) => x.clock <= (c.rules.dayLength ?? 90));   // bei Tageslicht
    if (sch.length) {
      const p = document.createElement('span');
      p.textContent = sch.map((x) => `${x.art === 'hw' ? 'Hochwasser' : 'Niedrigwasser'} ${x.uhr} Uhr`).join(', ');
      txt.append(p);
    }
    const p2 = document.createElement('span');
    p2.textContent = `Zufahrt jetzt bis ${meter(game.gezeiten.tiefgangJetzt())} Tiefgang.`;
    txt.append(p2);
    row.append(txt);
    return row;
  }

  // Tageskurve des Wasserstands (Tageslicht) als Pixel-Linie, Strich bei "jetzt"
  function kurve(s, c) {
    const ns = 'http://www.w3.org/2000/svg';
    const B = 120, H = 28;
    const ende = c.rules.dayLength ?? 90;   // Tageslicht, wie die Zeiten darunter
    const hub = (G.NORDSEE?.gezeiten?.hub ?? 3) * 1.25;
    const y = (w) => Math.round(H - 2 - ((w + hub * 0.1) / (hub * 1.1)) * (H - 4));
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${B} ${H}`);
    svg.setAttribute('class', 'wp-tide-kurve');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    let d = '';
    for (let x = 0; x <= B; x += 2) {
      const w = G.wasserstand(s, c, (x / B) * ende);
      d += `${x ? 'L' : 'M'}${x} ${y(w)} `;
    }
    const flaeche = document.createElementNS(ns, 'path');
    flaeche.setAttribute('d', `${d}L${B} ${H} L0 ${H} Z`);
    flaeche.setAttribute('class', 'wp-tide-wasser');
    const linie = document.createElementNS(ns, 'path');
    linie.setAttribute('d', d);
    linie.setAttribute('class', 'wp-tide-linie');
    const jetzt = document.createElementNS(ns, 'rect');
    jetzt.setAttribute('x', String(Math.round((Math.min(ende, s.clock ?? 0) / ende) * B) - 1));
    jetzt.setAttribute('y', '0'); jetzt.setAttribute('width', '2'); jetzt.setAttribute('height', String(H));
    jetzt.setAttribute('class', 'wp-tide-jetzt');
    svg.append(flaeche, linie, jetzt);
    return svg;
  }

  // Einmal je Spielstand: Das erste Boot, das auf die Flut wartet, erklärt die Tide im Meldeplatz
  function erklaeren() {
    const s = st();
    const m = (s.modules.gezeiten ||= {});
    if (m.erklaert || !(game.speed > 0)) return;
    if (!s.queue.some((id) => s.boats[id]?.flut != null)) return;
    m.erklaert = true;
    game.banner?.zeige?.('welle', 'Ebbe in der Zufahrt',
      'Boote mit viel Tiefgang warten an der Boje auf die Flut, ihre Geduld ruht so lange. Hoch- und Niedrigwasser stehen im Wetterbericht.', 9);
  }

  // Pegel für die Landschaft (Wasserfläche, trockenfallendes Watt). region.js sendet ohne dieses Modul nichts.
  let warte = 0;
  let warAktiv = false;
  const melde = () => {
    setzeRevier(st()?.region);   // Namen der Stufe 3 und ihres Ausbaus (Schleuse) an der Nordsee
    const aktiv = G.hatTide(st());
    if (!aktiv) {
      if (warAktiv) game.emit('pegel', 0);
      warAktiv = false;
      return;
    }
    warAktiv = true;
    erklaeren();
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
