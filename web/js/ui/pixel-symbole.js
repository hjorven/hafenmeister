// Pixel-Symbole: ein Satz für die ganze Oberfläche (Knöpfe, Wetter, Ereignisse, Haken, Pfeile).
// Kein eigenes Modul in MODULES: ui/oberflaeche.js und events/banner.js importieren von hier.
//
// Regeln, damit alles zusammenpasst:
//   - Jedes Symbol ist ein Raster aus 12 x 12 Zeichen, gezeigt in 24 px (2 x) oder 12 px.
//   - '#' ist Maske: CSS färbt (Knöpfe, Haken, Pfeile). Die Farbe kommt vom Zustand des Knopfs.
//   - Buchstaben sind feste Farben aus FARBE (Münze, Stern, Wetter, Ereignisse).
//     Farbige Bilder haben einen Umriss in Tinte (k), so wie die Pixelrahmen.
//   - Strichstärke mindestens 2 Pixel bei Bedienknöpfen, damit sie am Handy lesbar bleiben.
// Vorschau aller Symbole: tools/pixel-symbole-vorschau.mjs (schreibt ein Bild).

export const FARBE = {
  k: '#24364a',                                                 // Tinte (Umriss)
  o: '#7a5212', g: '#f2c14e', h: '#fde49a', d: '#d39b2c',      // Münze
  s: '#e0962a', y: '#ffd95a', r: '#f0a03a',                     // Stern, Sonne, Blitz
  m: '#eef2f8', n: '#aeb9cc',                                    // Mond
  w: '#f4f7fa', c: '#c3ced8',                                    // Wolke hell, Wolke Schatten
  D: '#7d8b99', S: '#5d6a78',                                    // Sturmwolke
  b: '#3f8fd0', i: '#8fb8d0', f: '#9fb0bc',                      // Regen, Schnee, Nebel
  R: '#ee6454', B: '#3b6f8f', W: '#62b4c2', p: '#fffcf6',       // Koralle, Rumpf, Welle, Papier
};

export const PIXEL = {
  // ------------------------------------------------ Bedienung (Maske)
  pause: ['............', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '............'],
  tempo1: ['............', '...#........', '...##.......', '...###......', '...####.....', '...#####....', '...#####....', '...####.....', '...###......', '...##.......', '...#........', '............'],
  tempo2: ['............', '.#.....#....', '.##....##...', '.###...###..', '.####..####.', '.#####.#####', '.#####.#####', '.####..####.', '.###...###..', '.##....##...', '.#.....#....', '............'],
  tempo3: ['............', '............', '#...#...#...', '##..##..##..', '###.###.###.', '############', '############', '###.###.###.', '##..##..##..', '#...#...#...', '............', '............'],
  menue: ['............', '............', '.##########.', '.##########.', '............', '.##########.', '.##########.', '............', '.##########.', '.##########.', '............', '............'],
  uebersicht: ['####....####', '##........##', '#..........#', '#..........#', '............', '.....##.....', '.....##.....', '............', '#..........#', '#..........#', '##........##', '####....####'],
  foto: ['............', '....####....', '.##########.', '.##......###', '.#..####..##', '.#.##..##.##', '.#.##..##.##', '.#..####..##', '.##......###', '.##########.', '............', '............'],
  ton: ['............', '.....#......', '....##...#..', '.####..#..#.', '.####...#.#.', '.####...#.#.', '.####...#.#.', '.####..#..#.', '....##...#..', '.....#......', '............', '............'],
  stumm: ['............', '.....#......', '....##......', '.####..#...#', '.####...#.#.', '.####....#..', '.####...#.#.', '.####..#...#', '....##......', '.....#......', '............', '............'],
  spielstand: ['............', '.#########..', '.##.####.##.', '.##.####..#.', '.##.......#.', '.#........#.', '.#.######.#.', '.#.#....#.#.', '.#.######.#.', '.##########.', '............', '............'],
  tasten: ['............', '............', '############', '#.#.#.#.#.##', '#..........#', '##.#.#.#.#.#', '#..........#', '#..######..#', '#..........#', '############', '............', '............'],
  bauen: ['............', '.########...', '.#########..', '.########...', '...##.......', '...##.......', '...##.......', '...##.......', '...##.......', '...##.......', '..####......', '............'],
  abschluss: ['............', '.........##.', '.........##.', '......##.##.', '......##.##.', '...##.##.##.', '...##.##.##.', '...##.##.##.', '...##.##.##.', '...##.##.##.', '############', '............'],
  ziele: ['............', '..#.........', '.#..#######.', '#...........', '............', '..#.........', '.#..#######.', '#...........', '............', '..#.........', '.#..#######.', '#...........'],
  flagge: ['............', '.#####......', '.#########..', '.#########..', '.#########..', '.#..######..', '.#..........', '.#..........', '.#..........', '.#..........', '.#..........', '............'],
  zu: ['............', '.##......##.', '.###....###.', '..###..###..', '...######...', '....####....', '....####....', '...######...', '..###..###..', '.###....###.', '.##......##.', '............'],
  zahnrad: ['............', '.....##.....', '..#.####.#..', '..########..', '...##..##...', '.###....###.', '.###....###.', '...##..##...', '..########..', '..#.####.#..', '.....##.....', '............'],
  haken: ['............', '............', '..........##', '.........###', '........###.', '.##....###..', '.###..###...', '..######....', '...####.....', '....##......', '............', '............'],
  kreis: ['............', '............', '....####....', '...#....#...', '..#......#..', '..#......#..', '..#......#..', '..#......#..', '...#....#...', '....####....', '............', '............'],
  pfeil: ['............', '......#.....', '......##....', '......###...', '......####..', '.##########.', '.##########.', '......####..', '......###...', '......##....', '......#.....', '............'],
  pfeilschraeg: ['............', '.##.........', '.###........', '..###.......', '...###...##.', '....###..##.', '.....###.##.', '......#####.', '.......####.', '..#########.', '..#########.', '............'],
  hilfe: ['............', '....####....', '...##..##...', '...##..##...', '.......##...', '......##....', '.....##.....', '.....##.....', '............', '.....##.....', '.....##.....', '............'],
  warnung: ['............', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '............', '.....##.....', '.....##.....', '............', '............'],

  // ------------------------------------------------ Anzeigen (feste Farben)
  hinweis: ['kkkkkkkkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkkkkkkkk', 'kkkkkggkkkkk', 'kkkkkggkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk'],
  muenze: ['...oooooo...', '..ohhhhhhoo.', '.ohhggggggdo', '.ohggoooggdo', 'ohggoggggggo', 'ohgoooooggdo', 'ohggoggggggo', 'ohgoooooggdo', '.ohggoooggdo', '.oggggggggdo', '..oddddddoo.', '...oooooo...'],
  stern: ['.....oo.....', '....oyyo....', '....oyyo....', 'oooooyyooooo', 'oyyyyyyyyyyo', '.osyyyyyyso.', '..osyyyyso..', '..osyyyyso..', '.osyysssyso.', '.osso..osso.', 'oso......oso', 'oo........oo'],
  sonne: ['.....yy.....', '..y..yy..y..', '...y....y...', '....rrrr....', '.y.ryyyyr.y.', 'yy.ryyyyr.yy', 'yy.ryyyyr.yy', '.y.ryyyyr.y.', '....rrrr....', '...y....y...', '..y..yy..y..', '.....yy.....'],
  mond: ['............', '....nnnn....', '...nmmmmn...', '..nmmmmnn...', '..nmmmn.....', '..nmmmn.....', '..nmmmn.....', '..nmmmmn....', '..nmmmmmnn..', '...nmmmmmn..', '....nnnnn...', '............'],
  wolke: ['............', '............', '.....kkk....', '....kwwwk...', '..kkwwwwwk..', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kcccccccccck', '.kkkkkkkkkk.', '............', '............'],
  regen: ['....kkk.....', '...kwwwk....', '.kkwwwwwkk..', 'kwwwwwwwwwk.', 'kwwwwwwwwwwk', 'kcccccccccck', '.kkkkkkkkkk.', '............', '..b...b...b.', '.b...b...b..', '............', '..b...b.....'],
  sturm: ['....kkk.....', '...kDDDk....', '.kkDDDDDkk..', 'kDDDDDDDDDk.', 'kDDDDyyDDDDk', 'kSSSyySSSSSk', '.kkyykkkkkk.', '...yyyyy....', '.....yy.....', '....yy......', '...y........', '............'],
  nebel: ['............', '............', '.ffffffff...', '............', '...ffffffff.', '............', 'ffffffffff..', '............', '..ffffffffff', '............', '.ffffffff...', '............'],
  schnee: ['.....ii.....', '..i..ii..i..', '...i.ii.i...', '....iiii....', '.i...ii...i.', 'iiiiiiiiiiii', 'iiiiiiiiiiii', '.i...ii...i.', '....iiii....', '...i.ii.i...', '..i..ii..i..', '.....ii.....'],
  regatta: ['.....k......', '....Rkk.....', '...RRkpk....', '..RRRkppk...', '.RRRRkpppk..', 'RRRRRkkkkkk.', '.....k......', 'kkkkkkkkkkkk', '.kBBBBBBBBk.', '..kBBBBBBk..', 'WW.WWW.WWW.W', '............'],
  fest: ['..kkk.......', '.kRRRk.kkk..', '.kRRRkkyyyk.', '.kRRRkkyyyk.', '..kRk.kyyyk.', '...k...kyk..', '...k....k...', '....k...k...', '....k..k....', '.....kk.....', '.....k......', '.....k......'],
  // Hafenbüro: orange Raute = Sonderfall für den Spieler, goldene Raute = Vorschlag des Büros
  raute: ['.....kk.....', '....kssk....', '...kssssk...', '..kssssssk..', '.kssssssssk.', 'kssssppssssk', 'kssssppssssk', '.kssssssssk.', '..kssssssk..', '...kssssk...', '....kssk....', '.....kk.....'],
  rauteGold: ['.....kk.....', '....kggk....', '...kggggk...', '..kggggggk..', '.kggggggggk.', 'kggggppggggk', 'kggggppggggk', '.kggggggggk.', '..kggggggk..', '...kggggk...', '....kggk....', '.....kk.....'],
  schiff: ['............', '......RR....', '......RR....', '...kkkkkkk..', '...kpBpBpk..', '.kkkkkkkkkk.', '.kpBpBpBpBk.', 'kkkkkkkkkkkk', 'kBBBBBBBBBBk', '.kBBBBBBBBk.', '..kkkkkkkk..', 'WW.WWW.WWW.W'],
};

// Raster -> SVG-Text. '#' wird schwarz (für Masken), Buchstaben bekommen ihre Farbe.
export function pixelSvg(raster) {
  const h = raster.length;
  const w = raster[0].length;
  let r = '';
  raster.forEach((zeile, y) => {
    [...zeile].forEach((c, x) => {
      if (c === '.' || c === ' ') return;
      r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c === '#' ? 'black' : FARBE[c] ?? 'black'}"/>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
}

// Fertiges <svg>-Element zum Einhängen (z. B. Wetterschild), ohne innerHTML.
export function pixelBild(name, groesse = 24) {
  const NS = 'http://www.w3.org/2000/svg';
  const raster = PIXEL[name] ?? PIXEL.wolke;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${raster[0].length} ${raster.length}`);
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('hm-pixelbild');
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '.' || c === ' ') return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', '1.02'); r.setAttribute('height', '1.02');
    r.setAttribute('fill', c === '#' ? 'currentColor' : FARBE[c] ?? 'currentColor');
    svg.append(r);
  }));
  return svg;
}
