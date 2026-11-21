#!/usr/bin/env node
// Zusammenspiel 1 (P85): Kernschleife und Regeln im laufenden Spiel zählen.
// Spielt das echte Spiel im Browser im Zeitraffer von Stufe 1 bis 6 und zählt jedes Ereignis, das die
// Regeln und Module melden (game.emit), mit seinen Merkmalen (zum Beispiel 'sim:collected.hand=true').
// So steht am Ende für jede Regel da, wie oft sie in einem Spiel wirklich greift. Anleitung: docs/zusammenspiel.md
//
// Aufruf (im Hauptordner des Repos, einmal vorher: cd tests && npm ci && cd ..):
//   node tools/zusammenspiel/kernschleife.cjs --spieler aktiv --geraet pc --minuten 60 --out /tmp/zs/aktiv-pc
//   node tools/zusammenspiel/bericht.cjs /tmp/zs
//
// Optionen:
//   --spieler aktiv|passiv  aktiv: spielt wie ein Mensch (weist zu, kassiert von Hand, legt um, wählt Tagesziele,
//                           hält für Funk-Anmeldungen frei, vergibt Dauerplätze, weist ab, wenn alles voll ist);
//                           passiv: wie der Zeitraffer-Bot (kassiert alles, weist nie zu, Boote fahren selbst ein)
//   --geraet pc|handy|handyquer|tablet, --tempo 500, --minuten 60, --bis 6
//   --gelaende n / --seed s / --stegbild n / --landbild n   an die Adresse gehängt
//   --web web   Ordner mit dem Spiel; --out dir   Ausgabeordner (ergebnis.json, bilder/)

const fs = require('fs');
const path = require('path');
const { serve, GERAETE, ladePlaywright, LOGBUCH } = require('../zeitraffer/lauf.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const SPIELER = opt('spieler', 'aktiv');
const GERAET = opt('geraet', 'pc');
const TEMPO = Number(opt('tempo', 500));
const MINUTEN = Number(opt('minuten', 60));
const BIS = Number(opt('bis', 6));
const WEB = path.resolve(opt('web', path.join(REPO, 'web')));
const OUT = path.resolve(opt('out', path.join(require('os').tmpdir(), 'zusammenspiel')));
const EXTRA = ['gelaende', 'seed', 'stegbild', 'landbild'].filter((k) => opt(k) != null).map((k) => `&${k}=${opt(k)}`).join('');

// Ereignisse, bei deren erstem Auftreten ein Bild entsteht (Nachweis im Spiel)
const BILDWUERDIG = ['sim:selfEntered', 'sim:moored', 'sim:collected', 'hafenmeister:halt', 'sim:turnedAway', 'sim:dismissed',
  'sim:relocated', 'sim:reserved', 'sim:announced', 'sim:stationed', 'sim:dauerNeu', 'sim:officeAuto', 'sim:officeSpecial',
  'sim:tripOut', 'sim:honestyBox', 'sim:buoyFee', 'sim:awardUp', 'sim:awardDown', 'sim:stageReady', 'sim:stageUp', 'sim:regionDone',
  'ziel:erreicht', 'wochenziel:erreicht', 'stammgast:neu', 'erfolg:neu', 'logbuch:neu', 'gaestebuch:bewertung', 'tagesabschluss:fertig',
  'winter:karte', 'bauen:abschnittFertig', 'event:start', 'paeckchen:moeglich', 'sim:strokeTip', 'geschichte:neu', 'nachruesten:gebaut'];

// ------------------------------------------------------------------ im Browser: Zähler und Spieler
const SPIEL = (profil) => {
  const G = window.hafenmeister; const S = G.sim; if (!S) return null;
  const W = window.__zs ||= { tag: -1, z: {}, sum: {}, werte: {}, neu: [], kaeufe: [], aktion: {}, versucht: new Set(), funk: new Set(), umlegenTag: -1, umlegenHeute: 0, dauerTag: -99, schritte: 0 };
  const plus = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  // Zähler: jedes Ereignis mit seinen kleinen Merkmalen; Kennungen, Namen und Zeiten fallen weg
  const OHNE = new Set(['boatId', 'berthId', 'id', 'day', 'tag', 'platz', 'platzId', 'from', 'to', 'boje', 'waitSpot', 'leaveAt', 'name', 'bootsname',
    'text', 'modell', 'modelId', 'typeId', 'art', 'palette', 'herkunft', 'zeit', 'uhr', 'x', 'z', 'boatIds', 'guest', 'parts', 'innen', 'boot', 'titel', 'berth', 'stammId', 'bewerberId', 'key', 'type', 'full', 'endDay', 'startDay', 'seasonDay']);
  const SUMME = new Set(['amount', 'betrag', 'geld', 'tip', 'bonus', 'base']);
  const LAUT = new Set(['sim:change', 'sim:berthState', 'uhrzeit', 'pegel', 'licht', 'hover', 'resize', 'tap', 'wetter', 'weather', 'phase', 'meldungen:wechsel', 'kamera:ausrichten', 'ui:strich-ende', 'wasserstand']);
  const zaehle = (name, d) => {
    plus(W.z, name);
    if (!W.erst?.[name]) { (W.erst ||= {})[name] = { tag: S.state.day, stufe: S.state.stage }; W.neu.push(name); }
    if (LAUT.has(name)) return;
    if (typeof d === 'string' && d.length <= 24) { plus(W.z, `${name}=${d}`); return; }
    if (!d || typeof d !== 'object') return;
    for (const [k, v] of Object.entries(d)) {
      if (OHNE.has(k)) continue;
      if (k === 'paeckchen' || k === 'kurz' || k === 'dienste') { if (v) plus(W.z, `${name}.${k}=ja`); continue; }
      if (SUMME.has(k) && typeof v === 'number') { plus(W.sum, `${name}.${k}`, v); continue; }
      if (k === 'rating' && typeof v === 'number') { plus(W.z, `${name}.note=${(Math.round(v * 2) / 2).toFixed(1)}`); continue; }
      if (k === 'wishesMet' && Array.isArray(v)) { plus(W.z, `${name}.wuensche=${v.length}`); continue; }
      if (typeof v === 'boolean' || (typeof v === 'string' && v.length <= 24) || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6 && k !== 'amount')) {
        const key = `${name}.${k}`; const s = (W.werte[key] ||= new Set());
        if (s.size < 14 || s.has(String(v))) { s.add(String(v)); plus(W.z, `${key}=${v}`); }
      }
    }
  };
  if (!W.hook) {
    W.hook = true;
    const orig = G.emit;
    G.emit = function (name, data) { try { zaehle(name, data); } catch { /* Zähler darf das Spiel nie stören */ } return orig.apply(this, arguments); };
    // Ereignisse aus Modulen, die direkt über game.sim.dispatch melden (dauerNeu u. a.), laufen auch über game.emit
  }
  const A = (k, ok = true) => plus(W.aktion, ok ? k : k + ':fehlgeschlagen');
  const aktiv = profil === 'aktiv';
  if (!W.ticker) W.ticker = G.onTick((dt) => {
    if (!dt) return;
    W.schritte++;
    const st = S.state; const r = S.ctx.rules;
    // Kassieren: passiv alles sofort; aktiv zwei von drei Münzen von Hand, der Rest bleibt für den Rundgang am Abend
    for (const b of Object.values(st.boats)) if (b.pendingFee > 0 && st.phase === 'day' && (!aktiv || b.id % 3 !== 0)) { if (!W.kass?.has(b.id + ':' + st.day)) { (W.kass ||= new Set()).add(b.id + ':' + st.day); A('kassieren'); } S.collect(b.id); }
    if (!aktiv && st.phase !== 'day') S.collectAll(true);
    if (aktiv && st.phase === 'day') {
      // Zuweisen: drei von vier Booten an der Boje von Hand (Wunschplatz zuerst, sonst die beste passende Box,
      // bei vollem Hafen ins Päckchen). Was das Büro selbst zuweist, bleibt beim Büro, außer Sonderfälle.
      for (const b of S.waitingBoats()) {
        if (!b.atBuoy || W.versucht.has(b.id)) continue;
        W.warte ||= {}; W.warte[b.id] = (W.warte[b.id] || 0) + dt;
        if (W.warte[b.id] < 2) continue;  // kurz schauen, wie ein Mensch
        W.versucht.add(b.id);
        if (b.id % 4 === 0) { A('selbstEinfahrenLassen'); continue; }
        if (S.bueroAutomatik(b.size) && !S.sonderfall(b.id)) { A('bueroUeberlassen'); continue; }
        const gold = S.wunschPlaetze(b.id) || [];
        const frei = S.fittingBerths(b.id) || [];
        let ziel = gold.find((p) => frei.includes(p));
        if (ziel == null && frei.length) ziel = frei.map((p) => ({ p, v: S.platzWert(b.id, p) })).sort((x, y) => (y.v?.fee ?? 0) - (x.v?.fee ?? 0))[0].p;
        if (ziel == null) {
          const pk = S.paeckchenZiele(b.id) || [];
          if (pk.length && b.id % 2 === 1) { ziel = pk[0]; A('paeckchenVersuch'); }
        }
        if (ziel == null) {
          if (st.queue.length >= S.waitSpotCount() && b.id % 3 === 0) { const d = S.dismiss(b.id); A('abweisen', !!(d?.ok ?? d)); }
          else { A('keinPlatzWarten'); W.versucht.delete(b.id); W.warte[b.id] = -30; }
          continue;
        }
        S.select(b.id);
        const res = S.assign(b.id, ziel);
        A(gold.includes(ziel) ? 'zuweisenWunsch' : String(ziel).includes('+') ? 'zuweisenPaeckchen' : 'zuweisen', !!res?.ok);
        if (!res?.ok) S.select(null);
      }
      // Funk-Anmeldung: jede zweite angemeldete Crew bekommt eine Box freigehalten
      for (const b of S.angemeldet?.() ?? []) {
        if (W.funk.has(b.id)) continue; W.funk.add(b.id);
        if (b.id % 2 === 0) { const f = S.freihaltbar(b.id) || []; if (f.length) { const res = S.freihalten(b.id, f[0]); A('freihalten', !!res?.ok); } else A('freihaltenKeinPlatz'); }
      }
      // Umlegen: höchstens zwei Gäste am Tag, wenn eine freie Box mehr Wünsche erfüllt
      if (W.umlegenTag !== st.day) { W.umlegenTag = st.day; W.umlegenHeute = 0; }
      if (W.umlegenHeute < 2 && W.schritte % 50 === 0) {
        for (const b of S.mooredBoats()) {
          if (b.stationed || !S.umlegbar(b.id)) continue;
          const jetzt = (S.platzWert(b.id, b.berthId)?.wishesMet ?? []).length ?? 0;
          const besser = (S.umlegeZiele(b.id) || []).find((p) => !String(p).includes('+') && ((S.platzWert(b.id, p)?.wishesMet ?? []).length ?? 0) > jetzt);
          if (besser == null) continue;
          const res = S.umlegen(b.id, besser); A('umlegen', !!res?.ok); W.umlegenHeute++; break;
        }
      }
    }
    if (st.day !== W.tag && st.phase === 'day') {
      W.tag = st.day;
      if (aktiv) {
        // Tagesziel wählen (abwechselnd die Karten)
        const tz = G.tagesziele; const k = tz?.karten?.() ?? [];
        if (k.length && !tz.gewaehlt()) { tz.waehle(st.day % k.length); A('tageszielWaehlen', !!tz.gewaehlt()); }
        // Dauerplatz: alle fünf Tage eine freie Gastbox anbieten (Regel begrenzt auf ein Viertel)
        if (G.dauerlieger && st.day - W.dauerTag >= 5) {
          for (const p0 of S.availableBerths() || []) {
            const p = p0?.id ?? p0;
            const vorher = Object.keys(st.boats).length;
            G.dauerlieger.machDauerplatz(p);
            if (Object.keys(st.boats).length > vorher) { A('dauerplatz'); W.dauerTag = st.day; break; }
          }
        }
      }
      // Aktiv: einkaufen wie ein Mensch über das Bauen-Menü (game.bauen.eintraege(): Ausbau in Abschnitten,
      // Stege, Nachrüsten, Umbauen, Büro, Versorgung, Angebote). Ausbau zuerst; fehlt nur Geld, wird gespart.
      if (aktiv && G.bauen?.eintraege) {
        const RANG = { hafen: 1, steg: 2, versorgung: 3, angebot: 4 };
        for (let runde = 0; runde < 15; runde++) {
          W.fehlKauf ||= {};
          // Kein Hin und Her: Rückbau und Entweder-oder-Tausch ("X statt Y") kauft ein Mensch nicht jeden Tag
          const e = G.bauen.eintraege().filter((x) => x.kaufen && !x.gesperrt && W.fehlKauf[x.key] !== st.day
            && !x.key.startsWith('umbauen:rueckbau') && !/ statt /.test(x.name || '') && !(x.key.startsWith('umbauen:umbau') && (W.umbauten = W.umbauten || 0) >= 2));
          const stufe = e.find((x) => x.key === 'hafen:stufe');
          let kauf = e.filter((x) => x.kosten <= st.money);
          if (stufe && stufe.kosten > st.money) kauf = kauf.filter((x) => x.kosten <= 0.1 * stufe.kosten);
          if (!kauf.length) break;
          kauf.sort((a, b) => (a.key === 'hafen:stufe' ? -1 : b.key === 'hafen:stufe' ? 1 : 0) || (RANG[a.art] ?? 5) - (RANG[b.art] ?? 5) || a.kosten - b.kosten);
          const kk = kauf[0]; let ok = false;
          // Über die Oberfläche: Bauen öffnen, Vorschau des Eintrags, Knopf "Bauen für ..." drücken
          const geld0 = st.money; const stufe0 = st.stage;
          try {
            if (!G.bauen.offen) G.bauen.oeffnen();
            G.bauen.vorschau(kk.key);
            const knopf = document.querySelector('.bau-ja');
            if (knopf) { knopf.click(); A('bauenKnopf'); } else { const res = kk.kaufen(); A('bauenOhneKnopf'); if (!(res === true || res?.ok)) throw new Error('nein'); }
            ok = st.money < geld0 || st.stage !== stufe0;
          } catch (err) { ok = false; }
          try { G.bauen.schliessen(); } catch { /* egal */ }
          W.kaeufe.push({ art: kk.key, kosten: kk.kosten, ok, tag: st.day, stufe: st.stage });
          // Klappt ein Kauf nicht (Knopf ohne Wirkung), heute nicht noch einmal, aber weiter einkaufen
          if (ok && kk.key.startsWith('umbauen:umbau')) W.umbauten = (W.umbauten || 0) + 1;
          if (!ok) { W.fehlKauf[kk.key] = st.day; A('kauf:' + kk.key, false); }
        }
      }
      // Passiv: einkaufen wie der Zeitraffer-Bot direkt über die Regeln: Stege zuerst, dann Büro, Bauwerke, Services
      for (let runde = 0; runde < 15 && !aktiv; runde++) {
        const check = S.canAdvanceStage();
        if (check.ok) { const a = S.advanceStage(); W.kaeufe.push({ art: 'stufe', id: st.stage, ok: !!a.ok, tag: st.day }); continue; }
        const nurGeld = check.missing?.length === 1 && check.missing[0] === 'money';
        const o = [];
        for (const p of S.openJettyProjects()) o.push({ art: 'steg', id: p.id, kosten: p.cost, prio: 1, tu: () => S.buildJettyProject(p.id).ok });
        const on = st.office + 1;
        if (r.office.cost[on] && st.stage >= r.office.fromStage[on]) o.push({ art: 'buero', id: on, kosten: r.office.cost[on], prio: 2, tu: () => S.upgradeOffice().ok });
        for (const k of Object.keys(r.facilities || {})) { const u = S.facilityUpgrade(k); if (u && u.available) o.push({ art: 'bauwerk', id: k, kosten: u.cost, prio: 3, tu: () => S.upgradeFacility(k).ok }); }
        for (const x of G.services?.liste?.() ?? []) { const p = G.services.pruefe(x.id); if (p && p.freigeschaltet && !p.fertig && !p.umbau) o.push({ art: 'service', id: x.id, kosten: p.kosten, prio: st.stage >= r.maxStage ? 1 : 3, tu: () => !!G.services.bauen(x.id)?.ok }); }
        let kauf = o.filter((x) => x.kosten <= st.money);
        if (nurGeld) kauf = kauf.filter((x) => x.prio === 1 && x.kosten <= 0.1 * check.goal.cost);
        if (!kauf.length) break;
        kauf.sort((a, b) => a.prio - b.prio || a.kosten - b.kosten);
        const kk = kauf[0]; const ok = kk.tu();
        W.kaeufe.push({ art: kk.art, id: kk.id, kosten: kk.kosten, ok, tag: st.day, stufe: st.stage });
        if (!ok) break;
      }
    }
  });
  const st = S.state; const rg = S.regionGoal();
  const out = {
    t: G.time, tag: st.day, phase: st.phase, stufe: st.stage, geld: Math.round(st.money), ruf: S.reputation(), gaeste: st.guests,
    buero: st.office, ziel: rg.active ? { ok: rg.ok, fehlt: rg.missing, besuche: rg.visits } : null,
    ausbau: (() => { try { const a = G.bauen?.ausbau?.(); const e = G.bauen?.eintraege?.().find((x) => x.key === 'hafen:stufe'); return a || e ? { a, gesperrt: e?.gesperrt ?? null, kosten: e?.kosten ?? null, fehlt: S.canAdvanceStage().missing } : null; } catch (err) { return String(err); } })(), auszeichnung: S.auszeichnung?.()?.level ?? null,
    z: W.z, sum: W.sum, aktion: W.aktion, neu: W.neu.splice(0), kaeufe: W.kaeufe.splice(0), schritte: W.schritte,
  };
  W.z = {}; W.sum = {}; W.aktion = {};
  return out;
};

// Stand am Ende einer Stufe: was die Module selbst über sich wissen
const STAND = () => {
  const G = window.hafenmeister; const S = G.sim; const st = S.state;
  const sicher = (f) => { try { return f(); } catch (e) { return 'Fehler: ' + e.message; } };
  return {
    stufe: st.stage, tag: st.day, geld: Math.round(st.money), ruf: S.reputation(), gaeste: st.guests, buero: st.office,
    stats: st.stats, auszeichnung: sicher(() => S.auszeichnung()),
    stammgaeste: sicher(() => G.stammgaeste?.liste()?.length ?? null),
    dauerlieger: Object.values(st.boats).filter((b) => b.stationed).length,
    erfolge: sicher(() => { const e = G.erfolge; const l = e?.liste?.() ?? e?.zustand?.() ?? null; return Array.isArray(l) ? l.filter((x) => x.erreicht || x.done).length : l && typeof l === 'object' ? Object.keys(l).length : null; }),
    gaestebuch: sicher(() => G.gaestebuch?.eintraege?.()?.length ?? null),
    logbuch: sicher(() => { const lb = st.logbook || {}; return Object.values(lb).reduce((n, l) => n + l.length, 0); }),
    tagesziele: sicher(() => G.tagesziele?.zustand?.() ? { erreicht: G.tagesziele.zustand().erreicht ?? null, woche: G.tagesziele.woche?.() ?? null } : null),
    services: sicher(() => G.services?.zustand?.()?.gebaut ?? null),
    module: Object.keys(st.modules || {}),
  };
};

if (require.main !== module) { module.exports = { SPIEL, STAND, BILDWUERDIG }; return; }

const { chromium } = ladePlaywright();
(async () => {
  fs.mkdirSync(path.join(OUT, 'bilder'), { recursive: true });
  const { s, url } = await serve(WEB);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...GERAETE[GERAET], deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const R = { spieler: SPIELER, geraet: GERAET, tempo: TEMPO, query: null, start: new Date().toISOString(), commit: null,
    z: {}, zStufe: {}, sum: {}, aktion: {}, aktionStufe: {}, erst: {}, kaeufe: [], stufen: [], staende: [], bilder: [], verlauf: [], fehler: [], ende: null };
  try { R.commit = fs.readFileSync(path.join(WEB, 'version.txt'), 'utf8').trim(); } catch { /* lokal */ }
  let letzte = null;
  const ort = () => (letzte ? `Stufe ${letzte.stufe}, Tag ${letzte.tag}` : 'Start');
  page.on('console', (m) => { if (m.type() === 'error') R.fehler.push({ wann: ort(), text: m.text().slice(0, 400) }); });
  page.on('pageerror', (e) => R.fehler.push({ wann: ort(), text: 'Skriptfehler: ' + String(e.message).slice(0, 400) }));

  R.query = `?testtempo=${TEMPO}${EXTRA}`;
  await page.goto(url + R.query);
  await page.waitForFunction(() => window.hafenmeister?.sim && window.hafenmeister?.boatAnim && document.getElementById('boot')?.classList.contains('done'), null, { timeout: 90000 });
  await page.evaluate(() => { const G = window.hafenmeister; G.einstieg?.beenden?.(); G.camera.reset(); if (G.paused) G.setPaused(false); });

  const foto = async (name, label) => {
    const datei = `bilder/${name}.jpg`;
    const lief = await page.evaluate(() => { const G = window.hafenmeister; const l = !G.paused; G.setPaused(true); return l; });
    try { await page.screenshot({ path: path.join(OUT, datei), type: 'jpeg', quality: 70, timeout: 90000 }); R.bilder.push({ datei, label }); }
    catch (e) { R.fehler.push({ wann: ort(), text: 'Bildschirmfoto: ' + String(e.message).split('\n')[0] }); }
    if (lief) await page.evaluate(() => window.hafenmeister.setPaused(false));
  };

  const t0 = Date.now(); const ende = t0 + MINUTEN * 60000;
  let stufe = null; let naechsterVerlauf = 0;
  while (Date.now() < ende) {
    let z;
    try { z = await page.evaluate(`(${SPIEL})(${JSON.stringify(SPIELER)})`); } catch (e) { R.fehler.push({ wann: ort(), text: 'Spieler: ' + e.message.slice(0, 300) }); break; }
    if (!z) break;
    letzte = z;
    const zs = R.zStufe[z.stufe] ||= {}; const as = R.aktionStufe[z.stufe] ||= {};
    for (const [k, v] of Object.entries(z.z)) { R.z[k] = (R.z[k] || 0) + v; zs[k] = (zs[k] || 0) + v; }
    for (const [k, v] of Object.entries(z.sum)) R.sum[k] = Math.round(((R.sum[k] || 0) + v) * 100) / 100;
    for (const [k, v] of Object.entries(z.aktion)) { R.aktion[k] = (R.aktion[k] || 0) + v; as[k] = (as[k] || 0) + v; }
    for (const k of z.kaeufe) R.kaeufe.push(k);
    for (const n of z.neu) {
      if (R.erst[n]) continue;
      R.erst[n] = { stufe: z.stufe, tag: z.tag, w: Math.round((Date.now() - t0) / 1000) };
      if (BILDWUERDIG.includes(n)) await foto(`${SPIELER}-${GERAET}-erst-${n.replace(/[^a-z0-9]+/gi, '-')}`, `Erstes ${n}: Stufe ${z.stufe}, Tag ${z.tag}`);
    }
    if (Date.now() >= naechsterVerlauf) { naechsterVerlauf = Date.now() + 15000; R.verlauf.push({ w: Math.round((Date.now() - t0) / 1000), tag: z.tag, stufe: z.stufe, geld: z.geld, ruf: z.ruf, gaeste: z.gaeste, buero: z.buero, auszeichnung: z.auszeichnung, ziel: z.ziel, ausbau: z.ausbau });
      fs.writeFileSync(path.join(OUT, 'zwischenstand.json'), JSON.stringify({ ...R, zwischen: true }, null, 1)); }
    if (stufe !== z.stufe) {
      if (stufe != null) {
        R.staende.push({ ende: stufe, ...(await page.evaluate(`(${STAND})()`).catch((e) => ({ fehler: e.message }))) });
        R.stufen.push({ stufe: z.stufe, tag: z.tag, w: Math.round((Date.now() - t0) / 1000) });
      }
      stufe = z.stufe;
      await page.evaluate(() => window.hafenmeister.camera.reset());
      await foto(`${SPIELER}-${GERAET}-stufe${z.stufe}`, `Stufe ${z.stufe} erreicht, Tag ${z.tag}`);
    }
    // Wie ein Mensch: Feier und Karten, die das Spiel anhalten, mit ihrem Knopf schließen; sonst weiterlaufen lassen
    const zu = await page.evaluate(() => {
      const G = window.hafenmeister; const k = [];
      for (const sel of ['.hm-feier-weiter']) { const b = document.querySelector(sel); if (b && b.offsetParent) { b.click(); k.push(sel); } }
      if (G.paused) { G.setPaused(false); k.push('pause'); }
      return k;
    });
    for (const k of zu) R.aktion['ui:' + k] = (R.aktion['ui:' + k] || 0) + 1;
    if (Date.now() >= (R._log || 0)) { R._log = Date.now() + 60000; console.log(`${Math.round((Date.now() - t0) / 60000)} min: Stufe ${z.stufe}, Tag ${z.tag}, ${z.geld} €`); }
    if (z.stufe >= BIS && z.ziel?.ok) { R.ende = `Ziel der Stufe ${z.stufe} erreicht an Tag ${z.tag}`; break; }
    await page.waitForTimeout(700);
  }
  if (!R.ende) R.ende = `Zeit abgelaufen (${MINUTEN} min), erreicht: ${ort()}`;
  R.staende.push({ ende: 'Lauf', ...(await page.evaluate(`(${STAND})()`).catch((e) => ({ fehler: e.message }))) });
  R.logbuch = await page.evaluate(`(${LOGBUCH})()`).catch(() => null);
  await foto(`${SPIELER}-${GERAET}-ende`, R.ende);
  R.dauerMin = +((Date.now() - t0) / 60000).toFixed(1);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify(R, null, 1));
  console.log(`${SPIELER}/${GERAET}: ${R.ende}; ${R.fehler.length} Fehler, ${Object.keys(R.z).length} Zählerschlüssel, ${R.bilder.length} Bilder`);
  await browser.close(); s.close();
})().catch((e) => { console.error(e); process.exit(1); });
