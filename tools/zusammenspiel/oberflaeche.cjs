// Zusammenspiel Oberfläche (P85 Teil 2, docs/zusammenspiel.md): drückt jede sichtbare Taste
// auf jedem Gerät bis drei Ebenen tief und prüft dabei Verdeckung, Schrift, Größe und Rand.
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
// Aufruf: node tools/zusammenspiel/oberflaeche.cjs <ordner> [geraete] [query] [tiefe]
const { browser, open, GERAETE } = require('../verdeckung/helfer.cjs');
const fs = require('fs');
const OUT = process.argv[2] || 'zusammenspiel';
const GER = (process.argv[3] || Object.keys(GERAETE).join(',')).split(',');
const QUERY = process.argv[4] || '?stufe=3&seed=7';
const TIEFE = +(process.argv[5] || 3);
fs.mkdirSync(OUT, { recursive: true });

// Tasten, die den Spielstand zerstören oder die Seite verlassen, werden nicht gedrückt.
const VERBOTEN = /neues spiel|neu beginnen|löschen|zurücksetzen|abweisen|wegschicken|verkaufen|abreißen|roadmap|quelle|pixel|herunterladen|exportieren|importieren|laden/i;

// Läuft in der Seite: alle sichtbaren Bedienelemente mit Befunden.
function sammeln() {
  const sel = 'button, a[href], [role=button], input, select, summary, [tabindex]:not([tabindex="-1"])';
  const touch = matchMedia('(pointer: coarse)').matches;
  const W = innerWidth, H = innerHeight;
  const raus = [];
  const schluessel = (e) => {
    if (e.id) return '#' + e.id;
    let p = e.parentElement; while (p && !p.id) p = p.parentElement;
    const text = (e.getAttribute('aria-label') || e.textContent || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return (p ? '#' + p.id + ' ' : '') + e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + '|' + text;
  };
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (e.closest('[hidden], [inert]')) continue;
    // ein Vorfahr mit opacity 0 oder display none
    if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    let p;
    const text = (e.getAttribute('aria-label') || e.textContent || e.title || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const f = [];
    // Rand: ganz oder teilweise außerhalb des Bildes (Scrollbehälter ausgenommen)
    let scroll = false; p = e.parentElement; while (p && p !== document.body) { const c = getComputedStyle(p); if (/(auto|scroll)/.test(c.overflowY + c.overflowX)) { scroll = true; break; } p = p.parentElement; }
    if (!scroll && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) f.push(`ragt raus (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    // verdeckt: Mittelpunkt und vier innere Punkte
    if (!scroll || (r.top >= 0 && r.bottom <= H)) {
      const pkt = [[0.5, 0.5], [0.2, 0.3], [0.8, 0.3], [0.2, 0.7], [0.8, 0.7]];
      let zu = 0, wer = '';
      for (const [fx, fy] of pkt) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const t = document.elementFromPoint(x, y);
        if (t && t !== e && !e.contains(t) && !t.contains(e)) { zu++; wer = wer || (t.id ? '#' + t.id : t.tagName.toLowerCase() + '.' + (typeof t.className === 'string' ? t.className.split(' ')[0] : '')); }
      }
      if (zu >= 3) f.push(`verdeckt von ${wer}`);
      else if (zu > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== e && !e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))) f.push(`Mitte verdeckt von ${wer}`);
    }
    if (touch && e.tagName !== 'A' && e.tagName !== 'INPUT' && (r.width < 40 || r.height < 40) && !e.closest('#hm-hilfe, .hm-hilfe, details > div, p, li')) f.push(`klein ${Math.round(r.width)}x${Math.round(r.height)}`);
    const font = cs.fontFamily;
    if (!/Pixelify/i.test(font) && text) f.push('Schrift ' + font.split(',')[0]);
    raus.push({ k: schluessel(e), text, r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], f, verboten: false });
  }
  // Texte außerhalb von Tasten: Schrift und Mindestgröße
  const texte = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const gesehen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.textContent.trim(); if (!t) continue;
    const e = n.parentElement; if (!e || gesehen.has(e)) continue; gesehen.add(e);
    if (e.closest('script, style, noscript, svg, canvas, [hidden]')) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden') continue;
    if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const g = parseFloat(cs.fontSize);
    const f = [];
    if (!/Pixelify/i.test(cs.fontFamily)) f.push('Schrift ' + cs.fontFamily.split(',')[0]);
    if (g < 11) f.push('winzig ' + g + 'px');
    if (f.length) texte.push({ text: t.slice(0, 50), wo: e.id || e.className?.toString().split(' ')[0] || e.tagName, f });
  }
  return { el: raus, texte };
}

async function zustand(page) {
  const s = await page.evaluate(sammeln);
  for (const x of s.el) x.verboten = VERBOTEN.test(x.text);
  return s;
}

async function drueck(page, k) {
  return page.evaluate((k) => {
    let e;
    if (k.startsWith('#') && !k.includes(' ') && !k.includes('|')) e = document.querySelector(k);
    else {
      const [vorne, text] = k.split('|');
      const teile = vorne.split(' ');
      const wurzel = teile.length > 1 ? document.querySelector(teile[0]) : document;
      const [tag, cls] = teile[teile.length - 1].split('.');
      const kand = [...(wurzel || document).querySelectorAll(tag + (cls ? '.' + CSS.escape(cls) : ''))];
      e = kand.find((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && (c.getAttribute('aria-label') || c.textContent || c.title || '').trim().replace(/\s+/g, ' ').slice(0, 40) === text; });
    }
    if (!e) return false;
    e.click();
    return true;
  }, k);
}

(async () => {
  const b = await browser();
  const bericht = {};
  await Promise.all(GER.map(async (ger) => {
    const funde = {}; const pfade = {}; const texteFunde = {};
    let o = await open(b, ger, QUERY);
    const start = async () => {
      await o.ctx.close().catch(() => {});
      o = await open(b, ger, QUERY);
      await o.page.evaluate(() => { window.hafenmeister.speed = 0; try { localStorage.setItem('hm-test', '1'); } catch {} });
      await o.page.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
    };
    await start();
    const basis = await zustand(o.page);
    const merke = (pfad, s) => {
      for (const x of s.el) { if (x.f.length) { const key = x.k + ' :: ' + x.f.join('; '); (funde[key] ||= []).push(pfad.join(' > ') || 'Start'); } }
      for (const t of s.texte) { const key = t.wo + ' "' + t.text + '" :: ' + t.f.join('; '); (texteFunde[key] ||= []).push(pfad.join(' > ') || 'Start'); }
    };
    merke([], basis);
    const schlange = basis.el.filter((x) => !x.verboten).map((x) => [x.k]);
    const besucht = new Set(schlange.map((p) => p.join(' > ')));
    const vorher = new Set(basis.el.map((x) => x.k));
    let n = 0;
    const basisSchl = () => basis.el.map((x) => x.k).sort().join('\n');
    // Zurück zum Grundzustand: Esc, Schließen-Knöpfe; nur wenn das nicht reicht, neu laden.
    const zurueck = async () => {
      for (let i = 0; i < 3; i++) {
        await o.page.keyboard.press('Escape').catch(() => {});
        await o.page.evaluate(() => {
          for (const z of document.querySelectorAll('.hm-zu, .card-close, .bau-zu, [aria-label$="schließen"], [aria-label="Schließen"]')) {
            const r = z.getBoundingClientRect(); if (r.width > 0 && !z.closest('[hidden]')) z.click();
          }
          window.hafenmeister.speed = 0;
        }).catch(() => {});
        await o.page.waitForTimeout(200);
      }
      const s = await zustand(o.page).catch(() => null);
      if (!s || s.el.map((x) => x.k).sort().join('\n') !== basisSchl()) { neuGeladen++; await start(); }
    };
    let neuGeladen = 0;
    while (schlange.length) {
      const pfad = schlange.shift();
      await zurueck();
      let ok = true;
      const vorStufe = new Set(basis.el.map((x) => x.k));
      for (let i = 0; i < pfad.length; i++) {
        if (i === pfad.length - 1) { const s = await zustand(o.page); s.el.forEach((x) => vorStufe.add(x.k)); }
        const geklickt = await drueck(o.page, pfad[i]);
        if (!geklickt) { ok = false; break; }
        await o.page.waitForTimeout(900);
      }
      if (!ok) { pfade[pfad.join(' > ')] = 'nicht gefunden'; continue; }
      const s = await zustand(o.page);
      merke(pfad, s);
      const neu = s.el.filter((x) => !vorStufe.has(x.k));
      pfade[pfad.join(' > ')] = { neu: neu.map((x) => x.k), fehler: o.log.slice(-3) };
      const name = String(++n).padStart(3, '0');
      await o.page.screenshot({ path: `${OUT}/${ger}-${name}.png` });
      pfade[pfad.join(' > ')].bild = `${ger}-${name}.png`;
      // Gleichartige Tasten (Listenzeilen, Bauplätze) nur zweimal je Art weiter verfolgen
      const art = {};
      if (pfad.length < TIEFE) for (const x of neu) {
        if (x.verboten) continue;
        const a = x.k.split('|')[0]; art[a] = (art[a] || 0) + 1; if (art[a] > 2) continue;
        const p2 = [...pfad, x.k]; const id = p2.join(' > ');
        if (!besucht.has(id)) { besucht.add(id); schlange.push(p2); }
      }
      bericht[ger] = { funde, texte: texteFunde, pfade, neuGeladen };
      fs.writeFileSync(`${OUT}/bericht.json`, JSON.stringify(bericht, null, 1));
      process.stderr.write(`${ger} ${n} ${pfad.join(' > ')} (+${neu.length}, offen ${schlange.length})\n`);
      if (n > 260) break;
    }
    bericht[ger] = { funde, texte: texteFunde, pfade, neuGeladen };
    await o.ctx.close().catch(() => {});
  }));
  fs.writeFileSync(`${OUT}/bericht.json`, JSON.stringify(bericht, null, 1));
  await b.close();
})();
