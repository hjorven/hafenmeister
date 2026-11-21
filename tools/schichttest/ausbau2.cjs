// Schichttest: Schichten ab 18 (Dauerlieger, Logbuch, Winter). Aufbau wie in ausbau.cjs:
// neu(t, z) prüft die neue Funktion, wieder(t, z) wiederholt sie kurz nach jeder späteren Schicht.

const { setzeTempo, insBild, fensterZu } = require('./schichten.cjs');
const { bauzeile, bauenSchliessen } = require('./ausbau.cjs');

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


// ------------------------------------------------------------------ Schicht 21: Ruf und Wünsche
// Stern oben zeigt den Ruf aus den Regeln; nach einem Spieltag mit Abreisen gibt es neue Bewertungen
// und der Stern folgt. Ein wartendes Boot mit Wunsch zeigt ihn in seiner Karte.
const RUF = () => { const G = window.hafenmeister; const n = G.sim.reputation();
  const el = document.querySelector('#hud-rep, #rep, .hm-ruf, [aria-label^="Ruf "]');
  return { ruf: n, soll: n.toFixed(1).replace('.', ','), text: el ? el.textContent.replace(/\s+/g, '').trim() : null,
    bewertungen: (G.sim.state.ratings || []).length, tag: G.sim.state.day }; };
async function rufPruefen(t, name) {
  const r = await t.G(RUF);
  await t.punkt(name, r.text != null && r.text.includes(r.soll), `Anzeige "${r.text}", Regeln ${r.soll}`, { bild: r.text == null || !r.text.includes(r.soll), schwere: 'B' });
  return r;
}
async function rufUndWuensche(t, z) {
  await fensterZu(t);
  const r0 = await rufPruefen(t, 'Stern oben zeigt den Ruf aus den Regeln');
  // Einen Spieltag weiter: neue Bewertungen, Stern folgt
  await setzeTempo(t, 'acht');
  await t.bis((d) => window.hafenmeister.sim.state.day > d, r0.tag, 240_000);
  await setzeTempo(t, 'pause');
  await fensterZu(t);
  const r1 = await t.G(RUF);
  if (r1.tag > r0.tag && !(await t.G(() => !!window.hafenmeister.sim.season?.()?.winter))) {
    await t.punkt('ein Spieltag bringt neue Bewertungen', r1.bewertungen !== r0.bewertungen || r1.ruf !== r0.ruf,
      `Bewertungen ${r0.bewertungen} -> ${r1.bewertungen}, Ruf ${r0.soll} -> ${r1.soll}`, { bild: false, schwere: 'C' });
  }
  await rufPruefen(t, 'Stern folgt nach dem Tag');
  // Wunsch in der Bootskarte: wartendes Boot mit Wünschen antippen
  await setzeTempo(t, 'drei');
  const id = await t.page.waitForFunction(() => { const S = window.hafenmeister.sim;
    const b = S.waitingBoats().find((x) => x.atBuoy && (x.wishes || []).length && window.__st.bootObjekt(x.id));
    return b ? String(b.id) : false; }, null, { timeout: 120_000, polling: 100 }).then((h) => h.jsonValue(), () => null);
  await setzeTempo(t, 'pause');
  if (!id) { await t.hinweis('Wünsche', 'in 120 s kein wartendes Boot mit Wunsch', { bild: false }); return; }
  const lage = await insBild(t, (bid) => [window.__st.bootSchirm(bid)], id);
  if (!lage.ok) { await t.hinweis('Wünsche', `Boot ${id} nicht frei im Bild`); return; }
  await t.sp.tippen(lage.p[0].x, lage.p[0].y);
  const karte = await t.bis(() => document.body.classList.contains('card-boat') && !document.getElementById('card').hidden, null, 4000);
  const w = await t.G((bid) => ({ soll: (window.hafenmeister.sim.state.boats[bid]?.wishes || []).length,
    ist: document.querySelectorAll('#card .hm-fakten li.wunsch').length,
    texte: [...document.querySelectorAll('#card .hm-fakten li.wunsch')].map((e) => e.textContent.trim()) }), id);
  await t.punkt('Bootskarte nennt die Wünsche des Boots', karte && w.ist === w.soll && w.soll > 0, `Boot ${id}: ${w.soll} Wünsche, Karte zeigt ${w.ist} (${w.texte.join(', ')})`, { bild: true, schwere: 'B' });
  await fensterZu(t);
}
const S21 = { nr: 21, name: 'Ruf und Wünsche', paket: 'P19', neu: rufUndWuensche,
  async wieder(t) { await rufPruefen(t, 'Stern zeigt den Ruf aus den Regeln'); } };

// ------------------------------------------------------------------ Schicht 22: Ereignisse und Wetter
// Wetterknopf öffnet den Bericht mit mehreren Tagen und schließt wieder; der Knopf nennt ein anstehendes
// Ereignis. Bei 8x bis zu einem Ereignis spielen: es wird angekündigt (Schild oder Knopf), bietet die
// Karte "Vorbereiten" etwas an, wirkt der Knopf.
async function wetterBericht(t) {
  await fensterZu(t);
  const chip = t.page.locator('#weather-chip');
  if (!(await chip.isVisible().catch(() => false))) { await t.punkt('Wetterknopf sichtbar', false, '', { schwere: 'B' }); return; }
  await t.sp.knopf(chip);
  const auf = await t.page.locator('#weather-panel').waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
  const zeilen = await t.page.locator('#weather-panel .wp-row').count();
  await t.punkt('Wetterbericht öffnet mit mehreren Tagen', auf && zeilen >= 2, `${zeilen} Tage`, { bild: !auf || zeilen < 2, schwere: 'B' });
  if (auf) {
    await t.sp.knopf(chip);
    const zu = await t.page.locator('#weather-panel').waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false);
    await t.punkt('Wetterbericht schließt über denselben Knopf', zu, '', { schwere: 'C' });
  }
  const passt = await t.G(() => { const fc = window.hafenmeister.events?.forecast(2) || []; const txt = document.getElementById('weather-chip')?.textContent || '';
    const e = fc[0]?.event ?? fc.slice(1).find((x) => x.event)?.event; return { e: e?.title ?? null, txt }; });
  if (passt.e) await t.punkt('Wetterknopf nennt das anstehende Ereignis', passt.txt.includes(passt.e), `"${passt.txt}", Ereignis ${passt.e}`, { bild: false, schwere: 'C' });
}
// Steht die Winterbilanz, gibt es bis zum Frühling nichts zu prüfen: "Winter überspringen"
async function winterWeg(t) {
  const ja = t.page.locator('#hm-winter:not([hidden]) .hm-wi-ja');
  if (!(await ja.isVisible().catch(() => false))) return false;
  await t.sp.knopf(ja);
  await t.bis(() => !window.hafenmeister.sim.season?.()?.winter && !window.hafenmeister.winter?.springt, null, 120_000);
  await t.hinweis('Winter übersprungen', 'damit die Schicht im Frühling weiterprüft', { bild: false });
  return true;
}
async function ereignisse(t, z) {
  await wetterBericht(t);
  // Ankündigungen mitschreiben
  await t.G(() => { if (window.__evLog) return; window.__evLog = []; const G = window.hafenmeister;
    for (const n of ['event:announce', 'event:start', 'event:end']) G.on(n, (d) => window.__evLog.push({ n, id: d?.event?.id, titel: d?.event?.title, tag: d?.day })); });
  const da = () => { const G = window.hafenmeister; return !!G.events?.current || (G.events?.forecast(2) || []).some((x) => x.event) || window.__evLog.length > 0; };
  if (!(await t.G(da))) {
    await setzeTempo(t, 'acht');
    const t0 = Date.now();
    while (Date.now() - t0 < 8 * 60_000 && !(await t.G(da))) {
      await t.bis(da, null, 60_000);
      if (!(await t.G(da))) { await winterWeg(t); await fensterZu(t); await setzeTempo(t, 'acht'); }
    }
    await setzeTempo(t, 'pause');
  }
  const lage = await t.G(() => { const G = window.hafenmeister; const fc = G.events?.forecast(2) || [];
    return { cur: G.events?.current?.event?.title ?? G.events?.current?.title ?? null, naechst: fc.find((x) => x.event)?.event?.title ?? null,
      log: window.__evLog.slice(-4), banner: !document.getElementById('event-banner')?.hidden ? document.getElementById('event-banner').textContent.trim().slice(0, 80) : null,
      chip: document.getElementById('weather-chip')?.textContent?.trim(), tag: G.sim.state.day }; });
  if (!lage.cur && !lage.naechst && !lage.log.length) { await t.hinweis('Ereignisse', `in 8 min Echtzeit kein Ereignis (Tag ${lage.tag})`, { bild: false }); return; }
  const titel = lage.naechst || lage.cur || lage.log[lage.log.length - 1]?.titel;
  await t.punkt('Ereignis ist für den Spieler sichtbar angekündigt', !!(lage.banner || (titel && lage.chip?.includes(titel))),
    `Tag ${lage.tag}: ${titel}; Schild ${lage.banner ? `"${lage.banner}"` : 'weg'}, Wetterknopf "${lage.chip}"`, { bild: true, schwere: 'B' });
  // Vorbereiten (ab Stufe 3 bei Sturm, ab Stufe 5 Hanse-Woche, Regatta)
  const karte = t.page.locator('#ev-vorbereiten:not([hidden]) .hm-primaer');
  if (await karte.isVisible().catch(() => false)) {
    const vor = await t.G(() => JSON.stringify(window.hafenmeister.sim.state.modules?.vorbereitung ?? null));
    const text = (await karte.textContent()).trim();
    await t.sp.knopf(karte);
    await t.warte(500);
    const nach = await t.G(() => JSON.stringify(window.hafenmeister.sim.state.modules?.vorbereitung ?? null));
    await t.punkt('Vorbereiten wirkt', vor !== nach, `"${text}"`, { bild: true, schwere: 'B' });
  }
  await winterWeg(t);
  await fensterZu(t);
  z.ereignis = titel;
}
const S22 = { nr: 22, name: 'Ereignisse und Wetter', paket: 'P24, P20', neu: ereignisse, wieder: wetterBericht };

// ------------------------------------------------------------------ Schicht 23: Angebote (Services)
// Über Bauen, Reiter "Angebote": das günstigste freigeschaltete Angebot bauen (Vorschau, Bestätigen).
// Danach ist es in den Regeln gebaut, steht im Hafen und die Bauliste zeigt den nächsten Schritt.
async function angebote(t, z) {
  await winterWeg(t);
  await fensterZu(t);
  let ziel = null;
  for (let versuch = 0; versuch < 4 && !ziel; versuch++) {
    await t.sp.knopf(t.page.locator('#btn-build'));
    await t.page.locator('#card.bau-karte').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const reiter = t.page.locator('#card .bau-tab', { hasText: 'Angebote' });
    if (await reiter.isVisible().catch(() => false)) await t.sp.knopf(reiter);
    ziel = await t.G(() => { const z = [...document.querySelectorAll('#card .bau-zeile[data-bau^="angebot:"]')].find((e) => !e.classList.contains('gesperrt') && !e.classList.contains('teuer'));
      return z ? z.dataset.bau : null; });
    if (!ziel) {
      const liste = await t.G(() => [...document.querySelectorAll('#card .bau-zeile[data-bau^="angebot:"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)));
      await bauenSchliessen(t);
      if (!liste.length) { await t.hinweis('Angebote', 'Reiter "Angebote" ohne Zeilen'); return; }
      // Zu teuer oder gesperrt: einen Spieltag weiter
      const d = await t.G(() => window.hafenmeister.sim.state.day);
      await setzeTempo(t, 'acht');
      await t.bis((tag) => window.hafenmeister.sim.state.day > tag, d, 240_000);
      await setzeTempo(t, 'pause');
      await winterWeg(t);
      await fensterZu(t);
      z.angebotListe = liste;
    }
  }
  if (!ziel) { await t.hinweis('Angebote', `nach 4 Tagen nichts bezahlbar: ${(z.angebotListe || []).join(' | ')}`); return; }
  const id = ziel.slice('angebot:'.length);
  const vorher = await t.G((sid) => ({ stufe: (window.hafenmeister.services.liste().find((x) => x.id === sid) || {}).stufe ?? 0, geld: window.hafenmeister.sim.state.money }), id);
  await t.sp.knopf(t.page.locator(`#card .bau-zeile[data-bau="${ziel}"]`));
  const ja = t.page.locator('#card .bau-ja');
  const kannBauen = await ja.waitFor({ state: 'visible', timeout: 4000 }).then(() => ja.isEnabled(), () => false);
  if (!kannBauen) { await t.punkt('Angebot lässt sich bestätigen', false, ziel, { schwere: 'B' }); await bauenSchliessen(t); return; }
  await t.bild('s23-angebot-vorschau');
  await t.sp.knopf(ja);
  const ok = await t.bis(([sid, s0]) => ((window.hafenmeister.services.liste().find((x) => x.id === sid) || {}).stufe ?? 0) > s0, [id, vorher.stufe], 15_000);
  await bauenSchliessen(t);
  const nach = await t.G((sid) => ({ stufe: (window.hafenmeister.services.liste().find((x) => x.id === sid) || {}).stufe ?? 0, geld: window.hafenmeister.sim.state.money }), id);
  await t.punkt('Angebot über Bauen gebaut', ok, `${id}: Stufe ${vorher.stufe} -> ${nach.stufe}, Geld ${Math.round(vorher.geld)} -> ${Math.round(nach.geld)} €`, { bild: true, schwere: 'A' });
  if (ok) (z.angebote ||= []).push(id);
}
async function angeboteWieder(t, z) {
  if (!z.angebote?.length) return;
  const l = await t.G((ids) => ids.map((sid) => `${sid}:${(window.hafenmeister.services.liste().find((x) => x.id === sid) || {}).stufe ?? 0}`), z.angebote);
  await t.punkt('gebaute Angebote bleiben gebaut', l.every((x) => !x.endsWith(':0')), l.join(', '), { bild: false, schwere: 'B' });
}
const S23 = { nr: 23, name: 'Angebote (Services)', paket: 'P23', neu: angebote, wieder: angeboteWieder };

const SCHICHTEN = [S18, S19, S20, S21, S22, S23];
module.exports = { SCHICHTEN };
