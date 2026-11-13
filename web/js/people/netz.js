// Wegenetz fuer die Menschen im Hafen: Uferweg, Dorfstrasse, Stege, Molen, Kai, Nehrungsweg,
// dazu Tueren der Gebaeude und Einstiege der Liegeplaetze. Kennt kein Three.js, damit es sich
// mit node --test pruefen laesst.
// Gehoert dem Thread "Menschen im Hafen herumlaufen lassen".
//
// Alle Koordinaten in Planeinheiten wie in web/js/data/harbor.js (x nach Osten, y nach Norden,
// 1 Einheit = 0,62 m). Die Gelaendeformen stammen aus skripte/konzeptbilder/hafen_von_oben.py.
//
//   const netz = baueNetz({ hafen, stufe, gebaeude })
//   netz.nodes[i]        { x, y, art }  art: land, strand, sand, wasser, holz, schwimmsteg, kai, mole, bruecke, boot
//   netz.komp[i]         Nummer der zusammenhaengenden Flaeche (Festland, Nehrung)
//   netz.weg(a, b)       Liste von Knoten-Indizes von a nach b (A*), oder null
//   netz.plaetze         Map Platz-id -> { x, y, node } (Boot und Einstieg am Steg)
//   netz.ziele           [{ node, art, id, drinnen }] Ziele zum Hingehen
//   netz.zuhause         [node] Haustueren und Kartenraender, hier kommen Spaziergaenger her
//   netz.duenen          [node] Nehrungsweg hinter den Duenen, hier kommen Badegaeste her
//   netz.flaechen        { festland, nehrung } Nummern der beiden Flaechen
//   netz.zentrum         { x, y } Mitte der Stegwurzeln, dort ist am meisten los
//   netz.naechster(x, y, komp)  naechster Knoten (optional nur in einer Flaeche)

const coast = (x) => 5 * Math.sin(x / 70) + 3 * Math.sin(x / 31 + 1);
export const suedufer = (x) => coast(x) + 0.02 * Math.max(0, -235 - x) ** 2;
export const meerSued = (x) => 224 + 4 * Math.sin(x / 80 + 1) + 2 * Math.sin(x / 27);   // Ostseestrand der Nehrung
export const ufer = (x, stufe) => (stufe >= 3 && x >= -150 && x <= 202 ? 6 : suedufer(x));

const STRASSE_Y = -88;       // Dorfstrasse hinter dem Hafen
const NEHRUNG_Y = 209;       // Weg auf der Nehrung zwischen See und Strand (hinter den Duenen)
const FEST_X = [-240, 236];  // Uferweg und Strasse, an den Enden geht es aus dem Bild
const NEHRUNG_X0 = -290;
const DURCHSTICH_X = 140;    // Nehrungsweg endet vor dem Engpass (Seegatt Stufe 1-2 ab x 150, Durchstich ab x 150, render/landschaft/karte.js)
const MOLEN = {
  3: [[[146, 222], [142, 274]]],
  4: [[[146, 222], [142, 274]]],
  5: [[[-2, 224], [-10, 282], [18, 312], [96, 320]]],
};
const SEEBRUECKE_LAENGE = (44 + 3.2) / 0.62;   // aus buildings.js, in Planeinheiten

function uferwegY(x, stufe) {
  return stufe >= 3 && x >= -150 && x <= 202 ? -4 : suedufer(x) - 9;
}

export function aufFestland(x, y, stufe) {
  return y < ufer(x, stufe) + 0.5;
}

function naechsterAufStrecke(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t, y = ay + dy * t;
  return { t, x, y, d: Math.hypot(px - x, py - y) };
}

export function baueNetz({ hafen, stufe, gebaeude = [] }) {
  const st = hafen.stufen[String(stufe)] ?? hafen.stufen[String(Math.min(5, stufe))];
  const linien = [];         // { pts, art, gruppe, steg, att: [{ seg, t, h }] }
  const haken = [];          // Handle -> Knoten (nach dem Zusammenbau)
  const paare = [];          // [Handle, Handle] spaeter verbinden

  const linie = (pts, art, gruppe, steg = null) => {
    const l = { pts, art, gruppe, steg, att: [] };
    linien.push(l);
    return l;
  };

  // Punkt an die naechste passende Linie haengen. Liefert ein Handle.
  const anschluss = (x, y, filter) => {
    let best = null;
    for (const l of linien) {
      if (!filter(l)) continue;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
        const n = naechsterAufStrecke(x, y, ax, ay, bx, by);
        if (!best || n.d < best.d) best = { ...n, l, seg: i };
      }
    }
    if (!best) return null;
    const h = haken.length;
    haken.push(null);
    best.l.att.push({ seg: best.seg, t: best.t, h });
    return { h, d: best.d, x: best.x, y: best.y };
  };

  // ---------------------------------------------------------------- Festland
  const ufPts = [];
  for (let x = FEST_X[0]; x <= FEST_X[1]; x += 8) ufPts.push([x, uferwegY(x, stufe)]);
  const uferweg = linie(ufPts, 'land', 'festland');
  const strasse = linie([[FEST_X[0], STRASSE_Y], [FEST_X[1], STRASSE_Y]], 'land', 'festland');

  // Querwege zwischen Ufer und Strasse, nicht durch Gebaeude
  const festGeb = gebaeude.filter((g) => g.y < 100);
  let letzter = -Infinity;
  for (let x = FEST_X[0] + 10; x <= FEST_X[1] - 10; x += 4) {
    if (x - letzter < 44) continue;
    if (festGeb.some((g) => Math.abs(g.x - x) < (g.halbBreite ?? 8) + 5 && g.y > STRASSE_Y)) continue;
    letzter = x;
    const y0 = uferwegY(x, stufe);
    const q = linie([[x, y0], [x, STRASSE_Y]], 'land', 'festland');
    const oben = anschluss(x, y0, (l) => l === uferweg);
    const unten = anschluss(x, STRASSE_Y, (l) => l === strasse);
    paare.push([anschlussEnde(q, 0), oben.h], [anschlussEnde(q, 1), unten.h]);
  }

  // ---------------------------------------------------------------- Nehrung
  const nEnde = DURCHSTICH_X;   // auch in Stufe 1 und 2: dort trennt das Seegatt die Nehrung
  const nPts = [];
  for (let x = NEHRUNG_X0; x <= nEnde; x += 10) nPts.push([x, NEHRUNG_Y]);
  if (nPts[nPts.length - 1][0] !== nEnde) nPts.push([nEnde, NEHRUNG_Y]);
  const nehrungsweg = linie(nPts, 'land', 'nehrung');
  const istNehrungsweg = (l) => l.gruppe === 'nehrung' && l.art === 'land';

  // Strandweg am Ostseestrand (ab Stufe 5 nur westlich des Aussenhafens) mit Duenenuebergaengen
  const sEnde = stufe >= 5 ? -14 : nEnde;
  const sPts = [];
  for (let x = NEHRUNG_X0; x <= sEnde; x += 10) sPts.push([x, meerSued(x) - 4]);
  const strandweg = linie(sPts, 'strand', 'nehrung');
  for (let x = NEHRUNG_X0 + 25; x <= sEnde - 10; x += 55) {
    if (Math.abs(x + 170) < 10) continue;   // nicht unter der Seebruecke
    const y1 = meerSued(x) - 4;
    const q = linie([[x, NEHRUNG_Y], [x, y1]], 'land', 'nehrung');
    paare.push([anschlussEnde(q, 0), anschluss(x, NEHRUNG_Y, (l) => l === nehrungsweg).h]);
    paare.push([anschlussEnde(q, 1), anschluss(x, y1, (l) => l === strandweg).h]);
  }

  const aussicht = [];       // Handles fuer Steg- und Molenkoepfe
  for (const pts of MOLEN[Math.min(5, stufe)] ?? []) {
    linie(pts, 'mole', 'nehrung');
  }
  // Seebruecke (aus den Gebaeuden), ragt nach Norden in die Ostsee
  for (const g of gebaeude) {
    if (g.art !== 'seebruecke') continue;
    linie([[g.x, NEHRUNG_Y], [g.x, g.y], [g.x, g.y + SEEBRUECKE_LAENGE]], 'bruecke', 'nehrung');
  }

  // ---------------------------------------------------------------- Stege
  for (const s of st?.stege ?? []) {
    if (!s.steg) continue;   // Dienststege (Tankstelle, Seenotretter, Travellift)
    linie(s.punkte.map((p) => [p[0], p[1]]), s.bauart === 'kai' ? 'kai' : s.bauart, s.bauart === 'kai' ? 'nehrung' : 'steg', s.steg);
  }

  // Enden der Stege, Molen und Kais anschliessen
  const stegLinien = linien.filter((l) => l.gruppe === 'steg');
  for (const l of linien) {
    if (l.gruppe === 'steg') {
      const ends = [l.pts[0], l.pts[l.pts.length - 1]];
      ends.forEach(([x, y], k) => {
        const hEnde = anschlussEnde(l, k === 0 ? 0 : l.pts.length - 1);
        if (aufFestland(x, y, stufe)) {
          const h = anschluss(x, y, (o) => o.gruppe === 'festland');
          if (h) paare.push([hEnde, h.h]);
        } else {
          const h = anschluss(x, y, (o) => o !== l && o.gruppe === 'steg');
          if (h && h.d < 8) paare.push([hEnde, h.h]);
          else aussicht.push(hEnde);
        }
      });
    } else if (l.art === 'kai' || l.art === 'mole' || l.art === 'bruecke') {
      const [x, y] = l.pts[0];
      const hEnde = anschlussEnde(l, 0);
      const h = anschluss(x, y, istNehrungsweg);
      if (h) paare.push([hEnde, h.h]);
      if (l.art === 'kai') {
        const [x2, y2] = l.pts[l.pts.length - 1];
        const h2 = anschluss(x2, y2, istNehrungsweg);
        if (h2) paare.push([anschlussEnde(l, l.pts.length - 1), h2.h]);
      } else {
        aussicht.push(anschlussEnde(l, l.pts.length - 1));
      }
    }
  }

  function anschlussEnde(l, i) {
    const h = haken.length;
    haken.push(null);
    if (i === 0) l.att.push({ seg: 0, t: 0, h });
    else l.att.push({ seg: i - 1, t: 1, h });
    return h;
  }

  // ---------------------------------------------------------------- Strand und Badestellen
  // Plaetze zum Sitzen im Sand, davor eine Stelle im flachen Wasser zum Baden.
  const spotsRoh = [];
  for (let x = NEHRUNG_X0 + 12; x <= sEnde - 6; x += 22) {
    if (Math.abs(x + 170) < 8) continue;
    const h = anschluss(x, meerSued(x) - 4, (l) => l === strandweg);
    spotsRoh.push({ x, y: meerSued(x) - 1.5, wasser: meerSued(x) + 6, h: h.h });
  }
  const stegWurzeln = (st?.stege ?? []).filter((s) => s.steg && s.bauart !== 'kai').map((s) => s.punkte[0][0]);
  for (const x of [-230, -205, -180, -85, -72, -28, 40, 70, 95, 214, 228]) {
    if (stufe >= 3 && x >= -156 && x <= 206) continue;          // dort ist Kaimauer und Promenade
    if (stegWurzeln.some((sx) => Math.abs(sx - x) < 12)) continue;
    const h = anschluss(x, uferwegY(x, stufe), (l) => l === uferweg);
    spotsRoh.push({ x, y: suedufer(x) - 3, wasser: suedufer(x) + 5, h: h.h });
  }

  // ---------------------------------------------------------------- Liegeplaetze
  const plaetzeRoh = [];
  for (const p of hafen.plaetze) {
    const lage = p.lage[String(stufe)];
    if (!lage) continue;
    const [x, y, richtung] = lage;
    const eigene = (l) => (l.gruppe === 'steg' || l.art === 'kai') && l.steg === p.steg;
    let h = anschluss(x, y, eigene);
    if (!h) h = anschluss(x, y, (l) => l.gruppe === 'steg' || l.art === 'kai');
    if (h) plaetzeRoh.push({ id: p.id, x, y, richtung, h: h.h, klasse: p.klasse });
  }

  // ---------------------------------------------------------------- Gebaeude
  const gebRoh = [];
  for (const g of gebaeude) {
    if (g.art === 'seebruecke') continue;
    const tuer = g.tuer ?? { x: g.x, y: g.art === 'wohnhaus' ? g.y - 6 : g.art === 'strandkoerbe' ? g.y - 3 : g.y + 6 };
    const nehrung = g.y > 100;
    const filter = nehrung ? istNehrungsweg : (l) => l.gruppe === 'festland';
    const h = anschluss(tuer.x, tuer.y, filter);
    if (h) gebRoh.push({ ...g, tuer, h: h.h });
  }

  // ---------------------------------------------------------------- Knoten bauen
  const nodes = [];
  const adj = [];
  const add = (x, y, art) => { nodes.push({ x, y, art }); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => {
    if (a == null || b == null || a === b || adj[a].includes(b)) return;
    adj[a].push(b); adj[b].push(a);
  };
  for (const l of linien) {
    const vert = l.pts.map(([x, y]) => add(x, y, l.art));
    for (let i = 0; i < l.pts.length - 1; i++) {
      const atts = l.att.filter((a) => a.seg === i).sort((a, b) => a.t - b.t);
      let prev = vert[i];
      for (const a of atts) {
        let n;
        if (a.t < 1e-3) n = vert[i];
        else if (a.t > 1 - 1e-3) n = vert[i + 1];
        else {
          const [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
          n = add(ax + (bx - ax) * a.t, ay + (by - ay) * a.t, l.art);
        }
        haken[a.h] = n;
        link(prev, n);
        prev = n;
      }
      link(prev, vert[i + 1]);
    }
  }
  for (const [a, b] of paare) link(haken[a], haken[b]);

  const plaetze = new Map();
  for (const p of plaetzeRoh) {
    const n = add(p.x, p.y, 'boot');
    link(n, haken[p.h]);
    plaetze.set(p.id, { id: p.id, x: p.x, y: p.y, richtung: p.richtung, node: n, einstieg: haken[p.h] });
  }

  const ziele = [];
  const zuhause = [];
  for (const g of gebRoh) {
    const n = add(g.tuer.x, g.tuer.y, 'land');
    link(n, haken[g.h]);
    if (g.art === 'wohnhaus') zuhause.push(n);
    else ziele.push({ node: n, art: g.art, id: g.id });
  }
  for (const h of aussicht) ziele.push({ node: haken[h], art: 'aussicht', id: null });
  for (const sp of spotsRoh) {
    const sand = add(sp.x, sp.y, 'sand');
    link(sand, haken[sp.h]);
    ziele.push({ node: sand, art: 'strand', id: null });
    const bad = add(sp.x, sp.wasser, 'wasser');
    link(bad, sand);
    ziele.push({ node: bad, art: 'baden', id: null });
  }
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].art === 'bruecke' && adj[i].length === 1 && nodes[i].y > NEHRUNG_Y + 20) {
      // Kopf der Seebruecke
      const z = ziele.find((t) => t.node === i);
      if (z) z.art = 'seebruecke'; else ziele.push({ node: i, art: 'seebruecke', id: 'seebruecke' });
    }
  }

  // Kartenraender: Dorfstrasse und Nehrungsweg fuehren aus dem Bild
  const rand = (x, y) => {
    let best = -1, bd = Infinity;
    nodes.forEach((n, i) => {
      if (n.art !== 'land') return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  zuhause.push(rand(FEST_X[0], STRASSE_Y), rand(FEST_X[1], STRASSE_Y), rand(NEHRUNG_X0, NEHRUNG_Y));

  // ---------------------------------------------------------------- Flaechen
  const komp = new Array(nodes.length).fill(-1);
  let k = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (komp[i] !== -1) continue;
    const stack = [i];
    komp[i] = k;
    while (stack.length) {
      const a = stack.pop();
      for (const b of adj[a]) if (komp[b] === -1) { komp[b] = k; stack.push(b); }
    }
    k++;
  }

  const dist = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);

  // A* auf dem Netz. Boot-Knoten sind Sackgassen: man geht nur hinein, wenn es das Ziel ist.
  function weg(start, ziel) {
    if (start === ziel) return [start];
    if (komp[start] !== komp[ziel]) return null;
    const g = new Map([[start, 0]]);
    const von = new Map();
    const offen = [start];
    const f = new Map([[start, dist(start, ziel)]]);
    const zu = new Set();
    while (offen.length) {
      let bi = 0;
      for (let i = 1; i < offen.length; i++) if (f.get(offen[i]) < f.get(offen[bi])) bi = i;
      const a = offen[bi];
      if (a === ziel) {
        const pfad = [a];
        let c = a;
        while (von.has(c)) { c = von.get(c); pfad.push(c); }
        return pfad.reverse();
      }
      offen.splice(bi, 1);
      zu.add(a);
      for (const b of adj[a]) {
        if (zu.has(b)) continue;
        if ((nodes[b].art === 'boot' || nodes[b].art === 'wasser') && b !== ziel) continue;
        const ng = g.get(a) + dist(a, b);
        if (ng < (g.get(b) ?? Infinity)) {
          von.set(b, a);
          g.set(b, ng);
          f.set(b, ng + dist(b, ziel));
          if (!offen.includes(b)) offen.push(b);
        }
      }
    }
    return null;
  }

  function naechster(x, y, nurKomp = null) {
    let best = -1, bd = Infinity;
    nodes.forEach((n, i) => {
      if (n.art === 'boot' || (nurKomp != null && komp[i] !== nurKomp)) return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // Mitte des Hafens (Wurzeln der Stege): Spaziergaenger halten sich gern in der Naehe auf
  const wurzeln = (st?.stege ?? []).filter((s) => s.steg && s.bauart !== 'kai' && aufFestland(s.punkte[0][0], s.punkte[0][1], stufe)).map((s) => s.punkte[0]);
  const zentrum = wurzeln.length
    ? { x: wurzeln.reduce((a, p) => a + p[0], 0) / wurzeln.length, y: wurzeln.reduce((a, p) => a + p[1], 0) / wurzeln.length }
    : { x: 0, y: 0 };

  // Duenenuebergaenge: hier kommen Badegaeste auf die Nehrung und gehen wieder
  const duenen = nodes.map((n, i) => i).filter((i) => nodes[i].art === 'land' && nodes[i].y === NEHRUNG_Y);
  const flaechen = { festland: komp[nodes.findIndex((n) => n.y < 0 && n.art === 'land')], nehrung: komp[duenen[0]] };

  return { stufe, nodes, adj, komp, weg, naechster, plaetze, ziele, duenen, flaechen, zentrum, zuhause: zuhause.filter((n) => n >= 0) };
}
