// Meldung zum Havaristen (Paket P37, docs/havarie.md) im gemeinsamen Meldeplatz (ui/meldungen.js).
//
// Treibt ein Havarist vor der Einfahrt, steht oben eine Meldung: Boot, Schaden, wer ihn holt, was es bringt.
// Passende freie Boxen leuchten gold. Der Spieler tippt den Vorschlag ("Box B03"), "Andere" oder eine
// leuchtende Box im Hafen an; "Ablehnen" lässt ihn ziehen. Ein schmaler Balken zeigt die Frist (nur
// sichtbare Zeit zählt, wie bei der Funk-Anmeldung). Danach bestätigt die Meldung kurz, wer schleppt;
// in der Box steigt "Eingeschleppt: +60 €" über dem Boot auf. Antippen des Havaristen öffnet die Meldung wieder.
// Tempo ändert sich nie von selbst.
import { VORRANG } from './meldungen.js';
import { wunschName } from './vorschau.js';
import { HAV, HELFER, GRUENDE } from '../features/havarie.js';

const BESTAETIGT_S = 6;
const NACHRICHT_S = 5;
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const meter = (m) => `${String(Math.round(m * 10) / 10).replace('.', ',')} m`;
const liste = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}`);
const GOLD = '#ffd23f';

const CSS = `
#hm-havarie { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(440px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px 12px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-havarie:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-havarie[hidden], #hm-havarie.zurueck, body.building #hm-havarie, body.foto #hm-havarie,
body.card-open #hm-havarie { display: none !important; }
#hm-havarie > .hm-sym { flex: none; width: 24px; height: 24px; margin-top: 2px; }
#hm-havarie .hv-text { flex: 1; min-width: 0; }
#hm-havarie strong { display: block; font-weight: 600; cursor: pointer; }
#hm-havarie .hv-satz { display: block; font-size: max(13px, .8125rem); }
#hm-havarie .hv-knoepfe { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#hm-havarie .hv-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 10px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-havarie .hv-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-havarie .hv-knoepfe .hm-primaer { flex: 1 1 auto; }
#hm-havarie .hv-frist { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 4px; background: #e3d9c6; }
#hm-havarie .hv-frist > i { display: block; height: 100%; background: #ee6454; width: 100%; }
@media (max-width: 420px) { #hm-havarie .hv-knoepfe .hm-knopf { padding: 4px 8px; font-size: 13px; } }
@media (max-height: 500px) {
  #hm-havarie { gap: 8px; padding: 6px 10px 9px; line-height: 1.2; }
  #hm-havarie > .hm-sym { width: 20px; height: 20px; margin-top: 0; }
  #hm-havarie .hv-satz { font-size: 12px; }
  #hm-havarie .hv-knoepfe { margin-top: 4px; }
  #hm-havarie .hv-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
`;

/** Wer schleppt, als Satzanfang: "ein Fischer", "das Arbeitsboot", "die Seenotretter". */
export function helferWer(art) {
  return { fischer: 'ein Fischer', arbeitsboot: 'das Arbeitsboot', seenotretter: 'die Seenotretter' }[art] ?? 'ein Helfer';
}

/** Satz zum Havaristen, zum Beispiel "Kajütmotorboot, 7,5 m, hat Motorschaden. Möchte Strom." */
export function havarieSatz(h) {
  const b = h.boot;
  const art = b.bootsname ? `${b.name}, ` : '';
  const w = b.wishes?.length ? ` Möchte ${liste(b.wishes.map(wunschName))}.` : '';
  return `${art}${meter(b.length)}, ${GRUENDE[h.grund]?.satz ?? 'hat einen Schaden'}.${w}`;
}

export function initHavarieMeldung(game) {
  if (typeof document === 'undefined') return;
  const sim = game.sim;
  const hv = game.havarie;

  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-havarie';
  box.className = 'hm-px';
  box.setAttribute('role', 'alert');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-havarie', 'havarie');

  // Zustand nur für die Oberfläche: was gerade steht und wie lange sie sichtbar war
  let art = null;           // 'frage' | 'bestaetigt' | 'nachricht'
  let sichtbar = 0;         // Sekunden sichtbar (Frage: Frist, sonst Anzeigedauer)
  let auswahl = 0;
  let nachricht = null;     // { titel, satz }
  let zuletzt = null;       // Tag und Boot, für das die Frage schon lief (nach dem Laden neu)
  let gewuenscht = false;
  let zeichen = '';

  const heute = () => hv.heute();
  const frist = () => HAV?.frist ?? 45;

  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch('havarie', VORRANG.havarie ?? 62);
    else game.meldungen?.fertig('havarie');
  }
  const knopf = (text, primaer, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hm-knopf hm-px${primaer ? ' hm-primaer' : ''}`;
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  };

  // Boxen gold, solange die Frage steht und kein Boot gewählt ist (die Auswahl hat Vorrang)
  let markiert = null;
  let gewaehltVorher = null;
  function leuchte(ids) {
    const gewaehlt = sim.selected;
    if (gewaehltVorher != null && gewaehlt == null) markiert = null;
    gewaehltVorher = gewaehlt;
    if (gewaehlt != null) { markiert = null; return; }
    const k = ids?.length ? ids.join(',') : null;
    if (markiert === k) return;
    if (k == null && markiert == null) return;
    markiert = k;
    game.stege?.highlight?.(ids ?? [], GOLD);
  }

  function zeigeHavarist() {
    const p = game.havarieBild?.havarist?.();
    if (p) game.camera?.flyTo?.(p.x, p.z);
  }

  function zeichne(erzwingen = false) {
    const h = heute();
    const frei = art === 'frage' ? hv.plaetze() : [];
    const sig = JSON.stringify([art, h?.phase, h?.platz, auswahl, frei.slice(0, 10), nachricht?.titel]);
    if (!erzwingen && sig === zeichen) return;
    zeichen = sig;
    const sym = document.createElement('i');
    sym.className = 'hm-sym';
    sym.setAttribute('aria-hidden', 'true');
    sym.style.setProperty('--sym', 'var(--px-warnung, var(--px-funk))');
    const text = document.createElement('div');
    text.className = 'hv-text';
    const titel = document.createElement('strong');
    titel.addEventListener('click', (e) => { e.stopPropagation(); zeigeHavarist(); });
    const satz = document.createElement('span');
    satz.className = 'hv-satz';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'hv-knoepfe';
    const teile = [sym, text];
    if (art === 'nachricht' && nachricht) {
      titel.textContent = nachricht.titel;
      satz.textContent = nachricht.satz;
      knoepfe.append(knopf('Gut', true, schliessen));
    } else if (art === 'bestaetigt' && h) {
      titel.textContent = `Box ${h.platz} ist frei gehalten`;
      const name = h.boot.bootsname ? `„${h.boot.bootsname}“` : 'den Havaristen';
      const wer = helferWer(h.helfer);
      satz.textContent = `${wer[0].toUpperCase()}${wer.slice(1)} ${h.helfer === 'seenotretter' ? 'schleppen' : 'schleppt'} ${name} herein. Die letzten Meter verholt die Crew selbst.`;
      knoepfe.append(knopf('Gut', true, schliessen), knopf('Zeigen', false, zeigeHavarist));
    } else if (art === 'frage' && h) {
      const name = h.boot.bootsname ? `„${h.boot.bootsname}“` : 'Ein Boot';
      titel.textContent = `Notruf: ${name} treibt vor der Einfahrt`;
      const helfer = hv.helfer();
      const lohn = HAV?.schlepplohn?.[h.boot.size] ?? 0;
      const werft = hv.werft?.();
      const wer = helferWer(helfer);
      let s = `${havarieSatz(h)} ${wer[0].toUpperCase()}${wer.slice(1)} ${helfer === 'seenotretter' ? 'schleppen' : 'schleppt'} ihn in die Box, die du ihm gibst.`;
      s += ` Bringt ${euro(lohn)} Schlepplohn${werft ? ', Arbeit für die Werft' : ''} und einen Stammgast.`;
      satz.textContent = s;
      if (frei.length) {
        const i = auswahl % frei.length;
        knoepfe.append(knopf(`Box ${frei[i]}`, true, () => waehle(frei[i])));
        if (frei.length > 1) knoepfe.append(knopf('Andere', false, () => { auswahl = i + 1; zeigePlatz(frei[(i + 1) % frei.length]); zeichne(); }));
      } else {
        satz.textContent += ' Gerade ist keine passende Box frei.';
        knoepfe.append(knopf('Zeigen', true, zeigeHavarist));
      }
      knoepfe.append(knopf('Ablehnen', false, ablehnen));
      const f = document.createElement('div');
      f.className = 'hv-frist';
      f.append(document.createElement('i'));
      teile.push(f);
    } else {
      box.replaceChildren();
      return;
    }
    text.append(titel, satz, knoepfe);
    box.replaceChildren(...teile);
    fristZeichnen();
  }
  function fristZeichnen() {
    const i = box.querySelector('.hv-frist > i');
    if (i) i.style.width = `${Math.max(0, 100 - (sichtbar / frist()) * 100).toFixed(1)}%`;
  }
  function zeigePlatz(platzId) {
    const p = game.stege?.platz?.(platzId);
    if (p?.x != null && p?.z != null) game.camera?.flyTo?.(p.x, p.z);
  }

  function waehle(platzId) {
    const r = hv.zuweisen(platzId);
    if (!r?.ok) { auswahl = 0; zeichne(true); return; }
    art = 'bestaetigt';
    sichtbar = 0;
    leuchte(null);
    zeigeHavarist();
    game.emit('havarie:zugewiesen', { platz: platzId });
    zeichne(true);
  }
  function ablehnen() {
    hv.ablehnen('abgelehnt');
    schliessen();
  }
  function oeffnen(neu) {
    art = neu;
    sichtbar = 0;
    box.hidden = false;
    wuensche(true);
    zeichne(true);
  }
  function schliessen() {
    art = null;
    nachricht = null;
    box.hidden = true;
    box.replaceChildren();
    zeichen = '';
    leuchte(null);
    wuensche(false);
  }
  function melde(titel, satzText) {
    nachricht = { titel, satz: satzText };
    oeffnen('nachricht');
  }

  // Box im Hafen antippen, solange die Frage steht (und kein wartendes Boot gewählt ist)
  game.on('tap', ({ pick } = {}) => {
    if (!pick) return;
    if (pick.type === 'havarie') {
      const h = heute();
      if (h?.phase === 'treibt' && art !== 'frage') oeffnen('frage');
      else if (h?.phase === 'zugewiesen' && !art) oeffnen('bestaetigt');
      return;
    }
    if (pick.type !== 'berth' || art !== 'frage' || sim.selected != null) return;
    if (hv.plaetze().includes(String(pick.id))) waehle(String(pick.id));
  });

  // Takt: Sichtbarkeit nach der Meldungs-Ordnung, Frist nur zählen, solange die Meldung zu sehen ist
  let letzte = performance.now();
  function takt() {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    const h = heute();
    // Neue Frage, sobald er treibt (einmal je Havarist; nach dem Laden wieder)
    const schluessel = h ? `${h.tag}:${h.boot.id}` : null;
    if (h?.phase === 'treibt' && zuletzt !== schluessel && art !== 'frage') { zuletzt = schluessel; oeffnen('frage'); }
    if (art === 'frage' && h?.phase !== 'treibt') schliessen();
    if (art === 'bestaetigt' && h?.phase !== 'zugewiesen' && h?.phase !== 'fest') schliessen();
    if (!art) { leuchte(null); return; }
    const darf = game.meldungen ? game.meldungen.darf('havarie') : true;
    box.classList.toggle('zurueck', !darf);
    const body = document.body.classList;
    const steht = darf && !box.hidden && !body.contains('card-open') && !body.contains('building') && !body.contains('foto');
    leuchte(steht && art === 'frage' ? hv.plaetze() : null);
    if (!steht) return;
    if (art === 'frage') zeichne();
    // Pause hält die Frist an (die Spielzeit steht)
    if (!game.paused && !(game.speed === 0)) sichtbar += dt;
    fristZeichnen();
    if (art === 'frage' && sichtbar >= frist()) {
      hv.ablehnen('frist');
      const name = h?.boot?.bootsname ? `„${h.boot.bootsname}“` : 'Der Havarist';
      melde(`${name} wird abgeschleppt`, 'Niemand hat geantwortet: Ein Helfer aus dem Nachbarhafen holt ihn. Beim nächsten Notruf schneller eine Box geben.');
      return;
    }
    if (art === 'bestaetigt' && sichtbar >= BESTAETIGT_S) schliessen();
    if (art === 'nachricht' && sichtbar >= NACHRICHT_S) schliessen();
  }
  setInterval(takt, 250);
  game.on('meldungen:wechsel', () => { if (art) box.classList.toggle('zurueck', !game.meldungen.darf('havarie')); });
  for (const ev of ['sim:berthState', 'sim:arrived']) game.on(ev, () => { if (art === 'frage') requestAnimationFrame(() => zeichne()); });
  const zuruecksetzen = () => { schliessen(); zuletzt = null; };
  game.on('spielstand-geladen', zuruecksetzen);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') zuruecksetzen(); });

  // In der Box fest: Schlepplohn über dem Boot, mit Werft auch die Reparatur
  game.on('sim:havarie', (e) => {
    if (e?.phase === 'fest') {
      const teile = [`Eingeschleppt: +${euro(e.lohn ?? 0)}`];
      setTimeout(() => game.flugtext?.(e.boatId, teile.join(''), true), 400);
      if (e.werft) setTimeout(() => game.flugtext?.(e.boatId, 'Die Werft repariert ihn', true), 2600);
    }
    if (e?.phase === 'weg' && e.grund === 'abend' && e.sichtbar) {
      const h = heute() ?? sim.state?.modules?.havarie?.heute;
      const name = h?.boot?.bootsname ? `„${h.boot.bootsname}“` : 'Der Havarist';
      melde(`${name} wird abgeschleppt`, 'Am Abend holt ihn ein Helfer aus dem Nachbarhafen.');
    }
    if (e?.phase === 'treibt' && e.neu) { zuletzt = null; }
    if (e?.phase === 'weg' && e.grund === 'voll') {
      const h = heute();
      const name = h?.boot?.bootsname ? `„${h.boot.bootsname}“` : 'Der Havarist';
      melde(`${name} findet keine Box`, 'Alle passenden Boxen sind belegt: Ein Helfer bringt ihn in einen anderen Hafen.');
    }
  });

  game.havarieMeldung = { offen: () => art, waehle, ablehnen, oeffnen: () => oeffnen('frage') };
}

export { HELFER };
export default initHavarieMeldung;
