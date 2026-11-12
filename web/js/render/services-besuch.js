// Besuchsschiffe der Services: Ausflugsschiff am Fahrgastanleger (taeglich), Kreuzfahrtschiff an der
// Kreuzfahrtpier und Marineschiffe am Marineanleger (regelmaessige Besuche aus js/services/rules.js).
// Die Schiffe laufen morgens ein, liegen tagsueber an ihrem Platz und laufen abends wieder aus.
// Wird von js/render/services.js gestartet, kein eigener Eintrag in MODULES.
//
// Falls der Schiffs-Thread spaeter eigene XXL-Modelle anbietet (game.boats?.xxl?.modell(art)), werden
// diese genommen; bis dahin zeichnet dieses Modul schlichte Flat-Modelle.
import * as THREE from 'three';
import { FARBE, box, zyl, flagge, rumpf, mat } from './services-models.js';
import { HAFEN } from '../data/harbor.js';

const U = 0.62;
const W = (x, y) => new THREE.Vector3(x * U, 0, -y * U);

// ------------------------------------------------------------------ Modelle (Bug nach +x)
function fenster(g, len, y, z, c = FARBE.glass) {
  box(g, len, 0.5, 0.06, c, 0, y, z);
  box(g, len, 0.5, 0.06, c, 0, y, -z);
}

function ausflugsschiff() {
  const g = new THREE.Group();
  rumpf(g, 24, 6.4, 2.6, FARBE.white, 0, 0, 0, 0, FARBE.white);
  box(g, 22, 0.5, 6.5, FARBE.blue, -0.6, 0.2, 0);                     // blauer Streifen
  box(g, 15, 2.4, 5.4, FARBE.white, -2, 1.7, 0);                      // Hauptdeck
  fenster(g, 13.5, 2.6, 2.72);
  box(g, 10, 2.2, 5, FARBE.white, -3, 4.1, 0);                        // Oberdeck
  box(g, 3, 1.6, 3.6, FARBE.white, 3.5, 4.1, 0);                      // Steuerhaus
  box(g, 0.1, 0.8, 3.4, FARBE.glass, 5.02, 4.5, 0);
  box(g, 10.5, 0.15, 5.6, FARBE.blue, -3, 6.3, 0);                    // Sonnendach
  zyl(g, 0.08, 4, FARBE.white, 3.5, 5.7, 0, 4);
  // Fahrgaeste an Deck: bunte Punkte
  const farben = [FARBE.red, FARBE.yellow, FARBE.navy, FARBE.green, FARBE.coral];
  for (let i = 0; i < 9; i++) zyl(g, 0.25, 0.9, farben[i % 5], -7 + i * 1.3, 4.1 + 2.2, (i % 2 ? 1 : -1) * 1.6, 6);
  return { group: g, laenge: 24 };
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
// Wege in Planeinheiten, vom Liegeplatz nach See. Die Ankunft faehrt den Weg rueckwaerts.
const AUFTRITTE = {
  fahrgastanleger: {
    art: 'ausflugsfahrt', jedenTag: true,
    schiffe: [{ modell: 'ausflugsschiff', weg: [[34, 234], [62, 246], [110, 290], [133, 318], [133, 380]], liegeKurs: 180 }],
    // Ausflugsschiff: liegt morgens am Kai, faehrt mittags raus und kommt nachmittags zurueck
    plan: { ab: 0.22, zurueck: 0.5 },
  },
  kreuzfahrtterminal: {
    art: 'kreuzfahrt',
    // Liegeplatz P01 an der Aussenseite des Pierkopfs (harbor.js Stufe 6)
    schiffe: [{ modell: 'kreuzfahrtschiff', platz: 'P01', weg: [[-227, 290], [-150, 296], [-90, 340], [-60, 440]], liegeKurs: 180 }],
    plan: { an: 0.03, ab: 0.68 },
  },
  marineanleger: {
    art: 'flottenbesuch',
    schiffe: [
      // MA01 und MA02 an der Innenseite des Pierkopfs
      { modell: 'korvette', platz: 'MA01', weg: [[-146, 247], [-70, 248], [-50, 300], [-40, 440]], liegeKurs: 180 },
      { modell: 'minenjagdboot', platz: 'MA02', weg: [[-304, 248], [-395, 252], [-410, 320], [-400, 440]], liegeKurs: 0 },
    ],
    plan: { an: 0.05, ab: 0.7 },
  },
};

const DAUER = 0.12;     // Anteil des Tages fuer eine Fahrt vom Liegeplatz nach See

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
  function besucheHeute() {
    const tag = game.state?.tag ?? 1;
    const z = services.zustand();
    const s = new Set();
    for (const id of Object.keys(AUFTRITTE)) {
      if (!(services.stufeVon(id) > 0)) continue;
      const a = AUFTRITTE[id];
      if (a.jedenTag || (z.besuche[id] != null && z.besuche[id] <= tag)) s.add(id);
    }
    return { tag, besuch: s };
  }

  function schiffeFuer(id) {
    if (aktiv.has(id)) return aktiv.get(id);
    const liste = AUFTRITTE[id].schiffe.map((d) => {
      const extern = game.boats?.xxl?.modell?.(d.modell);
      const m = extern ? { group: extern, laenge: 0 } : MODELL[d.modell]();
      m.group.name = `besuch-${d.modell}`;
      m.group.visible = false;
      gruppe.add(m.group);
      // Liegeplatz aus harbor.js, sobald Stufe 6 dort steht; der Weg im Katalog ist der Rückfall
      const lage = d.platz ? HAFEN.plaetze?.find((q) => q.id === d.platz)?.lage?.[6] : null;
      const weg = lage ? [[lage[0], lage[1]], ...d.weg.slice(1)] : d.weg;
      return { ...m, weg: weg.map(([x, y]) => W(x, y)), liegeKurs: THREE.MathUtils.degToRad(d.liegeKurs), kurs: 0, t: 1 };
    });
    aktiv.set(id, liste);
    return liste;
  }

  // Anteil der Fahrt nach See (0 = am Platz, 1 = draussen) fuer einen Tagesanteil
  function seeAnteil(a, tag) {
    const p = a.plan;
    if (a.jedenTag) {
      if (tag < p.ab) return 0;
      if (tag < p.ab + DAUER) return (tag - p.ab) / DAUER;
      if (tag < p.zurueck) return 1;
      if (tag < p.zurueck + DAUER) return 1 - (tag - p.zurueck) / DAUER;
      return 0;
    }
    if (tag < p.an) return 1;
    if (tag < p.an + DAUER) return 1 - (tag - p.an) / DAUER;
    if (tag < p.ab) return 0;
    if (tag < p.ab + DAUER) return (tag - p.ab) / DAUER;
    return 1;
  }

  const sturm = () => /sturm|storm/i.test(String(game.events?.current?.id ?? ''));

  game.on('day:start', () => { heute = besucheHeute(); });
  game.on('services:gebaut', () => { heute = besucheHeute(); });
  game.on('spielstand-geladen', () => { heute = besucheHeute(); });

  // Ankuendigung am Vorabend im Schild der Ereignisse (js/events/banner.js)
  game.on('services:besuch-angekuendigt', (b) => {
    if (b.art === 'ausflugsfahrt') return;
    const titel = b.art === 'kreuzfahrt' ? 'Kreuzfahrttag' : b.art === 'flottenbesuch' ? 'Flottenbesuch' : 'Besuch';
    game.emit('event:announce', {
      event: { id: b.art === 'kreuzfahrt' ? 'kreuzfahrttag' : 'hafenfest', title: titel,
        teaser: `Morgen: ${b.text}`, text: b.art === 'kreuzfahrt' ? 'Viele Tagesgäste kommen in den Ort.' : 'Zuschauer kommen an die Pier.' },
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
      const t = da ? (sturm() ? 0 : seeAnteil(a, tagAnteil)) : 1;
      for (const s of schiffe) {
        const ziel = glatt(Math.max(0, Math.min(1, t)));
        const zurSee = ziel > s.t;
        s.t = ziel;
        s.group.visible = s.t < 0.999;
        if (!s.group.visible) continue;
        const { p, kurs, segment } = aufWeg(s.weg, s.t);
        // Auslaufen: im ersten Wegstueck rueckwaerts vom Platz weg, dann drehen
        let soll = s.t < 0.002 ? s.liegeKurs : zurSee ? kurs : kurs + Math.PI;
        if (segment === 0) soll = s.liegeKurs;
        s.kurs = winkelZu(s.kurs || s.liegeKurs, soll, Math.min(1, dt * 0.8));
        s.group.position.set(p.x, Math.sin(game.time * 0.9 + p.x) * 0.08, p.z);
        s.group.rotation.y = s.kurs;
        if (s.radar) s.radar.rotation.y = game.time * 1.5;
        if (s.fl) s.fl.rotation.y = Math.sin(game.time * 2.2) * 0.35;
      }
    }
  });

  return { gruppe, besucheHeute: () => [...heute.besuch] };
}
