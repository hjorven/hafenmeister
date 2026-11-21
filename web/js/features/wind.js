// Wind im Hafen (P34, F5 und F35). Beschreibung: docs/wind.md
//
// Jeden Tag weht der Wind aus einer Richtung (events/scheduler.js weather().richtung, world/wind.js) und
// mit einer Stärke (0 bis 1, Wetter des Tages). Dieses Modul macht ihn im Hafen spürbar:
//
//   Bild:   Boote krängen und schwojen im Wind (boat-anim setWind), Seegang je nach Windstärke und
//           Wellenweg (setSea, setShelter: draußen schaukeln sie, hinter Mole und Land liegen sie ruhig),
//           Wellenstriche im Wasser laufen mit dem Wind, der Windsack am Flaggenmast zeigt nach Lee.
//   Regeln: Bei Starkwind (ECONOMY.wind.stark, ab Stufe wind.abStufe) bekommt jeder Platz eine Windlage:
//           'offen' (langer Wellenweg gegen den Wind) oder 'geschuetzt' (kurzer). Ein Gast, der dort liegt,
//           merkt es sich (boat.windLage) und bewertet beim Ablegen −unruhig oder +geschuetzt Anker
//           (sim.windRating). Große Boote (wind.grosse), die mit dem Wind von achtern anlegen müssen,
//           brauchen länger (boat-anim setAnlegeFaktor) und geben rueckenwind Anker weniger
//           (boat.windRuecken). Büro und "Einfahren lassen" bevorzugen geschützte Plätze und für große
//           Boote den Bug gegen den Wind (Hook 'score').
//   Anzeige: Wetterbericht mit Richtung und Satz (events/banner.js), Ansage am Morgen eines Starkwindtags,
//           beim Ziehen eines Boots Welle (offen), Schild (geschützt) und Windlinien (Rückenwind für große
//           Boote) über den passenden Boxen, ein Satz auf der Bootskarte, Gründe im Gästebuch.
//
// Lesen: game.wind = { heute, stark(), lage(platzId), bug(platzId), lagen(), kartenSatz(boot), berichtSatz(wx) }
// Spielstand: state.modules.wind = { gesagt: { tag, richtung } } (nur für die Ansage)

import * as THREE from 'three';
import { ECONOMY } from '../data/economy.js';
import { HAFEN, platzInWelt } from '../data/harbor.js';
import { molen } from '../render/landschaft/gelaende.js';
import { windRaster, platzLagen, wellenweg, richtungsName, bugGegenWind } from '../world/wind.js';
import { regelnBereit } from './regeln-bereit.js';
import { istStark, lageZaehlt, windTick, windScore, platzZeichen, anlegeTempo } from './wind-regeln.js';
import { PIXEL, FARBE } from '../ui/pixel-symbole.js';

export const WIND = ECONOMY.wind;
const U = 0.62;
const RAD = Math.PI / 180;
// Raster der Windlage: etwas größer als das Revier der Fahrwasserkarte (render/boat-view.js BEREICH)
const BEREICH = { x0: -440, x1: 330, z0: -370, z1: 150 };
const ZELLE = 2.5;

const komma = (x) => String(x).replace('.', ',');

// ------------------------------------------------------------------ Pixel-Zeichen über den Boxen

function zeichenTextur(name) {
  const raster = PIXEL[name] ?? PIXEL.wolke;
  const n = raster.length, s = 4, rand = 2;
  const c = document.createElement('canvas');
  c.width = c.height = (n + rand * 2) * s;
  const g = c.getContext('2d');
  // helles Schild mit Tintenrand, darauf das Symbol (wie die Pixelrahmen der Oberfläche)
  g.fillStyle = FARBE.k;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = FARBE.p;
  g.fillRect(s, s, c.width - 2 * s, c.height - 2 * s);
  raster.forEach((zeile, y) => [...zeile].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    g.fillStyle = ch === '#' ? FARBE.k : FARBE[ch] ?? FARBE.k;
    g.fillRect((x + rand) * s, (y + rand) * s, s, s);
  }));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const ZEICHEN_BILD = { offen: 'welle', geschuetzt: 'windschutz', rueckenwind: 'wind' };

// ------------------------------------------------------------------ Modul

export function init(game) {
  const heute = { tag: 0, wind: 0.2, richtung: 180, event: null };
  let raster = null, rasterSig = '';
  let lagen = new Map(), lagenSig = '';
  const schutzCache = new Map();

  const stufe = () => game.sim?.state?.stage ?? game.state?.stufe ?? 1;
  const rules = () => game.sim?.ctx?.rules ?? null;

  // --- Raster und Lagen
  function signatur() {
    const ls = game.landscape;
    const g = game.gelaende?.aktuell?.();
    return `${stufe()}|${ls?.stufe ?? ''}|${(ls?.region?.id ?? ls?.region) || ''}|${g?.nr ?? 1}|${g?.seed ?? 1}|${game.stegbild?.aktuell?.()?.nr ?? HAFEN.stegbild?.nr ?? 0}`;
  }
  function baueRaster() {
    const st = stufe();
    const ls = game.landscape;
    const istLand = ls?.istWasser ? (x, z) => !ls.istWasser(x, z) : () => false;
    const linien = HAFEN.stufen?.[st]?.stege ?? HAFEN.stufen?.[String(st)]?.stege ?? [];
    const welt = (pts) => pts.map(([x, y]) => ({ x: x * U, z: -y * U }));
    const hart = [], stege = [];
    for (const l of linien) {
      const e = { punkte: welt(l.punkte), breite: Math.max(1.2, (l.breite ?? 2) * U) };
      (l.bauart === 'kai' || l.bauart === 'pier' ? hart : stege).push(e);
    }
    for (const m of st >= 3 ? molen(st) : []) hart.push({ punkte: welt(m.punkte), breite: m.breite * U });
    return windRaster({ bereich: BEREICH, zelle: ZELLE, istLand, hart, stege });
  }
  function sichereLagen() {
    if (!game.landscape?.istWasser) return lagen;
    const sig = signatur();
    if (!raster || sig !== rasterSig) {
      raster = baueRaster();
      rasterSig = sig;
      lagenSig = '';
      schutzCache.clear();
    }
    const ls = `${sig}|${heute.richtung}`;
    if (ls !== lagenSig) {
      const st = stufe();
      const plaetze = [];
      for (const p of HAFEN.plaetze) {
        const w = platzInWelt(p, st);
        if (w) plaetze.push({ id: p.id, x: w.x, z: w.z });
      }
      lagen = platzLagen(raster, plaetze, heute.richtung, WIND);
      lagenSig = ls;
      schutzCache.clear();
    }
    return lagen;
  }
  const lageVon = (id) => lagen.get(id)?.lage ?? null;
  function bugVon(id) {
    const p = HAFEN.plaetze.find((q) => q.id === id);
    const l = p?.lage?.[String(stufe())];
    return l ? bugGegenWind(l[2], heute.richtung) : null;
  }

  // --- Bild: Wind, Seegang, Schutz
  function schutz(x, z) {
    if (!raster) return 0.6;
    const k = `${Math.round(x / 4)},${Math.round(z / 4)}`;
    let v = schutzCache.get(k);
    if (v == null) {
      const weg = wellenweg(raster, x, z, heute.richtung, { ...WIND, faecher: [-15, 0, 15], schritt: 4 });
      v = 0.35 + 0.65 * Math.min(1, weg / WIND.offenAb);
      if (schutzCache.size > 6000) schutzCache.clear();
      schutzCache.set(k, v);
    }
    return v;
  }
  function insBild() {
    game.boatAnim?.setWind?.(heute.richtung, heute.wind);
    game.boatAnim?.setSea?.(0.08 + 0.5 * heute.wind);
    game.landscape?.wasser?.setzeWindRichtung?.(heute.richtung);
  }
  game.boatAnim?.setShelter?.((x, z) => schutz(x, z));
  game.boatAnim?.setAnlegeFaktor?.((info, b) => {
    const r = rules();
    if (!r?.wind || !Number.isFinite(b?.heading)) return 1;
    if (b.kind === 'buoy' || b.kind === 'anker') return 1;
    return anlegeTempo(WIND, istStark(heute, r) && stufe() >= (r.wind.from ?? 1), info?.size, Math.cos(heute.richtung * RAD - b.heading));
  });

  // --- Wetter des Tages
  function setzeWetter(wx, tag) {
    if (!wx) return;
    heute.wind = Number.isFinite(wx.wind) ? wx.wind : 0.2;
    heute.richtung = Number.isFinite(wx.richtung) ? wx.richtung : 180;
    heute.event = wx.event ?? null;
    heute.tag = tag ?? game.sim?.state?.day ?? heute.tag;
    sichereLagen();
    insBild();
  }
  game.on('weather', (wx) => {
    setzeWetter(wx, game.sim?.state?.day);
    ansage();
  });
  for (const n of ['stufe', 'stege', 'landschaft:geaendert', 'spielstand-geladen']) game.on(n, () => { sichereLagen(); });

  // --- Ansage am Morgen eines Starkwindtags (nicht jeden Tag gleich: nur neue Lage oder neue Richtung)
  function ansage() {
    const r = rules();
    const state = game.sim?.state;
    if (!r || !state || state.phase === 'night' || !lageZaehlt(state, heute, r)) return;
    const mod = ((state.modules ||= {}).wind ||= {});
    const g = mod.gesagt;
    if (g && g.tag === state.day) return;
    const gedreht = !g || Math.abs(((heute.richtung - g.richtung + 540) % 360) - 180) >= 45;
    const gestern = g && g.tag === state.day - 1;
    mod.gesagt = { tag: state.day, richtung: heute.richtung };
    if (gestern && !gedreht) return;
    const l = [...sichereLagen().values()];
    const offen = l.filter((x) => x.lage === 'offen').length, schutz = l.filter((x) => x.lage === 'geschuetzt').length;
    if (!offen && !schutz) return;
    const text = `Offene Plätze werden unruhig (−${komma(r.wind.exposed)}), geschützte bringen +${komma(r.wind.sheltered)} Anker.`;
    game.banner?.zeige?.('wind', `Starkwind aus ${richtungsName(heute.richtung)}`, text, 8);
  }

  // --- Zeichen über den Boxen beim Ziehen
  const zeichenGruppe = new THREE.Group();
  zeichenGruppe.name = 'wind-zeichen';
  zeichenGruppe.renderOrder = 20;
  game.scene?.add(zeichenGruppe);
  const materialien = {};
  const mat = (art) => (materialien[art] ||= new THREE.SpriteMaterial({ map: zeichenTextur(ZEICHEN_BILD[art]), depthTest: false, transparent: true }));
  let zeichenFuer = null;
  function zeigeZeichen(bootId) {
    if (zeichenFuer === bootId) return;
    raeumeZeichen();
    zeichenFuer = bootId;
    const r = rules(), state = game.sim?.state, boot = state?.boats?.[bootId];
    if (!r || !boot) return;
    sichereLagen();
    for (const id of game.sim.fittingBerths?.(bootId) ?? []) {
      const art = platzZeichen(state, r, heute, boot, id, lageVon, bugVon);
      if (!art) continue;
      const sp = game.stege?.platz?.(id);
      const w = sp ?? platzInWelt(HAFEN.plaetze.find((p) => p.id === id), stufe());
      if (!w) continue;
      const s = new THREE.Sprite(mat(art));
      // so groß wie die Box breit ist: Zeichen benachbarter Boxen stehen nebeneinander, nicht übereinander
      const platz = HAFEN.plaetze.find((q) => q.id === id);
      const breite = Math.max(2.2, Math.min(4, (platz?.breite ?? 5) * U * 0.95));
      s.position.set(w.x, 1.2 + breite / 2, w.z);
      s.scale.setScalar(breite);
      s.userData.breite = breite;
      s.renderOrder = 20;
      s.userData.platz = id;
      s.userData.art = art;
      s.raycast = () => {};
      zeichenGruppe.add(s);
    }
  }
  // Weit herausgezoomt wären die Schilder winzig: mindestens MIN_PX Bildpunkte hoch
  const MIN_PX = 12;
  game.onTick?.(() => {
    if (!zeichenGruppe.children.length) return;
    const cam = game.camera?.camera;
    if (!cam?.isPerspectiveCamera) return;
    const h = game.camera?.screenH ?? innerHeight;
    const k = (2 * Math.tan((cam.fov * RAD) / 2)) / h;
    for (const s of zeichenGruppe.children) {
      const d = cam.position.distanceTo(s.position);
      s.scale.setScalar(Math.max(s.userData.breite, MIN_PX * d * k));
    }
  });
  function raeumeZeichen() {
    zeichenGruppe.clear();
    zeichenFuer = null;
  }
  game.on('ui:tow', (e) => { if (e?.boot != null) zeigeZeichen(e.boot); });
  game.on('ui:tow-end', raeumeZeichen);
  game.on('weather', raeumeZeichen);

  // --- Sätze für Bootskarte und Wetterbericht
  function kartenSatz(boot) {
    const r = rules(), state = game.sim?.state;
    if (!r?.wind || !state || !boot || !istStark(heute, r) || (state.stage ?? 1) < (r.wind.from ?? 1)) return null;
    const teile = [];
    if (lageZaehlt(state, heute, r)) teile.push(`Starkwind aus ${richtungsName(heute.richtung)}: Schild = geschützt (+${komma(r.wind.sheltered)}), Welle = unruhig (−${komma(r.wind.exposed)}).`);
    if (r.wind.sizes.includes(boot.size)) teile.push(`Windlinien = Wind von achtern, Anlegen dauert (−${komma(r.wind.tailwind)}).`);
    return teile.join(' ') || null;
  }
  function berichtSatz(wx) {
    const r = rules() ?? { wind: { strong: WIND.stark, exposed: WIND.unruhig, sheltered: WIND.geschuetzt } };
    if (!wx || wx.wind < (r.wind?.strong ?? WIND.stark) || stufe() < (WIND.abStufe ?? 1)) return null;
    return `Offene Plätze werden unruhig, geschützte Boxen bringen +${komma(WIND.geschuetzt)} Anker.`;
  }

  game.wind = {
    get heute() { return { ...heute }; },
    stark: () => istStark(heute, rules()),
    lage: (id) => { sichereLagen(); return lagen.get(id) ?? null; },
    lagen: () => new Map(sichereLagen()),
    bug: bugVon,
    zeichen: (bootId, id) => {
      const r = rules(), state = game.sim?.state;
      return r && state ? platzZeichen(state, r, heute, state.boats?.[bootId], id, lageVon, bugVon) : null;
    },
    get zeichenImBild() { return zeichenGruppe.children.map((s) => ({ platz: s.userData.platz, art: s.userData.art })); },
    kartenSatz,
    berichtSatz,
  };

  // --- Regeln einhängen, sobald game.sim da ist
  regelnBereit(game).then((api) => {
    const wx = game.events?.weather?.(api.state.day || 1);
    if (wx) setzeWetter(wx, api.state.day);
    let letzte = -1;
    api.addHook('tick', ({ state, ctx }) => {
      const sek = Math.floor(state.clock ?? 0) + (state.day ?? 0) * 100000;
      if (sek === letzte) return;
      letzte = sek;
      sichereLagen();
      windTick(state, ctx, heute, lageVon, bugVon);
    });
    api.addHook('score', ({ state, ctx, boat, berth }) => windScore(state, ctx, boat, berth, heute, lageVon, bugVon));
  }).catch(() => {});
}

export default init;
