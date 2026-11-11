#!/usr/bin/env node
// Hafenmeister: Balancing ohne Grafik.
//
// Spielt die Regeln aus docs/plan.md mit den Zahlen aus web/js/data/economy.js und den
// Liegeplätzen aus web/js/data/harbor.js viele Male durch und meldet, wie lange jede
// Ausbaustufe dauert. Zwei Spielertypen: "geschickt" (kauft sofort das Sinnvollste) und
// "gemütlich" (schaut nur jeden zweiten Tag in den Bauplan, lässt Käufe aus, weist Boote
// nicht immer optimal zu).
//
// Aufruf (aus dem Repo-Hauptordner):
//   node tools/balance.mjs                 Bericht, 60 Durchläufe je Spielertyp
//   node tools/balance.mjs --laeufe 200    mehr Durchläufe
//   node tools/balance.mjs --pruefen       nur Daten prüfen (Exit-Code 1 bei Fehlern)
//   node tools/balance.mjs --json          Ergebnis als JSON (für CI oder Diagramme)
//   node tools/balance.mjs --verlauf 1     Tagesprotokoll eines Laufs (Seed 1, geschickt)
//
// Solange web/js/sim.js noch fehlt, rechnet dieses Werkzeug mit einem eigenen, schlanken
// Modell der Regeln. Sobald sim.js ohne Grafik läuft, wird das Modell hier durch sim.js
// ersetzt (siehe docs/balancing.md).

import { pathToFileURL } from 'node:url';
import { ECONOMY as E } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';

const KLASSEN = ['S', 'M', 'L', 'XL'];
const RANG = { S: 0, M: 1, L: 2, XL: 3 };

// ------------------------------------------------------------------ Zufall (deterministisch)
function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ganz = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
function poisson(r, l) {
  if (l <= 0) return 0;
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(r)));
  const L = Math.exp(-l); let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
function gauss(r) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
function waehle(r, gewichte) {
  const keys = Object.keys(gewichte); let s = 0;
  for (const k of keys) s += gewichte[k];
  let x = r() * s;
  for (const k of keys) { x -= gewichte[k]; if (x <= 0) return k; }
  return keys[keys.length - 1];
}

// ------------------------------------------------------------------ Daten prüfen
export function pruefen() {
  const fehler = [];
  const plaetze = new Map(HAFEN.plaetze.map((p) => [p.id, p]));
  const besitz = new Map(); // id -> { quelle, stufe }
  const nimm = (id, quelle, stufe) => {
    if (!plaetze.has(id)) fehler.push(`${quelle}: Platz ${id} gibt es nicht in harbor.js`);
    else if (!plaetze.get(id).stufen.includes(stufe))
      fehler.push(`${quelle}: Platz ${id} gibt es in Stufe ${stufe} nicht (nur ${plaetze.get(id).stufen.join(',')})`);
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
  return fehler;
}

// ------------------------------------------------------------------ Modell
const HAFEN_STUFEN = Math.max(...HAFEN.plaetze.flatMap((p) => p.stufen));
const PLATZ = new Map(HAFEN.plaetze.map((p) => [p.id, p]));
const BESITZER = new Map(); // Platz -> Projekt-id
E.start.plaetze.forEach((id) => BESITZER.set(id, 'start'));
E.stufen.forEach((s) => s.ausbau && s.ausbau.plaetze.forEach((id) => BESITZER.set(id, 'ausbau:' + s.ausbau.id)));
E.stegprojekte.forEach((p) => p.plaetze.forEach((id) => BESITZER.set(id, p.id)));

const PROFILE = {
  geschickt: { kaufAlleTage: 1, auslassen: 0, fehlZuweisung: 0, reserve: 0 },
  gemuetlich: { kaufAlleTage: 2, auslassen: 0.35, fehlZuweisung: 0.25, reserve: 0 },
};

function svcWirkung(st, id) { const l = st.services[id] || 0; return l ? E.services[id].stufen[l - 1].wirkung : null; }

export function spiel(seed, profilName = 'geschickt', { maxTage = 900, protokoll = null } = {}) {
  const r = rng(seed);
  const prof = PROFILE[profilName];
  const st = {
    tag: 0, stufe: 1, geld: 0, gebaut: new Set(['start']), bauwerke: {}, services: {}, buero: 0,
    ruf: Array(E.ruf.fenster).fill(E.ruf.start), boote: [], gaesteStufe: 0, tagesgaesteStufe: 0,
    ausbauFertigAm: null, stufeTag: { 1: 0 }, abgewiesen: {}, unerfuellt: {}, letzterKauf: 0,
    pausen: [], einnahmenTag: 0, kaeufe: 0, sturmBis: -1, regattaBis: -1, naechst: {},
    ende: null, gesamtGaeste: 0, zielTag: {}, sparTage: {}, einStufe: {}, ausStufe: {},
  };
  for (const k of Object.keys(E.bauwerke)) st.bauwerke[k] = 0;
  const rufWert = () => st.ruf.reduce((a, b) => a + b, 0) / st.ruf.length;
  const bewerte = (w) => { st.ruf.push(Math.max(1, Math.min(5, w))); st.ruf.shift(); };
  const stufenDaten = () => E.stufen[st.stufe - 1];
  const hs = () => Math.min(st.stufe, HAFEN_STUFEN);  // spätere Stufen nutzen die Plätze der letzten Hafenstufe
  const saisonLaenge = E.zeit.saisonTage + E.zeit.winterTage;
  const naechsterTermin = (alle) => Math.max(1, Math.round(alle * (0.7 + 0.6 * r())));

  const freiePlaetze = () => {
    const belegt = new Set(st.boote.map((b) => b.platz));
    return HAFEN.plaetze.filter((p) => p.stufen.includes(hs()) && st.gebaut.has(BESITZER.get(p.id))
      && p.art !== 'fischer' && !belegt.has(p.id));
  };
  const hatStrom = (p) => {
    if (E.platzarten[p.art]?.strom) return true;
    if (E.stromAnSteg[p.steg]) return true;
    const lv = st.bauwerke.strom || 0;
    return E.bauwerke.strom.stufen.slice(0, lv).some((s) => s.stege.includes(p.steg));
  };
  const passt = (b, p) => {
    if (b.sonder === 'mehrrumpf') return p.art === 'stirn' && p.klasse !== 'S';
    if (b.klasse === 'XL') return p.art === 'kai';
    if (p.art === 'kai') return false;
    return RANG[p.klasse] >= RANG[b.klasse];
  };
  const zuweisen = (b, frei) => {
    const kand = frei.filter((p) => passt(b, p));
    if (!kand.length) return null;
    if (r() < prof.fehlZuweisung) return kand[Math.floor(r() * kand.length)];
    const willStrom = b.wuensche.includes('strom');
    const punkte = (p) => (RANG[p.klasse] - RANG[b.klasse]) * 10 + (p.art === 'stirn' && b.sonder !== 'mehrrumpf' ? 5 : 0)
      - (p.art === 'finger' ? 1 : 0) - (willStrom && hatStrom(p) ? 3 : 0);
    kand.sort((a, c) => punkte(a) - punkte(c));
    return kand[0];
  };

  const kaufOptionen = () => {
    const o = [];
    const n = st.stufe;
    for (const p of E.stegprojekte) {
      if (p.stufe > n || st.gebaut.has(p.id)) continue;
      if (!p.plaetze.some((id) => PLATZ.get(id).stufen.includes(hs()))) continue; // veraltet
      const klassen = new Set(p.plaetze.map((id) => PLATZ.get(id).klasse));
      const bedarf = [...klassen].some((k) => KLASSEN.slice(0, RANG[k] + 1).some((kk) => st.abgewiesen[kk] > 0))
        || (p.plaetze.some((id) => PLATZ.get(id).art === 'stirn') && st.abgewiesen.mehrrumpf > 0);
      o.push({ art: 'steg', id: p.id, kosten: p.kosten, prio: bedarf ? 1 : 3 });
    }
    for (const [k, b] of Object.entries(E.bauwerke)) {
      const lv = st.bauwerke[k]; const next = b.stufen[lv];
      if (!next || next.abStufe > n) continue;
      const wunsch = k === 'strom' ? 'strom' : k;
      o.push({ art: 'bauwerk', id: k, kosten: next.kosten, prio: st.unerfuellt[wunsch] > 0 ? 1 : 4 });
    }
    const bnext = E.hafenbuero.stufen[st.buero];
    if (bnext && bnext.abStufe <= n) o.push({ art: 'buero', id: 'hafenbuero', kosten: bnext.kosten, prio: 2 });
    for (const [k, s] of Object.entries(E.services)) {
      const lv = st.services[k] || 0; const next = s.stufen[lv];
      if (!next || (next.abStufe ?? s.abStufe) > n) continue;
      o.push({ art: 'service', id: k, kosten: next.kosten, prio: 3 });
    }
    return o;
  };
  const kaufe = (opt) => {
    st.geld -= opt.kosten; st.kaeufe++;
    st.ausStufe[st.stufe] = (st.ausStufe[st.stufe] || 0) + opt.kosten;
    if (st.tag - st.letzterKauf > 0) st.pausen.push([st.tag - st.letzterKauf, st.stufe]);
    st.letzterKauf = st.tag;
    if (opt.art === 'steg') st.gebaut.add(opt.id);
    else if (opt.art === 'bauwerk') st.bauwerke[opt.id]++;
    else if (opt.art === 'buero') st.buero++;
    else if (opt.art === 'service') st.services[opt.id] = (st.services[opt.id] || 0) + 1;
    protokoll?.push(`Tag ${st.tag}: kauft ${opt.art} ${opt.id} für ${opt.kosten} €`);
  };

  const zielErreicht = () => {
    const z = stufenDaten().ziel;
    if (rufWert() < z.ruf) return false;
    if (z.gaeste != null && st.gaesteStufe < z.gaeste) return false;
    if (z.tagesgaeste != null && st.tagesgaesteStufe < z.tagesgaeste) return false;
    if (z.allePlaetze && E.stegprojekte.some((p) => p.stufe <= st.stufe && !st.gebaut.has(p.id)
      && p.plaetze.some((id) => PLATZ.get(id).stufen.includes(hs())))) return false;
    return true;
  };

  const abreise = (b) => {
    let w = b.gesamt === 0 ? E.ruf.ohneWunsch : 1 + 4 * b.erfuellt / b.gesamt;
    w += E.platzarten[PLATZ.get(b.platz).art]?.rufBonus || 0;
    if (b.sonder === 'behoerde') w += E.sonderboote.behoerde.rufBonus;
    if (b.sturm) w -= st.services.seenotretter ? E.ereignisse.sturm.rufMalusMitSeenotretter : E.ereignisse.sturm.rufMalus;
    bewerte(w); st.gaesteStufe++; st.gesamtGaeste++;
  };

  while (st.tag < maxTage) {
    st.tag++;
    const tagImJahr = (st.tag - 1) % saisonLaenge;
    const winter = tagImJahr >= E.zeit.saisonTage;
    st.einnahmenTag = 0;
    const s = stufenDaten();

    // Ausbau fertig?
    if (st.ausbauFertigAm != null && st.tag >= st.ausbauFertigAm) {
      st.gebaut.add('ausbau:' + s.ausbau.id);
      st.stufe++; st.stufeTag[st.stufe] = st.tag; st.gaesteStufe = 0; st.tagesgaesteStufe = 0;
      st.ausbauFertigAm = null;
      // Boote auf weggefallenen Plätzen reisen ab
      for (const b of st.boote.filter((b) => !PLATZ.get(b.platz).stufen.includes(hs()))) abreise(b);
      st.boote = st.boote.filter((b) => PLATZ.get(b.platz).stufen.includes(hs()));
      protokoll?.push(`Tag ${st.tag}: Stufe ${st.stufe} erreicht`);
    }

    if (winter) {
      if (tagImJahr === E.zeit.saisonTage) { st.boote.forEach(abreise); st.boote = []; }
      for (const k of Object.keys(st.services)) st.einnahmenTag += svcWirkung(st, k)?.winter?.proTag || 0;
    } else {
      // Ereignisse
      const n = st.stufe;
      const ev = E.ereignisse;
      const sturm = n >= ev.sturm.abStufe && st.tag >= (st.naechst.sturm ??= st.tag + naechsterTermin(ev.sturm.alleTage));
      if (sturm) st.naechst.sturm = st.tag + naechsterTermin(ev.sturm.alleTage);
      const regattaMoeglich = Object.keys(st.services).some((k) => svcWirkung(st, k)?.regatta);
      let regatta = false;
      if (regattaMoeglich && n >= ev.regatta.abStufe) {
        if (st.tag >= (st.naechst.regatta ??= st.tag + naechsterTermin(ev.regatta.alleTage))) {
          st.regattaBis = st.tag + ev.regatta.dauer - 1; st.naechst.regatta = st.tag + naechsterTermin(ev.regatta.alleTage);
        }
        regatta = st.tag <= st.regattaBis;
      }
      let extraXL = 0;
      if (n >= ev.hafenfest.abStufe && st.tag >= (st.naechst.hafenfest ??= st.tag + naechsterTermin(ev.hafenfest.alleTage))) {
        st.naechst.hafenfest = st.tag + naechsterTermin(ev.hafenfest.alleTage);
        st.tagesgaesteStufe += ev.hafenfest.tagesgaeste; st.einnahmenTag += ev.hafenfest.einnahme;
        if (n >= 5) extraXL = ev.hafenfest.extraXL;
      }

      // Ankünfte
      const faktor = E.ruf.ankunftBasis + E.ruf.ankunftJeAnker * (rufWert() - 1);
      const bonus = { S: 1, M: 1, L: 1, XL: 1 };
      for (const k of Object.keys(st.services)) {
        const g = svcWirkung(st, k)?.gaeste; if (g) for (const kl in g) bonus[kl] *= g[kl];
      }
      const neu = [];
      for (const kl of KLASSEN) {
        const anteil = s.mix[kl] || 0; if (!anteil) continue;
        let lam = s.ankuenfte * anteil * faktor * bonus[kl];
        if (regatta) lam *= 1 + (ev.regatta.ankunftFaktorSegel - 1) * E.klassen[kl].segel;
        if (sturm) lam *= ev.sturm.ankunftFaktor[kl] ?? 1;
        let anzahl = poisson(r, lam) + (kl === 'XL' ? extraXL : 0);
        for (let i = 0; i < anzahl; i++) neu.push(kl);
      }
      st.abgewiesen = {};
      let frei = freiePlaetze();
      for (const kl of neu) {
        const k = E.klassen[kl];
        const b = { klasse: kl, motor: r() < k.motor, segel: false, sonder: null, wuensche: [],
          naechte: ganz(r, k.naechte[0], k.naechte[1]), erfuellt: 0, gesamt: 0, sturm: false };
        b.segel = !b.motor && r() < k.segel / (1 - k.motor);
        for (const [sid, sb] of Object.entries(E.sonderboote)) {
          if (sb.klasse === kl && st.stufe >= sb.abStufe && !b.sonder && r() < sb.anteil) b.sonder = sid;
        }
        const moeglich = Object.entries(E.wuensche).filter(([, w]) => w.abStufe <= st.stufe
          && w.klassen.includes(kl) && (!w.nurMotor || b.motor)).map(([id]) => id);
        const [lo, hi] = E.wunschAnzahl[kl];
        const zahl = Math.min(ganz(r, lo, hi), moeglich.length);
        while (b.wuensche.length < zahl) {
          const w = moeglich[Math.floor(r() * moeglich.length)];
          if (!b.wuensche.includes(w)) b.wuensche.push(w);
        }
        const p = zuweisen(b, frei);
        if (!p) {
          const key = b.sonder === 'mehrrumpf' ? 'mehrrumpf' : kl;
          st.abgewiesen[key] = (st.abgewiesen[key] || 0) + 1;
          if (r() < E.ruf.abgewiesen.chance) bewerte(E.ruf.abgewiesen.wertung);
          continue;
        }
        b.platz = p.id; frei = frei.filter((q) => q !== p);
        st.boote.push(b);
      }

      // Abend: Wünsche erfüllen, kassieren
      const rest = {};
      for (const [k, b] of Object.entries(E.bauwerke)) {
        rest[k] = st.bauwerke[k] ? (b.stufen[st.bauwerke[k] - 1].versorgt ?? 0) : 0;
      }
      st.unerfuellt = {};
      const segelFaktor = Object.keys(st.services).reduce((f, k) => f * (svcWirkung(st, k)?.hafengeld?.segel || 1), 1);
      const kunden = Object.keys(st.services).map((k) => svcWirkung(st, k)?.kunden).filter(Boolean);
      for (const b of [...st.boote].sort(() => r() - 0.5)) {
        let ok = 0;
        for (const w of b.wuensche) {
          let gut;
          if (w === 'strom') gut = hatStrom(PLATZ.get(b.platz));
          else { gut = rest[w] > 0; if (gut) rest[w]--; }
          if (gut) ok++; else st.unerfuellt[w] = (st.unerfuellt[w] || 0) + 1;
        }
        b.erfuellt += ok; b.gesamt += b.wuensche.length;
        let preis = E.klassen[b.klasse].grundpreis * (1 + E.wunschBonus * ok);
        if (b.segel) preis *= segelFaktor;
        if (b.sonder === 'behoerde') preis *= E.sonderboote.behoerde.preisFaktor;
        for (const kd of kunden) if (r() < kd.anteil) preis += kd.preis;
        st.einnahmenTag += preis;
        if (sturm) { b.sturm = true; b.naechte += E.ereignisse.sturm.extraNacht; }
        b.naechte--;
      }
      // Fischer, Services, Tagesgäste
      const fischer = HAFEN.plaetze.filter((p) => p.art === 'fischer' && p.stufen.includes(hs()) && st.gebaut.has(BESITZER.get(p.id))).length;
      st.einnahmenTag += fischer * E.fischer.pachtProTag;
      st.tagesgaesteStufe += E.promenade[n] || 0;
      for (const k of Object.keys(st.services)) {
        const w = svcWirkung(st, k);
        st.einnahmenTag += w.proTag || 0;
        st.tagesgaesteStufe += w.tagesgaeste || 0;
        if (w.besuch) {
          const key = 'besuch:' + k;
          if (st.naechst[key] == null) st.naechst[key] = st.tag + (w.besuch.ersterNach ?? w.besuch.alleTage);
          if (st.tag >= st.naechst[key]) {
            st.naechst[key] = st.tag + w.besuch.alleTage;
            st.einnahmenTag += w.besuch.einnahme || 0;
            st.tagesgaesteStufe += w.besuch.gaeste || 0;
            for (let i = 0; i < (w.besuch.ruf || 0); i++) bewerte(5);
          }
        }
      }
      for (const b of st.boote.filter((b) => b.naechte <= 0)) abreise(b);
      st.boote = st.boote.filter((b) => b.naechte > 0);
    }
    st.geld += st.einnahmenTag;
    st.einStufe[st.stufe] = (st.einStufe[st.stufe] || 0) + st.einnahmenTag;

    // Ziel der letzten Stufe
    if (!s.ausbau && zielErreicht()) { st.ende = st.tag; break; }

    // Einkaufen
    if (st.tag % prof.kaufAlleTage === 0) {
      for (let runde = 0; runde < 12; runde++) {
        if (s.ausbau && st.ausbauFertigAm == null && zielErreicht()) {
          st.zielTag[st.stufe] ??= st.tag;
          if (st.geld >= s.ausbau.kosten) {
            st.sparTage[st.stufe] = st.tag - st.zielTag[st.stufe];
            st.geld -= s.ausbau.kosten; st.kaeufe++;
            const tempo = winter ? E.zeit.winterBautempo : 1;
            st.ausbauFertigAm = st.tag + 1 + Math.ceil(s.ausbau.bautage / tempo);
            protokoll?.push(`Tag ${st.tag}: startet Ausbau ${s.ausbau.id}`);
            continue;
          }
          // sparen: nur noch Dringendes, das wenig kostet
          const dring = kaufOptionen().filter((o) => o.prio === 1 && o.kosten <= 0.1 * s.ausbau.kosten && o.kosten <= st.geld);
          if (!dring.length) break;
          kaufe(dring.sort((a, b) => a.kosten - b.kosten)[0]); continue;
        }
        const alle = kaufOptionen();
        // Auf das wichtigste Ziel sparen: das günstigste dringende Projekt (prio 1)
        const dringend = alle.filter((o) => o.prio === 1).sort((a, b) => a.kosten - b.kosten)[0];
        if (dringend && dringend.kosten > st.geld) break;
        const opts = alle.filter((o) => o.kosten <= st.geld - prof.reserve);
        if (!opts.length) break;
        opts.sort((a, b) => a.prio - b.prio || a.kosten - b.kosten);
        if (r() < prof.auslassen) break;
        kaufe(opts[0]);
      }
    }
    protokoll?.push(`Tag ${st.tag}${winter ? ' (Winter)' : ''}: Stufe ${st.stufe}, Geld ${Math.round(st.geld)}, +${Math.round(st.einnahmenTag)}, Ruf ${rufWert().toFixed(2)}, Gäste ${st.gaesteStufe}, Tagesgäste ${st.tagesgaesteStufe}, Boote ${st.boote.length}`);
  }
  return {
    seed, profil: profilName, stufeTag: st.stufeTag, ende: st.ende, stufe: st.stufe, ruf: rufWert(),
    kaeufe: st.kaeufe, laengstePause: Math.max(0, ...st.pausen.map((x) => x[0])),
    pauseJeStufe: Object.fromEntries(E.stufen.map((x) => x.stufe).map((n) => [n, Math.max(0, ...st.pausen.filter((x) => x[1] === n).map((x) => x[0]))])), gaeste: st.gesamtGaeste,
    offen: kaufOptionen().length, sparTage: st.sparTage, einStufe: st.einStufe, ausStufe: st.ausStufe,
  };
}

// ------------------------------------------------------------------ Bericht
function quantil(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
// Annahme für "mit Vorspulen": die Hälfte der Spielzeit läuft auf der höchsten Stufe
// (2x bis zum Hafenbüro in Stufe 3, danach 3x), die andere Hälfte auf 1x.
const typisch = (n) => 0.5 + 0.5 / (n >= 3 ? 3 : 2);
const fmtZeit = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;

function bericht(laeufe, json) {
  const out = {};
  for (const profil of Object.keys(PROFILE)) {
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
        sparen: spar.length ? quantil(spar, 0.5) : null, pause: quantil(res.map((x) => x.pauseJeStufe[n]), 0.5) };
    }
    const ende = res.map((x) => x.ende).filter(Boolean);
    out[profil] = {
      stufen, laeufe, fertig: ende.length,
      gesamt: { median: quantil(ende, 0.5), p10: quantil(ende, 0.1), p90: quantil(ende, 0.9) },
      laengstePause: quantil(res.map((x) => x.laengstePause), 0.5),
      kaeufe: quantil(res.map((x) => x.kaeufe), 0.5),
    };
  }
  if (json) { console.log(JSON.stringify(out, null, 2)); return; }
  const tagMin = (E.zeit.tagSekunden + E.zeit.abendSekunden) / 60;
  for (const [profil, o] of Object.entries(out)) {
    console.log(`\nSpielertyp ${profil} (${o.laeufe} Läufe, ${o.fertig} bis zum Regionsabschluss)`);
    console.log('| Stufe | Name | Spieltage Median | 10 % bis 90 % | davon Sparen | längste Pause ohne Kauf | Echtzeit bei 1x | mit Vorspulen |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (let n = 1; n <= E.stufen.length; n++) {
      const s = o.stufen[n];
      console.log(`| ${n} | ${E.stufen[n - 1].name} | ${s.median ?? '-'} | ${s.p10 ?? '-'} bis ${s.p90 ?? '-'} | ${s.sparen ?? '-'} | ${s.pause} | ${s.median != null ? fmtZeit(s.median * tagMin) : '-'} | ${s.median != null ? fmtZeit(s.median * tagMin * typisch(n)) : '-'} |`);
    }
    const g = o.gesamt;
    let typ = 0; for (let n = 1; n <= E.stufen.length; n++) typ += (o.stufen[n].median || 0) * tagMin * typisch(n);
    console.log(`| | **Gesamt** | **${g.median ?? '-'}** | ${g.p10 ?? '-'} bis ${g.p90 ?? '-'} | | | **${g.median != null ? fmtZeit(g.median * tagMin) : '-'}** | **${fmtZeit(typ)}** |`);
    console.log(`Käufe (Median): ${o.kaeufe}, längste Pause ohne Kauf (Median): ${o.laengstePause} Tage`);
  }
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
