// Vorbeifahrende Boote: Kulisse, damit der Hafen von Anfang an belebt wirkt.
//
// - Stufe 1 und 2: ein Kanu paddelt am Ufer neben dem Steg; Jollen, Kanus, Ruder- und Tuckerboote ziehen auf dem Binnensee große Runden.
// - Alle Stufen: auf der Ostsee hinter der Nehrung fahren Segler, Kutter und Motorboote vorbei,
//   mit steigender Stufe auch Yachten, XL-Schiffe und ab Stufe 5 Kreuzfahrt- und Marineschiffe.
// Die Bahnen liegen weit genug von Wartebojen, Ankerflächen, Molen, Einfahrt und Liegeplätzen.
// Kommt ein anderes Boot in den Weg (z. B. ein Gast auf dem Weg zur Boje), hält das vorbeifahrende
// Boot an und wartet. Vorbeifahrende Boote sind nicht antippbar und zählen nicht in den Spielregeln.
//
// Bewegung, Kielwasser, Krängung und Segel kommen aus boat-anim.js (addBoat, sailTo).
// Modelle kommen aus game.boatTypes (s, m, l, xl, xxl), also aus den Dateien der Bootsgrößen.
//
// Schnittstelle: game.verkehr = { boote, stufe, bahnen(stufe) }   (zum Prüfen in der Konsole)

import { addBoat } from '../boat-anim.js';

import { U, welt, SEE_X, SEE, SEE_RUNDE, FLOTTE, ANZAHL, aufBahn, seeBahnen, seeRunde, bisStufe, uferStrecke, versetzt, VERSATZ_MAX } from '../../data/verkehr.js';

// Reisegeschwindigkeit in m/s, gemütlich
function tempo(info, id) {
  if (info.kind === 'row' || /^S(1-|2-|3-1)/.test(id)) return 1.1;   // Ruderboote, Kanus, Kajaks
  if (/^S2-4|^S2-5/.test(id)) return 0.9;                               // Tretboote
  const s = info.size;
  if (s === 'S') return info.kind === 'sail' ? 1.9 : 2.4;
  if (s === 'M') return info.kind === 'sail' ? 2.3 : 2.8;
  if (s === 'L') return 3.0;
  if (s === 'XL') return 3.4;
  return 4.0;
}

function groesseVon(id) {
  const m = /^(XXL|XL|S|M|L)/.exec(id);
  return m ? m[1] : null;
}

// --- Modul ----------------------------------------------------------------------------------------
export function init(game) {
  const boote = new Set();       // { anim, typ: 'see'|'meer', bahn, inset }
  let stufeAktiv = 0;
  let naechstes = 0;
  let laufzeit = 0;

  // ?stufe=3 in der Adresse zeigt die Landschaft einer Stufe (render/landscape.js), dann auch hier
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const urlStufe = Number(q?.get('stufe')) || null;
  const stufe = () => urlStufe ?? game.state?.stage ?? game.state?.stufe ?? 1;
  const zufall = (list) => list[Math.floor(Math.random() * list.length)];

  function baue(id) {
    const g = groesseVon(id);
    const types = game.boatTypes?.[g?.toLowerCase()];
    if (!types?.buildBoat) return null;
    const model = types.MODELS?.find((m) => m.id === id);
    if (!model) return null;
    let group;
    try {
      group = types.buildBoat(model, { palette: Math.floor(Math.random() * 3), sails: false });
    } catch (err) {
      console.warn('verkehr: Modell nicht baubar', id, err);
      return null;
    }
    delete group.userData.pick;          // Kulisse, nicht antippbar
    group.traverse((o) => { if (o.userData?.pick) delete o.userData.pick; });
    group.name = `verkehr-${id}`;
    group.userData.verkehr = true;
    return { group, types, groesse: g, id };
  }

  function anmelden(gebaut) {
    const anim = addBoat(game, gebaut.group, {
      id: gebaut.group.uuid,
      size: gebaut.groesse,
      animate: gebaut.types.animateBoat,
      setSails: gebaut.types.setSails,
      sails: false,
    });
    const v = tempo(anim.info, gebaut.id) * (0.82 + Math.random() * 0.36);   // jedes Boot etwas anders schnell
    anim.cfg.cruise = v;
    return { anim, v, modell: gebaut.id, wartet: 0, dispose: gebaut.groesse === 'XL' || gebaut.groesse === 'XXL' };
  }

  function entferne(b) {
    boote.delete(b);
    const model = b.anim.model;
    b.anim.remove();
    if (b.dispose) model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  // --- Runde auf dem Binnensee
  // Runden auf dem See: Drehsinn wird je Spiel ausgewürfelt, alle Boote fahren gleich herum
  const drehsinn = Math.random() < 0.5 ? 1 : -1;

  function rundenPunkte(r, inset, startWinkel) {
    const pts = [];
    const n = 40;
    const f = (c) => Math.sign(c) * Math.abs(c) ** 0.5;      // Superellipse n = 4: lange gerade Seiten
    for (let i = 1; i <= n; i++) {
      const a = startWinkel + drehsinn * (i / n) * Math.PI * 2;
      pts.push(welt(r.cx + (r.rx - inset) * f(Math.cos(a)), r.cy + (r.ry - inset) * f(Math.sin(a))));
    }
    return pts;
  }

  function winkelAuf(r, x, z) {
    const px = x / U, py = -z / U;
    return Math.atan2((py - r.cy) / r.ry, (px - r.cx) / r.rx);
  }

  function seeBoot(index) {
    const r = seeRunde(stufeAktiv);
    if (!r) return;
    const gebaut = baue(zufall(FLOTTE.see));
    if (!gebaut) return;
    const b = anmelden(gebaut);
    b.typ = 'see';
    b.inset = index * 8;                         // 8 Planeinheiten = 5 m Abstand zwischen den Runden
    const a0 = Math.random() * Math.PI * 2;
    const f = (c) => Math.sign(c) * Math.abs(c) ** 0.5;
    const p = welt(r.cx + (r.rx - b.inset) * f(Math.cos(a0)), r.cy + (r.ry - b.inset) * f(Math.sin(a0)));
    const q = welt(r.cx + (r.rx - b.inset) * f(Math.cos(a0 + drehsinn * 0.05)), r.cy + (r.ry - b.inset) * f(Math.sin(a0 + drehsinn * 0.05)));
    b.anim.place(p.x, p.z, Math.atan2(-(q.z - p.z), q.x - p.x));
    boote.add(b);
    weiterRunde(b);
  }

  function weiterRunde(b) {
    const r = seeRunde(stufeAktiv);
    if (!r || !boote.has(b)) return;
    // Jede Runde etwas anders: Abstand zur Mitte (0 bis 2 Planeinheiten) und Tempo wechseln,
    // ab und zu bleibt ein Boot eine Weile treiben (Pause zum Baden, Angeln, Segel trimmen)
    const pts = rundenPunkte(r, b.inset + Math.random() * 2, winkelAuf(r, b.anim.x, b.anim.z));
    b.v = tempo(b.anim.info, b.modell) * (0.82 + Math.random() * 0.36);
    const n = 8 + Math.floor(Math.random() * (pts.length - 8));     // nur ein Stück der Runde, dann neu würfeln
    b.anim.sailTo(pts.slice(0, n), { sails: b.anim.info.kind === 'sail', stop: false })
      .then((ok) => {
        if (!ok) return;
        if (Math.random() < 0.25) { b.treibtBis = laufzeit + 8 + Math.random() * 20; b.anim.cfg.cruise = 0; }
        else weiterRunde(b);
      });
  }

  // --- Paddler am Ufer: hin und her, an den Enden kurz Pause
  function uferBoot() {
    const u = uferStrecke(stufeAktiv);
    if (!u) return;
    const gebaut = baue(zufall(FLOTTE.ufer));
    if (!gebaut) return;
    const b = anmelden(gebaut);
    b.typ = 'ufer';
    const px = u.x0 + (u.x1 - u.x0) * (0.3 + 0.4 * Math.random());
    const p = welt(px, u.y);
    b.anim.place(p.x, p.z, 0);
    boote.add(b);
    pendeln(b, 1);
  }

  function pendeln(b, richtung) {
    const u = uferStrecke(stufeAktiv);
    if (!u || !boote.has(b)) return;
    const ziel = welt(richtung > 0 ? u.x1 : u.x0, u.y + (Math.random() * 6 - 3));
    b.anim.sailTo([ziel], { stop: true }).then((ok) => {
      if (!ok) return;
      b.richtung = -richtung;
      b.pauseBis = laufzeit + 3 + Math.random() * 6;   // Spielzeit, steht bei Pause still
    });
  }

  // --- Seebahnen hinter der Nehrung
  function meerBoot(fortschritt = 0) {
    const bahnen = seeBahnen(stufeAktiv);
    const art = Math.random() < 0.6 ? 'klein' : 'gross';
    let frei = bahnen.filter((l) => l.art === art && bahnFrei(l, fortschritt));
    if (!frei.length) frei = bahnen.filter((l) => bahnFrei(l, fortschritt));
    if (!frei.length) return false;
    const bahn = zufall(frei);
    const pool = bisStufe(FLOTTE[bahn.art], stufeAktiv).filter((id) => bahn.xxl || !id.startsWith('XXL'));
    const gebaut = baue(zufall(pool));
    if (!gebaut) return false;
    const b = anmelden(gebaut);
    b.typ = 'meer';
    b.bahn = bahn;
    // Jedes Boot fährt die Bahn mit eigenem seitlichem Versatz, nicht alle auf derselben Linie
    const pts = versetzt(bahn.pts, -Math.random() * (bahn.versatz ?? VERSATZ_MAX));   // nach rechts, weg von der Gegenbahn
    const { p, dir, weiter } = aufBahn(pts, fortschritt);
    const start = welt(p[0], p[1]);
    b.anim.place(start.x, start.z, Math.atan2(dir[1], dir[0]));   // Plan y nach Norden = Welt -z
    b.anim.speed = b.v;
    boote.add(b);
    b.anim.sailTo(weiter.map(([x, y]) => welt(x, y)), { sails: b.anim.info.kind === 'sail', stop: false })
      .then(() => { if (boote.has(b)) entferne(b); });
    return true;
  }

  // Ist der Anfang der Bahn frei (kein anderes vorbeifahrendes Boot näher als 60 m plus seine Länge)?
  function bahnFrei(bahn, fortschritt) {
    const [px, py] = aufBahn(bahn.pts, fortschritt).p;
    const w = welt(px, py);
    for (const b of boote) if (b.bahn === bahn && Math.hypot(b.anim.x - w.x, b.anim.z - w.z) < 60 + b.anim.info.length) return false;
    return true;
  }

  // --- Ausweichen: Boot vor dem Bug? Dann anhalten, bis es weg ist (höchstens 45 s).
  function vorDemBug(b) {
    const a = b.anim;
    const ch = Math.cos(a.heading), sh = Math.sin(a.heading);
    for (const o of game.boatAnim?.boats ?? []) {
      if (o === a) continue;
      const dx = o.x - a.x, dz = o.z - a.z;
      const vor = dx * ch - dz * sh;                       // Bug: (cos h, -sin h)
      const quer = Math.abs(dx * sh + dz * ch);
      const laenge = (a.info.length + o.info.length) / 2;
      const breite = (a.info.beam + o.info.beam) / 2 + 3;
      // Bremsweg wächst mit Tempo und Größe: große Schiffe brauchen länger zum Aufstoppen
      if (vor > 0 && vor < laenge + 6 + a.speed * (4 + a.info.length / 25) && quer < breite) return true;
    }
    return false;
  }

  function aufraeumen() {
    for (const b of [...boote]) entferne(b);
  }

  function aufbauen() {
    aufraeumen();
    stufeAktiv = stufe();
    const nSee = ANZAHL.see[stufeAktiv] ?? 0;
    for (let i = 0; i < nSee; i++) seeBoot(i);
    if (uferStrecke(stufeAktiv)) uferBoot();
    // Beim Start schon ein paar Boote unterwegs, verteilt auf der Bahn
    const nMeer = Math.min(3, ANZAHL.meer[stufeAktiv] ?? 3);
    for (let i = 0; i < nMeer; i++) meerBoot(0.15 + 0.7 * Math.random());
    naechstes = 6 + Math.random() * 10;
  }

  game.onTick((dt) => {
    if (!dt) return;
    laufzeit += dt;
    if (stufe() !== stufeAktiv) aufbauen();
    for (const b of boote) {
      if (b.pauseBis && laufzeit >= b.pauseBis) { b.pauseBis = 0; pendeln(b, b.richtung); }
      if (b.treibtBis) {
        if (laufzeit < b.treibtBis) { b.anim.cfg.cruise = 0; continue; }
        b.treibtBis = 0; weiterRunde(b);
      }
      const halt = b.wartet < 45 && vorDemBug(b);
      b.wartet = halt ? b.wartet + dt : Math.max(0, b.wartet - dt * 0.5);
      b.anim.cfg.cruise = halt ? 0 : b.v;
    }
    naechstes -= dt;
    if (naechstes <= 0) {
      const meer = [...boote].filter((b) => b.typ === 'meer').length;
      if (meer < (ANZAHL.meer[stufeAktiv] ?? 3)) meerBoot(0);
      naechstes = 8 + Math.random() * 14;
    }
  });

  game.verkehr = {
    get boote() { return [...boote].map((b) => ({ typ: b.typ, id: b.anim.model.name, x: b.anim.x, z: b.anim.z, speed: b.anim.speed })); },
    get stufe() { return stufeAktiv; },
    bahnen: (s) => ({ see: seeRunde(s), meer: seeBahnen(s) }),
  };
}

