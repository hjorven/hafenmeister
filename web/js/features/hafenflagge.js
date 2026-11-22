// Hafenname und eigene Flagge im Hafen (P44, F23). Beschreibung: docs/hafenflagge.md.
//
// - Hafenmast beim Hafenmeisterhaus: die eigene Flagge weht im Wind (Richtung und Stärke wie der
//   Windsack der Wetterflagge), darunter ein Schild mit dem Hafennamen (beidseitig lesbar).
// - Willkommensschild an der Einfahrt: "Willkommen in <Name>" mit Flagge, am Ufer neben der Einfahrt,
//   zur See hin und zum Hafen hin lesbar. Fehlt an einer Küste ein freier Platz, fehlt das Schild.
// - Antippen von Mast oder Schild öffnet das Fenster "Name und Flagge" (ui/hafenflagge.js).
//
// Liest game.state.harborName und game.state.flagge, hört auf 'spielstand-name' und 'hafenflagge'.
// Name und Flagge landen nur als Canvas-Bild im 3D-Bild, nie als HTML (Audit C05).
import * as THREE from 'three';
import { FLAGGE_B, FLAGGE_H, flaggeZeichnen, flaggeSauber } from '../data/hafenflagge.js';
import { init as fensterInit } from '../ui/hafenflagge.js';
import { punkt, PLAN_M } from '../render/landschaft/gelaende.js';
import { region as regionNach } from '../render/landschaft/regionen.js';

const TINTE = '#24364a';
const HOLZ = '#9a6b43';
const SCHILD = '#fffaf0';
const SCHRIFT = '"Pixelify Sans", system-ui, sans-serif';

/** Hafenname, wie er gerade gilt (Spielstand, sonst Speicherplatz, sonst leer). */
function nameVon(game) {
  const n = game.state?.harborName || game.spielstand?.platz?.()?.name || '';
  return String(n);
}

/** Größte Schrift, bei der text in breite passt (höchstens max px). */
function passendeSchrift(ctx, text, breite, max, min = 10, gewicht = 600) {
  let px = max;
  for (; px > min; px -= 2) {
    ctx.font = `${gewicht} ${px}px ${SCHRIFT}`;
    if (ctx.measureText(text).width <= breite) break;
  }
  ctx.font = `${gewicht} ${px}px ${SCHRIFT}`;
  return px;
}

/**
 * Bild eines Schilds: links die Flagge, rechts Name (und darüber eine Zeile wie "Willkommen in").
 * Gibt das Canvas zurück; wird bei jeder Änderung neu bemalt.
 */
export function schildMalen(canvas, { name, flagge, zeile = '' }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = TINTE;
  ctx.fillRect(0, 0, w, h);
  const r = Math.round(h / 16);   // Rahmen in "Pixeln"
  ctx.fillStyle = SCHILD;
  ctx.fillRect(r, r, w - 2 * r, h - 2 * r);
  // Flagge links, als Pixelbild
  const fm = Math.max(1, Math.floor((h - 6 * r) / FLAGGE_H));
  const fx = 3 * r, fy = Math.round((h - FLAGGE_H * fm) / 2);
  ctx.fillStyle = TINTE;
  ctx.fillRect(fx - r / 2, fy - r / 2, FLAGGE_B * fm + r, FLAGGE_H * fm + r);
  ctx.fillStyle = SCHILD;
  ctx.fillRect(fx, fy, FLAGGE_B * fm, FLAGGE_H * fm);
  flaggeZeichnen(ctx, flagge, { x: fx, y: fy, massstab: fm });
  // Text rechts daneben
  const tx = fx + FLAGGE_B * fm + 3 * r;
  const tb = w - tx - 3 * r;
  ctx.fillStyle = TINTE;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (zeile) {
    passendeSchrift(ctx, zeile, tb, Math.round(h * 0.2), 8, 500);
    ctx.fillText(zeile, tx, h * 0.32);
    passendeSchrift(ctx, name, tb, Math.round(h * 0.36));
    ctx.fillText(name, tx, h * 0.64);
  } else {
    passendeSchrift(ctx, name, tb, Math.round(h * 0.44));
    ctx.fillText(name, tx, h * 0.52);
  }
  return canvas;
}

export async function init(game) {
  fensterInit(game);   // Fenster "Name und Flagge" und Menüeintrag
  // Antippen von Mast oder Schild öffnet "Name und Flagge" (gleich zu Beginn, nicht erst nach der Platzsuche)
  game.on('tap', ({ pick: p } = {}) => {
    if (p?.type === 'building' && p.id === 'hafenflagge') game.hafenflagge?.oeffnen?.();
  });
  const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const M = { weiss: lambert('#f6f3ec'), gold: lambert('#e9c46a'), holz: lambert(HOLZ), fuss: lambert('#c9c2b4'), tinte: lambert(TINTE) };

  // ------------------------------------------------------------------ Flaggentuch (gemeinsames Bild)
  const tuchCanvas = document.createElement('canvas');
  tuchCanvas.width = FLAGGE_B; tuchCanvas.height = FLAGGE_H;
  const tuchTextur = new THREE.CanvasTexture(tuchCanvas);
  tuchTextur.magFilter = THREE.NearestFilter;
  tuchTextur.minFilter = THREE.NearestFilter;
  tuchTextur.generateMipmaps = false;
  tuchTextur.colorSpace = THREE.SRGBColorSpace;
  const tuchMat = new THREE.MeshLambertMaterial({ map: tuchTextur, side: THREE.DoubleSide, alphaTest: 0.5, transparent: false });

  let flagge = flaggeSauber(game.state?.flagge, game.state?.seed ?? 0);
  function tuchMalen() {
    const ctx = tuchCanvas.getContext('2d');
    ctx.clearRect(0, 0, FLAGGE_B, FLAGGE_H);
    flaggeZeichnen(ctx, flagge);
    tuchTextur.needsUpdate = true;
  }
  tuchMalen();

  const TUCH_B = 3.0, TUCH_H = 2.0, SEG = 12;
  /** Ein Flaggentuch, das am linken Rand (Mast) festhängt. */
  function tuch() {
    const geo = new THREE.PlaneGeometry(TUCH_B, TUCH_H, SEG, 4);
    geo.translate(TUCH_B / 2, 0, 0);
    const m = new THREE.Mesh(geo, tuchMat);
    m.castShadow = true;
    m.userData.basis = Float32Array.from(geo.attributes.position.array);
    return m;
  }
  const tuecher = [];

  // ------------------------------------------------------------------ Hafenmast mit Namensschild
  const mast = new THREE.Group();
  mast.name = 'hafenflagge-mast';
  const pick = { type: 'building', id: 'hafenflagge' };
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 8, 8), M.weiss);
  stange.position.y = 4;
  const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M.gold);
  knauf.position.y = 8.1;
  const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 10), M.fuss);
  fuss.position.y = 0.15;
  const gelenk = new THREE.Group();   // dreht das Tuch in den Wind
  gelenk.position.y = 7.85 - TUCH_H / 2;
  const mastTuch = tuch();
  gelenk.add(mastTuch);
  tuecher.push(mastTuch);
  mast.add(stange, knauf, fuss, gelenk);

  // Namensschild am Fuß des Masts (beidseitig)
  function schildObjekt(breite, hoehe, pfostenHoehe, zeile) {
    const g = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = Math.round(512 * hoehe / breite);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const vorn = new THREE.MeshLambertMaterial({ map: tex });
    const brett = new THREE.Mesh(new THREE.BoxGeometry(breite, hoehe, 0.12), [M.tinte, M.tinte, M.tinte, M.tinte, vorn, vorn]);
    brett.position.y = pfostenHoehe + hoehe / 2;
    brett.castShadow = true;
    // Box-UVs: beide großen Seiten lesen sich von außen richtig, also beidseitig dasselbe Bild
    g.add(brett);
    for (const dx of [-breite / 2 + 0.25, breite / 2 - 0.25]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, pfostenHoehe + hoehe * 0.9, 0.18), M.holz);
      p.position.set(dx, (pfostenHoehe + hoehe * 0.9) / 2, -0.12);
      p.castShadow = true;
      g.add(p);
    }
    const malen = () => {
      schildMalen(canvas, { name: nameVon(game) || 'Mein Hafen', flagge, zeile });
      tex.needsUpdate = true;
    };
    return { g, malen };
  }
  const namensSchild = schildObjekt(4.4, 1.1, 0.6, '');
  namensSchild.g.position.set(0, 0, 0.9);
  mast.add(namensSchild.g);
  mast.traverse((o) => { o.userData.pick = pick; });
  mast.visible = false;   // erst sichtbar, wenn die Platzsuche einen Platz gefunden hat

  // ------------------------------------------------------------------ Willkommensschild an der Einfahrt
  const einfahrt = new THREE.Group();
  einfahrt.name = 'hafenflagge-einfahrt';
  const willkommen = schildObjekt(6.4, 1.8, 1.1, 'Willkommen in');
  einfahrt.add(willkommen.g);
  // Kleiner Mast mit Flagge daneben
  const kleinMast = new THREE.Group();
  const ks = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), M.weiss);
  ks.position.y = 3;
  const kk = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.gold);
  kk.position.y = 6.05;
  const kGelenk = new THREE.Group();
  kGelenk.position.y = 5.85 - TUCH_H / 2;
  const kTuch = tuch();
  kGelenk.add(kTuch);
  tuecher.push(kTuch);
  kleinMast.add(ks, kk, kGelenk);
  kleinMast.position.set(3.9, 0, 0);
  einfahrt.add(kleinMast);
  einfahrt.traverse((o) => { o.userData.pick = pick; });
  einfahrt.visible = false;
  game.scene.add(einfahrt);

  // Platz an der Einfahrt: Land knapp am Ufer neben dem letzten Stück der Seezugänge (dort, wo die Boote
  // in den Hafen fahren), eben, nicht auf Wegen oder Kaiflächen. Ohne Seezugänge: neben dem Engpass.
  function einfahrtLage() {
    const L = game.landschaft ?? game.landscape;
    if (!L || typeof L.hoeheBei !== 'function') return null;
    const stufe = game.state?.stage ?? 1;
    const pegel = L.pegel ?? 0;
    const wege = [];
    for (const w of L.wege ?? []) for (let i = 1; i < w.punkte.length; i++) wege.push([w.punkte[i - 1], w.punkte[i], (w.breite || 2) / 2 + 2.5]);
    const abstand = (x, z, a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    };
    // Laufnetz der Menschen (Stege, Molenwege, Anschlüsse; people/netz.js) frei halten
    const U = 0.62;
    try {
      for (const [ax, ay, bx, by] of game.people?.netz?.strecken?.() ?? []) wege.push([{ x: ax * U, z: -ay * U }, { x: bx * U, z: -by * U }, 3.5]);
    } catch { /* ohne Laufnetz */ }
    const nahWeg = (x, z) => wege.some(([a, b, r]) => abstand(x, z, a, b) < r);
    // Kai- und Bauflächen (Polygone in Weltmetern) bleiben frei
    const flaechen = (L.punkte?.bauflaechen ?? []).map((f) => f.poly);
    const inFlaeche = (x, z) => flaechen.some((poly) => {
      let drin = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z || 1e-9) + a.x) drin = !drin;
      }
      return drin;
    });
    const eben = (x, z) => {
      const h0 = L.hoeheBei(x, z);
      if (!Number.isFinite(h0) || h0 < pegel + 0.4 || h0 > pegel + 16) return false;
      for (const [dx, dz] of [[3.4, 0], [-3.4, 0], [4.6, 0], [0, 1.5], [0, -1.5]]) {
        const h = L.hoeheBei(x + dx, z + dz);
        if (!Number.isFinite(h) || h < pegel + 0.25 || Math.abs(h - h0) > 1.1) return false;
      }
      return true;
    };
    // Wasser in höchstens 14 m Entfernung, damit das Schild wirklich am Ufer der Einfahrt steht
    const wasserNah = (x, z) => {
      for (const r of [5, 9, 14, 20]) {
        for (let k = 0; k < 8; k++) {
          const w = (k / 8) * Math.PI * 2;
          if (L.hoeheBei(x + Math.cos(w) * r, z + Math.sin(w) * r) < pegel) return true;
        }
      }
      return false;
    };
    // Nicht im Wald (dort stehen dichte Bäume und verdecken das Schild)
    let reg = null;
    try { const r = L.region; reg = regionNach(typeof r === 'string' ? r : r?.id ?? 'ostsee'); } catch { reg = null; }
    const imWald = (x, z) => {
      if (!reg) return false;
      for (const [dx, dz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) {
        try { if (punkt((x + dx) / PLAN_M, -(z + dz) / PLAN_M, stufe, reg).typ === 'waldboden') return true; } catch { return false; }
      }
      return false;
    };
    const gut = (x, z) => !imWald(x, z) && eben(x, z) && !nahWeg(x, z) && !inFlaeche(x, z) && wasserNah(x, z)
      && L.hoeheBei(x, z) > pegel + 0.4;
    // Punkte entlang der Seezugänge: wo der Weg dem Land am nächsten kommt (Seegatt, Molen, Engstelle),
    // ist die Einfahrt; bei gleichem Abstand gewinnt der Punkt näher am Hafen
    let zug = [];
    try { zug = (game.gelaende?.seezugaenge?.(stufe, { tiefeM: 2 }) ?? []).filter((z) => !z.umweg && z.weg?.length >= 2); } catch { zug = []; }
    const proben = [];
    const gesehen = new Set();
    // Abstand zum Land grob aus der Höhe (8 Richtungen, 8 bis 96 m); das Raster der Karte reicht nicht
    // überall bis an die Einfahrt (Bodden, Förde)
    const landNah = (x, z) => {
      for (let r = 8; r <= 96; r += 8) {
        for (let k = 0; k < 8; k++) {
          const w = (k / 8) * Math.PI * 2;
          if (L.hoeheBei(x + Math.cos(w) * r, z + Math.sin(w) * r) > pegel + 0.5) return r;
        }
      }
      return Infinity;
    };
    // Nur innerhalb des Bereichs, den die Kamera zeigen kann
    let rect = null;
    try { rect = game.gelaende?.spielRect?.() ?? null; } catch { rect = null; }
    const imBild = (x, z) => !rect || (x > rect.minX + 10 && x < rect.maxX - 10 && z > rect.minZ + 10 && z < rect.maxZ - 10);
    for (const z of zug.slice(0, 12)) {
      const w = z.weg;
      let d = 0;
      for (let i = w.length - 1; i > 0 && d < 1400; i--) {
        const a = w[i], b = w[i - 1];
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        for (let s = 0; s < l; s += 12) {
          const x = a.x + ((b.x - a.x) * s) / l, zz = a.z + ((b.z - a.z) * s) / l;
          const key = `${Math.round(x / 12)},${Math.round(zz / 12)}`;
          if (gesehen.has(key) || !imBild(x, zz)) continue;
          gesehen.add(key);
          const r = landNah(x, zz);
          if (Number.isFinite(r)) proben.push({ x, z: zz, land: r, wert: r + (d + s) * 0.05 });
        }
        d += l;
      }
    }
    if (!proben.length && L.punkte?.engpass) {
      const e = L.punkte.engpass;
      proben.push({ x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, land: 30, wert: 0 });
    }
    proben.sort((p, q) => p.wert - q.wert);
    // Mit Molen (ab Stufe 3) ist die Einfahrt zwischen den Molenköpfen: dort zuerst suchen
    const koepfe = (L.punkte?.molenkoepfe ?? []).filter((k) => Number.isFinite(k?.x) && Number.isFinite(k?.z));
    if (koepfe.length) proben.unshift(...koepfe.map((k) => ({ x: k.x, z: k.z, land: 30, wert: -1 })));
    let best = null;
    for (const p of proben.slice(0, 30 + koepfe.length)) {
      // Ringe vom ersten Land bis knapp dahinter (land: grober Abstand zum Land aus landNah)
      for (let r = Math.max(6, p.land - 10); r <= p.land + 22 && !best; r += 3) {
        const n = Math.ceil(r * 0.8);
        for (let k = 0; k < n; k++) {
          const w = (k / n) * Math.PI * 2;
          const x = p.x + Math.cos(w) * r, z = p.z + Math.sin(w) * r;
          if (gut(x, z)) { best = { x, z }; break; }
        }
      }
      if (best) break;
    }
    // Rückfall (weite Einfahrt ohne Engstelle, z. B. Watt): nächstes passendes Land am Ende der Seezugänge
    const enden = zug.map((z) => z.weg[z.weg.length - 1]).slice(0, 3);
    for (const p of best ? [] : enden) {
      for (let r = 6; r <= 160 && !best; r += 4) {
        const n = Math.ceil(r * 0.5);
        for (let k = 0; k < n; k++) {
          const w = (k / n) * Math.PI * 2;
          const x = p.x + Math.cos(w) * r, z = p.z + Math.sin(w) * r;
          if (imBild(x, z) && gut(x, z)) { best = { x, z }; break; }
        }
      }
      if (best) break;
    }
    if (!best) return null;
    // Schild zeigt zum Spieler (Blick von Süden), beidseitig bemalt: auch einlaufende Boote lesen es
    return { x: best.x, z: best.z, y: L.hoeheBei(best.x, best.z), dreh: 0 };
  }
  function einfahrtStellen() {
    let l = null;
    try { l = einfahrtLage(); } catch { l = null; }
    einfahrt.visible = !!l;
    if (!l) return;
    einfahrt.position.set(l.x, l.y, l.z);
    einfahrt.rotation.y = l.dreh;
  }

  game.hafenflaggeBild = { mast, einfahrt, neuMalen: () => allesMalen(), sucheEinfahrt: () => einfahrtLage(), einfahrtLage: () => (einfahrt.visible ? { x: einfahrt.position.x, z: einfahrt.position.z } : null) };

  // ------------------------------------------------------------------ Mast über die Deko-Platzsuche
  // Wartet auf ziel-deko (wird von features/tagesziele.js geladen), sonst neben dem Wetterflaggenmast.
  const start = Date.now();
  while (!game.zielDeko?.zusatz && Date.now() - start < 15000) await new Promise((r) => setTimeout(r, 100));
  if (game.zielDeko?.zusatz) {
    game.zielDeko.zusatz('hafenflagge', { lage: { x: -10.5, z: 3, dreh: 0 }, radius: 2.0, objekt: mast, da: () => true });
  } else {
    const w = game.wetterflagge?.mast;
    if (w) { mast.position.set(w.position.x + 10, w.position.y, w.position.z); mast.visible = true; }
    game.scene.add(mast);
  }

  // ------------------------------------------------------------------ Bemalen und Wind
  function allesMalen() {
    flagge = flaggeSauber(game.state?.flagge, game.state?.seed ?? 0);
    tuchMalen();
    namensSchild.malen();
    willkommen.malen();
  }
  // Schrift erst malen, wenn Pixelify Sans geladen ist (sonst steht der Name in der Ersatzschrift)
  try { await document.fonts?.load?.(`600 32px ${SCHRIFT}`); } catch { /* egal */ }
  allesMalen();
  einfahrtStellen();

  let t = 0;
  let dreh = Math.PI;
  game.onTick((dt) => {
    dt = dt || 0.016;
    t += dt;
    const z = game.wetterflagge?.zeichen?.() ?? { wind: 0.3, richtung: 180 };
    const w = Math.max(0.15, Math.min(1, z.wind ?? 0.3));
    const ziel = ((z.richtung ?? 180) * Math.PI) / 180 + Math.PI;
    const d = ((ziel - dreh + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    dreh += d * Math.min(1, dt * 1.2);
    // Das Tuch zeigt in Lee; der Mast ist in der Gruppe gedreht, darum seine Drehung abziehen
    const ruhig = document.body.classList.contains('hm-ruhig');
    for (const tu of tuecher) {
      const halter = tu.parent;
      const welt = halter.parent?.parent ? weltDrehung(halter.parent) : 0;
      halter.rotation.y = dreh - welt;
      const pos = tu.geometry.attributes.position;
      const basis = tu.userData.basis;
      const amp = ruhig ? 0.05 : 0.12 + w * 0.22;
      const tempo = ruhig ? 1.5 : 3 + w * 6;
      for (let i = 0; i < pos.count; i++) {
        const x = basis[i * 3], y = basis[i * 3 + 1];
        const k = x / TUCH_B;
        pos.array[i * 3 + 2] = Math.sin(x * 2.2 - t * tempo + y * 0.4) * amp * k;
        // bei wenig Wind hängt das Tuch etwas
        pos.array[i * 3 + 1] = y - (1 - w) * 0.55 * k * k;
      }
      pos.needsUpdate = true;
    }
  });
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  function weltDrehung(o) {
    o.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return _e.y;
  }

  game.on('spielstand-name', allesMalen);
  game.on('hafenflagge', allesMalen);
  game.on('spielstand-geladen', () => { allesMalen(); einfahrtStellen(); });
  game.on('sim:change', (e) => { if (e?.reason === 'load') allesMalen(); });
  game.on('ready', () => { allesMalen(); einfahrtStellen(); });
  game.on('stufe', () => setTimeout(einfahrtStellen, 80));
  (game.landschaft ?? game.landscape)?.beiNeubau?.(() => setTimeout(einfahrtStellen, 80));


}
