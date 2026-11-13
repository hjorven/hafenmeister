#!/usr/bin/env node
// Hafenmeister: Balancing ohne Grafik.
//
// Spielt die echten Spielregeln (web/js/sim.js) mit den Zahlen aus web/js/data/economy.js und den
// Liegeplätzen aus web/js/data/harbor.js viele Male durch und meldet, wie lange jede
// Ausbaustufe dauert. Drei Spielertypen: "geschickt" (kauft sofort das Sinnvollste),
// "gemütlich" (schaut nur jeden zweiten Tag in den Bauplan, lässt Käufe aus, weist Boote
// nicht immer optimal zu) und zum Vergleich "untätig" (tut nichts, 30 Tage).
//
// Aufruf (aus dem Repo-Hauptordner):
//   node tools/balance.mjs                 Bericht, 60 Durchläufe je Spielertyp
//   node tools/balance.mjs --laeufe 200    mehr Durchläufe
//   node tools/balance.mjs --pruefen       nur Daten prüfen (Exit-Code 1 bei Fehlern)
//   node tools/balance.mjs --json          Ergebnis als JSON (für CI oder Diagramme)
//   node tools/balance.mjs --verlauf 1     Tagesprotokoll eines Laufs (Seed 1, geschickt)
//
// Services kommen aus web/js/services/rules.js, Ereignisse sind nicht eingerechnet
// (siehe docs/balancing.md).

import { pathToFileURL } from 'node:url';
import { ECONOMY as E } from '../web/js/data/economy.js';
import { HAFEN as HAFEN_DATEI } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { SERVICES, GROSSSCHIFF_BESUCHE } from '../web/js/data/services.js';
import { createState } from '../web/js/state.js';
import * as sim from '../web/js/sim.js';
import { erstelleRegeln, mitZahlen, neuerZustand } from '../web/js/services/rules.js';
import { createScheduler } from '../web/js/events/scheduler.js';
import { pruefeZahlen } from './zahlen.mjs';
import { zufallAus } from '../web/js/random.js';

// Hat harbor.js für eine Stufe aus economy.js noch keine Plätze (Stufe 6 vor dem Export der
// Pier), rechnet das Werkzeug mit den Plätzen der letzten Hafenstufe weiter und sagt das.
const HAFEN_STUFEN = Math.max(...HAFEN_DATEI.plaetze.flatMap((p) => p.stufen));
const ECO_STUFEN = Math.max(...E.stufen.map((x) => x.stufe));
export const HAFEN_ERGAENZT = ECO_STUFEN > HAFEN_STUFEN;
const HAFEN = HAFEN_ERGAENZT ? {
  ...HAFEN_DATEI,
  plaetze: HAFEN_DATEI.plaetze.map((p) => p.stufen.includes(HAFEN_STUFEN)
    ? { ...p, stufen: [...p.stufen, ...Array.from({ length: ECO_STUFEN - HAFEN_STUFEN }, (_, i) => HAFEN_STUFEN + 1 + i)],
      tiefe: { ...p.tiefe, ...Object.fromEntries(Array.from({ length: ECO_STUFEN - HAFEN_STUFEN }, (_, i) => [HAFEN_STUFEN + 1 + i, p.tiefe[HAFEN_STUFEN]])) },
      lage: { ...p.lage, ...Object.fromEntries(Array.from({ length: ECO_STUFEN - HAFEN_STUFEN }, (_, i) => [HAFEN_STUFEN + 1 + i, p.lage[HAFEN_STUFEN]])) } }
    : p),
} : HAFEN_DATEI;

// ------------------------------------------------------------------ Zufall (deterministisch)
// Gemeinsamer Zufall des Spiels (web/js/random.js)
const rng = (seed) => zufallAus((seed * 2654435761) >>> 0 || 1);

// ------------------------------------------------------------------ Daten prüfen
export const hinweise = [];
export function pruefen() {
  const fehler = [];
  hinweise.length = 0;
  const plaetze = new Map(HAFEN.plaetze.map((p) => [p.id, p]));
  const besitz = new Map(); // id -> { quelle, stufe }
  const nimm = (id, quelle, stufe) => {
    if (!plaetze.has(id)) {
      // Stufe, die harbor.js noch nicht kennt (Export folgt): nur Hinweis, kein Fehler
      if (stufe > HAFEN_STUFEN) hinweise.push(`${quelle}: Platz ${id} fehlt noch in harbor.js (Stufe ${stufe})`);
      else fehler.push(`${quelle}: Platz ${id} gibt es nicht in harbor.js`);
      return;
    }
    if (!plaetze.get(id).stufen.some((n) => n >= stufe))
      fehler.push(`${quelle}: Platz ${id} gibt es ab Stufe ${stufe} nicht (nur ${plaetze.get(id).stufen.join(',')})`);
    if (besitz.has(id)) fehler.push(`Platz ${id} doppelt: ${besitz.get(id).quelle} und ${quelle}`);
    besitz.set(id, { quelle, stufe });
  };
  E.start.plaetze.forEach((id) => nimm(id, 'start', 1));
  E.stufen.forEach((s) => s.ausbau && s.ausbau.plaetze.forEach((id) => nimm(id, `ausbau ${s.ausbau.id}`, s.stufe + 1)));
  const ids = new Set();
  for (const p of E.stegprojekte) {
    if (ids.has(p.id)) fehler.push(`Stegprojekt ${p.id} doppelt`);
    ids.add(p.id);
    if (!(p.kosten > 0)) fehler.push(`Stegprojekt ${p.id}: kosten fehlt`);
    p.plaetze.forEach((id) => nimm(id, `stegprojekt ${p.id}`, p.stufe));
    // Gekaufte Plätze dürfen beim Umbau nicht verschwinden: je Stufe nie weniger als beim Kauf
    const anzahl = (n) => p.plaetze.filter((id) => plaetze.get(id)?.stufen.includes(n)).length;
    const maxStufe = Math.min(HAFEN_STUFEN, Math.max(...E.stufen.map((x) => x.stufe)));
    for (let n = p.stufe + 1; n <= maxStufe; n++) {
      if (anzahl(n) < anzahl(n - 1)) fehler.push(`Stegprojekt ${p.id}: in Stufe ${n} ${anzahl(n)} statt ${anzahl(n - 1)} Plätze (Ersatz fehlt)`);
    }
  }
  for (const p of HAFEN.plaetze) {
    if (!besitz.has(p.id)) fehler.push(`Platz ${p.id} (Stufen ${p.stufen.join(',')}) gehört zu keinem Projekt`);
  }
  // Je Stufe: Summe der Plätze wie im Katalog
  for (const s of E.stufen) {
    const n = s.stufe;
    if (!HAFEN.stufen[n]) continue;
    const soll = HAFEN.stufen[n].anzahl.gesamt;
    const ist = HAFEN.plaetze.filter((p) => p.stufen.includes(n) && besitz.has(p.id) && besitz.get(p.id).stufe <= n).length;
    if (soll !== ist) fehler.push(`Stufe ${n}: ${ist} Plätze erreichbar, Katalog sagt ${soll}`);
    const mixSumme = Object.values(s.mix).reduce((a, b) => a + b, 0);
    if (Math.abs(mixSumme - 1) > 1e-6) fehler.push(`Stufe ${n}: mix ergibt ${mixSumme}, nicht 1`);
  }
  for (const [k, b] of Object.entries(E.bauwerke)) {
    let vor = 0;
    b.stufen.forEach((st, i) => {
      if (!(st.kosten > 0)) fehler.push(`bauwerke.${k}[${i}]: kosten fehlt`);
      if (st.abStufe < vor) fehler.push(`bauwerke.${k}[${i}]: abStufe sinkt`);
      vor = st.abStufe;
    });
  }
  for (const [k, s] of Object.entries(E.services)) {
    s.stufen.forEach((st, i) => {
      if (!(st.kosten > 0)) fehler.push(`services.${k}[${i}]: kosten fehlt`);
      if (st.unterhalt) fehler.push(`services.${k}[${i}]: unterhalt ist verboten (keine laufenden Kosten)`);
    });
  }
  // Ungelesene Felder, Ja/Nein statt Zahl, Stufen billiger als davor (tools/zahlen.mjs)
  fehler.push(...pruefeZahlen());
  return fehler;
}

// ------------------------------------------------------------------ Spiel mit sim.js
// Die echten Spielregeln (web/js/sim.js) mit den Zahlen aus economy.js, dazu die Services
// (web/js/services/rules.js). Ein Bot spielt: weist Boote zu, kassiert, baut.
const RULES = sim.rulesFromEconomy(E);
const SVC = erstelleRegeln(mitZahlen(SERVICES, E.services));
const PLATZ = new Map(HAFEN.plaetze.map((p) => [p.id, p]));

const PROFILE = {
  // weist alle 5 s zu, wählt den besten Platz, kauft jeden Tag
  geschickt: { zuweisenAlle: 5, kaufAlleTage: 1, auslassen: 0, fehlZuweisung: 0 },
  // schaut nur alle 20 s auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz,
  // kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus
  gemuetlich: { zuweisenAlle: 20, kaufAlleTage: 2, auslassen: 0.35, fehlZuweisung: 0.25 },
  // tut nichts: weist nie zu (Boote fahren nach selbstEinfahrenNach selbst ein), kassiert nie (nur die
  // Kasse des Vertrauens nachts), kauft nichts. Zeigt, was das Spiel ohne Spieler hergibt.
  untaetig: { zuweisenAlle: 5, kaufAlleTage: Infinity, auslassen: 1, fehlZuweisung: 0, nichts: true },
};
// Spielertypen im Bericht, die bis zum Abschluss spielen
const SPIELER = ['geschickt', 'gemuetlich'];

export function spiel(seed, profilName = 'geschickt', { maxTage = 600, protokoll = null, mitEreignissen = true } = {}) {
  const prof = PROFILE[profilName];
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: RULES });
  const state = createState({ seed, rules: RULES });
  const r = rng(seed + 7919);
  const svc = neuerZustand();
  let effekte = SVC.effekte(svc);
  sim.addHook(ctx, 'modifiers', () => ({ sizeFactor: effekte.gaeste, ratingBonus: effekte.ruf }));
  // Ereignisse (Nebel, Sommertag, Sturm, Regatta, Hafenfest, Winter) wie im Spiel
  const plan = mitEreignissen ? createScheduler({ seed }) : null;
  const gebaeude = () => {
    const b = { ...state.buildings, ...svc.gebaut };
    if (effekte.freischalten.includes('regatta') || svc.gebaut.segelclub) b.segelclub = Math.max(b.segelclub ?? 0, 1);
    b.seenotretterSchutz = effekte.sturmschutz;
    return b;
  };
  if (plan) sim.addHook(ctx, 'modifiers', () => {
    plan.advanceTo(state.day, { stage: state.stage, buildings: gebaeude() });
    const m = plan.modifiers();
    const id = plan.current?.id;
    const f = id === 'regatta' ? effekte.regatta : id === 'hafenfest' ? effekte.hafenfest : 1;
    if (f !== 1) { m.visitorFactor *= f; m.serviceIncomeFactor *= f; }
    return m;
  });

  const lauf = { stufeTag: { 1: 1 }, zielTag: {}, sparTage: {}, pausen: [], letzterKauf: 1, kaeufe: 0,
    einStufe: {}, ende: null, grossschiffBesuche: 0, leerlauf: {}, geldAmTag: {} };
  let abgewiesen = {}; let unerfuellt = {};
  const rufWert = () => sim.reputation(state);

  const kaufe = (art, id, kosten, ok) => {
    if (!ok) return false;
    lauf.kaeufe++;
    if (state.day - lauf.letzterKauf > 0) lauf.pausen.push([state.day - lauf.letzterKauf, state.stage]);
    lauf.letzterKauf = state.day;
    protokoll?.push(`Tag ${state.day}: kauft ${art} ${id} für ${kosten} €`);
    return true;
  };

  const optionen = () => {
    const o = [];
    for (const p of sim.openJettyProjects(state, ctx)) {
      const plaetze = RULES.berthProjects[p.id] || [];
      if (!plaetze.some((id) => PLATZ.get(id)?.stufen.includes(state.stage))) continue; // veraltet
      const klassen = new Set(plaetze.map((id) => PLATZ.get(id).klasse));
      const stirn = plaetze.some((id) => PLATZ.get(id).art === 'stirn');
      // Bedarf: Boote dieser Klasse wurden abgewiesen, oder es gibt für die Klasse noch gar keinen
      // Platz (dann kommen ihre Boote gar nicht erst, der Spieler sieht aber den neuen Steg)
      const vorhanden = new Set(sim.availableBerths(state, ctx).map((b) => PLATZ.get(b.id)?.klasse));
      const bedarf = [...klassen].some((k) => abgewiesen[k] > 0 || !vorhanden.has(k)) || (stirn && abgewiesen.stirn > 0);
      const letzteStufe = !E.stufen[state.stage - 1].ausbau;  // Abschluss braucht alle Plätze
      o.push({ art: 'steg', id: p.id, kosten: p.cost, prio: bedarf ? 1 : letzteStufe ? 2 : 3,
        tu: () => sim.buildJettyProject(state, ctx, p.id).ok });
    }
    for (const k of Object.keys(RULES.facilities)) {
      const u = sim.facilityUpgrade(state, ctx, k);
      if (!u || u.reason === 'max' || u.reason === 'stage') continue;
      o.push({ art: 'bauwerk', id: k, kosten: u.cost, prio: unerfuellt[k] > 0 ? 1 : 4,
        tu: () => sim.upgradeFacility(state, ctx, k).ok });
    }
    const on = state.office + 1;
    if (RULES.office.cost[on] && state.stage >= RULES.office.fromStage[on]) {
      o.push({ art: 'buero', id: 'hafenbuero', kosten: RULES.office.cost[on], prio: 2,
        tu: () => sim.upgradeOffice(state, ctx).ok });
    }
    for (const s of SERVICES) {
      const pr = SVC.pruefe(svc, s.id, { stufe: state.stage, ruf: rufWert() });
      if (!pr.freigeschaltet) continue;
      // In der letzten Stufe zählen Besuche großer Schiffe: Anleger mit Besuchen zuerst
      // (auf sie wird gespart wie auf einen fehlenden Steg)
      const besuch = !E.stufen[state.stage - 1].ausbau && GROSSSCHIFF_BESUCHE.includes(pr.def?.wirkung?.besuch?.art);
      o.push({ art: 'service', id: s.id, kosten: pr.kosten, prio: besuch ? 1 : 3, tu: () => {
        if (!sim.spend(state, pr.kosten)) return false;
        SVC.bauen(svc, s.id, { stufe: state.stage, ruf: rufWert(), tag: state.day });
        effekte = SVC.effekte(svc);
        return true;
      } });
    }
    return o;
  };

  const einkaufen = () => {
    for (let runde = 0; runde < 12; runde++) {
      const check = sim.canAdvanceStage(state, ctx);
      const nurGeld = check.missing.length === 1 && check.missing[0] === 'money';
      if (check.ok || nurGeld) {
        lauf.zielTag[state.stage] ??= state.day;
        if (check.ok) {
          lauf.sparTage[state.stage] = state.day - lauf.zielTag[state.stage];
          sim.advanceStage(state, ctx);
          lauf.kaeufe++;
          lauf.stufeTag[state.stage] = state.day;
          protokoll?.push(`Tag ${state.day}: Stufe ${state.stage} erreicht`);
          continue;
        }
        // sparen: nur noch Dringendes, das wenig kostet
        const dring = optionen().filter((o) => o.prio === 1 && o.kosten <= 0.1 * check.goal.cost && o.kosten <= state.money);
        if (!dring.length) break;
        const d = dring.sort((a, b) => a.kosten - b.kosten)[0];
        kaufe(d.art, d.id, d.kosten, d.tu());
        continue;
      }
      const alle = optionen();
      const dringend = alle.filter((o) => o.prio === 1).sort((a, b) => a.kosten - b.kosten)[0];
      if (dringend && dringend.kosten > state.money) break;
      const opts = alle.filter((o) => o.kosten <= state.money);
      if (!opts.length) break;
      opts.sort((a, b) => a.prio - b.prio || a.kosten - b.kosten);
      if (r() < prof.auslassen) break;
      if (!kaufe(opts[0].art, opts[0].id, opts[0].kosten, opts[0].tu())) break;
    }
  };

  const zielErreicht = () => {
    const z = E.stufen[state.stage - 1].ziel;
    if (E.stufen[state.stage - 1].ausbau) return false;
    if (rufWert() < z.ruf) return false;
    if (z.gaeste != null && (state.stageGuests || 0) < z.gaeste) return false;
    if (z.grossschiffBesuche != null && lauf.grossschiffBesuche < z.grossschiffBesuche) return false;
    if (z.allePlaetze && sim.openJettyProjects(state, ctx).some((p) =>
      (RULES.berthProjects[p.id] || []).some((id) => PLATZ.get(id)?.stufen.includes(state.stage)))) return false;
    return true;
  };

  while (state.day < maxTage) {
    const tag = state.day;
    const stufe = state.stage;
    const geldVorher = state.stats.totalIncome;
    abgewiesen = {}; unerfuellt = {};
    const winter = sim.season(state, ctx).winter;
    let liegend = [];
    while (state.day === tag) {
      const events = sim.tick(state, ctx, prof.zuweisenAlle);
      if (!prof.nichts && state.phase === 'day' && state.office < RULES.office.autoAssign) {
        for (const id of [...state.queue]) {
          const passend = sim.fittingBerths(state, ctx, id);
          if (!passend.length) continue;
          const platz = r() < prof.fehlZuweisung ? passend[Math.floor(r() * passend.length)] : passend[0];
          sim.assign(state, ctx, id, platz);
        }
      }
      for (const ev of events) {
        if (ev.type === 'turnedAway') {
          abgewiesen.alle = (abgewiesen.alle || 0) + 1;
        } else if (ev.type === 'feeReady') {
          const b = state.boats[ev.boatId];
          for (const w of b?.wishes ?? []) if (!ev.wishesMet.includes(w)) unerfuellt[w] = (unerfuellt[w] || 0) + 1;
        } else if (ev.type === 'evening') {
          liegend = sim.mooredBoats(state).filter((b) => !b.stationed)
            .map((b) => ({ klasse: b.size, antrieb: b.motor ? 'motor' : 'segel' }));
          if (!prof.nichts) sim.collectAll(state, ctx, true);
        }
      }
    }
    // Abgewiesen: welche Klassen fehlen? Freie Plätze je Klasse prüfen
    if (abgewiesen.alle) {
      const frei = sim.availableBerths(state, ctx).filter((b) => sim.isFree(state, b.id));
      for (const k of ['S', 'M', 'L', 'XL']) if (!frei.some((b) => b.size === k || PLATZ.get(b.id)?.klasse === k)) abgewiesen[k] = 1;
      if (!frei.some((b) => PLATZ.get(b.id)?.art === 'stirn')) abgewiesen.stirn = 1;
    }
    const wetter = plan?.current?.id === 'sturm' ? 'sturm' : (plan && (plan.weather(tag).rain ?? 0) > 0.3) ? 'regen' : 'sonne';
    const abschluss = SVC.tagesabschluss(svc, { tag, winter, wetter, boote: liegend }, r);
    sim.addIncome(state, abschluss.summe);
    // Besuche großer Schiffe (Kreuzfahrtschiff, Flottenbesuch) zählen in der letzten Stufe
    if (!E.stufen[state.stage - 1].ausbau) {
      lauf.grossschiffBesuche += abschluss.besuche.filter((b) => GROSSSCHIFF_BESUCHE.includes(b.art)).length;
    }
    lauf.einStufe[stufe] = (lauf.einStufe[stufe] || 0) + state.stats.totalIncome - geldVorher;

    if (zielErreicht()) { lauf.ende = state.day; break; }
    const kaeufeVorher = lauf.kaeufe;
    if (state.day % prof.kaufAlleTage === 0) einkaufen();
    // Leerlauf: ein Saisontag, an dem der Spieler nichts kaufen konnte (nur zuweisen, kassieren, warten)
    if (!prof.nichts && !winter && lauf.kaeufe === kaeufeVorher) {
      lauf.leerlauf[state.stage] = (lauf.leerlauf[state.stage] || 0) + 1;
    }
    lauf.geldAmTag[state.day] = Math.round(state.stats.totalIncome);
    protokoll?.push(`Tag ${state.day}${winter ? ' (Winter)' : ''}: Stufe ${state.stage}, Geld ${Math.round(state.money)}, Ruf ${rufWert().toFixed(2)}, Gäste ${state.stageGuests}, Boote ${sim.mooredBoats(state).length}, abgewiesen ${state.stats.turnedAway}`);
  }
  return {
    seed, profil: profilName, stufeTag: lauf.stufeTag, ende: lauf.ende, stufe: state.stage, ruf: rufWert(),
    kaeufe: lauf.kaeufe, laengstePause: Math.max(0, ...lauf.pausen.map((x) => x[0])),
    pauseJeStufe: Object.fromEntries(E.stufen.map((x) => [x.stufe, Math.max(0, ...lauf.pausen.filter((p) => p[1] === x.stufe).map((p) => p[0]))])),
    gaeste: state.guests, sparTage: lauf.sparTage, einStufe: lauf.einStufe, abgewiesen: state.stats.turnedAway,
    leerlauf: lauf.leerlauf, geldAmTag: lauf.geldAmTag,
  };
}

// ------------------------------------------------------------------ Bericht
function quantil(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
// Annahme für "mit Vorspulen": die Hälfte der Spielzeit läuft auf der höchsten Stufe
// (2x bis zum Hafenbüro in Stufe 3, danach 3x), die andere Hälfte auf 1x.
const typisch = () => 0.5 + 0.5 / 4;   // halbe Zeit mit Vorspulen 4x (Taste F, Sonne ziehen)
const zahl = (n) => String(n).replace('.', ',');
const fmtZeit = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;

function bericht(laeufe, json) {
  const out = {};
  for (const profil of SPIELER) {
    const res = Array.from({ length: laeufe }, (_, i) => spiel(i + 1, profil));
    const stufen = {};
    const N = E.stufen.length;
    for (let n = 1; n <= N; n++) {
      const dauer = res.map((x) => {
        const a = x.stufeTag[n]; const b = n < N ? x.stufeTag[n + 1] : x.ende;
        return a != null && b != null ? b - a : null;
      }).filter((d) => d != null);
      const spar = res.map((x) => x.sparTage[n]).filter((d) => d != null);
      stufen[n] = { median: quantil(dauer, 0.5), p10: quantil(dauer, 0.1), p90: quantil(dauer, 0.9), fertig: dauer.length,
        sparen: spar.length ? quantil(spar, 0.5) : null, pause: quantil(res.map((x) => x.pauseJeStufe[n]), 0.5),
        leerlauf: quantil(res.map((x) => x.leerlauf[n] || 0), 0.5) };
    }
    const ende = res.map((x) => x.ende).filter(Boolean);
    out[profil] = {
      stufen, laeufe, fertig: ende.length,
      gesamt: { median: quantil(ende, 0.5), p10: quantil(ende, 0.1), p90: quantil(ende, 0.9) },
      laengstePause: quantil(res.map((x) => x.laengstePause), 0.5),
      kaeufe: quantil(res.map((x) => x.kaeufe), 0.5),
      einnahmenTag30: quantil(res.map((x) => x.geldAmTag[30] ?? 0), 0.5),
    };
  }
  // Vergleich: wer nichts tut (30 Tage, Stufe 1)
  const nichts = Array.from({ length: Math.min(laeufe, 20) }, (_, i) => spiel(i + 1, 'untaetig', { maxTage: 31 }));
  out.untaetig = { laeufe: nichts.length, einnahmenTag30: quantil(nichts.map((x) => x.geldAmTag[30] ?? 0), 0.5),
    gaeste: quantil(nichts.map((x) => x.gaeste), 0.5), ruf: quantil(nichts.map((x) => Math.round(x.ruf * 100) / 100), 0.5) };
  if (json) { console.log(JSON.stringify(out, null, 2)); return; }
  const tagMin = (E.zeit.tagSekunden + E.zeit.abendSekunden) / 60;
  for (const profil of SPIELER) {
    const o = out[profil];
    console.log(`\nSpielertyp ${profil} (${o.laeufe} Läufe, ${o.fertig} bis zum Regionsabschluss)`);
    console.log('| Stufe | Name | Spieltage Median | 10 % bis 90 % | davon Sparen | Leerlauf | längste Pause ohne Kauf | Echtzeit bei 1x | mit Vorspulen |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (let n = 1; n <= E.stufen.length; n++) {
      const s = o.stufen[n];
      console.log(`| ${n} | ${E.stufen[n - 1].name} | ${s.median ?? '-'} | ${s.p10 ?? '-'} bis ${s.p90 ?? '-'} | ${s.sparen ?? '-'} | ${s.leerlauf} | ${s.pause} | ${s.median != null ? fmtZeit(s.median * tagMin) : '-'} | ${s.median != null ? fmtZeit(s.median * tagMin * typisch(n)) : '-'} |`);
    }
    const g = o.gesamt;
    let typ = 0; for (let n = 1; n <= E.stufen.length; n++) typ += (o.stufen[n].median || 0) * tagMin * typisch(n);
    console.log(`| | **Gesamt** | **${g.median ?? '-'}** | ${g.p10 ?? '-'} bis ${g.p90 ?? '-'} | | | | **${g.median != null ? fmtZeit(g.median * tagMin) : '-'}** | **${fmtZeit(typ)}** |`);
    console.log(`Käufe (Median): ${o.kaeufe}, längste Pause ohne Kauf (Median): ${o.laengstePause} Tage, Einnahmen bis Tag 30: ${o.einnahmenTag30} €`);
  }
  const u = out.untaetig;
  console.log(`\nZum Vergleich, Spielertyp untätig (${u.laeufe} Läufe, weist nie zu, kassiert nie, kauft nichts): Einnahmen bis Tag 30 ${u.einnahmenTag30} €, Gäste ${u.gaeste}, Ruf ${zahl(u.ruf)}`);
  console.log('Leerlauf = Saisontage der Stufe ohne Kauf (Median, nur zuweisen, kassieren, warten).');
}

// ------------------------------------------------------------------ Aufruf
// Nur wenn direkt gestartet, nicht beim Import aus den Tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (name, std) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : std; };
  const fehler = pruefen();
  if (fehler.length) {
    console.error('Datenfehler:\n- ' + fehler.join('\n- '));
    process.exit(1);
  }
  if (hinweise.length) console.warn('Hinweis:\n- ' + hinweise.join('\n- '));
  if (HAFEN_ERGAENZT) console.warn(`Hinweis: harbor.js kennt nur Stufen bis ${HAFEN_STUFEN}, gerechnet wird dort mit den Plätzen der Stufe ${HAFEN_STUFEN}.`);
  if (args.includes('--pruefen')) {
    console.log(`Daten in Ordnung: ${HAFEN.plaetze.length} Plätze, ${E.stegprojekte.length} Stegprojekte, ${Object.keys(E.bauwerke).length} Bauwerke, ${Object.keys(E.services).length} Services.`);
  } else if (args.includes('--verlauf')) {
    const log = [];
    const res = spiel(wert('--verlauf', 1), args.includes('--gemuetlich') ? 'gemuetlich' : 'geschickt', { protokoll: log });
    console.log(log.join('\n')); console.log(res);
  } else {
    bericht(wert('--laeufe', 60), args.includes('--json'));
  }
}
