// Draufsicht eines Stegbilds als SVG (Planeinheiten, Norden oben). Fuer Vorschaubilder und Fehlersuche.
//   svgStufe(hafen, stufe, { titel, gassen: true, fehler: [] }) -> SVG-Text
import { punkt, warteplaetze, molen } from '../../web/js/render/landschaft/gelaende.js';
import { region } from '../../web/js/render/landschaft/regionen.js';
import { platzFlaechen, festeHindernisse } from './pruefen.mjs';
import { K } from './geometrie.mjs';

const BILD = { x0: -175, x1: 215, y0: -30, y1: 200 };

const geländeCache = new Map();
function gelaendeBild(stufe, z = 2) {
  const key = `${stufe}`;
  if (geländeCache.has(key)) return geländeCache.get(key);
  const teile = [];
  for (let y = BILD.y0; y < BILD.y1; y += z) {
    for (let x = BILD.x0; x < BILD.x1; x += z) {
      const p = punkt(x + z / 2, y + z / 2, stufe, region('ostsee'));
      let farbe;
      if (p.h >= 0) farbe = p.typ === 'pflaster' ? '#e9e4d8' : p.typ === 'sand' ? '#f2dfb0' : p.typ === 'mole' || p.typ === 'steinschuettung' ? '#a9b4bd' : '#b9d6a3';
      else { const t = Math.min(1, -p.h / 4); farbe = `rgb(${Math.round(196 - 90 * t)},${Math.round(228 - 50 * t)},${Math.round(224 - 30 * t)})`; }
      teile.push(`<rect x="${x}" y="${-y - z}" width="${z + 0.05}" height="${z + 0.05}" fill="${farbe}"/>`);
    }
  }
  const s = teile.join('');
  geländeCache.set(key, s);
  return s;
}

const pts = (poly) => poly.map(([x, y]) => `${x.toFixed(1)},${(-y).toFixed(1)}`).join(' ');
const FARBE = { S: '#f0a35e', M: '#5b9bd5', L: '#3a7d5c', XL: '#7b5ea7' };

export function svgStufe(hafen, stufe, { titel = '', gassen = false, fehler = [], breitePx = 1200 } = {}) {
  const st = hafen.stufen[String(stufe)];
  const w = BILD.x1 - BILD.x0, h = BILD.y1 - BILD.y0;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${breitePx}" height="${Math.round(breitePx * h / w)}" viewBox="${BILD.x0} ${-BILD.y1} ${w} ${h}">`);
  out.push(gelaendeBild(stufe));
  for (const m of molen(stufe)) out.push(`<polyline points="${pts(m.punkte)}" fill="none" stroke="#8d99a3" stroke-width="${m.breite}" stroke-linecap="round"/>`);
  for (const b of stufe <= 2 ? warteplaetze(stufe).bojen : []) out.push(`<circle cx="${b.px}" cy="${-b.py}" r="1.6" fill="#f2c94c" stroke="#b33" stroke-width="0.5"/>`);
  if (gassen) {
    for (const hdn of festeHindernisse(stufe)) out.push(`<polygon points="${pts(hdn.poly)}" fill="rgba(200,60,60,0.10)" stroke="rgba(200,60,60,0.4)" stroke-width="0.3"/>`);
  }
  const fehlerIds = new Set(fehler.filter((f) => f.stufe === stufe).map((f) => f.id));
  const plaetze = hafen.plaetze.filter((p) => p.lage[String(stufe)]);
  if (gassen) {
    for (const p of plaetze) {
      const f = platzFlaechen(p, stufe, hafen);
      out.push(`<polygon points="${pts(f.gasse)}" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" stroke-width="0.25"/>`);
    }
  }
  for (const l of st.stege) {
    const farbe = l.bauart === 'schwimmsteg' ? '#cfd8e0' : l.bauart === 'kai' ? '#9aa3aa' : '#d9b27c';
    const rand = l.bauart === 'schwimmsteg' ? '#93a3b3' : '#a77d4c';
    const bw = Math.max(1.2, (l.breite || 2.4) * K);
    out.push(`<polyline points="${pts(l.punkte)}" fill="none" stroke="${rand}" stroke-width="${bw + 0.8}" stroke-linejoin="round" stroke-linecap="square"/>`);
    out.push(`<polyline points="${pts(l.punkte)}" fill="none" stroke="${farbe}" stroke-width="${bw}" stroke-linejoin="round" stroke-linecap="square"/>`);
  }
  for (const p of plaetze) {
    const f = platzFlaechen(p, stufe, hafen);
    const [x, y, r] = p.lage[String(stufe)];
    const rot = -r;
    const bl = p.art === 'box' || p.art === 'finger' ? p.laenge * 0.86 : p.laenge * 0.92;
    const bb = p.art === 'box' || p.art === 'finger' ? Math.min(p.breite * 0.62, (p.klasse === 'S' ? 2.1 : p.klasse === 'M' ? 2.9 : 3.9) * K) : p.breite * 0.9;
    const farbe = fehlerIds.has(p.id) ? '#e03b3b' : (FARBE[p.klasse] ?? '#666');
    // Box-Umriss und Pfaehle
    if (p.art === 'box' || p.art === 'finger') {
      out.push(`<polygon points="${pts(f.platz)}" fill="none" stroke="rgba(60,70,80,0.35)" stroke-width="0.25"/>`);
    }
    // Boot: spitzer Bug in Richtung r
    const hl = bl / 2, hb = bb / 2;
    out.push(`<g transform="translate(${x} ${-y}) rotate(${rot})"><path d="M ${hl} 0 L ${hl * 0.45} ${-hb} L ${-hl} ${-hb * 0.9} L ${-hl} ${hb * 0.9} L ${hl * 0.45} ${hb} Z" fill="${farbe}" stroke="#fff" stroke-width="0.35"/></g>`);
  }
  if (titel) {
    out.push(`<rect x="${BILD.x0 + 3}" y="${-BILD.y1 + 3}" width="${titel.length * 4.4 + 8}" height="13" rx="2" fill="rgba(255,255,255,0.85)"/>`);
    out.push(`<text x="${BILD.x0 + 7}" y="${-BILD.y1 + 12.5}" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#243447">${titel}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
