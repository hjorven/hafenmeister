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

const U = 0.62;                                    // Meter je Planeinheit (wie harbor.js)
const welt = (px, py) => ({ x: px * U, z: -py * U });

// --- Bahnen in Planeinheiten (x nach Osten, y nach Norden) ---------------------------------------
// Wartebojen und Ankerflächen: render/landschaft/gelaende.js warteplaetze(); Molen, Buhnen und
// Fahrrinne ebenda. "klein" für S bis L, "gross" für L bis XXL. Die Bahnen beginnen und enden weit
// außerhalb der Karte. Rechtsverkehr: ostwärts auf der Landseite, westwärts weiter draußen.
// Ab Stufe 3 biegen die kleinen Bahnen vor der Einfahrt nach Norden ab, damit sie in der Startansicht
// zu sehen sind und trotzdem Reede, Ankerflächen und Fahrrinne im Osten frei lassen.
const SEE_X = 440;            // Ostende, außerhalb der Karte (Karte bis x 306)
// Im Westen liegt ab x -360 Land, die Küste zieht nach Norden. Dort kommen und gehen die Boote
// längs der Küste von Norden; innere (südliche) Bahnen biegen weiter westlich ab, damit sich nichts kreuzt.
const westen = (y, xKurve) => [[xKurve - 14, 760], [xKurve, y + 50], [xKurve + 40, y]];
const ostwaerts = (y, xKurve, rest = [[SEE_X, y]]) => [...westen(y, xKurve), ...rest];
const westwaerts = (y, xKurve, vorher = [[SEE_X, y]]) => [...vorher, ...westen(y, xKurve).reverse()];
const SEE = {
  // Noch kein Durchstich: die See ist frei, Bahnen gut 6 m vor den Buhnenköpfen (y bis 254)
  1: [
    { pts: ostwaerts(264, -340), art: 'klein' }, { pts: westwaerts(278, -326), art: 'klein' },
    { pts: ostwaerts(306, -298), art: 'gross' }, { pts: westwaerts(326, -278), art: 'gross' },
  ],
  // Stufe 3 und 4: Molenköpfe bis y 268 (x 149 bis 187), Rinne bis y 356 (x 152 bis 212),
  // Reede ab x 222, Ankerfläche um (300, 330). Die kleinen Bahnen biegen vor der Einfahrt nach Norden ab.
  3: [
    { pts: ostwaerts(292, -340, [[50, 292], [112, 326], [176, 470], [206, 760]]), art: 'klein' },
    { pts: westwaerts(306, -326, [[192, 760], [162, 474], [100, 340], [46, 306]]), art: 'klein' },
    { pts: ostwaerts(436, -300), art: 'gross' }, { pts: westwaerts(456, -280), art: 'gross' },
  ],
  // Ab Stufe 5: Außenhafen mit Westmole bis (96, 320), Rinne bis y 356 (x 108 bis 184),
  // große Ankerfläche um (60, 420), Reede ab x 226. XXL (bis 29 m breit) nur auf der äußersten Bahn.
  5: [
    { pts: ostwaerts(268, -340, [[-112, 268], [-46, 298], [-28, 342], [40, 352], [104, 358], [166, 476], [196, 760]]), art: 'klein' },
    { pts: westwaerts(282, -326, [[182, 760], [152, 480], [94, 370], [38, 366], [-42, 356], [-60, 310], [-116, 282]]), art: 'klein' },
    { pts: ostwaerts(526, -300), art: 'gross' }, { pts: westwaerts(562, -250), art: 'gross', xxl: true },
  ],
};

// Punkt auf einer Bahn bei Anteil f (0 bis 1) und die restlichen Eckpunkte danach
function aufBahn(pts, f) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l); total += l;
  }
  let rest = total * f;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, rest / seg[i]) : 0;
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: [bx - ax, by - ay], weiter: pts.slice(i + 1) };
    }
    rest -= seg[i];
  }
  return { p: pts[0], dir: [1, 0], weiter: pts.slice(1) };
}

// Runden auf dem Binnensee (nur solange der See noch kein Hafenbecken ist).
// Superellipse: Mitte, Halbachsen; die Boote fahren mit seitlichem Versatz, damit sie sich nicht treffen.
const SEE_RUNDE = {
  1: { cx: 40, cy: 136, rx: 195, ry: 30 },   // nördlich der Bojen (y bis 56), Ankerfläche bis y 86, Einfahrt der Gäste bei (-58, 90)
  2: { cx: 180, cy: 142, rx: 125, ry: 22 },  // östlich der Ankerfläche (x bis 36), Liegeplätze bis y 67
};

// Ein Kanu oder Ruderboot paddelt in Ufernähe östlich der Stege hin und her (in der Startansicht zu sehen).
// Wassertiefe bei y 18 gut 1 m. Liegeplätze der Stufe 1 enden bei x -96, der Stufe 2 bei x -40;
// Gäste fahren nördlich davon (Bojen ab y 50) zu den Plätzen.
const UFER = {
  1: { x0: -82, x1: -50, y: 18 },
  2: { x0: -26, x1: 60, y: 18 },
};

const seeBahnen = (stufe) => SEE[stufe >= 5 ? 5 : stufe >= 3 ? 3 : 1];
const seeRunde = (stufe) => (stufe <= 2 ? SEE_RUNDE[Math.max(1, stufe)] : null);

// --- Welche Boote wo fahren ---------------------------------------------------------------------
// Modell-ids aus web/js/data/boats/<größe>.js; steigende Stufe bringt größere Boote dazu.
const FLOTTE = {
  ufer: ['S2-1', 'S2-2', 'S2-3', 'S1-1', 'S1-2', 'S1-4'],
  see: ['S4-2', 'S4-3', 'S4-4', 'S4-5', 'S2-1', 'S2-2', 'S2-3', 'S1-1', 'S5-4', 'M1-1'],
  klein: {
    1: ['S5-1', 'S5-2', 'S5-5', 'M2-1', 'M2-2', 'M2-4', 'M2-5', 'M4-2', 'M4-3'],
    2: ['M1-2', 'M1-3', 'M1-4', 'M3-1', 'M3-3', 'M4-4'],
    3: ['L1-1', 'L1-4', 'L3-2', 'L3-4'],
  },
  gross: {
    1: ['M4-4', 'M4-5', 'L1-1', 'L1-5', 'L4-4'],
    2: ['L1-3', 'L3-1', 'L3-2', 'L4-3'],
    3: ['L2-1', 'L2-2', 'L4-2', 'L4-5'],
    4: ['XL1-1', 'XL1-2', 'XL1-3', 'XL1-4', 'XL1-5', 'XL2-1', 'XL2-2', 'XL2-3', 'XL2-4', 'XL2-5', 'XL3-1', 'XL3-2', 'XL3-3', 'XL3-4', 'XL3-5'],
    5: ['XXL1-1', 'XXL1-2', 'XXL1-3', 'XXL2-1', 'XXL2-2', 'XXL2-3'],
  },
};
const bisStufe = (table, stufe) => Object.entries(table).filter(([k]) => +k <= stufe).flatMap(([, v]) => v);

// Wie viele Boote gleichzeitig unterwegs sind
const ANZAHL = {
  see: { 1: 3, 2: 3 },
  meer: { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5 },
};

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
    const v = tempo(anim.info, gebaut.id);
    anim.cfg.cruise = v;
    return { anim, v, wartet: 0, dispose: gebaut.groesse === 'XL' || gebaut.groesse === 'XXL' };
  }

  function entferne(b) {
    boote.delete(b);
    const model = b.anim.model;
    b.anim.remove();
    if (b.dispose) model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  // --- Runde auf dem Binnensee
  function rundenPunkte(r, inset, startWinkel) {
    const pts = [];
    const n = 40;
    const f = (c) => Math.sign(c) * Math.abs(c) ** 0.5;      // Superellipse n = 4: lange gerade Seiten
    for (let i = 1; i <= n; i++) {
      const a = startWinkel + (i / n) * Math.PI * 2;         // gegen den Uhrzeigersinn im Plan
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
    b.inset = index * 7;                         // 7 Planeinheiten = gut 4 m Abstand zwischen den Runden
    const a0 = Math.random() * Math.PI * 2;
    const f = (c) => Math.sign(c) * Math.abs(c) ** 0.5;
    const p = welt(r.cx + (r.rx - b.inset) * f(Math.cos(a0)), r.cy + (r.ry - b.inset) * f(Math.sin(a0)));
    const q = welt(r.cx + (r.rx - b.inset) * f(Math.cos(a0 + 0.05)), r.cy + (r.ry - b.inset) * f(Math.sin(a0 + 0.05)));
    b.anim.place(p.x, p.z, Math.atan2(-(q.z - p.z), q.x - p.x));
    boote.add(b);
    weiterRunde(b);
  }

  function weiterRunde(b) {
    const r = seeRunde(stufeAktiv);
    if (!r || !boote.has(b)) return;
    const pts = rundenPunkte(r, b.inset, winkelAuf(r, b.anim.x, b.anim.z));
    b.anim.sailTo(pts, { sails: b.anim.info.kind === 'sail', stop: false })
      .then((ok) => { if (ok) weiterRunde(b); });
  }

  // --- Paddler am Ufer: hin und her, an den Enden kurz Pause
  function uferBoot() {
    const u = UFER[stufeAktiv];
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
    const u = UFER[stufeAktiv];
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
    const { p, dir, weiter } = aufBahn(bahn.pts, fortschritt);
    const start = welt(p[0], p[1]);
    b.anim.place(start.x, start.z, Math.atan2(dir[1], dir[0]));   // Plan y nach Norden = Welt -z
    b.anim.speed = b.v;
    boote.add(b);
    b.anim.sailTo(weiter.map(([x, y]) => welt(x, y)), { sails: b.anim.info.kind === 'sail', stop: false })
      .then(() => { if (boote.has(b)) entferne(b); });
    return true;
  }

  // Ist der Anfang der Bahn frei (kein anderes vorbeifahrendes Boot in 60 m)?
  function bahnFrei(bahn, fortschritt) {
    const [px, py] = aufBahn(bahn.pts, fortschritt).p;
    const w = welt(px, py);
    for (const b of boote) if (b.bahn === bahn && Math.hypot(b.anim.x - w.x, b.anim.z - w.z) < 60) return false;
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
      if (vor > 0 && vor < laenge + 4 + a.speed * 4 && quer < breite) return true;
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
    if (UFER[stufeAktiv]) uferBoot();
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

// Für tests/verkehr.test.mjs: Bahnen prüfen, ohne das Spiel zu starten
export { SEE as SEEBAHNEN, SEE_RUNDE, UFER, FLOTTE };
