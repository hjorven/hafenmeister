// Menschen im Hafen (docs/plan.md, Abschnitt 11a): kleine Figuren ohne Gesicht, die von ihren
// Booten an Land gehen und mit Wegfindung (A*) ueber Stege, Uferweg, Promenade, Molen und
// Nehrung zu Toilette, Dusche, Kiosk, Restaurant, Strandkoerben und Aussichtspunkten laufen.
// Dazu Spaziergaenger aus dem Ort und Badegaeste am Strand, je nach Stufe, Jahreszeit,
// Tageszeit und Wetter. Reine Belebung, keine Story, keine eigene Zahl in der Oberflaeche.
// Gehoert dem Thread "Menschen im Hafen herumlaufen lassen". Schlange vor der Versorgung: Paket P55 (docs/hafenzeichen.md).
//
// Schnittstelle:
//   game.people.anBord(bootId)   Promise, erfuellt wenn alle Leute dieses Boots an Bord sind
//                                (spaetestens nach WARTEN_MAX Sekunden Spielzeit)
//   game.people.anzahl()         { figuren, menschen } gerade im Spiel
//   game.people.netz             aktuelles Wegenetz (web/js/people/netz.js)
//   game.people.bootAngelegt({ id, platz, groesse, art, modell })  von Hand, z. B. zum Testen
//   game.people.bootLegtAb(id)
//   game.people.rundgangStarten({ sofort })  Hafenmeister geht ueber die Stege (sonst abends von selbst)
// Sendet: 'hafenmeister:halt' { boot, platz } an Booten ohne Bezahlt-Markierung, danach
//   'hafenmeister:feierabend'. Bezahlt-Status: game.sim.istBezahlt(boot, platz), sonst
//   game.state.boats[boot].bezahlt / paid / pendingFee > 0.
// Hoert auf: boot:angelegt, boot:ablegen (Spielregeln), boat:moored, boat:cast-off, boat:left
// (Schiffsanimationen), stufe, phase, season, weather, ready.
// Zum Ausprobieren: index.html?stufe=4&leute=voll  (alle Plaetze der Stufe mit Crews belegt)
import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';
import { baueNetz } from '../people/netz.js';
import * as P from '../data/people.js';
import { crewFuer, figurenFuer } from '../people/crew.js';
import { auslastungStufe } from '../ui/hafenzeichen.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const BORD_HOEHE = { S: 0.6, M: 0.8, L: 1.0, XL: 2.2, T: 0.8 };

const zufall = (a, b) => a + Math.random() * (b - a);

// Schlange vor der Versorgung (Paket P55, Roadmap L2): Ist die Versorgung heute knapp oder voll
// (game.sim.auslastung, ui/hafenzeichen.js), gehen Gäste nicht gleich hinein, sondern stellen sich
// vor der Tür an. Welches Ziel zu welcher Versorgung gehört:
const VERSORGUNG = { toilette: 'wc', sanitaer: 'wc', dusche: 'dusche', kiosk: 'essen', restaurant: 'essen' };
const SCHLANGE_ABSTAND = 1.1;    // Meter zwischen zwei Wartenden
const SCHLANGE_MAX = 6;          // mehr stellen sich nicht an, sie gehen gleich hinein
/** Wie lange jemand ansteht (Sekunden Spielzeit): knapp kurz, voll länger. */
export function anstehZeit(stufe, zufallswert = Math.random()) {
  if (stufe === 'voll') return 14 + zufallswert * 12;
  if (stufe === 'knapp') return 6 + zufallswert * 8;
  return 0;
}
const ganz = (a, b) => Math.floor(zufall(a, b + 1));
const wahl = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------------ Figur
// Ein Rumpf (Oberteil, Farbe je Instanz) und ein Kopf. Etwas kraeftiger als echt (Spielzeugstil),
// damit man die Figuren aus der Hafenansicht noch erkennt. Zusammen etwa 1,9 m.
function figurGeometrien() {
  const koerper = new THREE.CylinderGeometry(0.3, 0.24, 1.4, 7);
  koerper.translate(0, 0.7, 0);
  const kopf = new THREE.SphereGeometry(0.25, 8, 6);
  kopf.translate(0, 1.62, 0);
  // Tasche oder Seesack in der Hand (Bootsgeschichten: Crewwechsel, Einkauf), seitlich am Körper
  const tasche = new THREE.BoxGeometry(0.22, 0.42, 0.5);
  tasche.translate(0.42, 0.55, 0);
  return { koerper, kopf, tasche };
}

export function init(game) {
  const max = P.MAX_FIGUREN;
  const geo = figurGeometrien();
  const matKoerper = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const matKopf = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const koerper = new THREE.InstancedMesh(geo.koerper, matKoerper, max);
  const kopf = new THREE.InstancedMesh(geo.kopf, matKopf, max);
  const matTasche = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const tasche = new THREE.InstancedMesh(geo.tasche, matTasche, max);
  for (const m of [koerper, kopf, tasche]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
  }
  const group = new THREE.Group();
  group.name = 'menschen';
  group.add(koerper, kopf, tasche);
  game.scene.add(group);
  const TASCHEN = ['#2e3f5c', '#7a4a2a', '#b04a3c', '#3b6e5a', '#c8b58e'];

  // Schirmmuetze des Hafenmeisters (eine einzelne Figur, daher kein Instancing noetig)
  const muetze = new THREE.Group();
  const muetzeOben = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.16, 10), new THREE.MeshLambertMaterial({ color: '#f4f1ea' }));
  muetzeOben.position.y = 1.86;
  const schirm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.34), new THREE.MeshLambertMaterial({ color: '#1f2a3d' }));
  schirm.position.set(0.24, 1.79, 0);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.06, 10), new THREE.MeshLambertMaterial({ color: '#1f2a3d' }));
  band.position.y = 1.8;
  muetze.add(muetzeOben, schirm, band);
  muetze.visible = false;
  group.add(muetze);

  const farbe = new THREE.Color();
  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const achse = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const skala = new THREE.Vector3();
  const kipp = new THREE.Quaternion();
  const querachse = new THREE.Vector3(1, 0, 0);

  // ---------------------------------------------------------------- Zustand
  const agenten = [];          // alle Figuren
  const boote = new Map();     // bootId -> { id, platz, klasse, agenten: [], warten: [] }
  const wartend = new Map();   // bootId -> Daten von boot:angelegt, bis boat:moored kommt
  let netz = null;
  let stufe = 1;
  let abend = false;
  let jahreszeit = 'sommer';
  let regen = false;
  let animGesehen = false;     // Schiffsanimationen senden boat:moored
  let spawnUhr = 0;

  const params = new URLSearchParams(location.search);

  // ---------------------------------------------------------------- Hoehen
  const hoeheLand = (x, z) => {
    const h = game.landscape?.hoeheBei?.(x, z) ?? game.landschaft?.hoeheBei?.(x, z);
    return Number.isFinite(h) ? h : 0.3;
  };
  const deck = (bauart, standard) => {
    const h = game.stege?.deckHoehe?.(bauart);
    return Number.isFinite(h) ? h : standard;
  };
  function knotenWelt(i, klasse) {
    const n = netz.nodes[i];
    const x = n.x * U, z = -n.y * U;
    let y;
    switch (n.art) {
      case 'holz': y = deck('holz', 0.86); break;
      case 'schwimmsteg': y = deck('schwimmsteg', 0.46); break;
      case 'kai': y = deck('kai', 1.3); break;
      case 'pier': y = deck('pier', 1.6); break;
      case 'mole': y = Math.max(1.4, hoeheLand(x, z)); break;
      case 'bruecke': y = 1.9; break;
      case 'boot': y = BORD_HOEHE[klasse] ?? 0.8; break;
      case 'wasser': y = -1.0; break;   // badet: nur Kopf und Schultern schauen heraus
      default: y = hoeheLand(x, z);
    }
    return { x, y, z };
  }

  // ---------------------------------------------------------------- Netz
  function gebaeudeListe() {
    const b = game.buildings;
    if (!b?.items) return [];
    const box = new THREE.Box3();
    const out = [];
    const grundriss = () => [box.min.x / U, -box.max.z / U, box.max.x / U, -box.min.z / U];
    for (const it of b.items) {
      if (!it.mesh || !it.mesh.parent || !it.mesh.visible) continue;
      if (it.art === 'molenfeuer' || it.art === 'wellenbrecher' || it.art === 'bootsschuppen') continue;
      const p = it.mesh.position;
      box.setFromObject(it.mesh);
      const e = b.eingang?.(it.id);
      out.push({
        id: it.id, art: it.art,
        x: p.x / U, y: -p.z / U,
        halbBreite: (box.max.x - box.min.x) / 2 / U,
        box: it.art === 'seebruecke' || it.art === 'strandkoerbe' ? null : grundriss(),
        dreh: it.mesh.rotation.y,
        tuer: e && it.art !== 'strandkoerbe' ? { x: e.x / U, y: -e.z / U } : null,
      });
    }
    // Angebote an Land aus den Services (Bäcker, Café, Eisdiele ...), sobald gebaut
    for (const c of game.services?.gruppe?.children ?? []) {
      const id = c.name?.startsWith('service-') ? c.name.slice(8) : null;
      if (!id || !P.SERVICE_ZIELE.includes(id) || !c.visible) continue;
      box.setFromObject(c);
      out.push({ id: `service-${id}`, art: id, x: c.position.x / U, y: -c.position.z / U,
        halbBreite: (box.max.x - box.min.x) / 2 / U, box: null, tuer: null });
    }
    return out;
  }

  // Alles, was sonst an Land steht und im Weg ist: Teile der Gebaeude, Services und Anlagen (Werft, Winterlager,
  // Fischhalle ...). Je Mesh der Grundriss, wenn es hoeher als 1 m ist; Flaches (Stege, Wege, Plaetze) zaehlt nicht,
  // Riesiges (Gelaende, Wasserflaechen) auch nicht.
  function hindernisListe() {
    const out = [];
    const box = new THREE.Box3();
    for (const gruppe of [game.services?.gruppe, game.buildings?.group, game.scene?.getObjectByName?.('ziel-deko')]) {
      if (!gruppe) continue;
      gruppe.updateMatrixWorld?.(true);
      gruppe.traverseVisible?.((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
        box.setFromObject(o);
        if (box.isEmpty() || box.max.y - box.min.y < 1) return;
        const bx = box.max.x - box.min.x, bz = box.max.z - box.min.z;
        if (bx > 45 || bz > 45 || bx * bz < 0.3) return;
        out.push({ box: [box.min.x / U, -box.max.z / U, box.max.x / U, -box.min.z / U] });
      });
    }
    return out;
  }

  let netzStege = null;   // Stand der Stege (game.stege.gebaut().sig), aus dem das Netz gebaut ist
  function neuesNetz() {
    // Gelaende je Kuestentyp und Seed: das Netz liegt nur auf trockenem, freiem Boden (people/netz.js)
    const region = game.landscape?.region ?? game.landschaft?.region ?? game.state?.region ?? 'ostsee';
    // Nur was wirklich steht (render/stege.js): ungebaute Stege, Bauplaetze und Stegprojekte spaeterer
    // Stufen betritt niemand. Passt die Stufe der Stege noch nicht, folgt das Ereignis 'stege' gleich.
    const gb = game.stege?.gebaut?.();
    const gebaut = gb && gb.stufe === stufe ? gb : null;
    netzStege = gebaut?.sig ?? null;
    netz = baueNetz({ hafen: HAFEN, stufe, region: region === 'nordsee' ? 'nordsee' : 'ostsee', gebaeude: gebaeudeListe(), hindernisse: hindernisListe(), gebaut });
    api.netz = netz;
  }

  // Nach dem Kauf eines Gebaeudes (Ereignis 'build') das Netz neu bauen, ohne dass jemand springt:
  // alle Knoten-Verweise werden auf das neue Netz umgerechnet, Laufende gehen vom aktuellen Punkt weiter.
  function netzErneuern() {
    const alt = netz;
    if (!alt) return neuesNetz();
    neuesNetz();
    const schluessel = (n) => `${n.art === 'boot' || n.art === 'wasser' ? n.art : ''}${n.x.toFixed(2)},${n.y.toFixed(2)}`;
    const neu = new Map();
    netz.nodes.forEach((n, i) => { const k = schluessel(n); if (!neu.has(k)) neu.set(k, i); });
    const altPlatz = new Map();
    for (const [id, p] of alt.plaetze) altPlatz.set(p.node, id);
    const map = (i) => {
      if (i == null || i < 0 || !alt.nodes[i]) return i;
      if (altPlatz.has(i)) return netz.plaetze.get(altPlatz.get(i))?.node ?? -1;
      const n = alt.nodes[i];
      return neu.get(schluessel(n)) ?? netz.naechster(n.x, n.y, null);
    };
    for (const b of boote.values()) b.node = netz.plaetze.get(b.platz)?.node ?? map(b.node);
    for (const a of agenten) {
      if (a.zustand === 'entfernt') continue;
      if (a.ziel) a.ziel = netz.ziele.find((z) => z.node === map(a.ziel.node)) ?? a.ziel;
      if (a.befehl) a.befehl.node = map(a.befehl.node);
      if (a.zustand === 'geht' && a.pfad) {
        const ziel = map(a.zielNode);
        const hier = netz.naechster(a.x / U, -a.z / U, null);
        a.node = hier;
        const w = knotenWelt(hier, a.klasse);
        a.pfad = [{ n: hier, x: a.x, y: a.y, z: a.z }, { n: hier, ...w }];
        a.i = 0; a.t = 0;
        geheZu(a, ziel, a.danach);
      } else {
        a.node = map(a.node);
      }
    }
    if (rundgang) {
      rundgang.start = bueroKnoten();
      for (const h of rundgang.halte) h.node = netz.plaetze.get(h.platz)?.einstieg ?? map(h.node);
    }
  }

  // ---------------------------------------------------------------- Figuren
  function neueFigur({ boot = null, node, klasse = 'M', sichtbar = true, buendel = 1, typ = boot == null ? 'ort' : 'crew' }) {
    // Eine Figur bleibt für den Hafenmeister frei: Sein Rundgang darf bei vollem Hafen nicht ausfallen
    if (agenten.length >= (typ === 'hafenmeister' ? max : max - 1)) return null;
    const a = {
      boot, klasse, buendel, typ, sitzt: false,
      node,                  // letzter erreichter Knoten
      pfad: null, i: 0, t: 0, // Punkte in Welt, Segment, Strecke im Segment
      zustand: sichtbar ? 'steht' : 'anbord',
      uhr: 0,
      ziel: null,
      tempo: zufall(P.TEMPO[0], P.TEMPO[1]),
      seite: zufall(-0.35, 0.35),
      phase: Math.random() * Math.PI * 2,
      x: 0, y: 0, z: 0, blick: Math.random() * Math.PI * 2,
      besuche: ganz(2, 4),
      eile: 1,
      folger: [],
    };
    const w = knotenWelt(node, klasse);
    a.x = w.x; a.y = w.y; a.z = w.z;
    a.koerperFarbe = new THREE.Color(wahl(P.FARBEN.oberteil));
    a.kopfFarbe = new THREE.Color(wahl(P.FARBEN.haut));
    agenten.push(a);
    return a;
  }

  // Weg ueber das Netz zu einem Knoten starten
  function geheZu(a, zielNode, wenn = null) {
    // Wer gerade unterwegs ist, dreht vom aktuellen Punkt aus um, statt zurueckzuspringen
    let start = a.node, vorweg = null;
    if (a.zustand === 'geht' && a.pfad) {
      const p0 = a.pfad[a.i], p1 = a.pfad[a.i + 1];
      start = p1.n;
      vorweg = { n: p0.n, x: a.x, y: a.y, z: a.z };
    }
    const k = netz.weg(start, zielNode);
    if (!k || k.length + (vorweg ? 1 : 0) < 2) { a.pfad = null; a.zustand = 'steht'; a.uhr = 1; return false; }
    a.pfad = (vorweg ? [vorweg] : []).concat(k.map((n) => ({ n, ...knotenWelt(n, a.klasse) })));
    a.i = 0; a.t = 0;
    a.zielNode = zielNode;
    a.danach = wenn;
    a.zustand = 'geht';
    return true;
  }

  // Tagesanteil auf der Skala der Zeitfenster in data/people.js: 0 Morgen, 0,75 Abendbeginn, 1 Nacht,
  // unabhängig davon, wie lang Tag und Abend in den Spielregeln sind (docs/bootsgeschichten.md: 270 s + 30 s)
  const tagesAnteil = () => {
    const r = game.sim?.ctx?.rules, st = game.sim?.state;
    if (!r?.dayLength || !st) return game.sim?.tagesAnteil?.() ?? 0.5;
    const c = st.clock ?? 0, abend = r.eveningLength || 1;
    return c < r.dayLength ? 0.75 * (c / r.dayLength) : Math.min(1, 0.75 + 0.25 * ((c - r.dayLength) / abend));
  };
  // Sekunden Spielzeit je Einheit dieser Skala (tagsüber)
  const tagLaenge = () => {
    const r = game.sim?.ctx?.rules;
    return r?.dayLength ? r.dayLength / 0.75 : 120;
  };
  // Liegt die Ankunft im Zeitfenster des Ziels? Der Weg dauert bei einem Spieltag von zwei Minuten
  // spuerbar lange, deshalb zaehlt die geschaetzte Ankunft, nicht der Moment der Entscheidung.
  // Laenge des echten Wegs ueber das Netz in Metern (zwischengespeichert je Netz)
  let wegCache = new Map(), wegCacheNetz = null;
  function weglaenge(von, nach) {
    if (wegCacheNetz !== netz) { wegCache = new Map(); wegCacheNetz = netz; }
    const k = von * 100000 + nach;
    if (wegCache.has(k)) return wegCache.get(k);
    const pfad = netz.weg(von, nach);
    let m = Infinity;
    if (pfad) {
      m = 0;
      for (let i = 1; i < pfad.length; i++) {
        const p = netz.nodes[pfad[i - 1]], q = netz.nodes[pfad[i]];
        m += Math.hypot(q.x - p.x, q.y - p.y) * U;
      }
    }
    wegCache.set(k, m);
    return m;
  }

  function imZeitfenster(def, a, z, u = tagesAnteil()) {
    if (!def.zeit) return true;
    const weg = weglaenge(a.node, z.node);
    if (!Number.isFinite(weg)) return false;
    const an = u + weg / Math.max(0.5, a.tempo * (a.eile ?? 1)) / tagLaenge();
    return an >= def.zeit[0] && an < def.zeit[1];
  }

  function zielWaehlen(a, u) {
    const komp = netz.komp[a.node];
    const vorliebe = P.VORLIEBE[a.typ] ?? {};
    const standard = a.typ === 'strand' ? 0.2 : 1;
    // Bootsgeschichte (geschichten/geschichten.js): wer nur fürs WC kommt, geht zum WC
    const landgang = a.boot != null ? game.geschichten?.landgang?.(game.sim?.state?.boats?.[a.boot]) : null;
    const gewicht = (z) => {
      const def = P.ZIELE[z.art];
      if (!def || netz.komp[z.node] !== komp) return 0;
      if (def.nurBadewetter && !badewetter()) return 0;
      if (!imZeitfenster(def, a, z, u)) return 0;
      if (z.node === a.node) return 0;
      let g = def.gewicht * (vorliebe[z.art] ?? standard) * (landgang?.[z.art] ?? 1);
      // Leute aus dem Ort bleiben meist in der Naehe des Hafens (dort, wo man hinschaut)
      if (a.typ === 'ort') {
        const n = netz.nodes[z.node];
        g *= 0.15 + Math.exp(-Math.hypot(n.x - netz.zentrum.x, n.y - netz.zentrum.y) / P.NAEHE);
      }
      return g;
    };
    // Viele gleiche Punkte (Stegkoepfe, Strandplaetze, Badestellen) sollen zusammen nicht mehr
    // ziehen als ein einzelnes Gebaeude: ihr Gewicht wird durch ihre Anzahl geteilt (hoechstens 4)
    const anzahl = {};
    for (const z of netz.ziele) if (P.ZIELE[z.art]?.viele && netz.komp[z.node] === komp) anzahl[z.art] = (anzahl[z.art] ?? 0) + 1;
    let summe = 0;
    const w = netz.ziele.map((z) => {
      let g = gewicht(z);
      if (g > 0 && anzahl[z.art] > 1) g *= 4 / Math.max(4, anzahl[z.art]);
      summe += g;
      return g;
    });
    if (summe <= 0) return null;
    let r = Math.random() * summe;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (w[i] > 0 && r <= 0) return netz.ziele[i]; }
    return null;
  }

  // Naechster Schritt eines Menschen, der gerade irgendwo angekommen oder fertig ist
  function weiter(a) {
    if (a.folgt) return;   // Gruppenmitglieder machen, was die Gruppe macht
    if (a.typ === 'hafenmeister') return rundgangWeiter(a);
    const bootDaten = a.boot != null ? boote.get(a.boot) : null;
    // Crewwechsel: wer aussteigt, geht mit Tasche in den Ort; wer zusteigt, geht an Bord
    if (a.verlaesst) {
      const heim = heimKnoten(netz.komp[a.node]);
      a.verlaesst = false;
      // gehört nicht mehr zur Crew: das Boot wartet beim Ablegen nicht auf ihn
      if (bootDaten) bootDaten.agenten = bootDaten.agenten.filter((x) => x !== a);
      a.boot = null;
      a.typ = 'ort';
      if (heim != null) return befehl(a, heim, 'weg');
      return entfernen(a);
    }
    if (a.steigtZu && bootDaten) { a.steigtZu = false; return heimAnBord(a, bootDaten); }
    if (a.steigtZu) return entfernen(a);
    if (bootDaten) {
      // Wer abends erst ankommt, geht trotzdem einmal an Land (Dusche, Toilette, Restaurant)
      if (bootDaten.ablegen || ((abend || bootDaten.abreise) && !a.bleibtAbends && !a.ersterGang)) return heimAnBord(a, bootDaten);
      if (a.zustand !== 'anbord' && Math.random() < P.ZURUECK_AN_BORD && a.ziel) return heimAnBord(a, bootDaten);
    } else if (a.zielFest) {
      // Gezielter Besuch (besucher(), Services P23): erst dorthin, danach nach Hause
      const z = a.zielFest;
      a.zielFest = null;
      a.ziel = z;
      a.besuche = 0;
      return befehl(a, z.node, 'ziel');
    } else if (a.besuche <= 0 || (abend && Math.random() < 0.5)) {
      // Spaziergaenger geht nach Hause oder aus dem Bild, Badegaeste ueber die Duenen
      const heim = (a.typ === 'strand' ? netz.duenen : netz.zuhause).filter((n) => netz.komp[n] === netz.komp[a.node]);
      if (heim.length) return befehl(a, wahl(heim), 'weg');
      return entfernen(a);
    }
    if (bootDaten && !abend && !bootDaten.abreise && inDenOrt(a, game.geschichten?.landgang?.(game.sim?.state?.boats?.[a.boot]))) return;
    let z = zielWaehlen(a);
    if (abend && bootDaten && a.bleibtAbends) {
      // abends ins Restaurant oder an den Grillplatz
      const abends = netz.ziele.filter((t) => (t.art === 'restaurant' || t.art === 'grillplatz') && netz.komp[t.node] === netz.komp[a.node] &&
        imZeitfenster(P.ZIELE[t.art] ?? {}, a, t));
      z = abends.length ? wahl(abends) : null;
      if (!z) return heimAnBord(a, bootDaten);
    }
    if (!z) { a.ziel = null; a.zustand = 'steht'; a.uhr = zufall(5, 10); return; }
    a.ziel = z;
    a.besuche--;
    a.ersterGang = false;
    befehl(a, z.node, 'ziel');
  }

  // Weg starten, Gruppenmitglieder folgen mit kleinem Abstand
  function befehl(a, node, wenn) {
    if (wenn === 'weg' && a.node === node) return entfernen(a);
    sichtbarMachen(a);
    if (!geheZu(a, node, wenn)) return;
    a.folger.forEach((f, k) => {
      if (f.zustand === 'entfernt') return;
      f.ziel = a.ziel;
      f.zustand = 'wartet-start';
      f.uhr = 0.5 + k * 0.45;
      f.befehl = { node, wenn };
    });
  }

  function heimAnBord(a, b) {
    a.ziel = null;
    if (a.node === b.node && (a.zustand === 'anbord' || a.zustand === 'drinnen')) { a.zustand = 'anbord'; a.uhr = 1e9; return; }
    befehl(a, b.node, 'bord');
  }

  function sichtbarMachen(a) {
    a.sitzt = false;
    if (a.zustand === 'drinnen' || a.zustand === 'anbord') a.zustand = 'steht';
  }

  function angekommen(a) {
    const wenn = a.danach;
    a.pfad = null;
    if (wenn === 'weg') return entfernen(a);
    if (wenn === 'bord') {
      a.zustand = 'anbord';
      const b = boote.get(a.boot);
      a.uhr = !b || b.ablegen || abend ? 1e9 : zufall(...P.AN_BORD_PAUSE);
      pruefeAnBord(a.boot);
      return;
    }
    if (wenn === 'halt') return haltAmBoot(a);
    if (wenn === 'ort') {
      // im Ort unterwegs (nicht zu sehen), mit Einkauf zurück
      a.zustand = 'drinnen';
      a.uhr = zufall(25, 60);
      if (boote.get(a.boot)?.gepaeck === 'einkauf') a.tasche = neueTasche();
      return;
    }
    if (wenn === 'versammlung') {
      const v = a.versammlung;
      a.versammlung = null;
      a.zustand = 'verweilt';
      a.uhr = v?.dauer ?? 30;
      if (v) a.blick = Math.atan2(-(v.z - a.z), v.x - a.x);
      return;
    }
    if (wenn === 'vorbei') { a.zustand = 'steht'; a.uhr = 0; return; }
    if (wenn === 'feierabend') { a.zustand = 'drinnen'; a.uhr = 1e9; rundgangEnde(a); return; }
    const z = a.ziel;
    const art = z ? P.ZIELE[z.art] : null;
    // Schlange vor der Tür, wenn die Versorgung heute knapp oder voll ist (tagsüber)
    const anstehen = !abend && z ? anstehZeit(andrang(z.art)) : 0;
    if (anstehen > 0 && schlangeLaenge(z.node) < SCHLANGE_MAX) {
      a.zustand = 'schlange';
      a.schlangeSeit = ++schlangeZaehler;
      a.uhr = anstehen;
      a.sitzt = false;
      return;
    }
    a.zustand = art?.drinnen ? 'drinnen' : 'verweilt';
    a.sitzt = !!art?.sitzen;
    a.uhr = art ? zufall(...art.dauer) : zufall(4, 8);
    // Angebot hat inzwischen zu (Weg war laenger als gedacht): kurz schauen, weitergehen
    if (art?.zeit) { const u = tagesAnteil(); if (u < art.zeit[0] || u >= art.zeit[1]) { a.uhr = zufall(2, 4); a.sitzt = false; } }
    if (abend && a.bleibtAbends && (z?.art === 'restaurant' || z?.art === 'grillplatz')) a.uhr = 1e9;
    // zum Wasser schauen (Norden ist -z)
    if (!art?.drinnen) a.blick = Math.PI / 2 + zufall(-0.8, 0.8);
  }

  // ---------------------------------------------------------------- Schlange vor der Versorgung (L2)
  let schlangeZaehler = 0;
  function andrang(art) {
    const key = VERSORGUNG[art];
    const v = key ? game.sim?.auslastung?.()?.[key] : null;
    return v ? auslastungStufe(v.versorgt, v.kapazitaet) : 'frei';
  }
  function schlangeLaenge(node) {
    let n = 0;
    for (const a of agenten) if (a.zustand === 'schlange' && a.ziel?.node === node) n++;
    return n;
  }
  // Nach dem Anstehen: hinein (oder am Kiosk stehen bleiben) wie sonst auch
  function ansteheEnde(a) {
    const art = a.ziel ? P.ZIELE[a.ziel.art] : null;
    a.zustand = art?.drinnen ? 'drinnen' : 'verweilt';
    a.uhr = art ? zufall(...art.dauer) : zufall(4, 8);
    const w = knotenWelt(a.node, a.klasse);
    a.x = w.x; a.y = w.y; a.z = w.z;
  }
  // Wartende stellen sich hintereinander von der Tür weg auf, die Ersten rücken nach
  const _gb = new THREE.Vector3();
  function schlangenOrdnen(dt) {
    const reihen = new Map();
    for (const a of agenten) if (a.zustand === 'schlange' && a.ziel) {
      if (!reihen.has(a.ziel.node)) reihen.set(a.ziel.node, []);
      reihen.get(a.ziel.node).push(a);
    }
    for (const [node, liste] of reihen) {
      liste.sort((p, q) => p.schlangeSeit - q.schlangeSeit);
      const tuer = knotenWelt(node, 'M');
      const it = game.buildings?.items?.find((i) => i.id === liste[0].ziel.id);
      let dx = 0, dz = -1;
      if (it?.mesh) {
        it.mesh.getWorldPosition(_gb);
        dx = tuer.x - _gb.x; dz = tuer.z - _gb.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
      }
      // Die Erste steht an der Tür, die anderen reihen sich an der Hauswand entlang auf (quer zur
      // Tür, etwas vor der Wand): so sieht man die Schlange auch von schräg oben
      const qx = -dz, qz = dx;
      liste.forEach((a, k) => {
        const vor = k ? 1.2 : 0.3;
        const zx = tuer.x + qx * SCHLANGE_ABSTAND * k + dx * vor, zz = tuer.z + qz * SCHLANGE_ABSTAND * k + dz * vor;
        const f = Math.min(1, dt * 3);
        a.x += (zx - a.x) * f;
        a.z += (zz - a.z) * f;
        a.y = hoeheLand(a.x, a.z);
        a.blick = Math.atan2(dz, -dx);   // zur Tür schauen
      });
    }
  }

  function entfernen(a) {
    a.zustand = 'entfernt';
  }

  // Platz fuer n neue Figuren schaffen, wenn die Hoechstzahl erreicht ist: zuerst Spaziergaenger und
  // Badegaeste, die gerade drinnen sind, dann die, die nach Hause gehen, dann andere (keine Gruppenfuehrer).
  function platzMachen(n) {
    let frei = max - agenten.reduce((k, a) => k + (a.zustand !== 'entfernt' ? 1 : 0), 0);
    if (frei >= n) return;
    const rang = (a) => (a.zustand === 'drinnen' ? 0 : a.danach === 'weg' ? 1 : 2);
    const kandidaten = agenten.filter((a) => (a.typ === 'ort' || a.typ === 'strand') && a.zustand !== 'entfernt' && !a.folger?.length)
      .sort((x, y) => rang(x) - rang(y));
    for (const a of kandidaten) {
      if (frei >= n) break;
      entfernen(a);
      frei++;
    }
    for (let k = agenten.length - 1; k >= 0; k--) if (agenten[k].zustand === 'entfernt') agenten.splice(k, 1);
  }

  // ---------------------------------------------------------------- Hafenmeister-Rundgang
  // Abends geht der Hafenmeister ueber die Stege, haelt an jedem belegten Platz, an dem das Boot
  // noch nicht bezahlt hat, kurz an und sendet 'hafenmeister:halt' { boot, platz }. Die Spielregeln
  // koennen darauf kassieren. Danach geht er zurueck ins Buero.
  let rundgang = null;   // { agent, halte: [{ platz, boot, node }] }
  let rundgangHeute = false;

  function bueroKnoten() {
    for (const art of ['hafenmeister', 'hafenbuero']) {
      const z = netz.ziele.find((t) => t.art === art && netz.komp[t.node] === netz.flaechen.festland);
      if (z) return z.node;
    }
    // Stufe 1: es gibt noch kein Buero, er kommt vom Uferweg an der Wurzel der Stege
    return netz.naechster(netz.zentrum.x, netz.zentrum.y - 10, netz.flaechen.festland);
  }

  // Belegte Plaetze: aus dem Spielstand, sonst aus den Booten, deren Crews hier laufen
  function belegtePlaetze() {
    const out = new Map();
    const berths = game.state?.berths;
    if (berths && typeof berths === 'object') for (const [platz, boot] of Object.entries(berths)) if (boot != null) out.set(platz, boot);
    for (const b of boote.values()) if (!b.ablegen && !out.has(b.platz)) out.set(b.platz, b.id);
    return out;
  }

  function istUnbezahlt(boot, platz) {
    if (typeof game.sim?.istBezahlt === 'function') return !game.sim.istBezahlt(boot, platz);
    const b = game.state?.boats?.[boot];
    if (!b) return false;
    if (b.bezahlt != null) return !b.bezahlt;
    if (b.paid != null) return !b.paid;
    return (b.pendingFee ?? 0) > 0;
  }

  // Reihenfolge: Steg fuer Steg (von West nach Ost), auf jedem Steg von der Wurzel nach aussen
  function rundgangPlanen() {
    const belegt = belegtePlaetze();
    const halte = [];
    for (const [platz, boot] of belegt) {
      const pl = netz.plaetze.get(platz);
      if (!pl || netz.komp[pl.einstieg] !== netz.flaechen.festland) continue;
      const roh = HAFEN.plaetze.find((q) => q.id === platz);
      // Nur vergessene Münzen (Review B4): bezahlte Boote stehen gar nicht erst auf der Runde
      if (!istUnbezahlt(boot, platz)) continue;
      halte.push({ platz, boot, node: pl.einstieg, steg: roh?.steg ?? '', x: pl.x, y: pl.y, zahlt: true });
    }
    const stegX = new Map();
    for (const h of halte) stegX.set(h.steg, Math.min(stegX.get(h.steg) ?? Infinity, h.x));
    halte.sort((a, b) => (stegX.get(a.steg) - stegX.get(b.steg)) || (a.y - b.y));
    return halte;
  }

  function rundgangStarten({ sofort = false } = {}) {
    if (!netz || rundgang) return false;
    const halte = rundgangPlanen();
    if (!halte.length) return false;
    // Er beginnt am Ufer beim ersten offenen Steg (er ist abends ohnehin am Hafen unterwegs), nicht
    // im Buero: Der Abend dauert nur 30 s, vom Buero aus kaeme er kaum zu einem Boot (P12).
    let start = netz.naechster(halte[0].x, halte[0].y, netz.flaechen.festland);
    if (start == null || start < 0) start = bueroKnoten();
    if (start == null || start < 0) return false;
    // Sind alle Figuren vergeben (voller Hafen ab Stufe 4), macht ein Spaziergänger Platz; reicht das
    // nicht, nimmt er die für ihn frei gehaltene Figur (neueFigur). Der Rundgang fiele sonst genau
    // dann aus, wenn die meisten Münzen offen sind.
    platzMachen(1);
    const a = neueFigur({ node: start, typ: 'hafenmeister' });
    if (!a) return false;
    a.koerperFarbe = new THREE.Color('#2e3f5c');
    // Der Abend ist kurz: so zuegig, dass er alle offenen Boote im Abend schafft (P12). Weg grob als
    // Luftlinie Buero -> Halte -> Buero mal 1,3 fuer Umwege; dazu kurze Halte. Hoechstens leichter Laufschritt.
    const abendLaenge = game.sim?.ctx?.rules?.eveningLength ?? 30;
    let weg = 0, vor = netz.nodes[start];
    for (const h of halte) { weg += Math.hypot(h.x - vor.x, h.y - vor.y); vor = h; }
    weg += Math.hypot(netz.nodes[start].x - vor.x, netz.nodes[start].y - vor.y);
    const zeit = Math.max(6, abendLaenge * 0.75 - 1 - halte.length * P.RUNDGANG_HALT);
    a.tempo = Math.min(P.RUNDGANG_TEMPO_MAX, Math.max(P.RUNDGANG_TEMPO, (weg * 1.3) / zeit));
    a.zustand = 'drinnen';
    a.uhr = sofort ? 0.3 : zufall(0.3, 1);
    rundgang = { agent: a, halte, start };
    rundgangHeute = true;
    api.rundgang = rundgang;
    return true;
  }

  function rundgangWeiter(a) {
    const r = rundgang;
    if (!r || r.agent !== a) return entfernen(a);
    // Nur dort halten, wo noch nicht bezahlt ist; an den anderen Plaetzen geht er vorbei
    // Plaetze, deren Boot inzwischen abgelegt hat, laesst er aus
    const belegt = belegtePlaetze();
    while (r.halte.length && String(belegt.get(r.halte[0].platz)) !== String(r.halte[0].boot)) r.halte.shift();
    const naechster = r.halte.shift();
    if (!naechster) {
      if (a.node === r.start) return rundgangEnde(a);
      return befehl(a, r.start, 'feierabend');
    }
    a.halt = naechster;
    if (naechster.node === a.node) {
      if (naechster.zahlt) return haltAmBoot(a);
      a.zustand = 'steht'; a.uhr = 0; return;
    }
    befehl(a, naechster.node, naechster.zahlt ? 'halt' : 'vorbei');
  }

  function haltAmBoot(a) {
    const h = a.halt;
    a.zustand = 'verweilt';
    a.uhr = P.RUNDGANG_HALT;
    const pl = netz.plaetze.get(h.platz);
    if (pl) {
      const n = netz.nodes[pl.einstieg];
      a.blick = Math.atan2(pl.y - n.y, pl.x - n.x);   // zum Boot schauen (Plan-y = Welt -z)
    }
    // Bezahlstatus erst jetzt nochmal pruefen: vielleicht hat der Spieler schon kassiert
    if (istUnbezahlt(h.boot, h.platz)) game.emit('hafenmeister:halt', { boot: h.boot, platz: h.platz });
  }

  function rundgangAbbrechen() {
    const r = rundgang;
    if (!r) return;
    r.halte.length = 0;
    const a = r.agent;
    if (a.zustand === 'drinnen') return rundgangEnde(a);
    if (a.danach !== 'feierabend') befehl(a, r.start, 'feierabend');
  }

  function rundgangEnde(a) {
    entfernen(a);
    rundgang = null;
    api.rundgang = null;
    game.emit('hafenmeister:feierabend', {});
  }

  // ---------------------------------------------------------------- Boote
  function bootAngelegt(info) {
    if (!netz || info == null) return;
    const id = String(info.id);
    if (boote.has(id)) return;
    const platz = netz.plaetze.get(info.platz ?? info.berth);
    if (!platz) return;
    const roh = HAFEN.plaetze.find((p) => p.id === platz.id);
    const klasse = roh?.klasse ?? String(info.groesse ?? info.size ?? 'M').toUpperCase();
    const groesse = String(info.groesse ?? info.size ?? klasse).toLowerCase();
    const [mn, mx] = crewFuer({ groesse, art: info.art ?? info.kind, modell: info.modell ?? info.model });
    const menschen = info.crew ?? ganz(mn, mx);
    const gaeste = Number(info.tagesgaeste ?? tagesgaesteVon(id)) || 0;
    const b = { id, platz: platz.id, node: platz.node, klasse, crew: menschen, menschen: menschen + gaeste, agenten: [], ablegen: false, warten: [] };
    boote.set(id, b);

    const n = figurenFuer(menschen);
    for (let k = 0; k < n; k++) {
      const a = neueFigur({ boot: id, node: platz.node, klasse, sichtbar: false });
      if (!a) break;
      a.zustand = 'anbord';
      a.uhr = 2 + k * zufall(1.2, 2.4);          // nacheinander von Bord
      a.bleibtAbends = Math.random() < P.ABENDS_AN_LAND;
      a.ersterGang = true;
      b.agenten.push(a);
    }
    gepaeckBeimAnlegen(b, id);
    // Tagesgaeste grosser Schiffe gehen als Gruppe in den Ort
    if (gaeste > 0) {
      const g = Math.max(1, Math.ceil(gaeste / P.BUENDEL));
      // In Stufe 6 sind oft alle Figuren vergeben: Spaziergaenger machen Platz (P23 F7)
      platzMachen(g);
      let fuehrer = null;
      for (let k = 0; k < g; k++) {
        const a = neueFigur({ boot: id, node: platz.node, klasse, sichtbar: false, buendel: P.BUENDEL });
        if (!a) break;
        a.zustand = 'anbord';
        a.uhr = 6;
        if (!fuehrer) { fuehrer = a; a.tempo = 1.1; } else { a.folgt = fuehrer; a.tempo = 1.1; fuehrer.folger.push(a); }
        b.agenten.push(a);
      }
    }
  }

  // ---------------------------------------------------------------- Bootsgeschichten (P86)
  // gepaeck 'aus': jemand geht mit Tasche von Bord in den Ort und kommt nicht wieder; 'ein': jemand
  // kommt mit Tasche aus dem Ort und geht an Bord; 'wechsel': beides; 'einkauf': wer in den Ort geht,
  // kommt mit einer Einkaufstasche zurück.
  const geschichteVon = (id) => game.geschichten?.geschichte?.(game.sim?.state?.boats?.[id]) ?? null;
  const neueTasche = () => new THREE.Color(wahl(TASCHEN));
  function heimKnoten(komp) {
    const heim = netz.zuhause.filter((n) => netz.komp[n] === komp);
    return heim.length ? wahl(heim) : null;
  }
  function gepaeckBeimAnlegen(b, id) {
    const g = geschichteVon(id)?.gepaeck;
    if (!g) return;
    b.gepaeck = g;
    if ((g === 'aus' || g === 'wechsel') && b.agenten.length) {
      const a = b.agenten[0];
      a.tasche = neueTasche();
      a.verlaesst = true;
    }
    if (g === 'ein' || g === 'wechsel') {
      const start = heimKnoten(netz.komp[b.node]);
      const a = start != null ? neueFigur({ boot: id, node: start, klasse: b.klasse }) : null;
      if (a) {
        a.tasche = neueTasche();
        a.steigtZu = true;
        a.zustand = 'steht';
        a.uhr = zufall(4, 14);
        a.besuche = 0;
        b.agenten.push(a);
      }
    }
  }
  // In den Ort: zu einem Weg am Rand (Dorf, Straßenende), dort eine Weile "drinnen", dann zurück
  function inDenOrt(a, landgang) {
    if (!landgang?.ort || a.warImOrt) return false;
    // Kurzhalter: nur, wenn noch genug Zeit bis zum Ablegen ist (Weg hin und zurück)
    const boot = game.sim?.state?.boats?.[a.boot];
    if (boot?.leaveClock != null && boot.leaveClock - (game.sim.state.clock ?? 0) < 90) return false;
    const andere = Object.entries(landgang).reduce((s, [k, v]) => s + (k === 'ort' ? 0 : v), 0);
    if (Math.random() > landgang.ort / (landgang.ort + andere + 10)) return false;
    const ziel = heimKnoten(netz.komp[a.node]);
    if (ziel == null || ziel === a.node) return false;
    a.ziel = null;
    a.warImOrt = true;
    befehl(a, ziel, 'ort');
    return true;
  }

  /**
   * Leute versammeln sich an einem Punkt (Siegerehrung der Regatta am Segelclub): anzahl Menschen aus dem
   * Ort und die Crews der Boote in boote kommen hin und bleiben dauer Sekunden. Gibt die Zahl zurück.
   */
  function versammeln({ x, z, anzahl = 8, dauer = 40, boote: ids = [] } = {}) {
    if (!netz) return 0;
    const ort = netz.naechster(x / U, -z / U, netz.flaechen.festland);
    if (ort == null || ort < 0) return 0;
    let n = 0;
    const hin = (a) => {
      a.ziel = null;
      a.versammlung = { dauer: dauer * zufall(0.8, 1.2), x, z };
      a.besuche = Math.min(a.besuche ?? 0, 1);
      if (a.zustand === 'anbord' || a.zustand === 'drinnen') a.zustand = 'steht';
      befehl(a, ort, 'versammlung');
      n++;
    };
    for (const id of ids) {
      const b = boote.get(String(id));
      if (!b || b.ablegen) continue;
      for (const a of b.agenten) if (a.zustand !== 'entfernt' && !a.verlaesst && netz.komp[a.node] === netz.komp[ort]) hin(a);
    }
    // Leute aus dem Ort kommen von den nächsten Wegen und Haustüren (nicht vom anderen Ende der Karte)
    const o = netz.nodes[ort];
    const nahe = netz.zuhause.filter((n) => netz.komp[n] === netz.komp[ort])
      .sort((p, q) => Math.hypot(netz.nodes[p].x - o.x, netz.nodes[p].y - o.y) - Math.hypot(netz.nodes[q].x - o.x, netz.nodes[q].y - o.y))
      .slice(0, 4);
    for (let k = 0; k < anzahl; k++) {
      const start = nahe.length ? wahl(nahe) : null;
      if (start == null) break;
      const a = neueFigur({ node: start, typ: 'ort' });
      if (!a) break;
      a.zustand = 'steht';
      a.besuche = 0;
      hin(a);
    }
    return n;
  }

  function tagesgaesteVon(id) {
    const boot = game.sim?.state?.boats?.[id] ?? game.state?.boats?.[id];
    return boot?.dayVisitors ?? 0;
  }

  function bootLegtAb(id) {
    const b = boote.get(String(id));
    if (!b || b.ablegen) return;
    b.ablegen = true;
    for (const a of b.agenten) {
      if (a.zustand === 'entfernt') continue;
      a.eile = 1.7;
      a.folgt = null;
      a.besuche = 0;
      if (a.zustand === 'anbord' && a.node === b.node) { a.uhr = 1e9; continue; }
      if (a.zustand === 'wartet-start') a.zustand = 'steht';
      heimAnBord(a, b);
    }
    pruefeAnBord(b.id);
    // Wer es nicht rechtzeitig schafft, ist trotzdem an Bord (verschwindet still)
    b.frist = P.WARTEN_MAX;
  }

  function bootWeg(id) {
    const b = boote.get(String(id));
    if (!b) return;
    for (const a of b.agenten) entfernen(a);
    for (const fn of b.warten) fn();
    boote.delete(b.id);
  }

  function alleAnBord(b) {
    return b.agenten.every((a) => a.zustand === 'entfernt' || (a.zustand === 'anbord' && a.node === b.node));
  }

  function pruefeAnBord(id) {
    const b = boote.get(String(id));
    if (!b || !b.ablegen || !alleAnBord(b)) return;
    for (const fn of b.warten.splice(0)) fn();
    // Ohne Schiffsanimationen gibt es kein boat:left, dann hier aufraeumen
    if (!animGesehen) bootWeg(b.id);
  }

  function anBord(id) {
    const b = boote.get(String(id));
    if (!b || alleAnBord(b)) return Promise.resolve();
    return new Promise((resolve) => b.warten.push(resolve));
  }

  // ---------------------------------------------------------------- Laufen
  const tmp = { x: 0, y: 0, z: 0 };
  function bewegen(a, dt) {
    let rest = a.tempo * a.eile * dt;
    while (rest > 0 && a.pfad) {
      const p0 = a.pfad[a.i], p1 = a.pfad[a.i + 1];
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1e-6;
      const schritt = Math.min(rest, len - a.t);
      a.t += schritt;
      rest -= schritt;
      if (a.t >= len - 1e-6) {
        a.i++;
        a.t = 0;
        a.node = p1.n;
        if (a.i >= a.pfad.length - 1) {
          a.x = p1.x; a.y = p1.y; a.z = p1.z;
          angekommen(a);
          return;
        }
      }
    }
    if (!a.pfad) return;
    const p0 = a.pfad[a.i], p1 = a.pfad[a.i + 1];
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1e-6;
    const f = a.t / len;
    const dx = (p1.x - p0.x) / len, dz = (p1.z - p0.z) / len;
    // seitlich versetzt, damit sich niemand genau auf derselben Linie bewegt (nicht an Bord-Enden)
    const art0 = netz.nodes[p0.n].art, art1 = netz.nodes[p1.n].art;
    const boden0 = art0 === 'land' || art0 === 'sand', boden1 = art1 === 'land' || art1 === 'sand';
    const seite = art0 === 'boot' || art1 === 'boot' ? 0 : boden0 && boden1 ? a.seite * 1.8 : a.seite;
    tmp.x = p0.x + (p1.x - p0.x) * f - dz * seite;
    tmp.z = p0.z + (p1.z - p0.z) * f + dx * seite;
    // Auf dem Boden der Hoehe folgen (gerade gezogene Wege sind lang und gehen ueber Kuppen)
    tmp.y = boden0 && boden1 ? hoeheLand(tmp.x, tmp.z) : p0.y + (p1.y - p0.y) * f;
    a.x = tmp.x; a.y = tmp.y; a.z = tmp.z;
    a.blick = Math.atan2(-dz, dx);
  }

  function schritt(dt) {
    for (const a of agenten) {
      if (a.zustand === 'entfernt') continue;
      if (a.zustand === 'geht') { bewegen(a, dt); continue; }
      a.uhr -= dt;
      if (a.uhr > 0) continue;
      if (a.zustand === 'schlange') { ansteheEnde(a); continue; }
      if (a.zustand === 'wartet-start') {
        const c = a.befehl;
        a.befehl = null;
        a.zustand = 'steht';
        if (c) geheZu(a, c.node, c.wenn);
        continue;
      }
      weiter(a);
    }
    // Fristen fuer ablegende Boote
    for (const b of boote.values()) {
      if (!b.ablegen || b.frist == null) continue;
      b.frist -= dt;
      if (b.frist <= 0) {
        for (const a of b.agenten) if (a.zustand !== 'entfernt') { a.zustand = 'anbord'; a.node = b.node; a.pfad = null; }
        b.frist = null;
        pruefeAnBord(b.id);
      }
    }
    // Entfernte Figuren aufraeumen
    for (let k = agenten.length - 1; k >= 0; k--) {
      if (agenten[k].zustand === 'entfernt') agenten.splice(k, 1);
    }
    for (const b of boote.values()) b.agenten = b.agenten.filter((a) => a.zustand !== 'entfernt');
    schlangenOrdnen(dt);
    spaziergaenger(dt);
  }

  // Menschen ohne Boot: Spaziergaenger aus dem Ort und Badegaeste. Wie viele, haengt von Stufe,
  // Jahreszeit, Tageszeit und Regen ab (Zahlen in data/people.js).
  function soll(typ) {
    const basis = P.SPAZIERGAENGER[typ]?.[stufe] ?? 0;
    const f = (P.JAHRESZEIT[typ]?.[jahreszeit] ?? 1) * (abend ? P.ABENDS[typ] : 1) * (regen ? P.REGEN : 1);
    return Math.round(basis * f * festFaktor(typ));
  }
  // Ereignisse mit vielen Besuchern (Mittsommer, Heringstage, Hanse-Woche, ECONOMY.ereignisse.<id>.menschen):
  // mehr Spaziergänger und Badegäste, abends bleiben mehr (Mittsommer: am Strand)
  function festFaktor(typ) {
    const m = game.events?.current?.event?.menschen;
    if (!m) return 1;
    return (abend ? m.abends?.[typ] ?? m[typ] : m[typ]) ?? 1;
  }

  function badewetter() {
    return jahreszeit === 'sommer' && !abend && !regen;
  }

  function startKnoten(typ) {
    if (typ === 'strand') return netz.duenen.length ? wahl(netz.duenen) : null;
    const heim = netz.zuhause.filter((n) => netz.komp[n] === netz.flaechen.festland);
    return heim.length ? wahl(heim) : null;
  }

  function spaziergaenger(dt) {
    spawnUhr -= dt;
    if (spawnUhr > 0 || !netz) return;
    spawnUhr = zufall(1.5, 4);
    for (const typ of ['ort', 'strand']) {
      const ist = agenten.reduce((n, a) => n + (a.typ === typ && a.zustand !== 'entfernt' ? 1 : 0), 0);
      if (ist >= soll(typ)) continue;
      const start = startKnoten(typ);
      if (start == null) continue;
      const a = neueFigur({ node: start, typ });
      if (!a) return;
      a.zustand = 'steht';
      a.uhr = 0;
    }
  }

  // Beim Start und nach Stufenwechsel die Menschen ohne Boot schon verteilen, damit der Hafen
  // nicht erst minutenlang leer ist. Badegaeste sitzen dann schon am Strand.
  function vorverteilen() {
    for (const typ of ['ort', 'strand']) {
      const flaeche = typ === 'strand' ? netz.flaechen.nehrung : netz.flaechen.festland;
      const orte = typ === 'strand'
        ? netz.ziele.filter((z) => z.art === 'strand' && netz.komp[z.node] === flaeche).map((z) => z.node)
        : netz.nodes.map((n, i) => i).filter((i) => netz.nodes[i].art === 'land' && netz.komp[i] === flaeche &&
            Math.hypot(netz.nodes[i].x - netz.zentrum.x, netz.nodes[i].y - netz.zentrum.y) < P.NAEHE * 1.5);
      const n = soll(typ);
      for (let k = 0; k < n && orte.length; k++) {
        const a = neueFigur({ node: wahl(orte), typ });
        if (!a) return;
        if (typ === 'strand' && Math.random() < 0.6) {
          a.zustand = 'verweilt';
          a.sitzt = true;
          a.blick = Math.PI / 2 + zufall(-0.8, 0.8);
          a.uhr = zufall(5, 60);
        } else {
          a.zustand = 'steht';
          a.uhr = zufall(0, 3);
        }
      }
    }
  }

  // Wenn Jahreszeit, Tageszeit oder Wetter wechseln: ueberzaehlige gehen nach und nach heim
  function anpassen() {
    for (const typ of ['ort', 'strand']) {
      const liste = agenten.filter((a) => a.typ === typ && a.zustand !== 'entfernt');
      let zuviel = liste.length - soll(typ);
      for (const a of liste) {
        if (zuviel <= 0) break;
        a.besuche = 0;
        if (a.zustand === 'verweilt' || a.zustand === 'steht') a.uhr = Math.min(a.uhr, zufall(1, 15));
        zuviel--;
      }
      // Badende kommen aus dem Wasser, wenn kein Badewetter ist
      if (!badewetter()) for (const a of liste) if (a.ziel?.art === 'baden' && a.zustand === 'verweilt') a.uhr = Math.min(a.uhr, zufall(1, 6));
    }
  }

  // ---------------------------------------------------------------- Zeichnen
  function zeichnen() {
    let n = 0, nt = 0;
    const zeit = game.time;
    for (const a of agenten) {
      if (a.zustand === 'entfernt' || a.zustand === 'drinnen' || a.zustand === 'anbord' || a.zustand === 'wartet-start' && a.node === boote.get(a.boot)?.node) continue;
      if (n >= max) break;
      const geht = a.zustand === 'geht';
      const hub = geht ? Math.abs(Math.sin(zeit * 7 * a.tempo + a.phase)) * 0.06 : 0;
      const wiegen = geht ? Math.sin(zeit * 7 * a.tempo + a.phase) * 0.06 : 0;
      quat.setFromAxisAngle(achse, a.blick);
      kipp.setFromAxisAngle(querachse, wiegen);
      quat.multiply(kipp);
      const s = a.buendel > 1 ? 1.15 : 1;
      skala.set(s, s, s);
      pos.set(a.x, a.y + hub - (a.sitzt ? 0.6 : 0), a.z);
      mat.compose(pos, quat, skala);
      koerper.setMatrixAt(n, mat);
      kopf.setMatrixAt(n, mat);
      koerper.setColorAt(n, a.koerperFarbe);
      kopf.setColorAt(n, a.kopfFarbe);
      if (a.tasche && !a.sitzt) {
        tasche.setMatrixAt(nt, mat);
        tasche.setColorAt(nt, a.tasche);
        nt++;
      }
      n++;
    }
    tasche.count = nt;
    tasche.instanceMatrix.needsUpdate = true;
    if (tasche.instanceColor) tasche.instanceColor.needsUpdate = true;
    const hm = rundgang?.agent;
    const hmSichtbar = hm && (hm.zustand === 'geht' || hm.zustand === 'verweilt' || hm.zustand === 'steht');
    muetze.visible = !!hmSichtbar;
    if (hmSichtbar) {
      const geht = hm.zustand === 'geht';
      muetze.position.set(hm.x, hm.y + (geht ? Math.abs(Math.sin(zeit * 7 * hm.tempo + hm.phase)) * 0.06 : 0), hm.z);
      muetze.rotation.set(0, hm.blick, 0);
    }
    koerper.count = n;
    kopf.count = n;
    koerper.instanceMatrix.needsUpdate = true;
    kopf.instanceMatrix.needsUpdate = true;
    if (koerper.instanceColor) koerper.instanceColor.needsUpdate = true;
    if (kopf.instanceColor) kopf.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- Stufe
  function setStage(n) {
    const s = Math.max(1, Math.min(6, Math.round(Number(n) || 1)));
    if (s === stufe && netz) return;
    stufe = s;
    // Gebaeude setzen ihre Lage im selben Ereignis, deshalb kurz danach bauen
    queueMicrotask(() => {
      neuesNetz();
      // Alles neu verteilen: Crews der Boote bleiben, wenn es ihren Platz noch gibt
      const alt = [...boote.values()].map((b) => ({ id: b.id, platz: b.platz, groesse: b.klasse, crew: b.menschen }));
      agenten.length = 0;
      rundgang = null;
      boote.clear();
      for (const info of alt) bootAngelegt(info);
      for (const b of boote.values()) for (const a of b.agenten) a.uhr = zufall(0, 4);
      vorverteilen();
      if (params.get('leute') === 'voll') alleBelegen();
    });
  }

  // Testhilfe: jede Box der Stufe mit einer Crew belegen
  function alleBelegen() {
    for (const [id] of netz.plaetze) {
      const roh = HAFEN.plaetze.find((p) => p.id === id);
      bootAngelegt({ id: 'test-' + id, platz: id, groesse: roh?.klasse ?? 'M' });
    }
  }

  // Beim Laden eines Spielstands liegen Boote schon
  function vorhandeneBoote() {
    const liste = game.sim?.boote;
    const arr = typeof liste === 'function' ? liste() : liste;
    if (!Array.isArray(arr)) return;
    for (const b of arr) if (b.zustand === 'liegt' && b.platz) { bootAngelegt(b); }
    for (const b of boote.values()) for (const a of b.agenten) a.uhr = zufall(0, 6);
  }

  // ---------------------------------------------------------------- Ereignisse
  // Mit Schiffsanimationen gehen die Leute erst von Bord, wenn alle Leinen fest sind (boat:moored).
  // Ohne sie reicht boot:angelegt aus den Spielregeln.
  game.on('boot:angelegt', (info) => {
    if (!info) return;
    if (animGesehen || game.boatAnim) {
      wartend.set(String(info.id), { info, frist: 40 });
    } else {
      bootAngelegt(info);
    }
  });
  game.on('boat:moored', (info) => {
    animGesehen = true;
    if (!info) return;
    const w = wartend.get(String(info.id));
    wartend.delete(String(info.id));
    // Von Box zu Box (Umlegen, Umzug beim Stufenausbau, Tankstopp): boat-anim meldet 'boat:cast-off', aber
    // kein 'boat:left'. Die Crew gehört dann noch zum alten Platz; am neuen Platz beginnt sie von vorn.
    const alt = boote.get(String(info.id));
    const neuerPlatz = netz?.plaetze.get(w?.info?.platz ?? info.berth);
    if (alt && neuerPlatz && (alt.ablegen || alt.platz !== neuerPlatz.id)) {
      const crew = alt.crew;
      bootWeg(alt.id);
      bootAngelegt({ ...(w?.info ?? {}), ...info, platz: neuerPlatz.id, groesse: w?.info?.groesse ?? info.size, crew: w?.info?.crew ?? crew });
      return;
    }
    bootAngelegt({ ...(w?.info ?? {}), ...info, platz: w?.info?.platz ?? info.berth, groesse: w?.info?.groesse ?? info.size });
  });
  game.on('boot:ablegen', (info) => { const id = info?.id ?? info; wartend.delete(String(id)); bootLegtAb(id); });
  // Nachts abgerechnet, legt am Vormittag ab (Spielregeln: 'sim:departed', dann 'boot:ablegen')
  game.on('sim:departed', (e) => { const b = boote.get(String(e?.boatId ?? e?.id)); if (b) b.abreise = true; });
  game.on('boat:cast-off', (info) => {
    const id = info?.id ?? info;
    bootLegtAb(id);
    // Leinen los: wer noch an Land ist, hat es nicht mehr geschafft und ist trotzdem an Bord
    // (sonst liefe er übers Wasser zur leeren Box)
    const b = boote.get(String(id));
    if (b) b.frist = 0;
  });
  game.on('boat:left', (info) => bootWeg(info?.id ?? info));
  // Gekauftes Gebaeude: buildings.js stellt es im selben Ereignis auf, danach Netz erneuern
  game.on('build', () => { if (netz) queueMicrotask(netzErneuern); });
  // Stegprojekt gebaut, Stufenausbau, Spielstand geladen: render/stege.js meldet den neuen Stand
  game.on('stege', () => queueMicrotask(() => {
    const gb = game.stege?.gebaut?.();
    if (netz && gb && gb.stufe === stufe && gb.sig !== netzStege) netzErneuern();
  }));
  game.on('sim:change', (e) => { if (netz && e?.reason === 'load') queueMicrotask(netzErneuern); });
  // Gelaende neu gebaut (Region, Kuestentyp beim Laden): Netz auf den neuen Boden legen
  game.on('landschaft:geaendert', () => { if (netz) queueMicrotask(netzErneuern); });
  game.on('stufe', (n) => setStage(typeof n === 'object' ? n?.stufe ?? n?.stage : n));
  // Neues Angebot an Land (services.js stellt das Modell im selben Ereignis auf): Netz erneuern wie bei 'build'
  game.on('services:gebaut', ({ id } = {}) => {
    if (P.SERVICE_ZIELE.includes(id) && netz) queueMicrotask(netzErneuern);
  });
  // Fest beginnt oder endet: Zahl der Spaziergänger anpassen
  for (const name of ['event:start', 'event:end']) game.on(name, () => { if (netz) anpassen(); });
  game.on('season', (s) => {
    const part = typeof s === 'object' ? s?.part : s;
    if (!part || part === jahreszeit) return;
    jahreszeit = part;
    if (netz) anpassen();
  });
  game.on('weather', (w) => {
    const neu = (w?.rain ?? 0) >= 0.3 || (w?.snow ?? 0) > 0.5;
    if (neu === regen) return;
    regen = neu;
    if (netz) anpassen();
  });
  game.on('phase', (p) => {
    const neu = (typeof p === 'object' ? p?.phase : p) === 'abend';
    if (neu === abend) return;
    abend = neu;
    // Morgens gehen die Crews wieder an Land
    // (ausser bei Booten, die heute Vormittag ablegen: die Crew bleibt an Bord und macht klar)
    if (!abend) for (const b of boote.values()) for (const a of b.agenten) {
      // Wer abends im Restaurant sass, ist in der Nacht an Bord gegangen
      if (a.zustand === 'drinnen' && a.uhr > 1e8) { a.zustand = 'anbord'; a.node = b.node; a.pfad = null; a.ziel = null; }
      if (a.zustand === 'anbord' && !b.ablegen) a.uhr = b.abreise ? 1e9 : zufall(1, 30);
    }
    // Abends: wer nicht im Restaurant bleibt, geht beim naechsten Halt an Bord
    if (abend) for (const a of agenten) if (a.zustand === 'verweilt' || a.zustand === 'drinnen') a.uhr = Math.min(a.uhr, zufall(1, 8));
    if (netz) anpassen();
    // Abends geht der Hafenmeister ueber die Stege (docs/echter-hafen.md, A4), erst mit dem Abend
    // (Review Ue12). Morgens bricht er ab und geht ins Buero.
    if (abend) { rundgangHeute = true; rundgangStarten(); }
    else { rundgangAbbrechen(); rundgangHeute = false; }
  });
  game.on('ready', () => {
    const tag = game.state?.day ?? game.state?.tag ?? 1;
    jahreszeit = game.events?.season?.(tag)?.part ?? jahreszeit;
    abend = (game.state?.phase ?? 'day') === 'evening';
    const s = game.state?.stufe ?? game.state?.stage ?? params.get('stufe') ?? stufe;
    stufe = 0;
    setStage(s);
    queueMicrotask(() => queueMicrotask(vorhandeneBoote));
  });

  game.onTick((dt) => {
    if (!netz) return;
    // Abend schon da (Spielstand am Abend geladen, Stufenwechsel): Rundgang einmal nachholen
    if (abend && !rundgangHeute && !rundgang) { rundgangHeute = true; rundgangStarten(); }
    if (dt > 0) {
      // Bei Vorspulen oder langsamen Geraeten in Teilschritten rechnen, damit niemand langsamer
      // laeuft als die Spieluhr (hoechstens 2 s Spielzeit je Bild)
      let rest = Math.min(dt, 2);
      while (rest > 1e-6) {
        const d = Math.min(rest, 0.25);
        rest -= d;
        for (const [id, w] of wartend) {
          w.frist -= d;
          if (w.frist <= 0) { wartend.delete(id); bootAngelegt(w.info); }
        }
        schritt(d);
      }
    }
    zeichnen();
  });

  // Leute aus dem Ort gehen gezielt zu einem Ziel (art wie in data/people.js ZIELE, z. B. 'raeucherei')
  // und danach wieder nach Hause. Nacheinander im Abstand von abstand Sekunden Spielzeit.
  // Liefert die Zahl der Figuren, die losgehen (0, wenn es das Ziel nicht gibt).
  function besucher(art, anzahl, { abstand = 2.5 } = {}) {
    if (!netz || !(anzahl > 0)) return 0;
    const ziele = netz.ziele.filter((z) => z.art === art || z.id === `service-${art}`);
    if (!ziele.length) return 0;
    platzMachen(anzahl);
    let n = 0;
    for (let k = 0; k < anzahl; k++) {
      const z = wahl(ziele);
      const heim = netz.zuhause.filter((x) => netz.komp[x] === netz.komp[z.node]);
      if (!heim.length) break;
      const a = neueFigur({ node: wahl(heim), typ: 'besuch' });
      if (!a) break;
      a.zustand = 'steht';
      a.uhr = k * abstand;
      a.zielFest = z;
      n++;
    }
    return n;
  }

  const api = {
    group,
    netz: null,
    besucher,
    anBord,
    versammeln,
    bootAngelegt,
    bootLegtAb,
    rundgangStarten,
    rundgang: null,
    // Stand der Stege, aus dem das Wegenetz gebaut ist (gleich game.stege.gebaut().sig, sobald es passt)
    netzStand: () => netzStege,
    anzahl: () => {
      const lebend = agenten.filter((a) => a.zustand !== 'entfernt');
      return { figuren: lebend.length, menschen: lebend.reduce((s, a) => s + a.buendel, 0), sichtbar: koerper.count };
    },
    _agenten: agenten,
    // Zum Pruefen: wie oft welches Ziel gewaehlt wird (typ 'crew' | 'ort' | 'strand', Tagesanteil u)
    _wahlStatistik(typ = 'crew', u = tagesAnteil(), n = 2000) {
      const flaeche = typ === 'strand' ? netz.flaechen.nehrung : netz.flaechen.festland;
      const start = typ === 'strand' ? netz.duenen[0] : netz.naechster(netz.zentrum.x, netz.zentrum.y - 6, flaeche);
      const zaehler = {};
      for (let k = 0; k < n; k++) {
        const z = zielWaehlen({ typ, node: start, tempo: 1.25, eile: 1 }, u);
        if (z) zaehler[z.art] = (zaehler[z.art] ?? 0) + 1;
      }
      return zaehler;
    },
  };
  game.people = api;
  return api;
}

export default init;
