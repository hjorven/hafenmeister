// Bauen mit Vorschau: Baumodus, Umrisse, Geisterbild, Bestaetigen und der Hinweis "Als Naechstes".
//
// Ablauf (docs/bauen.md):
//   1. #btn-build oeffnet den Baumodus: Zeit haelt an, die Kamera zeigt den ganzen Hafen, alle
//      freien Bauplaetze tragen ein Preisschild. Versorgung ohne Gebaeude bekommt einen Umriss an Land.
//   2. Die Bauliste hat vier Reiter: Liegeplaetze, Versorgung, Angebote, Hafen.
//   3. Eintrag oder Bauplatz antippen: Kamera faehrt hin, das Bauwerk steht als Geisterbild da, die
//      Karte zeigt Preis, Nutzen und was die Gaeste zuletzt vermisst haben. Erst "Bauen fuer ..." kauft.
//   4. Ueber dem Bauen-Knopf steht immer genau ein naechster sinnvoller Schritt.
//
// Schnittstelle:
//   game.bauen.oeffnen(reiter?)   Baumodus mit Liste
//   game.bauen.vorschau(key)      Vorschau eines Eintrags, key z. B. 'steg:a-haken', 'versorgung:wc',
//                                 'angebot:bootsverleih', 'hafen:buero', 'hafen:stufe'
//   game.bauen.schliessen()
//   game.bauen.eintraege()        alle Eintraege der aktuellen Lage (auch gesperrte der naechsten Stufe)
//   game.bauen.naechsterSchritt() { text, ziel, leistbar } oder null
//   game.bauen.bedarf()           was die Gaeste zuletzt vermisst haben { weg, offen: { wc: 3 }, belegt, plaetze }
// Ereignisse: bauen:offen, bauen:zu, bauen:vorschau { key }, bauen:gebaut { key, name, kosten }
//
// Gekauft wird nur ueber die Spielregeln (game.sim) und Services (game.services.bauen), die Preise
// kommen aus data/economy.js. Dieses Modul rechnet keine Zahlen selbst.
import { ECONOMY } from '../data/economy.js';
import { HAFEN, platzInWelt } from '../data/harbor.js';
import { baueModell } from '../render/services-models.js';

import { umbauText, euro, num1, WUNSCH, WUNSCH_KURZ, FREI, leer, wirkungText, waehleSchritt, regionsSchritt } from './bauen-rat.js';

const U = 0.62;
const REITER = [
  { id: 'steg', name: 'Stege' },
  { id: 'versorgung', name: 'Versorgung' },
  { id: 'angebot', name: 'Angebote' },
  { id: 'hafen', name: 'Hafen' },
];
function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') e.addEventListener('click', v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kinder.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

export function init(game) {
  const card = document.getElementById('card');
  const buildBtn = document.getElementById('btn-build');
  const root = document.getElementById('game') ?? document.body;
  if (!card || !buildBtn) return;
  const THREE = game.THREE;
  stil();

  // ------------------------------------------------------------------ Bedarf der letzten Tage
  // Liegt im Spielstand unter modules.bauen, damit ein geladener Hafen weiss, was fehlte.
  const speicher = () => {
    const st = game.sim?.state;
    if (!st) return null;
    st.modules ||= {};
    st.modules.bauen ||= { heute: leer(), gestern: leer() };
    st.modules.bauen.heute ||= leer();
    st.modules.bauen.gestern ||= leer();
    return st.modules.bauen;
  };
  function bedarf() {
    const s = speicher();
    if (!s) return leer();
    // Abends gilt schon der heutige Tag, tagsueber der gestrige (plus was heute schon weiterfuhr)
    const b = s.heute.abend ? s.heute : s.gestern;
    // Wuensche werden beim Anlegen und jeden Morgen geprueft (sim.js chargeFee): heute zaehlt mit
    const offen = { ...b.offen };
    for (const [w, n] of Object.entries(s.heute.offen)) offen[w] = Math.max(offen[w] ?? 0, n);
    return { ...b, weg: Math.max(b.weg, s.heute.weg), offen };
  }
  game.on('sim:turnedAway', (e) => {
    const s = speicher();
    if (s && e?.reason !== 'dismissed') s.heute.weg++;
  });
  game.on('sim:feeReady', (e) => {
    const s = speicher();
    const boot = game.sim?.state?.boats?.[e?.boatId];
    if (!s || !boot?.wishes) return;
    const erfuellt = new Set(e.wishesMet ?? []);
    for (const w of boot.wishes) if (!erfuellt.has(w)) s.heute.offen[w] = (s.heute.offen[w] ?? 0) + 1;
  });
  game.on('sim:evening', () => {
    const s = speicher();
    const sim = game.sim;
    if (!s || !sim) return;
    s.heute.abend = true;
    s.heute.belegt = sim.mooredBoats().filter((b) => !b.stationed).length;
    s.heute.plaetze = gastPlaetze().length;
  });
  game.on('day:start', () => {
    const s = speicher();
    if (!s) return;
    s.gestern = s.heute;
    s.heute = leer();
  });

  function gastPlaetze() {
    const sim = game.sim;
    const st = sim.state;
    return sim.ctx.berths.filter((b) => (b.stages ? b.stages.includes(st.stage) : b.stage <= st.stage)
      && (!b.requires || st.buildings[b.requires]) && !b.reserved);
  }

  // ------------------------------------------------------------------ Eintraege
  function stegOrt(id) {
    // Aus dem, was stege.js tatsaechlich als Bauplatz zeichnet (Stegvarianten bleiben richtig)
    const box = new THREE.Box3();
    let n = 0;
    game.stege?.group?.traverse((o) => {
      if (o.userData?.bauplatz === id && o.isMesh) { box.expandByObject(o); n++; }
    });
    if (!n) return null;
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    return { x: c.x, z: c.z, breite: Math.max(s.x, s.z) };
  }

  function gebaeudeOrt(id) {
    const l = game.buildings?.lage?.(id);
    if (!l) return null;
    const b = new THREE.Box3().setFromObject(l.mesh.clone(), true);
    const s = b.getSize(new THREE.Vector3());
    return { x: l.x, z: l.z, y: l.y, dreh: l.dreh, breite: Math.max(s.x, s.z, 6), gebaeude: id, l: s.x, t: s.z };
  }

  function serviceOrt(s, naechste) {
    const lage = s.stufen?.[naechste - 1]?.lage ?? s.lage ?? s.stufen?.[0]?.lage;
    if (!lage) return null;
    return { x: lage.x * U, z: -lage.y * U, dreh: THREE.MathUtils.degToRad(lage.dreh ?? 0), breite: (s.radius ?? 8) * 2, service: s.id };
  }

  // Gebaeude, das zu einer Versorgungsstufe gehoert: das neue (Stufe n) oder das, das ausgebaut wird
  function versorgungGebaeude(key, n) {
    const fk = game.buildings?.fuerKauf;
    if (!fk) return { id: null, neu: false };
    const neu = fk(key === 'office' ? 'office' : key, n)[0];
    if (neu) return { id: neu, neu: true };
    for (let k = n - 1; k >= 1; k--) {
      const alt = fk(key === 'office' ? 'office' : key, k)[0];
      if (alt) return { id: alt, neu: false };
    }
    return { id: null, neu: false };
  }

  function eintraege() {
    const sim = game.sim;
    const st = sim?.state;
    if (!st) return [];
    const rules = sim.ctx.rules;
    const out = [];
    const stufe = st.stage;

    // Liegeplaetze
    const offenIds = new Set(sim.openJettyProjects().map((p) => p.id));
    for (const p of rules.jettyProjects ?? []) {
      if (st.buildings[p.id]) continue;
      const jetzt = offenIds.has(p.id);
      if (!jetzt && p.stage !== stufe + 1) continue;
      const fuer = jetzt ? stufe : p.stage;
      const plaetze = sim.ctx.berths.filter((b) => b.requires === p.id && (b.stages ? b.stages.includes(fuer) : b.stage <= fuer));
      if (!plaetze.length) continue;
      const groessen = [...new Set(plaetze.map((b) => b.size))].sort((a, b) => 'S M L XL XXL'.indexOf(a) - 'S M L XL XXL'.indexOf(b));
      const lang = Math.max(...plaetze.map((b) => b.maxLength ?? 0));
      const strom = plaetze.some((b) => b.power);
      out.push({
        key: `steg:${p.id}`, art: 'steg', id: p.id, name: p.name, kosten: p.cost,
        gesperrt: jetzt ? null : `ab Ausbaustufe ${p.stage}`,
        plaetzeNeu: plaetze.length,
        kurz: plaetze.length === 1 ? '+1 Platz' : `+${plaetze.length} Plätze`,
        nutzen: [
          `${plaetze.length === 1 ? 'Ein neuer Liegeplatz' : `${plaetze.length} neue Liegeplätze`} für Boote der Größe ${groessen.join(', ')}${lang ? `, bis ${num1(lang)} m lang` : ''}.`,
          strom ? 'Mit Strom am Platz, das erfüllt den Wunsch nach Strom.' : null,
        ].filter(Boolean),
        ort: jetzt ? () => stegOrt(p.id) : null,
        kaufen: () => sim.buildJettyProject(p.id),
      });
    }

    // Versorgung
    for (const key of Object.keys(rules.facilities)) {
      const u = sim.facilityUpgrade(key);
      if (!u || u.reason === 'max') continue;
      const f = rules.facilities[key];
      if (u.reason === 'stage' && f.fromStage[u.level] !== stufe + 1) continue;
      const name = f.names?.[u.level] ?? `${rules.facilityNames?.[key] ?? key} Stufe ${u.level}`;
      const jetzt = f.levels[u.level - 1] ?? 0;
      const neu = f.levels[u.level] ?? 0;
      const nutzen = [];
      let wunsch = key;
      let ort = null;
      if (key === 'strom') {
        const stege = ECONOMY.bauwerke?.strom?.stufen?.[u.level - 1]?.stege ?? [];
        wunsch = 'strom';
        nutzen.push(`Strom an Steg ${stege.join(', ')}: Gäste dort bekommen ihren Wunsch nach Strom erfüllt.`);
        ort = () => {
          const ids = gastPlaetze().filter((b) => stege.includes(b.jetty)).map((b) => b.id);
          const pl = ids.map((id) => game.stege?.platz?.(id)).filter(Boolean);
          if (!pl.length) return null;
          const xs = pl.map((p) => p.x), zs = pl.map((p) => p.z);
          return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2,
            breite: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 20), plaetze: ids };
        };
      } else {
        nutzen.push(jetzt ? `Versorgt ${neu} Boote am Tag statt ${jetzt}.` : `Versorgt ${neu} Boote am Tag.`);
        nutzen.push(`Jeder erfüllte Wunsch bringt ${Math.round((ECONOMY.wunschBonus ?? 0.25) * 100)} % mehr Hafengeld und bessere Bewertungen.`);
        const g = versorgungGebaeude(key, u.level);
        if (g.id) ort = () => ({ ...gebaeudeOrt(g.id), neu: g.neu });
      }
      out.push({
        key: `versorgung:${key}`, art: 'versorgung', id: key, name, kosten: u.cost, wunsch, stufeNeu: u.level,
        gesperrt: u.reason === 'stage' ? `ab Ausbaustufe ${f.fromStage[u.level]}` : null,
        kurz: WUNSCH_KURZ[key] ?? '',
        nutzen, ort,
        kaufen: () => sim.upgradeFacility(key),
      });
    }

    // Angebote (Services)
    for (const x of game.services?.liste?.() ?? []) {
      const p = x.naechste;
      if (!p || p.fertig || !p.def) continue;
      const s = game.services.katalog?.find((k) => k.id === x.id);
      const w = wirkungText(p.def.wirkung);
      out.push({
        key: `angebot:${x.id}`, art: 'angebot', id: x.id, name: x.stufe > 0 ? p.def.name : x.name, kosten: p.kosten,
        ausbau: x.stufe > 0,
        gesperrt: p.freigeschaltet ? null : `braucht ${p.fehlt.join(', ')}`,
        kurz: '',
        nutzen: [x.kurz, w].filter(Boolean),
        ort: s ? () => serviceOrt(s, p.stufe) : null,
        modell: s ? { id: x.id, stufe: p.stufe } : null,
        kaufen: () => game.services.bauen(x.id),
      });
    }

    // Hafenbuero
    const o = rules.office;
    const next = st.office + 1;
    if (o.cost[next] && o.fromStage[next] <= stufe + 1) {
      const def = ECONOMY.hafenbuero?.stufen?.[next - 1];
      const g = versorgungGebaeude('office', next);
      out.push({
        key: 'hafen:buero', art: 'hafen', id: 'buero', name: o.names?.[next] ?? `Hafenbüro Stufe ${next}`, kosten: o.cost[next],
        gesperrt: stufe < o.fromStage[next] ? `ab Ausbaustufe ${o.fromStage[next]}` : null,
        kurz: '',
        nutzen: (def?.schaltetFrei ?? []).map((k) => FREI[k]).filter(Boolean),
        ort: g.id ? () => ({ ...gebaeudeOrt(g.id), neu: g.neu }) : null,
        kaufen: () => sim.upgradeOffice(),
      });
    }

    // Naechste Ausbaustufe
    const adv = sim.canAdvanceStage();
    if (adv.goal) {
      const jetzt = ECONOMY.stufen?.find((s) => s.stufe === stufe);
      const dann = ECONOMY.stufen?.find((s) => s.stufe === stufe + 1);
      const nutzen = [];
      const plaetze = jetzt?.ausbau?.plaetze?.length ?? 0;
      if (plaetze) nutzen.push(`${plaetze === 1 ? 'Ein neuer Platz' : `${plaetze} neue Plätze`} und neue Bauplätze für Stege.`);
      if (dann) {
        nutzen.push(`Etwa ${dann.ankuenfte} Boote am Tag statt ${jetzt?.ankuenfte ?? '?'}.`);
        const neuGr = Object.keys(dann.mix).filter((k) => !(k in (jetzt?.mix ?? {})));
        if (neuGr.length) nutzen.push(`Jetzt kommen auch Boote der Größe ${neuGr.join(', ')}.`);
      }
      // Ausbau in Bauabschnitten (Roadmap P18): einzeln bezahlt, jeder Abschnitt wird ueber Nacht gebaut
      const ab = ausbauStand();
      const mehr = !!ab && ab.n > 1;
      const begonnen = mehr && (ab.fertig > 0 || ab.imBau);
      const fehlt = [];
      if (!begonnen && adv.missing.includes('guests')) fehlt.push(`${adv.goal.guests - adv.guests} Gäste`);
      if (!begonnen && adv.missing.includes('reputation')) fehlt.push(`Ruf ${num1(adv.goal.reputation)}`);
      if (mehr) {
        nutzen.push(ab.imBau
          ? `Baustelle läuft: Abschnitt ${ab.fertig + 1} von ${ab.n} ist morgen früh fertig.`
          : `Gebaut wird in ${ab.n} Abschnitten, jeder einzeln bezahlt und über Nacht fertig.`);
      }
      const fortschritt = begonnen
        ? [{ name: 'Bauabschnitte fertig', ist: ab.fertig, soll: ab.n, text: `${ab.fertig} von ${ab.n}` }]
        : [
          { name: 'Zufriedene Gäste in dieser Stufe', ist: adv.guests, soll: adv.goal.guests, text: `${adv.guests} von ${adv.goal.guests}` },
          { name: 'Ruf', ist: adv.reputation, soll: adv.goal.reputation, text: `${num1(adv.reputation)} von ${num1(adv.goal.reputation)}` },
        ];
      const nr = mehr ? Math.min(ab.n, ab.fertig + 1) : 1;
      out.push({
        key: 'hafen:stufe', art: 'hafen', id: 'stufe',
        name: mehr ? `${adv.goal.name ?? 'Hafen erweitern'}, Abschnitt ${nr} von ${ab.n}` : adv.goal.name ?? 'Hafen erweitern',
        kosten: mehr ? ab.teile[nr - 1] : adv.goal.cost,
        gesamt: mehr ? adv.goal.cost : null,
        begonnen,
        gesperrt: mehr && ab.imBau ? 'Baustelle läuft, morgen früh weiter' : fehlt.length ? `fehlt: ${fehlt.join(', ')}` : null,
        kurz: 'Ausbaustufe',
        fortschritt,
        nutzen,
        ort: () => { const o = ab && baustellenOrt(ab); return o ? { x: o.x, z: o.z, y: o.y, breite: 30 } : null; },
        kaufen: mehr ? abschnittKaufen : () => sim.advanceStage(),
      });
    }
    return out;
  }

  function naechsterSchritt() {
    const sim = game.sim;
    if (!sim?.state) return null;
    const adv = sim.canAdvanceStage();
    const spar = sparSchritt(sparziel(), sim.state.money);
    if (spar) return spar;
    const region = sim.regionGoal?.();
    const r = waehleSchritt({ geld: sim.state.money, eintraege: eintraege(), bedarf: bedarf(), stufe: adv.goal ? adv : null, region });
    return r ?? regionsSchritt(region);
  }

  // ------------------------------------------------------------------ Letzten Kauf zuruecknehmen (P18, Bed P7)
  // Solange die Karte "ist gebaut" steht (Zeit steht im Baumodus still), stellt ein Tipp den Zustand von
  // vor dem Kauf wieder her: Kasse, Ausgaben des Tages, Stege, Versorgung, Hafenbuero, Angebote, Bauabschnitt.
  const RUECK_MS = 10000;
  let rueck = null;
  const ersetze = (ziel, quelle) => { for (const k of Object.keys(ziel)) delete ziel[k]; Object.assign(ziel, quelle); };
  function schnappschuss(e) {
    const st = game.sim.state;
    try {
      return {
        key: e.key, money: st.money, office: st.office,
        buildings: { ...st.buildings }, facilities: { ...st.facilities },
        // Erster Kauf des Tages: stats.heute entsteht erst beim Bezahlen, vorher waren die Ausgaben leer
        heuteTag: st.day, ausgaben: st.stats?.heute?.tag === st.day && st.stats.heute.ausgaben ? structuredClone(st.stats.heute.ausgaben) : {},
        services: st.modules?.services ? structuredClone(st.modules.services) : null,
        ausbau: speicher()?.ausbau ? structuredClone(speicher().ausbau) : null,
      };
    } catch { return null; }
  }
  const rueckRest = () => (rueck ? Math.ceil((rueck.bis - performance.now()) / 1000) : 0);
  const rueckText = () => `Rückgängig (${Math.max(0, rueckRest())} s)`;
  function zuruecknehmen() {
    const u = rueck;
    rueck = null;
    if (!u || performance.now() > u.bis) { zeichne(); return; }
    const st = game.sim.state;
    const geaendert = [];
    for (const [alt, jetzt] of [[u.buildings, st.buildings], [u.facilities, st.facilities]]) {
      for (const k of new Set([...Object.keys(alt), ...Object.keys(jetzt)])) if ((alt[k] || 0) !== (jetzt[k] || 0)) geaendert.push({ id: k, level: alt[k] || 0 });
      ersetze(jetzt, alt);
    }
    st.money = u.money;
    st.office = u.office;
    if (st.stats?.heute && st.stats.heute.tag === u.heuteTag) st.stats.heute.ausgaben = u.ausgaben;
    if (u.services && st.modules?.services) { ersetze(st.modules.services, u.services); game.services?.neuZeichnen?.(); }
    speicher().ausbau = u.ausbau;
    zeigeBaustelle();
    for (const g of geaendert) game.emit('build', g);
    if (!geaendert.length) game.emit('build', {});
    game.emit('sim:change', { reason: 'undo' });
    game.emit('bauen:zurueck', { key: u.key, kosten: u.kosten });
    game.audio?.sfx?.('abbrechen');
    fertig = null;
    meldung = `${u.name} zurückgenommen, ${euro(u.kosten)} sind wieder in der Kasse.`;
    zeichne();
    requestAnimationFrame(uebersicht);
  }
  // Zaehler im Knopf, danach verschwindet er
  setInterval(() => {
    if (!rueck) return;
    const b = card.querySelector('.bau-rueck');
    if (rueckRest() <= 0 || !offen || !fertig) { rueck = null; b?.remove(); return; }
    if (b) b.textContent = rueckText();
  }, 250);

  // ------------------------------------------------------------------ Sparziel (P18, D7)
  // Was man sich noch nicht leisten kann, laesst sich anheften: Balken am Geld, Schild am Bauplatz,
  // "Als Naechstes" zeigt den Stand. Gebaut oder nicht mehr im Bauplan: das Sparziel faellt weg.
  function sparziel() {
    const key = speicher()?.sparziel;
    if (!key) return null;
    const e = eintraege().find((x) => x.key === key);
    if (!e) { speicher().sparziel = null; return null; }
    return e;
  }
  function setzeSparziel(key) {
    const s = speicher();
    if (!s) return;
    s.sparziel = s.sparziel === key ? null : key;
    game.audio?.sfx?.(s.sparziel ? 'auswahl' : 'abbrechen');
    game.emit('bauen:sparziel', { key: s.sparziel });
    zeigeSparziel();
    zeichne();
    setzeTipp();
  }
  function sparSchritt(e, geld) {
    if (!e || e.gesperrt) return null;
    if (e.kosten <= geld) return { text: `Sparziel erreicht: ${e.name} bauen.`, ziel: e.key, leistbar: true };
    const pct = Math.floor((geld / e.kosten) * 100);
    return { text: `Sparziel ${e.name}: noch ${euro(e.kosten - geld)} (${pct} %).`, ziel: e.key, leistbar: false };
  }
  const sparBalken = el('span', { class: 'bau-sparbalken', hidden: true, 'aria-hidden': 'true' }, el('span'));
  const sparSchild = el('button', { type: 'button', class: 'bau-schild bau-sparschild', hidden: true, tabindex: '-1',
    onclick: (ev) => { ev.stopPropagation(); const k = speicher()?.sparziel; if (k) vorschau(k); } });
  root.append(sparSchild);
  let sparErreicht = false;
  function zeigeSparziel() {
    const e = sparziel();
    const geld = game.sim?.state?.money ?? 0;
    const status = document.getElementById('money')?.closest('.hm-status') ?? document.getElementById('money')?.parentElement;
    if (status && sparBalken.parentElement !== status) status.append(sparBalken);
    sparBalken.hidden = !e;
    sparSchild.hidden = !e;
    if (!e) { sparErreicht = false; return; }
    const anteil = Math.min(1, geld / e.kosten);
    sparBalken.firstChild.style.width = `${Math.round(anteil * 100)}%`;
    sparBalken.classList.toggle('voll', anteil >= 1);
    sparBalken.title = `Sparziel ${e.name}: ${euro(Math.min(geld, e.kosten))} von ${euro(e.kosten)}`;
    sparSchild.replaceChildren(el('span', { class: 'bau-schild-name' }, `Sparziel: ${e.name}`), el('span', { class: 'bau-schild-preis' }, `${euro(Math.min(geld, e.kosten))} von ${euro(e.kosten)}`));
    sparSchild.classList.toggle('empfohlen', anteil >= 1);
    if (anteil >= 1 && !sparErreicht && !e.gesperrt) game.audio?.sfx?.('fertig');
    sparErreicht = anteil >= 1;
  }
  function setzeSparSchild() {
    if (sparSchild.hidden) return;
    const e = sparziel();
    const o = e?.ort?.();
    const aus = offen || !o || document.body.classList.contains('card-open') || document.body.classList.contains('foto');
    sparSchild.style.display = aus ? 'none' : '';
    if (aus) return;
    const c = game.canvas.getBoundingClientRect();
    _v.set(o.x, (o.y ?? 0) + 3, o.z).project(rig.camera);
    const sx = (_v.x + 1) / 2 * c.width, sy = (1 - _v.y) / 2 * c.height;
    const { f, hindernisse } = freierBereich(c);
    const w = sparSchild.offsetWidth || 120, h = sparSchild.offsetHeight || 34;
    const box = { l: sx - w / 2, t: sy - h, r: sx + w / 2, b: sy };
    const sichtbar = box.l >= f.l && box.r <= f.r && box.t >= f.t && box.b <= f.b && !hindernisse.some((x) => schneidet(box, x)) && !schneidet(box, tipp.hidden ? {} : rechteck(tipp, c));
    sparSchild.style.visibility = sichtbar ? '' : 'hidden';
    sparSchild.style.transform = `translate(${Math.round(box.l)}px, ${Math.round(box.t)}px)`;
    sparSchild.style.setProperty('--zeiger-x', `${Math.round(w / 2)}px`);
  }
  const rechteck = (elem, c) => { const r = elem.getBoundingClientRect(); return { l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top }; };

  // ------------------------------------------------------------------ Ausbau in Bauabschnitten (P18)
  // ECONOMY.stufen[].ausbau.bautage = Naechte Bauzeit = Zahl der Abschnitte (hoechstens drei). Jeder
  // Abschnitt wird einzeln bezahlt, steht abends als Baustelle im Hafen und ist morgens fertig. Nach dem
  // letzten Abschnitt schliesst game.sim.advanceStage({ prepaid: true }) den Ausbau ab.
  function ausbauPlan() {
    const st = game.sim?.state;
    const a = ECONOMY.stufen?.find((x) => x.stufe === st?.stage)?.ausbau;
    if (!a) return null;
    const n = Math.max(1, Math.min(3, Math.round(a.bautage ?? 1)));
    const teile = [];
    let rest = a.kosten;
    for (let i = 0; i < n; i++) {
      const k = i === n - 1 ? rest : Math.round(a.kosten / n / 100) * 100;
      teile.push(k);
      rest -= k;
    }
    return { stufe: st.stage, id: a.id, name: a.name, plaetze: a.plaetze ?? [], n, teile };
  }
  function ausbauStand() {
    const p = ausbauPlan();
    if (!p) return null;
    const a = speicher()?.ausbau;
    const stand = a?.stufe === p.stufe ? a : { stufe: p.stufe, fertig: 0, imBau: false, bezahlt: 0 };
    return { ...p, fertig: stand.fertig, imBau: !!stand.imBau, bezahlt: stand.bezahlt || 0 };
  }
  function abschnittKaufen() {
    const ab = ausbauStand();
    if (!ab || ab.imBau || ab.fertig >= ab.n) return { ok: false };
    const kosten = ab.teile[ab.fertig];
    if (!game.sim.spend(kosten, 'ausbau')) return { ok: false, geldFehlt: true };
    speicher().ausbau = { stufe: ab.stufe, fertig: ab.fertig, imBau: true, bezahlt: ab.bezahlt + kosten };
    zeigeBaustelle();
    game.emit('bauen:abschnitt', { stufe: ab.stufe, abschnitt: ab.fertig + 1, von: ab.n, kosten });
    return { ok: true, abschnitt: ab.fertig + 1, von: ab.n };
  }
  // Morgens: der Abschnitt von gestern Abend ist fertig, der letzte schliesst den Ausbau ab
  function abschnittFertig() {
    const ab = ausbauStand();
    if (!ab?.imBau) return;
    const fertig = ab.fertig + 1;
    const ort = baustellenOrt(ab);
    if (fertig >= ab.n) {
      speicher().ausbau = null;
      const r = game.sim.advanceStage({ prepaid: true });
      if (!r?.ok) speicher().ausbau = { stufe: ab.stufe, fertig: ab.n - 1, imBau: true, bezahlt: ab.bezahlt };
    } else {
      speicher().ausbau = { stufe: ab.stufe, fertig, imBau: false, bezahlt: ab.bezahlt };
      if (ort) { welle(ort.x, ort.z, ort.y); fliege(`Abschnitt ${fertig} von ${ab.n} fertig`, ort.x, ort.y, ort.z); }
      game.audio?.sfx?.('bauen');
      game.emit('bauen:abschnittFertig', { stufe: ab.stufe, abschnitt: fertig, von: ab.n });
    }
    zeigeBaustelle();
    setzeTipp();
  }

  // Lage der Baustelle: Mitte der Plaetze, die der Ausbau bringt (Lage in der naechsten Stufe)
  function baustellenOrt(ab) {
    const pts = [];
    for (const id of ab.plaetze) {
      const pl = HAFEN.plaetze.find((x) => x.id === id);
      const w = pl && platzInWelt(pl, ab.stufe + 1);
      if (w) pts.push(w);
    }
    if (!pts.length) return null;
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const z = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    const h = game.landschaft?.hoeheBei?.(x, z);
    return { x, z, y: Number.isFinite(h) ? Math.max(0, h) : 0, pts };
  }

  // Baustelle im Bild: fertige Abschnitte zeigen schon Dalben an ihren Plaetzen, der laufende Abschnitt
  // einen Kran auf einem Ponton und Baken. So waechst der Ausbau sichtbar.
  let baustelle = null;
  const bauMat = {
    holz: new THREE.MeshLambertMaterial({ color: '#6b4a2f' }),
    gelb: new THREE.MeshLambertMaterial({ color: '#e8b02c' }),
    ponton: new THREE.MeshLambertMaterial({ color: '#5d6770' }),
    rot: new THREE.MeshLambertMaterial({ color: '#d4543a' }),
    weiss: new THREE.MeshLambertMaterial({ color: '#f4efe4' }),
  };
  function zeigeBaustelle() {
    if (baustelle) { welt.remove(baustelle); baustelle.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); baustelle = null; }
    const ab = ausbauStand();
    if (!ab || ab.n <= 1 || (!ab.imBau && !ab.fertig)) return;
    const ort = baustellenOrt(ab);
    if (!ort) return;
    baustelle = new THREE.Group();
    baustelle.name = 'bauen-baustelle';
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); baustelle.add(m); return m; };
    // Dalben: je fertigem Abschnitt der passende Anteil der neuen Plaetze
    const anteil = Math.round((ort.pts.length * ab.fertig) / ab.n);
    for (const p of ort.pts.slice(0, anteil)) {
      const h = game.landschaft?.hoeheBei?.(p.x, p.z);
      const unten = Number.isFinite(h) ? Math.min(0, h) : -1;
      for (const s of [-1, 1]) {
        const dx = Math.cos(p.winkel + Math.PI / 2) * 1.6 * s, dz = -Math.sin(p.winkel + Math.PI / 2) * 1.6 * s;
        box(0.35, 2.2 - unten, 0.35, bauMat.holz, p.x + dx, (2.2 + unten) / 2, p.z + dz);
      }
    }
    if (ab.imBau) {
      const wasser = !(ort.y > 0.05);
      const y0 = wasser ? 0.35 : ort.y;
      if (wasser) box(7, 0.6, 4.5, bauMat.ponton, ort.x, 0.1, ort.z);
      box(0.5, 9, 0.5, bauMat.gelb, ort.x - 2, y0 + 4.5, ort.z);           // Kranmast
      const arm = box(8, 0.4, 0.4, bauMat.gelb, ort.x + 1.5, y0 + 8.8, ort.z);
      arm.userData.kranarm = true;
      box(0.15, 4, 0.15, bauMat.weiss, ort.x + 5, y0 + 6.8, ort.z);         // Seil
      for (let i = 0; i < 4; i++) {                                          // Baken
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const bx = ort.x + Math.cos(a) * 5, bz = ort.z + Math.sin(a) * 3.6;
        box(0.3, 1.2, 0.3, i % 2 ? bauMat.rot : bauMat.weiss, bx, y0 + 0.6, bz);
      }
    }
    welt.add(baustelle);
  }
  game.on('day:start', abschnittFertig);
  game.on('spielstand-geladen', () => setTimeout(zeigeBaustelle, 0));
  game.on('stufe', () => zeigeBaustelle());
  game.on('ready', zeigeBaustelle);

  // ------------------------------------------------------------------ 3D: Geisterbild, Umrisse, Effekte
  const welt = new THREE.Group();
  welt.name = 'bauen';
  game.scene.add(welt);
  const geistMat = new THREE.MeshBasicMaterial({ color: '#7fe0c4', transparent: true, opacity: 0.5, depthWrite: false });
  const stegMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.55, depthWrite: false });
  const randMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 });
  const flaecheMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false });
  let geist = null;
  let umrisse = null;

  function alsGeist(obj, material) {
    obj.traverse((o) => {
      if (o.isMesh) { o.material = material; o.renderOrder = 12; o.castShadow = false; delete o.userData.pick; }
      if (o.isLine || o.isLineSegments) o.visible = false;
    });
    delete obj.userData.pick;
    return obj;
  }

  function zeigeGeist(e, ort) {
    entferneGeist();
    if (!ort) return;
    geist = new THREE.Group();
    geist.name = 'bauen-geist';
    if (e.art === 'steg') {
      game.stege?.group?.traverse((o) => {
        if (o.userData?.bauplatz !== e.id || !o.isMesh) return;
        const m = new THREE.Mesh(o.geometry, stegMat);
        o.updateWorldMatrix(true, false);
        m.applyMatrix4(o.matrixWorld);
        m.position.y += 0.06;
        m.renderOrder = 12;
        geist.add(m);
      });
    } else if (e.modell) {
      const m = baueModell(e.modell.id, e.modell.stufe);
      const g = alsGeist(m.group, geistMat);
      const h = game.landschaft?.hoeheBei?.(ort.x, ort.z);
      g.position.set(ort.x, Number.isFinite(h) ? Math.max(0, Math.min(1, h - 0.3)) : 0, ort.z);
      g.rotation.y = ort.dreh ?? 0;
      geist.add(g);
    } else if (ort.gebaeude) {
      const l = game.buildings.lage(ort.gebaeude);
      const g = alsGeist(l.mesh.clone(true), geistMat);
      g.position.set(l.x, l.y, l.z);
      g.rotation.y = l.dreh;
      if (!ort.neu) g.scale.setScalar(1.06);    // Ausbau: Huelle um das stehende Gebaeude
      geist.add(g);
    } else if (ort.plaetze) {
      game.stege?.highlight?.(ort.plaetze, '#ffd23f');
    }
    // Ring auf dem Boden, damit man die Stelle auch von weitem findet
    const r = Math.max(4, (ort.breite ?? 10) * 0.6);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
    const h = game.landschaft?.hoeheBei?.(ort.x, ort.z);
    ring.position.set(ort.x, (Number.isFinite(h) ? Math.max(0, h) : 0) + 0.15, ort.z);
    ring.renderOrder = 11;
    ring.userData.ring = true;
    geist.add(ring);
    welt.add(geist);
  }

  function entferneGeist() {
    if (geist) {
      welt.remove(geist);
      geist.traverse((o) => { if (o.userData?.ring) o.geometry.dispose(); });
      geist = null;
    }
    game.stege?.highlight?.([]);
  }

  // Umrisse an Land fuer Versorgung und Hafenbuero, die noch kein Gebaeude haben
  function zeigeUmrisse(liste) {
    entferneUmrisse();
    umrisse = new THREE.Group();
    umrisse.name = 'bauen-umrisse';
    for (const e of liste) {
      if (e.gesperrt || !(e.art === 'versorgung' || e.key === 'hafen:buero')) continue;
      const o = e.ort?.();
      if (!o?.gebaeude || !o.neu) continue;
      const l = (o.l || 6) + 1.5, t = (o.t || 6) + 1.5;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(l, t).rotateX(-Math.PI / 2), flaecheMat);
      fl.position.set(o.x, (o.y ?? 0.3) + 0.08, o.z);
      fl.rotation.y = o.dreh ?? 0;
      fl.renderOrder = 3;
      fl.userData.pick = { type: 'buildsite', id: e.key };
      const rand = new THREE.LineSegments(new THREE.EdgesGeometry(fl.geometry), randMat);
      fl.add(rand);
      umrisse.add(fl);
    }
    welt.add(umrisse);
  }
  function entferneUmrisse() {
    if (!umrisse) return;
    welt.remove(umrisse);
    umrisse.traverse((o) => o.geometry?.dispose());
    umrisse = null;
  }

  // Wasser- oder Staubring nach dem Bauen
  const wellen = [];
  function welle(x, z, y = 0) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(x, y + 0.12, z);
    m.renderOrder = 11;
    welt.add(m);
    wellen.push({ m, t: 0 });
  }

  // Gebaeude wachsen nach dem Kauf aus dem Boden
  const wachsen = [];

  // ------------------------------------------------------------------ Kamera
  const rig = game.camera;
  let fahrt = null;
  function fahre(x, z, breite) {
    if (!rig) return;
    fahrt = { x, z, w: Math.max(rig.minWidth ?? 15, Math.min(rig.maxWidth ?? 420, breite)) };
  }
  // Stelle so anfahren, dass sie mitten im freien Bereich neben bzw. ueber der Karte liegt
  function zeigeOrt(ort) {
    if (!rig?.screenToWorld || !ort) return;
    const w = Math.max(80, Math.min(160, (ort.breite ?? 20) * 2.6));
    const sw = rig.screenW, sh = rig.screenH;
    const r = card.hidden ? null : card.getBoundingClientRect();
    const c = game.canvas.getBoundingClientRect();
    let fx = sw / 2, fy = sh / 2;
    if (r && r.width < sw * 0.6) fx = (r.left - c.left) / 2;                 // Karte rechts (PC, Tablet quer)
    else if (r) fy = Math.max(60, (r.top - c.top) / 2 + 30);                 // Karte unten (Handy)
    const a = rig.screenToWorld(sw / 2, sh / 2), b = rig.screenToWorld(fx, fy);
    const k = w / rig.viewWidth;
    fahre(ort.x + (a.x - b.x) * k, ort.z + (a.z - b.z) * k, w);
  }
  // Rechteck um alle freien Bauplaetze (Stege, Angebote, Versorgung), um es ins Bild zu holen
  function bauplatzRahmen() {
    const pkt = [];
    for (const e of eintraege()) {
      if (e.gesperrt || !e.ort) continue;
      const o = e.ort();
      if (o) pkt.push(o);
    }
    if (!pkt.length) return null;
    const xs = pkt.map((o) => o.x), zs = pkt.map((o) => o.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, b: x1 - x0 + 30, t: z1 - z0 + 30 };
  }

  function uebersicht() {
    if (!rig?.reset) return;
    const alt = { x: rig.target.x, z: rig.target.z, w: rig.viewWidth, yaw: rig.yaw };
    // Den Hafen in den Bereich neben bzw. ueber der Karte einpassen
    const ins = { ...(rig.insets ?? { top: 0, bottom: 0 }) }, rechts = rig.insetRight ?? 0;
    const r = card.hidden ? null : card.getBoundingClientRect();
    const c = game.canvas.getBoundingClientRect();
    // Handy hochkant: Die Liste ist kompakt (eine Zeile je Eintrag), darueber liegt der Hafen.
    // Statt des ganzen Hafens (der waere winzig) nur die Bauplaetze einpassen.
    if (r && r.width >= rig.screenW * 0.6) {
      const ziel = bauplatzRahmen();
      if (ziel) {
        const freiH = Math.max(80, r.top - c.top - (ins.top || 0) - 16);
        // Sichtbare Tiefe = freie Hoehe in Metern / sin(Neigung 50 Grad)
        const breite = Math.max(ziel.b * 1.15, ziel.t * 1.15 * Math.sin(0.873) * rig.screenW / freiH, 60);
        rig.yaw = alt.yaw;
        const fy = (ins.top || 0) + freiH / 2 + 8;
        const a = rig.screenToWorld(rig.screenW / 2, rig.screenH / 2), b = rig.screenToWorld(rig.screenW / 2, fy);
        const k = breite / rig.viewWidth;
        fahrt = { x: ziel.x + (a.x - b.x) * k, z: ziel.z + (a.z - b.z) * k, w: Math.min(rig.maxWidth ?? 420, breite) };
        return;
      }
    }
    // Handy quer: wenig Hoehe, die Karte rechts. Auch hier nur die Bauplaetze einpassen, links neben der
    // Karte und ueber der Zeitleiste.
    if (r && r.width < rig.screenW * 0.6 && rig.screenH < 500) {
      const ziel = bauplatzRahmen();
      const zeitR = document.getElementById('hm-zeit')?.getBoundingClientRect();
      if (ziel) {
        const links = 8;
        const oben = Math.max(ins.top || 0, (document.getElementById('hud-top')?.getBoundingClientRect().bottom ?? 0) - c.top + 4);
        const unten = zeitR?.height ? zeitR.top - c.top - 6 : rig.screenH - 8;
        const freiW = Math.max(120, r.left - c.left - links - 12);
        const freiH = Math.max(80, unten - oben);
        const breite = Math.max(ziel.b * 1.2 * rig.screenW / freiW, ziel.t * 1.2 * Math.sin(0.873) * rig.screenW / freiH, 60);
        rig.yaw = alt.yaw;
        const fx = links + freiW / 2, fy = oben + freiH / 2;
        const a = rig.screenToWorld(rig.screenW / 2, rig.screenH / 2), b = rig.screenToWorld(fx, fy);
        const k = breite / rig.viewWidth;
        fahrt = { x: ziel.x + (a.x - b.x) * k, z: ziel.z + (a.z - b.z) * k, w: Math.min(rig.maxWidth ?? 420, breite) };
        return;
      }
    }
    if (r && r.width < rig.screenW * 0.6) rig.insetRight = Math.max(rechts, c.right - r.left + 8);
    else if (r) rig.insets = { top: ins.top, bottom: Math.max(ins.bottom, c.bottom - r.top + 8) };
    rig.reset();
    rig.insets = ins;
    rig.insetRight = rechts;
    const ziel = { x: rig.target.x, z: rig.target.z, w: rig.viewWidth };
    rig.yaw = alt.yaw;
    rig.target.x = alt.x; rig.target.z = alt.z; rig.viewWidth = alt.w;
    rig._apply?.();
    fahrt = ziel;
  }
  game.canvas.addEventListener('pointerdown', () => { fahrt = null; }, { passive: true });
  game.canvas.addEventListener('wheel', () => { fahrt = null; }, { passive: true });

  // ------------------------------------------------------------------ Preisschilder ueber Bauplaetzen
  const schilder = el('div', { class: 'bau-schilder', 'aria-hidden': 'true' });
  root.append(schilder);
  let schildListe = [];
  function zeigeSchilder(liste) {
    schilder.replaceChildren();
    schildListe = [];
    const geld = game.sim?.state?.money ?? 0;
    for (const e of liste) {
      if (e.gesperrt || !e.ort) continue;
      const o = e.ort();
      if (!o) continue;
      const s = el('button', { type: 'button', class: `bau-schild${e.kosten > geld ? ' teuer' : ''}${e.key === tippZiel ? ' empfohlen' : ''}`, tabindex: '-1',
        onclick: (ev) => { ev.stopPropagation(); vorschau(e.key); } },
        el('span', { class: 'bau-schild-name' }, e.name), el('span', { class: 'bau-schild-preis' }, euro(e.kosten)));
      schilder.append(s);
      schildListe.push({ s, p: new THREE.Vector3(o.x, (o.y ?? 0) + 3, o.z), prio: e.key === tippZiel ? 1 : 0 });
    }
  }
  const _v = new THREE.Vector3();
  // Freier Bildbereich (ohne Karte und obere Leiste) und Knoepfe, denen Schilder ausweichen
  function freierBereich(c) {
    const f = { l: 8, t: 8, r: c.width - 8, b: c.height - 8 };
    const top = document.getElementById('hud-top')?.getBoundingClientRect();
    if (top && top.height) f.t = Math.max(f.t, top.bottom - c.top + 6);
    if (!card.hidden) {
      const k = card.getBoundingClientRect();
      if (k.width < c.width * 0.6) f.r = Math.min(f.r, k.left - c.left - 8);
      else f.b = Math.min(f.b, k.top - c.top - 8);
    }
    // Untere Leiste mit Hintergrund (PC): Schilder bleiben darueber
    const unten = document.getElementById('hud-bottom');
    const ur = unten?.getBoundingClientRect();
    if (ur && ur.height && ur.width > c.width * 0.6 && getComputedStyle(unten).backgroundColor !== 'rgba(0, 0, 0, 0)') f.b = Math.min(f.b, ur.top - c.top - 6);
    const hindernisse = [...root.querySelectorAll('button, .stat, .hm-tafel, .hm-px, .hm-tipp')]
      .filter((e) => !card.contains(e) && !schilder.contains(e) && e !== tipp && e !== sparSchild && e.offsetParent)
      .map((e) => { const r = e.getBoundingClientRect(); return { l: r.left - c.left - 4, t: r.top - c.top - 4, r: r.right - c.left + 4, b: r.bottom - c.top + 4 }; })
      .filter((r) => r.r > r.l);
    return { f, hindernisse };
  }

  const schneidet = (a, o) => a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t;

  // Ein Schild in einer Groesse (voll, klein = nur Preis, punkt) setzen; null, wenn kein Platz frei ist
  function platziereSchild(x, art, f, hindernisse, belegt) {
    const { sx, sy, pfeil } = x.bild;
    const [w, h] = x.groesse[art];
    const frei = (bx) => bx.l >= f.l - 1 && bx.r <= f.r + 1 && bx.t >= f.t - 1 && bx.b <= f.b + 1
      && !hindernisse.some((o) => schneidet(bx, o)) && !belegt.some((o) => schneidet(bx, o));
    let l = sx - w / 2, t = art === 'punkt' ? sy - h / 2 : sy - h;
    l = Math.max(f.l, Math.min(f.r - w, l));
    t = Math.max(f.t, Math.min(f.b - h, t));
    // Runden Knoepfen seitlich ausweichen
    for (const o of hindernisse) {
      const box = { l, t, r: l + w, b: t + h };
      if (!schneidet(box, o)) continue;
      const links = o.l - w, rechts = o.r;
      l = (sx < (o.l + o.r) / 2 && links >= f.l) || rechts + w > f.r ? links : rechts;
    }
    const kandidaten = [{ l, t }];
    if (art === 'punkt') {
      // Punkte duerfen ein Stueck neben ihren Bauplatz ruecken
      for (const r of [16, 28]) for (let i = 0; i < 8; i++) kandidaten.push({ l: l + Math.cos(i * Math.PI / 4) * r, t: t + Math.sin(i * Math.PI / 4) * r });
    } else {
      // Liegt schon ein Schild dort: daneben (links, rechts) oder unter den Bauplatz ausweichen
      for (const o of belegt) kandidaten.push({ l: o.l - w - 4, t }, { l: o.r + 4, t });
      kandidaten.push({ l, t: Math.min(f.b - h, sy + 6) });
    }
    const wahl = kandidaten.map((k) => ({ l: k.l, t: k.t, r: k.l + w, b: k.t + h })).find(frei);
    return wahl ? { ...wahl, art, w, pfeil } : null;
  }

  function setzeSchilder() {
    if (!schildListe.length || schilder.hidden) return;
    const cam = rig.camera;
    const c = game.canvas.getBoundingClientRect();
    const { f, hindernisse } = freierBereich(c);
    const sortiert = [...schildListe].sort((a, b) => b.prio - a.prio);
    for (const x of sortiert) {
      _v.copy(x.p).project(cam);
      const sx = (_v.x + 1) / 2 * c.width, sy = (1 - _v.y) / 2 * c.height;
      // Ausserhalb des freien Bereichs: Schild an den Rand, ein Pfeil zeigt die Richtung
      let pfeil = '';
      if (sx < f.l) pfeil = '←'; else if (sx > f.r) pfeil = '→';
      if (sy < f.t) pfeil = '↑' + pfeil; else if (sy > f.b) pfeil = '↓' + pfeil;
      x.bild = { sx, sy, pfeil };
      // Groessen einmal messen: ganzes Schild, nur Preis, Punkt
      if (!x.groesse) {
        x.s.style.display = '';
        x.groesse = {};
        for (const art of ['voll', 'klein', 'punkt']) {
          x.s.classList.toggle('klein', art === 'klein');
          x.s.classList.toggle('punkt', art === 'punkt');
          x.groesse[art] = [x.s.offsetWidth || 90, x.s.offsetHeight || 30];
        }
      }
    }
    // Erst alle ganz versuchen. Passt das nicht, bekommt jeder Bauplatz zuerst einen Punkt, danach werden
    // so viele wie moeglich wieder groesser (ganz, sonst nur Preis), ohne einen Punkt zu verdecken.
    // Antippen oeffnet in jeder Groesse die Vorschau.
    let bestes = { fehlt: 0, lage: new Map() };
    {
      const belegt = [];
      for (const x of sortiert) {
        const p = platziereSchild(x, 'voll', f, hindernisse, belegt) ?? platziereSchild(x, 'klein', f, hindernisse, belegt);
        if (p) { belegt.push(p); bestes.lage.set(x, p); } else bestes.fehlt++;
      }
    }
    if (bestes.fehlt) {
      const lage = new Map();
      const belegt = [];
      for (const x of sortiert) {
        const p = x.bild.pfeil ? platziereSchild(x, 'klein', f, hindernisse, belegt) : platziereSchild(x, 'punkt', f, hindernisse, belegt);
        if (p) { belegt.push(p); lage.set(x, p); }
      }
      for (const x of sortiert) {
        const alt = lage.get(x);
        if (alt?.art === 'klein') continue;
        const andere = [...lage.values()].filter((p) => p !== alt);
        const p = platziereSchild(x, 'voll', f, hindernisse, andere) ?? platziereSchild(x, 'klein', f, hindernisse, andere);
        if (p) lage.set(x, p);
      }
      const fehlt = sortiert.length - lage.size;
      if (fehlt < bestes.fehlt || fehlt === 0) bestes = { fehlt, lage };
    }
    for (const x of sortiert) {
      const p = bestes.lage.get(x);
      if (!p) { x.s.style.display = 'none'; continue; }
      x.s.style.display = '';
      x.s.classList.toggle('klein', p.art === 'klein');
      x.s.classList.toggle('punkt', p.art === 'punkt');
      x.s.classList.toggle('unten', !p.pfeil && p.art !== 'punkt' && p.t > x.bild.sy);
      x.s.classList.toggle('rand', !!p.pfeil);
      x.s.dataset.pfeil = p.pfeil;
      x.s.style.transform = `translate(${Math.round(p.l)}px, ${Math.round(p.t)}px)`;
      // Zeiger zeigt auf den Bauplatz, auch wenn das Schild seitlich ausgewichen ist
      x.s.style.setProperty('--zeiger-x', `${Math.round(Math.max(10, Math.min(p.w - 10, x.bild.sx - p.l)))}px`);
    }
  }

  // Schwebende Zeile nach dem Bauen ("+4 Plätze")
  const flieger = [];
  function fliege(text, x, y, z) {
    const f = el('div', { class: 'bau-flieger' }, text);
    root.append(f);
    flieger.push({ f, p: new THREE.Vector3(x, y + 4, z), t: 0 });
  }

  // ------------------------------------------------------------------ Hinweis "Als Naechstes"
  const tipp = el('button', { type: 'button', class: 'bau-tipp', id: 'bau-tipp', hidden: true });
  root.append(tipp);
  let tippZiel = null;
  tipp.addEventListener('click', () => {
    if (tippZiel) vorschau(tippZiel); else oeffnen();
  });
  function setzeTipp() {
    const n = naechsterSchritt();
    tippZiel = n?.ziel ?? null;
    buildBtn.classList.toggle('bau-punkt', !!n?.leistbar);
    const imEinstieg = !!game.einstieg?.schritt?.();
    const aus = !n || offen || buildBtn.hidden || document.body.classList.contains('card-open') || imEinstieg || document.body.classList.contains('foto') || !!game.winter?.offen?.();
    tipp.hidden = aus;
    if (aus) return;
    tipp.replaceChildren(el('span', { class: 'bau-tipp-titel' }, 'Als Nächstes'), el('span', { class: 'bau-tipp-text' }, n.text));
    platziereTipp();
  }
  function platziereTipp() {
    if (tipp.hidden) return;
    const b = buildBtn.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    // Pfeil zeigt auf den Knopf: Knopf rechts (PC) oder links (Handy, Daumen)
    const links = b.left + b.width / 2 < r.left + r.width / 2;
    tipp.classList.toggle('links', links);
    tipp.style.left = links ? `${Math.max(8, Math.round(b.left - r.left))}px` : '';
    tipp.style.right = links ? '' : `${Math.max(8, Math.round(r.right - b.right))}px`;
    tipp.style.bottom = `${Math.round(r.bottom - b.top + 10)}px`;
    // Nicht auf andere Felder der unteren Leiste legen (Zeit am Handy): sonst darueber
    const t = tipp.getBoundingClientRect();
    let oben = b.top;
    for (const e of document.querySelectorAll('#hud-bottom .hm-px, #hud-bottom button')) {
      if (e === buildBtn || buildBtn.contains(e) || !e.offsetParent) continue;
      const o = e.getBoundingClientRect();
      if (o.width && o.left < t.right && o.right > t.left) oben = Math.min(oben, o.top);
    }
    if (oben < b.top) tipp.style.bottom = `${Math.round(r.bottom - oben + 10)}px`;
  }

  // ------------------------------------------------------------------ Karte
  let offen = false;
  let reiter = 'steg';
  let aktiv = null;           // key der Vorschau
  let meldung = '';
  let fertig = null;          // gerade gebaut: { name, text }
  let warPausiert = false;
  let suedGrenze = null;      // urspruengliche Suedgrenze der Kamera, solange der Baumodus sie erweitert
  function grenzeZurueck() {
    if (suedGrenze == null || !rig?.bounds) return;
    rig.bounds.maxZ = suedGrenze;
    suedGrenze = null;
    if (fahrt) fahrt.z = Math.min(fahrt.z, rig.bounds.maxZ);
    else if (rig.target.z > rig.bounds.maxZ) fahrt = { x: rig.target.x, z: rig.bounds.maxZ, w: rig.viewWidth };
  }

  function oeffnen(r) {
    if (!game.sim?.state) return;
    if (game.sim.selected != null) game.sim.select(null);
    if (!offen) {
      offen = true;
      warPausiert = game.paused;
      if (!game.paused) game.setPaused?.(true);
      document.body.classList.add('building');
      buildBtn.setAttribute('aria-pressed', 'true');
      // Die Karte deckt am Handy den Sueden ab: Kamera darf im Baumodus weiter nach Sueden, damit
      // Bauplaetze am Ufer ueber der Karte liegen koennen (beim Schliessen zurueck)
      if (rig?.bounds && suedGrenze == null) { suedGrenze = rig.bounds.maxZ; rig.bounds.maxZ += 140; }
      game.audio?.sfx?.('auswahl');
      game.emit('bauen:offen');
      // Erstes Bauwerk (Roadmap J4, Ü15): Das Toilettenhaeuschen ist geschenkt, die Vorschau steht gleich offen
      if (startGeschenk()) return;
      // Erst wenn die Karte eingefahren ist (Handy: Bottom Sheet mit Uebergang), stimmt ihr Rahmen
      setTimeout(() => { if (offen && !aktiv) uebersicht(); }, 380);
    }
    if (r) reiter = r;
    aktiv = null;
    fertig = null;
    meldung = '';
    entferneGeist();
    zeichne();
  }

  // ------------------------------------------------------------------ Erstes Bauwerk geschenkt
  // Weicher Start (Roadmap Ü15, J4): Wer in Stufe 1 noch keine Toilette hat und das erste Mal baut,
  // bekommt das Geld fuer das Toilettenhaeuschen geschenkt (einmal pro Spielstand, auch nach
  // "Einstieg beenden"). Die Vorschau geht gleich auf, der Knopf "Bauen fuer ..." leuchtet.
  // Gekauft wird trotzdem wie immer: Vorschau ansehen, dann bestaetigen.
  const GESCHENK_KEY = 'versorgung:wc';
  let gefuehrt = null;
  function startGeschenk() {
    const s = speicher();
    const st = game.sim.state;
    if (!s || s.geschenk || st.stage !== 1 || (st.facilities?.wc || 0) > 0) return false;
    const e = eintraege().find((x) => x.key === GESCHENK_KEY);
    if (!e || e.gesperrt) return false;
    s.geschenk = e.kosten;
    // Im Tagesabschluss unter "Sonstiges" sichtbar, zaehlt aber nicht als verdientes Geld
    // (Aufstieg, bester Tag und Tagesziele rechnen mit stats.dayIncome und totalIncome)
    game.sim.addIncome(e.kosten, 'sonstiges', 'startgeschenk');
    if (st.stats) {
      st.stats.dayIncome = Math.max(0, (st.stats.dayIncome || 0) - e.kosten);
      st.stats.totalIncome = Math.max(0, (st.stats.totalIncome || 0) - e.kosten);
    }
    gefuehrt = GESCHENK_KEY;
    game.emit('bauen:geschenk', { key: GESCHENK_KEY, betrag: e.kosten });
    vorschau(GESCHENK_KEY);
    return true;
  }

  function schliessen() {
    if (!offen) return;
    gefuehrt = null;
    offen = false;
    aktiv = null;
    fertig = null;
    entferneGeist();
    entferneUmrisse();
    schilder.replaceChildren();
    schildListe = [];
    document.body.classList.remove('building');
    buildBtn.setAttribute('aria-pressed', 'false');
    grenzeZurueck();
    if (card.classList.contains('bau-karte')) {
      card.classList.remove('bau-karte');
      card.hidden = true;
      card.replaceChildren();
      document.body.classList.remove('card-open');
    }
    if (!warPausiert) game.setPaused?.(false);
    game.emit('bauen:zu');
    setzeTipp();
  }

  function vorschau(key) {
    const e = eintraege().find((x) => x.key === key);
    if (!e) return;
    if (!offen) oeffnen(e.art);
    reiter = e.art;
    aktiv = key;
    fertig = null;
    meldung = '';
    zeichne();
    const ort = e.ort?.();
    zeigeGeist(e, ort);
    requestAnimationFrame(() => zeigeOrt(ort));
    setTimeout(() => { if (aktiv === key) zeigeOrt(ort); }, 380);
    game.audio?.sfx?.('klick');
    game.emit('bauen:vorschau', { key });
  }

  function kaufen(key) {
    const e = eintraege().find((x) => x.key === key);
    if (!e || e.gesperrt) return;
    const geld = game.sim.state.money;
    if (e.kosten > geld) { meldung = 'Dafür reicht das Geld noch nicht.'; zeichne(); game.audio?.sfx?.('fehler'); return; }
    const ort = e.ort?.();
    const vorher = game.sim.state.money;
    const snap = schnappschuss(e);
    const r = e.kaufen();
    if (!r?.ok) {
      meldung = r?.geldFehlt ? 'Dafür reicht das Geld noch nicht.' : 'Das geht gerade nicht.';
      zeichne();
      game.audio?.sfx?.('fehler');
      return;
    }
    entferneGeist();
    gefuehrt = null;
    // Zehn Sekunden lang zuruecknehmbar (Roadmap P18, Bed P7); nicht der Stufenausbau in einem Stueck
    rueck = snap && (e.key !== 'hafen:stufe' || r.abschnitt) ? { ...snap, bis: performance.now() + RUECK_MS, name: e.name, kosten: vorher - game.sim.state.money } : null;
    if (speicher()?.sparziel === key) { speicher().sparziel = null; zeigeSparziel(); }
    if (r.abschnitt) {
      // Bauabschnitt beauftragt: Baustelle zeigen, fertig wird er ueber Nacht
      game.audio?.sfx?.('bauen');
      const o = baustellenOrt(ausbauStand());
      if (o) { welle(o.x, o.z, o.y); fliege('Baustelle eingerichtet', o.x, o.y, o.z); zeigeOrt({ x: o.x, z: o.z, breite: 30 }); }
      game.emit('bauen:gebaut', { key, name: e.name, kosten: vorher - game.sim.state.money || e.kosten });
      aktiv = null;
      fertig = { titel: `${e.name} beauftragt`, text: r.abschnitt < r.von
        ? 'Die Baustelle steht. Über Nacht wird gebaut, morgen früh kannst du den nächsten Abschnitt bezahlen.'
        : 'Der letzte Abschnitt läuft. Morgen früh ist der Ausbau fertig.' };
      meldung = '';
      zeichne();
      return;
    }
    game.audio?.sfx?.(e.key === 'hafen:stufe' ? 'stufe' : 'bauen');
    if (ort) {
      const y = Number.isFinite(game.landschaft?.hoeheBei?.(ort.x, ort.z)) ? Math.max(0, game.landschaft.hoeheBei(ort.x, ort.z)) : 0;
      welle(ort.x, ort.z, y);
      const text = e.art === 'steg' ? (e.plaetzeNeu === 1 ? '+1 Liegeplatz' : `+${e.plaetzeNeu} Liegeplätze`) : e.art === 'versorgung' && e.wunsch !== 'strom' ? `${WUNSCH_KURZ[e.id]} für ${e.nutzen[0].match(/\d+/)?.[0] ?? ''} Boote` : e.name;
      fliege(text, ort.x, y, ort.z);
      if (ort.gebaeude && ort.neu) {
        const it = game.buildings.items.find((i) => i.id === ort.gebaeude);
        if (it?.mesh.parent) { it.mesh.scale.set(1, 0.01, 1); wachsen.push({ m: it.mesh, t: 0 }); }
      }
    }
    game.emit('bauen:gebaut', { key, name: e.name, kosten: vorher - game.sim.state.money || e.kosten });
    // Kleine Karte bleibt stehen, damit das neue Bauwerk sichtbar bleibt
    aktiv = null;
    fertig = { name: e.name, text: e.art === 'steg' ? `${e.plaetzeNeu === 1 ? 'Ein neuer Liegeplatz ist' : `${e.plaetzeNeu} neue Liegeplätze sind`} frei.` : e.nutzen[0] ?? '' };
    meldung = '';
    zeichne();
  }

  function zeichne() {
    if (!offen) return;
    const sim = game.sim;
    const geld = sim.state.money;
    const liste = eintraege();
    const n = naechsterSchritt();
    tippZiel = n?.ziel ?? null;
    card.classList.add('bau-karte');
    card.hidden = false;
    document.body.classList.add('card-open');
    if (fertig) {
      schilder.hidden = true;
      entferneUmrisse();
      fuelle(
        el('div', { class: 'bau-kopf' }, el('h2', {}, fertig.titel ?? `${fertig.name} ist gebaut`), el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`)),
        fertig.text ? el('p', { class: 'bau-fertig' }, fertig.text) : null,
        el('div', { class: 'card-actions' },
          el('button', { type: 'button', class: 'hud-btn bau-ja', onclick: () => { fertig = null; rueck = null; zeichne(); requestAnimationFrame(uebersicht); } }, 'Weiter bauen'),
          el('button', { type: 'button', class: 'hud-btn', onclick: schliessen }, 'Fertig')),
        rueck ? el('button', { type: 'button', class: 'bau-rueck', onclick: zuruecknehmen }, rueckText()) : null,
      );
      return;
    }
    if (aktiv) {
      const e = liste.find((x) => x.key === aktiv);
      if (e) { zeichneVorschau(e, geld); schilder.hidden = true; return; }
      aktiv = null;
    }
    schilder.hidden = false;
    zeichneListe(liste, geld, n);
    zeigeUmrisse(liste);
    zeigeSchilder(liste);
  }

  const fuelle = (...k) => card.replaceChildren(...k.flat().filter((c) => c != null && c !== false));

  function zeichneListe(liste, geld, n) {
    const tabs = el('div', { class: 'bau-reiter', role: 'tablist' },
      REITER.map((r) => {
        const zahl = liste.filter((e) => e.art === r.id && !e.gesperrt).length;
        return el('button', { type: 'button', role: 'tab', class: 'bau-tab', 'aria-selected': r.id === reiter ? 'true' : 'false',
          onclick: () => { reiter = r.id; meldung = ''; zeichne(); } },
          r.name, zahl ? el('span', { class: 'bau-zahl' }, String(zahl)) : null);
      }));
    const eigene = liste.filter((e) => e.art === reiter).sort((a, b) => (!!a.gesperrt - !!b.gesperrt) || a.kosten - b.kosten);
    const zeilen = eigene.map((e) => {
      const teuer = e.kosten > geld;
      return el('button', { type: 'button', class: `bau-zeile${e.gesperrt ? ' gesperrt' : ''}${teuer ? ' teuer' : ''}`, 'data-bau': e.key,
        onclick: () => (e.gesperrt && e.key !== 'hafen:stufe' ? null : vorschau(e.key)) },
        el('span', { class: 'bau-zeile-kopf' },
          el('span', { class: 'bau-zeile-name' }, e.name),
          el('span', { class: 'bau-zeile-preis' }, euro(e.kosten))),
        el('span', { class: 'bau-zeile-text' }, e.gesperrt ? e.gesperrt[0].toUpperCase() + e.gesperrt.slice(1) : e.nutzen[0] ?? ''),
        e.key === tippZiel ? el('span', { class: 'bau-marke' }, 'Empfohlen') : null);
    });
    fuelle(
      el('div', { class: 'bau-kopf' },
        el('h2', {}, 'Bauen'),
        el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`),
        // Am Handy ersetzt das Kreuz die Zeile "Schließen" unten (oberflaeche.css), die Liste bekommt den Platz
        el('button', { type: 'button', class: 'hm-zu bau-zu', 'aria-label': 'Baumenü schließen', title: 'Schließen', onclick: schliessen }, 'Schließen')),
      n ? el('button', { type: 'button', class: 'bau-rat', onclick: () => n.ziel && vorschau(n.ziel) },
        el('span', { class: 'bau-tipp-titel' }, 'Als Nächstes'), el('span', {}, n.text)) : null,
      meldung ? el('p', { class: 'card-note', role: 'status' }, meldung) : null,
      tabs,
      el('div', { class: 'bau-liste' }, zeilen.length ? zeilen : el('p', { class: 'bau-leer' }, reiter === 'steg' ? 'Gerade gibt es keinen freien Bauplatz für Stege. Die nächste Ausbaustufe bringt neue.' : 'Hier ist gerade nichts zu bauen.')),
      reiter === 'hafen' ? automatikSchalter() : null,
      el('div', { class: 'card-actions bau-unten' }, el('button', { type: 'button', class: 'hud-btn', onclick: schliessen }, 'Schließen')),
    );
  }

  // Hafenleitstelle (Roadmap P02, E5): Automatik je Größenklasse an oder aus. XL und größer sind
  // immer Sonderfälle und bleiben ohnehin beim Spieler.
  function automatikSchalter() {
    const sim = game.sim;
    const st = sim?.state;
    if (!st) return null;
    if (!sim.setBueroAutomatik || st.office < sim.ctx.rules.office.autoAssign) return null;
    return el('div', { class: 'bau-automatik', role: 'group', 'aria-label': 'Automatik der Hafenleitstelle je Größe' },
      el('span', { class: 'bau-automatik-titel' }, 'Leitstelle weist zu'),
      ...['S', 'M', 'L'].map((k) => {
        const an = sim.bueroAutomatik(k);
        return el('button', { type: 'button', class: 'bau-schalter', 'aria-pressed': an ? 'true' : 'false',
          title: an ? `Größe ${k}: Das Büro weist zu. Tippen: selbst zuweisen` : `Größe ${k}: Du weist selbst zu. Tippen: Büro übernimmt`,
          onclick: () => { sim.setBueroAutomatik(k, !an); zeichne(); } }, `${k} ${an ? 'an' : 'aus'}`);
      }));
  }

  function zeichneVorschau(e, geld) {
    const b = bedarf();
    let bedarfText = null;
    if (e.art === 'steg' && (b.weg || b.plaetze)) {
      bedarfText = b.weg ? (b.weg === 1 ? 'Zuletzt ist 1 Boot weitergefahren, ohne anzulegen.' : `Zuletzt sind ${b.weg} Boote weitergefahren, ohne anzulegen.`) : `Abends waren ${b.belegt} von ${b.plaetze} Gastplätzen belegt.`;
    } else if (e.wunsch && b.offen[e.wunsch]) {
      bedarfText = b.offen[e.wunsch] === 1 ? `Zuletzt wollte 1 Gast ${WUNSCH[e.wunsch]} und bekam es nicht.` : `Zuletzt wollten ${b.offen[e.wunsch]} Gäste ${WUNSCH[e.wunsch]} und bekamen es nicht.`;
    } else if (e.wunsch && e.art === 'versorgung' && b.abend) {
      bedarfText = 'Zuletzt hat das hier niemandem gefehlt.';
    }
    // Stufenausbau baut Stege um: wer auf wegfallenden Plaetzen liegt, reist ab oder zieht um (sim.stageUpPreview)
    const umbau = e.key === 'hafen:stufe' ? umbauText(game.sim.stageUpPreview?.()) : null;
    const teuer = e.kosten > geld;
    const knopf = e.gesperrt
      ? el('button', { type: 'button', class: 'hud-btn bau-ja', disabled: true }, e.gesperrt[0].toUpperCase() + e.gesperrt.slice(1))
      : teuer
        ? el('button', { type: 'button', class: 'hud-btn bau-ja', disabled: true }, `Noch ${euro(e.kosten - geld)} sparen`)
        : el('button', { type: 'button', class: `hud-btn bau-ja${gefuehrt === e.key ? ' bau-leuchtet' : ''}`, onclick: () => kaufen(e.key) }, `Bauen für ${euro(e.kosten)}`);
    const geschenkText = gefuehrt === e.key
      ? `Dein erstes Bauwerk: Das Geld dafür (${euro(speicher()?.geschenk || e.kosten)}) ist geschenkt und liegt schon in der Kasse. Bestätige mit „Bauen für ${euro(e.kosten)}“.`
      : null;
    fuelle(
      el('div', { class: 'bau-kopf' },
        el('h2', {}, e.name),
        el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`)),
      geschenkText ? el('p', { class: 'bau-geschenk', role: 'status' }, geschenkText) : null,
      el('ul', { class: 'bau-nutzen' }, e.nutzen.map((t) => el('li', {}, t))),
      e.fortschritt ? el('div', { class: 'bau-fortschritt' }, e.fortschritt.map((f) =>
        el('div', { class: 'bau-balken-zeile' },
          el('span', {}, `${f.name}: ${f.text}`),
          el('span', { class: 'bau-balken' }, el('span', { style: `width:${Math.min(100, Math.round((f.ist / f.soll) * 100))}%` }))))) : null,
      bedarfText ? el('p', { class: 'bau-bedarf' }, bedarfText) : null,
      umbau ? el('p', { class: 'bau-bedarf bau-umbau' }, umbau) : null,
      el('p', { class: 'bau-preis' }, teuer || e.gesperrt ? `Preis ${euro(e.kosten)}` : `Preis ${euro(e.kosten)}, danach in der Kasse ${euro(geld - e.kosten)}`),
      meldung ? el('p', { class: 'card-note', role: 'status' }, meldung) : null,
      teuer && !e.gesperrt ? el('button', { type: 'button', class: `bau-spar${speicher()?.sparziel === e.key ? ' an' : ''}`, 'aria-pressed': speicher()?.sparziel === e.key ? 'true' : 'false', onclick: () => setzeSparziel(e.key) },
        speicher()?.sparziel === e.key ? 'Sparziel gemerkt (tippen zum Lösen)' : 'Als Sparziel merken') : null,
      el('div', { class: 'card-actions' },
        knopf,
        el('button', { type: 'button', class: 'hud-btn', onclick: () => { aktiv = null; meldung = ''; entferneGeist(); zeichne(); requestAnimationFrame(uebersicht); game.audio?.sfx?.('abbrechen'); } }, 'Zurück')),
    );
  }

  // ------------------------------------------------------------------ Ereignisse
  // Der Bauen-Knopf gehoert jetzt diesem Modul (hud.js ueberlaesst ihn, sobald game.bauen da ist)
  buildBtn.addEventListener('click', () => (offen ? schliessen() : oeffnen()));
  game.on('tap', (e) => {
    const pick = e?.pick;
    if (offen && pick?.type === 'buildsite' && String(pick.id).includes(':')) vorschau(pick.id);
  });
  game.on('ui:cancel', () => { if (offen) schliessen(); });
  game.on('sim:select', ({ boatId } = {}) => { if (offen && boatId != null) { offen = false; aktiv = null; entferneGeist(); entferneUmrisse(); schilder.replaceChildren(); schildListe = []; card.classList.remove('bau-karte'); document.body.classList.remove('building'); grenzeZurueck(); buildBtn.setAttribute('aria-pressed', 'false'); if (!warPausiert) game.setPaused?.(false); } });
  game.on('services:karte', () => { if (offen) schliessen(); });
  game.on('spielstand-geladen', () => { if (offen) schliessen(); rueck = null; setzeTipp(); setTimeout(zeigeSparziel, 0); });
  let geplant = false;
  game.on('sim:change', () => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; if (offen) zeichne(); setzeTipp(); zeigeSparziel(); });
  });
  game.on('resize', () => { platziereTipp(); if (offen && aktiv) zeigeOrt(eintraege().find((x) => x.key === aktiv)?.ort?.()); });
  game.on('ready', setzeTipp);
  game.on('einstieg:ende', setzeTipp);   // Hinweis gleich zeigen, sobald der Einstieg vorbei ist
  game.on('winter:karte', setzeTipp);    // Winterpause (features/winter.js) verdeckt sonst den Hinweis
  new MutationObserver(() => setzeTipp()).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Animationen laufen auch in der Pause (Baumodus pausiert die Spielzeit)
  let letzte = performance.now();
  game.onTick(() => {
    const jetzt = performance.now();
    const dt = Math.min(0.1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (fahrt && rig) {
      const k = 1 - Math.exp(-dt * 6);
      rig.target.x += (fahrt.x - rig.target.x) * k;
      rig.target.z += (fahrt.z - rig.target.z) * k;
      rig.viewWidth += (fahrt.w - rig.viewWidth) * k;
      if (Math.hypot(fahrt.x - rig.target.x, fahrt.z - rig.target.z) < 0.05 && Math.abs(fahrt.w - rig.viewWidth) < 0.05) fahrt = null;
      rig._clamp?.();
      rig._apply?.();
    }
    const puls = 0.5 + 0.5 * Math.sin(jetzt / 280);
    geistMat.opacity = 0.35 + 0.25 * puls;
    stegMat.opacity = 0.4 + 0.3 * puls;
    if (geist) geist.traverse((o) => { if (o.userData?.ring) o.scale.setScalar(1 + 0.06 * puls); });
    for (let i = wellen.length - 1; i >= 0; i--) {
      const w = wellen[i];
      w.t += dt;
      const s = 1 + w.t * 14;
      w.m.scale.set(s, 1, s);
      w.m.material.opacity = Math.max(0, 0.9 - w.t * 0.9);
      if (w.t > 1) { welt.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); wellen.splice(i, 1); }
    }
    for (let i = wachsen.length - 1; i >= 0; i--) {
      const w = wachsen[i];
      w.t = Math.min(1, w.t + dt / 0.8);
      const p = w.t, s = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
      w.m.scale.set(1, Math.max(0.01, s), 1);
      if (w.t >= 1) { w.m.scale.set(1, 1, 1); wachsen.splice(i, 1); }
    }
    const c = game.canvas.getBoundingClientRect();
    for (let i = flieger.length - 1; i >= 0; i--) {
      const f = flieger[i];
      f.t += dt;
      _v.copy(f.p).project(rig.camera);
      let sx = (_v.x + 1) / 2 * c.width, sy = (1 - _v.y) / 2 * c.height - f.t * 40;
      // Im Bild bleiben: unter der oberen Leiste, ueber einer Karte unten, nicht ueber den Rand
      const w = f.f.offsetWidth, h = f.f.offsetHeight;
      const oben = (document.getElementById('hud-top')?.getBoundingClientRect().bottom ?? c.top) - c.top + 8 + h;
      const k = card.hidden ? null : card.getBoundingClientRect();
      const unten = k && k.width >= c.width * 0.6 ? k.top - c.top - 8 : c.height - 8;
      sy = Math.max(oben, Math.min(unten, sy));
      sx = Math.max(w / 2 + 8, Math.min(c.width - w / 2 - 8, sx));
      f.f.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
      f.f.style.opacity = String(Math.max(0, Math.min(1, 2.2 - f.t)));
      if (f.t > 2.2) { f.f.remove(); flieger.splice(i, 1); }
    }
    if (offen) setzeSchilder();
    setzeSparSchild();
    // Der Knopf rutscht mit der Leiste (Karte zu), der Hinweis folgt ihm
    if (!tipp.hidden) platziereTipp();
  });

  const api = {
    oeffnen, schliessen, vorschau, eintraege, naechsterSchritt, bedarf, get offen() { return offen; },
    // Ausbau in Abschnitten: { name, n, fertig, imBau, teile, preis } (preis = naechster Abschnitt) oder null
    ausbau: () => { const a = ausbauStand(); return a ? { name: a.name, n: a.n, fertig: a.fertig, imBau: a.imBau, teile: a.teile, preis: a.teile[Math.min(a.n - 1, a.fertig)] } : null; },
    sparziel: () => speicher()?.sparziel ?? null,
    setzeSparziel: (key) => { if ((speicher()?.sparziel ?? null) !== (key ?? null)) setzeSparziel(key ?? speicher()?.sparziel); },
  };
  game.bauen = api;
  setzeTipp();
  return api;
}

function stil() {
  if (document.getElementById('bauen-stil')) return;
  const s = document.createElement('style');
  s.id = 'bauen-stil';
  s.textContent = `
    #card.bau-karte { display: flex; flex-direction: column; gap: 8px; }
    #card.bau-karte > * { flex-shrink: 0; }
    #card.bau-karte > .bau-liste { flex: 0 1 auto; min-height: 0; }
    .bau-kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .bau-kopf .bau-zu { display: none; }
    .bau-kopf h2 { margin: 0; min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; }
    .bau-kasse { flex: 0 0 auto; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0.8; }
    .bau-rat { display: grid; gap: 2px; text-align: left; border: 0; border-radius: 12px; padding: 10px 12px;
      background: #e8f4ee; color: #1d3245; font: inherit; font-size: 0.92rem; line-height: 1.3; cursor: pointer; }
    .bau-tipp-titel { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #2a7d63; }
    .bau-automatik { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .bau-automatik-titel { flex: 1 0 100%; font-weight: 600; }
    .bau-automatik .bau-schalter { flex: 1 1 0; min-width: 0; max-width: 120px; white-space: nowrap; min-height: 40px; padding: 6px 10px; border: 2px solid #1d3245;
      border-radius: 6px; background: #2a9d8f; color: #fff; font-weight: 600; }
    .bau-automatik .bau-schalter[aria-pressed="false"] { background: #eee6d2; color: #5b6670; }
    .bau-reiter { display: flex; gap: 2px; background: rgba(29, 50, 69, 0.07); border-radius: 12px; padding: 4px; }
    .bau-tab { flex: 1 1 auto; min-width: 0; white-space: nowrap; border: 0; border-radius: 9px; background: none; font: inherit; font-size: 0.8rem; font-weight: 600; color: #1d3245;
      min-height: 38px; padding: 4px 6px; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
    .bau-tab[aria-selected="true"] { background: #fff; box-shadow: 0 1px 4px rgba(20, 40, 60, 0.15); }
    .bau-zahl { min-width: 16px; height: 16px; border-radius: 8px; background: #2a9d8f; color: #fff; font-size: 0.7rem; display: inline-grid; place-items: center; padding: 0 4px; }
    .bau-liste { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; max-height: min(46vh, 420px); padding: 8px 2px 0 0; }
    .bau-fertig { margin: 0; font-size: 0.95rem; line-height: 1.35; }
    .bau-zeile { position: relative; display: grid; gap: 2px; text-align: left; border: 1px solid rgba(29, 50, 69, 0.12); border-radius: 12px;
      background: #fff; padding: 10px 12px; font: inherit; color: #1d3245; cursor: pointer; }
    .bau-zeile:hover { border-color: #2a9d8f; }
    .bau-zeile-kopf { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; }
    .bau-zeile-preis { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .bau-zeile.teuer .bau-zeile-preis { color: #9a4a3c; }
    .bau-zeile-text { font-size: 0.86rem; line-height: 1.3; opacity: 0.8; }
    .bau-zeile.gesperrt { background: transparent; border-style: dashed; cursor: default; }
    .bau-zeile.gesperrt .bau-zeile-kopf, .bau-zeile.gesperrt .bau-zeile-text { opacity: 0.55; }
    .bau-zeile[data-bau="hafen:stufe"].gesperrt { cursor: pointer; }
    .bau-marke { position: absolute; top: -8px; right: 10px; background: #f2c14e; color: #1d3245; font-size: 0.68rem; font-weight: 800;
      border-radius: 6px; padding: 1px 6px; }
    .bau-leer { margin: 6px 0; opacity: 0.7; font-size: 0.9rem; }
    .bau-nutzen { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 0.92rem; line-height: 1.35; }
    .bau-geschenk { margin: 0; padding: 8px 10px; background: #e3f3df; color: #24442a; border: 2px solid #5c9a52; font-size: 0.9rem; line-height: 1.35; }
    #card .bau-ja.bau-leuchtet { animation: bau-leuchten 1.4s ease-in-out infinite; }
    @keyframes bau-leuchten { 0%, 100% { box-shadow: 0 0 0 2px rgba(242,193,78,.9), 0 0 10px 2px rgba(242,193,78,.5); } 50% { box-shadow: 0 0 0 4px rgba(242,193,78,.6), 0 0 18px 6px rgba(242,193,78,.35); } }
    @media (prefers-reduced-motion: reduce) { #card .bau-ja.bau-leuchtet { animation: none; box-shadow: 0 0 0 3px rgba(242,193,78,.9); } }
    .bau-bedarf { margin: 0; padding: 8px 10px; border-radius: 10px; background: #fff4dc; font-size: 0.9rem; line-height: 1.35; }
    .bau-preis { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
    .bau-fortschritt { display: grid; gap: 6px; font-size: 0.86rem; }
    .bau-balken-zeile { display: grid; gap: 3px; }
    .bau-balken { height: 8px; border-radius: 4px; background: rgba(29, 50, 69, 0.12); overflow: hidden; }
    .bau-balken > span { display: block; height: 100%; background: #2a9d8f; border-radius: 4px; }
    #card.bau-karte .card-actions { display: flex; gap: 8px; flex-wrap: nowrap; }
    #card.bau-karte .card-actions .hud-btn { flex: 1 1 auto; }
    .bau-ja:not(:disabled) { background: #2a9d8f !important; color: #fff !important; flex: 2 1 auto !important; }
    .bau-schilder { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 4; }
    .bau-schilder[hidden] { display: none; }
    .bau-schild { position: absolute; left: 0; top: 0; pointer-events: auto; display: grid; gap: 0; text-align: center; border: 0;
      border-radius: 10px; padding: 4px 9px; background: rgba(255, 252, 246, 0.95); color: #1d3245; font: inherit; font-size: 12px;
      line-height: 1.2; box-shadow: 0 2px 8px rgba(20, 40, 60, 0.25); cursor: pointer; white-space: nowrap; }
    .bau-schild::after { content: ''; position: absolute; left: var(--zeiger-x, 50%); bottom: -5px; margin-left: -5px; border: 5px solid transparent;
      border-bottom: 0; border-top-color: rgba(255, 252, 246, 0.95); }
    .bau-schild-name { font-weight: 700; }
    .bau-schild-preis { font-variant-numeric: tabular-nums; color: #2a7d63; font-weight: 700; }
    .bau-schild.teuer .bau-schild-preis { color: #9a4a3c; }
    .bau-schild.empfohlen { outline: 3px solid #f2c14e; }
    .bau-schild.rand::after { display: none; }
    .bau-rueck { justify-self: center; margin-top: 6px; border: 0; background: none; color: #1d3245; font: inherit; font-size: 0.85rem;
      text-decoration: underline; cursor: pointer; min-height: 32px; }
    .bau-spar { border: 2px dashed #b8862a; background: #fff8e6; color: #6b4e12; border-radius: 10px; font: inherit; font-size: 0.85rem;
      font-weight: 700; min-height: 38px; padding: 6px 10px; cursor: pointer; }
    .bau-spar.an { border-style: solid; background: #f2c14e; color: #1d3245; }
    .bau-sparbalken { position: absolute; left: 8px; right: 8px; bottom: 3px; height: 4px; background: rgba(29, 50, 69, 0.15); pointer-events: none; }
    .bau-sparbalken[hidden] { display: none; }
    .bau-sparbalken > span { display: block; height: 100%; width: 0; background: #e8b02c; transition: width 0.4s; }
    .bau-sparbalken.voll > span { background: #2a9d8f; }
    .bau-sparschild { z-index: 3; }
    .hm-status { position: relative; }
    .bau-sparschild[hidden] { display: none; }
    /* Zu wenig Platz: nur der Preis, zuletzt ein Punkt mit Plus (Antippen oeffnet die Vorschau) */
    .bau-schild.klein .bau-schild-name { display: none; }
    .bau-schild.punkt { width: 22px; height: 22px; padding: 0 !important; border-radius: 50%; place-items: center; }
    .bau-schild.punkt > span { display: none; }
    .bau-schild.punkt::before { content: '+'; font-weight: 800; font-size: 15px; line-height: 1; color: #2a7d63; }
    .bau-schild.punkt::after { display: none; }
    .bau-schild.unten::after { bottom: auto; top: -5px; border-top: 0; border-bottom: 5px solid rgba(255, 252, 246, 0.95); }
    .bau-schild.rand::before { content: attr(data-pfeil); position: absolute; left: -6px; top: -8px; width: 20px; height: 20px;
      border-radius: 50%; background: #1d3245; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
    .bau-flieger { position: absolute; left: 0; top: 0; z-index: 6; pointer-events: none; font-weight: 800; font-size: 18px; color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 10px rgba(42, 157, 143, 0.9); white-space: nowrap; }
    .bau-tipp { position: absolute; z-index: 5; max-width: min(320px, calc(100vw - 32px)); display: grid; gap: 1px; text-align: left;
      border: 0; border-radius: 14px; padding: 8px 12px; background: rgba(255, 252, 246, 0.96); color: #1d3245; font: inherit;
      font-size: 13px; line-height: 1.3; box-shadow: 0 3px 12px rgba(20, 40, 60, 0.22); cursor: pointer; }
    .bau-tipp[hidden] { display: none; }
    .bau-tipp::after { content: ''; position: absolute; right: 26px; bottom: -6px; border: 6px solid transparent; border-bottom: 0;
      border-top-color: rgba(255, 252, 246, 0.96); }
    .bau-tipp.links::after { right: auto; left: 26px; }
    #btn-build { position: relative; }
    #btn-build.bau-punkt::after { content: ''; position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%;
      background: #f2c14e; border: 2px solid #fff; }
    body.building.paused #stage { filter: none !important; }
    /* Baumodus: Seitenleiste (Wetter, Tagesziele, Stufenziel) weg, die Karte zeigt den Rat selbst */
    body.building #hm-seite { display: none !important; }
    body.foto .bau-tipp, body.foto .bau-schilder { display: none; }
    @media (max-width: 599px), (max-height: 499px) {
      .bau-liste { max-height: 34dvh; gap: 4px; }
      .bau-zeile { padding: 8px 10px; }
      .bau-zeile:not(.gesperrt) .bau-zeile-text { display: none; }
      .bau-zeile-text { font-size: 0.78rem; }
      .bau-rat { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bau-rat .bau-tipp-titel { display: none; }
      #card.bau-karte { gap: 6px; }
      .bau-nutzen, .bau-bedarf { font-size: 0.86rem; }
      .bau-rat { padding: 8px 10px; font-size: 0.86rem; }
    }
    /* Handy quer: wenig Hoehe, der Hinweis steht schon ueber dem Knopf, die Liste bekommt den Platz */
    @media (max-height: 499px) {
      #card.bau-karte .bau-rat, .bau-zahl { display: none; }
      .bau-liste { max-height: calc(100dvh - 150px); }
      .bau-tab { min-height: 32px; }
      .bau-zeile { padding: 6px 10px; }
      #card.bau-karte .card-actions .hud-btn { min-height: 38px; }
    }
  `;
  document.head.append(s);
}
