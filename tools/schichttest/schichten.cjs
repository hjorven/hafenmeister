// Schichttest: die Schichten in der Reihenfolge, in der sie aufeinander aufbauen.
// Jede Schicht hat neu(t, z) (Funktion zum ersten Mal spielen und prüfen) und optional wieder(t, z)
// (kurze Wiederholung, läuft nach jeder späteren Schicht im selben Spiel erneut).
// t kommt aus lauf.cjs (page, sp = Spieler, punkt, hinweis, bild, bis, spielzeit ...), z ist der
// gemeinsame Zustand aller Schichten in diesem Lauf.
// Reihenfolge abgeleitet aus docs/roadmap.md, docs/arbeitsplan.md und der Bestandsaufnahme (docs/schichttest.md).

const path = require('path');
let PNG = null;
try { ({ PNG } = require(path.join(__dirname, '..', '..', 'tests', 'node_modules', 'pngjs'))); } catch { /* ohne Bildauswertung */ }

// ------------------------------------------------------------------ kleine Hilfen
// Mittlere Helligkeit und Farbanzahl eines Bildschirmfotos (Spielfläche schwarz? Abend dunkler?)
function bildWerte(buf) {
  if (!PNG) return null;
  const png = PNG.sync.read(buf);
  let sum = 0, dunkel = 0; const farben = new Set(); const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 16) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    sum += (r + g + b) / 3; if (r + g + b < 30) dunkel++;
    farben.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
  }
  return { hell: sum / (n / 4), dunkel: dunkel / (n / 4), farben: farben.size };
}
const leinwandBild = async (t) => bildWerte(await t.page.locator('#stage').screenshot({ type: 'png', timeout: 60_000 }));

const tempo = {
  pause: (t) => t.page.locator('#btn-pause'),
  normal: (t) => t.page.getByRole('button', { name: 'Normale Geschwindigkeit' }),
  drei: (t) => t.page.getByRole('button', { name: 'Dreifach vorspulen' }),
  acht: (t) => t.page.getByRole('button', { name: 'Achtfach vorspulen' }),
};
async function setzeTempo(t, art) {
  const k = tempo[art](t);
  if (!(await k.isVisible().catch(() => false))) {
    // Zeitleiste nicht da: was liegt offen? (am Handy ersetzt die Bootskarte die Leiste)
    const offen = await t.G(() => ({ body: document.body.className, karte: !document.getElementById('card')?.hidden, zeit: !!document.getElementById('hm-zeit')?.getBoundingClientRect().width }));
    const zu = await fensterZu(t);
    if (!(await k.isVisible().catch(() => false))) await t.page.keyboard.press('Escape').catch(() => {});
    await t.hinweis('Zeitleiste nicht sichtbar', `vor "${art}": ${JSON.stringify(offen)}; geschlossen ${zu.join(', ') || 'nichts'}`, { bild: true });
  }
  await t.sp.knopf(k);
  const soll = { pause: null, normal: 1, drei: 3, acht: 8 }[art];
  const ok = await t.bis((s) => (s == null ? window.hafenmeister.paused : !window.hafenmeister.paused && window.hafenmeister.speed === s), soll, 5000);
  return ok;
}

// Offene Fenster schließen, die sich über den Hafen legen (Tagesabschluss, Meldungen mit "Weiter").
// Liefert die Namen der geschlossenen Fenster.
async function fensterZu(t) {
  const zu = [];
  for (let i = 0; i < 4; i++) {
    const ta = t.page.locator('#hm-tagesabschluss:not([hidden]) .hm-ta-weiter');
    if (await ta.isVisible().catch(() => false)) { await t.sp.knopf(ta); zu.push('Tagesabschluss'); await t.warte(400); continue; }
    // Offene Bootskarte (nach Antippen eines Boots): am Handy ersetzt sie die Leisten, also über ihr Kreuz schließen
    const bootskarte = t.page.locator('#card:not(.bau-karte):visible .hm-zu, #card:not(.bau-karte):visible button[aria-label*="chließen"]').first();
    if (await bootskarte.isVisible().catch(() => false)) { await t.sp.knopf(bootskarte); zu.push('Bootskarte'); await t.warte(300); continue; }
    const feier = t.page.locator('#hm-feier:not([hidden]) .hm-feier-weiter');
    if (await feier.isVisible().catch(() => false)) { await t.sp.knopf(feier); zu.push('Feier'); await t.warte(600); continue; }
    const tipp = t.page.getByRole('button', { name: 'Verstanden' }).first();
    if (await tipp.isVisible().catch(() => false)) {
      const titel = await tipp.evaluate((b) => b.closest('section, div[class*="tipp"], div[class*="karte"], [role="dialog"]')?.querySelector('h1,h2,h3,strong,b,[class*="titel"]')?.textContent?.trim() ?? 'Tipp').catch(() => 'Tipp');
      await t.sp.knopf(tipp); zu.push(`Tipp "${titel}"`); await t.warte(300); continue;
    }
    break;
  }
  return zu;
}

// Weltpunkte ins freie Bild holen: echtes Verschieben der Karte (Maus ziehen oder ein Finger)
// von einem leeren Punkt aus. punkteFn liefert die aktuellen Bildschirmpunkte (oder null).
async function insBild(t, punkteFn, arg = null, versuche = 4) {
  for (let i = 0; i < versuche; i++) {
    const p = await t.G(punkteFn, arg);
    if (p && p.every((q) => q && q.frei)) return { ok: true, p, gezogen: i };
    const ziel = await t.G(() => window.__st.mitte());
    const da = (p || []).filter(Boolean);
    if (!da.length) return { ok: false, p };
    const cx = da.reduce((a, q) => a + q.x, 0) / da.length, cy = da.reduce((a, q) => a + q.y, 0) / da.length;
    let dx = ziel.x - cx, dy = ziel.y - cy;
    const lang = Math.hypot(dx, dy);
    if (lang < 8) return { ok: false, p, gezogen: i };
    const max = 260; if (lang > max) { dx *= max / lang; dy *= max / lang; }
    const start = await t.G(([x, y]) => window.__st.leererPunkt(x, y, 40), [ziel.x - dx / 2, ziel.y - dy / 2]);
    if (!start) return { ok: false, p, gezogen: i };
    await t.sp.ziehen([{ x: start.x, y: start.y }, { x: start.x + dx, y: start.y + dy }], { halten: 200, start: 60 });
    await t.kameraRuhig();
  }
  const p = await t.G(punkteFn, arg);
  return { ok: !!p && p.every((q) => q && q.frei), p, gezogen: versuche };
}

// Stand des Spiels für Speichern/Laden
const STAND = () => {
  const G = window.hafenmeister; const S = G.sim; const st = S.state;
  return {
    stufe: st.stage, tag: st.day, phase: st.phase, geld: Math.round(st.money), buero: st.office,
    liegend: S.mooredBoats().map((b) => `${b.id}@${b.berthId}`).sort(),
    bauten: JSON.stringify(st.facilities ?? null) + JSON.stringify(st.buildings ?? null),
    gelaende: JSON.stringify([G.gelaende?.aktuell?.().nr, G.gelaende?.aktuell?.().seed]), stegbild: JSON.stringify(G.stegbild?.aktuell?.()?.nr ?? null),
  };
};

// ------------------------------------------------------------------ Schicht 1: Laden und Oberfläche
async function laden(t, z, { neu = false } = {}) {
  if (neu) await t.page.goto(t.adresse());
  else await t.page.reload();
  const ok = await t.bis(() => { const b = document.getElementById('boot'); return b && (b.classList.contains('done') || b.classList.contains('error')); }, null, 60_000);
  const fehler = await t.G(() => document.getElementById('boot')?.classList.contains('error'));
  await t.bis(() => window.hafenmeister?.sim && window.hafenmeister.time > 0.1, null, 30_000);
  await t.hilfen();
  return ok && !fehler;
}

async function oberflaeche(t) {
  const raus = await t.G(() => window.__st.ausDemBild());
  await t.punkt('Knöpfe und Anzeigen ganz im Bild', raus.length === 0, raus.map((r) => `${r.was} bei ${r.r.join(',')}`).join('; '));
  const werte = await leinwandBild(t);
  if (werte) await t.punkt('Spielfläche zeigt ein Bild', werte.dunkel < 0.5 && werte.farben > 40, `${werte.farben} Farben, ${Math.round(werte.dunkel * 100)} % schwarz`, { bild: false });
}

const S1 = {
  nr: 1, name: 'Laden und Oberfläche', paket: 'Grundgerüst, P61',
  async neu(t, z) {
    const ok = await laden(t, z, { neu: true });
    await t.punkt('Spiel lädt ohne Fehlermeldung', ok, '', { schwere: 'A' });
    z.ausgangslage = await t.G(() => { const G = window.hafenmeister; const g = G.gelaende?.aktuell?.() ?? {}; const sb = G.stegbild?.aktuell?.();
      return { gelaende: g.nr ?? null, seed: g.seed ?? null, stegbild: sb?.nr ?? sb?.id ?? sb ?? null, stufe: G.sim.state.stage }; });
    t.R.ausgangslage = z.ausgangslage;
    await t.hinweis('Startbild', `Geländeform ${z.ausgangslage.gelaende}, Seed ${z.ausgangslage.seed}, Stegbild ${z.ausgangslage.stegbild}`);
    await t.punkt('keine Konsolenfehler beim Start', t.R.fehler.length === 0, t.R.fehler.map((f) => f.text).join(' | ').slice(0, 300), { schwere: 'A' });
    // Neuer Spieler: der Einstieg läuft. Für die Kernschichten über seinen eigenen Knopf beenden.
    const beenden = t.page.getByRole('button', { name: 'Einstieg beenden' });
    if (await beenden.isVisible().catch(() => false)) {
      await t.sp.knopf(beenden);
      const weg = await t.bis(() => !document.querySelector('.hm-einstieg-karte, [class*="einstieg"]:not([hidden]) .beenden') || window.hafenmeister.einstieg?.fertig?.() !== false, null, 5000);
      const sichtbar = await beenden.isVisible().catch(() => false);
      await t.punkt('Einstieg lässt sich über "Einstieg beenden" schließen', weg && !sichtbar);
    } else await t.hinweis('Einstieg', 'Beim ersten Start kein Knopf "Einstieg beenden" sichtbar');
    await t.warte(500);
    await oberflaeche(t);
  },
  async wieder(t) {
    await oberflaeche(t);
  },
};

// ------------------------------------------------------------------ Schicht 2: Kamera
async function kamera(t) {
  const cam = () => window.hafenmeister.camera;
  const lies = () => { const c = window.hafenmeister.camera; return { x: c.target.x, z: c.target.z, w: c.viewWidth }; };
  await fensterZu(t);
  await t.sp.knopf(t.page.locator('#btn-overview'));
  await t.kameraRuhig();
  const c0 = await t.G(lies);
  // Verschieben
  const p = await t.G(() => window.__st.leererPunkt());
  if (!p) { await t.punkt('leere Stelle zum Verschieben gefunden', false); return; }
  await t.sp.ziehen([{ x: p.x, y: p.y }, { x: p.x + 120, y: p.y + 70 }], { halten: 150, start: 60 });
  await t.kameraRuhig();
  const c1 = await t.G(lies);
  const weg = Math.hypot(c1.x - c0.x, c1.z - c0.z);
  await t.punkt('Karte verschieben (Ziehen auf leerem Wasser)', weg > 0.5, `Blickpunkt ${weg.toFixed(1)} m verschoben`);
  // Zoomen
  const q = await t.G(() => window.__st.leererPunkt());
  await t.sp.zoomen(q.x, q.y, 1.8);
  await t.kameraRuhig();
  const c2 = await t.G(lies);
  await t.punkt(`Heranzoomen (${t.touch ? 'zwei Finger' : 'Mausrad'})`, c2.w < c1.w * 0.95, `Sichtbreite ${c1.w.toFixed(0)} -> ${c2.w.toFixed(0)}`);
  // Übersicht
  await t.sp.knopf(t.page.locator('#btn-overview'));
  await t.kameraRuhig();
  const c3 = await t.G(lies);
  const zurueck = Math.abs(c3.w - c0.w) / c0.w < 0.1 && Math.hypot(c3.x - c0.x, c3.z - c0.z) < 2;
  await t.punkt('Knopf Übersicht stellt die Startansicht wieder her', zurueck, `Breite ${c3.w.toFixed(0)} (vorher ${c0.w.toFixed(0)}), Abstand ${Math.hypot(c3.x - c0.x, c3.z - c0.z).toFixed(1)} m`);
  void cam;
}
const S2 = { nr: 2, name: 'Kamera', paket: 'P01, PR 137', neu: kamera, wieder: kamera };

// ------------------------------------------------------------------ Schicht 3 bis 5: ein Boot von der See bis zur Münze
// Wartet auf ein neues Boot an der Boje (nicht eins aus früheren Runden) und hält das Spiel an.
async function bootKommt(t, z, { erstes = false } = {}) {
  z.bekannt ||= [];
  const zu = await fensterZu(t);
  if (zu.length) await t.hinweis('Fenster geschlossen', zu.join(', '), { bild: false });
  const tStart = await t.G(() => window.hafenmeister.time);
  let info = null;
  for (let versuch = 0; versuch < 4 && !info; versuch++) {
    await setzeTempo(t, 'drei');
    // Neues wartendes Boot, das schon sichtbar an seiner Boje liegt und für das eine Box frei ist
    const id = await t.page.waitForFunction((bek) => {
      const S = window.hafenmeister.sim;
      const b = S.waitingBoats().find((x) => x.atBuoy && !bek.includes(String(x.id)) && window.__st.bootObjekt(x.id) && (S.passendePlaetze(x.id) || []).length > 0);
      return b ? String(b.id) : false;
    }, z.bekannt, { timeout: 150_000, polling: 100 }).then((h) => h.jsonValue(), () => null);
    await setzeTempo(t, 'pause');
    if (!id) break;
    info = await t.G((bid) => {
      const G = window.hafenmeister; const S = G.sim;
      const b = S.state.boats[bid];
      if (!b || b.status !== 'waiting' || !(S.passendePlaetze(bid) || []).length) return null;
      const kam = window.__st.ereignisse.find((e) => e.n === 'boot-kommt' && String(e.d?.id ?? e.d?.boot).replace(/^b/, '') === String(b.id));
      return { id: b.id, groesse: b.size, name: b.name, status: b.status, t: G.time, kommt: kam ? kam.t : null, herkunft: kam?.d?.herkunft ?? null };
    }, id);
    // Zu spät angehalten (Boot schon selbst eingefahren): nächstes Boot nehmen
    if (!info) { z.bekannt.push(id); await t.hinweis('Boot verpasst', `Boot ${id} war beim Anhalten schon weg`, { bild: false }); }
  }
  if (!info) {
    // Kein neues Boot mit freier Box: Hafen voll (kein Fehler) oder es kommt gar keins (Fehler)
    const lage = await t.G((t0) => { const G = window.hafenmeister; const S = G.sim; const zaehl = {};
      for (const b of Object.values(S.state.boats)) { const k = `${b.status}${b.atBuoy ? '@boje' : ''}`; zaehl[k] = (zaehl[k] || 0) + 1; }
      return { wartend: S.waitingBoats().length, liegend: S.mooredBoats().length, zaehl, spielzeit: Math.round(G.time - t0), phase: S.state.phase, tag: S.state.day,
        winter: !!S.season?.()?.winter, geplant: (S.state.upcoming || []).length, ereignis: G.events?.current?.id ?? null, frei: S.waitingBoats().map((b) => `${b.id}:${b.size}:${(S.passendePlaetze(b.id) || []).length}`).join(' ') }; }, tStart);
    if (lage.winter) { await t.hinweis('Winter', `Tag ${lage.tag}: keine Gastboote im Winter`, { bild: false }); return null; }
    if (!lage.wartend && !lage.geplant) { await t.hinweis('Keine Ankünfte mehr heute', `Tag ${lage.tag}, ${lage.phase}: alle Boote des Tages sind da; Boote ${JSON.stringify(lage.zaehl)}`, { bild: false }); return null; }
    if (lage.wartend > 0) await t.hinweis('Hafen voll', `${lage.wartend} Boote warten, ${lage.liegend} liegen, keine passende freie Box in 150 s`);
    else await t.punkt('ein Boot kommt an die Boje', false, `in 150 s Echtzeit (${lage.spielzeit} s Spielzeit, Tag ${lage.tag}, ${lage.phase}) kein neues Boot an einer Boje, ${lage.geplant} noch geplant; Boote ${JSON.stringify(lage.zaehl)}${lage.ereignis ? `, Ereignis ${lage.ereignis}` : ''}`, { schwere: 'A' });
    return null;
  }
  z.bekannt.push(String(info.id));
  const dauer = info.t - tStart;
  await t.punkt('ein Boot kommt an die Boje', true, `Boot ${info.id} (${info.groesse}${info.herkunft ? ', aus ' + info.herkunft : ''}) nach ${Math.round(dauer)} s Spielzeit`, { bild: false });
  if (erstes) {
    // Jorven: das erste Boot am ersten Tag nach wenigen Sekunden (erstes Ereignis seit dem Laden, egal welches Boot)
    const erst = await t.G(() => { const e = window.__st.ereignisse; const k = e.find((x) => x.n === 'boot-kommt'); const b = e.find((x) => x.n === 'boot:an-boje'); return { kommt: k?.t ?? null, boje: b?.t ?? null }; });
    await t.punkt('erstes Boot nach wenigen Sekunden an der Boje', erst.boje != null && erst.boje < 45,
      `erstes Boot ${erst.kommt != null ? `nach ${Math.round(erst.kommt)} s gemeldet, ` : ''}${erst.boje != null ? `nach ${Math.round(erst.boje)} s an der Boje` : 'nie an der Boje'}`, { schwere: 'C', bild: false });
  }
  // In der Startansicht sichtbar und nicht von der Oberfläche verdeckt?
  await t.sp.knopf(t.page.locator('#btn-overview'));
  await t.kameraRuhig();
  const s = await t.G((id) => window.__st.bootSchirm(id), info.id);
  await t.punkt('wartendes Boot in der Übersicht sichtbar und frei', !!s && s.frei, s ? (s.frei ? '' : `verdeckt von ${s.drueber}`) : 'nicht im Bild', { schwere: 'C' });
  return info;
}

async function ziehenUndAnlegen(t, z, boot) {
  const plaetze = await t.G((id) => window.hafenmeister.sim.passendePlaetze(id) || [], boot.id);
  if (!plaetze.length) { await t.punkt('freie passende Box für das wartende Boot', false, `Boot ${boot.id} (${boot.groesse}) hat keine passende freie Box`, { schwere: 'B' }); return null; }
  // Box nahe am Boot, die mit dem Boot zusammen frei ins Bild passt
  let platz = null; let lage = null;
  for (const pid of plaetze.slice(0, 4)) {
    lage = await insBild(t, ([id, p]) => [window.__st.bootSchirm(id), window.__st.platzSchirm(p)], [boot.id, pid]);
    if (lage.ok) { platz = pid; break; }
  }
  if (!platz) { await t.punkt('Boot und Box gleichzeitig frei im Bild', false, `nach Verschieben der Karte: ${JSON.stringify(lage?.p)}`); return null; }
  if (lage.gezogen) await t.hinweis('Karte verschoben', `${lage.gezogen}-mal gezogen, bis Boot und Box ${platz} frei im Bild lagen`, { bild: false });
  const [b, p] = lage.p;
  // Boot greifen und auf die Box ziehen (leicht gebogen, wie ein Finger)
  const mitte = { x: (b.x + p.x) / 2 + 30, y: (b.y + p.y) / 2 };
  await t.sp.ziehen([{ x: b.x, y: b.y }, mitte, { x: p.x, y: p.y }], { halten: 350 });
  // Nach dem Loslassen darf keine Leine mehr hängen (Ringe/Boxen leuchten nur während des Ziehens)
  await t.warte(300);
  const haengt = await t.G(() => { let n = 0; window.hafenmeister.scene.traverse((o) => { if (o.name === 'gesten-ringe') n += o.children.length; }); return n; });
  await t.punkt('Leine nach dem Loslassen weg', haengt === 0, haengt ? `${haengt} Ringe leuchten noch` : '', { schwere: 'B' });
  const zug = await t.G((id) => { const e = window.__st.ereignisse.filter((x) => x.n === 'ui:tow-end' && String(x.d?.boot).replace(/^b/, '') === String(id)).pop(); return e ? e.d : null; }, boot.id);
  const nach = await t.G((id) => { const b = window.hafenmeister.sim.state.boats[id]; return b ? { status: b.status, platz: b.berthId } : null; }, boot.id);
  const ok = nach && nach.status === 'moored' && nach.platz === platz;
  await t.punkt('Boot mit der Leine auf die Box ziehen', ok, ok ? `Boot ${boot.id} -> ${platz}` : `losgelassen auf ${platz}: Leine ${zug ? 'eingerastet auf ' + zug.platz : 'nicht gegriffen'}, Boot danach ${JSON.stringify(nach)}`, { schwere: 'A' });
  if (!ok) return null;
  return anlegen(t, boot, platz);
}

// Das Boot fährt sichtbar in die Box und macht fest (Ereignis boat:moored an genau dieser Box)
async function anlegen(t, boot, platz, { tempo: art = 'drei' } = {}) {
  await setzeTempo(t, art);
  const tz = await t.G(() => window.hafenmeister.time);
  const fest = await t.bis(([id, pid]) => window.__st.ereignisse.some((e) => e.n === 'boat:moored' && String(e.d?.id).replace(/^b/, '') === String(id) && e.d?.berth === pid), [boot.id, platz], 120_000);
  const lage2 = await t.G(([id, pid]) => {
    const G = window.hafenmeister; const o = window.__st.bootObjekt(id); const p = G.stege?.platz?.(pid);
    const w = o?.getWorldPosition(new G.THREE.Vector3());
    return { t: G.time, abstand: w && p ? Math.hypot(w.x - p.x, w.z - p.z) : null };
  }, [boot.id, platz]);
  const warum = fest ? '' : await t.G(([id, tz]) => {
    const G = window.hafenmeister; const b = G.sim.state.boats?.[id];
    const ev = window.__st.ereignisse.filter((e) => e.t >= tz - 5 && String(e.d?.boatId ?? e.d?.id ?? e.d?.boot ?? '').replace(/^b/, '') === String(id)).map((e) => `${e.n}@${Math.round(e.t - tz)}${e.d?.berth ? ':' + e.d.berth : ''}`);
    const anim = (G.boatAnim?.boats || []).find?.((a) => String(a.id ?? a.boat?.id).replace(/^b/, '') === String(id));
    return `; Spielzeit ${Math.round(G.time - tz)} s, sim status ${b?.status ?? 'weg'} Platz ${b?.berth ?? '-'}, Anim ${anim ? (anim.state ?? anim.mode ?? 'da') : 'keine'}, Ereignisse ${ev.join(' ') || 'keine'}`;
  }, [boot.id, tz]);
  // Bekannter Fund F2: Kurzhalter wird abgerechnet und fährt weg, bevor er sichtbar festmacht (Schwere B, Lauf geht weiter)
  if (!fest && /sim:departed/.test(warum)) {
    await t.punkt('Kurzhalter macht fest, bevor er wieder abreist (F2)', false, `Boot ${boot.id} -> ${platz}${warum}`, { schwere: 'B' });
    return null;
  }
  await t.punkt('Boot fährt in die Box und macht fest', fest && lage2.abstand != null && lage2.abstand < 4,
    `${fest ? `nach ${Math.round(lage2.t - tz)} s Spielzeit` : 'kein Festmachen in 120 s Echtzeit'}, ${lage2.abstand?.toFixed(1)} m von der Boxmitte${warum}`, { schwere: 'A' });
  return fest ? platz : null;
}

async function kassieren(t, z, boot) {
  // Normales Tempo, bis die Münze da ist (bei 3x holt der Rundgang abends die Münze sonst zu schnell)
  if (!(await t.G((id) => window.__st.muenzen().includes(String(id)), boot.id))) await setzeTempo(t, 'normal');
  const da = await t.bis((id) => window.__st.muenzen().includes(String(id)), boot.id, 30_000);
  await setzeTempo(t, 'pause');
  // Schon bezahlt, ohne dass der Spieler gestrichen hat (Rundgang am Abend, Nachtkasse, Büro): kein Fehler
  const anders = da ? null : await t.G((id) => { const e = window.__st.ereignisse.find((x) => x.n === 'sim:collected' && String(x.d?.boatId) === String(id)); return e ? { t: Math.round(e.t), hand: e.d?.hand ?? null, phase: window.hafenmeister.sim.state.phase } : null; }, boot.id);
  if (anders && !anders.hand) { await t.hinweis('Münze schon kassiert', `Boot ${boot.id} wurde ohne Strich kassiert (Spielzeit ${anders.t}, Rundgang oder Büro)`, { bild: false }); return true; }
  // Zur Ursache: was sagen Regeln und Ereignisse zu diesem Boot?
  const warum = da ? '' : await t.G((id) => {
    const G = window.hafenmeister; const b = G.sim.state.boats[id];
    const ev = window.__st.ereignisse.filter((e) => String(e.d?.boatId ?? e.d?.id ?? e.d?.boot ?? '').replace(/^b/, '') === String(id)).map((e) => `${e.n}@${Math.round(e.t)}${e.d?.berth ? ':' + e.d.berth : ''}${e.d?.hand != null ? ':hand=' + e.d.hand : ''}`);
    return `Boot ${id}: status ${b?.status}, offen ${b?.pendingFee}, bezahlt ${b?.paid}, bis Tag ${b?.paidThrough}, Phase ${G.sim.state.phase}; Ereignisse ${ev.join(' ')}`;
  }, boot.id);
  await t.punkt('Münze über dem Boot nach dem Festmachen', da, warum, { schwere: 'A' });
  if (!da) return false;
  const lage = await insBild(t, (id) => [window.__st.muenzeSchirm(id)], boot.id);
  if (!lage.ok) {
    const offen = await t.G((id) => window.hafenmeister.sim.state.boats[id]?.pendingFee ?? 0, boot.id);
    if (offen <= 0) { await t.hinweis('Münze schon kassiert', `Boot ${boot.id}: Rundgang oder Büro war schneller`, { bild: false }); return true; }
    await t.punkt('Münze frei im Bild', false, JSON.stringify(lage.p)); return false;
  }
  const vorher = await t.G((id) => ({ geld: window.hafenmeister.sim.state.money, offen: window.hafenmeister.sim.state.boats[id]?.pendingFee ?? 0, anzeige: document.getElementById('money')?.textContent }), boot.id);
  // Inzwischen vom Rundgang kassiert? Dann fliegt die Münze gerade weg, Streichen bringt nichts
  if (vorher.offen <= 0) { await t.hinweis('Münze schon kassiert', `Boot ${boot.id}: Rundgang oder Büro war schneller`, { bild: false }); return true; }
  const m = lage.p[0];
  await t.sp.ziehen([{ x: m.x, y: m.y }, { x: m.x + 70, y: m.y + 10 }], { halten: 80, start: 60 });
  const ok = await t.bis(([g]) => window.hafenmeister.sim.state.money > g, [vorher.geld], 5000);
  const nach = await t.G((id) => ({ geld: window.hafenmeister.sim.state.money, offen: window.hafenmeister.sim.state.boats[id]?.pendingFee ?? 0 }), boot.id);
  await t.punkt('Münze mit einem Strich einsammeln', ok && (nach.offen === 0 || nach.geld - vorher.geld >= vorher.offen), `Geld ${Math.round(vorher.geld)} -> ${Math.round(nach.geld)} €, offen vorher ${vorher.offen} €, nachher ${nach.offen} €`, { schwere: 'A' });
  await t.warte(600);
  const anzeige = await t.G(() => document.getElementById('money')?.textContent);
  await t.punkt('Geldanzeige oben zählt mit', anzeige !== vorher.anzeige, `"${vorher.anzeige}" -> "${anzeige}"`);
  const weg = await t.bis((id) => !window.__st.muenzen().includes(String(id)), boot.id, 5000);
  await t.punkt('Münze verschwindet nach dem Einsammeln', weg);
  return ok;
}

async function rundlauf(t, z, opts = {}) {
  const boot = await bootKommt(t, z, opts);
  if (!boot) return null;
  const platz = await ziehenUndAnlegen(t, z, boot);
  if (!platz) return null;
  const ok = await kassieren(t, z, boot);
  await setzeTempo(t, 'normal');
  return ok ? { boot, platz } : null;
}

// Wächter: liegen oder fahren Boote übereinander, über Land oder durch einen Steg? (Momentaufnahme,
// vereinfachte Fassung der Prüfung aus tools/zeitraffer/lauf.cjs)
const BOOTSLAGE = () => {
  const G = window.hafenmeister; const T = G.THREE;
  const gast = new Map((G.boatView?.boote ?? []).map((e) => [e.anim, e.id]));
  const bs = (G.boatAnim?.boats ?? []).filter((a) => a.model?.parent && a.model.visible !== false && a.info).map((a) => ({
    a, id: gast.has(a) ? 'gast-' + gast.get(a) : 'verkehr-' + String(a.model.name || '?').replace(/^verkehr-/, ''),
    st: a.state, x: a.x, z: a.z, h: a.heading, L: a.info.length, B: a.info.beam ?? a.info.length * 0.33 }));
  const ecken = (b, k) => { const c = Math.cos(b.h), s = -Math.sin(b.h); const l = b.L * k / 2, w = b.B * k / 2;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [b.x + c * l * i - s * w * j, b.z + s * l * i + c * w * j]); };
  const sat = (A, B) => { for (const P of [A, B]) for (let i = 0; i < 4; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4]; const nx = y2 - y1, ny = x1 - x2; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } if (a1 < b0 || b1 < a0) return false; } return true; };
  const wasser = (x, z) => (G.landschaft?.istWasser ? G.landschaft.istWasser(x, z) : true);
  const ziele = []; G.stege?.group?.traverse((o) => { if (o.isMesh && o.visible && !(o.material?.transparent && (o.material.opacity ?? 1) < 0.5)) ziele.push(o); });
  const ray = new T.Raycaster();
  const steg = (x, z) => { ray.set(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0)); return ray.intersectObjects(ziele, false).some((h) => h.point.y > 0.15); };
  const out = { n: bs.length, land: [], steg: [], ueber: [] };
  for (const b of bs) {
    const E = ecken(b, 0.85);
    if (E.filter(([x, z]) => !wasser(x, z)).length >= 2) out.land.push(`${b.id} (${b.st})`);
    const ns = E.filter(([x, z]) => steg(x, z)).length;
    if (ns >= 1 && !(b.st === 'moored' && ns === 1)) out.steg.push(`${b.id} (${b.st})`);
  }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (Math.hypot(a.x - b.x, a.z - b.z) > (a.L + b.L) / 2) continue;
    if (sat(ecken(a, 0.85), ecken(b, 0.85))) out.ueber.push(`${a.id} + ${b.id} (${a.st}/${b.st})`);
  }
  return out;
};
async function bootslage(t) {
  const l = await t.G(BOOTSLAGE);
  await t.punkt('Boote nicht übereinander', l.ueber.length === 0, l.ueber.join('; '), { schwere: 'B' });
  await t.punkt('Boote nicht über Land oder im Steg', l.land.length + l.steg.length === 0, [...l.land.map((x) => 'Land ' + x), ...l.steg.map((x) => 'Steg ' + x)].join('; '), { schwere: 'B' });
}

const S3 = {
  nr: 3, name: 'Boot kommt an die Boje', paket: 'P02, P66',
  async neu(t, z) { z.boot = await bootKommt(t, z, { erstes: true }); },
};
const S4 = {
  nr: 4, name: 'Boot auf die Box ziehen und anlegen', paket: 'P02, P03',
  async neu(t, z) { if (z.boot) z.platz = await ziehenUndAnlegen(t, z, z.boot); await setzeTempo(t, 'pause'); await bootslage(t); },
  wieder: bootslage,
};
const S5 = {
  nr: 5, name: 'Münze kassieren', paket: 'P02, P12',
  async neu(t, z) {
    if (z.boot && z.platz) await kassieren(t, z, z.boot);
    await setzeTempo(t, 'normal');
  },
  // Wiederholung: ein ganzes neues Boot von der Boje bis zur Münze
  async wieder(t, z) { await rundlauf(t, z); },
};

// ------------------------------------------------------------------ Schicht 6: Tag und Nacht
async function tagNacht(t, z) {
  await fensterZu(t);
  const d0 = await t.G(() => ({ tag: window.hafenmeister.sim.state.day, phase: window.hafenmeister.sim.state.phase }));
  const tagBild = d0.phase === 'day' ? await leinwandBild(t) : null;
  await setzeTempo(t, 'acht');
  const abend = await t.bis((tag) => window.hafenmeister.sim.state.day > tag || window.hafenmeister.sim.state.phase !== 'day', d0.tag, 240_000);
  if (!abend) { await t.punkt('Abend kommt', false, 'in 4 min Echtzeit kein Abend', { schwere: 'A' }); return; }
  // Abend: etwas warten, dann das Licht messen
  await t.spielzeit(12, 20_000);
  await setzeTempo(t, 'pause');
  const abendBild = await leinwandBild(t);
  const zeit = await t.G(() => document.getElementById('hm-zeit')?.textContent?.replace(/\s+/g, ' ').trim());
  if (tagBild && abendBild) await t.punkt('Abend ist sichtbar dunkler als der Tag', abendBild.hell < tagBild.hell - 4, `Helligkeit Tag ${tagBild.hell.toFixed(0)}, Abend ${abendBild.hell.toFixed(0)}`, { bild: true });
  await setzeTempo(t, 'acht');
  const morgen = await t.bis((tag) => window.hafenmeister.sim.state.day > tag && window.hafenmeister.sim.state.phase === 'day', d0.tag, 240_000);
  await setzeTempo(t, 'normal');
  const zu = await fensterZu(t);
  const d1 = await t.G(() => ({ tag: window.hafenmeister.sim.state.day, text: document.getElementById('hm-zeit')?.textContent?.replace(/\s+/g, ' ').trim() }));
  await t.punkt('neuer Tag beginnt, Anzeige unten zählt mit', morgen && d1.text?.includes(`Tag ${d1.tag}`), `Tag ${d0.tag} -> ${d1.tag}, Anzeige "${d1.text}", abends "${zeit}"${zu.length ? ', geschlossen: ' + zu.join(', ') : ''}`, { schwere: 'A' });
}
const S6 = { nr: 6, name: 'Tag und Nacht', paket: 'P05, P20', neu: tagNacht, wieder: tagNacht };

// ------------------------------------------------------------------ Schicht 7: Speichern und Laden
async function speichernLaden(t, z) {
  await fensterZu(t);
  await setzeTempo(t, 'pause');
  const vorher = await t.G(STAND);
  const ok = await laden(t, z);
  await t.punkt('Spiel lädt nach dem Neuladen der Seite', ok, '', { schwere: 'A' });
  // Nach dem Laden gleich anhalten, damit nichts weiterläuft
  const nach = await t.G(STAND);
  const abw = [];
  for (const k of Object.keys(vorher)) {
    if (k === 'phase') continue;
    // Mehr Geld und neu liegende Boote sind erlaubt: Boote auf dem Weg in die Box liegen nach dem Laden fest
    if (k === 'liegend') { const weg = vorher.liegend.filter((x) => !nach.liegend.includes(x)); if (weg.length) abw.push(`liegend fehlt: ${weg.join(', ')}`); continue; }
    if (k === 'geld' ? nach.geld < vorher.geld - 1 : JSON.stringify(vorher[k]) !== JSON.stringify(nach[k])) abw.push(`${k}: ${JSON.stringify(vorher[k])} -> ${JSON.stringify(nach[k])}`);
  }
  await t.punkt('Spielstand nach dem Neuladen gleich', abw.length === 0, abw.join('; ').slice(0, 400), { schwere: 'A' });
  const einstieg = await t.page.getByRole('button', { name: 'Einstieg beenden' }).isVisible().catch(() => false);
  await t.punkt('Einstieg kommt nach dem Neuladen nicht wieder', !einstieg);
  // Liegende Boote liegen nach dem Laden sichtbar in ihrer Box
  const boxen = await t.G((vor) => {
    const G = window.hafenmeister;
    return G.sim.mooredBoats().filter((b) => vor.includes(`${b.id}@${b.berthId}`)).map((b) => {
      const o = window.__st.bootObjekt(b.id); const p = G.stege?.platz?.(b.berthId);
      const w = o?.getWorldPosition(new G.THREE.Vector3());
      return { id: b.id, platz: b.berthId, abstand: w && p ? +Math.hypot(w.x - p.x, w.z - p.z).toFixed(1) : null };
    }).filter((x) => x.abstand == null || x.abstand > 4);
  }, vorher.liegend);
  await t.punkt('liegende Boote nach dem Laden in ihrer Box', boxen.length === 0, boxen.map((b) => `${b.id}@${b.platz}: ${b.abstand ?? 'nicht sichtbar'}`).join(', '));
  await setzeTempo(t, 'normal');
}
const S7 = { nr: 7, name: 'Speichern und Laden', paket: 'P09', neu: speichernLaden, wieder: speichernLaden };

const SCHICHTEN = [S1, S2, S3, S4, S5, S6, S7];
module.exports = { BOOTSLAGE, SCHICHTEN, setzeTempo, insBild, fensterZu, leinwandBild, rundlauf, laden, STAND, bootKommt, ziehenUndAnlegen, anlegen, kassieren, bootslage, oberflaeche };
