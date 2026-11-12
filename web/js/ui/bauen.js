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
import { baueModell } from '../render/services-models.js';

import { euro, num1, WUNSCH, WUNSCH_KURZ, FREI, leer, wirkungText, waehleSchritt } from './bauen-rat.js';

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
    return st.modules.bauen;
  };
  function bedarf() {
    const s = speicher();
    if (!s) return leer();
    // Abends gilt schon der heutige Tag, tagsueber der gestrige (plus was heute schon weiterfuhr)
    const b = s.heute.abend ? s.heute : s.gestern;
    return { ...b, weg: Math.max(b.weg, s.heute.weg), offen: { ...b.offen } };
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
        nutzen.push(jetzt ? `Versorgt ${neu} Boote pro Abend statt ${jetzt}.` : `Versorgt ${neu} Boote pro Abend.`);
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
      const fehlt = [];
      if (adv.missing.includes('guests')) fehlt.push(`${adv.goal.guests - adv.guests} Gäste`);
      if (adv.missing.includes('reputation')) fehlt.push(`Ruf ${num1(adv.goal.reputation)}`);
      out.push({
        key: 'hafen:stufe', art: 'hafen', id: 'stufe', name: adv.goal.name ?? 'Hafen erweitern', kosten: adv.goal.cost,
        gesperrt: fehlt.length ? `fehlt: ${fehlt.join(', ')}` : null,
        kurz: 'Ausbaustufe',
        fortschritt: [
          { name: 'Zufriedene Gäste in dieser Stufe', ist: adv.guests, soll: adv.goal.guests, text: `${adv.guests} von ${adv.goal.guests}` },
          { name: 'Ruf', ist: adv.reputation, soll: adv.goal.reputation, text: `${num1(adv.reputation)} von ${num1(adv.goal.reputation)}` },
        ],
        nutzen, ort: null,
        kaufen: () => sim.advanceStage(),
      });
    }
    return out;
  }

  function naechsterSchritt() {
    const sim = game.sim;
    if (!sim?.state) return null;
    const adv = sim.canAdvanceStage();
    return waehleSchritt({ geld: sim.state.money, eintraege: eintraege(), bedarf: bedarf(), stufe: adv.goal ? adv : null });
  }

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
  function uebersicht() {
    if (!rig?.reset) return;
    const alt = { x: rig.target.x, z: rig.target.z, w: rig.viewWidth, yaw: rig.yaw };
    // Den Hafen in den Bereich neben bzw. ueber der Karte einpassen
    const ins = { ...(rig.insets ?? { top: 0, bottom: 0 }) }, rechts = rig.insetRight ?? 0;
    const r = card.hidden ? null : card.getBoundingClientRect();
    const c = game.canvas.getBoundingClientRect();
    // Handy hochkant: die Karte deckt viel ab, der ganze Hafen waere winzig. Dann bleibt die Kamera.
    if (r && r.width >= rig.screenW * 0.6 && r.top - c.top < rig.screenH * 0.6) { rig.yaw = alt.yaw; return; }
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
  function setzeSchilder() {
    if (!schildListe.length || schilder.hidden) return;
    const cam = rig.camera;
    const c = game.canvas.getBoundingClientRect();
    const belegt = [];
    const sortiert = [...schildListe].sort((a, b) => b.prio - a.prio);
    for (const x of sortiert) {
      _v.copy(x.p).project(cam);
      const sx = (_v.x + 1) / 2 * c.width, sy = (1 - _v.y) / 2 * c.height;
      const w = x.s.offsetWidth || 90, h = x.s.offsetHeight || 30;
      const box = { l: sx - w / 2, t: sy - h, r: sx + w / 2, b: sy };
      const draussen = box.r < 0 || box.l > c.width || box.b < 0 || box.t > c.height;
      const ueber = belegt.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
      x.s.style.visibility = draussen || ueber ? 'hidden' : 'visible';
      if (!draussen && !ueber) belegt.push(box);
      x.s.style.transform = `translate(${Math.round(sx - w / 2)}px, ${Math.round(sy - h)}px)`;
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
    const aus = !n || offen || buildBtn.hidden || document.body.classList.contains('card-open') || imEinstieg || document.body.classList.contains('foto');
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
  }

  // ------------------------------------------------------------------ Karte
  let offen = false;
  let reiter = 'steg';
  let aktiv = null;           // key der Vorschau
  let meldung = '';
  let fertig = null;          // gerade gebaut: { name, text }
  let warPausiert = false;

  function oeffnen(r) {
    if (!game.sim?.state) return;
    if (game.sim.selected != null) game.sim.select(null);
    if (!offen) {
      offen = true;
      warPausiert = game.paused;
      if (!game.paused) game.setPaused?.(true);
      document.body.classList.add('building');
      buildBtn.setAttribute('aria-pressed', 'true');
      game.audio?.sfx?.('auswahl');
      game.emit('bauen:offen');
      requestAnimationFrame(uebersicht);
    }
    if (r) reiter = r;
    aktiv = null;
    fertig = null;
    meldung = '';
    entferneGeist();
    zeichne();
  }

  function schliessen() {
    if (!offen) return;
    offen = false;
    aktiv = null;
    fertig = null;
    entferneGeist();
    entferneUmrisse();
    schilder.replaceChildren();
    schildListe = [];
    document.body.classList.remove('building');
    buildBtn.setAttribute('aria-pressed', 'false');
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
    const r = e.kaufen();
    if (!r?.ok) {
      meldung = r?.geldFehlt ? 'Dafür reicht das Geld noch nicht.' : 'Das geht gerade nicht.';
      zeichne();
      game.audio?.sfx?.('fehler');
      return;
    }
    entferneGeist();
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
        el('div', { class: 'bau-kopf' }, el('h2', {}, `${fertig.name} ist gebaut`), el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`)),
        fertig.text ? el('p', { class: 'bau-fertig' }, fertig.text) : null,
        el('div', { class: 'card-actions' },
          el('button', { type: 'button', class: 'hud-btn bau-ja', onclick: () => { fertig = null; zeichne(); uebersicht(); } }, 'Weiter bauen'),
          el('button', { type: 'button', class: 'hud-btn', onclick: schliessen }, 'Fertig')),
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
        el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`)),
      n ? el('button', { type: 'button', class: 'bau-rat', onclick: () => n.ziel && vorschau(n.ziel) },
        el('span', { class: 'bau-tipp-titel' }, 'Als Nächstes'), el('span', {}, n.text)) : null,
      meldung ? el('p', { class: 'card-note', role: 'status' }, meldung) : null,
      tabs,
      el('div', { class: 'bau-liste' }, zeilen.length ? zeilen : el('p', { class: 'bau-leer' }, reiter === 'steg' ? 'Gerade gibt es keinen freien Bauplatz für Stege. Die nächste Ausbaustufe bringt neue.' : 'Hier ist gerade nichts zu bauen.')),
      el('div', { class: 'card-actions' }, el('button', { type: 'button', class: 'hud-btn', onclick: schliessen }, 'Schließen')),
    );
  }

  function zeichneVorschau(e, geld) {
    const b = bedarf();
    let bedarfText = null;
    if (e.art === 'steg' && (b.weg || b.plaetze)) {
      bedarfText = b.weg ? `Zuletzt sind ${b.weg} Boote weitergefahren, ohne anzulegen.` : `Abends waren ${b.belegt} von ${b.plaetze} Gastplätzen belegt.`;
    } else if (e.wunsch && b.offen[e.wunsch]) {
      bedarfText = `Am letzten Abend wollten ${b.offen[e.wunsch]} Gäste ${WUNSCH[e.wunsch]} und bekamen es nicht.`;
    } else if (e.wunsch && e.art === 'versorgung' && b.abend) {
      bedarfText = 'Am letzten Abend fehlte dazu niemandem etwas.';
    }
    const teuer = e.kosten > geld;
    const knopf = e.gesperrt
      ? el('button', { type: 'button', class: 'hud-btn bau-ja', disabled: true }, e.gesperrt[0].toUpperCase() + e.gesperrt.slice(1))
      : teuer
        ? el('button', { type: 'button', class: 'hud-btn bau-ja', disabled: true }, `Noch ${euro(e.kosten - geld)} sparen`)
        : el('button', { type: 'button', class: 'hud-btn bau-ja', onclick: () => kaufen(e.key) }, `Bauen für ${euro(e.kosten)}`);
    fuelle(
      el('div', { class: 'bau-kopf' },
        el('h2', {}, e.name),
        el('span', { class: 'bau-kasse' }, `Kasse ${euro(geld)}`)),
      el('ul', { class: 'bau-nutzen' }, e.nutzen.map((t) => el('li', {}, t))),
      e.fortschritt ? el('div', { class: 'bau-fortschritt' }, e.fortschritt.map((f) =>
        el('div', { class: 'bau-balken-zeile' },
          el('span', {}, `${f.name}: ${f.text}`),
          el('span', { class: 'bau-balken' }, el('span', { style: `width:${Math.min(100, Math.round((f.ist / f.soll) * 100))}%` }))))) : null,
      bedarfText ? el('p', { class: 'bau-bedarf' }, bedarfText) : null,
      el('p', { class: 'bau-preis' }, teuer || e.gesperrt ? `Preis ${euro(e.kosten)}` : `Preis ${euro(e.kosten)}, danach in der Kasse ${euro(geld - e.kosten)}`),
      meldung ? el('p', { class: 'card-note', role: 'status' }, meldung) : null,
      el('div', { class: 'card-actions' },
        knopf,
        el('button', { type: 'button', class: 'hud-btn', onclick: () => { aktiv = null; meldung = ''; entferneGeist(); zeichne(); uebersicht(); game.audio?.sfx?.('abbrechen'); } }, 'Zurück')),
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
  game.on('sim:select', ({ boatId } = {}) => { if (offen && boatId != null) { offen = false; aktiv = null; entferneGeist(); entferneUmrisse(); schilder.replaceChildren(); schildListe = []; card.classList.remove('bau-karte'); document.body.classList.remove('building'); buildBtn.setAttribute('aria-pressed', 'false'); if (!warPausiert) game.setPaused?.(false); } });
  game.on('services:karte', () => { if (offen) schliessen(); });
  game.on('spielstand-geladen', () => { if (offen) schliessen(); setzeTipp(); });
  let geplant = false;
  game.on('sim:change', () => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; if (offen) zeichne(); setzeTipp(); });
  });
  game.on('resize', () => { platziereTipp(); if (offen && aktiv) zeigeOrt(eintraege().find((x) => x.key === aktiv)?.ort?.()); });
  game.on('ready', setzeTipp);
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
      const sx = (_v.x + 1) / 2 * c.width, sy = (1 - _v.y) / 2 * c.height - f.t * 40;
      f.f.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
      f.f.style.opacity = String(Math.max(0, Math.min(1, 2.2 - f.t)));
      if (f.t > 2.2) { f.f.remove(); flieger.splice(i, 1); }
    }
    if (offen) setzeSchilder();
  });

  const api = { oeffnen, schliessen, vorschau, eintraege, naechsterSchritt, bedarf, get offen() { return offen; } };
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
    .bau-kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .bau-kopf h2 { margin: 0; }
    .bau-kasse { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; opacity: 0.8; }
    .bau-rat { display: grid; gap: 2px; text-align: left; border: 0; border-radius: 12px; padding: 10px 12px;
      background: #e8f4ee; color: #1d3245; font: inherit; font-size: 0.92rem; line-height: 1.3; cursor: pointer; }
    .bau-tipp-titel { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #2a7d63; }
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
    .bau-schild::after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -5px; border: 5px solid transparent;
      border-bottom: 0; border-top-color: rgba(255, 252, 246, 0.95); }
    .bau-schild-name { font-weight: 700; }
    .bau-schild-preis { font-variant-numeric: tabular-nums; color: #2a7d63; font-weight: 700; }
    .bau-schild.teuer .bau-schild-preis { color: #9a4a3c; }
    .bau-schild.empfohlen { outline: 3px solid #f2c14e; }
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
    body.foto .bau-tipp, body.foto .bau-schilder { display: none; }
    @media (max-width: 599px), (max-height: 499px) {
      .bau-liste { max-height: 26dvh; }
      #card.bau-karte { gap: 6px; }
      .bau-nutzen, .bau-bedarf { font-size: 0.86rem; }
      .bau-rat { padding: 8px 10px; font-size: 0.86rem; }
    }
    /* Handy quer: wenig Hoehe, der Hinweis steht schon ueber dem Knopf, die Liste bekommt den Platz */
    @media (max-height: 499px) {
      #card.bau-karte .bau-rat, .bau-zahl { display: none; }
      .bau-liste { max-height: calc(100dvh - 160px); }
      .bau-tab { min-height: 32px; }
    }
  `;
  document.head.append(s);
}
