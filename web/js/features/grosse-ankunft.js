// Große Ankünfte (Paket P47, Roadmap F31, docs/grosse-ankuenfte.md).
//
// Wenn ein großes Schiff in den Spielbereich einläuft, wird das ein kleines Ereignis:
//   Horn     das Schiff tutet einmal beim Einlaufen (Größe und Zahl der Stöße je Art, links/rechts nach Lage im Bild)
//   Meldung  "Kreuzfahrtschiff läuft ein" im Meldeplatz, mit "Ansehen" (oder "Zurück" während der Kamerafahrt)
//   Kamera   kurze Kamerafahrt: weich zum Schiff, ein paar Sekunden mitfahren, dann zurück an die alte Stelle.
//            Nur wenn der Spieler gerade nichts tut (keine Berührung seit IDLE_S, kein Boot gewählt, nicht im
//            Bauen, keine Karte offen, keine wichtige Meldung). Jede Berührung, jedes Mausrad und jede Taste
//            beenden die Fahrt sofort, die Kamera bleibt dann, wo der Spieler sie hinschiebt.
// Große Schiffe sind: Kreuzfahrtschiff, Flottenbesuch und Windjammer (render/services-besuch.js, Ereignis
// 'besuch:einlaufen') und die seltenen Besucher aus P40 (features/besucher.js, boat.besucher).
// Abschaltbar in den Einstellungen (ui/einstellungen.js, Wahl 'ankuenfte': Mit Kamera / Nur Horn / Aus).
// Das Tempo ändert sich nie von selbst.
// Schnittstelle: game.ankunft = { laeuft, ansehen(key?), zurueck(), aktuelle(), probe(art) }.
// Zum Ausprobieren: ?ankunft=kreuzfahrt|flottenbesuch|windjammer (Stufe 6 mit ?stufe=6&services=alle).

import { VORRANG } from '../ui/meldungen.js';
import { SCHIFF_TEXTE } from '../data/besucher.js';

export const IDLE_S = 4;            // so lange muss der Spieler nichts berührt haben, bevor die Kamera von selbst fährt
export const ABSTAND_S = 60;        // höchstens eine Kamerafahrt von selbst je Minute
export const ANFLUG_S = 1.8;        // weich hin
export const FOLGEN_S = 5;          // mitfahren
export const RUECK_S = 1.6;         // weich zurück
export const MELDUNG_S = 9;         // so lange steht die Meldung (sichtbare Zeit)
export const WICHTIG_AB = 60;       // ab diesem Vorrang einer stehenden Meldung fährt die Kamera nicht von selbst
export const VORRANG_FAHRT = 59;    // Vorrang der Meldung, solange die Kamera fährt

// Dienste-Besuche (data/besuchswege.js, AUFTRITTE[id].art). Das tägliche Ausflugsschiff zählt nicht.
export const DIENST_ARTEN = {
  kreuzfahrt: {
    titel: 'Kreuzfahrtschiff läuft ein', satz: 'Gleich kommen viele Tagesgäste in den Ort.',
    sym: 'schiff', horn: { groesse: 'XXL', stoesse: 1 },
  },
  flottenbesuch: {
    titel: 'Flottenbesuch läuft ein', satz: 'Korvette und Minenjagdboot machen am Marineanleger fest. Zuschauer kommen an die Pier.',
    sym: 'schiff', horn: { groesse: 'XXL', stoesse: 2, kurz: true },
  },
  windjammer: {
    titel: 'Großsegler laufen ein', satz: 'Drei Traditionssegler kommen unter Segeln und ankern vor der Pier.',
    sym: 'kogge', horn: { groesse: 'XL', stoesse: 2, kurz: true }, breite: 220,   // drei Schiffe hintereinander
  },
};

// Hörner der seltenen Besucher (P40)
export const BESUCHER_HORN = {
  weltumsegler: { groesse: 'M', stoesse: 1 },
  museumsschiff: { groesse: 'L', stoesse: 3, kurz: true },
  forschungsschiff: { groesse: 'L', stoesse: 1 },
  koenigsyacht: { groesse: 'XL', stoesse: 2 },
};

const gross = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Titel und Satz der Meldung für einen seltenen Besucher. */
export function besucherText(art, name = null, platz = null) {
  const t = SCHIFF_TEXTE[art];
  if (!t) return null;
  const n = name ? ` „${name}“` : '';
  const titel = `${gross(t.artikel)} ${t.titel}${n} läuft ein`;
  const satz = platz ? `${gross(t.artikel === 'die' ? 'sie' : 'er')} fährt zum Ehrenplatz ${platz}.` : t.kommt;
  return { titel, satz };
}

/** Liegt der Punkt im Spielbereich (rect = game.gelaende.spielRect())? Ohne Rechteck: immer. */
export function imBereich(p, rect, rand = 0) {
  if (!p) return false;
  if (!rect) return true;
  return p.x > rect.minX - rand && p.x < rect.maxX + rand && p.z > rect.minZ - rand && p.z < rect.maxZ + rand;
}

/** Sichtbreite in Metern, in der ein Schiff der Länge L mit etwas Wasser drumherum gut zu sehen ist. */
export function zielBreite(L, minW = 15, maxW = 1000) {
  const w = Math.max(110, (L || 20) * 3);
  return Math.min(Math.max(w, minW), maxW);
}

/**
 * Darf die Kamera jetzt von selbst fahren? Liefert null (ja) oder den Grund (nein).
 * lage: { wahl, versteckt, ruhe, gedrueckt, bauen, karte, foto, schauen, einstieg, gewaehlt, fliegt, seitLetzter, vorrang, pause }
 */
export function grundGegenKamera(lage) {
  if (lage.wahl !== 'kamera') return 'einstellung';
  if (lage.versteckt) return 'versteckt';
  if (lage.pause) return 'pause';
  if (lage.gedrueckt) return 'beruehrt';
  if (!(lage.ruhe >= IDLE_S)) return 'beschaeftigt';
  if (lage.bauen) return 'bauen';
  if (lage.karte) return 'karte';
  if (lage.foto && !lage.schauen) return 'foto';
  if (lage.einstieg) return 'einstieg';
  if (lage.gewaehlt) return 'gewaehlt';
  if (lage.fliegt) return 'fliegt';
  if (lage.seitLetzter != null && lage.seitLetzter < ABSTAND_S) return 'abstand';
  if (lage.vorrang >= WICHTIG_AB) return 'meldung';
  return null;
}

const glatt = (u) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };

const CSS = `
#hm-ankunft { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(420px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px 10px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-ankunft:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-ankunft[hidden], #hm-ankunft.zurueck, body.building #hm-ankunft, body.card-open #hm-ankunft,
body.foto #hm-ankunft { display: none !important; }
#hm-ankunft > .hm-sym { flex: none; width: 24px; height: 24px; margin-top: 2px; }
#hm-ankunft .an-text { flex: 1; min-width: 0; }
#hm-ankunft strong { display: block; font-weight: 600; cursor: pointer; }
#hm-ankunft .an-satz { display: block; font-size: max(13px, .8125rem); }
#hm-ankunft .an-knoepfe { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#hm-ankunft .an-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 12px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-ankunft .an-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
@media (max-height: 500px) {
  #hm-ankunft { gap: 8px; padding: 6px 10px 7px; line-height: 1.2; }
  #hm-ankunft > .hm-sym { width: 20px; height: 20px; margin-top: 0; }
  #hm-ankunft .an-satz { font-size: 12px; }
  #hm-ankunft .an-knoepfe { margin-top: 4px; }
  #hm-ankunft .an-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
`;

export function init(game) {
  if (typeof document === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const cam = () => game.camera;
  const wahl = () => game.einstellungen?.wert?.('ankuenfte') ?? 'kamera';

  // ------------------------------------------------------------------ Eingaben des Spielers
  let letzteEingabe = performance.now();
  const zeiger = new Set();
  const inMeldung = (e) => !!e?.target?.closest?.('#hm-ankunft');
  const eingabe = (e) => {
    if (inMeldung(e)) return;
    letzteEingabe = performance.now();
    if (fahrt && !fahrt.zurueck) abbrechen();
  };
  addEventListener('pointerdown', (e) => { zeiger.add(e.pointerId); eingabe(e); }, true);
  addEventListener('pointerup', (e) => zeiger.delete(e.pointerId), true);
  addEventListener('pointercancel', (e) => zeiger.delete(e.pointerId), true);
  addEventListener('wheel', eingabe, { capture: true, passive: true });
  addEventListener('keydown', (e) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) eingabe(e); }, true);
  addEventListener('blur', () => zeiger.clear());

  // ------------------------------------------------------------------ Meldung
  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-ankunft';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-ankunft', 'ankunft');

  let gewuenscht = false;
  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch('ankunft', VORRANG.ankunft ?? 53);
    else game.meldungen?.fertig('ankunft');
  }
  const knopf = (text, fn, primaer = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hm-knopf hm-px${primaer ? ' hm-primaer' : ''}`;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };

  let meldung = null;   // { k (Kandidat), sichtbar }
  let zeichen = '';
  function zeichne() {
    if (!meldung) return;
    const k = meldung.k;
    const faehrt = !!fahrt && fahrt.k === k;
    const sig = `${k.key}|${faehrt}|${k.titel}`;
    if (sig === zeichen) return;
    zeichen = sig;
    const sym = document.createElement('i');
    sym.className = 'hm-sym';
    sym.setAttribute('aria-hidden', 'true');
    sym.style.setProperty('--sym', `var(--px-${k.sym ?? 'schiff'}, var(--px-schiff))`);
    const text = document.createElement('div');
    text.className = 'an-text';
    const titel = document.createElement('strong');
    titel.textContent = k.titel;
    titel.addEventListener('click', (e) => { e.stopPropagation(); if (!faehrt) ansehen(k); });
    const satz = document.createElement('span');
    satz.className = 'an-satz';
    satz.textContent = k.satz ?? '';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'an-knoepfe';
    if (faehrt) knoepfe.append(knopf('Zurück', () => zurueck()));
    else if (!k.fertig()) knoepfe.append(knopf('Ansehen', () => ansehen(k), true));
    text.append(titel, satz);
    if (knoepfe.childElementCount) text.append(knoepfe);
    box.replaceChildren(sym, text);
  }
  function zeigeMeldung(k) {
    meldung = { k, sichtbar: 0 };
    zeichen = '';
    box.hidden = false;
    wuensche(true);
    zeichne();
  }
  function schliesseMeldung() {
    meldung = null;
    box.hidden = true;
    wuensche(false);
  }

  // ------------------------------------------------------------------ Kandidaten
  // { key, titel, satz, sym, horn, laenge, pos() -> {x,z}|null, fertig() -> bool, angesagt, seit }
  const kandidaten = new Map();
  const angesagt = new Set();   // Schlüssel, die heute schon tuteten (Tag:key)
  const tagKey = (key) => `${game.state?.tag ?? game.sim?.state?.day ?? 0}:${key}`;

  game.on('besuch:einlaufen', (b) => {
    const art = DIENST_ARTEN[b?.art];
    if (!art || !b.gruppe) return;
    // Ein Besuch mit mehreren Schiffen (Flotte, Windjammer) zählt als eine Ankunft: das erste Schiff führt
    const key = `dienst:${b.id}`;
    if (kandidaten.has(key) || angesagt.has(tagKey(key))) return;
    kandidaten.set(key, {
      key, ...art, laenge: b.laenge ?? 60,
      pos: () => (b.gruppe.visible ? { x: b.gruppe.position.x, z: b.gruppe.position.z } : null),
      fertig: () => !b.gruppe.visible || !!b.amPlatz?.(),
      seit: performance.now(),
    });
  });

  game.on('boot-kommt', (info) => {
    if (info?.id == null) return;
    const boot = game.sim?.state?.boats?.[info.id];
    const art = boot?.besucher;
    if (!art || !SCHIFF_TEXTE[art]) return;
    const key = `besucher:${info.id}`;
    if (kandidaten.has(key) || angesagt.has(tagKey(key))) return;
    const h = game.besucher?.heute?.();
    const platz = h?.boatId === info.id && h?.ehrenplatz !== false ? boot.funk?.platz ?? null : null;
    const txt = besucherText(art, (h?.boatId === info.id ? h.name : null) ?? boot.bootsname ?? null, platz);
    kandidaten.set(key, {
      key, ...txt, sym: 'schiff', horn: BESUCHER_HORN[art] ?? { groesse: 'L', stoesse: 1 },
      laenge: boot.length ?? 14,
      // Solange das Boot draußen auf seinen Start wartet, ist es unsichtbar: dann keine Lage
      pos: () => { const a = game.boatView?.boot?.(info.id); return a && a.model?.visible !== false ? { x: a.x, z: a.z } : null; },
      // Fertig, sobald es an der Boje oder in der Box fest ist (oder nicht mehr da)
      fertig: () => { const a = game.boatView?.boot?.(info.id); return !a || !!a.moored || !game.sim?.state?.boats?.[info.id]; },
      seit: performance.now(),
      // Ein Gastboot reist lange über See an: angesagt wird es an der Einfahrt ins Revier ('boat:im-revier')
      // oder sobald es im Bild ist, nicht schon draußen am Rand des Spielbereichs
      bereit: () => {
        if (imRevier.has(info.id)) return true;
        const a = game.boatView?.boot?.(info.id);
        return !!a && a.model?.visible !== false && !!game.boatAnim?.imBild?.(a.x, a.z, (a.info?.length ?? 14) / 2);
      },
    });
  });
  const imRevier = new Set();
  game.on('boat:im-revier', (d) => { if (d?.id != null && kandidaten.has(`besucher:${d.id}`)) imRevier.add(d.id); });

  const neu = () => { kandidaten.clear(); angesagt.clear(); imRevier.clear(); abbrechen(); schliesseMeldung(); };
  game.on('spielstand-geladen', neu);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') neu(); });

  function bildX(p) {
    try {
      const v = new game.THREE.Vector3(p.x, 0, p.z).project(cam().camera);
      return Math.max(-1, Math.min(1, v.x));
    } catch { return 0; }
  }

  let letzterGrund = null;   // warum die letzte Ansage ohne Kamerafahrt blieb (null: sie fuhr)
  function ansagen(k) {
    k.angesagt = true;
    angesagt.add(tagKey(k.key));
    if (wahl() !== 'aus') {
      const p = k.pos();
      game.emit('horn', { ...k.horn, pan: p ? bildX(p) * 0.6 : 0 });
      const grund = grundGegenKamera(lage());
      letzterGrund = grund;
      if (!grund) starte(k, true);
    }
    zeigeMeldung(k);
    game.emit('ankunft:angesagt', { key: k.key, titel: k.titel, kamera: !!fahrt });
  }

  function lage() {
    const b = document.body.classList;
    const st = game.meldungen?.stand?.();
    return {
      wahl: wahl(), versteckt: document.hidden, pause: !!game.paused, gedrueckt: zeiger.size > 0,
      ruhe: (performance.now() - letzteEingabe) / 1000,
      bauen: b.contains('building'), karte: b.contains('card-open'), foto: b.contains('foto'),
      schauen: !!game.hafenSchauen?.aktiv, einstieg: !!game.einstieg?.schritt?.(),
      gewaehlt: game.sim?.selected != null, fliegt: !!cam()?._fly,
      seitLetzter: letzteFahrt == null ? null : (performance.now() - letzteFahrt) / 1000,
      vorrang: st && st.steht !== 'ankunft' ? st.vorrang : -Infinity,
    };
  }

  // ------------------------------------------------------------------ Kamerafahrt
  let fahrt = null;     // { k, t0, von: {x,z,w}, ziel, zurueck: bool, auto, rundflug }
  let letzteFahrt = null;

  function starte(k, auto) {
    const c = cam();
    if (!c?.flyTo || !k.pos()) return false;
    if (fahrt) beende(false);
    const schauen = !!game.hafenSchauen?.aktiv;
    const rundflug = schauen && !!game.foto?.rundflugAktiv;
    if (rundflug) game.foto.rundflug(false);
    fahrt = {
      k, t0: performance.now(), auto, schauen, rundflug,
      von: { x: c.target.x, z: c.target.z, w: c.viewWidth },
      breite: k.breite ?? zielBreite(k.laenge, c.minWidth, Math.max(c.maxWidth, c._homeWidth || 0)),
      zurueck: false,
    };
    if (auto) letzteFahrt = performance.now();
    zeichen = '';
    zeichne();
    game.emit('ankunft:kamera', { key: k.key, an: true, auto });
    return true;
  }
  function zoomAuf(w) {
    const c = cam();
    if (!(w > 0) || !(c.viewWidth > 0) || Math.abs(w - c.viewWidth) < 0.05) return;
    c.zoomAt(c.viewWidth / w);
  }
  // Ende der Fahrt. zurueckFliegen: Kamera fährt an die alte Stelle (nur wenn der Spieler nichts angefasst hat)
  function beende(zurueckFliegen) {
    if (!fahrt) return;
    if (zurueckFliegen && fahrt.auto && !fahrt.zurueck) {
      fahrt.zurueck = true;
      fahrt.tz = performance.now();
      fahrt.ab = { x: cam().target.x, z: cam().target.z, w: cam().viewWidth };
      return;
    }
    const f = fahrt;
    fahrt = null;
    if (f.rundflug && game.hafenSchauen?.aktiv) game.foto?.rundflug?.(true);
    zeichen = '';
    zeichne();
    game.emit('ankunft:kamera', { key: f.k.key, an: false });
  }
  // Spieler fasst an: sofort aus, nicht zurückfliegen, Blick bleibt
  function abbrechen() {
    if (!fahrt) return;
    fahrt.zurueck = false;
    fahrt.auto = false;
    beende(false);
  }

  function fahrtTick() {
    if (!fahrt) return;
    const c = cam();
    const jetzt = performance.now();
    const b = document.body.classList;
    if (b.contains('building') || b.contains('card-open') || (b.contains('foto') && !fahrt.schauen) || game.sim?.selected != null) { abbrechen(); return; }
    if (fahrt.zurueck) {
      const u = glatt((jetzt - fahrt.tz) / 1000 / RUECK_S);
      const { ab, von } = fahrt;
      c.flyTo(ab.x + (von.x - ab.x) * u, ab.z + (von.z - ab.z) * u);
      zoomAuf(ab.w + (von.w - ab.w) * u);
      if (u >= 1) { fahrt.auto = false; beende(false); }
      return;
    }
    const s = (jetzt - fahrt.t0) / 1000;
    const p = fahrt.k.pos();
    if (!p) { beende(true); return; }
    const u = glatt(s / ANFLUG_S);
    const { von } = fahrt;
    c.flyTo(von.x + (p.x - von.x) * u, von.z + (p.z - von.z) * u);
    zoomAuf(von.w + (fahrt.breite - von.w) * u);
    const ende = ANFLUG_S + FOLGEN_S;
    if (s >= ende || (s >= ANFLUG_S + 1.5 && fahrt.k.fertig())) beende(true);
  }

  function ansehen(k = meldung?.k) {
    if (!k || k.fertig()) return false;
    letzteEingabe = performance.now();
    return starte(k, false);
  }
  function zurueck() {
    if (!fahrt) return;
    const f = fahrt;
    f.auto = true;   // Zurück-Knopf: an die alte Stelle, auch nach "Ansehen"
    beende(true);
  }

  // ------------------------------------------------------------------ Takt
  let pruefZeit = 0;
  let letzteEcht = performance.now();
  game.onTick(() => {
    const jetzt = performance.now();
    const echt = Math.min(1, (jetzt - letzteEcht) / 1000);
    letzteEcht = jetzt;
    fahrtTick();
    // Meldung: Zeit zählt nur sichtbar und nicht angehalten; während der Kamerafahrt bleibt sie stehen
    if (meldung) {
      // Während der Kamerafahrt geht die Meldung kurz vor (Ankündigungen, Funk): man sieht, warum die Kamera fährt,
      // und hat "Zurück" zur Hand. Wichtige Meldungen (ab WICHTIG_AB) bleiben vorn.
      if (gewuenscht) game.meldungen?.wunsch('ankunft', fahrt && fahrt.k === meldung.k ? VORRANG_FAHRT : (VORRANG.ankunft ?? 53));
      const darf = game.meldungen ? game.meldungen.darf('ankunft') : true;
      box.classList.toggle('zurueck', !darf);
      const b = document.body.classList;
      const steht = darf && !b.contains('building') && !b.contains('card-open') && !b.contains('foto');
      if (steht && !game.paused && !(fahrt && fahrt.k === meldung.k)) meldung.sichtbar += echt;
      // Wer zu lange wartet, kommt nicht mehr: das Schiff liegt dann längst
      if (!steht && meldung.k.fertig() && jetzt - meldung.k.seit > 30000) schliesseMeldung();
      else if (meldung.sichtbar >= MELDUNG_S) schliesseMeldung();
      else zeichne();
    }
    pruefZeit += echt;
    if (pruefZeit < 0.2) return;
    pruefZeit = 0;
    let rect = null;
    try { rect = game.gelaende?.spielRect?.() ?? null; } catch { rect = null; }
    for (const [key, k] of kandidaten) {
      if (k.angesagt) { if (k.fertig() && !(fahrt?.k === k) && meldung?.k !== k) kandidaten.delete(key); continue; }
      if (k.fertig()) { kandidaten.delete(key); if (key.startsWith('besucher:')) imRevier.delete(Number(key.slice(9))); continue; }
      if (game.paused) continue;
      if (k.bereit ? k.bereit() : imBereich(k.pos(), rect)) ansagen(k);
    }
  });

  game.on('einstellungen', (d) => { if (d?.name === 'ankuenfte' && d.an !== 'kamera') abbrechen(); });

  // Zum Ausprobieren: ?ankunft=kreuzfahrt|flottenbesuch|windjammer plant den Besuch für heute
  const ID_VON = { kreuzfahrt: 'kreuzfahrtterminal', flottenbesuch: 'marineanleger', windjammer: 'museumshafen' };
  function probe(art) {
    const id = ID_VON[art];
    if (!id || !game.services?.planeBesuch) return false;
    const ok = game.services.planeBesuch(id, game.state?.tag ?? 1);
    game.emit('services:gebaut');
    return ok;
  }
  const probeArt = params.get('ankunft');
  if (probeArt) {
    const t = setInterval(() => { if (game.services?.planeBesuch && game.state) { clearInterval(t); probe(probeArt); } }, 200);
    setTimeout(() => clearInterval(t), 30000);
  }

  game.ankunft = {
    get laeuft() { return !!fahrt; },
    ansehen: (key) => ansehen(key ? kandidaten.get(key) : undefined),
    zurueck,
    aktuelle: () => [...kandidaten.values()].map((k) => ({ key: k.key, titel: k.titel, angesagt: !!k.angesagt, fertig: k.fertig(), pos: k.pos() })),
    meldung: () => (meldung ? { key: meldung.k.key, titel: meldung.k.titel } : null),
    lage: () => ({ ...lage(), grund: grundGegenKamera(lage()) }),
    get letzterGrund() { return letzterGrund; },
    probe,
  };
}

export default init;
