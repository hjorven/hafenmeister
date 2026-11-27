// Spätankömmling (Roadmap P53, F40, docs/spaetankoemmling.md): An manchen Saisonabenden kommt der letzte
// Übernachter des Tages erst nach Sonnenuntergang. Die Spielregeln (sim.js, planLateArrival) wählen das Boot
// und halten die Nacht an, solange es unterwegs ist; dieses Modul zeigt es:
//
// - Meldung im Meldeplatz ("Spätankömmling"), sobald das Boot im Revier oder im Bild ist, mit "Zeigen"
// - Taschenlampe am Bug: ein warmer Lichtkegel schwenkt über das Wasser, solange das Boot im Dunkeln fährt
// - Positionslichter: kommen aus render/signalflaggen.js (P49); fehlt das Modul, zeichnet dieses hier
//   rot, grün und weiß am Spätankömmling selbst
// - Die zugewiesene Box: ein warmer Lichtschein auf dem Wasser (der Hafenmeister steht mit der Lampe da),
//   bis das Boot fest ist
// - Danach brennt in der Kajüte Licht, bis es hell wird
//
// Liest: game.sim (spaet(), state), game.boatView.boot(id), game.stege.platz(id),
// game.landscape.licht.zustand.nacht. Schreibt nichts in den Spielstand.
// Schnittstelle: game.spaet = { boot(), unterwegs(), lampe(id), schein(), meldung(), zeigen() }
import * as THREE from 'three';
import { VORRANG } from '../ui/meldungen.js';
import { meldungText } from './spaetankoemmling-text.js';

export { meldungText };

export const NACHT_LAMPE = 0.3;     // ab dieser Dunkelheit geht die Taschenlampe an
export const NACHT_KAJUETE = 0.2;   // bis zu dieser Dunkelheit am Morgen brennt Licht in der Kajüte
export const MELDUNG_S = 9;         // so lange steht die Meldung (sichtbare Zeit)
const MOVING = new Set(['sailing', 'docking', 'casting-off', 'leaving']);

const CSS = `
#hm-spaet { position: absolute; z-index: 25; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--hm-unten, 12px) + 132px); width: min(400px, calc(100% - 32px));
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px 10px; color: var(--hm-tinte, #283648); line-height: 1.3; }
#hm-spaet:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
#hm-spaet[hidden], #hm-spaet.zurueck, body.building #hm-spaet, body.card-open #hm-spaet,
body.foto #hm-spaet { display: none !important; }
#hm-spaet > .hm-sym { flex: none; width: 24px; height: 24px; margin-top: 2px; }
#hm-spaet .sp-text { flex: 1; min-width: 0; }
#hm-spaet strong { display: block; font-weight: 600; cursor: pointer; }
#hm-spaet .sp-satz { display: block; font-size: max(13px, .8125rem); }
#hm-spaet .sp-knoepfe { display: flex; gap: 6px; margin-top: 8px; }
#hm-spaet .sp-knoepfe .hm-knopf { flex: 0 0 auto; min-height: 40px; padding: 4px 12px; font: 600 14px/1.1 var(--hm-text, inherit); cursor: pointer; white-space: nowrap; }
#hm-spaet .sp-knoepfe .hm-knopf:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
@media (max-height: 500px) {
  #hm-spaet { gap: 8px; padding: 6px 10px 7px; line-height: 1.2; }
  #hm-spaet > .hm-sym { width: 20px; height: 20px; margin-top: 0; }
  #hm-spaet .sp-satz { font-size: 12px; }
  #hm-spaet .sp-knoepfe { margin-top: 4px; }
  #hm-spaet .sp-knoepfe .hm-knopf { min-height: 32px; padding: 2px 10px; font-size: 13px; }
}
`;

export function init(game) {
  if (!game.scene || typeof document === 'undefined') return;
  const nacht = () => game.landscape?.licht?.zustand?.nacht ?? 0;
  const ruhig = () => document.body.classList.contains('hm-ruhig');
  const simBoot = () => game.sim?.spaet?.() ?? null;
  const tag = () => game.sim?.state?.day ?? 0;

  // ------------------------------------------------------------------ Meldung
  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.append(stil);
  const host = document.getElementById('game') ?? document.body;
  const box = document.createElement('div');
  box.id = 'hm-spaet';
  box.className = 'hm-px';
  box.setAttribute('role', 'status');
  box.hidden = true;
  host.append(box);
  game.meldungen?.anmelden?.('#hm-spaet', 'spaet');

  let meldung = null;          // { id, sichtbar }
  const angesagt = new Set();  // Tag:Boot, schon gemeldet
  let wartetAufRevier = null;  // Boot-id: gemeldet wird erst, wenn es im Revier oder im Bild ist
  const imRevier = new Set();

  function zeigen() {
    const a = meldung ? game.boatView?.boot?.(meldung.id) : null;
    if (!a || a.model?.visible === false) return false;
    game.camera?.flyTo?.(a.x, a.z);
    return true;
  }
  function zeichne(id) {
    const b = game.sim?.state?.boats?.[id];
    const artName = b ? game.sim?.ctx?.typeById?.[b.typeId]?.name ?? null : null;
    const t = meldungText(b, artName);
    const sym = document.createElement('i');
    sym.className = 'hm-sym';
    sym.setAttribute('aria-hidden', 'true');
    sym.style.setProperty('--sym', 'var(--px-mond, var(--px-boot, var(--px-schiff)))');
    const text = document.createElement('div');
    text.className = 'sp-text';
    const titel = document.createElement('strong');
    titel.textContent = t.titel;
    titel.addEventListener('click', (e) => { e.stopPropagation(); zeigen(); });
    const satz = document.createElement('span');
    satz.className = 'sp-satz';
    satz.textContent = t.satz;
    const knoepfe = document.createElement('div');
    knoepfe.className = 'sp-knoepfe';
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'hm-knopf hm-px hm-primaer';
    k.textContent = 'Zeigen';
    k.addEventListener('click', (e) => { e.stopPropagation(); zeigen(); });
    knoepfe.append(k);
    text.append(titel, satz, knoepfe);
    box.replaceChildren(sym, text);
  }
  function melde(id) {
    angesagt.add(`${tag()}:${id}`);
    meldung = { id, sichtbar: 0 };
    zeichne(id);
    box.hidden = false;
    game.meldungen?.wunsch('spaet', VORRANG.spaet ?? 52);
    game.audio?.sfx?.('glockenschlag', { delay: 0.1 });
    game.emit('spaet:gemeldet', { boatId: id });
  }
  function schliesse() {
    if (!meldung) return;
    meldung = null;
    box.hidden = true;
    game.meldungen?.fertig('spaet');
  }

  game.on('sim:lateArrival', (e) => {
    if (e?.boatId == null || angesagt.has(`${tag()}:${e.boatId}`)) return;
    wartetAufRevier = e.boatId;
  });
  game.on('boat:im-revier', (d) => { if (d?.id != null) imRevier.add(d.id); });

  // ------------------------------------------------------------------ Lichter
  const warm = '#ffe9b0';
  // Weiche Ränder: der Kegel wird zur Spitze hin heller, der Fleck nach außen schwächer
  function verlauf(radial) {
    const c = document.createElement('canvas');
    c.width = radial ? 64 : 4;
    c.height = 64;
    const g = c.getContext('2d');
    const v = radial ? g.createRadialGradient(32, 32, 0, 32, 32, 32) : g.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(255,255,255,1)');
    v.addColorStop(radial ? 0.45 : 0.3, 'rgba(255,255,255,0.55)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const kegelMat = new THREE.MeshBasicMaterial({
    color: warm, alphaMap: verlauf(false), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const fleckMat = new THREE.MeshBasicMaterial({
    color: '#ffe2a0', alphaMap: verlauf(true), transparent: true, opacity: 0.5, depthWrite: false, fog: false,
  });
  const lampeMat = new THREE.MeshBasicMaterial({ color: '#fffbe8', fog: false });
  const scheinMat = new THREE.MeshBasicMaterial({
    color: '#ffc45c', alphaMap: verlauf(true), transparent: true, opacity: 0.4, depthWrite: false, fog: false,
  });
  const fensterMat = new THREE.MeshBasicMaterial({ color: '#ffcf6e', fog: false });
  const fensterGlanz = new THREE.MeshBasicMaterial({
    color: '#ffc75a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const LICHT = {
    rot: new THREE.MeshBasicMaterial({ color: '#ff3b3b', fog: false }),
    gruen: new THREE.MeshBasicMaterial({ color: '#3bff7a', fog: false }),
    weiss: new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }),
  };
  const kugel = new THREE.SphereGeometry(0.14, 8, 6);
  const kugelGross = new THREE.SphereGeometry(0.5, 10, 8);
  const ohneStrahl = (o) => { o.raycast = () => {}; o.traverse((c) => { c.raycast = () => {}; }); return o; };

  const KEGEL_L = 13;
  function lampeBauen(anim) {
    const L = anim.info?.length ?? 8;
    const deck = Math.max(0.5, Math.min(1.6, L * 0.09));
    const g = new THREE.Group();
    g.name = 'spaet-lampe';
    g.userData.signal = true;
    // Lampe vorn am Bug, in Augenhöhe der Crew
    const halter = new THREE.Group();
    halter.position.set(L * 0.36, deck + 1.1, 0);
    g.add(halter);
    halter.add(new THREE.Mesh(kugel, lampeMat));
    // Kegel: Spitze an der Lampe, öffnet sich nach vorn und unten aufs Wasser
    const kegel = new THREE.Mesh(new THREE.ConeGeometry(2.8, KEGEL_L, 18, 1, true), kegelMat);
    kegel.rotation.z = Math.PI / 2;           // Achse von y nach -x ...
    kegel.position.x = KEGEL_L / 2;           // ... Spitze an der Lampe, offen nach vorn
    const schwenk = new THREE.Group();
    schwenk.rotation.z = -Math.atan2(deck + 1.1, KEGEL_L);   // nach unten aufs Wasser
    schwenk.add(kegel);
    halter.add(schwenk);
    // Fleck auf dem Wasser vor dem Bug
    const fleck = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), fleckMat);
    fleck.rotation.x = -Math.PI / 2;
    fleck.position.set(KEGEL_L - 0.5, -(deck + 1.1) + 0.4, 0);   // über den Wellenkämmen
    halter.add(fleck);
    // Positionslichter nur, wenn P49 (render/signalflaggen.js) sie nicht schon zeichnet
    let pos = null;
    if (!game.signalflaggen) {
      const B = anim.info?.beam ?? 2.5;
      pos = new THREE.Group();
      const p = (m, x, y, z) => { const k = new THREE.Mesh(kugel, m); k.position.set(x, y, z); pos.add(k); };
      p(LICHT.rot, L * 0.22, deck + 0.25, -B * 0.47);
      p(LICHT.gruen, L * 0.22, deck + 0.25, B * 0.47);
      p(LICHT.weiss, -L * 0.48, deck + 0.25, 0);
      g.add(pos);
    }
    // Kajütlicht für nach dem Festmachen
    const fenster = new THREE.Group();
    fenster.position.set(-L * 0.05, deck + 0.55, 0);
    const kern = new THREE.Mesh(kugel, fensterMat);
    kern.scale.set(1.6, 0.9, 1.6);
    fenster.add(kern, new THREE.Mesh(kugelGross, fensterGlanz));
    fenster.visible = false;
    g.add(fenster);
    ohneStrahl(g);
    anim.model.add(g);
    return { g, halter, schwenk, fleck, pos, fenster, model: anim.model };
  }

  // Lichtschein an der zugewiesenen Box
  const schein = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), scheinMat);
  schein.rotation.x = -Math.PI / 2;
  schein.visible = false;
  schein.renderOrder = 2;
  ohneStrahl(schein);
  game.scene.add(schein);
  let scheinPlatz = null;
  game.on('sim:moored', (e) => {
    if (!e?.spaet) return;
    scheinPlatz = { id: e.berthId, boatId: e.boatId, seit: game.time ?? 0 };
  });

  // ------------------------------------------------------------------ Takt
  let lampe = null;   // { id, ...lampeBauen }
  function weg() {
    if (lampe) lampe.g.removeFromParent();
    lampe = null;
  }
  const neu = () => { weg(); schliesse(); angesagt.clear(); imRevier.clear(); wartetAufRevier = null; scheinPlatz = null; schein.visible = false; };
  game.on('spielstand-geladen', neu);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') neu(); });

  let letzteEcht = performance.now();
  let pruefen = 0;
  game.onTick?.(() => {
    const jetzt = performance.now();
    const echt = Math.min(1, (jetzt - letzteEcht) / 1000);
    letzteEcht = jetzt;
    const t = game.time ?? 0;
    const n = nacht();

    // Meldung ansagen, sobald das Boot zu sehen ist
    pruefen += echt;
    if (pruefen > 0.25) {
      pruefen = 0;
      const id = wartetAufRevier;
      if (id != null) {
        const a = game.boatView?.boot?.(id);
        const b = game.sim?.state?.boats?.[id];
        if (!b || b.status !== 'waiting') wartetAufRevier = null;
        else if (a && a.model?.visible !== false && (imRevier.has(id) || game.boatAnim?.imBild?.(a.x, a.z, (a.info?.length ?? 8) / 2))) {
          wartetAufRevier = null;
          if (!game.paused) melde(id);
          else wartetAufRevier = id;
        }
      }
    }
    if (meldung) {
      game.meldungen?.wunsch('spaet', VORRANG.spaet ?? 52);
      const darf = game.meldungen ? game.meldungen.darf('spaet') : true;
      box.classList.toggle('zurueck', !darf);
      const b = document.body.classList;
      if (darf && !game.paused && !b.contains('building') && !b.contains('card-open') && !b.contains('foto')) meldung.sichtbar += echt;
      const s = game.sim?.state?.boats?.[meldung.id];
      if (meldung.sichtbar >= MELDUNG_S || !s || s.status === 'moored' && meldung.sichtbar > 3) schliesse();
    }

    // Lampe am Boot
    const sb = simBoot();
    const anim = sb && sb.status !== 'expected' ? game.boatView?.boot?.(sb.id) : null;
    if (!anim?.model || (lampe && (lampe.id !== sb.id || lampe.model !== anim.model))) weg();
    if (anim?.model && !lampe) lampe = { id: sb.id, ...lampeBauen(anim) };
    if (lampe) {
      const faehrt = !anim.moored && MOVING.has(anim.state);
      const anLampe = faehrt && n > NACHT_LAMPE;
      lampe.halter.visible = anLampe;
      if (anLampe) {
        // Die Crew sucht mit der Lampe nach der Box: langsamer Schwenk, mit "Weniger Bewegung" ruhig nach vorn
        lampe.halter.rotation.y = ruhig() ? 0 : Math.sin(t * 0.8 + sb.id) * 0.38 + Math.sin(t * 0.31) * 0.12;
        const k = Math.min(1, (n - NACHT_LAMPE) / 0.3);
        kegelMat.opacity = 0.3 * k;
        fleckMat.opacity = 0.5 * k;
      }
      if (lampe.pos) lampe.pos.visible = faehrt && n > 0.12;
      // Kajütlicht: liegt fest in der Box, bis es hell wird
      lampe.fenster.visible = !!anim.moored && sb.status === 'moored' && sb.spaetFest !== false && String(sb.berthId).startsWith(String(anim.berth?.id ?? sb.berthId)) && n > NACHT_KAJUETE;
    }

    // Schein an der Box, bis das Boot fest ist (oder höchstens 90 s)
    if (scheinPlatz) {
      const b = game.sim?.state?.boats?.[scheinPlatz.boatId];
      const a = game.boatView?.boot?.(scheinPlatz.boatId);
      const fest = !b || b.status !== 'moored' || String(b.berthId) !== String(scheinPlatz.id) || (a?.moored && b.spaetFest !== false);
      if (fest || t - scheinPlatz.seit > 90) { scheinPlatz = null; schein.visible = false; }
      else {
        const p = game.stege?.platz?.(scheinPlatz.id);
        schein.visible = !!p && n > 0.15;
        if (p) {
          schein.position.set(p.x, 0.35, p.z);   // über den Wellenkämmen
          const puls = ruhig() ? 1 : 0.85 + 0.15 * Math.sin(t * 2.4);
          scheinMat.opacity = 0.42 * Math.min(1, n / 0.5) * puls;
          const L = a?.info?.length ?? 8;
          schein.scale.setScalar(Math.max(0.8, L / 8));
        }
      }
    }
  });

  // Zum Ausprobieren: ?spaet=jetzt plant für heute einen Spätankömmling und spult bis kurz vor den Abend
  const params = new URLSearchParams(location.search);
  if (params.get('spaet') === 'jetzt') {
    const t0 = setInterval(() => {
      const s = game.sim?.state;
      const ctx = game.sim?.ctx;
      if (!s || !ctx || !s.upcoming) return;
      clearInterval(t0);
      if (s.phase !== 'day') return;
      const kinds = ctx.rules.lateArrival?.kinds ?? [];
      let b = [...s.upcoming].reverse().find((x) => !x.flotte && !x.besucher && !x.havarie && x.nights > 0 && kinds.includes(x.kind));
      if (!b) b = [...s.upcoming].reverse().find((x) => !x.flotte && !x.besucher && x.nights > 0);
      if (!b) return;
      // Die übrigen Boote des Tages fallen aus (sonst kämen beim Vorspulen alle auf einmal)
      b.arriveAt = ctx.rules.dayLength + 2;
      b.spaet = s.day;
      s.upcoming = [b];
      const ziel = ctx.rules.dayLength - 6;
      if (s.clock < ziel) game.sim.fastForward?.(ziel - s.clock);
      game.emit('sim:change', { reason: 'probe' });
    }, 200);
    setTimeout(() => clearInterval(t0), 30000);
  }

  game.spaet = {
    boot: () => simBoot(),
    unterwegs: () => !!game.sim?.spaetUnterwegs?.(),
    lampe: (id) => !!lampe && lampe.id === id && lampe.halter.visible,
    kajuete: (id) => !!lampe && lampe.id === id && lampe.fenster.visible,
    schein: () => schein.visible,
    meldung: () => (meldung ? { id: meldung.id, sichtbar: !box.hidden && !box.classList.contains('zurueck') } : null),
    zeigen,
  };
}

export default init;
