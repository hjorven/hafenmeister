// Fotoaufträge und Postkarten im Spiel (Paket P43, Roadmap F22/L6, docs/fotoauftraege.md).
//
// Regeln: features/fotoauftraege-regeln.js (welcher Auftrag wann, Honorar, Postkarten im Spielstand).
// Dieses Modul verbindet sie mit dem Spiel:
//   Meldung    "Fotoauftrag: Sonnenuntergang" im Meldeplatz, mit "Zum Foto" (Fotomodus) und "Später";
//              abends und morgens eine Erinnerung, wenn das Licht für den Auftrag passt
//   Fotomodus  ein Knopf "Postkarte: ..." in der Leiste (game.foto.leiste) und oben ein schmaler Zettel mit
//              dem Auftrag und dem, was noch fehlt. Passt das Bild, wird der Knopf gold; ein Druck macht die
//              Postkarte, der Verlag zahlt (Tagesabschluss: Sonstiges, "Honorar für Postkarten").
//              Passt es nicht, holt der Knopf das Motiv ins Bild, wenn es eins gibt (wie P40 "Suchen").
//   Logbuch    Reiter "Postkarten": offene Aufträge, zwölf Fächer, Postkarte groß und "Postkarte sichern"
// Baut auf: Fotomodus (ui/fotomodus.js), seltene Besucher (P40, game.besucher), große Ankünfte (P47,
// 'besuch:einlaufen' und 'ankunft:angesagt'), Ereignisse (game.events.current), Logbuch-Reiter (P21).
// Keine eigene Kamerafahrt: "Suchen" nutzt camera.flyTo wie P40.
// Zum Ausprobieren: ?fotoauftrag=abendrot|morgen|anlegen|voller-steg|ganzer-hafen|winter|besucher|grossschiff|
// nebel|sommertag|regatta|fest (setzt den Auftrag sofort, das Motiv selbst muss im Spiel da sein).
// Schnittstelle: game.fotoauftraege = { offen(), pruefeBild(motiv?), aufnehmen(), setze(motiv), fortschritt(),
//   lage(), meldung(), suchen(motiv?) }. Ereignis 'postkarte:neu' { motiv, honorar, erstes, sonder }.

import * as R from './fotoauftraege-regeln.js';
import * as sim from '../sim.js';
import { regelnBereit } from './regeln-bereit.js';
import { MOTIVE, MOTIV_IDS, FEHLT } from '../data/fotoauftraege.js';
import { REVIERE } from '../data/regions.js';
import { hafenNameSauber, flaggeSauber, flaggeZeichnen, FLAGGE_B, FLAGGE_H } from '../data/hafenflagge.js';
import { VORRANG } from '../ui/meldungen.js';
import { uhrzeitAusUhr } from '../render/landschaft/zeit.js';
import { pixelBild, pixelSvg, PIXEL } from '../ui/pixel-symbole.js';

const MELDUNG_ID = 'fotoauftrag';
const SICHTBAR_S = 14;
const GOLD = '#ffd23f';
const BILD_W = 480;         // Postkarte im Spielstand (3:2)
const BILD_H = 320;
const DIENST_ARTEN = new Set(['kreuzfahrt', 'flottenbesuch', 'windjammer']);   // wie features/grosse-ankunft.js
const PLATZ_OHNE = new Set(['boje']);   // Bojenfeld zählt nicht als Steg

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const zeitText = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

const CSS = `
#hm-fotoauftrag { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(440px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-fotoauftrag:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-fotoauftrag[hidden], #hm-fotoauftrag.zurueck, body.building #hm-fotoauftrag, body.foto #hm-fotoauftrag,
body.card-open #hm-fotoauftrag { display: none !important; }
#hm-fotoauftrag > .hm-pixelbild { flex: none; margin-top: 2px; }
#hm-fotoauftrag .fa-text { flex: 1; min-width: 0; }
#hm-fotoauftrag strong { display: block; font-weight: 600; }
#hm-fotoauftrag .fa-satz { display: block; font-size: max(13px, .8125rem); }
#hm-fotoauftrag .fa-knoepfe { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#hm-fotoauftrag .fa-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 10px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-fotoauftrag .fa-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-fotoauftrag .fa-knoepfe .hm-primaer { flex: 1 1 auto; }
@media (max-height: 500px) {
  #hm-fotoauftrag { gap: 8px; padding: 6px 10px; line-height: 1.2; }
  #hm-fotoauftrag .fa-satz { font-size: 12px; }
  #hm-fotoauftrag .fa-knoepfe { margin-top: 4px; }
  #hm-fotoauftrag .fa-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
/* Zettel oben im Fotomodus: Auftrag und was fehlt, eine schmale Zeile, verdeckt das Bild kaum */
#hm-fa-zettel { position: absolute; z-index: 24; left: 50%; transform: translateX(-50%);
  top: calc(10px + env(safe-area-inset-top, 0px)); max-width: calc(100% - 24px); box-sizing: border-box;
  display: none; align-items: center; gap: 8px; padding: 5px 10px; pointer-events: none;
  color: var(--hm-tinte, #283648); font: 600 13px/1.25 var(--hm-text, system-ui); transition: opacity .4s; }
#hm-fa-zettel:not(.hm-px) { background: rgba(255, 252, 246, .9); border: 2px solid #283648; }
body.foto #hm-fa-zettel.da { display: flex; }
#hm-fa-zettel .hm-pixelbild { flex: none; width: 18px; height: 18px; }
#hm-fa-zettel .fa-z-zeilen { min-width: 0; }
#hm-fa-zettel .fa-z-zeile { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#hm-fa-zettel .fa-z-grund { font-weight: 400; font-size: 12px; }
#hm-fa-zettel.bereit { box-shadow: inset 0 0 0 3px ${GOLD}; }
#hm-fa-zettel.leise { opacity: .25; }
/* Passt das Bild, bleibt die Leiste deutlich zu sehen, auch wenn sie sonst nach 3 s fast verschwindet */
.hm-foto-leiste.leise:has(button.hm-fa-foto.bereit) { opacity: .9; }
.hm-foto-leiste button.hm-fa-foto.bereit { background: ${GOLD} !important; color: #24364a !important; }
.hm-foto-leiste button.hm-fa-foto.fertig { background: #9fd8a8 !important; color: #24364a !important; }
.hm-foto-leiste button.hm-fa-foto .fa-kurz { display: none; }
.hm-neu .hm-foto-leiste button.hm-fa-foto.bereit { border-image-source: var(--rahmen-gold); background: none !important; color: var(--hm-tinte, #24364a) !important; }
.hm-neu .hm-foto-leiste button.hm-fa-foto.fertig { border-image-source: var(--rahmen-meer); background: none !important; color: #fff !important; }
@media (max-width: 599px) {
  .hm-foto-leiste { left: 0; right: 0; transform: none; margin-inline: auto; width: fit-content; max-width: calc(100% - 16px);
    box-sizing: border-box; gap: 4px; padding: 6px; flex-wrap: wrap; justify-content: center; }
  .hm-foto-leiste button { padding: 0 8px; font-size: 13px; }
  .hm-foto-leiste button.hm-fa-foto .fa-lang { display: none; }
  .hm-foto-leiste button.hm-fa-foto .fa-kurz { display: inline; }
  #hm-fa-zettel { font-size: 12px; padding: 4px 8px; }
  #hm-fa-zettel .fa-z-grund { font-size: 11px; }
}
.hm-fa-blitz { position: absolute; inset: 0; z-index: 40; pointer-events: none; background: #fff; opacity: 0; transition: opacity .35s ease-out; }
.hm-fa-blitz.an { opacity: .85; transition: none; }
/* Die neue Postkarte springt kurz ins Bild und fliegt dann nach unten weg */
.hm-fa-pop { position: absolute; z-index: 41; left: 50%; top: 42%; width: min(300px, 70vw); pointer-events: none;
  transform: translate(-50%, -50%); animation: hm-fa-pop 2.9s ease-in-out forwards; }
.hm-fa-pop .hm-fa-geld { position: absolute; right: -6px; top: -14px; padding: 2px 8px; background: ${GOLD};
  color: #24364a; font: 700 16px/1.2 var(--hm-pixel, system-ui); box-shadow: 2px 2px 0 #24364a; }
@keyframes hm-fa-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.55) rotate(-8deg); }
  14% { opacity: 1; transform: translate(-50%, -50%) scale(1.04) rotate(-3deg); }
  20% { transform: translate(-50%, -50%) scale(1) rotate(-2deg); }
  72% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-2deg); }
  100% { opacity: 0; transform: translate(-50%, 70%) scale(.35) rotate(6deg); }
}
@media (prefers-reduced-motion: reduce) { .hm-fa-pop { animation-duration: 2.2s; } }
/* Postkarte (Pop, Logbuch): Bild mit weißem Rand, Briefmarke, Gruß */
.hm-fa-karte { position: relative; display: block; background: #fbf6ea; padding: 6% 6% 0; box-shadow: 0 0 0 2px #24364a, 4px 4px 0 2px rgba(36,54,74,.3); }
.hm-fa-karte img { display: block; width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; background: #a8d4e0; image-rendering: auto; }
.hm-fa-karte .hm-fa-gruss { display: flex; flex-direction: column; gap: 1px; padding: 4px 0 6px;
  font: 400 13px/1.2 var(--hm-pixel, system-ui); color: #24364a; }
.hm-fa-karte .hm-fa-gruss b { font-weight: 400; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hm-fa-karte .hm-fa-gruss span { font-size: 12px; color: #5a6a7c; }
.hm-fa-karte .hm-fa-marke { position: absolute; right: 3%; top: 2%; width: 13%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  background: #fffcf6; border: 2px dashed #c4513f; }
.hm-fa-karte .hm-fa-marke .hm-pixelbild { width: 70%; height: 70%; color: #c4513f; }
/* Reiter "Postkarten" im Logbuch */
.hm-fa-reiter .hm-fa-auftraege { display: grid; gap: 6px; margin: 0 0 10px; }
.hm-fa-reiter .hm-fa-auftrag { display: flex; gap: 8px; align-items: center; padding: 8px; background: var(--hm-mulde, #e9dfca); }
.hm-fa-reiter .hm-fa-auftrag.sonder { box-shadow: inset 0 0 0 2px ${GOLD}; }
.hm-fa-reiter .hm-fa-auftrag .hm-pixelbild { flex: none; }
.hm-fa-reiter .hm-fa-auftrag div { flex: 1; min-width: 0; }
.hm-fa-reiter .hm-fa-auftrag b { display: block; }
.hm-fa-reiter .hm-fa-auftrag small { display: block; color: var(--hm-tinte-2, #5a6a7c); }
.hm-fa-reiter .hm-fa-auftrag button { flex: none; min-height: 40px; padding: 0 10px; cursor: pointer; font: 600 14px var(--hm-text, inherit); }
.hm-fa-reiter .hm-lb-karte .hm-fa-karte { margin: 4px 4px 6px; padding: 5% 5% 0; }
.hm-fa-reiter .hm-lb-karte .hm-fa-karte .hm-fa-gruss { display: none; }
.hm-fa-reiter .hm-lb-karte .hm-fa-leer { display: flex; align-items: center; justify-content: center; aspect-ratio: 3 / 2; margin: 4px 4px 6px;
  border: 2px dashed #9a8f78; color: #9a8f78; }
.hm-fa-reiter .hm-lb-karte .hm-fa-leer .hm-pixelbild { width: 28px; height: 28px; opacity: .7; }
.hm-fa-reiter .hm-fa-gross { max-width: 420px; margin: 10px auto 6px; }
.hm-fa-reiter .hm-fa-sichern { min-height: 44px; padding: 0 14px; cursor: pointer; font: 600 15px var(--hm-text, inherit); }
.hm-fa-reiter .hm-bs-fakten, .hm-fa-reiter .hm-fa-fakten { margin: 8px 0 0; padding: 6px 8px; background: var(--hm-mulde, #e9dfca); }
`;

export function init(game) {
  if (typeof document === 'undefined') return;
  start(game).catch((e) => console.error('Fotoaufträge (P43):', e));
}

async function start(game) {
  const simApi = await regelnBereit(game);
  const st = () => simApi.state;
  const ctx = () => simApi.ctx;
  if (st()) R.saeubern(st());

  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;

  const box = document.createElement('div');
  box.id = 'hm-fotoauftrag';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-fotoauftrag', MELDUNG_ID);

  const zettel = document.createElement('div');
  zettel.id = 'hm-fa-zettel';
  zettel.className = 'hm-px';
  zettel.setAttribute('aria-live', 'polite');
  host.append(zettel);

  const blitz = document.createElement('div');
  blitz.className = 'hm-fa-blitz';
  host.append(blitz);

  // ------------------------------------------------------------------ Lage des Tages
  const grossschiffe = new Map();   // id -> { gruppe, laenge, art, tag }
  game.on('besuch:einlaufen', (b) => {
    if (!b?.gruppe || !DIENST_ARTEN.has(b.art)) return;
    grossschiffe.set(b.id ?? b.gruppe.uuid, { gruppe: b.gruppe, laenge: b.laenge ?? 60, art: b.art, tag: st()?.day });
    pruefeTag();
  });

  function ereignisHeute() {
    const c = game.events?.current;
    const tag = st()?.day;
    if (!c || tag == null) return null;
    if (Number.isInteger(c.startDay) && tag < c.startDay) return null;
    if (Number.isInteger(c.endDay) && tag > c.endDay) return null;
    return c.id ?? null;
  }
  const besucherSchiffe = () => (game.besucher?.motive?.() ?? []).filter((m) => m.boatId != null);
  function besucherHeute() {
    if (besucherSchiffe().length) return true;
    const h = game.besucher?.heute?.();
    return !!h && h.tag === st()?.day && h.phase !== 'verpasst' && h.phase !== 'weg';
  }
  function grossschiffDa() {
    for (const g of grossschiffe.values()) if (g.tag === st()?.day && g.gruppe.visible !== false && g.gruppe.parent) return true;
    return false;
  }
  function lage() {
    const s = st();
    return R.lageAus(s, { ereignis: ereignisHeute(), besucher: besucherHeute(), grossschiff: grossschiffDa() });
  }

  // ------------------------------------------------------------------ Bild prüfen
  const T = () => game.THREE;
  const cam = () => game.camera;
  function bildMasse() {
    return { W: cam()?.screenW ?? innerWidth, H: cam()?.screenH ?? innerHeight };
  }
  /** Punkt im Bild: { nx, ny } (-1..1) oder null, wenn hinter der Kamera */
  function proj(x, y, z) {
    const c = cam()?.camera;
    if (!T() || !c) return null;
    c.updateMatrixWorld?.();
    const p = new (T().Vector3)(x, y, z).project(c);
    if (p.z > 1 || p.z < -1) return null;
    return { nx: p.x, ny: p.y };
  }
  const imBildPunkt = (p, rand = 0) => !!p && Math.abs(p.nx) <= 1 - rand && Math.abs(p.ny) <= 1 - rand;
  /** Kreis (Motiv) im Bild: ok, wenn innen ohne Rand und groß genug. */
  function kreis(x, z, r, y = 1) {
    const c = cam()?.camera;
    const p = proj(x, y, z);
    if (!p || !c) return { ok: false, grund: 'fehlt' };
    const rechts = new (T().Vector3)().setFromMatrixColumn(c.matrixWorld, 0);
    const q = new (T().Vector3)(x, y, z).addScaledVector(rechts, r).project(c);
    const { W, H } = bildMasse();
    const rad = Math.hypot(((q.x - p.nx) * W) / 2, ((q.y - p.ny) * H) / 2);
    const f = R.FA.foto;
    const drin = imBildPunkt(p, 2 * f.rand);
    const genug = (2 * rad) / Math.min(W, H) >= f.mindestGroesse;
    return { ok: drin && genug, grund: !drin ? (imBildPunkt(p) ? 'rand' : 'fehlt') : !genug ? 'klein' : null, p, rad };
  }

  /** Sichtbare Boote im Bild (Anzahl), aus der 3D-Ansicht */
  function booteImBild() {
    let n = 0;
    for (const b of game.boatView?.boote ?? []) {
      const a = b.anim;
      if (!a || a.model?.visible === false) continue;
      if (imBildPunkt(proj(a.x, 0.5, a.z), 0.02)) n++;
    }
    return n;
  }
  function stunde() {
    const s = st();
    const r = ctx()?.rules;
    if (!s || !r) return 12;
    return uhrzeitAusUhr(s.clock ?? 0, r.dayLength ?? 270, r.eveningLength ?? 30);
  }
  function plaetze() {
    const s = st();
    if (!s || !ctx()) return [];
    return sim.availableBerths(s, ctx()).filter((b) => !PLATZ_OHNE.has(b.kind));
  }
  const platzPos = (id) => { const p = game.stege?.platz?.(id); return p && Number.isFinite(p.x) ? p : null; };

  function volleStege() {
    const s = st();
    const gruppen = new Map();
    for (const b of plaetze()) {
      if (!b.jetty) continue;
      if (!gruppen.has(b.jetty)) gruppen.set(b.jetty, []);
      gruppen.get(b.jetty).push(b);
    }
    const out = [];
    for (const [steg, liste] of gruppen) {
      if (liste.length < R.FA.vollerSteg.mindestPlaetze) continue;
      if (!liste.every((b) => sim.berthState(s, ctx(), b.id) === 'belegt')) continue;
      const pos = liste.map((b) => platzPos(b.id)).filter(Boolean);
      if (pos.length < liste.length) continue;
      const x = pos.reduce((a, p) => a + p.x, 0) / pos.length;
      const z = pos.reduce((a, p) => a + p.z, 0) / pos.length;
      out.push({ steg, pos, x, z });
    }
    return out;
  }
  function andocker() {
    const out = [];
    const max = R.FA.anlegen.abstand;
    for (const b of game.boatView?.boote ?? []) {
      const a = b.anim;
      if (!a || a.state !== 'docking' || a.moored || !a.berth || a.model?.visible === false) continue;
      if (a.berth.kind === 'buoy' || a.berth.kind === 'boje') continue;
      const d = Math.hypot(a.x - a.berth.x, a.z - a.berth.z);
      if (d > max) continue;
      out.push({ a, d });
    }
    return out.sort((p, q) => p.d - q.d);
  }
  function tonnen() {
    const g = game.scene?.getObjectByName?.('regattabahn');
    return g ? g.children.map((c) => ({ x: c.position.x, z: c.position.z })) : [];
  }

  /**
   * Passt das Bild gerade für dieses Motiv? { ok, grund, ziel?: { x, z, nah, ganz } }
   * grund: Schlüssel aus FEHLT. ziel: wohin "Suchen" die Kamera bringt.
   */
  function pruefeBild(motiv) {
    const s = st();
    if (!s) return { ok: false, grund: 'fehlt' };
    const F = R.FA;
    const boote = () => booteImBild();
    switch (motiv) {
      case 'abendrot':
      case 'morgen': {
        if (!R.zeitPasst(motiv, stunde())) return { ok: false, grund: 'zeit' };
        return boote() >= F.mindestBoote ? { ok: true } : { ok: false, grund: 'boote', ziel: { ganz: true } };
      }
      case 'anlegen': {
        const liste = andocker();
        if (!liste.length) return { ok: false, grund: 'anlegen' };
        let best = null;
        for (const { a } of liste) {
          const k = kreis(a.x, a.z, Math.max(3, (a.info?.length ?? 8) / 2));
          if (k.ok) return { ok: true };
          best ||= { k, a };
        }
        return { ok: false, grund: best.k.grund === 'fehlt' ? 'rand' : best.k.grund, ziel: { x: best.a.x, z: best.a.z, nah: (best.a.info?.length ?? 8) / 2 } };
      }
      case 'voller-steg': {
        const stege = volleStege();
        if (!stege.length) return { ok: false, grund: 'steg' };
        const { W, H } = bildMasse();
        let erstes = null;
        for (const g of stege) {
          const ps = g.pos.map((p) => proj(p.x, 0.5, p.z));
          const alle = ps.every((p) => imBildPunkt(p, 0.03));
          if (alle) {
            const xs = ps.map((p) => (p.nx * W) / 2), ys = ps.map((p) => (p.ny * H) / 2);
            const ausdehnung = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
            if (ausdehnung >= 0.2 * Math.min(W, H)) return { ok: true };
            erstes ||= { g, grund: 'klein' };
          }
          erstes ||= { g, grund: 'steg' };
        }
        return { ok: false, grund: erstes.grund, ziel: { x: erstes.g.x, z: erstes.g.z } };
      }
      case 'ganzer-hafen':
      case 'winter': {
        const liste = plaetze().map((b) => platzPos(b.id)).filter(Boolean);
        if (motiv === 'winter' && !R.moeglich('winter', lage())) return { ok: false, grund: 'vorbei' };
        if (!liste.length) return { ok: false, grund: 'hafen', ziel: { ganz: true } };
        const drin = liste.filter((p) => imBildPunkt(proj(p.x, 0.5, p.z), 0.01)).length;
        const soll = motiv === 'winter' ? 0.6 : F.ganzerHafen.anteil;
        if (drin / liste.length < soll) return { ok: false, grund: 'hafen', ziel: { ganz: true } };
        if (motiv === 'ganzer-hafen') {
          const liegen = Object.values(s.boats || {}).filter((b) => b?.status === 'moored').length;
          if (liegen < F.ganzerHafen.mindestBoote) return { ok: false, grund: 'boote' };
        }
        return { ok: true };
      }
      case 'besucher': {
        const schiffe = besucherSchiffe();
        if (!schiffe.length) return { ok: false, grund: 'fehlt' };
        // Eigener Rand (nicht unter Zettel und Leiste), dazu muss P40 das Schiff auch als Logbuch-Foto gelten lassen
        let erstes = null;
        for (const m of schiffe) {
          const k = kreis(m.x, m.z, m.r, m.y ?? 1.5);
          if (k.ok && game.besucher.imBild(m.art)?.ok) return { ok: true, besucher: m.art };
          erstes ||= { m, k };
        }
        const { m, k } = erstes;
        return { ok: false, grund: k.grund === 'klein' ? 'klein' : 'rand', ziel: { x: m.x, z: m.z, nah: m.r } };
      }
      case 'grossschiff': {
        let erstes = null;
        for (const g of grossschiffe.values()) {
          if (g.tag !== s.day || g.gruppe.visible === false || !g.gruppe.parent) continue;
          const p = g.gruppe.position;
          const k = kreis(p.x, p.z, g.laenge / 2, 4);
          if (k.ok) return { ok: true };
          erstes ||= { p, g, k };
        }
        if (!erstes) return { ok: false, grund: 'fehlt' };
        return { ok: false, grund: erstes.k.grund === 'fehlt' ? 'rand' : erstes.k.grund, ziel: { x: erstes.p.x, z: erstes.p.z, nah: erstes.g.laenge / 2 } };
      }
      case 'regatta': {
        if (ereignisHeute() !== 'regatta') return { ok: false, grund: 'vorbei' };
        const t = tonnen();
        if (!t.length) return { ok: false, grund: 'tonnen' };
        const drin = t.filter((p) => imBildPunkt(proj(p.x, 1, p.z), 0.03)).length;
        const mx = t.reduce((a, p) => a + p.x, 0) / t.length, mz = t.reduce((a, p) => a + p.z, 0) / t.length;
        if (drin < 2) return { ok: false, grund: 'tonnen', ziel: { x: mx, z: mz } };
        return boote() >= 2 ? { ok: true } : { ok: false, grund: 'boote', ziel: { x: mx, z: mz } };
      }
      default: {
        // nebel, sommertag, fest: der besondere Tag und genug Boote im Bild
        const m = MOTIVE[motiv];
        if (!m?.ereignisse?.includes(ereignisHeute())) return { ok: false, grund: 'vorbei' };
        const soll = motiv === 'nebel' ? F.mindestBoote : F.mindestBoote + 1;
        return boote() >= soll ? { ok: true } : { ok: false, grund: 'boote', ziel: { ganz: true } };
      }
    }
  }

  /** Grund als Satz, mit Uhrzeit oder Zahl, wo es hilft */
  function grundText(motiv, g) {
    if (g === 'zeit') {
      const f = motiv === 'abendrot' ? R.FA.abend : R.FA.morgen;
      return `${FEHLT.zeit}: ${zeitText(f[0])} bis ${zeitText(f[1])} Uhr`;
    }
    if (g === 'boote') {
      const n = motiv === 'ganzer-hafen' ? `${R.FA.ganzerHafen.mindestBoote} Boote im Hafen` : motiv === 'regatta' ? '2 Boote' : `${['sommertag', 'fest'].includes(motiv) ? R.FA.mindestBoote + 1 : R.FA.mindestBoote} Boote`;
      return motiv === 'ganzer-hafen' ? `Zu wenige Boote: mindestens ${n}` : `${FEHLT.boote}: mindestens ${n}`;
    }
    return FEHLT[g] ?? FEHLT.fehlt;
  }

  // ------------------------------------------------------------------ Auftrag im Fotomodus
  function bestesJetzt() {
    const s = st();
    if (!s) return null;
    const liste = R.offen(s);
    if (!liste.length) return null;
    const mit = liste.map((a) => ({ a, b: pruefeBild(a.motiv) }));
    return mit.find((x) => x.b.ok) ?? mit[0];
  }

  let knopf = null;
  let fertigBis = 0;
  function knopfBauen() {
    if (knopf || !game.foto?.leiste) return;
    knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'hm-fa-foto';
    knopf.hidden = true;
    knopf.addEventListener('click', (e) => { e.stopPropagation(); druecken(); });
    game.foto.leiste.insertBefore(knopf, game.foto.leiste.firstChild);
  }
  knopfBauen();
  game.on('foto:an', () => { knopfBauen(); zeichneFoto(true); });
  game.on('foto:aus', () => { zettel.classList.remove('da'); });

  let zettelSig = '';
  function zeichneFoto(erzwingen = false) {
    if (!knopf) return;
    const aktiv = !!game.foto?.aktiv && !game.hafenSchauen?.aktiv;
    const x = aktiv ? bestesJetzt() : null;
    knopf.hidden = !x;
    zettel.classList.toggle('da', !!x);
    if (!x) return;
    const t = MOTIVE[x.a.motiv];
    // Zettel
    const zeile1 = `${x.a.sonder ? 'Sonderauftrag' : 'Fotoauftrag'}: ${t.titel} · ${euro(x.a.honorar)}`;
    const zeile2 = x.b.ok ? 'Passt! Goldener Knopf macht die Postkarte.' : grundText(x.a.motiv, x.b.grund);
    const sig = `${zeile1}|${zeile2}|${x.b.ok}`;
    if (erzwingen || sig !== zettelSig) {
      zettelSig = sig;
      const zeilen = document.createElement('span');
      zeilen.className = 'fa-z-zeilen';
      const a = document.createElement('span');
      a.className = 'fa-z-zeile';
      a.textContent = zeile1;
      const b = document.createElement('span');
      b.className = 'fa-z-zeile fa-z-grund';
      b.textContent = zeile2;
      zeilen.append(a, b);
      zettel.replaceChildren(pixelBild('foto', 18), zeilen);
      zettel.classList.toggle('bereit', x.b.ok);
    }
    zettel.classList.toggle('leise', !!game.foto?.leiste?.classList.contains('leise') && !x.b.ok);
    if (performance.now() < fertigBis) return;
    knopf.classList.remove('fertig');
    knopf.classList.toggle('bereit', x.b.ok);
    const lang = x.b.ok ? `Postkarte: ${t.titel}` : x.b.ziel ? `${t.titel} suchen` : `Postkarte: ${t.titel}`;
    const kurz = x.b.ok ? 'Postkarte' : x.b.ziel ? 'Suchen' : 'Auftrag';
    if (knopf.dataset.text !== lang) {
      knopf.dataset.text = lang;
      const l = document.createElement('span');
      l.className = 'fa-lang';
      l.textContent = lang;
      const k = document.createElement('span');
      k.className = 'fa-kurz';
      k.textContent = kurz;
      knopf.replaceChildren(l, k);
      knopf.setAttribute('aria-label', x.b.ok ? `Postkarte aufnehmen: ${t.titel}` : `${t.titel}: ${grundText(x.a.motiv, x.b.grund)}`);
    }
  }

  function druecken() {
    const x = bestesJetzt();
    if (!x) return;
    if (x.b.ok) { aufnehmen(); return; }
    if (suchen(x.a.motiv, x.b)) return;
    // Nichts zu suchen (Uhrzeit, kein Boot legt an): der Zettel blinkt kurz
    zettel.animate?.([{ transform: 'translateX(-50%) scale(1.06)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 260 });
    game.audio?.sfx?.('klick');
  }

  /** Kamera zum Motiv (ohne eigene Kamerafahrt: camera.flyTo wie P40). true, wenn es ein Ziel gab. */
  function suchen(motiv, b = null) {
    const r = b ?? pruefeBild(motiv);
    const z = r?.ziel;
    const c = cam();
    if (!z || !c) return false;
    if (z.ganz) { c.reset?.(); return true; }
    if (!c.flyTo) return false;
    c.flyTo(z.x, z.z);
    if (z.nah && c.zoomAt && c.viewWidth > 0) {
      const { W, H } = bildMasse();
      const breite = Math.max(40, (2 * z.nah * W) / (0.2 * Math.min(W, H)));
      if (c.viewWidth > breite) c.zoomAt(c.viewWidth / breite);
    } else if (motiv === 'voller-steg' && c.viewWidth < 90 && c.zoomAt) {
      c.zoomAt(c.viewWidth / 110);
    }
    return true;
  }

  /** Postkarte (480 x 320 JPEG) aus der Mitte des Bilds, direkt nach dem Rendern. */
  function postkartenBild() {
    try {
      game.renderer.render(game.scene, game.camera.camera);
      const c = game.canvas;
      let w = c.width, h = (c.width * BILD_H) / BILD_W;
      if (h > c.height) { h = c.height; w = (h * BILD_W) / BILD_H; }
      const o = document.createElement('canvas');
      o.width = BILD_W;
      o.height = BILD_H;
      o.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, BILD_W, BILD_H);
      for (const q of [0.72, 0.6, 0.48]) {
        const url = o.toDataURL('image/jpeg', q);
        if (url.startsWith('data:image/') && url.length < R.BILD_MAX) return url;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Postkarte für den Auftrag, dessen Motiv gerade passt. Gibt das Ergebnis der Regeln oder null zurück. */
  function aufnehmen() {
    const s = st();
    if (!s) return null;
    const x = bestesJetzt();
    if (!x?.b.ok) return null;
    const bild = postkartenBild();
    const r = R.erfuellen(s, x.a.motiv, bild);
    if (!r) return null;
    game.sim?.addIncome?.(r.honorar, 'sonstiges', 'postkarte');
    blitz.classList.add('an');
    requestAnimationFrame(() => requestAnimationFrame(() => blitz.classList.remove('an')));
    if (navigator.vibrate) navigator.vibrate(15);
    game.emit('foto:bild');
    game.audio?.sfx?.('muenze', { volume: 0.6 });
    if (r.erstes) game.audio?.sfx?.('erfolg');
    // Besucher-Motiv: das Foto kommt auch in den Reiter "Besucher" (P40), ein Druck genügt
    if (x.b.besucher && game.besucher?.fotografiere) { try { game.besucher.fotografiere(); } catch {} }
    zeigePop(x.a.motiv, bild, r.honorar);
    const t = MOTIVE[x.a.motiv];
    game.logbuch?.merken?.({ a: 'text', art: 'postkarte', text: r.erstes ? `Neue Postkarte: ${t.titel}` : `Nachdruck der Postkarte ${t.titel}` });
    if (knopf) {
      knopf.classList.remove('bereit');
      knopf.classList.add('fertig');
      knopf.textContent = `+${euro(r.honorar)}`;
      knopf.dataset.text = '';
      fertigBis = performance.now() + 1800;
    }
    if (aktuell && aktuell.motiv === x.a.motiv) fertig();
    game.emit('postkarte:neu', r);
    game.logbuch?.neuZeichnen?.();
    return r;
  }

  // ------------------------------------------------------------------ Postkarte als Bild (Pop, Logbuch, Sichern)
  function hafenName() {
    const s = st();
    // Eigener Hafenname (P44): steht als harborName im Spielstand, immer durch hafenNameSauber (Audit C05)
    const eigen = hafenNameSauber(s?.harborName, '');
    if (eigen) return eigen;
    return REVIERE[s?.region]?.hafenname ?? REVIERE.ostsee.hafenname;
  }
  function karteEl(motiv, bild, { mitGruss = true } = {}) {
    const t = MOTIVE[motiv];
    const k = document.createElement('span');
    k.className = 'hm-fa-karte';
    const img = document.createElement('img');
    img.alt = t.titel;
    img.width = BILD_W;
    img.height = BILD_H;
    if (bild) img.src = bild;
    const marke = document.createElement('span');
    marke.className = 'hm-fa-marke';
    marke.append(pixelBild(t.sym ?? 'foto', 24));
    k.append(img, marke);
    if (mitGruss) {
      const g = document.createElement('span');
      g.className = 'hm-fa-gruss';
      const b = document.createElement('b');
      b.textContent = `Grüße aus ${hafenName()}`;
      const sp = document.createElement('span');
      sp.textContent = t.titel;
      g.append(b, sp);
      k.append(g);
    }
    return k;
  }
  let pop = null;
  function zeigePop(motiv, bild, honorar) {
    pop?.remove();
    pop = document.createElement('div');
    pop.className = 'hm-fa-pop';
    pop.setAttribute('aria-hidden', 'true');
    const geld = document.createElement('span');
    geld.className = 'hm-fa-geld';
    geld.textContent = `+${euro(honorar)}`;
    pop.append(karteEl(motiv, bild), geld);
    host.append(pop);
    const p = pop;
    setTimeout(() => { p.remove(); if (pop === p) pop = null; }, 3000);
  }

  async function sichern(motiv) {
    const k = R.faState(st()).karten[motiv];
    if (!k?.bild) return false;
    const t = MOTIVE[motiv];
    const img = await new Promise((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = k.bild; });
    try { await document.fonts?.load?.('20px "Pixelify Sans"'); } catch {}
    const W = 1000, pad = 36, bw = W - 2 * pad, bh = (bw * BILD_H) / BILD_W, H = pad + bh + 84;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fbf6ea';
    g.fillRect(0, 0, W, H);
    g.drawImage(img, pad, pad, bw, bh);
    g.strokeStyle = '#24364a';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    // Briefmarke oben rechts
    const m = 92, mx = W - pad - m - 14, my = pad + 14;
    g.fillStyle = '#fffcf6';
    g.fillRect(mx, my, m, m);
    g.setLineDash([8, 6]);
    g.strokeStyle = '#c4513f';
    g.strokeRect(mx, my, m, m);
    g.setLineDash([]);
    const raster = PIXEL[t.sym] ?? PIXEL.foto;
    if (raster) {
      const svg = pixelSvg(raster).replace(/fill="[^"]*"/g, (f) => (f === 'fill="none"' ? f : 'fill="#c4513f"'));
      const sym = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; });
      if (sym) { g.imageSmoothingEnabled = false; g.drawImage(sym, mx + 14, my + 14, m - 28, m - 28); }
    }
    g.fillStyle = '#24364a';
    g.textBaseline = 'middle';
    g.font = '40px "Pixelify Sans", system-ui, sans-serif';
    // Eigene Hafenflagge (P44) vor dem Gruß
    let gx = pad;
    if (st()?.flagge) {
      const fm = 3;
      flaggeZeichnen(g, flaggeSauber(st().flagge, st().seed ?? 0), { x: pad, y: pad + bh + 42 - (FLAGGE_H * fm) / 2, massstab: fm });
      g.strokeStyle = '#24364a';
      g.lineWidth = 2;
      g.strokeRect(pad - 1, pad + bh + 42 - (FLAGGE_H * fm) / 2 - 1, FLAGGE_B * fm + 2, FLAGGE_H * fm + 2);
      gx = pad + FLAGGE_B * fm + 18;
    }
    g.fillStyle = '#24364a';
    g.fillText(`Grüße aus ${hafenName()}`, gx, pad + bh + 42, bw * 0.68 - (gx - pad));
    g.font = '26px "Pixelify Sans", system-ui, sans-serif';
    g.fillStyle = '#5a6a7c';
    g.textAlign = 'right';
    g.fillText(t.titel, W - pad, pad + bh + 44, bw * 0.3);
    const url = c.toDataURL('image/jpeg', 0.9);
    const name = `postkarte-${motiv}-tag-${k.tag ?? 0}.jpg`;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], name, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; }
      } catch (err) {
        if (err && err.name === 'AbortError') return false;
      }
    }
    const a = document.createElement('a');
    a.download = name;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  // ------------------------------------------------------------------ Meldungen
  const schlange = [];
  let aktuell = null;     // { typ: 'neu' | 'erinnerung', motiv, sonder, sichtbar }
  let gewuenscht = false;
  const gemeldet = new Set();   // Tag:typ:motiv (nicht im Spielstand)

  function melde(m) {
    const key = `${st()?.day}:${m.typ}:${m.motiv}`;
    if (gemeldet.has(key)) return;
    gemeldet.add(key);
    schlange.push({ ...m, sichtbar: 0 });
  }
  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch(MELDUNG_ID, VORRANG.fotoauftrag ?? 26);
    else game.meldungen?.fertig(MELDUNG_ID);
  }
  const knopfEl = (text, primaer, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hm-knopf hm-px${primaer ? ' hm-primaer' : ''}`;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };
  function zumFoto(motiv) {
    fertig();
    game.foto?.an?.();
    const b = pruefeBild(motiv);
    if (!b.ok) suchen(motiv, b);
    setTimeout(() => zeichneFoto(true), 50);
  }
  function zeichneMeldung() {
    const m = aktuell;
    const s = st();
    const a = s ? R.offen(s).find((x) => x.motiv === m.motiv) : null;
    if (!a) return false;
    const t = MOTIVE[m.motiv];
    const titel = document.createElement('strong');
    const satz = document.createElement('span');
    satz.className = 'fa-satz';
    if (m.typ === 'erinnerung') {
      titel.textContent = m.motiv === 'abendrot' ? 'Die Sonne geht unter' : 'Guten Morgen im Hafen';
      satz.textContent = `Jetzt passt das Licht für den Fotoauftrag „${t.titel}“ (${euro(a.honorar)}).`;
    } else {
      titel.textContent = `${a.sonder ? 'Sonderauftrag' : 'Fotoauftrag'}: ${t.titel}`;
      const frist = a.sonder ? 'Nur heute.' : a.bis > s.day ? `Bis Tag ${a.bis}.` : 'Nur heute.';
      satz.textContent = `Der Postkartenverlag wünscht sich: ${t.auftrag} ${euro(a.honorar)} Honorar. ${frist}`;
    }
    const knoepfe = document.createElement('div');
    knoepfe.className = 'fa-knoepfe';
    knoepfe.append(knopfEl('Zum Foto', true, () => zumFoto(m.motiv)), knopfEl('Später', false, fertig));
    const text = document.createElement('div');
    text.className = 'fa-text';
    text.append(titel, satz, knoepfe);
    box.replaceChildren(pixelBild('foto', 24), text);
    return true;
  }
  function fertig() {
    aktuell = null;
    box.hidden = true;
    box.replaceChildren();
    wuensche(false);
    naechste();
  }
  function naechste() {
    while (!aktuell && schlange.length) {
      aktuell = schlange.shift();
      if (!zeichneMeldung()) aktuell = null;
    }
    if (!aktuell) return;
    box.hidden = false;
    wuensche(true);
  }

  // ------------------------------------------------------------------ Takt
  let letzterTagErinnert = { abendrot: null, morgen: null };
  function pruefeTag() {
    const s = st();
    if (!s || s.phase !== 'day') return;
    // Tag 1 gehört dem Einstieg (FA.abTag); die Meldung wartet im Meldeplatz hinter Einstieg und Tipps
    for (const e of R.pruefen(s, lage())) {
      if (e.typ === 'neu') melde({ typ: 'neu', motiv: e.motiv, sonder: e.sonder });
      game.emit('fotoauftrag:' + e.typ, e);
    }
  }
  let letzte = performance.now();
  function takt() {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    const s = st();
    if (!s) return;
    pruefeTag();
    // Erinnerung, wenn das Licht passt (einmal am Tag, nur wenn der Auftrag offen ist)
    if (s.phase === 'day' || s.phase === 'evening') {
      const h = stunde();
      for (const motiv of ['abendrot', 'morgen']) {
        if (letzterTagErinnert[motiv] === s.day) continue;
        if (!R.offen(s).some((a) => a.motiv === motiv) || !R.zeitPasst(motiv, h)) continue;
        letzterTagErinnert[motiv] = s.day;
        melde({ typ: 'erinnerung', motiv });
      }
    }
    if (game.foto?.aktiv) zeichneFoto();
    if (aktuell && !R.offen(s).some((a) => a.motiv === aktuell.motiv)) fertig();
    if (!aktuell) naechste();
    if (!aktuell) return;
    const darf = game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
    box.classList.toggle('zurueck', !darf);
    const cl = document.body.classList;
    if (!darf || cl.contains('card-open') || cl.contains('building') || cl.contains('foto')) return;
    aktuell.sichtbar += dt;
    if (aktuell.sichtbar >= SICHTBAR_S) fertig();
  }
  setInterval(takt, 250);
  game.on('meldungen:wechsel', () => { if (aktuell) box.classList.toggle('zurueck', !game.meldungen.darf(MELDUNG_ID)); });
  game.on('sim:change', (d) => {
    if ((d?.reason === 'load' || d?.reason === 'new') && st()) {
      R.saeubern(st());
      gemeldet.clear();
      schlange.length = 0;
      grossschiffe.clear();
      letzterTagErinnert = { abendrot: null, morgen: null };
      if (aktuell) fertig();
    }
  });
  game.on('ankunft:angesagt', () => pruefeTag());

  // ------------------------------------------------------------------ Reiter "Postkarten" im Logbuch
  let steckbrief = null;
  function teil(s, opt = {}) {
    const el = opt.el;
    const zeichneNeu = () => (opt.zeichne ? opt.zeichne() : game.logbuch?.neuZeichnen?.());
    const f = R.faState(s);
    const wrap = el('div', { class: 'hm-fa-reiter' });
    if (steckbrief && f.karten[steckbrief]) {
      const k = f.karten[steckbrief];
      const t = MOTIVE[steckbrief];
      const motiv = steckbrief;
      const knopfS = el('button', { type: 'button', class: 'hm-fa-sichern hm-knopf hm-px', onclick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try { await sichern(motiv); } finally { b.disabled = false; }
      } }, 'Postkarte sichern');
      wrap.append(
        el('div', { class: 'hm-lb-sb-leiste' },
          el('button', { type: 'button', class: 'hm-lb-zurueck', onclick: () => { steckbrief = null; zeichneNeu(); } }, 'Alle Postkarten')),
        el('div', { class: 'hm-fa-gross' }, karteEl(motiv, k.bild)),
        el('h3', {}, t.titel),
        el('p', { class: 'hm-fa-fakten' }, `Aufgenommen an Tag ${k.tag ?? '?'}${k.stufe ? `, Ausbaustufe ${k.stufe}` : ''}.${k.mal > 1 ? ` ${k.mal}-mal gedruckt.` : ''} ${t.hinweis}`),
        k.bild ? knopfS : null);
      return [wrap];
    }
    steckbrief = null;
    const fo = R.fortschritt(s);
    wrap.append(el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' }, el('b', {}, `${fo.karten} von ${fo.gesamt}`), el('span', {}, ` Postkarten · ${euro(fo.summe)} Honorar`)),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(fo.gesamt), 'aria-valuenow': String(fo.karten), 'aria-label': 'Postkarten' },
        el('i', { style: `width: ${Math.round((fo.karten / fo.gesamt) * 1000) / 10}%` }))));
    const auftraege = el('div', { class: 'hm-fa-auftraege' });
    for (const a of R.offen(s)) {
      const t = MOTIVE[a.motiv];
      auftraege.append(el('div', { class: `hm-fa-auftrag${a.sonder ? ' sonder' : ''}` },
        pixelBild(t.sym ?? 'foto', 24),
        el('div', {}, el('b', {}, `${a.sonder ? 'Sonderauftrag' : 'Fotoauftrag'}: ${t.titel} · ${euro(a.honorar)}`),
          el('small', {}, `${t.hinweis} ${a.sonder || a.bis <= s.day ? 'Nur heute.' : `Bis Tag ${a.bis}.`}`)),
        el('button', { type: 'button', class: 'hm-knopf hm-px', onclick: () => { game.logbuch?.schliessen?.(); zumFoto(a.motiv); } }, 'Zum Foto')));
    }
    if (!auftraege.childElementCount) {
      auftraege.append(el('p', { class: 'hm-lb-klein' }, s.day < R.FA.abTag
        ? 'Ab dem zweiten Tag bestellt der Postkartenverlag Fotos vom Hafen.'
        : 'Gerade kein Auftrag. Der nächste kommt an einem der nächsten Morgen.'));
    }
    wrap.append(auftraege);
    const raster = el('ul', { class: 'hm-lb-raster' });
    const gesehen = [];
    for (const id of MOTIV_IDS) {
      const t = MOTIVE[id];
      const k = f.karten[id];
      const neu = f.neu.includes(id);
      if (neu) gesehen.push(id);
      const bild = k ? karteEl(id, k.bild, { mitGruss: false }) : el('span', { class: 'hm-fa-leer' }, pixelBild(t.sym ?? 'foto', 28));
      raster.append(el('li', {}, el('button', {
        type: 'button', class: `hm-lb-karte${k ? '' : ' fehlt'}${neu ? ' neu' : ''}`, 'data-postkarte': id, title: t.hinweis,
        onclick: () => { if (k) { steckbrief = id; zeichneNeu(); } },
      }, bild,
      el('span', { class: 'hm-lb-name' }, t.titel),
      el('span', { class: 'hm-lb-klein' }, k ? `Tag ${k.tag ?? '?'}` : t.art === 'sonder' ? 'Nur an besonderen Tagen' : t.nurWinter ? 'Nur im Winter' : 'Kommt als Auftrag'),
      neu ? el('span', { class: 'hm-lb-neu' }, 'neu') : null)));
    }
    wrap.append(raster, el('p', { class: 'hm-lb-klein' },
      'Der Postkartenverlag bestellt ab und zu ein Foto. Im Fotomodus (P) zeigt ein Zettel oben, was fehlt; passt das Bild, wird der Knopf gold.'));
    if (gesehen.length) setTimeout(() => { f.neu = f.neu.filter((m) => !gesehen.includes(m)); game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
    return [wrap];
  }
  function reiterAnmelden() {
    if (!game.logbuch?.reiter) return false;
    game.logbuch.reiter({ id: 'postkarten', name: 'Postkarten', teil, zahl: () => (st() ? R.faState(st()).neu.length : 0) });
    return true;
  }
  if (!reiterAnmelden()) game.on('ready', reiterAnmelden);

  // ------------------------------------------------------------------ Schnittstelle und Ausprobieren
  game.fotoauftraege = {
    offen: () => (st() ? R.offen(st()) : []),
    pruefeBild: (motiv) => pruefeBild(motiv ?? bestesJetzt()?.a.motiv),
    aufnehmen,
    setze: (motiv, opt) => {
      const s = st();
      if (!s) return null;
      const a = R.setze(s, motiv, opt);
      if (a) melde({ typ: 'neu', motiv, sonder: a.sonder });
      return a;
    },
    suchen: (motiv) => suchen(motiv ?? bestesJetzt()?.a.motiv),
    fortschritt: () => (st() ? R.fortschritt(st()) : null),
    lage,
    stunde,
    meldung: () => (aktuell ? { typ: aktuell.typ, motiv: aktuell.motiv } : null),
    sichern,
  };

  const wunsch = new URLSearchParams(location.search).get('fotoauftrag');
  if (wunsch && MOTIVE[wunsch]) {
    const t0 = Date.now();
    const versuch = setInterval(() => {
      const s = st();
      if (Date.now() - t0 > 20000) { clearInterval(versuch); return; }
      if (!s || s.phase !== 'day') return;
      clearInterval(versuch);
      game.fotoauftraege.setze(wunsch);
    }, 300);
  }
}

export default init;
