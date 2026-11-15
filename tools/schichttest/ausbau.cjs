// Schichttest: Schichten ab 8. Jede baut auf den Kernschichten 1 bis 7 auf (schichten.cjs).
// Aufbau wie dort: neu(t, z) prüft die neue Funktion, wieder(t, z) wiederholt sie kurz nach jeder späteren Schicht.

const K = require('./schichten.cjs');
const { setzeTempo, insBild, fensterZu, bootKommt, anlegen, kassieren, BOOTSLAGE } = K;

// ------------------------------------------------------------------ Schicht 8: Einfahren ohne Ziehen
// a) Boot antippen, Knopf "Einfahren" am Boot; b) Boot gar nicht anfassen: nach 8 s fährt es selbst ein.
async function einfahrenKnopf(t, z) {
  const boot = await bootKommt(t, z);
  if (!boot) return;
  const lage = await insBild(t, (id) => [window.__st.bootSchirm(id)], boot.id);
  if (!lage.ok) { await t.punkt('wartendes Boot frei im Bild', false, JSON.stringify(lage.p)); return; }
  const b = lage.p[0];
  await t.sp.tippen(b.x, b.y);
  // Genau ein Einfahren-Knopf: klein am Boot (PC, Tablet) oder groß in der Bootskarte (Handy), siehe ui/input-touch.js
  const knopf = t.page.locator('.hm-einfahren:visible, #card button:visible:text-matches("einfahren", "i")').first();
  const da = await knopf.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  const wo = da ? await knopf.evaluate((el) => (el.classList.contains('hm-einfahren') ? 'am Boot' : 'in der Bootskarte')) : '';
  await t.punkt('Antippen zeigt einen Knopf zum Einfahren', da, wo, { schwere: 'B' });
  if (!da) return;
  const frei = await knopf.evaluate((el) => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { ok: e === el || el.contains(e), x, y, drueber: e?.id || e?.className }; });
  await t.punkt('Knopf zum Einfahren frei antippbar', frei.ok, frei.ok ? '' : `verdeckt von ${frei.drueber}`);
  z.einfahrenWo ||= new Set(); z.einfahrenWo.add(wo);
  await t.sp.knopf(knopf);
  const nach = await t.bis((id) => window.hafenmeister.sim.state.boats[id]?.status === 'moored', boot.id, 5000);
  const platz = await t.G((id) => window.hafenmeister.sim.state.boats[id]?.berthId, boot.id);
  await t.punkt('Knopf "Einfahren" weist eine Box zu', nach && !!platz, `Boot ${boot.id} -> ${platz}`, { schwere: 'A' });
  if (!nach) return;
  if (await anlegen(t, boot, platz)) await kassieren(t, z, boot);
  await setzeTempo(t, 'normal');
}

async function selbstEinfahren(t, z) {
  const boot = await bootKommt(t, z);
  if (!boot) return;
  // Nicht anfassen. Wie lange dauert es in Spielzeit, bis das Boot selbst in eine Box fährt?
  const t0 = await t.G(() => window.hafenmeister.time);
  await setzeTempo(t, 'normal');
  const selbst = await t.bis((id) => window.__st.ereignisse.some((e) => e.n === 'sim:selfEntered' && String(e.d?.boatId ?? e.d?.id).replace(/^b/, '') === String(id)), boot.id, 60_000);
  const info = await t.G((id) => { const G = window.hafenmeister; const b = G.sim.state.boats[id]; return { t: G.time, status: b?.status, platz: b?.berthId, regel: G.sim.ctx.rules.warten?.selbstEinfahrenNach ?? null }; }, boot.id);
  const dauer = info.t - t0;
  await t.punkt('unberührtes Boot fährt nach einigen Sekunden selbst ein', selbst && info.status === 'moored',
    selbst ? `nach ${dauer.toFixed(0)} s Spielzeit an Box ${info.platz}${info.regel ? ` (Regel ${info.regel} s)` : ''}` : `nach ${dauer.toFixed(0)} s noch ${info.status}`, { schwere: 'A' });
  if (selbst && info.regel) await t.punkt('Selbst-Einfahren nicht viel später als die Regel sagt', dauer <= info.regel + 6, `${dauer.toFixed(1)} s, Regel ${info.regel} s`, { bild: false, schwere: 'C' });
  if (!selbst) return;
  if (await anlegen(t, boot, info.platz)) await kassieren(t, z, boot);
  await setzeTempo(t, 'normal');
}

const S8 = {
  nr: 8, name: 'Einfahren ohne Ziehen (Knopf, selbst)', paket: 'P02, Jorven 12.11.',
  async neu(t, z) { await einfahrenKnopf(t, z); await selbstEinfahren(t, z); },
  async wieder(t, z) { await einfahrenKnopf(t, z); },
};

// ------------------------------------------------------------------ Schicht 9: Tempo
async function tempoMessen(t) {
  await fensterZu(t);
  const rate = async (art) => {
    await setzeTempo(t, art);
    await t.warte(600);
    const a = await t.G(() => { if (!window.__stZaehlt) { window.__stZaehlt = true; const f = () => { window.__stBilder = (window.__stBilder || 0) + 1; requestAnimationFrame(f); }; requestAnimationFrame(f); } return { s: window.hafenmeister.time, w: performance.now(), f: window.__stBilder || 0 }; });
    await t.warte(3000);
    const b = await t.G(() => ({ s: window.hafenmeister.time, w: performance.now(), speed: window.hafenmeister.speed, paused: window.hafenmeister.paused, f: window.__stBilder || 0 }));
    return { r: (b.s - a.s) / ((b.w - a.w) / 1000), speed: b.speed, paused: b.paused, fps: (b.f - a.f) / ((b.w - a.w) / 1000) };
  };
  const r1 = await rate('normal'); const r3 = await rate('drei'); const r8 = await rate('acht');
  const v3 = r3.r / r1.r, v8 = r8.r / r1.r;
  // Unter 10 Bildern je Sekunde begrenzt das Spiel den Zeitschritt je Bild auf 0,1 s (core/game.js): dann
  // misst man die Software-Grafik dieses Rechners, nicht das Spiel. Das steht dann nur als Hinweis da.
  const mess = async (name, v, soll, r) => {
    const txt = `${v.toFixed(2)}-fach bei ${r.fps.toFixed(0)} Bildern je Sekunde (1x: ${r1.r.toFixed(2)} Spielsekunden je Sekunde, ${r1.fps.toFixed(0)} Bilder)`;
    if (r.fps < 11 || r1.fps < 11) await t.hinweis(name + ' (zu wenig Bilder zum Messen)', txt, { bild: false });
    else await t.punkt(name, v > soll * 0.8 && v < soll * 1.2, txt, { bild: false });
  };
  await mess('3x läuft dreimal so schnell wie 1x', v3, 3, r3);
  await mess('8x läuft achtmal so schnell wie 1x', v8, 8, r8);
  // Tempo läuft durch: 20 s bei 8x, nichts bremst oder hält von selbst an (Jorven 14.11.)
  await setzeTempo(t, 'acht');
  const verlauf = [];
  for (let i = 0; i < 10; i++) { await t.warte(2000); verlauf.push(await t.G(() => (window.hafenmeister.paused ? 'P' : String(window.hafenmeister.speed)))); }
  const zu = await fensterZu(t);
  await t.punkt('8x läuft durch, ohne von selbst zu bremsen', verlauf.every((v) => v === '8'), `Verlauf ${verlauf.join(' ')}${zu.length ? `, Fenster: ${zu.join(', ')}` : ''}`);
  if (!t.touch) {
    // PC: Leertaste hält an und lässt weiterlaufen, Taste F schaltet 3x
    await t.page.locator('#stage').focus().catch(() => {});
    await t.page.keyboard.press('Space');
    const p = await t.G(() => window.hafenmeister.paused);
    await t.page.keyboard.press('Space');
    const w = await t.G(() => !window.hafenmeister.paused);
    await t.punkt('Leertaste hält an und lässt weiterlaufen', p && w, `angehalten ${p}, weiter ${w}`, { bild: false });
    await setzeTempo(t, 'normal');
    await t.page.keyboard.press('KeyF');
    const f = await t.G(() => window.hafenmeister.speed);
    await t.page.keyboard.press('KeyF');
    const f2 = await t.G(() => window.hafenmeister.speed);
    await t.punkt('Taste F schaltet 3x an und aus', f === 3 && f2 === 1, `${f}, dann ${f2}`, { bild: false });
  }
  await setzeTempo(t, 'normal');
}
const S9 = { nr: 9, name: 'Tempo 1x, 3x, 8x', paket: 'P05, PR 278', neu: tempoMessen, wieder: tempoMessen };

// ------------------------------------------------------------------ Schicht 10: Bauen
async function bauen(t, z, { kaufen = true } = {}) {
  await fensterZu(t);
  await setzeTempo(t, 'normal');
  const vorher = await t.G(() => ({ geld: window.hafenmeister.sim.state.money, fac: JSON.stringify(window.hafenmeister.sim.state.facilities), zeit: window.hafenmeister.time }));
  await t.sp.knopf(t.page.locator('#btn-build'));
  const karte = t.page.locator('#card.bau-karte');
  const offen = await karte.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
  await t.punkt('Bauen öffnet die Bauliste', offen, '', { schwere: 'A' });
  if (!offen) return;
  await t.warte(800);
  const steht = await t.G(([z0]) => Math.abs(window.hafenmeister.time - z0) < 1.5 || window.hafenmeister.paused, [await t.G(() => window.hafenmeister.time)]);
  await t.punkt('Zeit steht im Baumodus still', steht, '', { bild: false, schwere: 'C' });
  const ja = t.page.locator('#card .bau-ja');
  let gekauft = null;
  if (kaufen) {
    // Erstes Mal: das Geschenk steht offen. Sonst die billigste Zeile, die man sich leisten kann.
    if (!(await ja.isVisible().catch(() => false))) {
      const zeilen = await t.page.locator('#card .bau-zeile[data-bau]').evaluateAll((els) => els.map((e) => ({ key: e.dataset.bau, gesperrt: e.classList.contains('gesperrt'),
        preis: Number(String(e.querySelector('.bau-zeile-preis')?.textContent || '').replace(/[^0-9]/g, '')) })));
      const geld = await t.G(() => window.hafenmeister.sim.state.money);
      const wahl = zeilen.filter((x) => !x.gesperrt && x.preis <= geld && x.key !== 'hafen:stufe').sort((a, b) => a.preis - b.preis)[0];
      if (!wahl) await t.hinweis('nichts zu bauen', `Kasse ${Math.round(geld)} €, Zeilen: ${zeilen.map((x) => `${x.key} ${x.preis}${x.gesperrt ? ' gesperrt' : ''}`).join(', ').slice(0, 300)}`);
      else await t.sp.knopf(t.page.locator(`#card .bau-zeile[data-bau="${wahl.key}"]`));
    }
    if (await ja.isVisible().catch(() => false) && await ja.isEnabled().catch(() => false)) {
      const text = await ja.textContent();
      const preis = Number(text.replace(/[^0-9]/g, ''));
      const geld = await t.G(() => window.hafenmeister.sim.state.money);
      await t.bild('s10-vorschau');
      await t.sp.knopf(ja);
      const fertig = await t.page.locator('#card h2').filter({ hasText: /gebaut/ }).waitFor({ timeout: 8000 }).then(() => true, () => false);
      const nach = await t.G(() => ({ geld: window.hafenmeister.sim.state.money, fac: JSON.stringify(window.hafenmeister.sim.state.facilities) }));
      gekauft = await t.page.locator('#card h2').textContent().catch(() => '');
      await t.punkt('Bauen über Vorschau und Bestätigen', fertig && Math.abs(geld - nach.geld - preis) < 1, `"${text}", Kasse ${Math.round(geld)} -> ${Math.round(nach.geld)} €, ${gekauft}`, { schwere: 'A' });
    }
  }
  // Schließen: "Fertig" nach dem Kauf, sonst "Schließen"
  const fertigKnopf = t.page.locator('#card .hud-btn', { hasText: 'Fertig' });
  if (await fertigKnopf.isVisible().catch(() => false)) await t.sp.knopf(fertigKnopf);
  else {
    const zu = t.page.locator('#card .bau-zu');
    if (await zu.isVisible().catch(() => false)) await t.sp.knopf(zu); else await t.sp.knopf(t.page.locator('#card .hud-btn', { hasText: 'Schließen' }).first());
  }
  const weg = await karte.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false);
  await t.punkt('Baumenü schließt', weg, '', { schwere: 'B' });
  const laeuft = await t.bis(() => !window.hafenmeister.paused, null, 3000);
  await t.punkt('Spiel läuft nach dem Bauen weiter', laeuft, '', { schwere: 'B' });
  if (gekauft) await t.hinweis('gebaut', gekauft);
  void vorher;
}
const S10 = {
  nr: 10, name: 'Bauen', paket: 'P18, J4',
  neu: (t, z) => bauen(t, z),
  // Wiederholung: Liste öffnen und schließen, ohne zu kaufen (das Geld soll für die Stufen reichen)
  wieder: (t, z) => bauen(t, z, { kaufen: false }),
};

// ------------------------------------------------------------------ Schicht 11: Tagesziele
async function tagesziel(t, z) {
  await fensterZu(t);
  const knopf = t.page.locator('.tz-neu, .hm-tafel-knopf').first();
  const da = await knopf.isVisible().catch(() => false);
  if (!da) { await t.hinweis('Tagesziel', 'kein Knopf "Tagesziel" sichtbar (Winter oder schon gewählt?)'); return; }
  const text0 = (await knopf.textContent()).replace(/\s+/g, ' ').trim();
  await t.sp.knopf(knopf);
  const karten = t.page.locator('.tz-karte');
  const offen = await karten.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
  if (!offen) {
    // Schon gewählt: die Tafel zeigt den Stand
    await t.hinweis('Tagesziel', `Tafel offen ohne Karten, Knopf "${text0}"`);
    await t.sp.knopf(knopf);
    return;
  }
  const n = await karten.count();
  await t.punkt('Tagesziel-Tafel zeigt drei Karten', n === 3, `${n} Karten`, { bild: true, schwere: 'C' });
  const wahl = (await karten.first().textContent()).replace(/\s+/g, ' ').trim();
  await t.sp.knopf(karten.first());
  const gewaehlt = await t.bis(() => !!window.hafenmeister.sim.state.modules?.ziele?.gewaehlt || window.__st.ereignisse.some((e) => e.n === 'ziel:gewaehlt'), null, 5000);
  await t.warte(500);
  const text1 = (await t.page.locator('.hm-tafel-knopf').first().textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
  await t.punkt('Tagesziel wählen', gewaehlt, `"${wahl.slice(0, 80)}", Knopf jetzt "${text1}"`, { schwere: 'B' });
  // Tafel zu (falls noch offen), sonst verdeckt sie den Hafen
  if (await karten.first().isVisible().catch(() => false)) await t.sp.knopf(t.page.locator('.hm-tafel-knopf').first());
  z.ziel = wahl;
}
const S11 = {
  nr: 11, name: 'Tagesziele', paket: 'P13',
  neu: tagesziel,
  // Wiederholung: Stand des Ziels lesen (zählt es eigene Handlungen?)
  async wieder(t) {
    const s = await t.G(() => { const m = window.hafenmeister.sim.state.modules?.ziele; const g = m?.karten?.find?.((k) => k.art === m.gewaehlt) ?? null; return { tag: m?.tag, gewaehlt: m?.gewaehlt ?? null, ist: g?.ist ?? null, soll: g?.soll ?? null, erledigt: g?.erledigt ?? null }; });
    await t.hinweis('Tagesziel-Stand', JSON.stringify(s), { bild: false });
  },
};

// ------------------------------------------------------------------ Schicht 12: Tagesabschluss
async function tagesabschluss(t, z) {
  await fensterZu(t);
  const d0 = await t.G(() => window.hafenmeister.sim.state.day);
  await setzeTempo(t, 'acht');
  const neu = await t.bis((tag) => window.hafenmeister.sim.state.day > tag, d0, 240_000);
  if (!neu) { await t.punkt('Tag endet', false, 'kein neuer Tag in 4 min', { schwere: 'A' }); return; }
  await setzeTempo(t, 'pause');
  // Karte (PC, Tablet) oder Zettel (Handy)
  const karte = t.page.locator('#hm-tagesabschluss:not([hidden])');
  const zettel = t.page.locator('.hm-ta-zettel, [class*="ta-zettel"]').first();
  const k = await karte.isVisible().catch(() => false);
  const zt = !k && await zettel.isVisible().catch(() => false);
  const bericht = await t.G(() => { const v = window.hafenmeister.sim.verlauf?.() ?? []; return v[v.length - 1] ?? null; });
  await t.punkt('Tagesabschluss erscheint nach dem Tag', k || zt, k ? 'Karte' : zt ? 'Zettel' : 'nichts', { bild: true, schwere: 'B' });
  if (k) {
    const text = (await karte.textContent()).replace(/\s+/g, ' ');
    const summe = bericht?.summe ?? bericht?.einnahmen ?? null;
    const euro = summe != null ? Math.round(summe).toLocaleString('de-DE') : null;
    await t.punkt('Tagessumme in der Karte stimmt mit den Spielregeln', euro == null || text.includes(euro), `Regeln ${summe} €, Karte "${text.slice(0, 120)}"`, { bild: false });
    // Verdeckt die Karte Zeit oder Bauen?
    const frei = await t.G(() => ['btn-build', 'btn-pause'].map((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { id, ok: e === top || e.contains(top) }; }));
    // Liegt die Karte über den Wartebojen? (Übersicht, wie nach dem Start)
    await t.sp.knopf(t.page.locator('#btn-overview')); await t.kameraRuhig();
    const bojen = await t.G(() => { const G = window.hafenmeister; const l = [];
      for (const b of G.sim.waitingBoats()) { const s = window.__st.bootSchirm(b.id); if (s && !s.frei && String(s.drueber).includes('tagesabschluss')) l.push(b.id); }
      for (const o of G.boatView?.bojen?.() ?? []) { const s = window.__st.schirm(o.x, 0.3, o.z); if (s && !window.__st.frei(s.x, s.y) && String(window.__st.wasLiegtDa(s.x, s.y)).includes('tagesabschluss')) l.push(o.id ?? 'boje'); }
      return l; });
    await t.punkt('Tagesabschluss verdeckt keine Wartebojen oder wartenden Boote', bojen.length === 0, bojen.join(', '), { schwere: 'C' });
    await t.punkt('Tagesabschluss verdeckt weder Zeit noch Bauen', frei.every((f) => f.ok), frei.filter((f) => !f.ok).map((f) => f.id).join(', '));
    await t.sp.knopf(t.page.locator('#hm-tagesabschluss .hm-ta-weiter'));
    const zu = await karte.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true, () => false);
    await t.punkt('Tagesabschluss schließt mit "Weiter"', zu);
  }
  await setzeTempo(t, 'normal');
}
const S12 = { nr: 12, name: 'Tagesabschluss', paket: 'P15', neu: tagesabschluss, wieder: tagesabschluss };

// ------------------------------------------------------------------ Schicht 13: Menü, jeder Eintrag tut etwas
// Jorvens Regel "Fertig heißt spielbar": kein Knopf ohne Wirkung. Jeder Menüeintrag muss etwas öffnen
// oder sichtbar umschalten, und was er öffnet, muss sich wieder schließen lassen.
const SICHTBAR = () => {
  // Alles, was sichtbar ist und mindestens 2,5 % des Bildes bedeckt (Fenster, Tafeln, Karten), außer der Spielfläche
  const flaeche = innerWidth * innerHeight; const out = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.id === 'stage' || e.tagName === 'CANVAS' || e.id === 'game' || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width * r.height < 0.025 * flaeche || r.width * r.height > 0.98 * flaeche) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    out.push(e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0] || e.tagName);
  }
  return [...new Set(out)];
};
async function menue(t) {
  await fensterZu(t);
  const auf = async () => {
    if (!(await t.page.locator('#hm-menue').isVisible().catch(() => false))) await t.sp.knopf(t.page.locator('#btn-menu'));
    return t.page.locator('#hm-menue').waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  };
  const offen = await auf();
  await t.punkt('Menü öffnet', offen, '', { schwere: 'B' });
  if (!offen) return;
  const eintraege = await t.page.locator('#hm-menue button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0)
    .map((e, i) => ({ i, id: e.id, text: (e.textContent || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim() })));
  // Menü ganz im Bild oder rollbar?
  const lage = await t.G(() => { const m = document.getElementById('hm-menue'); const r = m.getBoundingClientRect(); return { unten: Math.round(r.bottom), hoch: innerHeight, rollt: m.scrollHeight > m.clientHeight + 4 }; });
  await t.punkt('Menü passt ins Bild', lage.unten <= lage.hoch + 1, `unten ${lage.unten} von ${lage.hoch}${lage.rollt ? ', rollt' : ''}`, { bild: true, schwere: 'C' });
  await t.sp.knopf(t.page.locator('#btn-menu'));
  await t.warte(300);
  const ohne = new Set(['btn-save']);   // Spielstand: eigenes Fenster mit Neuladen, prüft Schicht 7 anders
  for (const e of eintraege) {
    if (ohne.has(e.id)) continue;
    await auf();
    const vorher = new Set((await t.G(SICHTBAR)).filter((x) => x !== '#hm-menue'));
    const ton = await t.G(() => JSON.stringify({ stumm: window.hafenmeister.audio?.stumm ?? window.hafenmeister.audio?.muted ?? null }));
    const knopf = e.id ? t.page.locator(`#hm-menue #${e.id}`) : t.page.locator('#hm-menue button').nth(e.i);
    await knopf.scrollIntoViewIfNeeded().catch(() => {});
    await t.sp.knopf(knopf);
    await t.warte(700);
    const nach = (await t.G(SICHTBAR)).filter((x) => x !== '#hm-menue' && !vorher.has(x));
    const ton2 = await t.G(() => JSON.stringify({ stumm: window.hafenmeister.audio?.stumm ?? window.hafenmeister.audio?.muted ?? null }));
    const foto = await t.G(() => document.body.classList.contains('fotomodus') || document.body.className.includes('foto'));
    const wirkt = nach.length > 0 || ton !== ton2 || foto;
    await t.punkt(`Menü "${e.text}" tut etwas`, wirkt, nach.length ? `öffnet ${nach.join(', ')}` : foto ? 'Fotomodus' : ton !== ton2 ? 'schaltet Ton' : 'nichts sichtbar', { bild: true, schwere: 'B' });
    // Wieder schließen: Schließen-Knopf im neuen Fenster, sonst Escape, sonst Fotomodus über seinen Knopf
    for (let i = 0; i < 3; i++) {
      const offenNoch = (await t.G(SICHTBAR)).filter((x) => x !== '#hm-menue' && !vorher.has(x));
      const fotoNoch = await t.G(() => document.body.className.includes('foto'));
      if (!offenNoch.length && !fotoNoch) break;
      const zu = t.page.locator('.hm-zu:visible, button[aria-label*="chließen"]:visible, button:visible:text-is("Schließen"), button:visible:text-is("Fertig"), button:visible:text-is("Weiter")').first();
      if (await zu.count()) await t.sp.knopf(zu).catch(() => {});
      else await t.page.keyboard.press('Escape');
      await t.warte(400);
    }
    const rest = (await t.G(SICHTBAR)).filter((x) => x !== '#hm-menue' && !vorher.has(x));
    if (wirkt) await t.punkt(`"${e.text}" lässt sich wieder schließen`, rest.length === 0, rest.join(', '), { schwere: 'B' });
    if (ton !== ton2) { await auf(); await t.sp.knopf(knopf); await t.warte(300); }   // Ton zurückschalten
    if (await t.page.locator('#hm-menue').isVisible().catch(() => false)) await t.sp.knopf(t.page.locator('#btn-menu'));
  }
  await setzeTempo(t, 'normal');
}
const S13 = { nr: 13, name: 'Menü: jeder Eintrag tut etwas', paket: 'Abnahme, P50', neu: menue, wieder: menue };

// ------------------------------------------------------------------ Schicht 14: Wartebojen und Ankerfeld
// Eine Weile bei 8x nichts zuweisen: es sammeln sich Boote vor dem Hafen. Alle paar Sekunden prüfen,
// dass nichts übereinander, über Land oder im Steg liegt und jedes wartende Boot seinen eigenen Platz hat.
async function warteplaetze(t) {
  await fensterZu(t);
  await setzeTempo(t, 'acht');
  const treffer = { ueber: new Map(), land: new Map(), doppelt: new Map() };
  let maxWartend = 0, proben = 0;
  for (let i = 0; i < 12; i++) {
    await t.warte(4000);
    const l = await t.G(BOOTSLAGE);
    const w = await t.G(() => { const S = window.hafenmeister.sim; const ws = S.waitingBoats(); const orte = new Map();
      for (const b of ws) { const k = b.waitSpot ?? null; if (k == null) continue; orte.set(k, [...(orte.get(k) || []), b.id]); }
      return { n: ws.length, doppelt: [...orte.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.join('+')}`) }; });
    proben++; maxWartend = Math.max(maxWartend, w.n);
    for (const x of l.ueber) treffer.ueber.set(x, (treffer.ueber.get(x) || 0) + 1);
    for (const x of [...l.land, ...l.steg]) treffer.land.set(x, (treffer.land.get(x) || 0) + 1);
    for (const x of w.doppelt) treffer.doppelt.set(x, (treffer.doppelt.get(x) || 0) + 1);
    if ((l.ueber.length || l.land.length || l.steg.length) && !treffer.bild) { await setzeTempo(t, 'pause'); treffer.bild = await t.bild('s14-ueberlappung'); await setzeTempo(t, 'acht'); }
    await fensterZu(t);
  }
  await setzeTempo(t, 'normal');
  const fmt = (m) => [...m.entries()].map(([k, v]) => `${k} (${v}x)`).join('; ').slice(0, 400);
  await t.hinweis('Warteschlange', `${proben} Proben, bis zu ${maxWartend} Boote warten zugleich`, { bild: true });
  await t.punkt('wartende und fahrende Boote nie übereinander', treffer.ueber.size === 0, fmt(treffer.ueber), { bild: false, schwere: 'B' });
  await t.punkt('keine Boote über Land oder im Steg', treffer.land.size === 0, fmt(treffer.land), { bild: false, schwere: 'B' });
  await t.punkt('jedes wartende Boot hat einen eigenen Warteplatz', treffer.doppelt.size === 0, fmt(treffer.doppelt), { bild: false, schwere: 'B' });
}
const S14 = { nr: 14, name: 'Wartebojen und Ankerfeld', paket: 'P66', neu: warteplaetze, wieder: warteplaetze };

// ------------------------------------------------------------------ Schicht 15: Bewertung und Gästebuch
async function gaestebuch(t) {
  await fensterZu(t);
  const n = await t.G(() => window.hafenmeister.gaestebuch?.eintraege?.()?.length ?? null);
  const rep = t.page.locator('#rep');
  await t.sp.knopf(rep);
  const tafel = t.page.locator('#hm-gaestebuch');
  const offen = await tafel.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
  await t.punkt('Ruf oben antippen öffnet das Gästebuch', offen, `${n ?? '?'} Einträge`, { bild: true, schwere: 'B' });
  if (!offen) return;
  const text = (await tafel.textContent()).replace(/\s+/g, ' ');
  const ruf = await t.G(() => window.hafenmeister.sim.reputation?.());
  await t.punkt('Gästebuch zeigt Bewertungen, wenn Gäste abgereist sind', n === 0 || /[1-5],\d/.test(text), text.slice(0, 160), { bild: false, schwere: 'C' });
  const zu = t.page.locator('#hm-gaestebuch .hm-zu, #hm-gaestebuch button[aria-label*="chließen"]').first();
  if (await zu.count()) await t.sp.knopf(zu); else await t.page.keyboard.press('Escape');
  const weg = await tafel.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true, () => false);
  await t.punkt('Gästebuch schließt', weg, `Ruf ${ruf}`);
}
const S15 = { nr: 15, name: 'Bewertung und Gästebuch', paket: 'P14', neu: gaestebuch, wieder: gaestebuch };

// ------------------------------------------------------------------ Schicht 16: Aufstieg
// Über Bauen, Reiter "Hafen", Zeile "hafen:stufe". Ist das Ziel noch nicht erreicht, wird bei 8x
// weitergespielt (Boote fahren selbst ein, der Test streicht nichts) und erneut versucht.
async function bauzeile(t, key) {
  await t.sp.knopf(t.page.locator('#btn-build'));
  await t.page.locator('#card.bau-karte').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  let zeile = t.page.locator(`#card .bau-zeile[data-bau="${key}"]`);
  if (!(await zeile.isVisible().catch(() => false))) {
    const reiter = t.page.locator('#card .bau-tab', { hasText: 'Hafen' });
    if (await reiter.isVisible().catch(() => false)) await t.sp.knopf(reiter);
  }
  zeile = t.page.locator(`#card .bau-zeile[data-bau="${key}"]`);
  if (!(await zeile.isVisible().catch(() => false))) return { da: false };
  const info = await zeile.evaluate((e) => ({ gesperrt: e.classList.contains('gesperrt'), text: e.textContent.replace(/\s+/g, ' ').trim() }));
  return { da: true, zeile, ...info };
}
async function bauenSchliessen(t) {
  for (const sel of ['#card .hud-btn:text-is("Fertig")', '#card .bau-zu', '#card .hud-btn:text-is("Schließen")']) {
    const k = t.page.locator(sel).first();
    if (await k.isVisible().catch(() => false)) { await t.sp.knopf(k); break; }
  }
  await t.page.locator('#card.bau-karte').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  await fensterZu(t);
}
async function aufstieg(t, z) {
  await fensterZu(t);
  const s0 = await t.G(() => window.hafenmeister.sim.state.stage);
  let versuch = 0, z0 = null;
  while (versuch < 8) {
    const r = await bauzeile(t, 'hafen:stufe');
    z0 = r;
    if (r.da && !r.gesperrt) {
      await t.sp.knopf(r.zeile);
      const ja = t.page.locator('#card .bau-ja');
      if (await ja.isEnabled().catch(() => false)) {
        const text = await ja.textContent();
        await t.bild('s16-ausbau-vorschau');
        await t.sp.knopf(ja);
        const hoch = await t.bis((s) => window.hafenmeister.sim.state.stage > s, s0, 20_000);
        await bauenSchliessen(t);
        const s1 = await t.G(() => window.hafenmeister.sim.state.stage);
        await t.punkt('Ausbau auf die nächste Stufe über Bauen', hoch, `Stufe ${s0} -> ${s1}, "${text}"`, { bild: true, schwere: 'A' });
        if (hoch) {
          await t.warte(1500);
          await fensterZu(t);
          const l = await t.G(BOOTSLAGE);
          await t.punkt('nach dem Umbau liegen keine Boote übereinander oder im Steg', l.ueber.length + l.steg.length + l.land.length === 0, [...l.ueber, ...l.steg, ...l.land].join('; '), { schwere: 'B' });
          const liegen = await t.G(() => { const G = window.hafenmeister; return G.sim.mooredBoats().filter((b) => !G.stege?.platz?.(b.berthId)).map((b) => `${b.id}@${b.berthId}`); });
          await t.punkt('jedes liegende Boot hat nach dem Umbau eine sichtbare Box', liegen.length === 0, liegen.join(', '), { schwere: 'B' });
          z.stufeHoch = true;
        }
        return;
      }
    }
    await bauenSchliessen(t);
    // Noch nicht so weit: einen Spieltag bei 8x weiterspielen
    versuch++;
    const d = await t.G(() => window.hafenmeister.sim.state.day);
    await setzeTempo(t, 'acht');
    await t.bis((tag) => window.hafenmeister.sim.state.day > tag, d, 240_000);
    await fensterZu(t);
  }
  await setzeTempo(t, 'normal');
  await t.hinweis('Aufstieg nicht erreicht', `nach ${versuch} weiteren Tagen: ${z0?.da ? z0.text : 'keine Zeile "hafen:stufe"'}`);
}
const S16 = {
  nr: 16, name: 'Aufstieg', paket: 'P16, P18', neu: aufstieg,
  // Wiederholung: Bauliste zeigt den nächsten Ausbau mit Grund, warum er noch gesperrt ist
  async wieder(t) {
    const r = await bauzeile(t, 'hafen:stufe');
    await t.punkt('Bauliste zeigt den nächsten Ausbau', r.da, r.da ? r.text.slice(0, 120) : 'keine Zeile', { bild: !r.da, schwere: 'C' });
    await bauenSchliessen(t);
  },
};

// ------------------------------------------------------------------ Schicht 17: Hafenbüro (Funk, Alle kassieren)
async function hafenbuero(t, z) {
  await fensterZu(t);
  const o0 = await t.G(() => window.hafenmeister.sim.state.office);
  if (o0 < 1) {
    const r = await bauzeile(t, 'hafen:buero');
    if (!r.da || r.gesperrt) { await bauenSchliessen(t); await t.hinweis('Hafenbüro', r.da ? r.text : 'keine Zeile "hafen:buero"'); return; }
    await t.sp.knopf(r.zeile);
    const ja = t.page.locator('#card .bau-ja');
    const text = await ja.textContent().catch(() => '');
    if (!(await ja.isEnabled().catch(() => false))) { await bauenSchliessen(t); await t.hinweis('Hafenbüro', `noch nicht bezahlbar: ${text}`); return; }
    await t.sp.knopf(ja);
    const ok = await t.bis(() => window.hafenmeister.sim.state.office >= 1, null, 8000);
    await bauenSchliessen(t);
    await t.punkt('Hafenbüro (Hafenmeister mit Funk) bauen', ok, text, { bild: true, schwere: 'A' });
    if (!ok) return;
  }
  // Abends gibt es jetzt "Alle kassieren"
  const d = await t.G(() => ({ tag: window.hafenmeister.sim.state.day }));
  await setzeTempo(t, 'acht');
  const abend = await t.bis(() => window.hafenmeister.sim.state.phase !== 'day' && window.hafenmeister.sim.mooredBoats().some((b) => b.pendingFee > 0), null, 240_000);
  await setzeTempo(t, 'pause');
  const knopf = t.page.locator('#btn-collect');
  const da = abend && await knopf.isVisible().catch(() => false);
  await t.punkt('abends erscheint "Kassieren" für alle Münzen', da, abend ? '' : 'kein Abend mit offenen Münzen', { bild: true, schwere: 'B' });
  if (da) {
    const g0 = await t.G(() => window.hafenmeister.sim.state.money);
    await t.sp.knopf(knopf);
    const ok = await t.bis((g) => window.hafenmeister.sim.state.money > g, g0, 5000);
    const offen = await t.G(() => window.hafenmeister.sim.mooredBoats().filter((b) => b.pendingFee > 0).length);
    await t.punkt('"Kassieren" sammelt alle Münzen ein', ok && offen === 0, `${offen} Boote noch offen`, { schwere: 'B' });
  }
  await setzeTempo(t, 'normal');
  void d;
}
const S17 = { nr: 17, name: 'Hafenbüro', paket: 'P02', neu: hafenbuero, wieder: hafenbuero };

const SCHICHTEN = [S8, S9, S10, S11, S12, S13, S14, S15, S16, S17];
module.exports = { SCHICHTEN };
