// Seltene Besucher im Spiel (Paket P40, Roadmap F16, docs/besucher.md).
//
// Regeln: features/besucher-regeln.js (welches Schiff wann kommt, Ehrenplatz, Schaulustige, Fotos).
// Grafik: render/boats/besucher.js (Schiffsmodelle), render/besucher-tiere.js (Schwäne, Schweinswal).
// Dieses Modul verbindet sie mit dem Spiel:
//   Meldung    morgens "Funk: Die Königsyacht meldet sich an" mit Ehrenplatz freihalten (wie P28), später
//              "liegt am Ehrenplatz" mit Ansehen und Foto, Tiere "Schwanenfamilie im Hafen" (Meldeplatz)
//   Foto       im Fotomodus (P) ein Knopf "Königsyacht ins Logbuch", sobald ein Motiv im Bild ist
//              (Rand und Mindestgröße aus ECONOMY.besucher.foto). Ein kleines Bild kommt ins Logbuch.
//   Logbuch    Reiter "Besucher": sechs Motive mit Foto, Bild des Modells oder Schattenriss mit Hinweis
//   Chronik    Zeilen in der Hafenchronik, Erfolge über 'besucher:neu' (features/erfolge-daten.js)
// Zum Ausprobieren: ?besucher=weltumsegler|museumsschiff|forschungsschiff|koenigsyacht|schwaene|schweinswal
// (mit ?stufe=N für die nötige Stufe).
// Schnittstelle: game.besucher = { zeige(bootId), heute(), ausloesen(art), motive(), fotografiere(), fortschritt() }.

import * as R from './besucher-regeln.js';
import { regelnBereit } from './regeln-bereit.js';
import { SCHIFF_TEXTE, TIER_TEXTE, MOTIVE, istTier, texteVon } from '../data/besucher.js';
import { MODELL_VON, TYPES } from '../data/boats/besucher.js';
import { init as modelleInit } from '../render/boats/besucher.js';
import { init as tiereInit } from '../render/besucher-tiere.js';
import { VORRANG } from '../ui/meldungen.js';
import { uhrzeitText } from '../ui/vorschau.js';
import { bildMaler, BILD } from '../ui/logbuch-bild.js';
import { pixelSvg, pixelBild } from '../ui/pixel-symbole.js';

const MELDUNG_ID = 'besucher';
const SICHTBAR_S = 22;        // so lange steht eine Meldung ohne Entscheidung (nur sichtbare Zeit zählt)
const KURZ_S = 7;             // Bestätigungen und kurze Meldungen
const GOLD = '#ffd23f';

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const GROESSE = Object.fromEntries(TYPES.map((t) => [t.id, t.size]));

/** "die Königsyacht „Nordstern“" */
function nennung(art, name, mitArtikel = true) {
  const t = texteVon(art);
  if (!t) return '';
  const n = name ? ` „${name}“` : '';
  return `${mitArtikel ? `${t.artikel} ` : ''}${t.titel}${n}`;
}

// Kleine Pixelbilder der Tiere für das Logbuch (28 x 14, Farben aus ui/pixel-symbole.js)
const TIER_RASTER = {
  schwaene: [
    '.................kkk........',
    '................kwwwk.......',
    '................kwwksk......',
    '................kwk.kk......',
    '................kwk.........',
    '...............kwwk.........',
    '......kkkk....kwwk..........',
    '....kkwwwwkkkkwwwk..........',
    '..kkwwwwwwwwwwwwwk...kk.....',
    '.kwwwwwwwwwwwwwwk...kcck....',
    '..kwwwwccwwwwwwk..kkcck.....',
    'WWWkkkkkkkkkkkkkWWkcccckWWWW',
    'WWWWWWWWWWWWWWWWWWWkkkkWWWWW',
    '..WWWW....WWWW......WWWW....',
  ],
  schweinswal: [
    '............................',
    '............................',
    '............k...............',
    '...........kSk..............',
    '..........kSSk..............',
    '.....kkkkkSSSSkkkkk.........',
    '...kkSSSSSSSSSSSSSSkk.......',
    '..kSSSSSSSSSSSSSSSSSSSk.....',
    '.kSSSSDDDDDDDDDSSSSSSSSk....',
    'WWkkkkkkkkkkkkkkkkkkkkkkWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    '..WW..WWWW....WWWW...WW.....',
    '............................',
    '............................',
  ],
};
const svgUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
function tierBild(art, schatten) {
  const r = TIER_RASTER[art];
  const zeilen = schatten ? r.map((z) => z.replace(/[^.W]/g, 'k').replace(/W/g, '.')) : r;
  return svgUrl(pixelSvg(zeilen));
}

const CSS = `
#hm-besucher { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(440px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-besucher:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-besucher[hidden], #hm-besucher.zurueck, body.building #hm-besucher, body.foto #hm-besucher,
body.card-open #hm-besucher { display: none !important; }
#hm-besucher > .hm-pixelbild { flex: none; margin-top: 2px; color: var(--hm-tinte, #24364a); }
#hm-besucher .bs-text { flex: 1; min-width: 0; }
#hm-besucher strong { display: block; font-weight: 600; }
#hm-besucher .bs-satz { display: block; font-size: max(13px, .8125rem); }
#hm-besucher .bs-knoepfe { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#hm-besucher .bs-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 10px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-besucher .bs-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-besucher .bs-knoepfe .hm-primaer { flex: 1 1 auto; }
#hm-besucher.gold { box-shadow: inset 0 0 0 3px ${GOLD}; }
@media (max-width: 420px) { #hm-besucher .bs-knoepfe .hm-knopf { padding: 4px 8px; font-size: 13px; } }
@media (max-height: 500px) {
  #hm-besucher { gap: 8px; padding: 6px 10px; line-height: 1.2; }
  #hm-besucher .bs-satz { font-size: 12px; }
  #hm-besucher .bs-knoepfe { margin-top: 4px; }
  #hm-besucher .bs-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
.hm-foto-leiste button.hm-bs-foto { background: #fde49a; }
.hm-foto-leiste button.hm-bs-foto.bereit { background: ${GOLD}; box-shadow: 0 0 0 3px #24364a, 0 0 0 5px ${GOLD}; }
.hm-foto-leiste button.hm-bs-foto.fertig { background: #9fd8a8; }
.hm-foto-leiste button.hm-bs-foto .bs-kurz { display: none; }
@media (max-width: 599px) {
  .hm-foto-leiste button.hm-bs-foto .bs-lang { display: none; }
  .hm-foto-leiste button.hm-bs-foto .bs-kurz { display: inline; }
}
.hm-bs-blitz { position: absolute; inset: 0; z-index: 40; pointer-events: none; background: #fff; opacity: 0; transition: opacity .35s ease-out; }
.hm-bs-blitz.an { opacity: .85; transition: none; }
/* Reiter "Besucher" im Logbuch */
.hm-bs-karte img.hm-lb-bild { object-fit: cover; background: #a8d4e0; }
.hm-bs-karte.foto img.hm-lb-bild { box-shadow: 0 0 0 2px #24364a, 3px 3px 0 2px rgba(36,54,74,.25); }
.hm-bs-karte .hm-bs-zeichen { position: absolute; top: 4px; right: 4px; display: flex; gap: 2px; }
.hm-bs-karte .hm-bs-zeichen .hm-pixelbild { width: 16px; height: 16px; }
.hm-bs-steckbrief img.hm-lb-bild.gross { object-fit: cover; background: #a8d4e0; }
.hm-bs-steckbrief p { margin: 4px 0; }
.hm-bs-steckbrief .hm-bs-fakten { margin: 8px 0 0; padding: 6px 8px; background: var(--hm-mulde, #e9dfca); }
`;

export function init(game) {
  // Modelle sofort einhängen, bevor das erste Boot gebaut wird (boat-view fragt game.boatTypes beim Bauen)
  modelleInit(game);
  if (typeof document === 'undefined') return;
  tiereInit(game);
  start(game).catch((e) => console.error('Besucher (P40):', e));
}

async function start(game) {
  const sim = await regelnBereit(game);
  R.haengeEin(sim.addHook, sim.addService);
  const st = () => sim.state;
  const ctx = () => sim.ctx;
  const rules = () => sim.ctx.rules;
  const bes = () => R.besState(st());
  if (st()) R.saeubern(st());
  game.on('sim:change', (d) => { if ((d?.reason === 'load' || d?.reason === 'new') && st()) { R.saeubern(st()); gezeigt.clear(); } });

  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-besucher';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-besucher', MELDUNG_ID);
  const blitz = document.createElement('div');
  blitz.className = 'hm-bs-blitz';
  host.append(blitz);

  // ------------------------------------------------------------------ Motive und Bildlage
  const boot = (id) => st()?.boats?.[id] ?? st()?.upcoming?.find((b) => b.id === id) ?? null;
  const schiffImWasser = () => Object.values(st()?.boats || {}).find((b) => b?.besucher && game.boatView?.boot?.(b.id)?.model) ?? null;

  /** Motive, die gerade im Hafen sind: [{ art, x, y, z, r, boatId? }] */
  function motive() {
    const out = [];
    const b = schiffImWasser();
    if (b) {
      const p = game.boatView.boot(b.id).model.position;
      out.push({ art: b.besucher, x: p.x, y: p.y + 1.5, z: p.z, r: Math.max(4, b.length / 2), boatId: b.id, name: b.bootsname });
    }
    for (const art of game.besucherTiere?.aktiv?.() || []) {
      const m = game.besucherTiere.motiv(art);
      if (m) out.push({ art, x: m.x, y: 0.4, z: m.z, r: m.r, sichtbar: m.sichtbar });
    }
    return out;
  }

  /** Lage eines Motivs im Bild: Mitte im Bild ohne Rand und groß genug? */
  function imBild(m) {
    const T = game.THREE;
    const cam = game.camera?.camera;
    if (!T || !cam) return null;
    cam.updateMatrixWorld?.();
    const p = new T.Vector3(m.x, m.y, m.z).project(cam);
    if (p.z > 1 || p.z < -1) return null;
    const rechts = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const q = new T.Vector3(m.x, m.y, m.z).addScaledVector(rechts, m.r).project(cam);
    const W = game.camera.screenW ?? innerWidth;
    const H = game.camera.screenH ?? innerHeight;
    const rad = Math.hypot(((q.x - p.x) * W) / 2, ((q.y - p.y) * H) / 2);
    const f = R.BES.foto;
    const drin = Math.abs(p.x) <= 1 - 2 * f.rand && Math.abs(p.y) <= 1 - 2 * f.rand;
    const genug = (2 * rad) / Math.min(W, H) >= f.mindestGroesse;
    // Der Schweinswal muss gerade aufgetaucht sein
    const zuSehen = m.sichtbar !== false;
    return { nx: p.x, ny: p.y, rad, W, H, drin, genug, ok: drin && genug && zuSehen };
  }

  function bestesMotiv() {
    let best = null;
    for (const m of motive()) {
      const k = imBild(m);
      if (!k?.ok) continue;
      const wert = k.rad - Math.hypot(k.nx, k.ny) * 50;
      if (!best || wert > best.wert) best = { m, k, wert };
    }
    return best;
  }

  /** Kleines Bild um das Motiv (JPEG, 168 x 88) direkt nach dem Rendern. */
  function vorschaubild(k) {
    try {
      game.renderer.render(game.scene, game.camera.camera);
      const c = game.canvas;
      const sx = c.width / k.W;
      const sy = c.height / k.H;
      const cx = ((k.nx + 1) / 2) * k.W * sx;
      const cy = ((1 - k.ny) / 2) * k.H * sy;
      let w = Math.min(c.width, Math.max(k.rad * 2 * 2.2 * sx, c.width * 0.12));
      let h = (w * BILD.h) / BILD.w;
      if (h > c.height) { h = c.height; w = (h * BILD.w) / BILD.h; }
      const x0 = Math.max(0, Math.min(c.width - w, cx - w / 2));
      const y0 = Math.max(0, Math.min(c.height - h, cy - h / 2));
      const o = document.createElement('canvas');
      o.width = BILD.w * 2;
      o.height = BILD.h * 2;
      o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, o.width, o.height);
      let url = o.toDataURL('image/jpeg', 0.75);
      if (url.length >= 60000) url = o.toDataURL('image/jpeg', 0.5);
      return url.startsWith('data:image/') ? url : null;
    } catch {
      return null;
    }
  }

  /** Kamera zum Motiv; nah: so weit heranzoomen, dass es etwa ein Sechstel des Bilds füllt (nie hinaus). */
  function fliegeZu(m, nah = false) {
    const cam = game.camera;
    if (!m || !cam?.flyTo) return;
    cam.flyTo(m.x, m.z);
    if (!nah || !cam.zoomAt || !(cam.viewWidth > 0)) return;
    const W = cam.screenW ?? innerWidth;
    const H = cam.screenH ?? innerHeight;
    const breite = Math.max(40, (2 * m.r * W) / (0.16 * Math.min(W, H)));
    if (cam.viewWidth > breite) cam.zoomAt(cam.viewWidth / breite);
  }

  // ------------------------------------------------------------------ Foto im Fotomodus
  let fotoKnopf = null;
  let fotoFertigBis = 0;
  function fotoKnopfBauen() {
    if (fotoKnopf || !game.foto?.leiste) return;
    fotoKnopf = document.createElement('button');
    fotoKnopf.type = 'button';
    fotoKnopf.className = 'hm-bs-foto';
    fotoKnopf.hidden = true;
    fotoKnopf.addEventListener('click', (e) => { e.stopPropagation(); fotografiere(); });
    game.foto.leiste.insertBefore(fotoKnopf, game.foto.leiste.firstChild);
  }
  fotoKnopfBauen();
  game.on('foto:an', () => { fotoKnopfBauen(); fotoKnopfZeichnen(); });

  function fotoKnopfZeichnen() {
    if (!fotoKnopf) return;
    const da = st() && game.foto?.aktiv ? motive() : [];
    fotoKnopf.hidden = !da.length;
    if (!da.length) return;
    if (performance.now() < fotoFertigBis) return;
    const best = bestesMotiv();
    fotoKnopf.classList.remove('fertig');
    fotoKnopf.classList.toggle('bereit', !!best);
    const t = texteVon((best?.m ?? da[0]).art);
    // Lang auf breiten Bildschirmen, kurz auf dem Handy (die Leiste hat dort nur eine Zeile)
    const setze = (lang, kurz, label) => {
      if (fotoKnopf.dataset.text === lang) return;
      fotoKnopf.dataset.text = lang;
      const a = document.createElement('span');
      a.className = 'bs-lang';
      a.textContent = lang;
      const b = document.createElement('span');
      b.className = 'bs-kurz';
      b.textContent = kurz;
      fotoKnopf.replaceChildren(a, b);
      fotoKnopf.setAttribute('aria-label', label);
    };
    if (best) setze(`${t.titel} ins Logbuch`, 'Ins Logbuch', `Foto: ${t.titel} ins Logbuch`);
    else setze(`${t.artikel === 'die' ? 'Zur' : 'Zum'} ${t.titel}`, 'Motiv suchen', `${t.titel} ins Bild holen`);
  }

  /** Foto des besten Motivs im Bild ins Logbuch. Ohne Motiv im Bild fliegt die Kamera hin. Gibt die Art zurück. */
  function fotografiere() {
    const s = st();
    if (!s) return null;
    const best = bestesMotiv();
    if (!best) {
      const m = motive()[0];
      fliegeZu(m, true);
      return null;
    }
    const { m, k } = best;
    const bild = vorschaubild(k);
    const erstes = R.fotoMerken(s, m.art, bild);
    blitz.classList.add('an');
    requestAnimationFrame(() => requestAnimationFrame(() => blitz.classList.remove('an')));
    if (navigator.vibrate) navigator.vibrate(15);
    game.audio?.sfx?.(erstes ? 'erfolg' : 'klick');
    const t = texteVon(m.art);
    if (erstes) game.logbuch?.merken?.({ a: 'text', art: 'besucher', text: `Foto fürs Logbuch: ${gross(nennung(m.art, m.name))}` });
    if (fotoKnopf) {
      fotoKnopf.classList.remove('bereit');
      fotoKnopf.classList.add('fertig');
      fotoKnopf.textContent = erstes ? 'Im Logbuch' : 'Neues Foto';
      fotoKnopf.dataset.text = '';
      fotoFertigBis = performance.now() + 1800;
    }
    game.emit('besucher:foto', { art: m.art, erstes });
    game.emit('besucher:neu', { art: m.art });
    game.logbuch?.neuZeichnen?.();
    return m.art;
  }

  // ------------------------------------------------------------------ Meldungen
  const gezeigt = new Set();      // Schlüssel der Meldungen, die heute schon kamen (nicht im Spielstand)
  const schlange = [];
  let aktuell = null;             // { typ, art, boatId?, name?, sichtbar, auswahl, gold? }
  let gewuenscht = false;
  let zeichen = '';

  function melde(m) {
    const key = `${st()?.day}:${m.typ}:${m.art}:${m.boatId ?? ''}`;
    if (gezeigt.has(key)) return false;
    gezeigt.add(key);
    // Eine neue Meldung zum selben Schiff ersetzt die alte (zum Beispiel "liegt fest" nach "meldet sich an")
    if (aktuell && aktuell.boatId != null && aktuell.boatId === m.boatId) schliessen();
    for (let i = schlange.length - 1; i >= 0; i--) if (schlange[i].boatId != null && schlange[i].boatId === m.boatId) schlange.splice(i, 1);
    schlange.push({ ...m, sichtbar: 0, auswahl: 0 });
    return true;
  }

  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch(MELDUNG_ID, VORRANG.besucher ?? 58);
    else game.meldungen?.fertig(MELDUNG_ID);
  }

  const knopf = (text, primaer, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hm-knopf hm-px${primaer ? ' hm-primaer' : ''}`;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };

  const ehrenplaetze = (id) => sim.freihaltbar(id).filter((p) => R.istEhrenplatz(ctx().berthById[p]));
  function zeigePlatz(platzId) {
    const p = game.stege?.platz?.(platzId);
    if (p?.x != null && p?.z != null) game.camera?.flyTo?.(p.x, p.z);
  }
  let markiert = null;
  function leuchte(ids) {
    const k = ids?.length ? ids.join(',') : null;
    if (sim.selected != null) { markiert = null; return; }
    if (k === markiert) return;
    markiert = k;
    game.stege?.highlight?.(ids || [], GOLD);
  }
  let ziel = null;

  function inhalt() {
    const m = aktuell;
    const s = st();
    const titel = document.createElement('strong');
    const satz = document.createElement('span');
    satz.className = 'bs-satz';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'bs-knoepfe';
    let symbol = 'stern';
    ziel = null;
    if (m.typ === 'anmeldung') {
      const b = boot(m.boatId);
      const t = SCHIFF_TEXTE[m.art];
      symbol = 'schiff';
      if (!b || !b.funk) return null;
      const bonus = sim.funkBonus?.(b.id) || 0;
      const gegen = `gegen ${uhrzeitText(b.arriveAt, rules())}`;
      if (b.funk.platz) {
        const ehren = R.istEhrenplatz(ctx().berthById[b.funk.platz]);
        titel.textContent = ehren ? `Ehrenplatz ${b.funk.platz} ist frei gehalten` : `Box ${b.funk.platz} ist frei gehalten`;
        satz.textContent = `${gross(nennung(m.art, b.bootsname))} kommt ${gegen} und fährt direkt hinein.${bonus ? ` Bonus beim Einlaufen: ${euro(bonus)}.` : ''}`;
        ziel = [b.funk.platz];
        knoepfe.append(knopf('Gut', true, fertig));
        const andere = (ehren ? ehrenplaetze(b.id) : sim.freihaltbar(b.id)).filter((p) => p !== b.funk.platz);
        if (andere.length) knoepfe.append(knopf('Andere', false, () => halten(andere[m.auswahl++ % andere.length])));
        knoepfe.append(knopf('Freigeben', false, () => { sim.freigeben(b.id); fertig(); }));
      } else {
        titel.textContent = `Funk: ${gross(nennung(m.art, b.bootsname))} meldet sich an`;
        const ep = ehrenplaetze(b.id);
        const heimat = b.heimathafen ? ` aus ${b.heimathafen}` : '';
        satz.textContent = `${t.kommt} Kommt ${gegen}${heimat}. ${t.platz}`;
        if (ep.length) {
          const p = ep[m.auswahl % ep.length];
          ziel = [p];
          knoepfe.append(knopf(`Ehrenplatz ${p} freihalten`, true, () => halten(p)));
          if (ep.length > 1) knoepfe.append(knopf('Anderer', false, () => { m.auswahl++; zeigePlatz(ep[m.auswahl % ep.length]); zeichne(true); }));
          knoepfe.append(knopf('Später', false, fertig));
        } else {
          const frei = sim.freihaltbar(b.id);
          satz.textContent += ' Gerade ist kein Ehrenplatz frei.';
          if (frei.length) {
            ziel = [frei[0]];
            knoepfe.append(knopf(`Box ${frei[0]} freihalten`, true, () => halten(frei[0])));
          }
          knoepfe.append(knopf(frei.length ? 'Später' : 'Gut', !frei.length, fertig));
        }
      }
    } else if (m.typ === 'fest') {
      const t = SCHIFF_TEXTE[m.art];
      const b = boot(m.boatId);
      titel.textContent = m.ehrenplatz ? `${gross(nennung(m.art, b?.bootsname))} liegt am Ehrenplatz` : `${gross(nennung(m.art, b?.bootsname))} hat festgemacht`;
      satz.textContent = `${m.ehrenplatz ? t.fest : t.anderswo} Ein Foto für das Logbuch?`;
      knoepfe.append(knopf('Foto', true, () => fotoModus(m)), knopf('Ansehen', false, () => { ansehen(m); fertig(); }), knopf('Später', false, fertig));
    } else if (m.typ === 'tier') {
      const t = TIER_TEXTE[m.art];
      symbol = m.art === 'schweinswal' ? 'welle' : 'stern';
      titel.textContent = t.kommt;
      satz.textContent = s && R.besState(s).fotos[m.art] ? 'Noch ein Foto?' : 'Ein Foto für das Logbuch?';
      knoepfe.append(knopf('Foto', true, () => fotoModus(m)), knopf('Ansehen', false, () => { ansehen(m); fertig(); }), knopf('Später', false, fertig));
    } else if (m.typ === 'verpasst') {
      const b = boot(m.boatId);
      titel.textContent = `${gross(nennung(m.art, b?.bootsname ?? m.name))} ist weitergefahren`;
      satz.textContent = 'Es war kein passender Platz frei. Vielleicht kommt das Schiff ein anderes Mal wieder.';
      knoepfe.append(knopf('Schade', true, fertig));
    } else if (m.typ === 'zuschauer') {
      titel.textContent = 'Schaulustige am Ehrenplatz';
      satz.textContent = `Viele Leute kamen ${nennung(m.art)} ansehen und kauften im Ort ein: ${euro(m.geld)}.`;
      knoepfe.append(knopf('Schön', true, fertig));
    }
    const sym = pixelBild(symbol, 24);
    const text = document.createElement('div');
    text.className = 'bs-text';
    text.append(titel, satz, knoepfe);
    box.classList.toggle('gold', m.typ === 'fest' || m.typ === 'tier');
    return [sym, text];
  }

  function zeichne(erzwingen = false) {
    if (!aktuell) { box.replaceChildren(); zeichen = ''; return; }
    const b = aktuell.boatId != null ? boot(aktuell.boatId) : null;
    const sig = JSON.stringify([aktuell.typ, aktuell.art, aktuell.auswahl, b?.funk?.platz ?? null, b?.status ?? null,
      aktuell.typ === 'anmeldung' && b ? sim.freihaltbar(b.id).slice(0, 8) : null]);
    if (!erzwingen && sig === zeichen) return;
    zeichen = sig;
    const teile = inhalt();
    if (!teile) { fertig(); return; }
    box.replaceChildren(...teile);
  }

  function halten(platzId) {
    const b = aktuell && boot(aktuell.boatId);
    if (!b) return;
    const r = sim.freihalten(b.id, platzId);
    if (r?.ok) {
      zeigePlatz(r.berthId);
      game.emit('funk:freigehalten', { id: b.id, platz: r.berthId, besucher: b.besucher });
      aktuell.sichtbar = SICHTBAR_S - KURZ_S;
    }
    zeichne(true);
  }

  function ansehen(m, nah = false) {
    const ort = motive().find((x) => x.art === m.art);
    if (ort) fliegeZu(ort, nah);
    else if (m.berthId) zeigePlatz(m.berthId);
  }

  function fotoModus(m) {
    ansehen(m, true);
    fertig();
    game.foto?.an?.();
  }

  function fertig() {
    schliessen();
    naechste();
  }

  function schliessen() {
    aktuell = null;
    box.hidden = true;
    box.replaceChildren();
    zeichen = '';
    ziel = null;
    leuchte(null);
    wuensche(false);
  }

  function naechste() {
    if (aktuell || !schlange.length) return;
    aktuell = schlange.shift();
    zeichne(true);
    if (!aktuell) return;
    box.hidden = false;
    wuensche(true);
  }

  /** Meldung zu einem angemeldeten Besucher (wieder) zeigen, zum Beispiel aus dem Funk. */
  function zeige(id) {
    const b = boot(Number(id));
    if (!b?.besucher || !b.funk) return false;
    if (aktuell) { schlange.unshift(aktuell); schliessen(); }
    schlange.unshift({ typ: 'anmeldung', art: b.besucher, boatId: b.id, sichtbar: 0, auswahl: 0 });
    naechste();
    return true;
  }

  // ------------------------------------------------------------------ Ereignisse der Regeln
  game.on('sim:change', (d) => {
    const s = st();
    if (!s || !d?.events?.length) return;
    for (const e of R.verarbeite(s, ctx(), d.events)) {
      if (e.neu) game.emit('besucher:neu', { art: e.art });
      if (e.phase === 'fest') {
        const b = s.boats[e.boatId];
        melde({ typ: 'fest', art: e.art, boatId: e.boatId, berthId: e.berthId, ehrenplatz: e.ehrenplatz });
        const satz = SCHIFF_TEXTE[e.art].chronik.replace('{name}', b?.bootsname ?? '');
        game.logbuch?.merken?.({ a: 'text', art: 'besucher', text: satz });
        if (e.ehrenplatz) {
          const p = game.stege?.platz?.(e.berthId);
          const z = R.BES.zuschauer;
          if (p) game.people?.versammeln?.({ x: p.x, z: p.z, anzahl: Math.round(z.leute * (z.faktor?.[e.art] ?? 1)), dauer: 90, boote: [e.boatId] });
          setTimeout(() => game.flugtext?.(e.boatId, 'Ehrenplatz!', true), 600);
        }
        game.emit('besucher:neu', { art: e.art });
      } else if (e.phase === 'verpasst') {
        melde({ typ: 'verpasst', art: e.art, boatId: e.boatId, name: R.besState(s).heute?.name });
      }
    }
    for (const e of d.events) {
      if (e?.type === 'besucherZuschauer' && e.geld > 0) {
        melde({ typ: 'zuschauer', art: e.art, boatId: `z${e.boatId}`, geld: e.geld });
        game.flugtext?.(e.boatId, `Schaulustige: +${euro(e.geld)}`, true);
      }
    }
  });

  // ------------------------------------------------------------------ Takt: Anmeldung, Tiere, Foto-Knopf
  let letzte = performance.now();
  function takt() {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    const s = st();
    if (!s) return;
    const b = R.besState(s);
    // Anmeldung am Morgen
    const h = b.heute;
    if (h && h.tag === s.day && h.phase === 'angemeldet' && s.phase === 'day') {
      const x = boot(h.boatId);
      if (x?.besucher && x.funk && x.status === 'expected') melde({ typ: 'anmeldung', art: h.art, boatId: h.boatId });
    }
    // Tiere: zur geplanten Zeit ins Bild
    if (b.tiere.tag === s.day && s.phase === 'day' && game.besucherTiere) {
      for (const t of b.tiere.liste) {
        const key = `${s.day}:${t.art}`;
        if (!tierGezeigt.has(key) && s.clock >= t.at && s.clock < t.at + t.dauer * 3) {
          tierGezeigt.add(key);
          if (game.besucherTiere.zeige(t.art, { seed: t.seed, dauer: t.dauer }) !== false) melde({ typ: 'tier', art: t.art });
        }
        if (!t.gesehen && game.besucherTiere.motiv(t.art)?.sichtbar) {
          if (R.tierGesehen(s, t.art)) game.emit('besucher:neu', { art: t.art });
          game.logbuch?.merken?.({ a: 'text', art: 'besucher', text: TIER_TEXTE[t.art].chronik });
        }
      }
    }
    if (game.foto?.aktiv) fotoKnopfZeichnen();
    // Meldung
    if (aktuell?.typ === 'anmeldung') {
      const x = boot(aktuell.boatId);
      if (!x?.funk || (x.status !== 'expected' && x.status !== 'waiting') || s.phase !== 'day') schliessen();
    }
    if (!aktuell) naechste();
    if (!aktuell) { leuchte(null); return; }
    const darf = game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
    box.classList.toggle('zurueck', !darf);
    const cl = document.body.classList;
    const steht = darf && !box.hidden && !cl.contains('card-open') && !cl.contains('building') && !cl.contains('foto');
    leuchte(steht ? ziel : null);
    if (!steht) return;
    zeichne();
    aktuell.sichtbar += dt;
    const grenze = aktuell.typ === 'verpasst' || aktuell.typ === 'zuschauer' ? KURZ_S : SICHTBAR_S;
    if (aktuell.sichtbar >= grenze) fertig();
  }
  const tierGezeigt = new Set();
  setInterval(takt, 250);
  game.on('meldungen:wechsel', () => { if (aktuell) box.classList.toggle('zurueck', !game.meldungen.darf(MELDUNG_ID)); });

  // ------------------------------------------------------------------ Reiter "Besucher" im Logbuch
  const maler = bildMaler(game);
  let steckbrief = null;
  const modellVon = (art) => {
    const m = MODELL_VON[art];
    return m ? { ...m, size: GROESSE[m.typeId] } : null;
  };
  function bildVon(art, s, gross = false) {
    const b = R.besState(s);
    const img = document.createElement('img');
    img.className = `hm-lb-bild${gross ? ' gross' : ''}`;
    img.alt = '';
    img.width = BILD.w * 2;
    img.height = BILD.h * 2;
    const foto = b.fotos[art]?.bild;
    const da = !!b.gesehen[art];
    if (foto) img.src = foto;
    else if (istTier(art)) { img.src = tierBild(art, !da); if (!da) img.classList.add('schatten'); }
    else {
      if (!da) img.classList.add('schatten');
      const mo = modellVon(art);
      if (mo) maler.bild(mo, { schatten: !da }).then((r) => { if (r?.src) img.src = r.src; }).catch(() => {});
    }
    return img;
  }
  const tagText = (tag) => (tag != null ? `Tag ${tag}` : '');

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (/^on[a-z]+$/.test(k) && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }

  function steckbriefTeil(s, art, zeichneNeu) {
    const b = R.besState(s);
    const t = texteVon(art);
    const g = b.gesehen[art];
    const f = b.fotos[art];
    const fakten = [];
    if (g) fakten.push(`Zuerst gesehen: ${tagText(g.tag)}${g.stufe ? `, Stufe ${g.stufe}` : ''}. ${g.mal > 1 ? `${g.mal}-mal da gewesen.` : ''}`);
    if (!istTier(art) && g) fakten.push(g.ehrenplatz ? 'Lag am Ehrenplatz.' : 'Lag noch nie am Ehrenplatz.');
    fakten.push(f ? `Foto vom ${tagText(f.tag)}.` : g ? 'Noch kein Foto: im Fotomodus (P) ins Bild holen.' : t.hinweis);
    return [el('div', { class: 'hm-lb-steckbrief hm-bs-steckbrief' },
      el('div', { class: 'hm-lb-sb-leiste' },
        el('button', { type: 'button', class: 'hm-lb-zurueck', onclick: () => { steckbrief = null; zeichneNeu(); } }, 'Alle Besucher')),
      el('div', { class: 'hm-lb-sb-bild' }, bildVon(art, s, true)),
      el('h3', {}, g ? t.titel : '???'),
      g ? el('p', {}, istTier(art) ? t.kommt : `${t.kommt} ${t.platz}`) : null,
      el('p', { class: 'hm-bs-fakten' }, fakten.join(' ')))];
  }

  function teil(s, opt = {}) {
    const zeichneNeu = () => (opt.zeichne ? opt.zeichne() : game.logbuch?.neuZeichnen?.());
    if (steckbrief) return steckbriefTeil(s, steckbrief, zeichneNeu);
    const b = R.besState(s);
    const f = R.fortschritt(s);
    const oben = el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' }, el('b', {}, `${f.gesehen} von ${f.gesamt}`), el('span', {}, ` Besuchern gesehen · ${f.fotos} ${f.fotos === 1 ? 'Foto' : 'Fotos'}`)),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(f.gesamt), 'aria-valuenow': String(f.fotos), 'aria-label': 'Fotos im Logbuch' },
        el('i', { style: `width: ${Math.round((f.fotos / f.gesamt) * 1000) / 10}%` })));
    const teile = [oben];
    const gruppen = [['Seltene Schiffe', MOTIVE.filter((a) => !istTier(a))], ['Tiere', MOTIVE.filter(istTier)]];
    const gesehenJetzt = [];
    for (const [name, arten] of gruppen) {
      const raster = el('ul', { class: 'hm-lb-raster' });
      for (const art of arten) {
        const t = texteVon(art);
        const da = !!b.gesehen[art];
        const foto = b.fotos[art];
        const neu = b.neu.includes(art);
        if (neu) gesehenJetzt.push(art);
        const klein = foto ? `Foto vom ${tagText(foto.tag)}` : da ? 'Gesehen, noch kein Foto' : t.hinweis;
        raster.append(el('li', {}, el('button', {
          type: 'button', class: `hm-lb-karte hm-bs-karte${da ? '' : ' fehlt'}${neu ? ' neu' : ''}${foto ? ' foto' : ''}`, 'data-besucher': art,
          title: da ? t.titel : t.hinweis,
          onclick: () => { steckbrief = art; zeichneNeu(); },
        },
        bildVon(art, s),
        el('span', { class: 'hm-lb-name' }, da ? t.titel : '???'),
        el('span', { class: 'hm-lb-klein' }, klein),
        !istTier(art) && b.gesehen[art]?.ehrenplatz ? el('span', { class: 'hm-bs-zeichen', title: 'Lag am Ehrenplatz' }, pixelBild('stern', 16)) : null,
        neu ? el('span', { class: 'hm-lb-neu' }, 'neu') : null)));
      }
      const n = arten.filter((a) => b.fotos[a]).length;
      teile.push(el('section', { class: 'hm-lb-art' }, el('h3', {}, el('span', {}, name), el('span', { class: 'hm-lb-zahl' }, `${n}/${arten.length} Fotos`)), raster));
    }
    teile.push(el('p', { class: 'hm-lb-klein' }, 'Seltene Besucher kommen nur ab und zu. Im Fotomodus (P) bringt der goldene Knopf das Motiv ins Logbuch, sobald es groß genug im Bild ist.'));
    if (gesehenJetzt.length) setTimeout(() => { b.neu = b.neu.filter((a) => !gesehenJetzt.includes(a)); game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
    return teile;
  }
  function reiterAnmelden() {
    if (!game.logbuch?.reiter) return false;
    game.logbuch.reiter({ id: 'besucher', name: 'Besucher', teil, zahl: () => (st() ? R.besState(st()).neu.length : 0) });
    return true;
  }
  if (!reiterAnmelden()) game.on('ready', reiterAnmelden);

  // ------------------------------------------------------------------ Schnittstelle und Ausprobieren
  function ausloesen(art = null) {
    const s = st();
    if (!s) return null;
    if (art && istTier(art)) {
      const liste = R.tierePlanen(s, ctx(), { erzwingen: art });
      tierGezeigt.delete(`${s.day}:${art}`);
      return liste.find((t) => t.art === art) ?? null;
    }
    const h = R.ausloesen(s, ctx(), art);
    if (h) game.emit('sim:change', { reason: 'besucher' });
    return h;
  }

  game.besucher = {
    zeige,
    heute: () => (st() ? R.besState(st()).heute : null),
    ausloesen,
    motive,
    imBild: (art) => { const m = motive().find((x) => x.art === art); return m ? imBild(m) : null; },
    fotografiere,
    fortschritt: () => (st() ? R.fortschritt(st()) : null),
    meldung: () => (aktuell ? { typ: aktuell.typ, art: aktuell.art, boatId: aktuell.boatId } : null),
  };

  const wunsch = new URLSearchParams(location.search).get('besucher');
  if (wunsch && (SCHIFF_TEXTE[wunsch] || TIER_TEXTE[wunsch])) {
    const t0 = Date.now();
    const versuch = setInterval(() => {
      const s = st();
      if (Date.now() - t0 > 20000) { clearInterval(versuch); console.info('besucher: konnte', wunsch, 'nicht auslösen'); return; }
      if (!s || s.phase !== 'day' || !s.upcoming?.length) return;
      clearInterval(versuch);
      if (!ausloesen(wunsch)) console.info('besucher: konnte', wunsch, 'nicht auslösen (Stufe zu klein oder kein Platz?)');
    }, 300);
  }
}

export default init;
