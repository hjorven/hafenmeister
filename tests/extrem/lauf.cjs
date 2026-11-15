#!/usr/bin/env node
// Härtetest: stellt im echten Spiel (Browser, Handy und PC) Extremlagen her, prüft sie mit
// Messregeln und hält sie in Bildserien und kurzen Videos fest. Anleitung: docs/extremtest.md
//
// Aufruf (im Hauptordner des Repos, einmal vorher: cd tests && npm ci && cd ..):
//   node tests/extrem/lauf.cjs --out /tmp/extremtest
//
// Optionen (alle optional):
//   --geraet pc,handy      Geräte, durch Komma getrennt: pc, handy, handyquer, tablet (Standard pc,handy)
//   --lagen a,b            nur diese Lagen (ids aus lagen.cjs, Standard alle); --liste zeigt alle
//   --kurz                 alle Lagen etwa ein Drittel so lang, weniger Varianten (rund 25 statt 75 min je Gerät)
//   --minuten8 8           wie lange die Lage tempo8-lang läuft (Echtzeit-Minuten)
//   --web web              Ordner mit dem Spiel (Standard web/ im Repo)
//   --out dir              Ausgabeordner (Standard /tmp/extremtest)
//   --testtempo 8          Spielzeit je Echtzeit außer in tempo8-lang und schwache-fps (0 = aus)
//   --kein-video           keine Videos aus den Bildserien (sonst mit ffmpeg, falls vorhanden)
// Ergebnis: <out>/bericht.md mit Funden je Lage, Bildbogen und Video je Lage unter <out>/bilder/.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PROBE, serve, GERAETE, ladePlaywright } = require('../../tools/zeitraffer/lauf.cjs');
const { HELFER } = require('./helfer.cjs');
const { PRUEFE, VERDECKUNG, STEG_DETAIL } = require('./pruefungen.cjs');
const { LAGEN } = require('./lagen.cjs');
const { schreibeBericht } = require('./bericht.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes('--' + name);

if (flag('liste')) {
  for (const l of LAGEN) console.log(`${l.id.padEnd(26)} ${l.titel}`);
  process.exit(0);
}

const GERAETE_WAHL = String(opt('geraet', 'pc,handy')).split(',').map((s) => s.trim()).filter(Boolean);
const LAGEN_WAHL = opt('lagen') ? String(opt('lagen')).split(',').map((s) => s.trim()) : null;
const KURZ = flag('kurz');
const MINUTEN8 = Number(opt('minuten8', KURZ ? 3 : 8));
const WEB = path.resolve(opt('web', path.join(REPO, 'web')));
const OUT = path.resolve(opt('out', path.join(require('os').tmpdir(), 'extremtest')));
const VIDEO = !flag('kein-video');
const hat = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const MONTAGE = hat('montage'); const FFMPEG = VIDEO && hat('ffmpeg');

for (const g of GERAETE_WAHL) if (!GERAETE[g]) { console.error(`Unbekanntes Gerät: ${g} (pc, handy, handyquer, tablet)`); process.exit(2); }
if (LAGEN_WAHL) for (const id of LAGEN_WAHL) if (!LAGEN.some((l) => l.id === id)) { console.error(`Unbekannte Lage: ${id} (--liste zeigt alle)`); process.exit(2); }

const { chromium } = ladePlaywright();
const TOUCH = new Set(['handy', 'handyquer', 'tablet']);
// Funde, die immer Fehler sind; der Rest steht als Hinweis im Bericht
const FUND_ARTEN = ['boje', 'fehler', 'land', 'steg', 'fest', 'ueberlapp', 'haengt', 'lange', 'sim', 'menschen', 'leinen', 'xxl', 'abgleich', 'text', 'regeln', 'ui', 'speichern'];

// Testtempo (?testtempo=n, docs/zeitraffer.md): Spielzeit läuft n-mal so schnell wie bei 1x, in Schritten wie bei 8x.
// Mit Software-Grafik (5 bis 12 Bilder/s) kommt das Spiel sonst in einer Lage kaum über ein paar Spielminuten.
// Lagen mit echteZeit (8x über den Knopf, schwaches Gerät) laufen ohne, sie prüfen genau die normale Bildschleife.
const TESTTEMPO = Number(opt('testtempo', 8));
function adresse(lage, v) {
  const teile = [lage.adresse, v?.extra].filter(Boolean).map((x) => x.replace(/^[?&]/, ''));
  if (!lage.echteZeit && TESTTEMPO > 0) teile.unshift(`testtempo=${TESTTEMPO}`);
  return teile.length ? '?' + teile.join('&') : '';
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'bilder'), { recursive: true });
  const { s, url } = await serve(WEB);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let commit = null;
  try { commit = fs.readFileSync(path.join(WEB, 'version.txt'), 'utf8').trim(); } catch { try { commit = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* egal */ } }

  // Wie viele Küstentypen und Stegbilder hat das Spiel gerade? (aus dem Spiel selbst, damit neue mitlaufen)
  const zahlen = await (async () => {
    const ctx = await browser.newContext({ ...GERAETE.pc, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.goto(url + '?stufe=1');
    await p.waitForFunction(() => window.hafenmeister?.stegbild && window.hafenmeister?.gelaende, null, { timeout: 90000 });
    const z = await p.evaluate(async () => { const f = await import('./js/render/landschaft/formen.js'); return { kuesten: f.FORMEN.length, stegbilder: window.hafenmeister.stegbild.anzahl }; });
    await ctx.close();
    return z;
  })();

  const gesamt = { start: new Date().toISOString(), commit, kurz: KURZ, zahlen, geraete: {} };

  for (const geraet of GERAETE_WAHL) {
    const R = gesamt.geraete[geraet] = { lagen: [] };
    for (const lage of LAGEN) {
      if (LAGEN_WAHL && !LAGEN_WAHL.includes(lage.id)) continue;
      const kit0 = { kurz: KURZ, kuesten: zahlen.kuesten, stegbilder: zahlen.stegbilder };
      const varianten = lage.varianten ? lage.varianten(kit0) : [null];
      for (const v of varianten) {
        const name = v ? `${lage.id}/${v.name}` : lage.id;
        const q = adresse(lage, v);
        process.stdout.write(`${geraet} ${name} ${q} ... `);
        const t0 = Date.now();
        const E = await lageLaufen({ browser, url, geraet, lage, v, q, zahlen });
        E.dauerS = Math.round((Date.now() - t0) / 1000);
        R.lagen.push(E);
        const nF = Object.values(E.funde).reduce((n, m) => n + Object.keys(m).length, 0);
        console.log(`${E.dauerS} s, ${nF} Funde, ${E.bilder.length} Bilder${E.abbruch ? ', ABBRUCH: ' + E.abbruch : ''}`);
        fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify(gesamt, null, 1));
      }
    }
  }
  gesamt.ende = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify(gesamt, null, 1));
  schreibeBericht(OUT, gesamt);
  console.log(`Bericht: ${path.join(OUT, 'bericht.md')}`);
  await browser.close(); s.close();
})().catch((e) => { console.error(e); process.exit(1); });

// ------------------------------------------------------------------ eine Lage (oder Variante) laufen lassen
async function lageLaufen({ browser, url, geraet, lage, v, q, zahlen }) {
  const kurzname = (v ? `${lage.id}-${v.name}` : lage.id).replace(/[^a-z0-9-]/gi, '-');
  const E = { id: lage.id, variante: v?.name ?? null, titel: lage.titel, was: lage.was, adresse: q, geraet,
    funde: {}, hinweise: [], messungen: {}, bilder: [], nahbilder: [], fps: [], verdeckung: [], speichern: [], abbruch: null };
  const ctx = await browser.newContext({ ...GERAETE[geraet], deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const ort = () => E._ort || 'Start';
  page.on('console', (m) => { if (m.type() === 'error') neu('fehler', m.text().slice(0, 300), { wann: ort() }); });
  page.on('pageerror', (e) => neu('fehler', 'Skriptfehler: ' + String(e.message).slice(0, 300), { wann: ort(), stack: String(e.stack || '').split('\n').slice(1, 3).map((z) => z.trim().replace(/https?:\/\/localhost:\d+\//, '')).join(' < ') }));
  page.on('response', (r) => { if (r.status() >= 400) neu('fehler', `Datei fehlt (${r.status()}): ${r.url().replace(/https?:\/\/localhost:\d+\//, '')}`, { wann: ort() }); });

  function neu(art, key, extra = {}) {
    const m = (E.funde[art] ||= {});
    const e = m[key] ||= { mal: 0, erst: ort(), ...extra };
    e.mal++;
    return e;
  }
  let bildNr = 0; const nahZaehler = {};
  const datei = (n) => `bilder/${geraet}-${kurzname}-${n}.jpg`;

  const laden = async (adr) => {
    await page.goto(url + adr);
    await page.waitForFunction(() => window.hafenmeister?.sim && window.hafenmeister?.boatAnim && document.getElementById('boot')?.classList.contains('done'), null, { timeout: 90000 });
    await page.evaluate(() => { const G = window.hafenmeister; G.einstieg?.beenden?.(); G.tagesabschluss?.schliesse?.(); G.camera.reset(); if (G.paused) G.setPaused(false);
      const W = window.__zrp ||= {}; W.frames = 0; W.f0 = performance.now(); W.raf = true;
      const f = () => { W.frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await page.evaluate(`(${HELFER})()`);
    await page.waitForTimeout(800);
  };

  const foto = async (label, o = {}) => {
    const n = String(++bildNr).padStart(3, '0'); const d = datei(n);
    const lief = await page.evaluate(() => { const G = window.hafenmeister; const l = !G.paused; G.setPaused(true); return l; }).catch(() => false);
    try { await page.screenshot({ path: path.join(OUT, d), type: 'jpeg', quality: 70, timeout: 90000 }); }
    catch (e) { neu('fehler', 'Bildschirmfoto abgebrochen (Seite reagiert nicht)'); }
    if (lief) await page.evaluate(() => window.hafenmeister.setPaused(false)).catch(() => {});
    E.bilder.push({ datei: d, label, ...(o.serie === false ? { serie: false } : {}) });
    return d;
  };

  // Nahbild mit rotem Kreis an der Stelle eines Funds (wie im Zeitraffer), höchstens zwei je Art
  const nahbild = async (art, wer, p) => {
    if (!p || (nahZaehler[art] || 0) >= 2) return null;
    nahZaehler[art] = (nahZaehler[art] || 0) + 1;
    await page.evaluate((q) => { const G = window.hafenmeister; G.setPaused(true); G.camera.flyTo(q[0], q[1]); }, p);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.hafenmeister.camera.zoomAt(4));
    await page.waitForTimeout(1200);
    await page.evaluate((q) => { const G = window.hafenmeister; const r = G.canvas.getBoundingClientRect(); const v = new G.THREE.Vector3(q[0], 0, q[1]).project(G.camera.camera); const d = document.createElement('div'); d.className = '__ring'; Object.assign(d.style, { position: 'fixed', left: (r.left + (v.x + 1) / 2 * r.width - 40) + 'px', top: (r.top + (1 - v.y) / 2 * r.height - 40) + 'px', width: '80px', height: '80px', border: '3px solid #e0201a', borderRadius: '50%', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(d); const st = document.createElement('style'); st.className = '__ring'; st.textContent = 'body > *:not(#game):not(.__ring), #game > *:not(#stage) { visibility: hidden !important; }'; document.head.appendChild(st); }, p);
    const d = datei(`nah-${art}-${nahZaehler[art]}`);
    await page.screenshot({ path: path.join(OUT, d), type: 'jpeg', quality: 70, timeout: 90000 }).catch(() => {});
    E.nahbilder.push({ datei: d, art, wer, wann: ort() });
    await page.evaluate(() => { document.querySelectorAll('.__ring').forEach((x) => x.remove()); window.hafenmeister.camera.reset(); });
    await page.waitForTimeout(600);
    return d;
  };

  const pruefen = async (o = {}) => {
    const zs = await page.evaluate(() => window.__ex.zustand());
    E._ort = `Tag ${zs.tag} ${zs.phase === 'day' ? 'Tag' : 'Abend'} ${zs.uhr} s`;
    // Während der Prüfung und der Nahbilder steht das Spiel, sonst ist der Fund bei 24-facher Zeit schon weg
    const lief = await page.evaluate(() => { const G = window.hafenmeister; const l = !G.paused; G.setPaused(true); return l; });
    const p = await page.evaluate(`(${PROBE})()`);
    const q2 = await page.evaluate(`(${PRUEFE})(${JSON.stringify({ ui: o.ui !== false })})`);
    E.fps.push({ fps: +(p.fps || 0).toFixed(1), tempo: p.spielzeitJeSek ? +p.spielzeitJeSek.toFixed(1) : null, boote: p.n, menschen: q2.menschenZahl?.sichtbar ?? null });
    const alle = { ...p, ...q2 };
    for (const k of ['land', 'steg', 'fest', 'ueberlapp', 'haengt', 'pulk', 'lange', 'sim', 'boje', 'menschen', 'leinen', 'xxl', 'abgleich', 'text', 'regeln', 'ui']) {
      for (const e of alle[k] ?? []) {
        let art = k;
        if (k === 'ueberlapp' && e.st !== 'moored') art = 'beruehrt';
        // Lange Leinen beim Ablegen kamen nur bei Testtempo vor (große Schritte), bei 3x nie: dann nur Hinweis
        if (k === 'leinen' && !lage.echteZeit && TESTTEMPO > 1 && /reicht/.test(e.st)) art = 'leinenTempo';
        const key = k === 'sim' || k === 'regeln' ? `${e.art}${e.id != null ? ' ' + e.id : ''}${e.platz ? ' ' + e.platz : ''}${e.wert != null ? ' (' + e.wert + ')' : ''}`
          : (k === 'fest' || k === 'ueberlapp') ? `${e.a} + ${e.b} (${e.g}, ${e.st})` : `${e.id}${e.g ? ' (' + e.g + ')' : ''}: ${e.st ?? ''}${e.platz ? ', ' + e.platz : ''}`;
        const m = neu(art, key, { p: e.p?.map((x) => Math.round(x)) });
        if (art === 'steg' && m.mal === 1) m.trifft = await page.evaluate(`(${STEG_DETAIL})(${JSON.stringify(e.id)})`).catch(() => null);
        if (m.mal === 1 && FUND_ARTEN.includes(art) && e.p) m.bild = await nahbild(art, key, e.p);
      }
    }
    if (lief) await page.evaluate(() => window.hafenmeister.setPaused(false));
  };

  // Tafeln schließen: Esc, dann sichtbare Schließen-Knöpfe
  const schliessen = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) {
      const k = await page.evaluate(() => {
        const sichtbar = (e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; };
        const kand = [...document.querySelectorAll('button, [role=button]')].filter((e) => e.offsetParent !== null && sichtbar(e)).filter((e) => {
          const t = ((e.getAttribute('aria-label') || '') + ' ' + (e.title || '') + ' ' + (e.innerText || '')).trim();
          return /schlie(ß|ss)en|^\s*(zu|fertig|ok|weiter|zurück|x|×|✕)\s*$/i.test(t) || /(^|[-_ ])zu($|[-_ ])/.test(e.className);
        });
        const e = kand[0]; if (!e) return null;
        const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: (e.getAttribute('aria-label') || e.innerText || e.className).slice(0, 30) };
      });
      if (!k) break;
      if (TOUCH.has(geraet)) await page.touchscreen.tap(k.x, k.y); else await page.mouse.click(k.x, k.y);
      await page.waitForTimeout(400);
    }
  };

  const beobachte = async (sek, o = {}) => {
    const bildAlle = (o.bild ?? 10) * 1000, probeAlle = (o.probe ?? 3) * 1000;
    const ende = Date.now() + sek * 1000; let nBild = bildAlle ? Date.now() : Infinity; let nProbe = Date.now() + 1000;
    while (Date.now() < ende) {
      if (o.abschluss !== false) {
        const zu = await page.evaluate(() => { const G = window.hafenmeister; const offen = G.tagesabschluss?.offen?.(); if (offen) { G.tagesabschluss.schliesse(); if (G.paused) G.setPaused(false); } return !!offen; }).catch(() => false);
        if (zu) E.messungen['Tagesabschluss geschlossen'] = (E.messungen['Tagesabschluss geschlossen'] || 0) + 1;
      }
      if (Date.now() >= nProbe) { nProbe = Date.now() + probeAlle; await pruefen(o); }
      if (Date.now() >= nBild) { nBild = Date.now() + bildAlle; await foto(E._ort || ''); }
      await page.waitForTimeout(400);
    }
  };

  const speichernLaden = async (warum) => {
    const SNAP = () => { const G = window.hafenmeister; const st = G.sim.state; return { stufe: st.stage, tag: st.day, geld: Math.round(st.money), buero: st.office,
      liegend: G.sim.mooredBoats().length, facilities: JSON.stringify(st.facilities), ereignis: G.events?.current?.id ?? null, services: JSON.stringify(G.services?.zustand?.()?.gebaut ?? null) }; };
    await page.evaluate(() => window.hafenmeister.setPaused(true));
    const vorher = await page.evaluate(`(${SNAP})()`);
    const ok = await page.evaluate(() => window.hafenmeister.spielstand?.speichern?.());
    if (!ok) neu('speichern', `${warum}: speichern() meldet false`);
    await page.goto(url + '?testtempo=0.001');
    await page.waitForFunction(() => { const G = window.hafenmeister; if (G?.sim && G.setPaused) { G.setPaused(true); return true; } return false; }, null, { timeout: 90000, polling: 5 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('done'), null, { timeout: 90000 });
    await page.evaluate(() => window.hafenmeister.setPaused(true));
    await page.waitForTimeout(1500);
    const nachher = await page.evaluate(`(${SNAP})()`);
    const abw = [];
    for (const k of Object.keys(vorher)) {
      if (k === 'liegend') { if (nachher.liegend < vorher.liegend) abw.push(`liegend ${vorher.liegend} -> ${nachher.liegend}`); continue; }
      if (k === 'geld' ? nachher.geld < vorher.geld - 1 : vorher[k] !== nachher[k]) abw.push(`${k}: ${vorher[k]} -> ${nachher[k]}`);
    }
    for (const a of abw) neu('speichern', `${warum}: ${a}`);
    E.speichern.push({ warum, vorher, nachher, abweichungen: abw });
    await foto(`nach dem Laden (${warum}), Zeit fast angehalten`);
    // ohne Testtempo weiter, gleicher Spielstand
    await laden(lage.echteZeit || !(TESTTEMPO > 0) ? '' : `?testtempo=${TESTTEMPO}`);
    await page.evaluate(() => window.__ex.tempo(3));
  };

  // Menüs: jede Tafel öffnen, Verdeckung messen, Bild, schließen; dann mehrere übereinander
  const menues = async () => {
    const touch = TOUCH.has(geraet);
    const tippe = async (loc) => { if (touch) await loc.tap(); else await loc.click(); };
    const basis = await page.evaluate(`(${VERDECKUNG})()`);
    E.verdeckung.push({ tafel: 'ohne Tafel', ...basis });
    await foto('ohne Tafel');
    const eintraege = await page.evaluate(() => { document.getElementById('btn-menu')?.click(); const n = [...document.querySelectorAll('#hm-menue button')].filter((e) => e.offsetParent !== null).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean); document.getElementById('btn-menu')?.click(); return n; });
    const leiste = ['#btn-build', '#weather-chip', '.tz-neu, .hm-tafel-knopf', '.hm-ziel-knopf'];
    const tafeln = [...leiste.map((sel) => ({ name: sel, oeffne: async () => { const l = page.locator(sel).first(); if (!(await l.isVisible().catch(() => false))) return false; await tippe(l); return true; } })),
      ...eintraege.filter((t) => !/^Ton$|Maus und Tastatur/.test(t) || !touch).map((t) => ({ name: 'Menü: ' + t, oeffne: async () => {
        await tippe(page.locator('#btn-menu')); await page.waitForTimeout(500);
        const l = page.locator('#hm-menue button', { hasText: t.split(' ')[0] }).first();
        if (!(await l.isVisible().catch(() => false))) return false; await tippe(l); return true; } })),
      { name: 'Bootskarte', oeffne: async () => {
        // Ein Boot an der Boje suchen und echt antippen (vorher eins kommen lassen)
        await page.evaluate(() => window.__ex.boote(2, 2));
        // warten, bis eins an der Boje liegt, dann anhalten (sonst fährt es bei Testtempo gleich selbst ein)
        const anBoje = () => { const G = window.hafenmeister; if (G.sim.waitingBoats().some((b) => { const a = G.boatView.boot(b.id); return a?.moored && a.berth?.kind === 'buoy' && !a.versteckt; })) { G.setPaused(true); return true; } return false; };
        if (!(await page.waitForFunction(anBoje, null, { timeout: 45000, polling: 50 }).then(() => true).catch(() => false))) { E.hinweise.push('Bootskarte: 45 s lang kein Boot sichtbar an einer Boje'); return false; }
        // Die Bojen liegen oft außerhalb der Startansicht: Kamera hin, wie ein Spieler es auch tut
        await page.evaluate(() => { const G = window.hafenmeister; const a = G.sim.waitingBoats().map((x) => G.boatView.boot(x.id)).find((o) => o?.moored && o.berth?.kind === 'buoy' && !o.versteckt); if (a) G.camera.flyTo(a.x, a.z); });
        await page.waitForTimeout(1800);
        const p = await page.evaluate(() => { const G = window.hafenmeister; const r = G.canvas.getBoundingClientRect(); let best = null;
          // Karte gibt es für Boote an der Boje (liegende Boote kassieren beim Antippen)
          const anBoje = new Set(G.sim.waitingBoats().filter((b) => { const o = G.boatView.boot(b.id); return o?.moored && o.berth?.kind === 'buoy'; }).map((b) => String(b.id)));
          for (const e of G.boatView?.boote ?? []) { if (!anBoje.has(String(e.id))) continue; const v = new G.THREE.Vector3(e.anim.x, 0.5, e.anim.z).project(G.camera.camera);
            const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height; const d = Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2);
            if (x > 20 && y > 80 && x < r.right - 20 && y < r.bottom - 120 && (!best || d < best.d)) best = { x, y, d }; }
          return best; });
        if (!p) return false;
        if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(500);
        const auf = await page.evaluate(() => !document.getElementById('card')?.hidden);
        await page.evaluate(() => window.hafenmeister.setPaused(false));
        return auf;
      } }];
    for (const tf of tafeln) {
      const ok = await tf.oeffne().catch(() => false);
      if (!ok) { E.hinweise.push(`${tf.name}: nicht zu öffnen (nicht sichtbar)`); continue; }
      await page.waitForTimeout(1200);
      const vd = await page.evaluate(`(${VERDECKUNG})()`);
      E.verdeckung.push({ tafel: tf.name, ...vd });
      await pruefen({ ui: false });
      await foto(`${tf.name}: ${Math.round(vd.anteil * 100)} % bedeckt`);
      await schliessen();
      const nach = await page.evaluate(`(${VERDECKUNG})()`);
      if (nach.anteil > basis.anteil + 0.03) {
        neu('ui', `${tf.name}: lässt sich nicht schließen (Esc oder Schließen-Knopf), danach noch ${Math.round(nach.anteil * 100)} % bedeckt`);
        await foto(`${tf.name}: nach dem Schließen`);
        await laden(E.adresse);
      }
    }
    // Übereinander: Bauen, dann Tagesziel, dann Logbuch, dann Bootskarte, ohne zu schließen
    for (const tf of tafeln.filter((x) => /btn-build|tz-neu|Logbuch|Bootskarte/.test(x.name))) await tf.oeffne().catch(() => false);
    await page.waitForTimeout(1200);
    const ueber = await page.evaluate(`(${VERDECKUNG})()`);
    E.verdeckung.push({ tafel: 'übereinander (Bauen, Tagesziel, Logbuch, Bootskarte)', ...ueber });
    await pruefen({ ui: false });
    await foto(`übereinander: ${Math.round(ueber.anteil * 100)} % bedeckt`);
    for (let i = 0; i < 4; i++) await schliessen();
    const zum = await page.evaluate(`(${VERDECKUNG})()`);
    E.verdeckung.push({ tafel: 'nach dem Schließen aller', ...zum });
    if (zum.anteil > basis.anteil + 0.03) neu('ui', `nach viermal Schließen noch ${Math.round(zum.anteil * 100)} % bedeckt (ohne Tafel ${Math.round(basis.anteil * 100)} %)`);
    await foto('nach dem Schließen aller');
  };

  const t = {
    page, geraet, touch: TOUCH.has(geraet), kurz: KURZ, minuten8: MINUTEN8, kuesten: zahlen.kuesten, stegbilder: zahlen.stegbilder,
    ex: (name, ...args) => page.evaluate(([n, a]) => window.__ex[n](...a), [name, args]),
    beobachte, foto, schliessen, speichernLaden, laden, menues,
    uebersicht: () => page.evaluate(() => window.hafenmeister.camera.reset()),
    fund: (art, text) => neu(art, text),
    hinweis: (text) => E.hinweise.push(text),
    messe: (k, wert) => { E.messungen[k] = wert; },
  };
  try {
    await laden(q);
    await lage.lauf(t);
    await t.uebersicht();
    await page.waitForTimeout(800);
    await foto('Ende, ganzer Hafen');
  } catch (e) {
    E.abbruch = String(e.message || e).split('\n')[0].slice(0, 300);
    neu('fehler', 'Lage abgebrochen: ' + E.abbruch);
    try { await foto('beim Abbruch'); } catch { /* egal */ }
  }
  await ctx.close();
  delete E._ort;
  // Bildbogen und Video aus der Serie
  const serie = E.bilder.filter((b) => b.serie !== false).map((b) => path.join(OUT, b.datei)).filter((f) => fs.existsSync(f));
  if (MONTAGE && serie.length) {
    const bogen = `bilder/${geraet}-${kurzname}-bogen.jpg`;
    try {
      const breit = geraet === 'pc' || geraet === 'handyquer' || geraet === 'tablet' ? 4 : 6;
      execFileSync('montage', [...serie, '-tile', `${breit}x`, '-geometry', geraet === 'pc' ? '480x300+4+4' : '240x520+4+4', '-quality', '72', path.join(OUT, bogen)], { stdio: 'ignore' });
      E.bogen = bogen;
    } catch { /* ohne Bogen */ }
  }
  if (FFMPEG && serie.length >= 3) {
    const liste = path.join(OUT, 'bilder', `${geraet}-${kurzname}.txt`);
    fs.writeFileSync(liste, serie.map((f) => `file '${f}'\nduration 0.7`).join('\n') + `\nfile '${serie[serie.length - 1]}'\n`);
    const vid = `bilder/${geraet}-${kurzname}.mp4`;
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-r', '10', path.join(OUT, vid)], { stdio: 'ignore' });
      E.video = vid;
    } catch { /* ohne Video */ }
    fs.rmSync(liste, { force: true });
  }
  return E;
}
