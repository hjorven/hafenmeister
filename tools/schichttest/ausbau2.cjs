// Schichttest: Schichten ab 18 (Dauerlieger, Logbuch, Winter). Aufbau wie in ausbau.cjs:
// neu(t, z) prüft die neue Funktion, wieder(t, z) wiederholt sie kurz nach jeder späteren Schicht.

const { setzeTempo, insBild, fensterZu } = require('./schichten.cjs');

// ------------------------------------------------------------------ Schicht 18: Dauerlieger
// Ab Stufe 2 fragen Einheimische nach festen Plätzen. Freie Box antippen, Bewerber wählen:
// Platz wird Dauerplatz, die Pacht kommt. Danach: der Dauerplatz bleibt belegt und keine Gastzuweisung landet dort.
async function dauerlieger(t, z) {
  await fensterZu(t);
  const stufe = await t.G(() => window.hafenmeister.sim.state.stage);
  if (stufe < 2) { await t.hinweis('Dauerlieger', `erst ab Stufe 2 (jetzt ${stufe})`, { bild: false }); return; }
  // Auf Bewerber warten (bei 8x, höchstens zwei Spieltage)
  const bew = () => (window.hafenmeister.sim.state.modules?.dauer?.bewerber || []).length;
  if (!(await t.G(bew))) {
    await setzeTempo(t, 'acht');
    await t.bis(() => (window.hafenmeister.sim.state.modules?.dauer?.bewerber || []).length > 0, null, 240_000);
    await setzeTempo(t, 'pause');
  }
  const n = await t.G(bew);
  if (!n) { await t.hinweis('Dauerlieger', 'keine Anfrage in zwei Spieltagen', { bild: false }); return; }
  await fensterZu(t);
  const vorher = await t.G(() => ({ geld: window.hafenmeister.sim.state.money, plaetze: Object.keys(window.hafenmeister.sim.state.modules?.dauer?.plaetze || {}) }));
  // Hafen voll: bei 8x warten, bis eine Box frei wird (Abreisen am Nachmittag), höchstens 3 min
  const FREI = () => Object.values(window.hafenmeister.sim.platzZustaende?.() || {}).includes('frei');
  if (!(await t.G(FREI))) {
    await setzeTempo(t, 'acht');
    await t.bis(() => Object.values(window.hafenmeister.sim.platzZustaende?.() || {}).includes('frei'), null, 180_000);
    await setzeTempo(t, 'pause');
    await fensterZu(t);
  }
  // Freie Boxen der Reihe nach antippen, bis eine Karte mit Bewerbern kommt
  const frei = await t.G(() => Object.entries(window.hafenmeister.sim.platzZustaende?.() || {}).filter(([, s]) => s === 'frei').map(([id]) => id));
  let platz = null, gewaehlt = null;
  for (const pid of frei.slice(0, 6)) {
    const lage = await insBild(t, (id) => [window.__st.platzSchirm(id)], pid);
    if (!lage.ok) continue;
    await t.sp.tippen(lage.p[0].x, lage.p[0].y);
    const knopf = t.page.locator('#card .dauer-bewerber').first();
    if (await knopf.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false)) {
      platz = pid; gewaehlt = (await knopf.textContent()).replace(/\s+/g, ' ').trim();
      await t.bild('s18-platzkarte');
      await t.sp.knopf(knopf);
      break;
    }
    await fensterZu(t);
  }
  if (!platz) { await t.hinweis('Dauerlieger', `keine freie Box mit passendem Bewerber (${frei.length} frei, ${n} Bewerber)`); return; }
  const ok = await t.bis((pid) => !!window.hafenmeister.sim.state.modules?.dauer?.plaetze?.[pid], platz, 5000);
  const nach = await t.G((pid) => ({ geld: window.hafenmeister.sim.state.money, zustand: window.hafenmeister.sim.platzZustand?.(pid) }), platz);
  await t.punkt('freie Box als Dauerplatz vermieten', ok, `${platz}: ${gewaehlt}; Geld ${Math.round(vorher.geld)} -> ${Math.round(nach.geld)} €, Platz ${nach.zustand}`, { bild: true, schwere: 'B' });
  await fensterZu(t);
  (z.dauer ||= []).push(platz);
}

async function dauerWieder(t, z) {
  if (!z.dauer?.length) return;
  // Kein Gast liegt auf einem Dauerplatz, außer das Boot ist auf Törn (Platz grün)
  const lage = await t.G((ids) => { const G = window.hafenmeister; const st = G.sim.state; const d = st.modules?.dauer?.plaetze || {};
    return ids.map((pid) => { const p = d[pid]; const b = st.boats[st.berths?.[pid]];
      return { pid, da: !!p, gast: !!b && !b.stationed && !p?.boot && b.id !== p?.bootId, gekuendigt: p?.kuendigung ?? null }; }); }, z.dauer);
  const falsch = lage.filter((x) => x.da && x.gast);
  await t.punkt('kein Gast auf einem Dauerplatz, solange der Dauerlieger da ist', falsch.length === 0, JSON.stringify(lage), { schwere: 'B' });
}
const S18 = { nr: 18, name: 'Dauerlieger', paket: 'P01', neu: dauerlieger, wieder: dauerWieder };

// ------------------------------------------------------------------ Schicht 19: Logbuch
// Über das Menü öffnen, Reiter durchtippen, jede gesehene Bootsart steht drin, wieder schließen.
async function logbuch(t) {
  await fensterZu(t);
  await t.sp.knopf(t.page.locator('#btn-menu'));
  const eintrag = t.page.locator('#hm-menue button:visible', { hasText: 'Logbuch' }).first();
  if (!(await eintrag.isVisible().catch(() => false))) { await t.punkt('Menü hat einen Eintrag "Logbuch"', false, '', { schwere: 'B' }); return; }
  await t.sp.knopf(eintrag);
  const fenster = t.page.locator('#hm-logbuch');
  const offen = await fenster.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
  await t.punkt('Logbuch öffnet aus dem Menü', offen, '', { bild: true, schwere: 'B' });
  if (!offen) return;
  // Das Logbuch baut sich beim Reiterwechsel neu auf: Reiter jedes Mal frisch suchen (nur die Hauptreiter, nicht die Größen-Chips)
  const REITER = '#hm-logbuch .hm-lb-reiterleiste [role="tab"]';
  const anzahl = await t.page.locator(REITER).count();
  const leer = [];
  for (let i = 0; i < anzahl; i++) {
    const r = t.page.locator(REITER).nth(i);
    await r.scrollIntoViewIfNeeded().catch(() => {});
    await t.sp.knopf(r);
    await t.warte(300);
    const name = (await t.page.locator(REITER).nth(i).textContent()).replace(/\s+/g, ' ').trim();
    const gewaehlt = await t.page.locator(REITER).nth(i).getAttribute('aria-selected');
    const inhalt = await t.page.locator('#hm-logbuch [role="tabpanel"]').first().textContent().catch(() => '');
    if (gewaehlt !== 'true' || !inhalt || inhalt.replace(/\s+/g, '').length < 10) leer.push(name);
  }
  await t.punkt('jeder Reiter zeigt etwas', anzahl > 0 && leer.length === 0, `${anzahl} Reiter${leer.length ? `, leer oder nicht gewählt: ${leer.join(', ')}` : ''}`, { bild: leer.length > 0, schwere: 'C' });
  // Gesehene Bootsarten (Regeln) stehen im Logbuch
  const arten = await t.G(() => Object.keys(window.hafenmeister.sim.state.logbook || {}).length);
  await t.punkt('Logbuch kennt die gesehenen Bootsarten', arten > 0, `${arten} Arten in den Regeln`, { bild: false, schwere: 'B' });
  const zu = t.page.locator('#hm-logbuch .hm-lb-zu:visible, #hm-logbuch button[aria-label*="chließen"]:visible').first();
  if (await zu.count()) await t.sp.knopf(zu); else if (!t.touch) await t.page.keyboard.press('Escape');
  const weg = await fenster.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true, () => false);
  await t.punkt('Logbuch schließt wieder', weg, '', { schwere: 'B' });
  if (await t.page.locator('#hm-menue').isVisible().catch(() => false)) await t.sp.knopf(t.page.locator('#btn-menu'));
}
const S19 = { nr: 19, name: 'Logbuch', paket: 'P21', neu: logbuch, wieder: logbuch };

// ------------------------------------------------------------------ Schicht 20: Winter
// Bei 8x bis zum Winter spielen (höchstens 25 min Echtzeit). Winterpause-Karte kommt, keine Gastboote,
// "Winter überspringen" führt in den Frühling, danach läuft der Tag wieder mit Booten.
async function winter(t, z) {
  await fensterZu(t);
  const S = () => !!window.hafenmeister.sim.season?.()?.winter;
  if (!(await t.G(S))) {
    await setzeTempo(t, 'acht');
    const t0 = Date.now();
    while (Date.now() - t0 < 25 * 60_000 && !(await t.G(S))) {
      await t.bis(() => !!window.hafenmeister.sim.season?.()?.winter, null, 60_000);
      // Tagesabschluss-Zettel und Feier liegen lassen schadet nicht; Tempo nach Fenstern wieder auf 8x
      if (!(await t.G(S))) { await fensterZu(t); await setzeTempo(t, 'acht'); }
    }
    await setzeTempo(t, 'pause');
  }
  const tag = await t.G(() => ({ tag: window.hafenmeister.sim.state.day, jahr: window.hafenmeister.sim.season?.()?.year }));
  if (!(await t.G(S))) { await t.hinweis('Winter', `in 25 min Echtzeit nicht erreicht (Tag ${tag.tag})`, { bild: false }); return; }
  const karte = t.page.locator('#hm-winter:not([hidden])');
  const da = await karte.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
  await t.punkt('Winterpause-Karte erscheint', da, `Tag ${tag.tag}, Jahr ${tag.jahr}`, { bild: true, schwere: 'B' });
  const gaeste = await t.G(() => window.hafenmeister.sim.waitingBoats().length);
  await t.punkt('im Winter warten keine Gastboote', gaeste === 0, `${gaeste} wartend`, { bild: false, schwere: 'C' });
  if (!da) return;
  const ja = t.page.locator('#hm-winter .hm-wi-ja');
  await t.sp.knopf(ja);
  await setzeTempo(t, 'normal');
  const fruehling = await t.bis(() => !window.hafenmeister.sim.season?.()?.winter && !window.hafenmeister.winter?.springt, null, 120_000);
  const nach = await t.G(() => ({ tag: window.hafenmeister.sim.state.day, jahr: window.hafenmeister.sim.season?.()?.year, phase: window.hafenmeister.sim.state.phase }));
  await t.punkt('"Winter überspringen" führt in den Frühling', fruehling, `Tag ${tag.tag} -> ${nach.tag}, Jahr ${tag.jahr} -> ${nach.jahr}, ${nach.phase}`, { bild: true, schwere: 'A' });
  await fensterZu(t);
  z.winterDurch = true;
}
async function winterWieder(t, z) {
  if (!z.winterDurch) return;
  const s = await t.G(() => ({ winter: !!window.hafenmeister.sim.season?.()?.winter, springt: !!window.hafenmeister.winter?.springt }));
  await t.punkt('nach dem Winter läuft die Saison', !s.winter && !s.springt, JSON.stringify(s), { bild: false, schwere: 'B' });
}
const S20 = { nr: 20, name: 'Winter', paket: 'P20', neu: winter, wieder: winterWieder };

const SCHICHTEN = [S18, S19, S20];
module.exports = { SCHICHTEN };
