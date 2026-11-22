// Ruhiger Abend und Serien-Akkord (Paket P46, roadmap.md F29, F30, L1). Beschreibung: docs/stimmung.md.
//
// Ruhiger Abend (F29): Ist am Abend alles kassiert und wartet kein Boot mehr auf einen Platz, gehen an
//   allen Stegen Lichterketten an, vom Land nach außen, Birne für Birne. Die Musik wird wärmer (Septakkorde,
//   langsamer, weicher) und drei leise Glockentöne klingen. Die Ketten leuchten bis zum Morgen, auch wenn
//   danach noch ein Boot einläuft: Nichts wird wieder weggenommen.
// Serie (F30): Drei passgenaue Zuweisungen hintereinander (selbst gezogen oder selbst umgelegt) ergeben einen
//   Akkord: Grundton, Terz, dann der ganze Akkord passend zur Musik. Über dem Boot steigen ein, zwei, drei
//   Noten auf. Ohne Zeitgrenze; eine Zuweisung, die nicht passgenau ist, fängt die Serie leise neu an.
// Töne (L1): neuer Stammgast, Stufenziel erreicht. Bewertung, Tagesziel, neues Modell und Ausbau klingen
//   schon in ihren Modulen (gaestebuch.js, tagesziele.js, logbuch.js, audio.js).
//
// Regeln ohne Browser: features/stimmung-regeln.js (tests/stimmung.test.mjs).
// Spielstand: state.modules.stimmung = { serie, akkorde, ruhigeAbende, zielStufe }.
// Schnittstelle: game.stimmung = { stand(), an(), serie(), zuenden(), loeschen(), ketten() }
// Ereignisse: 'stimmung:ruhig' { tag }, 'stimmung:serie' { boatId, schritt }, 'stimmung:akkord' { boatId }
// Ausprobieren: ?abend=jetzt spult bis kurz vor den Abend.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HAFEN } from '../data/harbor.js';
import * as sim from '../sim.js';
import { abendStand, serieZaehlen, stimmungState, SERIE_LAENGE } from './stimmung-regeln.js';
import { FARBE as PIXELFARBE } from '../ui/pixel-symbole.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;

// Lichterkette: Pfosten an der Stegkante, dazwischen hängt die Leitung mit Birnen
const KETTE = {
  pfostenAbstand: 7,      // m
  pfostenHoehe: 1.45,     // m über der Lauffläche
  durchhang: 0.28,        // m in der Mitte zwischen zwei Pfosten
  birnenAbstand: 0.75,    // m
  zuendTempo: 16,         // m je Sekunde: so schnell laufen die Lichter vom Land nach außen
  ausblenden: 3,          // s am Morgen
};
// Warmweiß überwiegt, dazwischen bunte Birnen wie bei einer echten Festbeleuchtung am Steg
const BIRNEN = ['#ffc14d', '#ffa630', '#ffc14d', '#ff6a3d', '#ffc14d', '#ffa630', '#7fd65a', '#ffc14d', '#ff5c8a', '#ffa630', '#5cb8ff'];
const AUS = new THREE.Color('#4b4436').toArray();

// Note als Pixelbild (über dem Boot bei der Serie)
const NOTE = ['....kk', '....kgk', '....kggk', '....kk.k', '....k...', '....k...', '.kkkk...', 'kggggk..', 'kggggk..', '.kkkk...'];

const lies = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };

export function init(game) {
  const st = () => game.sim?.state;
  // Für ein wartendes Boot ist noch eine passende Box frei (dann ist es noch nicht versorgt)
  const hatPlatz = (id) => {
    const s = st(), c = game.sim?.ctx;
    if (!s || !c) return true;
    try { return sim.fittingBerths(s, c, id).length > 0; } catch { return true; }
  };
  const standJetzt = () => (st() ? abendStand(st(), hatPlatz) : null);
  const wenigBewegung = () => document.body.classList.contains('hm-ruhig');

  // ------------------------------------------------------------------ Lichterketten
  const root = new THREE.Group();
  root.name = 'lichterketten';
  game.scene.add(root);
  const keinStrahl = (o) => { o.raycast = () => {}; return o; };

  const pfostenMat = new THREE.MeshLambertMaterial({ color: '#3d3a3f', flatShading: true });
  const leitungMat = new THREE.LineBasicMaterial({ color: '#2b2a2e', transparent: true, opacity: 0.7 });
  const birnenMat = new THREE.PointsMaterial({ size: 0.45, sizeAttenuation: true, vertexColors: true, fog: false, toneMapped: false });
  const scheinMat = new THREE.PointsMaterial({
    size: 5, sizeAttenuation: true, vertexColors: true, map: scheinTextur(),
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
  });

  let birnen = null;   // { farbe: Float32Array (Zielfarbe), start: Float32Array (s nach dem Zünden), phase, n, punkte, schein }
  let sig = '';

  function aufbauen() {
    const g = game.stege?.gebaut?.();
    if (!g) return;
    if (g.sig === sig && birnen) return;
    sig = g.sig;
    for (const o of [...root.children]) { root.remove(o); o.geometry?.dispose(); }
    birnen = null;
    const pfosten = [], leitung = [], pos = [], farbe = [], start = [], phase = [];
    let nr = 0;
    for (const linie of g.stege ?? []) {
      const pts = (linie.punkte ?? []).map(([x, y]) => new THREE.Vector3(x * U, 0, -y * U));
      if (pts.length < 2) continue;
      const deck = game.stege.deckHoehe?.(linie.bauart) ?? 0.86;
      const b = Math.max(1.0, (linie.breite ?? 2) * U);
      const seite = kettenSeite(linie, pts);
      // Pfosten in gleichen Abständen entlang der Linie (Bogenlänge), an der Stegkante
      const laengen = [0];
      for (let i = 1; i < pts.length; i++) laengen.push(laengen[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const gesamt = laengen[laengen.length - 1];
      if (gesamt < 3) continue;
      const n = Math.max(1, Math.round(gesamt / KETTE.pfostenAbstand));
      const stellen = [];
      for (let k = 0; k <= n; k++) {
        const s = Math.min(gesamt - 0.3, Math.max(0.3, (gesamt * k) / n));
        stellen.push({ s, p: punktAuf(pts, laengen, s, b / 2 - 0.12, seite) });
      }
      for (const { p } of stellen) {
        const geo = new THREE.BoxGeometry(0.07, KETTE.pfostenHoehe, 0.07);
        geo.translate(p.x, deck + KETTE.pfostenHoehe / 2, p.z);
        pfosten.push(geo);
      }
      // Leitung mit Durchhang, Birnen in gleichen Abständen
      for (let k = 0; k < stellen.length - 1; k++) {
        const a = stellen[k], e = stellen[k + 1];
        const top = deck + KETTE.pfostenHoehe - 0.04;
        const len = a.p.distanceTo(e.p);
        const schritte = Math.max(2, Math.round(len / KETTE.birnenAbstand));
        let vorher = null;
        for (let j = 0; j <= schritte; j++) {
          const f = j / schritte;
          const q = a.p.clone().lerp(e.p, f);
          q.y = top - KETTE.durchhang * 4 * f * (1 - f);
          if (vorher) leitung.push(vorher.x, vorher.y, vorher.z, q.x, q.y, q.z);
          vorher = q;
          if (j === 0 || j === schritte) continue;   // keine Birne direkt am Pfosten
          pos.push(q.x, q.y - 0.07, q.z);
          const c = new THREE.Color(BIRNEN[nr % BIRNEN.length]);
          farbe.push(c.r, c.g, c.b);
          start.push((a.s + (e.s - a.s) * f) / KETTE.zuendTempo + ((nr * 37) % 11) * 0.012);
          phase.push((nr * 2.399) % (Math.PI * 2));
          nr++;
        }
      }
    }
    if (pfosten.length) {
      const m = keinStrahl(new THREE.Mesh(mergeGeometries(pfosten, false), pfostenMat));
      pfosten.forEach((x) => x.dispose());
      m.castShadow = true;
      m.name = 'lichterketten-pfosten';
      root.add(m);
    }
    if (leitung.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(leitung, 3));
      root.add(keinStrahl(new THREE.LineSegments(lg, leitungMat)));
    }
    if (pos.length) {
      const n = pos.length / 3;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      sg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));   // mit Deckkraft je Birne
      const pb = keinStrahl(new THREE.Points(bg, birnenMat));
      const ps = keinStrahl(new THREE.Points(sg, scheinMat));
      pb.name = 'lichterketten-birnen';
      ps.name = 'lichterketten-schein';
      ps.renderOrder = 5;
      root.add(pb, ps);
      birnen = { n, farbe: new Float32Array(farbe), start: new Float32Array(start), phase: new Float32Array(phase), punkte: pb, schein: ps };
    }
    zeichneLicht(performance.now() / 1000, true);
  }

  // Seite der Kette: weg von den Liegeplätzen, wenn sie nur auf einer Seite liegen (Kai); sonst rechts
  function kettenSeite(linie, pts) {
    if (!linie.steg) return 1;
    let summe = 0, anzahl = 0;
    const a = pts[0], e = pts[pts.length - 1];
    const dir = e.clone().sub(a).normalize();
    for (const p of HAFEN.plaetze ?? []) {
      if (p.steg !== linie.steg) continue;
      const w = game.stege.platz?.(p.id);
      if (!w) continue;
      summe += Math.sign((w.x - a.x) * -dir.z + (w.z - a.z) * dir.x);
      anzahl++;
    }
    if (anzahl >= 2 && Math.abs(summe / anzahl) > 0.6) return -Math.sign(summe);
    return 1;
  }

  // --- Zustand der Lichter: aus, zünden (Zeitpunkt), an, ausblenden
  let an = false;
  let gezuendet = 0;     // s (performance.now) beim Zünden
  let aus = 0;           // s beim Ausblenden, 0 = nicht
  let nacht = 0;
  let laeuft = false;

  function zeichneLicht(t, sofort = false) {
    if (!birnen) return;
    const { n, farbe, start, phase } = birnen;
    const cb = birnen.punkte.geometry.attributes.color;
    const cs = birnen.schein.geometry.attributes.color;
    const ruhigBild = wenigBewegung();
    // Weit herausgezoomt würden Birnen und Schein zu Pünktchen: dann größer und dafür zarter,
    // so wird aus der Kette ein warmes Lichterband entlang des Stegs
    const breite = game.camera?.viewWidth ?? 60;
    scheinMat.size = Math.max(5, breite * 0.05);
    birnenMat.size = Math.max(0.45, breite * 0.004);
    const aufhellen = (0.4 + 0.6 * nacht) * (5 / scheinMat.size) ** 0.5;
    const raus = aus ? Math.max(0, 1 - (t - aus) / KETTE.ausblenden) : 1;
    let fertig = true;
    for (let i = 0; i < n; i++) {
      let h = 0;
      if (an) {
        const dt = sofort ? 9 : t - gezuendet - start[i];
        if (dt < 0) { h = 0; fertig = false; } else if (dt < 0.25) { h = (dt / 0.25) * 1.25; fertig = false; } else if (dt < 0.4) { h = 1.25 - ((dt - 0.25) / 0.15) * 0.25; fertig = false; } else h = 1;
        if (!ruhigBild && h >= 1) h *= 0.88 + 0.12 * Math.sin(t * 2.1 + phase[i]);
        h *= raus;
      }
      const k = i * 3;
      for (let c = 0; c < 3; c++) {
        cb.array[k + c] = AUS[c] * (1 - Math.min(1, h)) + farbe[k + c] * Math.min(1.1, h);
        cs.array[i * 4 + c] = farbe[k + c];
      }
      cs.array[i * 4 + 3] = Math.min(1, h * 1.1 * aufhellen);
    }
    cb.needsUpdate = true;
    cs.needsUpdate = true;
    birnen.schein.visible = an;
    if (aus && raus <= 0) { an = false; aus = 0; birnen.schein.visible = false; }
    return fertig;
  }

  function schleife() {
    if (!laeuft) return;
    zeichneLicht(performance.now() / 1000);
    if (an) requestAnimationFrame(schleife);
    else { laeuft = false; zeichneLicht(0, true); }
  }
  function starteSchleife() {
    if (laeuft) return;
    laeuft = true;
    requestAnimationFrame(schleife);
  }

  function zuenden({ still = false, verzoegert = 0 } = {}) {
    if (an && !aus) return false;
    an = true;
    aus = 0;
    gezuendet = performance.now() / 1000;
    if (!birnen) aufbauen();
    game.audio?.setRuhig?.(true);
    if (!still) game.audio?.sfx?.('abendruhe', { delay: verzoegert });
    starteSchleife();
    return true;
  }

  function loeschen({ sofort = false } = {}) {
    game.audio?.setRuhig?.(false);
    if (!an) return;
    if (sofort) { an = false; aus = 0; zeichneLicht(0, true); return; }
    if (!aus) aus = performance.now() / 1000;
    starteSchleife();
  }

  // Prüfen, ob der Abend ruhig geworden ist (viermal je Sekunde echter Zeit reicht). Auch in der Pause:
  // Kassieren geht dort ebenfalls, dann sollen die Lichter gleich angehen.
  let pruefT = 0;
  let abendTag = null;     // Tag, an dem die Ketten an sind
  game.onTick(() => {
    const jetzt = performance.now();
    const s = st();
    if (!s || jetzt - pruefT < 250) return;
    pruefT = jetzt;
    if (s.phase === 'day') {
      if (an && !aus) loeschen();
      abendTag = null;
      return;
    }
    if (abendTag === s.day) return;
    if (!abendStand(s, hatPlatz).ruhig) return;
    abendTag = s.day;
    const m = stimmungState(s);
    m.ruhigeAbende++;
    // Gleich zu Beginn des Abends schlägt die Schiffsglocke (audio.js, hafengesten.js): erst danach klingen
    const r = game.sim?.ctx?.rules;
    const frueh = r && s.clock - r.dayLength < 3;
    zuenden({ verzoegert: frueh ? 3 : 0 });
    game.emit('stimmung:ruhig', { tag: s.day });
  });

  // Nachtlicht der Landschaft: die Lichter strahlen stärker, je dunkler es ist
  game.on('licht', (z) => { if (Number.isFinite(z?.nacht)) nacht = z.nacht; });
  nacht = (game.landschaft ?? game.landscape)?.licht?.zustand?.nacht ?? 0;

  game.on('stege', () => aufbauen());
  game.on('sim:change', (d) => {
    if (d?.reason === 'load' || d?.reason === 'new') { abendTag = null; loeschen({ sofort: true }); for (const el of [...noten]) el.remove(); }
    aufbauen();
  });
  game.on('spielstand-geladen', () => { abendTag = null; loeschen({ sofort: true }); aufbauen(); });

  // ------------------------------------------------------------------ Serie und Akkord
  const ebene = document.createElement('div');
  ebene.id = 'hm-stimmung-noten';
  ebene.setAttribute('aria-hidden', 'true');
  ebene.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden';   // wie die Münzen des Tagesabschlusses, unter den Leisten
  document.body.appendChild(ebene);
  const noten = new Set();
  const notenBild = noteSvg();

  // Die Noten steigen über der Box auf, in die der Spieler das Boot gezogen hat (dort ist sein Finger),
  // nicht über dem Boot, das vielleicht noch draußen an der Boje liegt
  function notenAmPlatz(platzId, schritt) {
    const p = game.stege?.platz?.(platzId);
    const cam = game.camera?.camera;
    if (!p || !cam) return;
    const anzahl = Math.min(SERIE_LAENGE, Math.max(1, schritt));
    const akkord = schritt >= SERIE_LAENGE;
    const t0 = performance.now();
    const els = [];
    for (let i = 0; i < anzahl; i++) {
      const el = document.createElement('img');
      el.src = notenBild;
      el.alt = '';
      el.className = 'hm-stimmung-note' + (akkord ? ' akkord' : '');
      el.style.cssText = `position:absolute;left:0;top:0;width:${akkord ? 26 : 22}px;height:auto;image-rendering:pixelated;opacity:0;will-change:transform`;
      ebene.appendChild(el);
      noten.add(el);
      els.push(el);
    }
    const dauer = akkord ? 2200 : 1500;
    const v = new THREE.Vector3();
    const bild = () => {
      const t = performance.now() - t0;
      const f = t / dauer;
      if (f >= 1) { for (const el of els) { el.remove(); noten.delete(el); } return; }
      v.set(p.x, 1.6, p.z);
      v.project(cam);
      const sichtbar = v.z <= 1 && v.z >= -1;
      const x = (v.x + 1) / 2 * (game.camera.screenW ?? innerWidth);
      const y = (1 - v.y) / 2 * (game.camera.screenH ?? innerHeight);
      const r = game.renderer?.domElement?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const ruhigBild = wenigBewegung();
      els.forEach((el, i) => {
        // Akkord: drei Noten übereinander wie im Notensatz, Einzelnoten steigen leicht schräg
        const dx = akkord ? (i - 1) * 6 : (i - (anzahl - 1) / 2) * 22;
        const dy = akkord ? -i * 15 : -i * 8;
        const hoch = ruhigBild ? 0 : f * 34;
        const alpha = f < 0.15 ? f / 0.15 : f > 0.7 ? Math.max(0, (1 - f) / 0.3) : 1;
        el.style.opacity = sichtbar ? String(alpha) : '0';
        el.style.transform = `translate(${Math.round(r.left + x + 22 + dx)}px, ${Math.round(r.top + y - 58 + dy - hoch)}px)`;
      });
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  }

  function zaehle(e) {
    const s = st();
    if (!s) return;
    const schritt = serieZaehlen(stimmungState(s), e);
    if (!schritt) return;
    const boatId = e.boatId;
    // kurz nach dem "Platz"-Klang, damit beide zu hören sind
    game.audio?.sfx?.('serie', { stufe: schritt, delay: 0.18 });
    notenAmPlatz(e.type === 'relocated' ? e.to : e.berthId, schritt);
    game.emit('stimmung:serie', { boatId, schritt });
    if (schritt >= SERIE_LAENGE) game.emit('stimmung:akkord', { boatId });
  }
  game.on('sim:moored', zaehle);
  game.on('sim:relocated', zaehle);

  // ------------------------------------------------------------------ Töne (L1)
  game.on('stammgast:neu', () => game.audio?.sfx?.('stammgast', { delay: 0.3 }));
  game.on('sim:stageReady', (e) => {
    const s = st();
    if (!s || !e?.stage) return;
    const m = stimmungState(s);
    if (m.zielStufe === e.stage) return;   // jeden Morgen erneut gemeldet: nur einmal je Stufe klingen
    m.zielStufe = e.stage;
    game.audio?.sfx?.('stufenziel', { delay: 0.6 });
  });

  // ------------------------------------------------------------------ Schnittstelle
  game.stimmung = {
    stand: standJetzt,
    an: () => an && !aus,
    serie: () => (st() ? stimmungState(st()).serie : 0),
    akkorde: () => (st() ? stimmungState(st()).akkorde : 0),
    zuenden: () => zuenden(),
    loeschen: () => loeschen(),
    ketten: () => ({ birnen: birnen?.n ?? 0, gruppe: root }),
  };

  aufbauen();
  game.on('ready', () => aufbauen());

  // ?abend=jetzt: bis kurz vor den Abend vorspulen, zum Ausprobieren
  if (lies('abend') === 'jetzt') {
    const t = setInterval(() => {
      const s = st(), r = game.sim?.ctx?.rules;
      if (!s || !r || !game.sim.fastForward) return;
      clearInterval(t);
      const bis = r.dayLength - 4;
      if (s.phase === 'day' && s.clock < bis) game.sim.fastForward(bis - s.clock);
    }, 200);
    setTimeout(() => clearInterval(t), 30000);
  }
}

// Punkt auf der Linie bei Bogenlänge s, seitlich um quer Meter versetzt
function punktAuf(pts, laengen, s, quer, seite) {
  let i = 1;
  while (i < pts.length - 1 && laengen[i] < s) i++;
  const a = pts[i - 1], e = pts[i];
  const seg = laengen[i] - laengen[i - 1] || 1;
  const f = Math.min(1, Math.max(0, (s - laengen[i - 1]) / seg));
  const dir = e.clone().sub(a).normalize();
  const p = a.clone().lerp(e, f);
  p.x += -dir.z * quer * seite;
  p.z += dir.x * quer * seite;
  return p;
}

// Weicher runder Schein für die Birnen
function scheinTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noteSvg() {
  const w = Math.max(...NOTE.map((z) => z.length)), h = NOTE.length;
  let rects = '';
  NOTE.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '.') return;
    rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'g' ? '#ffd76a' : PIXELFARBE.k}"/>`;
  }));
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges">${rects}</svg>`);
}

export default init;
