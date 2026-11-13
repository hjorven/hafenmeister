// Wünsche über dem Boot und Ankunftsvorschau (Paket P11, docs/vorschau.md).
//
// 1. Wunschsymbole: Über jedem Boot, das an der Warteboje oder im Ankerfeld wartet, stehen
//    seine Wünsche als kleine Pixel-Schilder (WC, Dusche, Essen, Strom, Diesel). Beim Anlegen
//    bekommt jeder erfüllte Wunsch einen Haken, jeder unerfüllte wird grau; nach ein paar
//    Sekunden verschwindet die Reihe wieder.
// 2. Funk: Ab der ersten Stufe des Hafenbüros (rules.office.preview, Grundwert 1) hört der
//    Hafenmeister den Funk ab. Rechts am Rand stehen die nächsten drei Boote des Tages als
//    Umriss mit Länge, ungefährer Uhrzeit und Wünschen (game.sim.preview()).
//
// Liest nur: game.sim (state, ctx, preview, selected), game.boatView.boot(id) und die
// Ereignisse 'sim:moored', 'sim:feeReady', 'boat:moored', 'sim:select'. Schreibt nichts in
// den Spielstand. Schnittstelle: game.vorschau = { wunschSymbole, funkAn(), aktualisieren() }.
import { uhrzeitAusSpielzeit } from '../render/landschaft/zeit.js';

// ------------------------------------------------------------------ Pixel-Grafik
// '#' ist die Glyphe (weiß auf farbigem Schild), '.' ist leer. 12 x 12 wie die Oberfläche.
export const WUNSCH = {
  wc: {
    name: 'WC', farbe: '#3f7cc4',
    raster: ['............', '............', '............', '............', '#...#..###..', '#...#.#.....', '#.#.#.#.....', '#.#.#.#.....', '.#.#...###..', '............', '............', '............'],
  },
  dusche: {
    name: 'Dusche', farbe: '#23897d',
    raster: ['..####......', '.#....#.....', '.#.....#....', '.#....####..', '.#...######.', '.#..........', '.#...#.#.#..', '.#..........', '.#..#.#.#...', '.#..........', '.#...#.#.#..', '............'],
  },
  essen: {
    name: 'Essen', farbe: '#e0812c',
    raster: ['............', '.#.#.#...##.', '.#.#.#..###.', '.#.#.#..###.', '.#####..###.', '..###...###.', '...#.....##.', '...#......#.', '...#......#.', '...#......#.', '...#......#.', '............'],
  },
  strom: {
    name: 'Strom', farbe: '#d9a514',
    raster: ['.....####...', '....####....', '...####.....', '..####......', '.#########..', '......###...', '.....###....', '....###.....', '...##.......', '..##........', '.#..........', '............'],
  },
  diesel: {
    name: 'Diesel', farbe: '#8c3b3b',
    raster: ['............', '.######.....', '.#....#.#...', '.#....#..#..', '.######..#..', '.######..#..', '.######.##..', '.######.#...', '.######.#...', '.########...', '########....', '............'],
  },
};
// Unbekannter Wunsch (neue Wünsche aus späteren Paketen): Fragezeichen, bis jemand ein Bild einträgt
const UNBEKANNT = {
  name: null, farbe: '#5a6a7c',
  raster: ['............', '...######...', '..##....##..', '..##....##..', '.......##...', '......##....', '.....##.....', '.....##.....', '............', '.....##.....', '.....##.....', '............'],
};
const HAKEN = ['......', '.....#', '....##', '#..##.', '####..', '.##...'];

export const wunschBild = (key) => WUNSCH[key] ?? UNBEKANNT;
export const wunschName = (key) => WUNSCH[key]?.name ?? String(key);

function rasterSvg(raster, farbe = '#fff') {
  const h = raster.length, w = raster[0].length;
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '#') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${farbe}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
}
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// ------------------------------------------------------------------ Bootsumriss von oben
// Raster aus Zeichen: 'k' Umriss, 'w' Rumpf, 'd' Deck/Aufbau, 'm' Mast. Bug zeigt nach rechts.
// Länge und Breite folgen den echten Maßen, damit man an der Vorschau sieht, wer die große Box braucht.
const SEGEL = new Set(['jolle', 'segelyacht', 'mehrrumpf', 'traditionssegler']);
export function bootArt(boat, typ) {
  const kind = boat?.kind ?? typ?.kind ?? '';
  if (kind === 'mehrrumpf') return 'mehrrumpf';
  if (kind === 'traditionssegler') return 'traditionssegler';
  if (typ?.sail || SEGEL.has(kind)) return 'segel';
  if (kind === 'ruderboot' || kind === 'paddelboot' || kind === 'beiboot') return 'klein';
  return 'motor';
}

/** Pixelmaße des Umrisses (etwa ein Pixel je Meter): Länge 7 bis 34, Breite 3 bis 11 Pixel, immer ungerade Breite (Mittellinie). */
export function umrissMasse(laengeM, breiteM) {
  const L = Math.round(Math.max(7, Math.min(34, 4 + (laengeM || 4) * 0.85)));
  let B = Math.round(Math.max(3, Math.min(11, 0.5 + (breiteM || 1.5) * 1.0)));
  if (B % 2 === 0) B += 1;
  return { L, B };
}

/** Umriss als Raster (Zeilen aus Zeichen), Bug rechts. */
export function umrissRaster(art, laengeM, breiteM) {
  const { L, B } = umrissMasse(laengeM, breiteM);
  const W = L + 2, H = B + 2;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const mitte = (H - 1) / 2;
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  // halbe Breite an der Stelle u (0 Heck, 1 Bug), als Anteil der vollen halben Breite
  const profil = (u) => {
    if (art === 'klein') return Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 4)));
    const heck = art === 'motor' ? 0.85 : 0.7;
    if (u < 0.3) return heck + (1 - heck) * (u / 0.3);
    if (u < 0.5) return 1;
    const v = (u - 0.5) / 0.5;
    if (art === 'motor') return Math.sqrt(Math.max(0, 1 - Math.pow(v, 2.4)));
    return Math.pow(Math.max(0, 1 - v), 0.7);       // Segler: spitzer Bug
  };
  // Rumpf um die Mittellinie y0 (Rasterzeile ohne Rand) mit halber Breite hb Pixel
  const rumpf = (y0, hb, fuell = 'w') => {
    for (let x = 0; x < L; x++) {
      const u = (x + 0.5) / L;
      const hw = Math.round(profil(u) * hb);
      if (profil(u) <= 0.05) continue;
      for (let y = y0 - hw; y <= y0 + hw; y++) set(x + 1, y + 1, fuell);
    }
  };
  if (art === 'mehrrumpf') {
    const hb = Math.max(1, Math.round(B * 0.12));
    // Netz zwischen den Rümpfen, dann die Rümpfe darüber
    for (let x = Math.round(L * 0.15); x < Math.round(L * 0.7); x++) for (let y = hb; y <= B - 1 - hb; y++) set(x + 1, y + 1, 'd');
    rumpf(hb, hb);
    rumpf(B - 1 - hb, hb);
  } else {
    rumpf((B - 1) / 2, (B - 1) / 2);
  }
  // Umriss: jedes leere Feld neben einem Rumpffeld
  const rand = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === 'w' || g[y + dy]?.[x + dx] === 'd');
    if (n) rand.push([x, y]);
  }
  for (const [x, y] of rand) g[y][x] = 'k';
  const my = Math.round(mitte);
  // Aufbauten
  if (art === 'segel' || art === 'traditionssegler' || art === 'mehrrumpf') {
    const masten = art === 'traditionssegler' ? [0.3, 0.55, 0.78].slice(0, L > 26 ? 3 : 2) : [0.58];
    for (const m of masten) {
      const x = Math.round(L * m) + 1;
      set(x, my, 'm');
      // Baum nach achtern
      for (let i = 1; i <= Math.max(2, Math.round(L * 0.18)); i++) set(x - i, my, 'd');
    }
    if (art !== 'mehrrumpf' && L >= 12) for (let x = Math.round(L * 0.25); x < Math.round(L * 0.45); x++) { set(x + 1, my - 1, 'd'); set(x + 1, my + 1, 'd'); }
  } else if (art === 'motor') {
    const b = Math.max(1, Math.floor((B - 3) / 2));
    for (let x = Math.round(L * 0.3); x < Math.round(L * 0.65); x++) for (let y = my - b; y <= my + b; y++) set(x + 1, y, 'd');
  } else {
    // Ruderboot: Duchten quer
    for (const u of [0.35, 0.65]) { const x = Math.round(L * u) + 1; for (let y = my - Math.floor(B / 2) + 1; y <= my + Math.floor(B / 2) - 1; y++) set(x, y, 'd'); }
  }
  return g.map((z) => z.join(''));
}

const UMRISS_FARBE = { k: '#24364a', w: '#fffaf0', d: '#c9b994', m: '#24364a' };
function umrissSvg(raster) {
  const h = raster.length, w = raster[0].length;
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c !== '.') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${UMRISS_FARBE[c]}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
}

// ------------------------------------------------------------------ Zeit
/** Ankunftszeit (Spielsekunden des Tages) als ungefähre Uhrzeit, auf zehn Minuten gerundet. */
export function uhrzeitText(arriveAt, rules) {
  const tag = rules?.dayLength ?? 90, abend = rules?.eveningLength ?? 30;
  const anteil = Math.max(0, Math.min(1, arriveAt / (tag + abend)));
  let min = Math.round((uhrzeitAusSpielzeit(anteil * 119.9) * 60) / 10) * 10;
  min = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * Daten für die Funk-Vorschau: die nächsten Boote mit Umriss, Zeit und Wünschen.
 * state.upcoming ist nach Ankunft sortiert; preview() nimmt die ersten rules.previewCount.
 */
export function funkDaten(state, ctx, liste) {
  const rules = ctx?.rules ?? {};
  const jetzt = state?.clock ?? 0;
  return (liste ?? []).map((b) => {
    const typ = ctx?.typeById?.[b.typeId];
    const art = bootArt(b, typ);
    const gleich = b.arriveAt - jetzt <= (rules.dayLength ?? 90) * 0.04;
    return {
      id: b.id,
      name: b.name || typ?.name || 'Boot',
      groesse: b.size,
      art,
      laenge: Math.round(b.length * 10) / 10,
      breite: Math.round(b.beam * 10) / 10,
      zeit: gleich ? 'gleich' : uhrzeitText(b.arriveAt, rules),
      gleich,
      wuensche: [...(b.wishes ?? [])],
    };
  });
}

/** Ist der Funk (Vorschau) freigeschaltet? Erste Stufe des Hafenbüros, außer im Winter. */
export function funkFrei(state, ctx) {
  if (!state || !ctx?.rules) return false;
  const ab = ctx.rules.office?.preview ?? 1;
  return (state.office ?? 0) >= ab;
}

const meter = (m) => `${String(m).replace('.', ',')} m`;
const listeText = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}`);
export function funkSatz(d) {
  const w = d.wuensche.length ? `, möchte ${listeText(d.wuensche.map(wunschName))}` : ', ohne Wünsche';
  return `${d.name}, ${meter(d.laenge)} lang, ${d.zeit === 'gleich' ? 'gleich da' : `gegen ${d.zeit}`}${w}`;
}

// ------------------------------------------------------------------ Aussehen
const CSS = `
#hm-wunsch-ebene { position: absolute; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
#hm-wunsch-ebene[hidden], body.foto #hm-wunsch-ebene, body.building #hm-wunsch-ebene { display: none !important; }
.hm-wunsch-reihe { position: absolute; left: 0; top: 0; display: flex; gap: 6px; transform-origin: 50% 100%; will-change: transform; transition: opacity .35s; }
.hm-wunsch-reihe.weg { opacity: 0; }
.hm-wunsch-reihe.gewaehlt { z-index: 2; }
.hm-wunsch-reihe.gewaehlt .hm-wunsch { box-shadow: 0 0 0 2px #24364a, 0 0 0 4px #f2c14e, 2px 3px 0 4px rgba(20,32,48,.3); }
.hm-wunsch { position: relative; width: var(--hm-wunsch); height: var(--hm-wunsch); background: var(--f); box-shadow: 0 0 0 2px #24364a, 2px 3px 0 2px rgba(20,32,48,.3); image-rendering: pixelated; }
.hm-wunsch::before { content: ""; position: absolute; inset: 0; background: var(--g) center / 100% 100% no-repeat; image-rendering: pixelated; }
.hm-wunsch.nein { background: #aeb4bb; filter: saturate(0); opacity: .8; }
.hm-wunsch.ja::after { content: ""; position: absolute; right: -5px; bottom: -5px; width: 12px; height: 12px; background: #3b9a4a var(--haken) center / 100% 100% no-repeat; box-shadow: 0 0 0 2px #24364a; image-rendering: pixelated; animation: hm-haken .3s steps(3) both; animation-delay: var(--v, 0s); }
@keyframes hm-haken { from { transform: scale(0); } to { transform: scale(1); } }
/* Vielfache von 12 bleiben scharf */
:root { --hm-wunsch: 24px; }

#hm-funk { position: absolute; z-index: 14; right: var(--hm-rechts, 12px); top: calc(var(--hm-oben, 12px) + var(--hm-knopf, 48px) + 8px);
  display: flex; flex-direction: column; align-items: stretch; gap: 4px; width: 124px; font-family: var(--hm-pixel); pointer-events: auto; }
#hm-funk[hidden], body.foto #hm-funk, body.building #hm-funk, body.card-open #hm-funk { display: none !important; }
#hm-funk.verdeckt { visibility: hidden; pointer-events: none; }
#hm-funk .hm-funk-kopf { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 0 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
#hm-funk .hm-funk-kopf .hm-sym { width: 18px; height: 18px; }
#hm-funk.zu .hm-funk-liste { display: none; }
#hm-funk .hm-funk-liste { display: flex; flex-direction: column; gap: 4px; }
#hm-funk .hm-funk-boot { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 5px 4px 4px; cursor: pointer; text-align: center; }
#hm-funk .hm-funk-umriss { display: block; height: auto; image-rendering: pixelated; }
#hm-funk .hm-funk-zeile { display: flex; align-items: baseline; justify-content: center; gap: 6px; font-size: 12px; line-height: 1; white-space: nowrap; }
#hm-funk .hm-funk-zeit { font-weight: 700; }
#hm-funk .hm-funk-boot.gleich .hm-funk-zeit { color: var(--hm-meer, #23897d); }
#hm-funk .hm-funk-laenge { color: var(--hm-tinte-2, #5a6a7c); font-family: var(--hm-text); font-size: 11px; }
#hm-funk .hm-funk-wuensche { display: flex; gap: 3px; min-height: 12px; }
#hm-funk .hm-funk-wuensche .hm-wunsch { --hm-wunsch: 12px; box-shadow: 0 0 0 1px #24364a; }
#hm-funk .hm-funk-leer { padding: 6px 4px; font-size: 12px; text-align: center; color: var(--hm-tinte-2, #5a6a7c); }
#hm-funk .hm-funk-satz { position: absolute; right: calc(100% + 6px); width: max-content; max-width: min(240px, 60vw); padding: 8px 10px; font: 500 13px/1.3 var(--hm-text); }
#hm-funk .hm-funk-satz[hidden] { display: none; }
#hm-funk .hm-funk-boot.neu { animation: hm-funk-neu .5s steps(4) both; }
@keyframes hm-funk-neu { from { transform: translateX(14px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (max-width: 540px), (max-height: 420px) {
  #hm-funk { width: 84px; }
  #hm-funk.verdeckt { visibility: hidden; pointer-events: none; }
#hm-funk .hm-funk-kopf { min-height: 26px; font-size: 12px; }
  #hm-funk .hm-funk-boot { padding: 4px 3px 3px; gap: 2px; }
  #hm-funk .hm-funk-laenge { display: none; }
}
@media (max-height: 420px) {
  #hm-funk .hm-funk-liste { gap: 2px; }
  #hm-funk .hm-funk-wuensche { display: none; }
}
`;

// Funkgerät 12 x 12 für den Kopf
const FUNK_RASTER = ['.........#..', '........#...', '.......#....', '..########..', '.#........#.', '.#.##.###.#.', '.#.##.....#.', '.#....###.#.', '.#.##.....#.', '.#........#.', '..########..', '............'];

export function init(game) {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('game') || document.body;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  const style = el('style');
  style.id = 'hm-vorschau-stil';
  style.textContent = CSS + Object.entries(WUNSCH).map(([k, w]) => `.hm-wunsch[data-w="${k}"] { --f: ${w.farbe}; --g: ${svgUrl(rasterSvg(w.raster))}; }`).join('\n') +
    `\n.hm-wunsch { --f: ${UNBEKANNT.farbe}; --g: ${svgUrl(rasterSvg(UNBEKANNT.raster))}; }` +
    `\n:root { --haken: ${svgUrl(rasterSvg(HAKEN))}; --px-funk: ${svgUrl(rasterSvg(FUNK_RASTER, '#000'))}; }`;
  document.head.append(style);

  const symbol = (key, extra = '') => {
    const s = el('i', `hm-wunsch ${extra}`.trim());
    s.dataset.w = key;
    s.title = wunschName(key);
    return s;
  };

  // ================================================================ Wunschsymbole über Booten
  const ebene = el('div');
  ebene.id = 'hm-wunsch-ebene';
  ebene.setAttribute('aria-hidden', 'true');
  root.append(ebene);

  const reihen = new Map();      // bootId -> { node, key, art: 'warten' | 'ergebnis', bis, pos }
  const ergebnisse = new Map();  // bootId -> { wuensche, erfuellt } (Liegegeld beim Anlegen, wartet auf das sichtbare Festmachen)
  const frischAngelegt = new Set();
  let gewaehlt = null;

  function baueReihe(id, wuensche, erfuellt = null) {
    const node = el('div', 'hm-wunsch-reihe');
    node.dataset.boot = String(id);
    node.style.visibility = 'hidden';     // bis zum ersten Platzieren über dem Boot
    wuensche.forEach((w, i) => {
      const s = symbol(w, erfuellt ? (erfuellt.has(w) ? 'ja' : 'nein') : '');
      if (erfuellt) s.style.setProperty('--v', `${0.15 + i * 0.18}s`);
      s.title = erfuellt ? `${wunschName(w)}: ${erfuellt.has(w) ? 'erfüllt' : 'nicht erfüllt'}` : `Wunsch: ${wunschName(w)}`;
      node.append(s);
    });
    ebene.append(node);
    return node;
  }
  function entferneReihe(id) {
    const r = reihen.get(id);
    if (!r) return;
    reihen.delete(id);
    r.node.remove();
  }

  const sim = () => game.sim;
  const raute = (id) => {
    const b = st()?.boats?.[id];
    return !!b && !!game.sim?.sonderfall?.(id) && !!game.sim?.bueroAutomatik?.(b.size);
  };
  const st = () => game.sim?.state;

  // Wer wartet gerade sichtbar an Boje oder Anker?
  function wartendeAbgleichen() {
    const s = st();
    if (!s) return;
    const soll = new Set();
    for (const id of s.queue ?? []) {
      const b = s.boats?.[id];
      if (!b || b.status !== 'waiting' || !b.wishes?.length) continue;
      const a = game.boatView?.boot?.(id);
      if (!a || (a.berth && a.berth.kind !== 'buoy')) continue;
      soll.add(id);
      const key = b.wishes.join(',');
      const r = reihen.get(id);
      if (r && r.art === 'warten' && r.key === key) continue;
      if (r) entferneReihe(id);
      reihen.set(id, { node: baueReihe(id, b.wishes), key, art: 'warten' });
    }
    for (const [id, r] of [...reihen]) if (r.art === 'warten' && !soll.has(id)) entferneReihe(id);
  }

  // Anlegen: die Spielregeln melden 'moored' und gleich danach 'feeReady' mit den erfüllten Wünschen.
  // Das Boot fährt dann erst noch zur Box; gezeigt wird beim sichtbaren Festmachen ('boat:moored').
  game.on('sim:moored', (e) => { if (e?.boatId != null) { frischAngelegt.add(e.boatId); wartereiheWeg(e.boatId); } });
  // Abgewiesen, weggefahren, an einen anderen Platz geschickt: Wartereihe sofort weg
  for (const ev of ['sim:turnedAway', 'sim:dismissed', 'sim:selfEntered']) game.on(ev, (e) => wartereiheWeg(e?.boatId));
  function wartereiheWeg(id) { if (id != null && reihen.get(id)?.art === 'warten') entferneReihe(id); }
  game.on('sim:feeReady', (e) => {
    const id = e?.boatId;
    if (id == null || !frischAngelegt.has(id)) return;   // morgendliches Liegegeld der Bleibenden: keine Anzeige
    frischAngelegt.delete(id);
    const b = st()?.boats?.[id];
    if (!b?.wishes?.length) return;
    const erfuellt = new Set(Array.isArray(e.wishesMet) ? e.wishesMet : []);
    ergebnisse.set(id, { wuensche: [...b.wishes], erfuellt });
    const a = game.boatView?.boot?.(id);
    if (a?.moored && a.berth && a.berth.kind !== 'buoy') zeigeErgebnis(id);
  });
  game.on('boat:moored', (d) => {
    const id = d?.id;
    if (id == null || !ergebnisse.has(id)) return;
    if (String(d.berth ?? '').startsWith('boje-') || String(d.berth ?? '').startsWith('anker-')) return;
    zeigeErgebnis(id);
  });
  function zeigeErgebnis(id) {
    const e = ergebnisse.get(id);
    ergebnisse.delete(id);
    // schon abgerechnet (bei hohem Tempo erreicht ein Boot die Box manchmal erst danach): keine Haken mehr
    if (!e || st()?.boats?.[id]?.status !== 'moored') return;
    entferneReihe(id);
    const node = baueReihe(id, e.wuensche, e.erfuellt);
    node.classList.add('ergebnis');
    reihen.set(id, { node, key: 'ergebnis', art: 'ergebnis', bis: performance.now() + 4200 });
  }
  game.on('sim:select', (d) => { gewaehlt = d?.boatId ?? null; });
  const aufraeumen = () => { for (const id of [...reihen.keys()]) entferneReihe(id); ergebnisse.clear(); frischAngelegt.clear(); };
  game.on('spielstand-geladen', aufraeumen);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') aufraeumen(); });

  // Jedes Bild: Symbole über die Boote setzen (Bildschirmkoordinaten, ganze Pixel)
  let abgleichT = 0;
  const _p = { x: 0, y: 0, z: 0 };
  function projiziere(anim, hoehe) {
    const cam = game.camera?.camera;
    const m = anim?.model;
    if (!cam || !m) return null;
    const v = m.position.clone();
    v.y += hoehe;
    v.project(cam);
    if (v.z > 1 || v.z < -1) return null;
    // ungefähre Bootslänge auf dem Bildschirm: zu klein (Übersicht) -> keine Symbole
    const w = m.position.clone();
    w.x += anim.info?.length ?? 6;
    w.project(cam);
    _p.x = v.x; _p.y = v.y; _p.z = Math.hypot(w.x - v.x, w.y - v.y);
    return _p;
  }
  game.onTick?.((dt) => {
    abgleichT += dt || 0.016;
    if (abgleichT > 0.25 || dt === 0) { abgleichT = 0; wartendeAbgleichen(); }
    if (!reihen.size) return;
    const canvas = game.renderer?.domElement;
    if (!canvas) return;
    const rc = canvas.getBoundingClientRect();
    const rr = ebene.getBoundingClientRect();
    const jetzt = performance.now();
    const belegt = [];      // Rechtecke der schon gesetzten Reihen: keine Reihe deckt eine andere zu
    // das gewählte Boot zuerst, damit seine Reihe nie verdeckt wird
    const folge = [...reihen].sort(([a], [b]) => (b === gewaehlt) - (a === gewaehlt));
    for (const [id, r] of folge) {
      if (r.art === 'ergebnis' && jetzt > r.bis) {
        if (!r.node.classList.contains('weg')) { r.node.classList.add('weg'); r.bis = jetzt + 400; continue; }
        entferneReihe(id);
        continue;
      }
      const a = game.boatView?.boot?.(id);
      if (!a) { entferneReihe(id); continue; }
      let h = Math.max(1.4, (a.model?.userData?.iconHeight ?? (a.info?.length ?? 6) * 0.35) + (r.art === 'ergebnis' ? 1.2 : 0.3));
      // Sonderfall mit Leitstelle: über der Mastspitze schwebt die orange Raute (ui/hud.js), die Schilder stehen darüber
      if (r.art === 'warten' && raute(id)) {
        if (r.mast == null && game.THREE) {
          const box = new game.THREE.Box3().setFromObject(a.model);
          r.mast = Number.isFinite(box.max.y) ? box.max.y - a.model.position.y : 0;
        }
        // gleiche Rechnung wie ui/hud.js: Raute über dem Mast, mit der Entfernung größer
        const h0 = Math.max(2.4, a.model?.userData?.iconHeight ?? 0, r.mast ?? 0) + 1.0;
        const cam = game.camera?.camera;
        const weit = cam ? Math.hypot(cam.position.x - a.model.position.x, cam.position.y - h0, cam.position.z - a.model.position.z) : 60;
        h = h0 + 2.5 * Math.min(6, Math.max(1, weit * 0.022));
      }
      const p = projiziere(a, h);
      let sichtbar = !!p && p.z * rc.width / 2 >= 20 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      const x = sichtbar ? Math.round(rc.left - rr.left + (p.x + 1) / 2 * rc.width) : 0;
      const y = sichtbar ? Math.round(rc.top - rr.top + (1 - p.y) / 2 * rc.height) - (r.art === 'ergebnis' ? 22 : 6) : 0;
      if (sichtbar) {
        const w = (r.breite ??= r.node.children.length * 30 + 8), h = 34;
        const box = [x - w / 2, y - h, x + w / 2, y];
        if (belegt.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) sichtbar = false;
        else belegt.push(box);
      }
      r.node.classList.toggle('gewaehlt', id === gewaehlt);
      r.node.style.visibility = sichtbar ? '' : 'hidden';
      if (!sichtbar) continue;
      const tr = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      if (r.pos !== tr) { r.node.style.transform = tr; r.pos = tr; }
    }
  });

  // ================================================================ Funk: die nächsten drei Boote
  const funk = el('div');
  funk.id = 'hm-funk';
  funk.hidden = true;
  const kopf = el('button', 'hm-px hm-funk-kopf');
  kopf.type = 'button';
  kopf.setAttribute('aria-expanded', 'true');
  const kopfSym = el('i', 'hm-sym');
  kopfSym.setAttribute('aria-hidden', 'true');
  kopfSym.style.setProperty('--sym', 'var(--px-funk)');
  kopf.append(kopfSym, el('span', null, 'Funk'));
  kopf.title = 'Funk: die nächsten Boote des Tages';
  const liste = el('div', 'hm-funk-liste');
  liste.setAttribute('role', 'list');
  liste.setAttribute('aria-label', 'Die nächsten Boote');
  const satz = el('div', 'hm-px hm-funk-satz');
  satz.hidden = true;
  satz.setAttribute('role', 'status');
  funk.append(kopf, liste, satz);
  root.append(funk);

  let zu = false;
  try { zu = localStorage.getItem('hm-funk-zu') === '1'; } catch { /* privat */ }
  const setzeZu = (z) => {
    zu = z;
    funk.classList.toggle('zu', z);
    kopf.setAttribute('aria-expanded', String(!z));
    if (z) satz.hidden = true;
    try { localStorage.setItem('hm-funk-zu', z ? '1' : '0'); } catch { /* privat */ }
  };
  setzeZu(zu);
  kopf.addEventListener('click', (e) => { e.stopPropagation(); setzeZu(!zu); });

  let satzFuer = null;
  function zeigeSatz(d, knopf) {
    if (satzFuer === d.id && !satz.hidden) { satz.hidden = true; satzFuer = null; return; }
    satzFuer = d.id;
    satz.textContent = funkSatz(d);
    satz.hidden = false;
    satz.style.top = `${knopf.offsetTop}px`;
  }
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('#hm-funk')) { satz.hidden = true; satzFuer = null; } }, true);

  const umrissCache = new Map();
  function umrissBild(d) {
    const k = `${d.art}|${d.laenge}|${d.breite}`;
    let u = umrissCache.get(k);
    if (!u) {
      const r = umrissRaster(d.art, d.laenge, d.breite);
      u = { src: `data:image/svg+xml,${encodeURIComponent(umrissSvg(r))}`, w: r[0].length, h: r.length };
      umrissCache.set(k, u);
      if (umrissCache.size > 200) umrissCache.delete(umrissCache.keys().next().value);
    }
    return u;
  }

  let funkSchluessel = '';
  let bekannt = new Set();
  function zeichneFunk() {
    const s = st(), ctx = sim()?.ctx;
    const frei = funkFrei(s, ctx);
    const winter = frei && sim()?.season?.()?.winter;
    funk.hidden = !frei || !!winter;
    if (funk.hidden) { funkSchluessel = ''; return; }
    const daten = funkDaten(s, ctx, sim()?.preview?.() ?? []);
    const schluessel = JSON.stringify([s?.phase, daten.map((d) => [d.id, d.zeit, d.wuensche])]);
    if (schluessel === funkSchluessel) return;
    funkSchluessel = schluessel;
    const vorher = bekannt;
    bekannt = new Set(daten.map((d) => d.id));
    if (satzFuer != null && !bekannt.has(satzFuer)) { satz.hidden = true; satzFuer = null; }
    if (!daten.length) {
      liste.replaceChildren(el('div', 'hm-px hm-funk-leer', s?.phase === 'day' || s?.phase == null ? 'Heute kommt niemand mehr' : 'Funk still'));
      return;
    }
    // Bildgröße: 3 Bildschirmpixel je Rasterpunkt (Handy 2), für alle Boote gleich, damit die Längen vergleichbar bleiben
    const k = funk.getBoundingClientRect().width < 100 ? 2 : 3;
    liste.replaceChildren(...daten.map((d) => {
      const b = el('button', `hm-px hm-funk-boot${d.gleich ? ' gleich' : ''}${vorher.size && !vorher.has(d.id) ? ' neu' : ''}`);
      b.type = 'button';
      b.setAttribute('role', 'listitem');
      b.setAttribute('aria-label', funkSatz(d));
      b.title = funkSatz(d);
      const u = umrissBild(d);
      const img = el('img', 'hm-funk-umriss');
      img.src = u.src;
      img.alt = '';
      img.width = Math.round(u.w * k);
      img.height = Math.round(u.h * k);
      const zeile = el('span', 'hm-funk-zeile');
      zeile.append(el('span', 'hm-funk-zeit', d.zeit), el('span', 'hm-funk-laenge', meter(Math.round(d.laenge))));
      const w = el('span', 'hm-funk-wuensche');
      for (const x of d.wuensche) w.append(symbol(x));
      b.append(img, zeile, w);
      b.addEventListener('click', (e) => { e.stopPropagation(); zeigeSatz(d, b); });
      return b;
    }));
  }
  let geplant = false;
  const plane = () => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; zeichneFunk(); });
  };
  game.on('sim:arrived', () => zeichneFunk());
  for (const ev of ['sim:change', 'sim:dayStart', 'sim:built', 'stufe', 'spielstand-geladen', 'ready', 'resize']) game.on(ev, plane);
  // "gleich" und Uhrzeit ändern sich mit der Zeit, auch ohne Ereignis
  let funkT = 0;
  game.onTick?.((dt) => { funkT += dt; if (funkT > 1) { funkT = 0; plane(); pruefeVerdeckt(); } });
  // Einstiegs-Hinweis oder Ereignis-Banner liegen am Handy oft über der Funkspalte: dann tritt der Funk zurück
  function pruefeVerdeckt() {
    if (funk.hidden) return;
    const f = funk.getBoundingClientRect();
    const ueber = [...document.querySelectorAll('.hm-tipp, #event-banner')].some((x) => {
      if (x.hidden || getComputedStyle(x).display === 'none' || getComputedStyle(x).visibility === 'hidden') return false;
      const r = x.getBoundingClientRect();
      return r.width > 0 && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top;
    });
    funk.classList.toggle('verdeckt', ueber);
  }
  // Handy hochkant: Bootskarte offen -> Funk ausblenden (Klasse hm-schmal)
  const schmal = () => document.body.classList.toggle('hm-schmal', window.innerWidth < 600);
  window.addEventListener('resize', schmal);
  schmal();
  plane();

  game.vorschau = {
    wunschSymbole: WUNSCH,
    funkAn: () => !funk.hidden,
    aktualisieren: () => { funkSchluessel = ''; zeichneFunk(); wartendeAbgleichen(); },
  };
}

export default init;
