// Meldung zum Jugendtraining (Paket P39, docs/jugendtraining.md) im gemeinsamen Meldeplatz (ui/meldungen.js).
//
// Am Trainingstag steht morgens die Frage: Wie viele Optis und Jollen segeln, was es bringt, und die
// knappste passende freie Box für das Trainerboot. Passende Boxen leuchten gold; der Spieler tippt den
// Vorschlag, "Andere" oder eine leuchtende Box im Hafen an, oder sagt ab. Ein schmaler Balken zeigt, wie
// lange es noch bis zum Auslaufen ist (Spielzeit). Nach der Wahl kann er die Box als feste Trainerbox
// merken ("Immer diese Box"); dann liegt das Trainerboot an den nächsten Trainingstagen von selbst dort,
// und die Meldung sagt das nur kurz. Kurze Meldungen: Auslaufen (Einfahrt frei), Zurück (Beitrag und
// Anker), Ausfall (Wind, Sturm, keine Box). Antippen eines Optis oder des Trainerboots zeigt den Stand.
// Tempo ändert sich nie von selbst.
import { VORRANG } from './meldungen.js';
import { JT } from '../features/jugendtraining.js';

const KURZ_S = 7;
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const komma = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const GOLD = '#ffd23f';

const CSS = `
#hm-jugend { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(440px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px 12px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-jugend:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-jugend[hidden], #hm-jugend.zurueck, body.building #hm-jugend, body.foto #hm-jugend,
body.card-open #hm-jugend { display: none !important; }
#hm-jugend > .hm-sym { flex: none; width: 24px; height: 24px; margin-top: 2px; }
#hm-jugend .jt-text { flex: 1; min-width: 0; }
#hm-jugend strong { display: block; font-weight: 600; cursor: pointer; }
#hm-jugend .jt-satz { display: block; font-size: max(13px, .8125rem); }
#hm-jugend .jt-knoepfe { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
#hm-jugend .jt-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 10px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-jugend .jt-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-jugend .jt-knoepfe .hm-primaer { flex: 1 1 auto; }
#hm-jugend .jt-frist { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 4px; background: #e3d9c6; }
#hm-jugend .jt-frist > i { display: block; height: 100%; background: #3f8fd0; width: 100%; }
@media (max-width: 420px) { #hm-jugend .jt-knoepfe .hm-knopf { padding: 4px 8px; font-size: 13px; } }
@media (max-height: 500px) {
  #hm-jugend { gap: 8px; padding: 6px 10px 9px; line-height: 1.2; }
  #hm-jugend > .hm-sym { width: 20px; height: 20px; margin-top: 0; }
  #hm-jugend .jt-satz { font-size: 12px; }
  #hm-jugend .jt-knoepfe { margin-top: 4px; }
  #hm-jugend .jt-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
`;

/** "5 Optis", "6 Optis und 2 Jollen" */
export function gruppeText(g) {
  if (!g) return 'Die Jugend';
  const o = `${g.optis} Opti${g.optis === 1 ? '' : 's'}`;
  return g.jollen ? `${o} und ${g.jollen} Jolle${g.jollen === 1 ? '' : 'n'}` : o;
}

export function initJugendMeldung(game) {
  if (typeof document === 'undefined') return;
  const sim = game.sim;
  const jt = game.jugendtraining;

  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-jugend';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-jugend', 'jugend');

  let art = null;           // 'frage' | 'bestaetigt' | 'auto' | 'nachricht'
  let sichtbar = 0;         // Sekunden sichtbar (kurze Meldungen schließen danach)
  let auswahl = 0;
  let nachricht = null;     // { titel, satz }
  let gefragt = null;       // Tag, für den die Frage schon kam
  let gewuenscht = false;
  let zeichen = '';

  const heute = () => jt.heute();
  function wuensche(an) {
    if (an === gewuenscht) return;
    gewuenscht = an;
    if (an) game.meldungen?.wunsch('jugend', VORRANG.jugend ?? 58);
    else game.meldungen?.fertig('jugend');
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
  function leuchte(ids) {
    if (sim.selected != null) { markiert = null; return; }
    const k = ids?.length ? ids.join(',') : null;
    if (markiert === k) return;
    markiert = k;
    game.stege?.highlight?.(ids ?? [], GOLD);
  }
  function zeigePlatz(platzId) {
    const p = game.stege?.platz?.(platzId);
    if (p?.x != null && p?.z != null) game.camera?.flyTo?.(p.x, p.z);
  }
  function zeigeGruppe() {
    const b = game.jugendBild?.boote?.().find((x) => x.sichtbar);
    const t = game.jugendBild?.trainer?.();
    const p = b ?? t ?? game.jugendBild?.rampe?.()?.unten;
    if (p) game.camera?.flyTo?.(p.x, p.z);
  }

  // Bis zum Auslaufen (Anteil 1 bis 0), für den Balken der Frage
  function rest() {
    const h = heute();
    const L = sim.ctx?.rules?.dayLength ?? 270;
    const beginn = h?.beginnBei ?? (JT?.beginn ?? 0.3) * L;
    const clock = sim.state?.clock ?? 0;
    return Math.max(0, Math.min(1, (beginn - clock) / Math.max(1, beginn)));
  }

  function zeichne(erzwingen = false) {
    const h = heute();
    const frei = art === 'frage' ? jt.plaetze() : [];
    const sig = JSON.stringify([art, h?.phase, h?.platz, auswahl, frei.slice(0, 10), nachricht?.titel, jt.stammbox()]);
    if (!erzwingen && sig === zeichen) return;
    zeichen = sig;
    const sym = document.createElement('i');
    sym.className = 'hm-sym';
    sym.setAttribute('aria-hidden', 'true');
    sym.style.setProperty('--sym', 'var(--px-regatta, var(--px-flagge))');
    const text = document.createElement('div');
    text.className = 'jt-text';
    const titel = document.createElement('strong');
    titel.addEventListener('click', (e) => { e.stopPropagation(); if (h?.platz && art !== 'nachricht') zeigePlatz(h.platz); else zeigeGruppe(); });
    const satz = document.createElement('span');
    satz.className = 'jt-satz';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'jt-knoepfe';
    const teile = [sym, text];
    const g = h?.gruppe;
    const anker = komma(sim.ctx?.rules?.youth?.rating ?? JT?.ruf ?? 0);
    if (art === 'nachricht' && nachricht) {
      titel.textContent = nachricht.titel;
      satz.textContent = nachricht.satz;
      if (nachricht.zeigen) knoepfe.append(knopf('Zeigen', false, zeigeGruppe));
      knoepfe.append(knopf('Gut', true, schliessen));
    } else if (art === 'bestaetigt' && h) {
      titel.textContent = `Box ${h.platz} für das Trainerboot`;
      satz.textContent = `Das Trainerboot kommt vom Slip und legt dort an. Am Vormittag gehen ${gruppeText(g)} ins Wasser.`;
      knoepfe.append(knopf('Gut', true, schliessen));
      if (jt.stammbox() !== h.platz) knoepfe.append(knopf('Immer diese Box', false, () => { jt.merken(h.platz); melde('Feste Trainerbox gemerkt', `An den nächsten Trainingstagen liegt das Trainerboot von selbst in Box ${h.platz}, wenn sie frei ist.`); }));
    } else if (art === 'auto' && h) {
      titel.textContent = 'Heute Jugendtraining';
      satz.textContent = `Das Trainerboot liegt wieder in Box ${h.platz}. Am Vormittag segeln ${gruppeText(g)} hinaus.`;
      knoepfe.append(knopf('Gut', true, schliessen), knopf('Andere Box', false, () => oeffnen('frage')), knopf('Absagen', false, absagen));
    } else if (art === 'frage' && h) {
      titel.textContent = 'Heute Jugendtraining';
      let s = `${gruppeText(g)} segeln am Vormittag aus dem Hafen. Das Trainerboot braucht für den Tag eine Box.`;
      s += ` Der Verein zahlt ${euro(g?.beitrag ?? 0)}, und Gäste, die zusehen, bewerten +${anker} Anker.`;
      satz.textContent = s;
      if (frei.length) {
        const i = auswahl % frei.length;
        knoepfe.append(knopf(`Box ${frei[i]}`, true, () => waehle(frei[i])));
        if (frei.length > 1) knoepfe.append(knopf('Andere', false, () => { auswahl = i + 1; zeigePlatz(frei[(i + 1) % frei.length]); zeichne(); }));
      } else {
        satz.textContent += ' Gerade ist keine passende Box frei.';
      }
      knoepfe.append(knopf('Absagen', false, absagen));
      const f = document.createElement('div');
      f.className = 'jt-frist';
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
    const i = box.querySelector('.jt-frist > i');
    if (i) i.style.width = `${(rest() * 100).toFixed(1)}%`;
  }

  function waehle(platzId) {
    const r = jt.zuweisen(platzId);
    if (!r?.ok) { auswahl = 0; zeichne(true); return; }
    leuchte(null);
    oeffnen('bestaetigt');
  }
  function absagen() {
    jt.absagen();
    melde('Jugendtraining abgesagt', 'Heute bleiben die Optis an Land. Das kostet nichts.');
  }
  function oeffnen(neu) {
    art = neu;
    sichtbar = 0;
    auswahl = 0;
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
  function melde(titel, satzText, zeigen = false) {
    nachricht = { titel, satz: satzText, zeigen };
    oeffnen('nachricht');
  }

  // Box im Hafen antippen, solange die Frage steht; Opti oder Trainerboot antippen zeigt den Stand
  game.on('tap', ({ pick } = {}) => {
    if (!pick) return;
    if (pick.type === 'jugend') {
      const h = heute();
      if (!h) return;
      if (h.phase === 'angekuendigt') oeffnen('frage');
      else if (h.phase === 'bereit') oeffnen(h.auto ? 'auto' : 'bestaetigt');
      else if (h.phase === 'draussen') melde('Jugendtraining', `${gruppeText(h.gruppe)} sind draußen. Das Trainerboot ist dabei, Box ${h.platz ?? '-'} bleibt frei.`, true);
      return;
    }
    if (pick.type !== 'berth' || art !== 'frage' || sim.selected != null) return;
    if (jt.plaetze().includes(String(pick.id))) waehle(String(pick.id));
  });

  // Ereignisse der Regeln
  game.on('sim:jugend', (e) => {
    const h = heute();
    if (e.neu && (e.phase === 'angekuendigt' || e.phase === 'bereit')) {
      gefragt = h?.tag ?? null;
      oeffnen(e.phase === 'bereit' ? 'auto' : 'frage');
      return;
    }
    if (e.neu && e.phase === 'ausgefallen' && (e.grund === 'wind' || e.grund === 'sturm')) {
      melde('Kein Jugendtraining heute', e.grund === 'sturm' ? 'Sturm: Die Optis bleiben an Land.' : 'Zu viel Wind für die Optis: Das Training fällt aus.');
      return;
    }
    if (e.phase === 'draussen') {
      melde(`${gruppeText(e.gruppe)} laufen aus`, 'Die Gruppe braucht das Fahrwasser: Wartende Boote bleiben geduldig an der Boje, bis sie durch ist. Von Hand zuweisen geht weiter.', true);
      return;
    }
    if (e.phase === 'zurueck') {
      const n = e.zuschauer ?? 0;
      const teil = n > 0 ? ` ${n} Gäste haben zugesehen und bewerten je +${komma(e.anker ?? 0)} Anker.` : '';
      melde('Jugendtraining zurück', `Der Segelclub zahlt ${euro(e.beitrag ?? 0)} für die Box.${teil}`);
      if (e.beitrag > 0) setTimeout(() => game.flugtext?.(TRAINER_FLUG, `+${euro(e.beitrag)}`, true), 600);
      return;
    }
    if (e.phase === 'ausgefallen' && e.grund === 'keineBox') {
      melde('Jugendtraining ausgefallen', 'Das Trainerboot hatte keine Box. Beim nächsten Mal vorher eine freie Box geben.');
      return;
    }
    if (e.phase === 'angekuendigt' && e.vorher) {
      melde('Box für das Trainerboot weg', `Box ${e.vorher} gibt es nach dem Umbau nicht mehr. Bitte eine neue geben.`);
      setTimeout(() => oeffnen('frage'), 4000);
    }
  });
  const TRAINER_FLUG = 'jugend-trainer';

  // Takt: Sichtbarkeit nach der Meldungs-Ordnung, kurze Meldungen schließen nach KURZ_S sichtbaren Sekunden
  let letzte = performance.now();
  function takt() {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    const h = heute();
    // Nach dem Laden: die Frage wieder stellen, wenn noch keine Box da ist
    if (h?.phase === 'angekuendigt' && gefragt !== h.tag && art == null) { gefragt = h.tag; oeffnen('frage'); }
    if (art === 'frage' && h?.phase !== 'angekuendigt' && h?.phase !== 'bereit') schliessen();
    if (art === 'frage' && h?.phase === 'bereit' && h.platz && !jt.plaetze().length) schliessen();
    if ((art === 'bestaetigt' || art === 'auto') && h?.phase !== 'bereit') schliessen();
    if (!art) { leuchte(null); return; }
    const darf = game.meldungen ? game.meldungen.darf('jugend') : true;
    box.classList.toggle('zurueck', !darf);
    const body = document.body.classList;
    const steht = darf && !box.hidden && !body.contains('card-open') && !body.contains('building') && !body.contains('foto');
    leuchte(steht && art === 'frage' ? jt.plaetze() : null);
    if (!steht) return;
    if (art === 'frage') zeichne();
    fristZeichnen();
    if (!game.paused && !(game.speed === 0)) sichtbar += dt;
    if (art !== 'frage' && sichtbar >= KURZ_S + (art === 'auto' ? 3 : 0)) schliessen();
  }
  setInterval(takt, 250);
  game.on('meldungen:wechsel', () => { if (art) box.classList.toggle('zurueck', !game.meldungen.darf('jugend')); });
  for (const ev of ['sim:berthState', 'sim:arrived']) game.on(ev, () => { if (art === 'frage') requestAnimationFrame(() => zeichne()); });
  const zuruecksetzen = () => { schliessen(); gefragt = null; };
  game.on('spielstand-geladen', zuruecksetzen);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') zuruecksetzen(); });

  game.jugendMeldung = { offen: () => art, waehle, absagen, oeffnen: () => oeffnen('frage') };
}

export default initJugendMeldung;
