// Besuchsschiffe der Services: Ausflugsschiff am Fahrgastanleger (taeglich), Kreuzfahrtschiff an der
// Kreuzfahrtpier, Marineschiffe am Marineanleger und Windjammer vor der Grossschiffpier (regelmaessige
// Besuche aus js/services/rules.js), dazu die Barkasse mit zwei Hafenrundfahrten am Tag.
// Die Schiffe laufen morgens ein, liegen an ihrem Platz und laufen am letzten Besuchstag abends wieder aus.
// Alle melden sich bei game.boatAnim.hindernis an (falls vorhanden), damit Gastboote ausweichen.
// Wird von js/render/services.js gestartet, kein eigener Eintrag in MODULES.
//
// Falls der Schiffs-Thread spaeter eigene XXL-Modelle anbietet (game.boatTypes.xxl), werden
// diese genommen; bis dahin zeichnet dieses Modul schlichte Flat-Modelle.
import * as THREE from 'three';
import { FARBE, box, zyl, flagge, rumpf, mat, barkasseBoot } from './services-models.js';
import { HAFEN } from '../data/harbor.js';
import { AUFTRITTE, RUNDFAHRTEN, liegePunkt } from '../data/besuchswege.js';

const U = 0.62;
const W = (x, y) => new THREE.Vector3(x * U, 0, -y * U);

// ------------------------------------------------------------------ Modelle (Bug nach +x)
function fenster(g, len, y, z, c = FARBE.glass) {
  box(g, len, 0.5, 0.06, c, 0, y, z);
  box(g, len, 0.5, 0.06, c, 0, y, -z);
}

function ausflugsschiff() {
  // 18 m Fahrgastschiff: passt an K01 zwischen Fischerbox FK01 und Kai K02 (besuchswege.js, liegeVersatz)
  const g = new THREE.Group();
  rumpf(g, 18, 5.6, 2.4, FARBE.white, 0, 0, 0, 0, FARBE.white);
  box(g, 16.5, 0.5, 5.7, FARBE.blue, -0.4, 0.2, 0);                   // blauer Streifen
  box(g, 11, 2.4, 4.8, FARBE.white, -1.5, 1.7, 0);                    // Hauptdeck
  fenster(g, 8, 2.6, 2.42);
  box(g, 7.5, 2.2, 4.4, FARBE.white, -2.2, 4.1, 0);                   // Oberdeck
  box(g, 2.6, 1.6, 3.2, FARBE.white, 2.7, 4.1, 0);                    // Steuerhaus
  box(g, 0.1, 0.8, 3, FARBE.glass, 4.02, 4.5, 0);
  box(g, 8, 0.15, 5, FARBE.blue, -2.2, 6.3, 0);                       // Sonnendach
  zyl(g, 0.08, 4, FARBE.white, 2.7, 5.7, 0, 4);
  // Fahrgaeste an Deck: bunte Punkte
  const farben = [FARBE.red, FARBE.yellow, FARBE.navy, FARBE.green, FARBE.coral];
  for (let i = 0; i < 6; i++) zyl(g, 0.25, 0.9, farben[i % 5], -5.4 + i * 1.2, 4.1 + 2.2, (i % 2 ? 1 : -1) * 1.4, 6);
  return { group: g, laenge: 18 };
}

function kreuzfahrtschiff() {
  const g = new THREE.Group();
  const L = 72, B = 13;
  rumpf(g, L, B, 9, FARBE.navy, 0, -2, 0, 0, FARBE.white);
  box(g, L * 0.92, 2.2, B + 0.1, FARBE.white, -1.5, 2.4, 0);          // weisse Bordwand oben
  const stufen = [[L * 0.78, 3.2], [L * 0.68, 3], [L * 0.56, 3], [L * 0.36, 2.6]];
  let y = 4.6;
  stufen.forEach(([l, h], i) => {
    box(g, l, h, B - 1 - i * 1.4, FARBE.white, -4 - i * 1.5, y, 0);
    fenster(g, l - 1, y + h * 0.4, (B - 1 - i * 1.4) / 2 + 0.03, i === 0 ? FARBE.blue : FARBE.glass);
    y += h;
  });
  box(g, 1.2, 1.6, B - 2, FARBE.glass, L * 0.22, 7.2, 0);             // Bruecke
  // Rettungsboote
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) box(g, 3, 1, 1.2, FARBE.orange, -24 + i * 5, 5.2, s * (B / 2 - 0.2));
  // Schornstein und Pool
  box(g, 6, 5, 4.4, FARBE.coral, -18, y, 0);
  box(g, 6.2, 1, 4.6, FARBE.navy, -18, y + 5, 0);
  box(g, 7, 0.1, 4, '#7cc8dc', -6, y + 0.02, 0);
  zyl(g, 0.15, 6, FARBE.white, 12, y, 0, 4);
  return { group: g, laenge: L };
}

function korvette(l = 64, b = 9.5) {
  const g = new THREE.Group();
  const grau = FARBE.navyGrey;
  rumpf(g, l, b, 5, grau, 0, -1.2, 0, 0, '#9aa4ae');
  box(g, l * 0.3, 3.4, b * 0.7, grau, -l * 0.02, 2.4, 0);             // Aufbau
  box(g, l * 0.12, 2.4, b * 0.55, grau, -l * 0.18, 5.8, 0);
  box(g, 0.1, 0.7, b * 0.6, FARBE.glass, l * 0.13 + 0.05, 4.8, 0);
  zyl(g, 0.4, 7, grau, l * 0.02, 5.8, 0, 6, 0.6);                     // Mast
  const radar = box(g, 3, 0.25, 0.5, FARBE.white, l * 0.02, 12.9, 0);
  zyl(g, 1.2, 1, grau, l * 0.27, 2.4, 0, 10);                         // Geschuetzturm
  const rohr = box(g, 3, 0.25, 0.25, grau, l * 0.27 + 1.8, 2.9, 0);
  rohr.rotation.z = 0.15;
  box(g, l * 0.15, 0.1, b * 0.7, '#6e7a86', -l * 0.38, 1.81, 0);      // Hubschrauberdeck
  const fl = flagge(g, -l * 0.48, 0, 3, FARBE.navy, 1.8);
  return { group: g, laenge: l, radar, fl };
}

const MODELL = { ausflugsschiff, kreuzfahrtschiff, korvette, minenjagdboot: () => korvette(42, 9) };

// ------------------------------------------------------------------ Fahrten
// Wege, Liegeplaetze und Masse stehen in js/data/besuchswege.js (geprueft von tests/besuchswege.test.mjs).

const DAUER = 0.12;     // Anteil des Tages fuer eine Fahrt vom Liegeplatz nach See (ohne eigene 'fahrt')

function wegLaenge(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}

// Punkt und Fahrtrichtung bei Anteil t (0 = Liegeplatz, 1 = See)
function aufWeg(pts, t) {
  const ziel = t * wegLaenge(pts);
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].distanceTo(pts[i - 1]);
    if (s + d >= ziel || i === pts.length - 1) {
      const k = d > 0 ? Math.min(1, (ziel - s) / d) : 0;
      const p = pts[i - 1].clone().lerp(pts[i], k);
      const r = pts[i].clone().sub(pts[i - 1]);
      return { p, kurs: Math.atan2(-r.z, r.x), segment: i - 1 };
    }
    s += d;
  }
  return { p: pts[0].clone(), kurs: 0, segment: 0 };
}

const glatt = (x) => x * x * (3 - 2 * x);
function winkelZu(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

export function initBesuche(game, services) {
  const gruppe = new THREE.Group();
  gruppe.name = 'services-besuche';
  game.scene.add(gruppe);
  const aktiv = new Map();      // id -> [{ obj, weg, kurs, liege, ... }]
  let heute = { tag: -1, besuch: new Set() };

  // Welche Besuche finden heute statt? (nach dem Plan in rules.js, Sturm verschiebt)
  // Mehrtaegige Besuche (Windjammer, Flottenbesuch) merken sich ihren letzten Tag im Spielstand:
  // z.laufend[id] = { von, bis }. rules.js rechnet den Besuch am Abend des ersten Tages ab.
  function besucheHeute() {
    const tag = game.state?.tag ?? 1;
    const z = services.zustand();
    const s = new Set();
    const nr = new Map();
    for (const id of Object.keys(AUFTRITTE)) {
      const a = AUFTRITTE[id];
      if (!(services.stufeVon(id) >= (a.abStufe ?? 1))) continue;
      const l = z.laufend?.[id];
      if (a.jedenTag) { if (!(id === 'fahrgastanleger' && game.sim?.platzZustand?.('K01') === 'belegt')) s.add(id); }
      else if (l && tag > l.von && tag <= l.bis) { s.add(id); nr.set(id, { tagNr: tag - l.von, tage: l.bis - l.von + 1 }); }
      else if (z.besuche[id] != null && z.besuche[id] <= tag) { s.add(id); nr.set(id, { tagNr: 0, tage: dauerVon(id) }); }
    }
    return { tag, besuch: s, nr };
  }
  const dauerVon = (id) => services.besuchVon?.(id)?.dauer ?? 1;

  game.on('services:besuch', (b) => {
    if (!(b.dauer > 1)) return;
    const z = services.zustand();
    z.laufend ??= {};
    z.laufend[b.id] = { von: b.tag, bis: b.tag + b.dauer - 1 };
  });

  // XXL-Modelle des Schiffs-Threads (render/boats/xxl.js: game.boatTypes.xxl), sonst eigene Modelle
  const XXL_ID = { kreuzfahrtschiff: 'XXL1-3', korvette: 'XXL2-2', minenjagdboot: 'XXL2-1' };
  function xxlModell(name) {
    try {
      const alt = game.boats?.xxl?.modell?.(name);
      if (alt) return alt;
      const xxl = game.boatTypes?.xxl;
      const m = XXL_ID[name] && xxl?.MODELS?.find?.((q) => q.id === XXL_ID[name]);
      return m ? xxl.buildBoat(m, { palette: 0 }) : null;
    } catch (err) {
      console.warn('XXL-Modell nicht baubar, nehme eigenes', name, err);
      return null;
    }
  }

  // XL-Modelle (Traditionssegler) aus render/boats/xl.js, mit Segeln
  function xlModell(id) {
    try {
      const xl = game.boatTypes?.xl;
      const m = xl?.MODELS?.find?.((q) => q.id === id);
      return m ? xl.buildBoat(m, { palette: 0, sails: false }) : null;
    } catch (err) {
      console.warn('XL-Modell nicht baubar', id, err);
      return null;
    }
  }

  // Bei der Bootsanimation als Hindernis anmelden (Schnittstelle des Thread Schiffsanimationen)
  function alsHindernis(group, laenge, breite) {
    try { return game.boatAnim?.hindernis?.(group, { laenge, breite }) ?? null; } catch { return null; }
  }

  // Wege eines Besuchsschiffs. Der Teil im Hafen kommt aus data/besuchswege.js, der Teil draussen
  // aus der Fahrwasserkarte (game.fahrwasser.seeWeg): vom letzten Punkt im Hafen bis hinter den
  // Kartenrand, Ausgang nahe dem alten Seepunkt. So passt der Weg zu jeder Gelaendeform.
  // nachSee: so viele Wegstuecke gehoeren zum festen Teil (dort faehrt 'rueckwaerts' achteraus).
  function wege(d, laenge, breite) {
    const platz = liegePunkt(d);
    const fest = [platz, ...d.weg.slice(1)].map(([x, y]) => W(x, y));
    let weg = fest, nachSee = fest.length - 1;
    const fw = game.fahrwasser;
    if (fw?.seeWeg && fest.length >= 2) {
      const see = fest[fest.length - 1];
      const kern = fest.slice(0, -1);
      const tief = Math.min(3, 1 + breite * 0.2);
      const r = breite / 2 + 1;
      // Vom letzten Hafenpunkt Richtung See, bis das Schiff frei liegt (eigenes Rechteck, Pier)
      let von = kern[kern.length - 1].clone();
      const schritt = see.clone().sub(von);
      const n = Math.max(1, Math.ceil(schritt.length() / 5));
      let frei = fw.befahrbar(von.x, von.z, r, tief);
      for (let i = 1; i <= n && !frei; i++) {
        von = kern[kern.length - 1].clone().addScaledVector(schritt, i / n);
        frei = fw.befahrbar(von.x, von.z, r, tief);
      }
      const draussen = frei && fw.seeWeg({ x: von.x, z: von.z }, {
        breiteM: breite, laengeM: laenge, tiefgangM: tief, groesse: laenge > 60 ? 'XXL' : laenge > 24 ? 'XL' : 'L',
        nahBei: { x: see.x, z: see.z } });
      if (draussen?.length) {
        const vor = von.distanceTo(kern[kern.length - 1]) > 0.5 ? [...kern, von] : kern;
        nachSee = vor.length - 1;
        weg = [...vor, ...draussen.map((p) => new THREE.Vector3(p.x, 0, p.z))];
      }
    }
    const ankunft = d.ankunft
      ? [...d.ankunft.slice(0, -1).map(([x, y]) => W(x, y)), weg[0]]
      : [...weg].reverse();
    return { weg, ankunft, nachSee, wegAlt: false };
  }
  // Zum Pruefen (Konsole, Tests): alle Wege nach See, je Auftritt und Schiff, in Weltmetern
  game.besuchsWege = () => Object.fromEntries(Object.entries(AUFTRITTE).map(([id, a]) => [id,
    a.schiffe.map((d) => wege(d, ...(d.masse ?? [30, 8])).weg.map((p) => ({ x: p.x, z: p.z })))]));
  // Neue Karte (Stufe, Gelaende, Stegbild): Wege neu, sobald das Schiff am Platz oder draussen ist
  game.on('fahrwasser:karte', () => { for (const l of aktiv.values()) for (const s of l) s.wegAlt = true; });

  function schiffeFuer(id) {
    if (aktiv.has(id)) return aktiv.get(id);
    const liste = AUFTRITTE[id].schiffe.map((d) => {
      const xlId = d.modell.startsWith('xl:') ? d.modell.slice(3) : null;
      const extern = xlId ? xlModell(xlId) : xxlModell(d.modell);
      if (xlId && !extern) return null;
      const m = extern ? { group: extern, laenge: 0, xl: !!xlId } : MODELL[d.modell]();
      m.group.name = `besuch-${d.modell}`;
      m.group.visible = false;
      gruppe.add(m.group);
      // Liegeplatz aus harbor.js; der erste Wegpunkt im Katalog ist der Rückfall
      const [l, b] = extern?.userData?.length ? [extern.userData.length, extern.userData.beam ?? d.masse?.[1] ?? 8] : d.masse ?? [30, 8];
      alsHindernis(m.group, l, b);
      return { ...m, d, l, b, ...wege(d, l, b),
        raus: d.raus ?? 'vorwaerts', rein: d.rein ?? 'vorwaerts', modus: 'raus',
        liegeKurs: THREE.MathUtils.degToRad(d.liegeKurs), kurs: THREE.MathUtils.degToRad(d.liegeKurs), t: 1,
        versatz: d.versatz ?? 0 };
    }).filter(Boolean);
    aktiv.set(id, liste);
    return liste;
  }

  // Anteil der Fahrt nach See (0 = am Platz, 1 = draussen) fuer einen Tagesanteil.
  // tagNr/tage: der wievielte Tag eines mehrtaegigen Besuchs (0 = Ankunft, tage - 1 = Abfahrt).
  function seeAnteil(a, tag, versatz = 0, tagNr = 0, tage = 1) {
    const p = a.plan;
    const D = a.fahrt ?? DAUER;
    if (a.jedenTag) {
      if (tag < p.ab) return 0;
      if (tag < p.ab + D) return (tag - p.ab) / D;
      if (tag < p.zurueck) return 1;
      if (tag < p.zurueck + D) return 1 - (tag - p.zurueck) / D;
      return 0;
    }
    const an = p.an + versatz, ab = p.ab + versatz;
    if (tagNr === 0) {
      if (tag < an) return 1;
      if (tag < an + D) return 1 - (tag - an) / D;
      if (tage > 1 || tag < ab) return 0;
    }
    if (tagNr < tage - 1 || tag < ab) return 0;
    if (tag < ab + D) return (tag - ab) / D;
    return 1;
  }

  const sturm = () => /sturm|storm/i.test(String(game.events?.current?.id ?? ''));

  game.on('day:start', () => { heute = besucheHeute(); });
  game.on('services:gebaut', () => { heute = besucheHeute(); });
  game.on('spielstand-geladen', () => { heute = besucheHeute(); });

  // Ankuendigung am Vorabend im Schild der Ereignisse (js/events/banner.js)
  game.on('services:besuch-angekuendigt', (b) => {
    if (b.art === 'ausflugsfahrt') return;
    const titel = { kreuzfahrt: 'Kreuzfahrttag', flottenbesuch: 'Flottenbesuch', windjammer: 'Windjammertreffen' }[b.art] ?? 'Besuch';
    const text = { kreuzfahrt: 'Viele Tagesgäste kommen in den Ort.',
      windjammer: 'Drei Großsegler laufen unter Segeln ein und ankern zwei Tage vor der Pier.' }[b.art] ?? 'Zuschauer kommen an die Pier.';
    game.emit('event:announce', {
      event: { id: b.art === 'kreuzfahrt' ? 'kreuzfahrttag' : 'hafenfest', title: titel,
        teaser: `Morgen: ${b.text}`, text },
      startDay: b.tag, day: b.tag - 1,
    });
  });

  game.onTick((dt) => {
    if (heute.tag !== (game.state?.tag ?? 1)) heute = besucheHeute();
    const tagAnteil = game.sim?.tagesAnteil?.() ?? ((game.time / 120) % 1);
    const winter = !!game.sim?.season?.()?.winter;
    for (const id of Object.keys(AUFTRITTE)) {
      const a = AUFTRITTE[id];
      const da = heute.besuch.has(id) && !winter && !(sturm() && !a.jedenTag);
      if (!da && !aktiv.has(id)) continue;
      const schiffe = schiffeFuer(id);
      const nr = heute.nr?.get(id) ?? { tagNr: 0, tage: 1 };
      for (const s of schiffe) {
        const t = da ? (sturm() ? 0 : seeAnteil(a, tagAnteil, s.versatz, nr.tagNr, nr.tage)) : 1;
        const ziel = glatt(Math.max(0, Math.min(1, t)));
        if (ziel > s.t + 1e-6) s.modus = 'raus';
        else if (ziel < s.t - 1e-6) s.modus = 'rein';
        s.t = ziel;
        if (s.wegAlt && (s.t < 0.001 || s.t > 0.999)) Object.assign(s, wege(s.d, s.l, s.b));
        s.group.visible = s.t < 0.999;
        if (!s.group.visible) continue;
        let p, soll;
        if (s.modus === 'rein') {
          // Einlaufen auf dem eigenen Weg von See (u = 0) zum Platz (u = 1)
          const w = aufWeg(s.ankunft, 1 - s.t);
          p = w.p;
          soll = s.rein === 'rueckwaerts' || w.segment === s.ankunft.length - 2 ? s.liegeKurs : w.kurs;
        } else {
          // Ablegen: im ersten Wegstueck mit dem Liegekurs, danach Bug voraus (oder ganz achteraus)
          const w = aufWeg(s.weg, s.t);
          p = w.p;
          // achteraus nur im festen Teil im Hafen, draussen Bug voraus
          soll = (s.raus === 'rueckwaerts' && w.segment < s.nachSee) || w.segment === 0 ? s.liegeKurs : w.kurs;
        }
        if (s.t < 0.002) soll = s.liegeKurs;
        s.kurs = winkelZu(s.kurs, soll, Math.min(1, dt * 0.8));
        s.group.position.set(p.x, Math.sin(game.time * 0.9 + p.x) * 0.08, p.z);
        s.group.rotation.y = s.kurs;
        if (s.radar) s.radar.rotation.y = game.time * 1.5;
        if (s.fl) s.fl.rotation.y = Math.sin(game.time * 2.2) * 0.35;
        if (s.xl) {
          // Unter Segeln fahren, vor Anker Segel bergen
          const segel = s.t > 0.03;
          if (s.group.userData.sailsUp !== segel) game.boatTypes.xl.setSails(s.group, segel);
          game.boatTypes.xl.animateBoat?.(s.group, game.time, { speed: segel ? 3 : 0 });
        }
      }
    }
    barkasseTick(dt, tagAnteil, winter);
  });

  // ------------------------------------------------------------------ Barkasse
  let bark = null;
  // Rundfahrt ueber die Fahrwasserkarte: die Punkte aus data/besuchswege.js sind nur Wunschpunkte.
  // Liegt einer an Land oder zu flach (Gelaende aus Seed), nimmt die Barkasse den naechsten freien
  // Punkt in bis zu 40 m; zwischen den Punkten faehrt sie den Weg aus der Karte, nie ueber Land.
  const barkWege = new Map();
  game.on('fahrwasser:karte', () => barkWege.clear());
  function barkassenWeg(r, L) {
    const key = r.name + ':' + L.x.toFixed(1) + ':' + L.z.toFixed(1);
    if (barkWege.has(key)) return barkWege.get(key);
    const fw = game.fahrwasser;
    const roh = [L, ...r.weg.map(([x, y]) => W(x, y)), L];
    if (!fw?.weg || !fw?.befahrbar) return roh;
    const B = 4.2, T = 1.8, rad = B / 2 + 1;
    const freiBei = (p) => {
      if (fw.befahrbar(p.x, p.z, rad, T)) return p;
      for (let d = 4; d <= 40; d += 4) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const q = new THREE.Vector3(p.x + Math.cos(a) * d, 0, p.z + Math.sin(a) * d);
          if (fw.befahrbar(q.x, q.z, rad, T)) return q;
        }
      }
      return null;
    };
    const out = [L.clone()];
    const ziele = roh.slice(1);
    for (let i = 0; i < ziele.length; i++) {
      const letzt = i === ziele.length - 1;
      const ziel = letzt ? L : freiBei(ziele[i]);
      if (!ziel) continue;
      const von = out[out.length - 1];
      if (von.distanceTo(ziel) < 2) continue;
      const w = fw.weg({ x: von.x, z: von.z }, { x: ziel.x, z: ziel.z }, { breiteM: B, tiefgangM: T });
      if (w?.ok && w.punkte?.length) {
        for (const q of w.punkte.slice(1)) out.push(new THREE.Vector3(q.x, 0, q.z));
        if (out[out.length - 1].distanceTo(ziel) > 0.5) out.push(ziel.clone());
      } else if (letzt) out.push(L.clone());          // zurueck zum Ponton immer
    }
    barkWege.set(key, out);
    return out;
  }
  function barkasseTick(dt, tagAnteil, winter) {
    const gebaut = services.stufeVon('barkasse') > 0;
    if (!gebaut) { if (bark) bark.group.visible = false; return; }
    const anlage = services.gruppe?.getObjectByName?.('service-barkasse');
    const liege = anlage?.getObjectByName?.('liegeplatz');
    if (!liege) return;
    if (!bark) {
      bark = barkasseBoot();
      bark.group.name = 'besuch-barkasse';
      gruppe.add(bark.group);
      alsHindernis(bark.group, bark.laenge, bark.breite);
      bark.kurs = 0;
    }
    bark.group.visible = true;
    liege.updateMatrixWorld(true);
    const L = liege.getWorldPosition(new THREE.Vector3());
    // Welche Rundfahrt laeuft gerade? Im Winter und bei Sturm bleibt sie am Ponton.
    const r = winter || sturm() ? null : RUNDFAHRTEN.find((q) => tagAnteil >= q.ab && tagAnteil < q.ab + q.dauer);
    let p = L, soll = 0;
    if (r) {
      const pts = barkassenWeg(r, L);
      const u = (tagAnteil - r.ab) / r.dauer;
      // langsam ablegen und anlegen, dazwischen gleichmaessig
      const a = 0.06, vmax = 1 / (1 - a);
      const f = u < a ? vmax * u * u / (2 * a) : u > 1 - a ? 1 - vmax * (1 - u) * (1 - u) / (2 * a) : vmax * (u - a / 2);
      const w = aufWeg(pts, Math.max(0, Math.min(1, f)));
      p = w.p;
      soll = u < 0.01 || u > 0.99 ? 0 : w.kurs;
    }
    bark.kurs = winkelZu(bark.kurs, soll, Math.min(1, dt * 2.2));
    bark.group.position.set(p.x, Math.sin(game.time * 1.3 + p.x) * 0.05, p.z);
    bark.group.rotation.y = bark.kurs;
    bark.group.rotation.z = r ? Math.sin(game.time * 1.7) * 0.015 : 0;
    if (bark.fl) bark.fl.rotation.y = Math.sin(game.time * 2.6) * 0.4;
  }

  return { gruppe, besucheHeute: () => [...heute.besuch], barkasse: () => bark?.group ?? null };
}
