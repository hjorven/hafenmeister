// Überraschende Gesten (P26, docs/hafengesten.md), echt bedient mit Maus oder Finger:
// 1. Hafenmeister gedrückt halten: Hafenhorn kassiert alles. Kurz antippen öffnet weiter das Gästebuch.
//    Hafenglocke antippen läutet.
// 2. Doppeltipp auf ein Boot im Hafen: Fernglas folgt, Steckbrief steht; Karte ziehen beendet es.
//    Möwen fliegen auf (Taste H am PC, Antippen am Handy), langes Drücken aufs Wasser macht Wellenringe.
// Die Logik ist auf allen Geräten dieselbe: geprüft am Handy (Finger) und am PC (Maus).
import { test, expect, isTouchProject, ohneEinstieg, kameraRuhig } from '../helpers.mjs';

test.skip(({ projekt }) => projekt !== 'handy' && projekt !== 'pc', 'Gesten werden am Handy und am PC geprüft');

// Stufe 2 mit "Hafenmeister mit Funk" (Bürostufe 1): das Haus steht, das Hafenhorn darf kassieren
async function hafenMitBuero(page) {
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.hafengesten, null, { timeout: 20_000 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
    const st = g.sim.state;
    const ziel = g.sim.ctx.rules.stageGoals[st.stage];
    st.stageGuests = ziel.guests;
    st.ratings = st.ratings.map(() => 5);
    st.money = ziel.cost + 5000;
    if (g.paused) g.setPaused(false);
    g.sim.advanceStage();
    document.querySelector('.hm-feier-weiter')?.click();
    while (st.office < 1) if (!g.sim.upgradeOffice()?.ok) st.office = 1;
    g.emit('sim:change', { reason: 'test' });
  });
  // Die Aufstiegsfeier kann unter Last erst nach dem Klick erscheinen: so lange "Weiter" drücken, bis sie zu ist
  await expect.poll(() => page.evaluate(() => {
    const f = document.getElementById('hm-feier');
    if (f && !f.hidden && f.offsetParent !== null) { document.querySelector('.hm-feier-weiter')?.click(); return false; }
    return true;
  }), { timeout: 20_000, intervals: [250] }).toBe(true);
  await page.waitForFunction(() => window.hafenmeister.hafengesten.hornErlaubt() && !!window.hafenmeister.hafengesten.glockeOrt(),
    null, { timeout: 30_000, polling: 200 });
  // Überblicksflug beim Laden und Kamerafahrt nach dem Aufstieg abwarten, sonst holen sie die Kamera zurück
  await page.waitForFunction(() => !document.body.classList.contains('hm-ueberblick'), null, { timeout: 30_000, polling: 200 });
  await kameraRuhig(page, 20_000);
  // Die Kamerafahrt der Aufstiegsfeier läuft mit eigener Uhr: warten, bis das Bild eine Sekunde stillsteht
  const lage = () => page.evaluate(() => { const c = window.hafenmeister.camera; return [c.target.x, c.target.z, c.viewWidth, c.pitch].map((v) => v.toFixed(2)).join(); });
  for (let i = 0, vorher = await lage(); i < 30; i++) {
    await page.waitForTimeout(1000);
    const jetzt = await lage();
    if (jetzt === vorher) break;
    vorher = jetzt;
  }
}

// Kamera auf einen Weltpunkt, Bildschirmlage (Seitenkoordinaten) eines Punkts zurück
async function zeige(page, ziel, breite = 70) {
  await page.evaluate(({ x, z, breite }) => {
    const c = window.hafenmeister.camera;
    c.stop?.();
    c._fly = null;
    c.target.set(x, 0, z);
    c.setPitch?.(60, { sofort: true });
    c.viewWidth = breite;
    c.zoomAt(1);
  }, { ...ziel, breite });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
const aufSchirm = (page, p) => page.evaluate(({ x, y, z }) => {
  const g = window.hafenmeister;
  const v = new g.THREE.Vector3(x, y, z).project(g.camera.camera);
  const r = g.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * g.camera.screenW, y: r.top + (1 - v.y) / 2 * g.camera.screenH };
}, p);

// Finger oder Maustaste ms lang ruhig halten (oder bis die Funktion ms() fertig ist)
async function halten(page, p, ms, touch) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    await (typeof ms === 'function' ? ms() : page.waitForTimeout(ms));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await (typeof ms === 'function' ? ms() : page.waitForTimeout(ms));
    await page.mouse.up();
  }
}
async function tippen(page, p, touch) {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

test('Hafenhorn kassiert alles, kurzer Tipp öffnet das Gästebuch, die Glocke läutet', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  const touch = isTouchProject(testInfo);
  await hafenMitBuero(page);
  // Zwei Boote liegen mit offenem Liegegeld im Hafen
  const offen = await page.evaluate(() => {
    const g = window.hafenmeister;
    for (let i = 0; i < 2000 && g.sim.mooredBoats().filter((b) => b.pendingFee > 0).length < 2; i++) {
      g.sim.fastForward(1);
      for (const w of g.sim.waitingBoats()) g.sim.autoEnter(w.id);
    }
    g.setPaused(true);
    window.__gesten = [];
    for (const n of ['gesten:hafenhorn', 'gesten:glocke']) g.on(n, (d) => window.__gesten.push([n, d]));
    return g.sim.mooredBoats().reduce((s, b) => s + b.pendingFee, 0);
  });
  expect(offen, 'kein offenes Liegegeld für den Test').toBeGreaterThan(0);

  const haus = await page.evaluate(() => {
    const g = window.hafenmeister;
    const o = g.scene.getObjectByName('gebaeude').children.find((m) => m.userData.pick?.id === 'hafenmeister');
    const box = new g.THREE.Box3().setFromObject(o);
    const c = box.getCenter(new g.THREE.Vector3());
    return { x: c.x, y: box.max.y * 0.6, z: c.z };
  });
  await zeige(page, { x: haus.x, z: haus.z - 6 });
  const p = await aufSchirm(page, haus);
  // Trifft der Punkt wirklich das Haus (keine Leiste darüber)?
  expect(await page.evaluate(({ x, y }) => {
    const g = window.hafenmeister;
    const r = g.canvas.getBoundingClientRect();
    return document.elementFromPoint(x, y) === g.canvas && g.pick(x - r.left, y - r.top)?.id;
  }, p)).toBe('hafenmeister');

  // Kurz antippen: Gästebuch, kein Horn
  await tippen(page, p, touch);
  // Signal statt fester Zeit: das Gästebuch ist offen (ein Tipp, der fälschlich hornen würde, wäre bis dahin auch durch)
  await expect.poll(() => page.evaluate(() => window.hafenmeister.gaestebuch?.offen ?? true), { timeout: 20_000 }).toBe(true);
  expect(await page.evaluate(() => window.__gesten.length), 'kurzer Tipp hat das Horn ausgelöst').toBe(0);
  expect(await page.evaluate(() => window.hafenmeister.gaestebuch?.offen ?? true), 'Gästebuch öffnet nicht mehr').toBe(true);
  await page.evaluate(() => window.hafenmeister.gaestebuch?.schliessen?.());

  // Gedrückt halten: Horn, alles kassiert, Kasse stimmt
  const vorher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  await halten(page, p, 800, touch);
  await expect.poll(() => page.evaluate(() => window.__gesten.filter(([n]) => n === 'gesten:hafenhorn').length)).toBe(1);
  const nachher = await page.evaluate(() => ({
    geld: window.hafenmeister.sim.state.money,
    offen: window.hafenmeister.sim.mooredBoats().reduce((s, b) => s + b.pendingFee, 0),
  }));
  expect(nachher.offen, 'Hafenhorn hat nicht alles kassiert').toBe(0);
  expect(nachher.geld).toBeGreaterThanOrEqual(vorher + offen);
  expect(await page.evaluate(() => window.hafenmeister.gaestebuch?.offen ?? false), 'Halten öffnet das Gästebuch').toBe(false);

  // Glocke antippen
  const ort = await page.evaluate(() => {
    const o = window.hafenmeister.hafengesten.glockeOrt();
    return { x: o.x, y: o.y, z: o.z };
  });
  await zeige(page, { x: ort.x, z: ort.z - 4 }, 40);
  const glocke = await page.evaluate(() => {
    const g = window.hafenmeister;
    const o = g.scene.getObjectByName('hafenglocke');
    const v = new g.THREE.Vector3(0, 1.4, 0);
    o.localToWorld(v);
    return { x: v.x, y: v.y, z: v.z };
  });
  await tippen(page, await aufSchirm(page, glocke), touch);
  await expect.poll(() => page.evaluate(() => window.__gesten.filter(([n]) => n === 'gesten:glocke').length)).toBe(1);
});

test('Fernglas folgt einem Boot, Möwen fliegen auf, Wellenringe auf dem Wasser', async ({ game }, testInfo) => {
  test.setTimeout(240_000);
  const { page } = game;
  const touch = isTouchProject(testInfo);
  await hafenMitBuero(page);
  // Ein Boot im Hafen (nicht an der Boje), Spiel angehalten, damit es stillliegt
  const id = await page.evaluate(() => {
    const g = window.hafenmeister;
    // Kurzhalter (nights 0) legen am selben Tag wieder ab: ein Boot nehmen, das über Nacht bleibt
    const bleibt = (b) => !b.stationed && b.nights >= 1;
    for (let i = 0; i < 2000 && !g.sim.mooredBoats().some(bleibt); i++) {
      g.sim.fastForward(1);
      for (const w of g.sim.waitingBoats()) g.sim.autoEnter(w.id);
    }
    // Das Boot, das am nächsten an der Hafenmitte liegt (Ankerfeld und Außenplätze können außerhalb der Kamera-Grenzen liegen)
    const t = g.camera.target;
    const nah = (x) => { const m = g.boatView.boot(x.id)?.model; return m ? Math.hypot(m.position.x - t.x, m.position.z - t.z) : Infinity; };
    const b = g.sim.mooredBoats().filter(bleibt).sort((p, q) => nah(p) - nah(q))[0];
    return b ? b.id : null;
  });
  expect(id, 'kein Boot im Hafen').not.toBeNull();
  // Boote reisen von weit draußen an: warten, bis das Modell wirklich an seinem Platz liegt
  await page.evaluate(() => { const g = window.hafenmeister; g.setPaused(false); g.speed = 8; });
  await page.waitForFunction((id) => {
    const g = window.hafenmeister;
    const b = g.sim.mooredBoats().find((x) => x.id === id);
    const m = g.boatView.boot(id)?.model;
    const pl = b && g.stege?.platz?.(b.berthId ?? b.berth);
    return !!m?.parent && !!pl && Math.hypot(m.position.x - pl.x, m.position.z - pl.z) < 12;
  }, id, { timeout: 60_000, polling: 250 });
  await page.evaluate(() => { window.hafenmeister.speed = 1; });
  await page.evaluate(() => window.hafenmeister.setPaused(true));
  const boot = await page.evaluate((id) => {
    const m = window.hafenmeister.boatView.boot(id).model;
    return { x: m.position.x, y: m.position.y + 0.8, z: m.position.z };
  }, id);
  // Andere Module können die Kamera noch einmal fahren (Meldungen, Aufstieg): so lange zeigen, bis das Boot ruhig unter dem Punkt liegt
  let p = null;
  for (let i = 0; i < 6 && !p; i++) {
    await zeige(page, { x: boot.x, z: boot.z }, 60);
    await page.waitForTimeout(400);
    const q = await aufSchirm(page, boot);
    const r = await page.evaluate(({ q, id }) => {
      const g = window.hafenmeister, c = g.canvas.getBoundingClientRect();
      const pk = g.pick(q.x - c.left, q.y - c.top, { types: ['boat'] });
      return pk?.type === 'boat' && String(pk.id) === String(id) && document.elementFromPoint(q.x, q.y) === g.canvas;
    }, { q, id });
    if (r) p = q;
  }
  expect(p, 'Boot nicht antippbar im Bild').not.toBeNull();
  // Doppeltipp, bis das Fernglas an ist (unter Last kann ein Tipp zu spät kommen und zählt dann als zwei einzelne)
  for (let versuch = 0; versuch < 4; versuch++) {
    if (touch) {
      // Zwei Tipps direkt hintereinander als Pointer-Ereignisse im Spiel: Echte Touch-Eingaben über CDP warten im
      // Test-Browser (SwiftShader) je Tipp auf ein Bild und kommen oft langsamer als die Doppeltipp-Grenze von 350 ms
      await page.evaluate((p) => {
        const c = window.hafenmeister.canvas;
        for (let i = 0; i < 2; i++) {
          const o = { pointerId: 70 + i, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true, button: 0, buttons: 1 };
          c.dispatchEvent(new PointerEvent('pointerdown', o));
          c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
        }
      }, p);
    } else {
      await page.mouse.dblclick(p.x, p.y);
    }
    const an = await page.waitForFunction((id) => window.hafenmeister.fernglas.boot === id, id, { timeout: 5_000 }).then(() => true, () => false);
    if (an) break;
  }
  await expect.poll(() => page.evaluate(() => window.hafenmeister.fernglas.boot)).toBe(id);
  const karte = page.locator('.hm-steckbrief');
  await expect(karte).toBeVisible();
  await expect(karte).toContainText('Fernglas');
  await expect(karte).toContainText(/Größe [SMLX]+/);
  await expect(karte).toBeInViewport({ ratio: 1 });
  // Kamera bleibt beim Boot: es steht im Bild und nicht hinter dem Steckbrief (warten, bis die Kamerafahrt dort ist)
  const lageVon = () => page.evaluate((id) => {
    const g = window.hafenmeister;
    const v = g.boatView.boot(id).model.position.clone().project(g.camera.camera);
    const r = g.canvas.getBoundingClientRect();
    const x = r.left + (v.x + 1) / 2 * g.camera.screenW, y = r.top + (1 - v.y) / 2 * g.camera.screenH;
    const k = document.querySelector('.hm-steckbrief').getBoundingClientRect();
    return { imBild: x > 0 && y > 0 && x < innerWidth && y < innerHeight, hinterKarte: x > k.left && x < k.right && y > k.top && y < k.bottom };
  }, id);
  await expect.poll(async () => { const l = await lageVon(); return l.imBild && !l.hinterKarte; }, { timeout: 20_000 }).toBe(true);
  const lage = await lageVon();
  expect(lage.imBild, 'Kamera folgt dem Boot nicht').toBe(true);
  expect(lage.hinterKarte, 'Boot steht hinter dem Steckbrief').toBe(false);
  // "Fernglas ab" beendet es
  await karte.getByRole('button', { name: 'Fernglas ab' }).click();
  await expect(karte).toBeHidden();
  expect(await page.evaluate(() => window.hafenmeister.fernglas.aktiv)).toBe(false);

  // Möwen: am PC Taste H, am Handy eine sitzende Möwe antippen
  await page.waitForFunction(() => window.hafenmeister.hafengesten.moewen().filter((m) => m.zustand === 'sitzt').length >= 3, null, { timeout: 15_000 });
  const auf = () => page.evaluate(() => window.hafenmeister.hafengesten.moewen().filter((m) => m.zustand !== 'sitzt').length);
  if (touch) {
    // Eine sitzende Möwe antippen; fliegt sie vorher von selbst los, die nächste nehmen
    for (let versuch = 0; versuch < 4 && !(await auf()); versuch++) {
      const m = await page.evaluate(() => {
        const g = window.hafenmeister;
        const s = g.hafengesten.moewen().find((x) => x.zustand === 'sitzt');
        return s ? { x: s.x, y: s.y, z: s.z } : null;
      });
      if (!m) break;
      await zeige(page, { x: m.x, z: m.z }, 60);
      await tippen(page, await aufSchirm(page, m), touch);
      await page.waitForFunction(() => window.hafenmeister.hafengesten.moewen().some((m) => m.zustand !== 'sitzt'), null, { timeout: 4_000 }).catch(() => {});
    }
  } else {
    await page.keyboard.press('h');
  }
  await expect.poll(auf, { timeout: 20_000 }).toBeGreaterThan(0);

  // Wellenring: freies Wasser lange drücken (ein Stück seewärts vom Boot)
  await zeige(page, { x: boot.x, z: boot.z - 50 }, 120);
  await page.evaluate(() => { window.__ring = 0; window.hafenmeister.on('gesten:wellenring', () => window.__ring++); });
  const w = await page.evaluate(() => {
    const g = window.hafenmeister;
    const r = g.canvas.getBoundingClientRect();
    // Von der Bildmitte nach außen suchen: Leisten und Knöpfe am Rand können sich während des Tests verschieben
    const frei = (x, y) => [[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40]]
      .every(([dx, dy]) => document.elementFromPoint(r.left + x + dx, r.top + y + dy) === g.canvas);
    for (let i = 0; i < 900; i++) {
      const ring = Math.floor(Math.sqrt(i)), winkel = i * 2.399;
      const x = g.camera.screenW * (0.5 + 0.03 * ring * Math.cos(winkel)), y = g.camera.screenH * (0.5 + 0.02 * ring * Math.sin(winkel));
      if (x < 20 || y < 20 || x > g.camera.screenW - 20 || y > g.camera.screenH - 20) continue;
      if (g.pick(x, y)) continue;
      const v = g.camera.screenToWorld(x, y);
      if (!v || !g.landschaft.istWasser(v.x, v.z)) continue;
      if (!frei(x, y)) continue;
      return { x: r.left + x, y: r.top + y };
    }
    return null;
  });
  expect(w, 'kein freies Wasser im Bild').not.toBeNull();
  // So lange halten, bis der zweite Ring kommt (normal nach 1,1 s). Unter Last kommen die Bilder im Test-Browser
  // langsamer, darum bis zum Signal (Frist 20 s) statt fester Haltezeit; ohne Wiederholung schlägt die Frist fehl.
  await halten(page, w, () => page.waitForFunction(() => window.__ring >= 2, null, { timeout: 20_000 }).catch(() => {}), touch);
  expect(await page.evaluate(() => window.__ring), 'Wellenring kommt nicht oder nicht wiederholt').toBeGreaterThanOrEqual(2);
});
