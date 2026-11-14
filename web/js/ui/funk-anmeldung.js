// Anmeldung per Funk (Paket P28, docs/funk-anmeldung.md).
//
// Ab "Hafenmeister mit Funk" melden sich morgens ein bis zwei der heute erwarteten Boote an. Eine
// Meldung im Meldeplatz (ui/meldungen.js) nennt Boot, Länge, Ankunftszeit und Wünsche und bietet an,
// eine passende Box frei zu halten ("Box C3 freihalten", "Andere Box", "Nein danke"). Die frei
// gehaltene Box zeigt rot am Schild; kommt das Boot, fährt es direkt hinein und zahlt einen Bonus.
// Im Funk (ui/vorschau.js) stehen angemeldete Boote mit Markierung; Antippen öffnet die Meldung wieder.
//
// Regeln in sim.js (announce, reserveBerth, releaseBerth). Dieses Modul schreibt nichts in den
// Spielstand außer über game.sim.freihalten/freigeben. Tempo bleibt, wie der Spieler es gewählt hat.
// Schnittstelle: game.funkAnmeldung = { zeige(bootId), offen() }.
import { VORRANG } from './meldungen.js';
import { uhrzeitText, wunschName } from './vorschau.js';
import { regelnBereit } from '../features/regeln-bereit.js';

const SICHTBAR_S = 25;      // so lange steht eine Anmeldung ohne Entscheidung (nur sichtbare Zeit zählt)
const BESTAETIGT_S = 5;     // so lange steht die Bestätigung nach dem Freihalten

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const meter = (m) => `${String(Math.round(m * 10) / 10).replace('.', ',')} m`;
const liste = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}`);

/** Name für Texte: Bootsname in Anführungszeichen, sonst die Bootsart. */
export function bootTitel(b) {
  return b?.bootsname ? `„${b.bootsname}“` : (b?.name || 'Ein Boot');
}

/** Satz zur Anmeldung, zum Beispiel "Fahrtenyacht, 12 m, gegen 15:40, möchte Strom und Dusche." */
export function anmeldeSatz(b, rules) {
  const art = b.bootsname ? `${b.name}, ` : '';
  const w = b.wishes?.length ? `, möchte ${liste(b.wishes.map(wunschName))}` : '';
  return `${art}${meter(b.length)}, gegen ${uhrzeitText(b.arriveAt, rules)}${w}.`;
}

const CSS = `
#hm-funk-anmeldung { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(440px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-funk-anmeldung:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-funk-anmeldung[hidden], #hm-funk-anmeldung.zurueck, body.building #hm-funk-anmeldung, body.foto #hm-funk-anmeldung,
body.card-open #hm-funk-anmeldung { display: none !important; }
#hm-funk-anmeldung > .hm-sym { flex: none; width: 24px; height: 24px; margin-top: 2px; }
#hm-funk-anmeldung .fa-text { flex: 1; min-width: 0; }
#hm-funk-anmeldung strong { display: block; font-weight: 600; }
#hm-funk-anmeldung .fa-satz { display: block; font-size: max(13px, .8125rem); }
#hm-funk-anmeldung .fa-knoepfe { display: flex; gap: 6px; margin-top: 8px; }
#hm-funk-anmeldung .fa-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 10px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-funk-anmeldung .fa-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-funk-anmeldung .fa-knoepfe .hm-primaer { flex: 1 1 auto; }
#hm-funk-anmeldung .fa-zaehler { position: absolute; right: 8px; top: 6px; font-size: 12px; color: var(--hm-tinte-2, #5a6a7c); }
`;

export async function init(game) {
  if (typeof document === 'undefined') return;
  await regelnBereit(game);
  const sim = game.sim;
  const st = () => sim.state;
  const rules = () => sim.ctx.rules;

  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-funk-anmeldung';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.hidden = true;
  host.append(box);
  // Meldeplatz (ui/meldungen.js, PR 282) setzt Lage und Breite, wenn es ihn gibt
  game.meldungen?.anmelden?.('#hm-funk-anmeldung', 'funk');

  // Zustand nur für die Oberfläche (nicht im Spielstand): wer heute schon gezeigt oder entschieden ist
  let tag = null;
  const erledigt = new Set();     // Anmeldungen, die der Spieler gesehen und beantwortet (oder liegen gelassen) hat
  let aktuell = null;             // { id, art: 'frage' | 'bestaetigt', auswahl: Index in freihaltbar, sichtbar: s }
  let gewuenscht = false;

  const angemeldet = () => (sim.anmeldungFrei() ? sim.angemeldet() : []);
  const boot = (id) => angemeldet().find((b) => b.id === id) ?? null;
  const winter = () => !!sim.season()?.winter;

  function neuerTag() {
    const s = st();
    if (tag === s.day) return;
    tag = s.day;
    erledigt.clear();
    if (aktuell && !boot(aktuell.id)) schliessen();
  }

  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch('funk', VORRANG.funk);
    else game.meldungen?.fertig('funk');
  }

  const knopf = (text, primaer, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hm-knopf hm-px${primaer ? ' hm-primaer' : ''}`;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };

  let zeichen = '';
  let markiert = null;            // Box, die gerade gold leuchtet (render/stege.js)
  let ziel = null;                // Box, die die Meldung nennt; leuchtet, solange die Meldung steht
  let gewaehltVorher = null;
  const markiere = (platzId) => { ziel = platzId; };
  /** Box im Bild gold leuchten lassen, nur solange die Meldung steht und kein Boot gewählt ist (das hat Vorrang). */
  function leuchte(platzId) {
    const gewaehlt = sim.selected;
    // Nach dem Abwählen eines Boots hat die Auswahl die Markierung gelöscht: neu setzen
    if (gewaehltVorher != null && gewaehlt == null) markiert = null;
    gewaehltVorher = gewaehlt;
    if (gewaehlt != null) { markiert = null; return; }
    if (markiert === platzId) return;
    if (platzId == null && markiert == null) return;
    markiert = platzId;
    game.stege?.highlight?.(platzId ? [platzId] : [], '#ffd23f');
  }
  function zeichne(erzwingen = false) {
    const b = aktuell && boot(aktuell.id);
    if (!b) { box.replaceChildren(); zeichen = ''; markiere(null); return; }
    const freiListe = sim.freihaltbar(b.id);
    const sig = JSON.stringify([b.id, aktuell.art, aktuell.auswahl, b.funk?.platz, freiListe.slice(0, 8), angemeldet().length, erledigt.size]);
    if (!erzwingen && sig === zeichen) return;
    zeichen = sig;
    const sym = document.createElement('i');
    sym.className = 'hm-sym';
    sym.setAttribute('aria-hidden', 'true');
    sym.style.setProperty('--sym', 'var(--px-funk)');
    const text = document.createElement('div');
    text.className = 'fa-text';
    const titel = document.createElement('strong');
    const satz = document.createElement('span');
    satz.className = 'fa-satz';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'fa-knoepfe';
    const bonus = sim.funkBonus(b.id);
    if (aktuell.art === 'bestaetigt' && b.funk?.platz) {
      titel.textContent = `Box ${b.funk.platz} ist frei gehalten`;
      satz.textContent = `${bootTitel(b)} kommt gegen ${uhrzeitText(b.arriveAt, rules())} und fährt direkt hinein. Bonus beim Einlaufen: ${euro(bonus)}.`;
      markiere(b.funk.platz);
      knoepfe.append(knopf('Gut', true, () => fertig()), knopf('Andere', false, andereBox), knopf('Freigeben', false, freigeben));
    } else {
      const frei = freiListe;
      titel.textContent = b.funk?.platz ? `Funk: ${bootTitel(b)}, Box ${b.funk.platz}` : `Funk: ${bootTitel(b)} meldet sich an`;
      satz.textContent = anmeldeSatz(b, rules());
      if (b.funk?.platz) {
        markiere(b.funk.platz);
        knoepfe.append(knopf('Gut', true, () => fertig()), knopf('Andere', false, andereBox), knopf('Freigeben', false, freigeben));
      } else if (frei.length) {
        const i = (aktuell.auswahl ?? 0) % frei.length;
        markiere(frei[i]);
        satz.textContent += ` Box frei halten? Bonus ${euro(bonus)}.`;
        knoepfe.append(knopf(`Box ${frei[i]} freihalten`, true, () => halten(frei[i])));
        if (frei.length > 1) knoepfe.append(knopf('Andere', false, () => { aktuell.auswahl = i + 1; zeigePlatz(frei[(i + 1) % frei.length]); zeichne(); }));
        knoepfe.append(knopf('Nein', false, () => fertig()));
      } else {
        markiere(null);
        satz.textContent += ' Gerade ist keine passende Box frei.';
        knoepfe.append(knopf('Gut', true, () => fertig()));
      }
    }
    text.append(titel, satz, knoepfe);
    const weitere = angemeldet().filter((x) => x.id !== b.id && !erledigt.has(x.id)).length;
    const teile = [sym, text];
    if (weitere) {
      const z = document.createElement('span');
      z.className = 'fa-zaehler';
      z.textContent = `+${weitere}`;
      teile.push(z);
    }
    box.replaceChildren(...teile);
  }

  function zeigePlatz(platzId) {
    const p = game.stege?.platz?.(platzId);
    if (p?.x != null && p?.z != null) game.camera?.flyTo?.(p.x, p.z);
  }

  function halten(platzId) {
    const b = aktuell && boot(aktuell.id);
    if (!b) return;
    const r = sim.freihalten(b.id, platzId);
    if (!r?.ok) { aktuell.auswahl = 0; zeichne(); return; }
    aktuell.art = 'bestaetigt';
    aktuell.sichtbar = 0;
    zeigePlatz(r.berthId);
    game.emit('funk:freigehalten', { id: b.id, platz: r.berthId });
    zeichne();
  }

  function andereBox() {
    const b = aktuell && boot(aktuell.id);
    if (!b) return;
    const frei = sim.freihaltbar(b.id).filter((p) => p !== b.funk?.platz);
    if (!frei.length) return;
    const i = (aktuell.auswahl ?? 0) % frei.length;
    aktuell.auswahl = i + 1;
    const r = sim.freihalten(b.id, frei[i]);
    if (r?.ok) { zeigePlatz(r.berthId); aktuell.art = 'bestaetigt'; aktuell.sichtbar = 0; }
    zeichne();
  }

  function freigeben() {
    const b = aktuell && boot(aktuell.id);
    if (b) sim.freigeben(b.id);
    fertig();
  }

  function fertig() {
    if (aktuell) erledigt.add(aktuell.id);
    schliessen();
    naechste();
  }

  function schliessen() {
    aktuell = null;
    box.hidden = true;
    box.replaceChildren();
    zeichen = '';
    markiere(null);
    wuensche(false);
  }

  /** Nächste unbeantwortete Anmeldung zeigen (am Tag, nicht im Winter). */
  function naechste() {
    if (aktuell || st()?.phase !== 'day' || winter()) return;
    const b = angemeldet().find((x) => !erledigt.has(x.id) && x.status === 'expected');
    if (!b) return;
    aktuell = { id: b.id, art: 'frage', auswahl: 0, sichtbar: 0 };
    zeichne();
    box.hidden = false;
    wuensche(true);
  }

  /** Meldung (wieder) zeigen, zum Beispiel aus dem Funk heraus. */
  function zeige(id) {
    const b = boot(Number(id));
    if (!b) return false;
    erledigt.delete(b.id);
    aktuell = { id: b.id, art: 'frage', auswahl: 0, sichtbar: 0 };
    zeichne(true);
    box.hidden = false;
    wuensche(true);
    return true;
  }

  // Takt: Sichtbarkeit nach der Meldungs-Ordnung, Zeit nur zählen, solange die Meldung steht
  let letzte = performance.now();
  function takt() {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (!st()) return;
    neuerTag();
    if (aktuell && (!boot(aktuell.id) || st().phase !== 'day' || winter())) schliessen();
    if (!aktuell) naechste();
    if (!aktuell) { leuchte(null); return; }
    const darf = game.meldungen ? game.meldungen.darf('funk') : true;
    box.classList.toggle('zurueck', !darf);
    const steht = darf && !box.hidden && !document.body.classList.contains('card-open')
      && !document.body.classList.contains('building') && !document.body.classList.contains('foto');
    leuchte(steht ? ziel : null);
    if (!steht) return;
    aktuell.sichtbar += dt;
    const grenze = aktuell.art === 'bestaetigt' ? BESTAETIGT_S : SICHTBAR_S;
    if (aktuell.sichtbar >= grenze) fertig();
  }
  setInterval(takt, 250);
  game.on('meldungen:wechsel', () => { if (aktuell) box.classList.toggle('zurueck', !game.meldungen.darf('funk')); });

  // Liste neu zeichnen, wenn sich Boxen ändern (andere Boote, Abreisen), damit die angebotene Box passt
  let neuZeichnen = false;
  for (const ev of ['sim:berthState', 'sim:arrived']) {
    game.on(ev, () => {
      if (!aktuell || neuZeichnen) return;
      neuZeichnen = true;
      requestAnimationFrame(() => { neuZeichnen = false; if (aktuell) zeichne(); });
    });
  }
  game.on('sim:dayStart', () => { neuerTag(); naechste(); });
  game.on('sim:announced', () => naechste());
  game.on('spielstand-geladen', () => { schliessen(); tag = null; });
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') { schliessen(); tag = null; } });

  // Bonus über dem Boot, sobald es in seiner Box fest ist
  const bonusOffen = new Map();
  game.on('sim:reservationKept', (e) => {
    if (e?.boatId == null) return;
    bonusOffen.set(e.boatId, e.amount);
    setTimeout(() => zeigeBonus(e.boatId), 120000);   // Rückfall, falls die Ansicht nichts meldet (lange Anfahrt von See)
  });
  function zeigeBonus(id) {
    if (!bonusOffen.has(id)) return;
    const betrag = bonusOffen.get(id);
    bonusOffen.delete(id);
    game.flugtext?.(id, `Box frei gehalten: +${euro(betrag)}`, true);
  }
  game.on('boat:moored', (e) => {
    if (e?.id == null || !bonusOffen.has(e.id) || /^(boje|anker)-/.test(String(e.berth ?? ''))) return;
    setTimeout(() => zeigeBonus(e.id), 300);
  });

  game.funkAnmeldung = {
    zeige,
    offen: () => (aktuell ? { ...aktuell } : null),
  };
}

export default init;
