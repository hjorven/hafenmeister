// Services und Sonderanlagen im Spiel: Bauplaetze, Baukarte, 3D-Modelle, Abrechnung.
// Eingetragen in MODULES in js/main.js. Daten: js/data/services.js, Regeln: js/services/rules.js,
// Modelle: js/render/services-models.js. Beschreibung: docs/services.md.
//
//   game.services.liste()            Services der aktuellen Hafenstufe mit Preis und Sperrgruenden
//   game.services.bauen(id)          naechste Ausbaustufe bauen (bezahlt mit game.sim.spend)
//   game.services.effekte()          Ruf-Bonus, Gaeste-Faktoren, Sturmschutz, Freischaltungen (fuer sim.js)
//   game.services.abrechnen(tag)     Tagesabrechnung, siehe rules.js; passiert auch bei game.emit('tag:ende', tag)
//   game.services.naechsteBesuche()  "Kreuzfahrtschiff in 3 Tagen" fuer die Oberflaeche
//   game.services.oeffnen(id)        Baukarte zeigen
//
// Ereignisse, die dieses Modul sendet:
//   services:gebaut { id, stufe, name, kosten }     services:abrechnung { tag, einnahmen, summe, besuche }
//   services:besuch-angekuendigt { id, art, tag, text }   services:besuch { id, art, tag, dauer, einnahme, gaeste }
//   services:einsatz { id: 'seenotretter' }          services:karte { id } (Karte offen)
// Ereignisse, auf die es hoert: stufe, tap, ui:cancel, tag:ende, sturm, spielstand-geladen.
//
// Zum Ausprobieren: index.html?stufe=4 (Bauplaetze erscheinen, antippen, bauen) oder
// index.html?stufe=5&services=alle (alles voll ausgebaut).
import * as THREE from 'three';
import { SERVICES } from '../data/services.js';
import { erstelleRegeln, neuerZustand, mitZahlen } from '../services/rules.js';
import { baueModell, tPier, LAND_Y, mat, FARBE } from './services-models.js';
import { HAFEN } from '../data/harbor.js';
import { initBesuche } from './services-besuch.js';

const U = 0.62;

const welt = (lage) => ({ x: lage.x * U, z: -lage.y * U, ry: THREE.MathUtils.degToRad(lage.dreh ?? 0) });
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;

export function init(game) {
  const params = new URLSearchParams(location.search);
  const alleZeigen = params.get('services') === 'alle';
  // Zum Ausprobieren mit ?stufe=n: diese Stufe gilt fest, Bauen kostet nichts, der Ruf zaehlt als 5.
  const testStufe = Number(params.get('stufe')) || 0;
  let R = erstelleRegeln(SERVICES);

  // Der Services-Zustand liegt im Spielstand unter game.state.modules.services (wird mitgespeichert),
  // solange es keinen Spielstand gibt, hier.
  let eigenerZustand = neuerZustand();
  const zustand = () => {
    const st = game.state;
    if (st && typeof st === 'object') {
      if (!st.modules) st.modules = {};
      if (!st.modules.services) st.modules.services = eigenerZustand;
      return st.modules.services;
    }
    return eigenerZustand;
  };
  let winter = false;
  let stufe = testStufe || game.state?.stufe || 1;
  const kontext = () => ({ stufe, ruf: testStufe ? 5 : game.sim?.reputation?.() ?? game.state?.ruf ?? 3, geld: !testStufe && Number.isFinite(game.state?.geld) ? game.state.geld : undefined,
    tag: game.state?.tag ?? 1 });
  const sichtbar = () => true;

  const gruppe = new THREE.Group();
  gruppe.name = 'services';
  game.scene.add(gruppe);

  // Bodenhoehe der Landschaft in Metern (unter Wasser negativ), ohne Landschaft LAND_Y
  const boden = (x, z) => {
    const h = game.landschaft?.hoeheBei?.(x, z);
    return Number.isFinite(h) ? h : LAND_Y;
  };
  // Teile an Land auf den Boden setzen: Die Modelle sind fuer Land in LAND_Y gebaut, die Landschaft
  // ist an Ufer, Duenen und Nehrung hoeher. Wasserteile (Stege, Boote) bleiben, wo sie sind.
  // userData.land erzwingt das Anheben (z. B. Kranarm), userData.fest verbietet es (selbst gesetzt).
  // Abstand vom Anker bis zum Wasser in Blickrichtung des Modells (lokal -z), hoechstens 60 m
  function uferAbstand(w) {
    const dx = -Math.sin(w.ry), dz = -Math.cos(w.ry);
    for (let d = 0; d <= 60; d += 1) if (boden(w.x + dx * d, w.z + dz * d) < 0) return d;
    return 8;
  }
  const _b = new THREE.Box3(), _v = new THREE.Vector3();
  function aufBoden(gr) {
    gr.updateMatrixWorld(true);
    for (const c of gr.children) {
      if (c.userData.fest) continue;
      _b.setFromObject(c);
      if (_b.isEmpty()) continue;
      const minLokal = _b.min.y - gr.position.y;
      if (!c.userData.land && minLokal < LAND_Y - 0.1) continue;
      _b.getCenter(_v);
      const dy = Math.min(4, Math.max(0, boden(_v.x, _v.z) - LAND_Y));
      c.position.y += dy;
    }
  }

  // ------------------------------------------------------------------ Modelle in der Szene
  const anlagen = new Map();     // id -> { stufe, group, update, einsatz, pop }
  function zeigeAnlage(id, mitAnimation) {
    const n = R.stufeVon(zustand(), id);
    const alt = anlagen.get(id);
    if (alt && alt.stufe === n) return;
    if (alt) { gruppe.remove(alt.group); entsorge(alt.group); anlagen.delete(id); }
    if (n <= 0) return;
    const w = welt(R.lage(zustand(), id));
    const m = baueModell(id, n, { boden: boden(w.x, w.z), ufer: uferAbstand(w) });
    m.group.position.set(w.x, 0, w.z);
    m.group.rotation.y = w.ry;
    aufBoden(m.group);
    m.group.name = `service-${id}`;
    m.group.userData.pick = { type: 'building', id };
    gruppe.add(m.group);
    const a = { stufe: n, group: m.group, update: m.update, einsatz: m.einsatz, pop: mitAnimation ? 0 : 1 };
    if (mitAnimation) m.group.scale.set(1, 0.01, 1);
    anlagen.set(id, a);
  }

  // ------------------------------------------------------------------ Bauplaetze
  const plaetze = new Map();     // id -> Group
  const ringMat = new THREE.MeshBasicMaterial({ color: '#fffcf6', transparent: true, opacity: 0.7, depthWrite: false });
  function bauplatz(id) {
    const g = new THREE.Group();
    g.userData.pick = { type: 'buildsite', id };
    g.name = `bauplatz-${id}`;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 32).rotateX(-Math.PI / 2), ringMat);
    ring.position.y = LAND_Y + 0.05;
    g.add(ring);
    const pfahl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), mat(FARBE.wood2));
    pfahl.position.y = LAND_Y + 1.3;
    g.add(pfahl);
    // Schild mit gruenem Plus, zur Kamera (Sueden) geneigt
    const schild = new THREE.Group();
    schild.position.set(0, LAND_Y + 2.6, 0);
    schild.rotation.x = -0.75;
    schild.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.15), mat(FARBE.white)));
    const quer = new THREE.Mesh(new THREE.BoxGeometry(1, 0.26, 0.06), mat(FARBE.green));
    const hoch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1, 0.06), mat(FARBE.green));
    quer.position.z = hoch.position.z = 0.1;
    schild.add(quer, hoch);
    g.add(schild);
    // Unsichtbare Trefferflaeche, damit der Finger den Bauplatz leicht trifft
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = LAND_Y + 1.6;
    g.add(hit);
    g.userData.ring = ring;
    return g;
  }

  // Grossschiffpier ab Stufe 6 (Linien aus harbor.js, steg 'P'; stege.js zeichnet bauart 'pier' nicht)
  let pier = null;
  function zeigePier() {
    const soll = stufe >= 6;
    if (soll && !pier) {
      const aus = (HAFEN.stufen?.[6]?.stege ?? []).filter((l) => l.steg === 'P').map((l) => l.punkte);
      pier = tPier(aus.length ? aus : [[[-225, 214.3], [-225, 262]], [[-377, 262], [-77, 262]]]);
      gruppe.add(pier);
    } else if (!soll && pier) {
      gruppe.remove(pier); entsorge(pier); pier = null;
    }
  }

  function aktualisiere(mitAnimationFuer = null) {
    zeigePier();
    const z = zustand();
    for (const s of R.katalog) {
      if (!sichtbar(s.id)) continue;
      zeigeAnlage(s.id, s.id === mitAnimationFuer);
      const zeigePlatz = R.stufeVon(z, s.id) === 0 && s.abStufe <= stufe;
      const vorhanden = plaetze.get(s.id);
      if (zeigePlatz && !vorhanden) {
        const g = bauplatz(s.id);
        const w = welt(s.stufen[0].lage ?? s.lage);
        g.position.set(w.x, Math.max(0, boden(w.x, w.z) - LAND_Y), w.z);
        gruppe.add(g);
        plaetze.set(s.id, g);
      } else if (!zeigePlatz && vorhanden) {
        gruppe.remove(vorhanden);
        entsorge(vorhanden);
        plaetze.delete(s.id);
      }
    }
  }

  // ------------------------------------------------------------------ Baukarte
  const karte = document.getElementById('card');
  let offeneKarte = null;
  injiziereStil();

  function oeffnen(id) {
    const s = R.byId[id];
    if (!s || !karte || !sichtbar(id)) return;
    const z = zustand();
    const n = R.stufeVon(z, id);
    const p = R.pruefe(z, id, kontext());
    const aktuell = n > 0 ? s.stufen[n - 1] : null;
    const besuch = R.naechsteBesuche(z, kontext().tag).find((b) => b.id === id);
    const zeilen = [];
    zeilen.push(`<h3 class="svc-titel">${aktuell ? aktuell.name : s.name}</h3>`);
    zeilen.push(`<p class="svc-text">${s.kurz}</p>`);
    if (n > 0 && s.stufen.length > 1) zeilen.push(`<p class="svc-stufe">Ausbau ${n} von ${s.stufen.length}</p>`);
    if (z.summe[id]) zeilen.push(`<p class="svc-text">Bisher eingenommen: ${euro(z.summe[id])}</p>`);
    if (besuch) zeilen.push(`<p class="svc-text">${besuch.text}: ${besuch.inTagen === 0 ? 'heute' : besuch.inTagen === 1 ? 'morgen' : `in ${besuch.inTagen} Tagen`}</p>`);
    if (!p.fertig) {
      const label = n === 0 ? `Bauen ${euro(p.kosten)}` : `${p.def.name} ${euro(p.kosten)}`;
      if (p.freigeschaltet) {
        zeilen.push(`<button type="button" class="svc-bauen" ${p.geldFehlt ? 'disabled' : ''}>${label}</button>`);
        if (p.geldFehlt) zeilen.push(`<p class="svc-hinweis">Noch nicht genug Geld.</p>`);
      } else if (n > 0) {
        zeilen.push(`<p class="svc-hinweis">Nächster Ausbau „${p.def.name}“ braucht: ${p.fehlt.join(', ')}</p>`);
      } else {
        zeilen.push(`<p class="svc-hinweis">Braucht: ${p.fehlt.join(', ')}</p>`);
      }
    }
    karte.innerHTML = `<div class="svc-karte">${zeilen.join('')}</div>`;
    karte.hidden = false;
    document.body.classList.add('card-open');
    offeneKarte = id;
    karte.querySelector('.svc-bauen')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = bauen(id);
      if (r.ok) schliessen();
    });
    game.emit('services:karte', { id });
  }

  function schliessen() {
    if (!offeneKarte || !karte) return;
    karte.hidden = true;
    karte.innerHTML = '';
    document.body.classList.remove('card-open');
    offeneKarte = null;
  }

  // ------------------------------------------------------------------ Aktionen
  function bauen(id) {
    const k = kontext();
    const r = R.bauen(zustand(), id, k);
    if (!r.ok) return r;
    if (testStufe) {
      // kostenlos im Testmodus
    } else if (game.sim?.spend) {
      if (!game.sim.spend(r.kosten)) {             // Geld reicht doch nicht: Bau zuruecknehmen
        const z = zustand();
        if (r.stufe > 1) z.gebaut[id] = r.stufe - 1; else delete z.gebaut[id];
        return { ...r, ok: false, geldFehlt: true };
      }
    } else if (Number.isFinite(game.state?.geld)) {
      game.state.geld -= r.kosten;
    }
    aktualisiere(id);
    const s = R.byId[id];
    game.emit('services:gebaut', { id, stufe: r.stufe, name: s.stufen[r.stufe - 1].name, kosten: r.kosten });
    game.emit('services:effekte', R.effekte(zustand()));
    return r;
  }

  function abrechnen(tagDaten) {
    const sturm = /sturm|storm/i.test(String(game.events?.current?.id ?? game.events?.current?.type ?? ''));
    const daten = { tag: tagDaten?.tag ?? game.state?.tag ?? 1, winter, wetter: sturm ? 'sturm' : 'sonne', ...tagDaten };
    const r = R.tagesabschluss(zustand(), daten);
    // Gutgeschrieben wird summe von den Spielregeln (js/bridge.js hoert auf services:abrechnung).
    for (const a of r.angekuendigt) game.emit('services:besuch-angekuendigt', a);
    for (const b of r.besuche) game.emit('services:besuch', b);
    game.emit('services:abrechnung', r);
    return r;
  }

  // ------------------------------------------------------------------ Ereignisse
  game.on('tap', (e) => {
    const pick = e?.pick;
    const id = pick?.id;
    if (pick && (pick.type === 'buildsite' || pick.type === 'building') && R.byId[id]) {
      if (offeneKarte === id) schliessen(); else oeffnen(id);
    } else if (offeneKarte) {
      schliessen();
    }
  });
  game.on('ui:cancel', schliessen);
  game.on('stufe', (n) => {
    const v = Number(typeof n === 'object' ? n?.stufe : n);
    if (v >= 1 && !testStufe) { stufe = v; aktualisiere(); }
  });
  game.on('tag:ende', (d) => abrechnen(d));
  game.on('day:start', (d) => { winter = !!d?.winter; });
  game.on('sturm', () => {
    const a = anlagen.get('seenotretter');
    if (a?.einsatz) { a.einsatz(game.time); game.emit('services:einsatz', { id: 'seenotretter' }); }
  });
  game.on('spielstand-geladen', (st) => {
    if (st?.modules?.services) eigenerZustand = st.modules.services;
    if (st?.stufe && !testStufe) stufe = st.stufe;
    aktualisiere();
  });

  // ------------------------------------------------------------------ Animation
  game.onTick((dt, g) => {
    const t = g.time;
    for (const a of anlagen.values()) {
      if (a.pop < 1) {
        // Wachsen mit kleinem Nachfedern
        a.pop = Math.min(1, a.pop + dt / 0.9);
        const p = a.pop, s = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
        a.group.scale.set(1, Math.max(0.01, s), 1);
      }
      a.update?.(dt, t);
    }
    for (const g2 of plaetze.values()) {
      const k = 1 + Math.sin(t * 2.4) * 0.12;
      g2.userData.ring.scale.set(k, 1, k);
    }
    // Wahrend der Pause stehen auch die Services still (dt = 0, game.time bleibt)
  });

  // ------------------------------------------------------------------ Start
  if (alleZeigen) {
    const z = zustand();
    for (const s of R.katalog) z.gebaut[s.id] = s.stufen.length;
  }
  aktualisiere();
  game.on('ready', () => {
    if (game.state?.stufe) stufe = testStufe || game.state.stufe;
    // Gelaendehoehe steht erst jetzt fest: Modelle und Bauplaetze neu setzen
    for (const [id, a] of anlagen) { gruppe.remove(a.group); entsorge(a.group); anlagen.delete(id); }
    for (const [id, p] of plaetze) { gruppe.remove(p); entsorge(p); plaetze.delete(id); }
    aktualisiere();
  });

  // Zahlen aus dem Balancing, sobald es sie gibt (js/data/economy.js, ECONOMY.services)
  import('../data/economy.js')
    .then((m) => {
      const ue = (m.ECONOMY ?? m.default)?.services;
      if (ue) { R = erstelleRegeln(mitZahlen(SERVICES, ue)); api.katalog = R.katalog; }
    })
    .catch(() => {});

  const api = {
    katalog: R.katalog,
    zustand,
    liste: () => R.liste(zustand(), kontext()).filter((x) => sichtbar(x.id)),
    pruefe: (id) => R.pruefe(zustand(), id, kontext()),
    stufeVon: (id) => R.stufeVon(zustand(), id),
    bauen,
    effekte: () => fuerSpielregeln(R.effekte(zustand())),
    abrechnen,
    naechsteBesuche: () => R.naechsteBesuche(zustand(), kontext().tag),
    planeBesuch: (id, tag) => R.planeBesuch(zustand(), id, tag),
    oeffnen,
    schliessen,
    gruppe,
  };
  game.services = api;
  api.besuche = initBesuche(game, api);
  return api;
}

// Effekte zusaetzlich in den Feldnamen der Spielregeln (docs/spielregeln.md, Modifikatoren).
// Die deutschen Felder bleiben fuer Ereignisse und Oberflaeche.
const UNLOCK = { kreuzfahrtschiff: 'kreuzfahrt', marine: 'marine', traditionssegler: 'traditionssegler',
  fahrgastschiff: 'fahrgastschiff', seenotkreuzer: 'seenotkreuzer', regatta: 'regatta' };
export function fuerSpielregeln(e) {
  const unlock = {};
  for (const f of e.freischalten) unlock[UNLOCK[f] ?? f] = true;
  const { XXL: _x, ...sizeFactor } = e.gaeste;
  return {
    ...e,
    ratingBonus: e.ruf,
    sizeFactor,
    unlock,
    // Segelmacher: Segelboote zahlen mehr. Die Regeln kennen nur einen Preisfaktor fuer alle,
    // darum anteilig (etwa 60 % der Gaeste sind Segler).
    priceFactor: 1 + (e.hafengeld.segel - 1) * 0.6,
    visitorFactor: 1 + e.besucherFuerVersorgung / 100,
  };
}

function entsorge(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

function injiziereStil() {
  if (document.getElementById('svc-stil')) return;
  const st = document.createElement('style');
  st.id = 'svc-stil';
  st.textContent = `
    .svc-karte { max-width: min(340px, calc(100vw - 32px)); }
    .svc-titel { margin: 0 0 6px; font-size: 1.1rem; }
    .svc-text, .svc-stufe, .svc-hinweis { margin: 4px 0; font-size: 0.95rem; line-height: 1.35; }
    .svc-stufe { opacity: 0.7; }
    .svc-hinweis { color: #9a4a3c; }
    .svc-bauen { margin-top: 10px; min-height: var(--tap, 44px); width: 100%; border: 0; border-radius: 10px;
      background: #509e80; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .svc-bauen:disabled { background: #a8b4bc; cursor: default; }
  `;
  document.head.appendChild(st);
}
