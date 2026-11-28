// Havarist im Bild (Paket P37, docs/havarie.md): das Boot treibt mit Schaden vor der Einfahrt, ein Helfer
// fährt hin, nimmt es an die Schleppleine und bringt es vor seine Box; die letzten Meter verholt die Crew
// das Boot selbst hinein. Danach übernimmt die normale Bootsansicht (render/boat-view.js) das Boot.
//
// Helfer: Fischer (Stufe 2 und 3) und Arbeitsboot (ab 4) kommen von See und fahren danach wieder hinaus.
// Mit Seenotretter-Station fährt deren Rettungsboot (eine Kopie, das Boot an der Station ist solange aus)
// und kehrt zur Station zurück. Lehnt der Spieler ab oder läuft die Frist ab, kommt ein fremder Helfer von
// See und schleppt den Havaristen hinaus.
//
// Liest nur game.havarie.heute() (features/havarie.js) und schreibt in den Spielstand nur den Ort, an dem
// das Boot treibt (heute.ort), damit es nach dem Laden wieder dort liegt. Alle Zeiten in Spielzeit.
import * as THREE from 'three';
import { addBoat, berthFromPlatz } from './boat-anim.js';
import { HAFEN } from '../data/harbor.js';
import { HELFER } from '../features/havarie.js';
import { PIXEL } from '../ui/pixel-symbole.js';

const LEINE_M = 9;            // Länge der Schleppleine zwischen Heck des Helfers und Bug des Havaristen
const DRIFT_MAX_M = 18;       // so weit treibt er höchstens von seinem Ort weg
const TEMPO = { anfahrt: 6.5, schlepp: 4, seenot: 1.25, verholen: 1.3 };  // m/s, Seenotretter schleppen schneller (Faktor)

export function initHavarieBild(game) {
  if (!game.scene || !game.boatAnim) return;
  game.havarieBild = true;
  const stufe = () => game.state?.stage ?? 1;

  let hav = null;      // { id, anim, info, ort, geschleppt, festAuftrag }
  let helfer = null;   // { anim, art, token, statisch, ziel }
  const uhren = [];    // { bis, res } für warte()
  const warte = (s) => new Promise((res) => uhren.push({ bis: (game.time ?? 0) + s, res }));

  // ---------------------------------------------------------------- Boote bauen
  function bauModell(groesse, modell, palette, id) {
    const types = game.boatTypes?.[String(groesse).toLowerCase()];
    if (types?.buildBoat) {
      const entry = types.MODELS?.find?.((m) => m.id === modell) ?? modell;
      try {
        const g = types.buildBoat(entry, { palette, id, sails: false });
        if (g) return { group: g, types };
      } catch (e) { console.warn('Havarie: Modell nicht baubar', modell, e); }
    }
    const L = { s: 5, m: 8, l: 12 }[String(groesse).toLowerCase()] ?? 8;
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, L * 0.12, L * 0.33), new THREE.MeshLambertMaterial({ color: '#fffcf6' }));
    m.position.y = L * 0.04;
    g.add(m);
    g.userData.boat = { size: String(groesse).toUpperCase(), length: L, beam: L * 0.33, draft: L * 0.1, kind: 'motor' };
    return { group: g, types: null };
  }
  const stumm = (a) => { a.emit = () => {}; return a; };

  // ---------------------------------------------------------------- Notzeichen über dem Boot
  // Rotes Pixel-Ausrufezeichen auf Papier mit Tintenrand (wie die Pixel-Symbole), feste Größe am Bildschirm
  const zeichen = (() => {
    const px = 4, n = 14;
    const cv = document.createElement('canvas');
    cv.width = n * px; cv.height = n * px;
    const c = cv.getContext('2d');
    const muster = PIXEL.warnung;
    c.fillStyle = '#24364a'; c.fillRect(0, 0, n * px, n * px);
    c.fillStyle = '#fffcf6'; c.fillRect(px, px, (n - 2) * px, (n - 2) * px);
    c.fillStyle = '#ee6454';
    muster.forEach((zeile, y) => [...zeile].forEach((ch, x) => { if (ch === '#') c.fillRect((x + 1) * px, (y + 1) * px, px, px); }));
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.center.set(0.5, 0);
    sp.renderOrder = 6;
    sp.visible = false;
    sp.name = 'havarie-zeichen';
    sp.userData.pick = { type: 'havarie', id: 'havarist' };
    game.scene.add(sp);
    return sp;
  })();
  function zeichenGroesse() {
    const cam = game.camera?.camera;
    let h = (window.innerWidth < 700 ? 0.05 : 0.04);
    if (cam?.isOrthographicCamera) h *= (cam.top - cam.bottom) / (cam.zoom || 1);
    else if (cam) h *= 2 / (cam.projectionMatrix.elements[5] || 1);
    zeichen.scale.set(h, h, 1);
  }

  // ---------------------------------------------------------------- Schleppleine
  const SEG = 10;
  const leineGeo = new THREE.BufferGeometry();
  leineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
  const leine = new THREE.Line(leineGeo, new THREE.LineBasicMaterial({ color: '#f1e7d0' }));
  leine.frustumCulled = false;
  leine.visible = false;
  leine.name = 'havarie-schleppleine';
  game.scene.add(leine);
  function leineZeichnen() {
    if (!leine.visible || !hav || !helfer) return;
    const a = helfer.anim, b = hav.anim;
    const ax = a.x - Math.cos(a.heading) * a.info.length * 0.45, az = a.z + Math.sin(a.heading) * a.info.length * 0.45;
    const bx = b.x + Math.cos(b.heading) * b.info.length * 0.46, bz = b.z - Math.sin(b.heading) * b.info.length * 0.46;
    const d = Math.hypot(ax - bx, az - bz);
    const durch = Math.max(0, (LEINE_M + 1 - d) * 0.25) + 0.15;   // straff im Schlepp, lose beim Übergeben
    const pos = leineGeo.attributes.position.array;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      pos[i * 3] = ax + (bx - ax) * t;
      pos[i * 3 + 1] = 0.9 - Math.sin(Math.PI * t) * durch + (1 - t) * 0.3;
      pos[i * 3 + 2] = az + (bz - az) * t;
    }
    leineGeo.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------- Liegeplatz der Box
  function platzBerth(platzId) {
    const p = HAFEN.plaetze.find((q) => q.id === platzId);
    if (!p) return null;
    let b;
    try { b = berthFromPlatz(p, stufe(), HAFEN); } catch { return null; }
    const sp = game.stege?.platz?.(platzId);
    if (sp) {
      b.x = sp.x; b.z = sp.z;
      if (sp.richtung !== undefined) b.heading = (sp.richtung * Math.PI) / 180;
      if (sp.laenge) b.length = sp.laenge;
      if (sp.breite) b.width = sp.breite;
    }
    const bauart = p.art === 'kai' ? 'kai' : p.steg === 'D' ? 'schwimmsteg' : 'holz';
    const deck = game.stege?.deckHoehe?.(bauart);
    if (deck) b.deck = deck + 0.1;
    return b;
  }

  // ---------------------------------------------------------------- Ort vor der Einfahrt
  const frei = (x, z, r, t) => {
    const f = game.fahrwasser?.befahrbar;
    return typeof f === 'function' ? f(x, z, r, t) : true;
  };
  function abstandZuStrecke(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  }
  let einfahrt = null;      // Punkt vor der Einfahrt (Ende der Seezugänge)
  let seeRichtung = null;   // Richtung von der Einfahrt zur See (aus den Seezugängen, suchOrt)
  /** Freies Wasser vor der Einfahrt: neben dem Fahrwasser, weg von Bojen und Ankerfeld, in der Fahrwasserkarte. */
  function suchOrt(info) {
    const k = game.fahrwasser?.karte;
    let zug = [];
    try { zug = (game.gelaende?.seezugaenge?.(stufe(), { tiefeM: 2 }) ?? []).filter((z) => !z.umweg && z.weg?.length >= 2); } catch { zug = []; }
    const w = game.landscape?.warteplaetze ?? {};
    const kreise = [...(w.bojen ?? []).map((o) => ({ x: o.x, z: o.z, r: 28 })), ...(w.ankerbereiche ?? []).map((o) => ({ x: o.x, z: o.z, r: (o.radiusM ?? 30) + 16 }))];
    const wege = zug.map((z) => z.weg);
    // Ende des Wegs und die Richtung zur See: Mittel der Richtungen aller Zugänge zu diesem Ende (zum Anfang
    // des Wegs). Ein einzelner Zugang von der Seite zeigt sonst am Ufer entlang, der Havarist läge in der Einfahrt.
    const proEnde = new Map();
    for (const z of zug) {
      const e = z.weg[z.weg.length - 1], s0 = z.weg[0];
      const l = Math.hypot(s0.x - e.x, s0.z - e.z) || 1;
      const k = `${Math.round(e.x)},${Math.round(e.z)}`;
      const m = proEnde.get(k) ?? { x: e.x, z: e.z, sx: 0, sz: 0 };
      m.sx += (s0.x - e.x) / l; m.sz += (s0.z - e.z) / l;
      proEnde.set(k, m);
    }
    const enden = [...proEnde.values()].map((m) => { const l = Math.hypot(m.sx, m.sz) || 1; return { ...m, sx: m.sx / l, sz: m.sz / l }; });
    seeRichtung = enden[0] ? { x: enden[0].sx, z: enden[0].sz } : null;
    einfahrt = enden[0] ? { x: enden[0].x, z: enden[0].z } : null;
    if (!enden.length && w.bojen?.length) enden.push({ x: w.bojen[0].x, z: w.bojen[0].z, sx: 0, sz: 0 });
    if (!enden.length) return null;
    const r = info.length / 2 + 6, t = (info.draft ?? 1) + 0.5;
    let best = null, bestWert = Infinity;
    // Erst streng (deutlich seewärts, weit vom Weg der Ankommenden), dann schrittweise lockerer
    for (const [kegel, abstand] of [[0.6, 14], [0.3, 10], [0, 8]]) {
      for (const e of enden) {
        for (const ring of [50, 65, 80, 95, 115]) {
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const p = { x: e.x + Math.cos(a) * ring, z: e.z + Math.sin(a) * ring };
            if ((e.sx || e.sz) && Math.cos(a) * e.sx + Math.sin(a) * e.sz < kegel) continue;
            if (k && !(p.x > k.x0 + 30 && p.x < k.x1 - 30 && p.z > k.z0 + 30 && p.z < k.z1 - 30)) continue;
            if (!frei(p.x, p.z, r, t)) continue;
            if (kreise.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r)) continue;
            let nah = Infinity;
            for (const weg of wege) for (let j = 1; j < weg.length; j++) nah = Math.min(nah, abstandZuStrecke(p, weg[j - 1], weg[j]));
            if (nah < abstand) continue;
            // gern im Bild, nicht zu weit draussen, nicht zu nah am Weg der Ankommenden
            const wert = Math.abs(ring - 70) + (game.boatAnim.imBild?.(p.x, p.z, info.length) ? 0 : 25) + Math.max(0, 30 - nah);
            if (wert < bestWert) { bestWert = wert; best = p; }
          }
        }
      }
      if (best) break;
    }
    return best;
  }

  // ---------------------------------------------------------------- Havarist zeigen, treiben, entfernen
  function zeigeHavarist(h) {
    const b = h.boot;
    const { group, types } = bauModell(b.size, b.modelId, b.id % 4, b.id);
    group.userData.pick = { type: 'havarie', id: 'havarist' };
    group.userData.bootName = b.bootsname;
    const anim = stumm(addBoat(game, group, { id: `havarie-${b.id}`, animate: types?.animateBoat, setSails: types?.setSails, sails: false }));
    let ort = h.ort;
    if (!ort || !frei(ort.x, ort.z, anim.info.length / 2 + 2, (anim.info.draft ?? 1) + 0.3)) {
      const p = suchOrt(anim.info);
      ort = p ? { x: p.x, z: p.z, h: (game.boatAnim.wind?.fromDeg ?? 250) * Math.PI / 180 + Math.PI / 2 } : null;
    }
    if (!ort) {
      const p = game.fahrwasser?.randPunkt?.(anim.info);
      ort = p ? { x: p.x, z: p.z, h: 0 } : { x: 0, z: -150, h: 0 };
    }
    h.ort = { x: Math.round(ort.x * 10) / 10, z: Math.round(ort.z * 10) / 10, h: Math.round((ort.h ?? 0) * 100) / 100 };
    anim.place(h.ort.x, h.ort.z, h.ort.h);
    hav = { id: b.id, anim, info: anim.info, ort: { ...h.ort }, geschleppt: false, festAuftrag: false };
    zeichen.visible = true;
    game.emit('havarie:im-bild', { id: b.id, x: h.ort.x, z: h.ort.z });
  }
  function entferneHavarist() {
    if (!hav) return;
    hav.anim.remove();
    hav = null;
    zeichen.visible = false;
    leine.visible = false;
  }
  function treiben(dt) {
    if (!hav || hav.geschleppt || hav.festAuftrag || hav.anim.task || hav.anim.tasks.length) return;
    const w = game.boatAnim.wind ?? { fromDeg: 250, strength: 0.5 };
    const von = (w.fromDeg * Math.PI) / 180;
    const v = (0.06 + 0.14 * (w.strength ?? 0.5)) * dt;
    const nx = hav.anim.x - Math.cos(von) * v, nz = hav.anim.z + Math.sin(von) * v;
    const r = hav.info.length / 2 + 2;
    if (Math.hypot(nx - hav.ort.x, nz - hav.ort.z) < DRIFT_MAX_M && frei(nx, nz, r, (hav.info.draft ?? 1) + 0.3)) { hav.anim.x = nx; hav.anim.z = nz; }
    // quer zum Wind treiben, langsam einschwingen
    const soll = von + Math.PI / 2;
    let d = soll - hav.anim.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > Math.PI / 2) d = Math.atan2(Math.sin(d + Math.PI), Math.cos(d + Math.PI));
    hav.anim.heading += d * Math.min(1, dt * 0.08);
  }
  // Im Schlepp folgt er dem Heck des Helfers an der Leine (wie ein Anhänger)
  function folgen() {
    if (!hav?.geschleppt || !helfer) return;
    const a = helfer.anim, b = hav.anim;
    const sx = a.x - Math.cos(a.heading) * a.info.length * 0.45, sz = a.z + Math.sin(a.heading) * a.info.length * 0.45;
    const bugX = b.x + Math.cos(b.heading) * b.info.length * 0.46, bugZ = b.z - Math.sin(b.heading) * b.info.length * 0.46;
    const dx = sx - bugX, dz = sz - bugZ, d = Math.hypot(dx, dz);
    if (d <= LEINE_M) { b.speed = Math.max(0, b.speed * 0.98); abstandHalten(a, b); return; }
    const ux = dx / d, uz = dz / d;
    const zug = d - LEINE_M;
    b.x += ux * zug; b.z += uz * zug;
    // Bug zeigt zur Leine
    const soll = Math.atan2(-uz, ux);
    let dh = soll - b.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    b.heading += dh * 0.12;
    b.speed = a.speed;
    abstandHalten(a, b);
  }
  // Schlepper und Havarist stoßen nicht zusammen (sie sind für die Verkehrsregeln ein Paar): dreht der
  // Schlepper zurück am Havaristen vorbei, weicht der Havarist seitlich aus, statt durch ihn hindurch zu treiben.
  function abstandHalten(a, b) {
    const min = (a.info.length + b.info.length) * 0.4 + 1.5;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= min || d < 1e-3) return;
    b.x += (dx / d) * (min - d);
    b.z += (dz / d) * (min - d);
  }

  // ---------------------------------------------------------------- Helfer
  function seenotKopie() {
    const boot = game.services?.seenotBoot?.();
    if (!boot) return null;
    boot.updateMatrixWorld(true);
    const pos = boot.getWorldPosition(new THREE.Vector3());
    const q = boot.getWorldQuaternion(new THREE.Quaternion());
    const h = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    const kopie = boot.clone(true);
    kopie.position.set(0, 0, 0);
    kopie.rotation.set(0, 0, 0);
    const g = new THREE.Group();
    g.add(kopie);
    const box = new THREE.Box3().setFromObject(kopie);
    const L = box.max.x - box.min.x, B = box.max.z - box.min.z;
    g.userData.boat = { size: L > 14 ? 'XL' : 'L', length: L, beam: B, draft: L > 14 ? 1.8 : 1.1, kind: 'motor' };
    return { group: g, start: { x: pos.x, z: pos.z, h }, statisch: boot };
  }
  /** Startpunkt für einen Helfer von See: freies Wasser in 80 bis 120 m Abstand, lieber ausserhalb des Bildes. */
  function startVonSee(info, nahe, seewaerts = true) {
    if (seewaerts && !seeRichtung) suchOrt({ length: 6, beam: 2.5, draft: 1 });   // füllt seeRichtung (nach dem Laden)
    let best = null, bestWert = Infinity;
    const r = info.length / 2 + 3, t = (info.draft ?? 1) + 0.4;
    for (const ring of [120, 100, 80]) {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const p = { x: nahe.x + Math.cos(a) * ring, z: nahe.z + Math.sin(a) * ring };
        // nur seewärts: ein Helfer von See kommt nie aus dem Hafenbecken
        if (seewaerts && seeRichtung && Math.cos(a) * seeRichtung.x + Math.sin(a) * seeRichtung.z < 0.4) continue;
        if (!frei(p.x, p.z, r, t)) continue;
        const wert = (game.boatAnim.imBild?.(p.x, p.z, info.length + 6) ? 200 : 0) + ring * 0.3;
        if (wert < bestWert) { bestWert = wert; best = p; }
      }
    }
    if (!best && seewaerts) return startVonSee(info, nahe, false);
    return best ?? game.fahrwasser?.randPunkt?.(info) ?? null;
  }
  function bauHelfer(art, nahe) {
    if (art === 'seenotretter') {
      const k = seenotKopie();
      if (k) {
        const anim = stumm(addBoat(game, k.group, { id: 'havarie-helfer', cfg: { cruise: 4, harbor: 2 } }));
        anim.place(k.start.x, k.start.z, k.start.h);
        k.statisch.visible = false;
        return { anim, art, statisch: k.statisch, heim: k.start };
      }
      art = stufe() <= 3 ? 'fischer' : 'arbeitsboot';
    }
    const def = HELFER[art] ?? HELFER.arbeitsboot;
    const { group, types } = bauModell(def.klasse ?? 'l', def.modell, art === 'fischer' ? 1 : 0, 9000 + (hav?.id ?? 0));
    const anim = stumm(addBoat(game, group, { id: 'havarie-helfer', animate: types?.animateBoat, sails: false, cfg: { cruise: 3.6 } }));
    const start = startVonSee(anim.info, nahe) ?? nahe;
    anim.place(start.x, start.z, Math.atan2(-(nahe.z - start.z), nahe.x - start.x));
    return { anim, art, statisch: null, heim: null };
  }
  function entferneHelfer() {
    if (!helfer) return;
    helfer.anim.remove();
    if (helfer.statisch) helfer.statisch.visible = true;
    helfer = null;
    leine.visible = false;
  }
  /** Helfer fährt heim: Seenotretter zur Station, alle anderen hinaus auf See (dort verschwinden sie). */
  async function heimfahren(h, token) {
    if (!h || h.token !== token) return;
    const a = h.anim;
    a.angehaengtAn = null;
    if (h.heim) {
      await a.sailTo([{ x: h.heim.x, z: h.heim.z }], { route: true });
      if (helfer === h) entferneHelfer();
      return;
    }
    const raus = startVonSee(a.info, { x: a.x, z: a.z });
    if (raus) await a.sailTo([raus], { route: true });
    if (helfer === h) entferneHelfer();
  }

  // ---------------------------------------------------------------- Einsatz
  // rein: Havarist in die Box (platz) bringen. raus: fremder Helfer schleppt ihn hinaus auf See.
  async function einsatz(art, platz, raus = false) {
    if (!hav) return;
    const token = {};
    helfer = { ...bauHelfer(art, { x: hav.anim.x, z: hav.anim.z }), token };
    const h = helfer;
    const lebt = () => helfer === h && helfer.token === token && hav;
    const a = h.anim;
    // 1. Hin zum Bug des Havaristen (falls dort kein Wasser ist, ans Heck)
    const b = hav.anim;
    const abst = b.info.length / 2 + a.info.length / 2 + 5;
    // Die Seite, die zum Ziel zeigt (Einfahrt, beim Hinausschleppen die See): der Schlepper muss nicht am Havaristen vorbei
    const bug = { x: b.x + Math.cos(b.heading) * abst, z: b.z - Math.sin(b.heading) * abst };
    const heck = { x: b.x - Math.cos(b.heading) * abst, z: b.z + Math.sin(b.heading) * abst };
    const ziel = raus && seeRichtung ? { x: b.x + seeRichtung.x * 100, z: b.z + seeRichtung.z * 100 } : einfahrt;
    let [p, q] = ziel && Math.hypot(heck.x - ziel.x, heck.z - ziel.z) < Math.hypot(bug.x - ziel.x, bug.z - ziel.z) ? [heck, bug] : [bug, heck];
    if (!frei(p.x, p.z, a.info.beam / 2 + 1, (a.info.draft ?? 1) + 0.3)) p = q;
    await a.sailTo([p], { route: true, speed: TEMPO.anfahrt });
    if (!lebt()) return;
    // 2. Leine über, kurz warten
    leine.visible = true;
    a.angehaengtAn = hav.anim;
    hav.anim.angehaengtAn = a;
    game.emit('havarie:leine', { id: hav.id });
    await warte(2.5);
    if (!lebt()) return;
    hav.geschleppt = true;
    const tempo = TEMPO.schlepp * (h.art === 'seenotretter' ? TEMPO.seenot : 1);
    if (raus) {
      const ziel = startVonSee(a.info, { x: a.x, z: a.z });
      if (ziel) await a.sailTo([ziel], { route: true, speed: tempo });
      if (!lebt()) return;
      entferneHavarist();
      entferneHelfer();
      return;
    }
    // 3. Schlepp bis vor die Box
    const berth = platzBerth(platz);
    if (!berth) return;
    const anlauf = hav.anim.approachPoints(berth);
    const vor = anlauf?.[0] ?? { x: berth.x, z: berth.z };
    await a.sailTo([vor], { route: true, speed: tempo });
    if (!lebt()) return;
    // 4. Leine los, Helfer fährt weiter, die Crew verholt das Boot in die Box
    hav.geschleppt = false;
    hav.anim.angehaengtAn = null;
    a.angehaengtAn = null;
    leine.visible = false;
    game.emit('havarie:leine-los', { id: hav.id });
    heimfahren(h, token);
    hav.festAuftrag = true;
    const id = hav.id;
    const ok = await hav.anim.dock(berth, { route: true, speed: TEMPO.verholen });
    if (!ok || !hav || hav.id !== id) return;
    festmachen(platz);
  }
  function festmachen(platz) {
    const id = hav?.id;
    const r = game.havarie.festmachen();
    entferneHavarist();
    if (r?.ok) {
      const ev = r.events.find((e) => e.type === 'havarie' && e.phase === 'fest');
      game.emit('boat:moored', { id, berth: ev?.berthId ?? platz });
    }
  }

  // ---------------------------------------------------------------- Abgleich mit den Regeln
  let laeuft = null;   // Phase, für die gerade ein Einsatz läuft ('zugewiesen' | 'weg')
  function abgleich() {
    const h = game.havarie?.heute?.();
    const phase = h?.phase ?? null;
    if (!h || phase === 'geplant') {
      if (hav && !helfer) entferneHavarist();
      laeuft = null;
      return;
    }
    if (hav && hav.id !== h.boot.id) { entferneHavarist(); entferneHelfer(); laeuft = null; }
    if (phase === 'treibt') {
      if (!hav) zeigeHavarist(h);
      if (laeuft === 'zugewiesen' && helfer) {
        // Box weg (Stufenausbau): Einsatz abbrechen, Helfer fährt heim, der Havarist treibt wieder
        const alt = helfer;
        hav.geschleppt = false; hav.festAuftrag = false; hav.anim.angehaengtAn = null; hav.anim.cancel();
        leine.visible = false;
        heimfahren(alt, alt.token);
      }
      laeuft = null;
      return;
    }
    if (phase === 'zugewiesen') {
      if (!hav) zeigeHavarist(h);
      if (laeuft !== 'zugewiesen') { laeuft = 'zugewiesen'; einsatz(h.helfer, h.platz).catch((e) => console.error('Havarie-Einsatz', e)); }
      return;
    }
    if (phase === 'fest') {
      // Regeln haben ohne Meldung eingeschleppt (Notfall, Abend): die Bootsansicht zeigt das Boot schon
      if (hav) entferneHavarist();
      if (helfer && laeuft === 'zugewiesen') { const alt = helfer; laeuft = 'fest'; heimfahren(alt, alt.token); }
      return;
    }
    if (phase === 'weg') {
      if (!hav) return;
      if (laeuft === 'weg') return;
      if (helfer) { entferneHelfer(); }
      // sieht es niemand (oder abends), ist er einfach weg; sonst holt ihn ein fremder Helfer
      const imBild = game.boatAnim.imBild?.(hav.anim.x, hav.anim.z, hav.info.length + 10);
      if (!imBild || game.state?.phase !== 'day') { entferneHavarist(); return; }
      laeuft = 'weg';
      zeichen.visible = false;
      einsatz(stufe() <= 3 ? 'fischer' : 'arbeitsboot', null, true).catch((e) => console.error('Havarie-Einsatz', e));
    }
  }

  let abT = 0;
  game.onTick((dt) => {
    const t = game.time ?? 0;
    for (let i = uhren.length - 1; i >= 0; i--) if (t >= uhren[i].bis) { uhren[i].res(); uhren.splice(i, 1); }
    abT += dt;
    if (abT > 0.4) { abT = 0; abgleich(); }
    if (hav) {
      treiben(dt);
      folgen();
      if (zeichen.visible) {
        zeichen.position.set(hav.anim.x, (hav.info.height ?? 3) + 2.2 + Math.sin(t * 3) * 0.25, hav.anim.z);
        zeichenGroesse();
      }
    }
    leineZeichnen();
  });
  game.on('sim:havarie', () => setTimeout(abgleich, 0));
  const neuLaden = () => { entferneHavarist(); entferneHelfer(); laeuft = null; setTimeout(abgleich, 0); };
  game.on('spielstand-geladen', neuLaden);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') neuLaden(); });
  // Neue Stufe oder neues Stegbild: Ort und Wege neu (der Havarist bleibt, wo er war, wenn dort Wasser ist)
  game.on('stufe', () => setTimeout(abgleich, 0));

  // Für die Meldung und Tests
  game.havarieBild = {
    havarist: () => (hav ? { id: hav.id, x: hav.anim.x, z: hav.anim.z, geschleppt: hav.geschleppt, festAuftrag: hav.festAuftrag } : null),
    helfer: () => (helfer ? { art: helfer.art, x: helfer.anim.x, z: helfer.anim.z } : null),
    leine: () => leine.visible,
    anims: () => ({ havarist: hav?.anim ?? null, helfer: helfer?.anim ?? null }),   // nur zum Prüfen
  };
}

export default initHavarieBild;
