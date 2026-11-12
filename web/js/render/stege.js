// Stege und Liegeplaetze in 3D, gebaut aus web/js/data/harbor.js.
// Gehoert dem Thread "Haefen mit echten Satellitenbildern vergleichen". Vorbilder: docs/vorbilder.md
//
// Holzstege stehen auf Pfaehlen (Steg A, B, C, Stichsteg, Fischersteg), Schwimmstege liegen
// flach auf Schwimmkoerpern mit Fuehrungspfaehlen (Steg D, Dienststege), der Kai bekommt eine
// Betonkante mit Pollern. Boxen haben zwei Heckpfaehle (Dalben) am seeseitigen Ende,
// Fingerplaetze je zwei Boote zwischen zwei Fingerstegen.
//
// Schnittstelle:
//   game.stege.setStage(n)            baut die Stege der Stufe n (1 bis 5, hoehere wie 5)
//   game.stege.highlight(ids, farbe)  Liegeplaetze einfaerben, z. B. passende Plaetze fuer ein Boot.
//                                     ids = Liste von Platz-ids (A01, D07 ...), [] oder null loescht
//   game.stege.deckHoehe(bauart)     Hoehe der Laufflaeche: holz 0,86 m, schwimmsteg 0,46 m, kai 1,3 m
//   game.stege.platz(id)              { id, x, z, richtung, mesh } in Weltkoordinaten der aktuellen Stufe
//   Antippen: Steg-Teile tragen userData.pick = { type: 'jetty', id: 'A' }, Liegeplaetze
//   userData.pick = { type: 'berth', id: 'A01' } (ids wie in harbor.js).
//   Ereignis 'stufe' (Zahl) baut neu, beim Start gilt game.state.stufe oder ?stufe=n.
//   Nur gebaute Plaetze stehen als Steg im Wasser (Start, gekaufte Stegprojekte, Stufenausbau aus
//   game.sim). Kaufbare Stegprojekte erscheinen als heller Bauplatz mit pick { type: 'buildsite',
//   id: projektId }; Antippen oeffnet die Bauen-Karte. Projekte spaeterer Stufen sind unsichtbar.
//   game.stege.bauplaetze() liefert die ids der sichtbaren Bauplaetze.
import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const W = (x, y) => new THREE.Vector3(x * U, 0, -y * U);

const FARBE = {
  planke: '#d9b27c', planke2: '#c79d68', pfahl: '#4f4852', kappe: '#f4f1ea',
  schwimm: '#e3e0d8', schwimmer: '#8d939a', beton: '#c9c4ba', kante: '#f2c94c',
  poller: '#3a3f46', markierung: '#ffd23f',
};

function mat(c) { return new THREE.MeshLambertMaterial({ color: c, flatShading: true }); }

export function init(game) {
  const M = Object.fromEntries(Object.entries(FARBE).map(([k, c]) => [k, mat(c)]));
  M.bauflaeche = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
  M.baurand = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
  const root = new THREE.Group();
  root.name = 'stege';
  game.scene.add(root);

  // Gemeinsame Geometrien
  const pfahlGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6);
  const dalbeGeo = new THREE.CylinderGeometry(0.18, 0.2, 3.2, 6);
  const kappeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6);
  const pollerGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.6, 8);

  let stufe = 0;
  let plaetze = new Map();
  let gruppe = null;

  // ---------------------------------------------------------------- Stegteile
  function segment(a, b, breite, hoehe, dicke, material) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + breite * 0.5, dicke, breite), material);
    m.position.set((a.x + b.x) / 2, hoehe, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    return m;
  }

  function holzsteg(linie, g) {
    const b = Math.max(1.2, linie.breite * U);
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      g.add(segment(a, e, b, 0.75, 0.22, M.planke));
      // Pfaehle alle 3,5 m an beiden Seiten, Laengsbalken als dunklere Kante
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      const quer = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(b / 2 - 0.1);
      const n = Math.max(1, Math.round(len / 3.5));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        for (const s of [1, -1]) {
          const pf = new THREE.Mesh(pfahlGeo, M.pfahl);
          pf.position.set(p.x + quer.x * s, -0.3, p.z + quer.z * s);
          g.add(pf);
        }
      }
      const kante = segment(a, e, b + 0.12, 0.6, 0.14, M.planke2);
      g.add(kante);
    }
  }

  function schwimmsteg(linie, g) {
    const b = Math.max(0.9, linie.breite * U);
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      g.add(segment(a, e, b, 0.38, 0.16, M.schwimm));
      g.add(segment(a, e, b * 0.9, 0.12, 0.3, M.schwimmer));
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      const quer = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(b / 2 + 0.25);
      const n = Math.max(1, Math.round(len / 12));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        const pf = new THREE.Mesh(dalbeGeo, M.pfahl);
        pf.position.set(p.x + quer.x, 0.1 + 1.6 - 0.6, p.z + quer.z);
        g.add(pf);
      }
    }
  }

  function kai(linie, g) {
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      // Kante liegt auf der Linie, die Kaiflaeche selbst gehoert zur Landschaft
      g.add(segment(a, e, 0.5, 1.15, 0.3, M.kante));
      const n = Math.max(1, Math.round(len / 9));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        const po = new THREE.Mesh(pollerGeo, M.poller);
        po.position.set(p.x, 1.45, p.z);
        g.add(po);
      }
    }
  }

  // ---------------------------------------------------------------- Ausbauzustand aus den Spielregeln
  // Ein Platz ist 'gebaut' (Start, gekauftes Stegprojekt oder Stufenausbau), 'bauplatz' (sein
  // Stegprojekt kann jetzt gekauft werden) oder 'aus' (Projekt erst in einer spaeteren Stufe).
  // Ohne Spielregeln (Ansicht mit ?stufe=n) gilt alles als gebaut.
  let berthById = null;
  const ansichtStufe = new URLSearchParams(location.search).get('stufe');
  function zustand() {
    // Testmodus ?stufe=n: Ansicht ohne Kaufen, alle Stege der Stufe stehen (wie Gebaeude und Services)
    if (ansichtStufe) return null;
    const sim = game.sim;
    if (!sim?.state || !sim.ctx?.berths) return null;
    if (!berthById) berthById = new Map(sim.ctx.berths.map((b) => [b.id, b]));
    const offen = new Map((sim.openJettyProjects?.() ?? []).map((pr) => [pr.id, pr]));
    return { state: sim.state, offen };
  }
  function platzStatus(id, z) {
    if (!z) return { status: 'gebaut' };
    const req = berthById.get(id)?.requires;
    if (!req || z.state.buildings[req]) return { status: 'gebaut' };
    const pr = z.offen.get(req);
    return pr ? { status: 'bauplatz', projekt: pr } : { status: 'aus' };
  }

  // ---------------------------------------------------------------- Liegeplaetze
  function ecken(p) {
    const [x, y, richtung] = p.lage[stufe];
    const r = THREE.MathUtils.degToRad(richtung);
    const bx = Math.cos(r), by = Math.sin(r);
    const sx = -by, sy = bx;
    const l = p.laenge / 2, b = p.breite / 2;
    return [[l, b], [l, -b], [-l, b], [-l, -b]].map(([u, v]) => [x + bx * u + sx * v, y + by * u + sy * v]);
  }

  function liegeplatz(p, g, nr, st) {
    const [x, y, richtung] = p.lage[stufe];
    const c = W(x, y);
    const rad = THREE.MathUtils.degToRad(richtung);
    const bug = new THREE.Vector3(Math.cos(rad), 0, -Math.sin(rad));   // zeigt zum Steg
    const seite = new THREE.Vector3(-bug.z, 0, bug.x);
    const L = p.laenge * U, B = p.breite * U;

    if (st.status === 'bauplatz') {
      // Bauplatz: gestrichelter Umriss im Wasser, antippen oeffnet das Bauen
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, B * 0.84), M.bauflaeche);
      fl.rotation.x = -Math.PI / 2;
      fl.rotation.z = rad;
      fl.position.set(c.x, 0.05, c.z);
      fl.userData.pick = { type: 'buildsite', id: st.projekt.id };
      fl.userData.bauplatz = st.projekt.id;
      fl.renderOrder = 2;
      const rand = new THREE.LineSegments(new THREE.EdgesGeometry(fl.geometry), M.baurand);
      fl.add(rand);
      g.add(fl);
      bauplaetze.push(fl);
      return;
    }

    // Flaeche zum Antippen und Einfaerben
    const flMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.96, B * 0.92), flMat);
    fl.rotation.x = -Math.PI / 2;
    fl.rotation.z = rad;
    fl.position.set(c.x, 0.06, c.z);
    fl.userData.pick = { type: 'berth', id: p.id };
    fl.renderOrder = 2;
    g.add(fl);

    if (p.art === 'box') {
      // Heckpfaehle am seeseitigen Ende, links und rechts der Box
      const heck = c.clone().addScaledVector(bug, -L / 2 + 0.3);
      for (const s of [0.5, -0.5]) {
        const d = new THREE.Mesh(dalbeGeo, M.pfahl);
        d.position.copy(heck).addScaledVector(seite, B * s);
        d.position.y = 0.6;
        g.add(d);
        const k = new THREE.Mesh(kappeGeo, M.kappe);
        k.position.copy(d.position);
        k.position.y = 2.25;
        g.add(k);
      }
    } else if (p.art === 'finger') {
      // Je zwei Boote zwischen zwei Fingerstegen: Finger an jeder zweiten Grenze
      const s = nr % 2 === 0 ? 0.5 : -0.5;
      const fl2 = L * 0.62;
      const mitte = c.clone().addScaledVector(bug, L / 2 - fl2 / 2).addScaledVector(seite, B * s);
      const f = new THREE.Mesh(new THREE.BoxGeometry(fl2, 0.14, 0.7), M.schwimm);
      f.position.set(mitte.x, 0.36, mitte.z);
      f.rotation.y = rad;
      g.add(f);
      const pf = new THREE.Mesh(dalbeGeo, M.pfahl);
      pf.position.copy(c).addScaledVector(bug, L / 2 - fl2).addScaledVector(seite, B * s);
      pf.position.y = 0.6;
      g.add(pf);
    }
    plaetze.set(p.id, { id: p.id, x: c.x, z: c.z, richtung, laenge: L, breite: B, art: p.art, mesh: fl });
  }

  // ---------------------------------------------------------------- Steglinien kuerzen
  // Bogenlaenge des naechsten Punkts auf einer Linie (Planeinheiten)
  function aufLinie(pts, x, y) {
    let best = { d: Infinity, s: 0 };
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (len * len)));
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (d < best.d) best = { d, s: acc + t * len };
      acc += len;
    }
    return { ...best, laenge: acc };
  }
  function teilLinie(pts, s0, s1) {
    const out = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const a = Math.max(s0, acc), e = Math.min(s1, acc + len);
      if (e > a) {
        const p0 = [ax + (bx - ax) * (a - acc) / len, ay + (by - ay) * (a - acc) / len];
        const p1 = [ax + (bx - ax) * (e - acc) / len, ay + (by - ay) * (e - acc) / len];
        if (!out.length) out.push(p0);
        out.push(p1);
      }
      acc += len;
    }
    return out;
  }
  // Beginnt die Linie am Ufer oder an einer anderen Linie desselben Stegs? Sonst ist es ein T-Kopf.
  function angebunden(linie, linien) {
    const [x, y] = linie.punkte[0];
    if (y <= 8) return true;
    return linien.some((m) => m !== linie && m.steg === linie.steg && aufLinie(m.punkte, x, y).d < 2);
  }

  function baueLinie(linie, g, punkte) {
    const l = { ...linie, punkte };
    if (l.bauart === 'holz') holzsteg(l, g);
    else if (l.bauart === 'schwimmsteg') schwimmsteg(l, g);
    else if (l.bauart === 'kai') kai(l, g);
  }

  // ---------------------------------------------------------------- Aufbau
  let bauplaetze = [];
  let signatur = '';
  let markiert = { ids: [], farbe: '#ffd23f' };

  function aktuelleStufe(n) {
    // Testmodus ?stufe=n gilt beim Start vor dem Spielstand (wie Gebaeude, Landschaft und Services)
    const v = n ?? new URLSearchParams(location.search).get('stufe') ?? game.sim?.state?.stage ?? game.state?.stufe ?? 1;
    return String(Math.max(1, Math.min(6, Math.round(Number(v) || 1))));
  }

  function aufbauen(n) {
    const s = aktuelleStufe(n);
    const z = zustand();
    const sig = s + '|' + (z ? Object.keys(z.state.buildings).filter((k) => z.state.buildings[k]).sort().join(',') + '|' + [...z.offen.keys()].sort().join(',') : 'alles');
    if (sig === signatur && gruppe) return;
    signatur = sig;
    stufe = s;
    if (gruppe) {
      root.remove(gruppe);
      gruppe.traverse((o) => { if (o.geometry && ![pfahlGeo, dalbeGeo, kappeGeo, pollerGeo].includes(o.geometry)) o.geometry.dispose(); });
    }
    gruppe = new THREE.Group();
    plaetze = new Map();
    bauplaetze = [];
    const linien = HAFEN.stufen[stufe].stege;

    // Plaetze der Stufe mit Zustand, jeder Platz gehoert zur naechsten Linie seines Stegs
    const liste = HAFEN.plaetze.filter((p) => p.lage[stufe]).map((p) => {
      const st = platzStatus(p.id, z);
      let li = -1, bd = Infinity;
      linien.forEach((m, i) => {
        if (m.steg !== p.steg) return;
        const d = aufLinie(m.punkte, p.lage[stufe][0], p.lage[stufe][1]).d;
        if (d < bd) { bd = d; li = i; }
      });
      return { p, st, li };
    });

    // 1. Durchgang: wie weit steht jede Linie (Bogenlaenge in Planeinheiten)
    const bereich = linien.map((linie, i) => {
      const eigene = liste.filter((e) => e.li === i);
      const gebaut = eigene.filter((e) => e.st.status === 'gebaut');
      const geplant = eigene.filter((e) => e.st.status === 'bauplatz');
      const gesamt = aufLinie(linie.punkte, 0, 0).laenge;
      const ende = (es) => Math.min(gesamt, Math.max(...es.flatMap((e) => ecken(e.p).map(([x, y]) => aufLinie(linie.punkte, x, y).s))) + 1.5);
      const projekt = geplant[0]?.st.projekt.id ?? null;
      if (!eigene.length || linie.bauart === 'kai') return { art: 'ganz', bis: gesamt, gesamt };   // Dienststege, Kai
      if (!angebunden(linie, linien)) return { art: 'tkopf', bis: gebaut.length ? gesamt : 0, plan: !gebaut.length && projekt ? gesamt : 0, projekt, gesamt };
      const bis = gebaut.length ? ende(gebaut) : 0;
      return { art: 'stamm', bis, plan: geplant.length ? ende(geplant) : 0, projekt, gesamt };
    });
    // 2. Durchgang: ein Stamm reicht bis zu jedem stehenden Abzweig und T-Kopf desselben Stegs
    linien.forEach((stamm, i) => {
      const r = bereich[i];
      if (r.art !== 'stamm') return;
      linien.forEach((ast, j) => {
        if (j === i || ast.steg !== stamm.steg || bereich[j].bis <= 0) return;
        if (bereich[j].art === 'tkopf') {
          let acc = 0;
          stamm.punkte.forEach(([x, y], k) => {
            if (k > 0) acc += Math.hypot(x - stamm.punkte[k - 1][0], y - stamm.punkte[k - 1][1]);
            if (aufLinie(ast.punkte, x, y).d < 3) r.bis = Math.max(r.bis, acc);
          });
        } else {
          const [x, y] = ast.punkte[0];
          const h = aufLinie(stamm.punkte, x, y);
          if (y > 8 && h.d < 2) r.bis = Math.max(r.bis, h.s);
        }
      });
    });
    // 3. Zeichnen: Gebautes als Steg, Kaufbares als heller Bauplatz dahinter
    linien.forEach((linie, i) => {
      const g = new THREE.Group();
      const r = bereich[i];
      if (r.bis > 0) baueLinie(linie, g, r.bis >= r.gesamt - 0.01 ? linie.punkte : teilLinie(linie.punkte, 0, r.bis));
      if (r.projekt && r.plan > r.bis + 0.5) geisterLinie(linie, teilLinie(linie.punkte, r.bis, r.plan), r.projekt, g);
      if (linie.steg && g.children.some((o) => !o.userData.bauplatz)) g.userData.pick = { type: 'jetty', id: linie.steg };
      gruppe.add(g);
    });

    let nr = 0;
    let letzterSteg = null;
    for (const { p, st } of liste) {
      if (p.steg !== letzterSteg) { nr = 0; letzterSteg = p.steg; }
      const n2 = nr++;
      if (st.status !== 'aus') liegeplatz(p, gruppe, n2, st);
    }
    root.add(gruppe);
    api.stage = Number(stufe);
    highlight(markiert.ids, markiert.farbe);
    game.emit('stege', { stufe: Number(stufe), plaetze: plaetze.size, bauplaetze: bauplaetze.length });
  }

  // Noch nicht gekaufter Stegteil: heller, durchscheinender Umriss auf dem Wasser
  function geisterLinie(linie, punkte, projektId, g) {
    const b = Math.max(1.0, linie.breite * U);
    const pts = punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const m = segment(pts[i], pts[i + 1], b, 0.08, 0.06, M.bauflaeche);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), M.baurand));
      m.userData.pick = { type: 'buildsite', id: projektId };
      m.userData.bauplatz = projektId;
      m.renderOrder = 2;
      g.add(m);
      bauplaetze.push(m);
    }
  }

  function setStage(n) { aufbauen(n == null ? undefined : n); }

  function highlight(ids, farbe = '#ffd23f') {
    markiert = { ids: [...(ids ?? [])], farbe };
    const set = new Set(markiert.ids);
    for (const p of plaetze.values()) {
      const an = set.has(p.id);
      p.mesh.material.opacity = an ? 0.45 : 0;
      if (an) p.mesh.material.color.set(farbe);
    }
  }

  // Hoehe der Laufoberflaeche ueber dem Wasser in Metern, z. B. fuer Fussgaenger
  const DECK = { holz: 0.86, schwimmsteg: 0.46, kai: 1.3 };
  const deckHoehe = (bauart) => DECK[bauart] ?? DECK.holz;

  const api = {
    group: root, setStage, highlight, deckHoehe, stage: 0,
    platz: (id) => plaetze.get(id) ?? null,
    bauplaetze: () => [...new Set(bauplaetze.map((m) => m.userData.bauplatz))],
  };
  game.stege = api;
  game.on('stufe', (n) => aufbauen(typeof n === 'object' ? n?.stufe : n));
  // Gekaufte Stegprojekte, geladener Spielstand, neue Stufe: neu aufbauen, wenn sich etwas geaendert hat
  game.on('build', () => aufbauen());
  game.on('sim:change', () => aufbauen());
  game.on('ready', () => aufbauen());

  // Bauplatz antippen oeffnet die Bauen-Karte (dort steht das Stegprojekt mit Preis)
  game.on('tap', (e) => {
    if (e?.pick?.type !== 'buildsite' || !api.bauplaetze().includes(e.pick.id)) return;
    game.emit('ui:bauplatz', { projekt: e.pick.id });
    // Baumodus mit Vorschau (ui/bauen.js), sonst wie bisher die Bauen-Karte
    if (game.bauen) { game.bauen.vorschau(`steg:${e.pick.id}`); return; }
    const body = document.body.classList;
    const bauenOffen = body.contains('card-open') && !body.contains('card-boat');
    if (!bauenOffen) document.getElementById('btn-build')?.click();
  });

  // Bauplaetze pulsieren leicht, damit man sie als antippbar erkennt
  game.onTick(() => {
    if (!bauplaetze.length) return;
    M.bauflaeche.opacity = 0.28 + 0.12 * Math.sin(performance.now() / 400);
  });

  aufbauen();
  return api;
}

export default init;
