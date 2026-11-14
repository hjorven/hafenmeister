#!/usr/bin/env node
// Zeitraffer: spielt das echte Spiel im Browser stark beschleunigt von Stufe 1 bis 6 durch,
// macht regelmäßig Bildschirmfotos und prüft dabei alles, was Jorven im Spiel stört.
// Anleitung und Ausgabe: docs/zeitraffer.md
//
// Aufruf (im Hauptordner des Repos, einmal vorher: cd tests && npm ci && cd ..):
//   node tools/zeitraffer/lauf.cjs --geraet pc --minuten 60 --out /tmp/zeitraffer
//
// Optionen (alle optional):
//   --geraet pc|handy|tablet|handyquer  Gerät (Standard pc)
//   --tempo 500        Spielzeit je Echtzeit (Testschalter ?testtempo=, nur für Tests)
//   --minuten 60       Höchstdauer in Echtzeit-Minuten
//   --bild 10          alle n Sekunden Echtzeit ein Bildschirmfoto
//   --stufe 1          Startstufe (1 = neues Spiel; ab 2 Testmodus ?stufe=n, der nicht speichert)
//   --bis 6            Lauf endet, wenn diese Stufe erreicht und ihr Ziel erfüllt ist
//   --gelaende n / --seed s / --stegbild n / --landbild n   werden an die Adresse gehängt (?gelaende=n usw.)
//   --web web          Ordner mit dem Spiel (Standard web/ im Repo)
//   --out dir          Ausgabeordner (Standard /tmp/zeitraffer: Bilder, ergebnis-<gerät>.json)
//
// Spieler ist ein einfacher Bot über game.sim (wie tools/balance.mjs "geschickt"): kassiert jede
// Münze sofort, kauft jeden Morgen das Sinnvollste, spart auf die nächste Stufe und steigt auf.
// Boote fahren selbst ein (Selbst-Einfahren nach 8 s), der Bot weist nichts zu.

const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const GERAET = opt('geraet', 'pc');
const TEMPO = Number(opt('tempo', 500));
const MINUTEN = Number(opt('minuten', 60));
const BILD_S = Number(opt('bild', 10));
const START = Number(opt('stufe', 1));
const BIS = Number(opt('bis', 6));
const WEB = path.resolve(opt('web', path.join(REPO, 'web')));
const OUT = path.resolve(opt('out', path.join(require('os').tmpdir(), 'zeitraffer')));
const EXTRA = ['gelaende', 'seed', 'stegbild', 'landbild'].filter((k) => opt(k) != null).map((k) => `&${k}=${opt(k)}`).join('');

function ladePlaywright() {
  for (const p of [path.join(REPO, 'tests', 'node_modules', '@playwright', 'test'), 'playwright', '@playwright/test']) {
    try { return require(p); } catch { /* nächster */ }
  }
  throw new Error('Playwright fehlt: cd tests && npm ci');
}
const { chromium, devices } = ladePlaywright();
const THREE_DIR = [path.join(REPO, 'tests', 'node_modules', 'three'), '/mnt/project-files/feature-tests/three/package']
  .find((d) => fs.existsSync(path.join(d, 'build', 'three.module.js')));
if (!THREE_DIR) throw new Error('three@0.187.0 fehlt: cd tests && npm ci');

const GERAETE = {
  pc: { viewport: { width: 1440, height: 900 } },
  handy: { ...devices['Pixel 7'] },
  handyquer: { ...devices['Pixel 7 landscape'] },
  tablet: { ...devices['Galaxy Tab S4'] },
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
function serve(root) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { r.writeHead(403); r.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        r.end(d);
      });
    }).listen(0, () => res({ s, url: `http://localhost:${s.address().port}/` }));
  });
}

// ------------------------------------------------------------------ im Browser: Bot
// Installiert den Bot als Ticker (kassiert, kauft jeden Spieltag, steigt auf) und liefert den Stand.
const BOT = () => {
  const G = window.hafenmeister; const S = G.sim; if (!S) return null;
  const W = window.__zr ||= { tag: -1, kaeufe: [], schritte: 0 };
  // Der Bot läuft als Ticker im Spiel, also in Spielzeit: jeden Schritt kassieren, jeden Spieltag einkaufen.
  // So spielt er bei jedem Tempo gleich (tools/balance.mjs kauft ebenfalls jeden Tag).
  if (!W.ticker) W.ticker = G.onTick((dt) => {
    if (!dt) return;
    W.schritte++;
    const st = S.state; const r = S.ctx.rules;
    for (const b of Object.values(st.boats)) if (b.pendingFee > 0) S.collect(b.id);
    if (st.phase !== 'day') S.collectAll(true);
    if (st.day !== W.tag && st.phase === 'day') {
      W.tag = st.day;
      for (let runde = 0; runde < 15; runde++) {
        const check = S.canAdvanceStage();
        if (check.ok) { const a = S.advanceStage(); W.kaeufe.push({ art: 'stufe', id: st.stage, ok: !!a.ok, tag: st.day }); continue; }
        const nurGeld = check.missing?.length === 1 && check.missing[0] === 'money';
        const o = [];
        for (const p of S.openJettyProjects()) o.push({ art: 'steg', id: p.id, kosten: p.cost, prio: 1, tu: () => S.buildJettyProject(p.id).ok });
        const on = st.office + 1;
        if (r.office.cost[on] && st.stage >= r.office.fromStage[on]) o.push({ art: 'buero', id: on, kosten: r.office.cost[on], prio: 2, tu: () => S.upgradeOffice().ok });
        for (const k of Object.keys(r.facilities || {})) {
          const u = S.facilityUpgrade(k);
          if (u && u.available) o.push({ art: 'bauwerk', id: k, kosten: u.cost, prio: 3, tu: () => S.upgradeFacility(k).ok });
        }
        for (const x of G.services?.liste?.() ?? []) {
          const p = G.services.pruefe(x.id);
          if (p && p.freigeschaltet && !p.fertig) o.push({ art: 'service', id: x.id, kosten: p.kosten, prio: st.stage >= r.maxStage ? 1 : 3, tu: () => !!G.services.bauen(x.id)?.ok });
        }
        let kauf = o.filter((x) => x.kosten <= st.money);
        if (nurGeld) kauf = kauf.filter((x) => x.prio === 1 && x.kosten <= 0.1 * check.goal.cost);
        if (!kauf.length) break;
        kauf.sort((a, b) => a.prio - b.prio || a.kosten - b.kosten);
        const k = kauf[0];
        const ok = k.tu();
        W.kaeufe.push({ art: k.art, id: k.id, kosten: k.kosten, ok, tag: st.day, stufe: st.stage });
        if (!ok) break;
      }
    }
  });
  const st = S.state;
  const kaeufe = W.kaeufe.splice(0);
  const rg = S.regionGoal();
  const ev = G.events?.current;
  return {
    t: G.time, tag: st.day, phase: st.phase, stufe: st.stage, geld: st.money, ruf: S.reputation(), gaeste: st.guests,
    stufenGaeste: st.stageGuests, wartend: S.waitingBoats().length, liegend: S.mooredBoats().length, buero: st.office,
    ziel: rg.active ? { ok: rg.ok, fehlt: rg.missing, besuche: rg.visits, offen: rg.openBerths, done: rg.done } : null,
    aufstieg: S.canAdvanceStage().missing ?? [],
    ereignis: ev?.id ?? null, winter: !!S.season()?.winter,
    abgewiesen: st.stats?.turnedAway ?? 0, einnahmen: st.stats?.totalIncome ?? 0,
    botSchritte: W.schritte, kaeufe,
  };
};

// ------------------------------------------------------------------ im Browser: Prüfungen
// A Rumpf über Land, B Rumpf durch Steg, C ineinander und fest, D zwei liegende Boote überlappen,
// E Boot bewegt sich nicht, obwohl es fahren sollte, F Sim-Zustände, die zu lange dauern.
const PROBE = () => {
  const G = window.hafenmeister; const T = G.THREE; const S = G.sim;
  const W = window.__zrp ||= {}; W.ray ||= new T.Raycaster(); W.stand ||= new Map(); W.simSeit ||= new Map(); W.unterwegs ||= new Map();
  if (!W.raf) { W.raf = true; const f = () => { W.frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); }
  const jetzt = G.time;
  const gast = new Map((G.boatView?.boote ?? []).map((e) => [e.anim, e.id]));
  const bs = (G.boatAnim?.boats ?? []).filter((a) => a.model?.parent && a.model.visible !== false && a.info).map((a) => ({
    a, id: gast.has(a) ? 'gast-' + gast.get(a) : 'verkehr-' + String(a.model.name || '?').replace(/^verkehr-/, ''),
    st: a.state, x: a.x, z: a.z, h: a.heading, L: a.info.length, B: a.info.beam ?? a.info.length * 0.33, g: a.info.size, platz: a.berth?.id }));
  const ecken = (b, k) => { const c = Math.cos(b.h), s = -Math.sin(b.h); const l = b.L * k / 2, w = b.B * k / 2;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 0], [-1, 0], [0, 0]].map(([i, j]) => [b.x + c * l * i - s * w * j, b.z + s * l * i + c * w * j]); };
  const sat = (A, B) => { A = A.slice(0, 4); B = B.slice(0, 4); for (const P of [A, B]) for (let i = 0; i < 4; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4]; const nx = y2 - y1, ny = x1 - x2; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } if (a1 < b0 || b1 < a0) return false; } return true; };
  const wasser = (x, z) => (G.landschaft?.istWasser ? G.landschaft.istWasser(x, z) : true);
  const ziele = []; G.stege?.group?.traverse((o) => { if (o.isMesh && o.visible && !(o.material?.transparent && (o.material.opacity ?? 1) < 0.5)) ziele.push(o); });
  const steg = (x, z) => { W.ray.set(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0)); return W.ray.intersectObjects(ziele, false).find((t) => t.point.y > 0.15) || null; };
  const out = { land: [], steg: [], fest: [], ueberlapp: [], haengt: [], pulk: [], lange: [], sim: [], n: bs.length };
  const ruhig = new Set(['moored', 'waiting', 'idle']);
  // Pulk: ab PULK_N fahrenden Booten im Umkreis PULK_R m. Zu lange unterwegs: mehr als LANGE_S Spielsekunden
  // ein- oder auslaufend innerhalb von 100 m um die Stege (lange Wege über die offene See zählen nicht)
  const PULK_R = 45, PULK_N = 12, LANGE_S = 600;
  const hafen = G.stege?.group ? new T.Box3().setFromObject(G.stege.group).expandByScalar(100) : null;
  for (const b of bs) {
    const E = ecken(b, 0.85);
    const nl = E.filter(([x, z]) => !wasser(x, z)).length;
    if (nl >= 2) out.land.push({ id: b.id, g: b.g, st: b.st + ':' + (b.a.task?.constructor?.name ?? '-'), n: nl, platz: b.platz, p: [b.x, b.z] });
    const ns = E.filter(([x, z]) => steg(x, z)).length;
    if (ns >= 1 && !(b.st === 'moored' && ns === 1)) out.steg.push({ id: b.id, g: b.g, st: b.st, n: ns, platz: b.platz, p: [b.x, b.z] });
    const alt = W.stand.get(b.a); const weg = alt ? Math.hypot(alt.x - b.x, alt.z - b.z) : 99;
    const still = weg < 0.15 && !ruhig.has(b.st) ? (alt?.still ?? jetzt) : null;
    W.stand.set(b.a, { x: b.x, z: b.z, still });
    // Länger als 5 Spielminuten in Fahrt, ohne sich zu bewegen
    if (still != null && jetzt - still > 300) {
      const a = b.a, t = a.task;
      const grund = [t?.constructor?.name ?? 'ohne', a.wartetVorEngstelle ? 'engstelle' : '', a.blocked ? 'blockiert' : '', a.yieldF < 0.05 ? 'vorfahrt' : '', t?.pivot ? 'drehen' : '', t?.constructor?.name === 'WaitTask' ? 'warten' : ''].filter(Boolean).join('+') + (a.hinderer ? ` vor ${a.hinderer.moored ? 'liegt' : a.hinderer.state ?? 'fremd'}${a.hinderer.wartetVorEngstelle ? '+engstelle' : ''}` : '');
      // Kette der Hindernisse bis zum Kopf der Schlange (fuer die Ursache)
      const kette = []; let o = a.hinderer;
      for (let i = 0; i < 30 && o && !kette.some((k) => k.o === o); i++) { kette.push({ o, t: `${o.id}:${o.moored ? 'liegt' : o.state ?? 'fremd'}:${o.task?.constructor?.name ?? '-'}:v${(o.speed ?? 0).toFixed(1)}:y${(o.yieldF ?? 1).toFixed(2)}${o.blocked ? ':bl' : ''}${o.wartetVorEngstelle ? ':eng' : ''}${o.ghost > 0 ? ':ghost' : ''}${o.task?.pivot ? ':dreht' : ''}${Number.isFinite(o.room) ? ':r' + o.room.toFixed(1) : ''}${o.task?.eng ? ':e' + o.task.eng.map((e) => (e.frei ? 'F' : e.fertig ? 'x' : '-') + e.nr).join('') : ''}${o.zurueckgesetzt ? ':z' + o.zurueckgesetzt : ''}${o.durchlaesse ? ':d' + o.durchlaesse : ''}@${Math.round(o.x)},${Math.round(o.z)}` }); o = o.hinderer; }
      out.haengt.push({ id: b.id + ' ' + grund, g: b.g, st: b.st, s: Math.round(jetzt - still), p: [b.x, b.z], kette: kette.map((k) => k.t).join(' > ') + (o && kette.some((k) => k.o === o) ? ' > KREIS' : '') });
    }
  }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (Math.hypot(a.x - b.x, a.z - b.z) > (a.L + b.L) / 2) continue;
    if (!sat(ecken(a, 0.85), ecken(b, 0.85))) continue;
    const sa = W.stand.get(a.a)?.still, sb = W.stand.get(b.a)?.still;
    const p = [(a.x + b.x) / 2, (a.z + b.z) / 2];
    if (a.st === 'moored' && b.st === 'moored') out.ueberlapp.push({ a: a.id, b: b.id, g: a.g + b.g, st: 'moored', p });
    else if ((sa != null && jetzt - sa > 30) || (sb != null && jetzt - sb > 30)) out.fest.push({ a: a.id, b: b.id, g: a.g + b.g, st: a.st + '/' + b.st, p });
    // in Fahrt ineinander (sichtbar, auch wenn es sich gleich wieder loest): Pulk oder Durchlass
    else out.ueberlapp.push({ a: a.id, b: b.id, g: a.g + b.g, st: a.st + '/' + b.st + (a.a.ghost > 0 || b.a.ghost > 0 ? '+durchlass' : a.a.zeitraffer || b.a.zeitraffer ? '+zeitraffer' : ''), p });
  }
  // Pulk: viele fahrende Boote auf engem Raum, auch wenn sich jedes noch langsam bewegt (Jorvens Stau-Bild 14.11.)
  const fahrend = bs.filter((b) => !ruhig.has(b.st));
  let pk = null;
  for (const a of fahrend) { const nb = fahrend.filter((c) => Math.hypot(c.x - a.x, c.z - a.z) < PULK_R); if (!pk || nb.length > pk.nb.length) pk = { a, nb }; }
  if (pk && pk.nb.length >= PULK_N) {
    const z = {}; for (const c of pk.nb) z[c.st] = (z[c.st] || 0) + 1;
    out.pulk.push({ id: 'Tag ' + S.state.day, g: pk.nb.length + ' Boote', st: Object.entries(z).sort((x, y) => y[1] - x[1]).map(([k, v]) => v + ' ' + k).join(', '), n: pk.nb.length, p: [pk.a.x, pk.a.z] });
  }
  // Ein- oder Auslaufen dauert zu lange (Boot kriecht im Pulk, ohne ganz stillzustehen)
  const lebt = new Set();
  for (const b of fahrend) {
    if (b.st !== 'leaving' && b.st !== 'docking') continue;
    lebt.add(b.a); const u = W.unterwegs.get(b.a);
    if (!u || u.st !== b.st) { W.unterwegs.set(b.a, { st: b.st, zuletzt: jetzt, innen: 0 }); continue; }
    if (!hafen || hafen.containsPoint(new T.Vector3(b.x, (hafen.min.y + hafen.max.y) / 2, b.z))) u.innen += jetzt - u.zuletzt;
    u.zuletzt = jetzt;
    if (u.innen > LANGE_S) out.lange.push({ id: b.id, g: b.g, st: b.st, s: Math.round(u.innen), platz: b.platz, p: [b.x, b.z] });
  }
  for (const k of [...W.unterwegs.keys()]) if (!lebt.has(k)) W.unterwegs.delete(k);
  // Sim: Boot wartet, kommt aber nie an der Boje an; Box bleibt nach Abfahrt belegt
  const st = S.state; const seen = new Set();
  for (const b of Object.values(st.boats)) {
    if (b.status !== 'waiting' || b.atBuoy) continue;
    const k = 'anfahrt-' + b.id; seen.add(k); if (!W.simSeit.has(k)) W.simSeit.set(k, jetzt);
    const d = jetzt - W.simSeit.get(k); if (d > 400) out.sim.push({ art: 'erreicht Boje nicht', id: b.id, g: b.size, s: Math.round(d) });
  }
  for (const [pid, l] of Object.entries(st.leaving || {})) {
    const k = 'box-' + pid + '-' + l.boatId; seen.add(k); if (!W.simSeit.has(k)) W.simSeit.set(k, jetzt);
    const d = jetzt - W.simSeit.get(k); if (d > 400) out.sim.push({ art: 'Box nach Abfahrt nicht frei', id: l.boatId, platz: pid, s: Math.round(d) });
  }
  for (const k of [...W.simSeit.keys()]) if (!seen.has(k)) W.simSeit.delete(k);
  // Geld
  if (!Number.isFinite(st.money)) out.sim.push({ art: 'Geld ist keine Zahl', wert: String(st.money) });
  else if (st.money < 0) out.sim.push({ art: 'Geld negativ', wert: st.money });
  // Bildrate seit der letzten Probe
  const tNow = performance.now();
  out.fps = W.frames / ((tNow - W.f0) / 1000); out.spielzeitJeSek = W.letzt ? (jetzt - W.letzt.t) / ((tNow - W.letzt.w) / 1000) : null;
  W.frames = 0; W.f0 = tNow; W.letzt = { t: jetzt, w: tNow };
  out.wetterFx = !!document.getElementById('weather-fx');
  // Bei einem Fund sofort anhalten, damit das Nahbild die Stelle noch zeigt (lauf.cjs lässt wieder laufen)
  if (['land', 'steg', 'fest', 'ueberlapp', 'haengt', 'pulk', 'lange'].some((k) => out[k].length)) { G.setPaused(true); out.angehalten = true; }
  return out;
};

const SNAP = () => {
  const G = window.hafenmeister; const st = G.sim.state;
  return { stufe: st.stage, tag: st.day, geld: Math.round(st.money), gaeste: st.guests, buero: st.office,
    boote: Object.keys(st.boats).length, liegend: G.sim.mooredBoats().length,
    facilities: JSON.stringify(st.facilities), buildings: JSON.stringify(st.buildings),
    services: JSON.stringify(G.services?.zustand?.()?.gebaut ?? null), ereignis: G.events?.current?.id ?? null };
};

// ------------------------------------------------------------------ Lauf
(async () => {
  fs.mkdirSync(path.join(OUT, 'bilder'), { recursive: true });
  const { s, url } = await serve(WEB);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...GERAETE[GERAET], deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fehler = []; const warnungen = []; const fehlendeDateien = [];
  let R = null;
  const tz = () => (R && R.verlauf.length ? R.verlauf[R.verlauf.length - 1] : null);
  const ort = () => { const v = tz(); return v ? `Stufe ${v.stufe}, Tag ${v.tag}` : 'Start'; };
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push({ wann: ort(), text: m.text().slice(0, 400) });
    else if (m.type() === 'warning') warnungen.push({ wann: ort(), text: m.text().slice(0, 300) });
  });
  page.on('pageerror', (e) => fehler.push({ wann: ort(), text: 'Skriptfehler: ' + String(e.message).slice(0, 400), stack: String(e.stack || '').split('\n').slice(1, 4).map((z) => z.trim().replace(/https?:\/\/localhost:\d+\//, '')).join(' < ') }));
  page.on('response', (r) => { if (r.status() >= 400) fehlendeDateien.push({ wann: ort(), url: r.url(), status: r.status() }); });
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@([^/]+)\/(.+)$/, (route) => {
    const file = route.request().url().split(/three@[^/]+\//)[1].split(/[?#]/)[0];
    route.fulfill({ path: path.join(THREE_DIR, file), contentType: 'text/javascript' });
  });

  const query = `?testtempo=${TEMPO}${START > 1 ? `&stufe=${START}` : ''}${EXTRA}`;
  R = { geraet: GERAET, tempo: TEMPO, query, start: new Date().toISOString(), commit: null,
    verlauf: [], kaeufe: [], stufen: [], bilder: [], treffer: { land: {}, steg: {}, fest: {}, ueberlapp: {}, haengt: {}, pulk: {}, lange: {}, sim: {} },
    nahbilder: [], speichern: [], wetter: {}, leistung: [], ende: null };
  try { R.commit = fs.readFileSync(path.join(WEB, 'version.txt'), 'utf8').trim(); } catch { /* lokal */ }

  const laden = async (q) => {
    await page.goto(url + q);
    await page.waitForFunction(() => window.hafenmeister?.sim && window.hafenmeister?.boatAnim && document.getElementById('boot')?.classList.contains('done'), null, { timeout: 60000 });
    await page.evaluate(() => { const G = window.hafenmeister; G.einstieg?.beenden?.(); G.camera.reset(); if (G.paused) G.setPaused(false);
      const W = window.__zrp ||= {}; W.frames = 0; W.f0 = performance.now(); W.raf = true;
      const f = () => { W.frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await page.waitForTimeout(500);
  };
  await laden(query);

  const t0 = Date.now(); const ende = t0 + MINUTEN * 60000;
  let naechstesBild = 0; let naechsteProbe = 0; let bildNr = 0; let letzteStufe = null; let speicherNachTag = 20;
  const nahZaehler = {};

  const bildschirmfoto = async (name, label) => {
    const datei = `bilder/${name}.jpg`;
    // Für das Bild kurz anhalten: ohne Spielschritte ist ein Bild schnell fertig
    const lief = await page.evaluate(() => { const G = window.hafenmeister; const l = !G.paused; G.setPaused(true); return l; });
    const t = Date.now();
    try {
      await page.screenshot({ path: path.join(OUT, datei), type: 'jpeg', quality: 62, timeout: 90000 });
    } catch (e) {
      fehler.push({ wann: ort(), text: `Bildschirmfoto nach ${Math.round((Date.now() - t) / 1000)} s abgebrochen (Seite reagiert nicht): ${String(e.message).split('\n')[0]}` });
    }
    if (lief) await page.evaluate(() => window.hafenmeister.setPaused(false));
    return { datei, label };
  };

  // Speichern und Laden: speichern, mit fast angehaltener Zeit neu laden, vergleichen,
  // dann mit Zeitraffer weiter (lädt denselben Spielstand noch einmal).
  const speichernPruefen = async (warum) => {
    // Nicht kurz vor dem Tageswechsel: dort springt schon ein Hauch Spielzeit nach dem Laden in den nächsten Tag
    for (let i = 0; i < 20; i++) {
      const knapp = await page.evaluate(() => { const S = window.hafenmeister.sim; const r = S.ctx.rules; return S.state.clock > r.dayLength + r.eveningLength - 3; });
      if (!knapp) break;
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.hafenmeister.setPaused(true));
    const vorher = await page.evaluate(`(${SNAP})()`);
    const ok = await page.evaluate(() => window.hafenmeister.spielstand?.speichern?.());
    // Was steht wirklich im Speicher? (zeigt, ob eine Abweichung beim Speichern oder beim Laden entsteht)
    const gespeichert = await page.evaluate(() => { try { const r = JSON.parse(localStorage.getItem('hafenmeister.spielstand')); const g = r.spiel ?? r.game ?? r; return { geld: Math.round(g.money), tag: g.day, phase: g.phase, uhr: g.clock }; } catch (e) { return { fehler: e.message }; } });
    // Fast angehaltene Zeit (testtempo=0.001), damit zwischen Laden und Vergleich nichts passiert
    await page.goto(url + '?testtempo=0.001' + EXTRA);
    // So früh wie möglich anhalten, sonst laufen Hafenbüro und Services schon weiter
    await page.waitForFunction(() => { const G = window.hafenmeister; if (G?.sim && G.setPaused) { G.setPaused(true); return true; } return false; }, null, { timeout: 60000, polling: 5 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('done'), null, { timeout: 60000 });
    await page.evaluate(() => window.hafenmeister.setPaused(true));
    const nachher = await page.evaluate(`(${SNAP})()`);
    const abw = [];
    for (const k of Object.keys(vorher)) {
      if (k === 'liegend' || k === 'boote') continue;
      // Mehr Geld ist kein Fehler: Boote auf dem Weg in ihre Box liegen nach dem Laden sofort fest und zahlen
      if (k === 'geld' ? nachher.geld < vorher.geld - 1 : vorher[k] !== nachher[k]) abw.push(k);
    }
    // Liegende Boote dürfen nicht verschwinden
    if (nachher.liegend < vorher.liegend) abw.push('liegend');
    R.speichern.push({ warum, gespeichert: !!ok, imSpeicher: gespeichert, vorher, nachher, abweichungen: abw });
    await laden(`?testtempo=${TEMPO}${EXTRA}`);
  };

  while (Date.now() < ende) {
    const w = Date.now() - t0;
    let zustand;
    try { zustand = await page.evaluate(`(${BOT})()`); } catch (e) { fehler.push({ wann: ort(), text: 'Bot: ' + e.message.slice(0, 200) }); break; }
    if (!zustand) break;
    zustand.w = Math.round(w / 1000);
    for (const k of zustand.kaeufe) R.kaeufe.push({ stufe: zustand.stufe, ...k });
    delete zustand.kaeufe;
    R.verlauf.push(zustand);
    if (zustand.ereignis) R.wetter[zustand.ereignis] = (R.wetter[zustand.ereignis] || 0) + 1;
    if (zustand.winter) R.wetter.winter = (R.wetter.winter || 0) + 1;

    if (letzteStufe !== zustand.stufe) {
      if (letzteStufe != null) R.stufen.push({ stufe: zustand.stufe, tag: zustand.tag, w: zustand.w });
      letzteStufe = zustand.stufe;
      await page.evaluate(() => window.hafenmeister.camera.reset());
      R.bilder.push({ ...(await bildschirmfoto(`${GERAET}-stufe${zustand.stufe}`, `Stufe ${zustand.stufe} erreicht, Tag ${zustand.tag}`)), w: zustand.w, stufe: zustand.stufe, tag: zustand.tag });
      // Speichern und Laden nach jedem Aufstieg (im Testmodus ?stufe=n speichert das Spiel nicht)
      if (START <= 1 && zustand.stufe > 1) await speichernPruefen(`nach Aufstieg auf Stufe ${zustand.stufe}`);
    }
    if (START <= 1 && zustand.tag >= speicherNachTag) { speicherNachTag += 40; await speichernPruefen(`Tag ${zustand.tag}, mitten im Spiel (${zustand.phase})`); }

    if (w >= naechsteProbe) {
      naechsteProbe = w + 2000;
      const p = await page.evaluate(`(${PROBE})()`);
      R.leistung.push({ w: zustand.w, fps: +p.fps.toFixed(1), tempo: p.spielzeitJeSek ? Math.round(p.spielzeitJeSek) : null, boote: p.n, ereignis: zustand.ereignis, stufe: zustand.stufe });
      for (const k of ['land', 'steg', 'fest', 'ueberlapp', 'haengt', 'pulk', 'lange', 'sim']) for (const e of p[k] ?? []) {
        const n = k === 'sim' ? `${e.art}${e.id != null ? ' ' + e.id : ''}${e.platz ? ' ' + e.platz : ''}`
          : (k === 'fest' || k === 'ueberlapp') ? `${e.a} + ${e.b} (${e.g}, ${e.st})` : `${e.id} (${e.g}, ${e.st}${e.platz ? ', ' + e.platz : ''})`;
        const m = R.treffer[k][n] ||= { mal: 0, erst: `Stufe ${zustand.stufe}, Tag ${zustand.tag}`, p: e.p?.map((v) => Math.round(v)), stufe: zustand.stufe, ...(e.kette ? { kette: e.kette } : {}) };
        m.mal++;
        if (e.n) m.n = Math.max(m.n || 0, e.n);
        // Nahbild: höchstens zwei je Art und Stufe
        const nk = `${k}-${zustand.stufe}`;
        if (e.p && m.mal === 1 && (nahZaehler[nk] || 0) < 2) {
          nahZaehler[nk] = (nahZaehler[nk] || 0) + 1;
          await page.evaluate((q) => { const G = window.hafenmeister; G.setPaused(true); G.camera.flyTo(q[0], q[1]); }, e.p);
          await page.waitForTimeout(1200);
          await page.evaluate(() => window.hafenmeister.camera.zoomAt(4));
          await page.waitForTimeout(1200);
          await page.evaluate((q) => { const G = window.hafenmeister; const r = G.canvas.getBoundingClientRect(); const v = new G.THREE.Vector3(q[0], 0, q[1]).project(G.camera.camera); const d = document.createElement('div'); d.className = '__ring'; Object.assign(d.style, { position: 'fixed', left: (r.left + (v.x + 1) / 2 * r.width - 40) + 'px', top: (r.top + (1 - v.y) / 2 * r.height - 40) + 'px', width: '80px', height: '80px', border: '3px solid #e0201a', borderRadius: '50%', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(d); const st = document.createElement('style'); st.className = '__ring'; st.textContent = 'body > *:not(#game):not(.__ring), #game > *:not(#stage) { visibility: hidden !important; }'; document.head.appendChild(st); }, e.p);
          const b = await bildschirmfoto(`${GERAET}-nah-${k}-s${zustand.stufe}-${nahZaehler[nk]}`, `${k}: ${n}, Stufe ${zustand.stufe}, Tag ${zustand.tag}`);
          R.nahbilder.push({ ...b, art: k, wer: n, stufe: zustand.stufe, tag: zustand.tag });
          m.bild = b.datei;
          await page.evaluate(() => { document.querySelectorAll('.__ring').forEach((x) => x.remove()); const G = window.hafenmeister; G.camera.reset(); G.setPaused(false); });
        }
      }
    }
    if (await page.evaluate(() => window.hafenmeister.paused)) await page.evaluate(() => window.hafenmeister.setPaused(false));
    if (w >= naechstesBild) {
      naechstesBild = w + BILD_S * 1000;
      bildNr++;
      R.bilder.push({ ...(await bildschirmfoto(`${GERAET}-${String(bildNr).padStart(4, '0')}`, `Stufe ${zustand.stufe}, Tag ${zustand.tag}, ${zustand.phase === 'day' ? 'Tag' : 'Abend'}, ${Math.round(zustand.geld)} €${zustand.ereignis ? ', ' + zustand.ereignis : ''}`)), w: zustand.w, stufe: zustand.stufe, tag: zustand.tag });
    }
    if (zustand.stufe >= BIS && zustand.ziel?.ok) { R.ende = `Ziel der Stufe ${zustand.stufe} erreicht an Tag ${zustand.tag}`; break; }
    await page.waitForTimeout(700);
  }
  if (!R.ende) { const v = tz(); R.ende = `Zeit abgelaufen (${MINUTEN} min), erreicht: Stufe ${v?.stufe}, Tag ${v?.tag}`; }
  R.dauerMin = +((Date.now() - t0) / 60000).toFixed(1);
  R.fehler = fehler; R.warnungen = warnungen; R.fehlendeDateien = fehlendeDateien;
  fs.writeFileSync(path.join(OUT, `ergebnis-${GERAET}.json`), JSON.stringify(R, null, 1));
  console.log(`${GERAET}: ${R.ende}; ${fehler.length} Fehler, ${R.bilder.length} Bilder, ${R.nahbilder.length} Nahbilder`);
  await browser.close(); s.close();
})().catch((e) => { console.error(e); process.exit(1); });
