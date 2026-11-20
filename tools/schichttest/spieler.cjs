// Schichttest: Werkzeuge zum echten Spielen über die Oberfläche (Maus, Finger) und Prüfhilfen im Browser.
// Gehört zu tools/schichttest/lauf.cjs, Anleitung in docs/schichttest.md.
//
// Grundsatz: gespielt wird wie ein Mensch. Knöpfe werden angeklickt oder angetippt, Boote mit der
// Maus oder dem Finger gezogen, Münzen mit einem Strich eingesammelt. Der Test liest den Zustand des
// Spiels nur, um zu prüfen, ob die Handlung gewirkt hat. Einzige Ausnahmen (stehen im Bericht):
// Ausgangslagen über Testadressen (?stufe=n, ?seed=) und das Warten auf Spielzeit.

// ------------------------------------------------------------------ im Browser: Hilfen
// Wird nach jedem Laden einmal in die Seite gelegt (window.__st).
const HILFEN = () => {
  const G = window.hafenmeister;
  const T = G.THREE;
  const st = window.__st = window.__st || {};
  st.ereignisse = st.ereignisse || [];
  if (!st.lauscht) {
    st.lauscht = true;
    for (const n of ['boot:an-boje', 'boot-kommt', 'sim:moored', 'sim:selfEntered', 'sim:feeReady', 'sim:collected',
      'boat:moored', 'sim:castOff', 'sim:departed', 'phase', 'sim:stageUp', 'sim:built', 'ui:tow-end', 'tagesabschluss:fertig',
      'ziel:gewaehlt', 'ziel:erreicht', 'sim:dayEnd', 'sim:turnedAway', 'sim:dismissed']) {
      G.on(n, (d) => {
        // Nur einfache Felder merken (Ereignisse tragen oft das ganze Boot mit Kreisbezügen)
        const flach = {};
        if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) flach[k] = v; }
        st.ereignisse.push({ n, t: G.time, d: d && typeof d === 'object' ? flach : d });
        if (st.ereignisse.length > 400) st.ereignisse.splice(0, 100);
      });
    }
  }
  const canvas = G.canvas;
  const istSpielflaeche = (el) => el === canvas || el?.classList?.contains('hm-gesten');
  // Bildschirmpunkt (CSS-Pixel im Fenster) eines Weltpunkts; hinter der Kamera = null
  st.schirm = (x, y, z) => {
    const v = new T.Vector3(x, y, z).project(G.camera.camera);
    if (v.z > 1) return null;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  // Liegt an diesem Punkt die Spielfläche oben (keine Leiste, Karte oder Meldung darüber)?
  st.frei = (x, y) => {
    if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) return false;
    return istSpielflaeche(document.elementFromPoint(x, y));
  };
  // Was liegt über dem Punkt? (für Funde: "Boot unter Tagesziel-Tafel")
  st.wasLiegtDa = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el || istSpielflaeche(el)) return null;
    const k = el.closest('[id]');
    return (k?.id ? '#' + k.id : '') + (el.className && typeof el.className === 'string' ? ' .' + el.className.split(' ')[0] : '') || el.tagName;
  };
  // 3D-Objekt eines Gastboots (userData.pick = { type: 'boat', id })
  st.bootObjekt = (id) => {
    let obj = null;
    const ziel = String(id).replace(/^b/, '');
    G.scene.traverse((o) => {
      const pk = o.userData?.pick;
      if (!obj && pk?.type === 'boat' && String(pk.id).replace(/^b/, '') === ziel && o.visible !== false) obj = o;
    });
    return obj;
  };
  st.bootSchirm = (id) => {
    const o = st.bootObjekt(id);
    if (!o) return null;
    const p = o.getWorldPosition(new T.Vector3());
    const s = st.schirm(p.x, p.y + 0.3, p.z);
    return s && { ...s, wx: p.x, wz: p.z, frei: st.frei(s.x, s.y), drueber: st.wasLiegtDa(s.x, s.y) };
  };
  st.platzSchirm = (pid) => {
    const p = G.stege?.platz?.(pid);
    if (!p) return null;
    const s = st.schirm(p.x, 0.1, p.z);
    return s && { ...s, wx: p.x, wz: p.z, frei: st.frei(s.x, s.y), drueber: st.wasLiegtDa(s.x, s.y) };
  };
  st.muenzeSchirm = (bootId) => {
    let m = null;
    G.scene.traverse((o) => { if (!m && o.name === `muenze-${bootId}` && o.visible !== false) m = o; });
    if (!m) return null;
    const p = m.getWorldPosition(new T.Vector3());
    const s = st.schirm(p.x, p.y, p.z);
    return s && { ...s, frei: st.frei(s.x, s.y) };
  };
  st.muenzen = () => {
    const l = [];
    G.scene.traverse((o) => { if (/^muenze-/.test(o.name) && o.visible !== false && o.parent) l.push(o.name.slice(7)); });
    return l;
  };
  // Freier Punkt auf leerem Wasser oder Land (nichts Antippbares), möglichst nahe an (zx, zy)
  st.leererPunkt = (zx = innerWidth / 2, zy = innerHeight / 2, rand = 50) => {
    let best = null;
    for (let gy = 0.08; gy <= 0.92; gy += 0.04) {
      for (let gx = 0.08; gx <= 0.92; gx += 0.04) {
        const x = Math.round(innerWidth * gx), y = Math.round(innerHeight * gy);
        const ok = [[0, 0], [-rand, 0], [rand, 0], [0, -rand], [0, rand]].every(([dx, dy]) => st.frei(x + dx, y + dy));
        if (!ok) continue;
        if (G.pick && G.pick(x - canvas.getBoundingClientRect().left, y - canvas.getBoundingClientRect().top, { tolerance: 40 })) continue;
        const d = Math.hypot(x - zx, y - zy);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best;
  };
  // Freie Mitte des sichtbaren Spielfelds (ohne Leisten)
  st.mitte = () => {
    let sx = 0, sy = 0, n = 0;
    for (let gy = 0.05; gy <= 0.95; gy += 0.05) for (let gx = 0.05; gx <= 0.95; gx += 0.05) {
      const x = innerWidth * gx, y = innerHeight * gy;
      if (st.frei(x, y)) { sx += x; sy += y; n++; }
    }
    return n ? { x: sx / n, y: sy / n } : { x: innerWidth / 2, y: innerHeight / 2 };
  };
  st.kameraRuhig = () => {
    const c = G.camera; const s = c._schwung || {};
    return !c._fly && (c._yawTarget ?? null) === null && (c._pitchTarget ?? null) === null && !s.x && !s.y && !s.yaw && !s.pitch;
  };
  // Sichtbare Knöpfe und Chips, die ganz oder teilweise aus dem Bild ragen
  st.ausDemBild = () => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role=button], .hm-chip')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      if (el.closest('[hidden], [aria-hidden="true"]')) continue;
      const ueber = Math.max(0, -r.left) + Math.max(0, r.right - innerWidth) + Math.max(0, -r.top) + Math.max(0, r.bottom - innerHeight);
      if (ueber > 3) out.push({ was: (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"', r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
    }
    return out;
  };
  return true;
};

// ------------------------------------------------------------------ in Node: Eingaben
// Ein Spieler bedient das Spiel mit Maus (PC) oder Finger (Handy, Tablet), nie über game.*.
function spieler(page, touch) {
  let cdp = null;
  const cdpSitzung = async () => (cdp ||= await page.context().newCDPSession(page));
  const finger = async (type, punkte) => {
    const c = await cdpSitzung();
    await c.send('Input.dispatchTouchEvent', {
      type, touchPoints: punkte.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id, radiusX: 4, radiusY: 4, force: 1 })),
    });
  };
  const warte = (ms) => page.waitForTimeout(ms);
  const sp = {
    touch,
    async tippen(x, y) {
      if (touch) { await finger('touchStart', [{ x, y }]); await warte(40); await finger('touchEnd', []); }
      else await page.mouse.click(x, y);
    },
    async doppelt(x, y) {
      if (touch) { await sp.tippen(x, y); await warte(80); await sp.tippen(x, y); }
      else await page.mouse.dblclick(x, y);
    },
    // Ziehen über eine Liste von Punkten. halten: Pause am Ende vor dem Loslassen (Einrasten sehen)
    async ziehen(punkte, { schritt = 18, halten = 250, start = 120 } = {}) {
      const p0 = punkte[0];
      if (touch) await finger('touchStart', [p0]); else { await page.mouse.move(p0.x, p0.y); await page.mouse.down(); }
      await warte(start);
      for (let i = 1; i < punkte.length; i++) {
        const a = punkte[i - 1], b = punkte[i];
        const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 25));
        for (let k = 1; k <= n; k++) {
          const q = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n };
          if (touch) await finger('touchMove', [q]); else await page.mouse.move(q.x, q.y);
          await warte(schritt);
        }
      }
      await warte(halten);
      if (touch) await finger('touchEnd', []); else await page.mouse.up();
    },
    // Zwei Finger auseinander (zoomen) oder Mausrad
    async zoomen(x, y, faktor) {
      if (touch) {
        const d0 = 60, d1 = Math.round(60 * faktor);
        const frames = 10;
        await finger('touchStart', [{ x: x - d0, y }, { x: x + d0, y }]);
        for (let i = 1; i <= frames; i++) {
          const d = d0 + (d1 - d0) * i / frames;
          await finger('touchMove', [{ x: x - d, y }, { x: x + d, y }]);
          await warte(20);
        }
        await finger('touchEnd', []);
      } else {
        await page.mouse.move(x, y);
        await page.mouse.wheel(0, faktor > 1 ? -400 : 400);
      }
    },
    async knopf(locator) {
      try {
        if (touch) await locator.tap({ timeout: 10_000 }); else await locator.click({ timeout: 10_000 });
      } catch (e) {
        // Woran liegt es? Bilder pro Sekunde (steht die Seite?) und ob der Knopf sich bewegt
        const lage = await page.evaluate(() => new Promise((ok) => {
          let n = 0; const t0 = performance.now();
          const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); };
          requestAnimationFrame(f);
          setTimeout(() => ok({ bilderProSekunde: n, sichtbar: document.visibilityState }), 1500);
        })).catch((x) => ({ fehler: String(x.message).slice(0, 80) }));
        const b1 = await locator.boundingBox().catch(() => null);
        await page.waitForTimeout(300);
        const b2 = await locator.boundingBox().catch(() => null);
        const log = [...new Set(e.message.split('\n').slice(1).map((z) => z.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter((z) => /intercept|stable|visible|detached|outside/.test(z)))].slice(0, 4).join(' / ');
        const box = await locator.boundingBox().catch(() => null);
        if (box && /stable/.test(log) && !/intercept/.test(log)) {
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          if (touch) await sp.tippen(x, y); else { await page.mouse.click(x, y); }
          sp.rueckfaelle = (sp.rueckfaelle || 0) + 1;
          return;
        }
        // Was liegt an der Knopfmitte oben? (z. B. Karte gerade im Aus- oder Einblenden)
        const oben = box ? await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y);
          return e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` : null; },
        [box.x + box.width / 2, box.y + box.height / 2]).catch(() => null) : null;
        // Einmal nachfassen: kurz verdeckt (Übergang) ist kein Fehler, dauerhaft verdeckt schon
        if (box && !sp._nachfassen) {
          sp._nachfassen = true;
          try {
            await page.waitForTimeout(800);
            if (touch) await locator.tap({ timeout: 5000 }); else await locator.click({ timeout: 5000 });
            sp.nachgefasst = (sp.nachgefasst || 0) + 1;
            return;
          } catch { /* bleibt ein Fehler */ } finally { sp._nachfassen = false; }
        }
        e.message = `${e.message.split('\n')[0]} | ${log} | oben: ${oben} | Seite ${JSON.stringify(lage)} | Knopf ${JSON.stringify(b1)} -> ${JSON.stringify(b2)}`;
        throw e;
      }
    },
    async ende() { if (cdp) { await cdp.detach().catch(() => {}); cdp = null; } },
  };
  return sp;
}

module.exports = { HILFEN, spieler };
