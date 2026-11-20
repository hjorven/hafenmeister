// Sichtbare Wirkung der Services im Hafen (Roadmap P23, F2 und F7). Wird von js/render/services.js
// gestartet, kein eigener Eintrag in MODULES. Regeln und Zahlen: js/services/rules.js und
// js/data/economy.js (wirkung.trailer, wirkung.abendgaeste, wirkung.tagesgaeste).
//
//   Trailerboote    Slipanlage: Am Vormittag gehen die Boote des Tages nacheinander am Slip ins Wasser,
//                   fahren eine Runde über den See und werden am Nachmittag wieder aufgeslippt.
//                   Kein Liegeplatz. Abgerechnet wird abends genau diese Zahl (rules.mengeHeute).
//   Abendgäste      Räucherei: Am Abend kommen Leute aus dem Ort zur Räucherei (game.people.besucher).
//   Tagesgäste      Kreuzfahrtschiff und Marineschiffe: Solange das Schiff fest ist, gehen Gruppen von
//                   Bord in den Ort (game.people wie bei Gastbooten mit Tagesgästen) und kommen zum
//                   Auslaufen zurück. Café, Eisdiele, Fischhalle verdienen an diesem Tag mit.
//
//   game.services.wirkung.trailer()   aktuelle Trailerboote (zum Prüfen): [{ nr, sichtbar, x, z }]
import * as THREE from 'three';
import { FARBE, box, rumpf } from './services-models.js';

const U = 0.62;
// Tagesanteil (0 Morgen, 1 Ende des Abends wie game.sim.tagesAnteil)
const START = 0.08;        // erstes Trailerboot geht ins Wasser
const ABSTAND = 0.045;     // dann alle ...
const DAUER = 0.36;        // so lange ist ein Trailerboot unterwegs (Anteil des Tages)
const SLIPPEN = 0.035;     // Anteil der Fahrt für Ins-Wasser-Rollen und Aufslippen
// Tagesgäste großer Schiffe: so viele Menschen gehen höchstens sichtbar von Bord (Figuren zu je 5)
const TAGESGAESTE_SICHTBAR = { kreuzfahrtterminal: 120, marineanleger: 60 };
const BESUCH_PLATZ = { kreuzfahrtterminal: 'P01', marineanleger: 'MA01' };
const FARBEN = [FARBE.white, FARBE.red, FARBE.navy, FARBE.yellow, FARBE.green, FARBE.coral];

function trailerBoot(nr) {
  // 5-m-Motorboot mit Konsole und Außenborder, Bug nach +x (wie alle Boote)
  const g = new THREE.Group();
  const c = FARBEN[nr % FARBEN.length];
  rumpf(g, 5, 2, 0.8, c, 0, 0, 0, 0, FARBE.white);
  box(g, 0.9, 0.9, 1, FARBE.white, 0.2, 0.75, 0);
  box(g, 0.08, 0.5, 1, FARBE.glass, 0.68, 1.4, 0);
  box(g, 0.4, 0.8, 0.4, FARBE.ink, -2.6, 0.2, 0);
  // zwei Leute an Bord
  box(g, 0.4, 0.8, 0.4, FARBE.coral, -0.6, 0.85, 0.35);
  box(g, 0.4, 0.8, 0.4, FARBE.blue, -0.6, 0.85, -0.35);
  g.name = `trailerboot-${nr}`;
  g.visible = false;
  return g;
}

function wegLaenge(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return s;
}
function aufWeg(pts, t) {
  const ziel = Math.max(0, Math.min(1, t)) * wegLaenge(pts);
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (s + d >= ziel || i === pts.length - 1) {
      const k = d > 0 ? Math.min(1, (ziel - s) / d) : 0;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, kurs: Math.atan2(-(b.z - a.z), b.x - a.x) };
    }
    s += d;
  }
  return { x: pts[0].x, z: pts[0].z, kurs: 0 };
}
function winkelZu(a, b, k) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

export function initWirkung(game, services) {
  const gruppe = new THREE.Group();
  gruppe.name = 'services-wirkung';
  game.scene?.add(gruppe);

  const tagNr = () => game.state?.tag ?? game.sim?.state?.day ?? 1;
  const anteil = () => game.sim?.tagesAnteil?.() ?? 0.5;
  const winter = () => !!game.sim?.season?.()?.winter;
  const wetter = () => {
    if (/sturm|storm/i.test(String(game.events?.current?.id ?? ''))) return 'sturm';
    let w = null;
    try { w = game.events?.weather?.(tagNr()); } catch { w = null; }
    return (w?.rain ?? 0) > 0.3 ? 'regen' : 'sonne';
  };
  const R = () => services._regeln?.();

  // ------------------------------------------------------------------ Trailerboote
  const boote = [];           // Pool: { group, weg, kurs, abmelden }
  let rampe = null;           // { oben, unten } Weltpunkte: Trailer an Land, Boot schwimmt
  let wegeFuer = null;        // Schlüssel der Wege (Karte, Rampe)
  const wege = [];

  function rampeSuchen() {
    const anlage = services.gruppe?.getObjectByName?.('service-slip');
    if (!anlage) return null;
    anlage.updateMatrixWorld(true);
    const p = anlage.getWorldPosition(new THREE.Vector3());
    // Blickrichtung des Modells (lokal -z) zeigt aufs Wasser, wie in services.js uferAbstand
    const ry = anlage.rotation.y;
    const dx = -Math.sin(ry), dz = -Math.cos(ry);
    const tief = (x, z) => game.landscape?.tiefeBei?.(x, z) ?? -(game.landschaft?.hoeheBei?.(x, z) ?? 1);
    let oben = null, unten = null;
    for (let d = 0; d <= 70; d += 0.5) {
      const x = p.x + dx * d, z = p.z + dz * d;
      const t = tief(x, z);
      if (oben == null && t > -0.2) oben = { x: p.x + dx * Math.max(0, d - 3), z: p.z + dz * Math.max(0, d - 3) };
      if (t > 1.1) { unten = { x, z }; break; }
    }
    if (!oben || !unten) return null;
    return { oben, unten, dx, dz };
  }

  // Rundkurs über den See: vom Slip hinaus, zwei Wendepunkte, zurück. Alles über die Fahrwasserkarte,
  // nie über Land. Jedes Boot fährt eine etwas andere Runde.
  function rundeFuer(nr) {
    const fw = game.fahrwasser;
    const r = rampe;
    if (!r) return null;
    const start = { x: r.unten.x, z: r.unten.z };
    const roh = [];
    const basis = Math.atan2(r.dz, r.dx);
    for (const [w, d] of [[-0.5 + nr * 0.37, 38 + (nr % 3) * 10], [0.6 - nr * 0.29, 52 + (nr % 2) * 12]]) {
      const a = basis + w;
      roh.push({ x: start.x + Math.cos(a) * d, z: start.z + Math.sin(a) * d });
    }
    if (!fw?.weg || !fw?.befahrbar) return [start, ...roh, start];
    const frei = (p) => {
      if (fw.befahrbar(p.x, p.z, 3, 1)) return p;
      for (let d = 4; d <= 32; d += 4) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const q = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
          if (fw.befahrbar(q.x, q.z, 3, 1)) return q;
        }
      }
      return null;
    };
    const out = [start];
    for (const ziel of [...roh.map(frei).filter(Boolean), start]) {
      const von = out[out.length - 1];
      if (Math.hypot(ziel.x - von.x, ziel.z - von.z) < 3) continue;
      const w = fw.weg(von, ziel, { breiteM: 2, tiefgangM: 0.6 });
      if (w?.ok && w.punkte?.length) for (const q of w.punkte.slice(1)) out.push({ x: q.x, z: q.z });
      else if (ziel === start) out.push(start);
    }
    if (out.length < 3) return null;
    if (Math.hypot(out[out.length - 1].x - start.x, out[out.length - 1].z - start.z) > 1) out.push(start);
    return out;
  }

  function trailerTick(dt) {
    const regeln = R();
    const n = regeln && !winter() ? regeln.mengeHeute(services.zustand(), 'slip', 'trailer', tagNr(), wetter()) : 0;
    if (!n) { for (const b of boote) b.group.visible = false; return; }
    const key = `${game.fahrwasser?.karte?.nx ?? 0}:${services.stufeVon('slip')}:${game.state?.stufe ?? 0}`;
    if (!rampe || key !== wegeFuer) {
      rampe = rampeSuchen();
      wegeFuer = key;
      wege.length = 0;
    }
    if (!rampe) return;
    const u = anteil();
    for (let i = 0; i < n; i++) {
      if (!boote[i]) {
        const group = trailerBoot(i);
        gruppe.add(group);
        let abmelden = null;
        try { abmelden = game.boatAnim?.hindernis?.(group, { laenge: 5, breite: 2 }) ?? null; } catch { abmelden = null; }
        boote[i] = { group, kurs: 0, abmelden };
      }
      const b = boote[i];
      const von = START + i * ABSTAND;
      const t = (u - von) / DAUER;
      if (t <= 0 || t >= 1) { b.group.visible = false; continue; }
      if (!wege[i]) wege[i] = rundeFuer(i);
      const weg = wege[i];
      if (!weg) { b.group.visible = false; continue; }
      b.group.visible = true;
      let p, soll, y = 0;
      if (t < SLIPPEN || t > 1 - SLIPPEN) {
        // Auf dem Trailer die Rampe hinunter (oder hinauf), Bug zum Land
        const k = t < SLIPPEN ? t / SLIPPEN : (1 - t) / SLIPPEN;
        p = { x: rampe.oben.x + (rampe.unten.x - rampe.oben.x) * k, z: rampe.oben.z + (rampe.unten.z - rampe.oben.z) * k };
        soll = Math.atan2(rampe.dz, -rampe.dx);
        y = (1 - k) * 0.6;
        b.kurs = soll;
      } else {
        const w = aufWeg(weg, (t - SLIPPEN) / (1 - 2 * SLIPPEN));
        p = w; soll = w.kurs;
        b.kurs = winkelZu(b.kurs, soll, Math.min(1, dt * 2.5));
      }
      b.group.position.set(p.x, y + Math.sin(game.time * 1.6 + i) * 0.04, p.z);
      b.group.rotation.y = b.kurs;
    }
    for (let i = n; i < boote.length; i++) boote[i].group.visible = false;
  }
  game.on('fahrwasser:karte', () => { wegeFuer = null; });
  game.on('services:gebaut', (e) => { if (e?.id === 'slip') wegeFuer = null; });
  game.on('ready', () => { wegeFuer = null; });

  // ------------------------------------------------------------------ Abendgäste der Räucherei
  let abendTag = -1;
  function abendTick() {
    const u = anteil();
    if (u < 0.6 || abendTag === tagNr() || winter()) return;
    abendTag = tagNr();
    const regeln = R();
    if (!regeln) return;
    const n = regeln.mengeHeute(services.zustand(), 'raeucherei', 'abendgaeste', tagNr(), wetter());
    if (n > 0) game.people?.besucher?.('raeucherei', Math.min(12, n), { abstand: 3 });
  }

  // ------------------------------------------------------------------ Tagesgäste großer Schiffe (F7)
  const anBord = new Map();    // id -> Kennung der Gäste bei game.people
  const aufraeumen = [];       // { kennung, bei } Gäste nach dem Auslaufen abmelden (Spielzeit)
  function tagesgaesteTick() {
    for (let i = aufraeumen.length - 1; i >= 0; i--) {
      if (game.time < aufraeumen[i].bei) continue;
      game.emit('boat:left', { id: aufraeumen[i].kennung });
      aufraeumen.splice(i, 1);
    }
    for (const id of Object.keys(BESUCH_PLATZ)) {
      const liegt = !!services.besuche?.amPlatz?.(id);
      const kennung = `besuch-${id}`;
      if (liegt && !anBord.has(id)) {
        const b = services.besuchVon?.(id);
        const n = Math.min(TAGESGAESTE_SICHTBAR[id], b?.gaeste ?? 0);
        if (n <= 0 || !game.people?.bootAngelegt) continue;
        game.people.bootAngelegt({ id: kennung, platz: BESUCH_PLATZ[id], groesse: 'xxl', crew: 0, tagesgaeste: n });
        anBord.set(id, kennung);
      } else if (!liegt && anBord.has(id)) {
        game.people?.bootLegtAb?.(kennung);
        anBord.delete(id);
        // Wer nicht rechtzeitig zurück ist, geht still an Bord (people.js Frist WARTEN_MAX), danach abmelden
        aufraeumen.push({ kennung, bei: game.time + 25 });
      }
    }
  }

  game.onTick((dt) => {
    trailerTick(dt);
    abendTick();
    tagesgaesteTick();
  });

  return {
    gruppe,
    trailer: () => boote.map((b, nr) => ({ nr, sichtbar: b.group.visible, x: b.group.position.x / U, y: -b.group.position.z / U })),
    tagesgaeste: () => [...anBord.keys()],
  };
}
