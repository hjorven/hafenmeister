// Services und Sonderanlagen im Spiel: Bauplaetze, Baukarte, 3D-Modelle, Abrechnung.
// Eingetragen in MODULES in js/main.js. Daten: js/data/services.js, Regeln: js/services/rules.js,
// Modelle: js/render/services-models.js. Beschreibung: docs/services.md.
//
//   game.services.liste()            Services der aktuellen Hafenstufe mit Preis und Sperrgruenden
//   game.services.bauen(id)          naechste Ausbaustufe bauen (bezahlt mit game.sim.spend)
//   game.services.effekte()          gebaute Angebote (Wuensche, P19), Gaeste-Faktoren, Sturmschutz, Freischaltungen (fuer sim.js)
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
import { SERVICES, GROSSSCHIFF_BESUCHE, DIENST_TEXTE } from '../data/services.js';
import { erstelleRegeln, neuerZustand, mitZahlen } from '../services/rules.js';
import { baueModell, tPier, tankstelle, absaugstation, LAND_Y, mat, FARBE } from './services-models.js';
import { buendeln } from './buendeln.js';
import { HAFEN } from '../data/harbor.js';
import { initBesuche } from './services-besuch.js';
import { initWirkung } from './services-wirkung.js';
import { regelnBereit } from '../features/regeln-bereit.js';

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
  let probeUhr = null;           // Tageszeit waehrend buendeln() die Modelle probeweise bewegt
  function zeigeAnlage(id, mitAnimation) {
    const n = R.stufeVon(zustand(), id);
    const alt = anlagen.get(id);
    if (alt && alt.stufe === n) return;
    if (alt) { gruppe.remove(alt.group); entsorge(alt.group); anlagen.delete(id); }
    if (n <= 0) return;
    const lage = R.lage(zustand(), id);
    const w = welt(lage);
    const m = baueModell(id, n, { lage, boden: boden(w.x, w.z), ufer: uferAbstand(w), uhr: () => probeUhr ?? game.sim?.tagesAnteil?.() ?? 0.5 });
    m.group.position.set(w.x, 0, w.z);
    m.group.rotation.y = w.ry;
    aufBoden(m.group);
    // Unbewegte Teile zusammenfassen (weniger Zeichenaufrufe); Modelle mit Einsatz-Animation bleiben einzeln
    if (!m.einsatz) buendeln(m.group, m.update, (u) => { probeUhr = u; });
    m.group.name = `service-${id}`;
    m.group.userData.pick = { type: 'building', id };
    gruppe.add(m.group);
    const a = { stufe: n, group: m.group, update: m.update, einsatz: m.einsatz, boot: m.boot ?? null, pop: mitAnimation ? 0 : 1 };
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

  // Grossschiffpiers ab Stufe 6: Kreuzfahrtpier (steg 'P') und Marinepier (steg 'MA'), Linien aus harbor.js;
  // stege.js zeichnet bauart 'pier' nicht
  let pier = null;
  function zeigePier() {
    const soll = stufe >= 6;
    if (soll && !pier) {
      const aus = (HAFEN.stufen?.[6]?.stege ?? []).filter((l) => l.bauart === 'pier').map((l) => l.punkte);
      pier = tPier(aus);
      buendeln(pier, null);
      gruppe.add(pier);
    } else if (!soll && pier) {
      gruppe.remove(pier); entsorge(pier); pier = null;
    }
  }

  // Stufe 6: Kreuzfahrtschiff (bis y 517) und Windjammer-Reihe (bis y 473) liegen nördlich der Kartengrenze
  // aus main.js (y 352). Die Kamera darf dann so weit nach Norden, dass man sie ganz sieht.
  function kameraNachNorden() {
    const b = game.camera?.bounds;
    if (b && stufe >= 6) b.minZ = Math.min(b.minZ, -500 * U);
  }

  function aktualisiere(mitAnimationFuer = null) {
    kameraNachNorden();
    zeigePier();
    const z = zustand();
    for (const s of R.katalog) {
      if (!sichtbar(s.id)) continue;
      zeigeAnlage(s.id, s.id === mitAnimationFuer);
      // Wahlplatz der ersten Stufe (Café oder Eisdiele): nur ein Schild, und keins mehr, sobald eines steht
      const w1 = R.wahlplatz(s.id, 1);
      const platzBelegt = w1 && w1.optionen.some((o) => o.id !== s.id && (R.stufeVon(z, o.id) >= o.stufe ||
        (R.byId[o.id]?.abStufe <= stufe && w1.optionen.indexOf(o) < w1.optionen.findIndex((x) => x.id === s.id))));
      const zeigePlatz = R.stufeVon(z, s.id) === 0 && s.abStufe <= stufe && !platzBelegt;
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
    // Karte aus Elementen bauen (textContent statt innerHTML)
    const box = document.createElement('div');
    box.className = 'svc-karte';
    const zeile = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; e.textContent = text; box.appendChild(e); return e; };
    zeile('h3', 'svc-titel', aktuell ? aktuell.name : s.name);
    zeile('p', 'svc-text', s.kurz);
    if (n > 0 && s.stufen.length > 1) zeile('p', 'svc-stufe', `Ausbau ${n} von ${s.stufen.length}`);
    // Bilanz (F9): bezahlt, verdient, bezahlt sich in etwa n Tagen
    const bil = R.bilanz(z, id);
    if (bil) {
      const heute = z.heute?.je?.[id];
      const b = document.createElement('dl');
      b.className = 'svc-bilanz';
      const paar = (k, v) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; b.append(dt, dd); };
      paar('Gebaut für', euro(bil.bezahlt));
      paar('Bisher verdient', euro(bil.verdient));
      if (bil.proTag) paar('Im Schnitt', `${euro(bil.proTag)} am Tag`);
      if (heute) paar('Zuletzt', heute.text.replace(/^[^:]*: /, ''));
      box.appendChild(b);
      zeile('p', bil.tage === 0 ? 'svc-bezahlt' : 'svc-text',
        bil.tage === 0 ? 'Hat sich schon bezahlt gemacht.'
          : bil.tage != null ? `Bezahlt sich in etwa ${bil.tage} ${bil.tage === 1 ? 'Saisontag' : 'Saisontagen'}.`
            : bil.tageBisher ? 'Hat bisher nichts eingebracht.' : 'Die erste Abrechnung kommt heute Abend.');
    }
    if (besuch) zeile('p', 'svc-text', `${besuch.text}: ${besuch.inTagen === 0 ? 'heute' : besuch.inTagen === 1 ? 'morgen' : `in ${besuch.inTagen} Tagen`}`);
    if (!p.fertig) {
      const label = p.umbau ? `${p.def.name} statt ${p.umbau.name} ${euro(p.kosten)}` : n === 0 ? `Bauen ${euro(p.kosten)}` : `${p.def.name} ${euro(p.kosten)}`;
      const sch = R.schaetzung(z, id, letzterTag);
      if (p.freigeschaltet) {
        if (sch?.proTag > 0) zeile('p', 'svc-text', `Bringt an einem Tag wie gestern etwa ${euro(sch.proTag)} mehr${sch.tage ? `, bezahlt sich in etwa ${sch.tage} Tagen` : ''}.`);
        if (p.umbau) zeile('p', 'svc-hinweis', p.umbau.auf > 0 ? `${p.umbau.platzName}: ${p.umbau.name} wird dafür zu ${p.umbau.aufName} zurückgebaut.` : `${p.umbau.platzName}: ${p.umbau.name} macht dafür Platz.`);
        const knopf = zeile('button', 'svc-bauen', label);
        knopf.type = 'button';
        knopf.disabled = !!p.geldFehlt;
        if (p.geldFehlt) zeile('p', 'svc-hinweis', 'Noch nicht genug Geld.');
      } else if (n > 0) {
        zeile('p', 'svc-hinweis', `Nächster Ausbau „${p.def.name}“ braucht: ${p.fehlt.join(', ')}`);
      } else {
        zeile('p', 'svc-hinweis', `Braucht: ${p.fehlt.join(', ')}`);
      }
    }
    // Entweder-oder (F3): die andere Option am selben Platz, als Umbau
    // Noch frei: Hinweis, dass hier nur eines von beiden passt
    const oder = !p.fertig ? R.wahlAlternative(z, id, n + 1) : null;
    if (oder && !oder.gebaut && !p.umbau) zeile('p', 'svc-oder', oder.text);
    // Schon belegt: die andere Option als Umbau anbieten
    for (const w of R.wahlen) {
      const mein = w.optionen.find((o) => o.id === id);
      if (!mein || n < mein.stufe) continue;
      for (const o of w.optionen) {
        if (o.id === id) continue;
        const q = R.pruefe(z, o.id, kontext());
        if (q.fertig || q.umbau?.id !== id) continue;
        zeile('p', 'svc-oder', w.text);
        if (q.freigeschaltet) {
          const k2 = zeile('button', 'svc-umbau', `Umbauen: ${q.def.name} ${euro(q.kosten)}`);
          k2.type = 'button';
          k2.dataset.id = o.id;
          k2.disabled = !!q.geldFehlt;
        } else zeile('p', 'svc-hinweis', `Umbau zu ${q.def.name} braucht: ${q.fehlt.join(', ')}`);
      }
    }
    karte.replaceChildren(box);
    karte.hidden = false;
    document.body.classList.add('card-open');
    offeneKarte = id;
    karte.querySelector('.svc-bauen')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = bauen(id);
      if (r.ok) schliessen();
    });
    for (const k of karte.querySelectorAll('.svc-umbau')) k.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = bauen(k.dataset.id);
      if (r.ok) schliessen();
    });
    game.emit('services:karte', { id });
  }

  function schliessen() {
    if (!offeneKarte || !karte) return;
    karte.hidden = true;
    karte.replaceChildren();
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
    // Wahlplatz (F3): die andere Option ist zurueckgebaut, ihr Modell wechselt mit aktualisiere()
    if (r.umbau) game.emit('services:umgebaut', { id: r.umbau.id, stufe: r.umbau.auf, statt: id });
    game.emit('services:gebaut', { id, stufe: r.stufe, name: s.stufen[r.stufe - 1].name, kosten: r.kosten, umbau: r.umbau ?? null });
    game.emit('services:effekte', R.effekte(zustand()));
    return r;
  }

  // Wetter eines Tages wie im Balancing (tools/balance.mjs): Sturm, Regen (rain > 0,3) oder Sonne.
  // Vorher kannte die Abrechnung im Spiel nur Sturm und Sonne, Regen wirkte nie (P23).
  function wetterVon(tag) {
    const sturm = /sturm|storm/i.test(String(game.events?.current?.id ?? game.events?.current?.type ?? ''));
    if (sturm) return 'sturm';
    let w = null;
    try { w = game.events?.weather?.(tag); } catch { w = null; }
    return (w?.rain ?? 0) > 0.3 ? 'regen' : 'sonne';
  }

  // Letzter Saisontag fuer die Schaetzung auf Karte und Baumenue (F9)
  let letzterTag = null;
  const ankuenfteHeute = [];
  let tagesgaesteSchnitt = 0;

  // Dauerlieger mit Vertrag (P20 H5): im Hafen, auf Törn oder im Winterlager (features/dauerlieger.js)
  function dauerliegerListe() {
    const st = game.sim?.state;
    const plaetze = st?.modules?.dauer?.plaetze;
    if (!plaetze) return [];
    const typ = game.sim?.ctx?.typeById ?? {};
    const out = [];
    for (const p of Object.values(plaetze)) {
      const b = p.boot || st.boats?.[p.bootId];
      if (!b) continue;
      out.push({ klasse: b.size, antrieb: b.motor ? 'motor' : typ[b.typeId]?.sail ? 'segel' : 'ruder',
        imHafen: !p.boot, winterlager: !!p.winterlager, kuendigung: p.kuendigung ?? null });
    }
    return out;
  }

  function abrechnen(tagDaten) {
    const tag = tagDaten?.tag ?? game.state?.tag ?? 1;
    const jahr = game.events?.season?.(tag);
    const daten = { tag, winter, wetter: wetterVon(tag), saisonTag: jahr?.seasonDay ?? null,
      saisonTage: game.sim?.ctx?.rules?.seasonDays ?? null, dauerlieger: dauerliegerListe(), ...tagDaten };
    const r = R.tagesabschluss(zustand(), daten);
    // Bezahlte Dienste an den Booten der Spielregeln vermerken (zahlen nur einmal)
    for (const d of r.dienstBezahlt ?? []) {
      const b = game.sim?.state?.boats?.[d.boatId];
      if (b?.dienste?.[d.id] === 'offen') b.dienste[d.id] = 'bezahlt';
    }
    if (!daten.winter) {
      tagesgaesteSchnitt = tagesgaesteSchnitt * 0.75 + (r.tagesgaeste ?? 0) * 0.25;
      letzterTag = { wetter: 'sonne', boote: daten.boote ?? [], ankuenfte: ankuenfteHeute.splice(0), tagesgaesteSchnitt };
    }
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
    // Freier Bauplatz: Vorschau im Baumodus (ui/bauen.js), gebautes Gebaeude: eigene Karte
    if (pick?.type === 'buildsite' && R.byId[id] && game.bauen) {
      if (offeneKarte) schliessen();
      game.bauen.vorschau(`angebot:${id}`);
    } else if (pick && (pick.type === 'buildsite' || pick.type === 'building') && R.byId[id]) {
      if (offeneKarte === id) schliessen(); else oeffnen(id);
    } else if (offeneKarte) {
      schliessen();
    }
  });
  game.on('ui:cancel', schliessen);
  game.on('stufe', (n) => {
    const v = Number(typeof n === 'object' ? n?.stufe : n);
    // Im Testmodus (?stufe=n) nur die Startstufe aus der Adresse, ein Ausbau gilt danach auch hier
    if (v >= 1 && (!testStufe || v !== stufe)) { stufe = v; aktualisiere(); }
  });
  // ------------------------------------------------------------------ Tankstelle (Versorgung "diesel")
  // Gekauft wird sie über die Spielregeln (Bauen, sim.js facilities.diesel), hier steht das Modell
  // auf dem Dienststeg aus harbor.js. Im Testmodus ?stufe=n wie die Gebäude: alles der Stufe.
  const TANK_STUFE = { 1: 4, 2: 5 };            // ab welcher Hafenstufe die Testansicht Stufe 1 und 2 zeigt
  let tank = null;
  function tankStufe() {
    if (testStufe) return testStufe >= TANK_STUFE[2] ? 2 : testStufe >= TANK_STUFE[1] ? 1 : 0;
    return Number(game.sim?.state?.facilities?.diesel) || 0;
  }
  function tankLage() {
    const st = HAFEN.stufen?.[Math.min(6, Math.max(4, stufe))] ?? {};
    const d = (st.dienste ?? []).find((x) => x.art === 'tankstelle');
    // Dienststeg der Tankstelle (steg null, an der Lage des Dienstes vorbei), sonst die Lage selbst
    const l = (st.stege ?? []).find((x) => x.steg == null && x.punkte?.length === 2 && d &&
      Math.abs(x.punkte[0][1] - x.punkte[1][1]) < 1 && Math.abs(x.punkte[0][1] - d.y) < 10);
    if (!d) return null;
    const y = l ? l.punkte[0][1] : d.y;
    return { x: d.x + 2, y };
  }
  function zeigeTankstelle(mitAnimation) {
    const n = tankStufe();
    if (tank && tank.stufe === n) return;
    if (tank) { gruppe.remove(tank.group); entsorge(tank.group); tank = null; }
    const lage = n > 0 ? tankLage() : null;
    if (!lage) return;
    const m = tankstelle(n);
    buendeln(m.group, m.update);
    m.group.position.set(lage.x * U, 0, -lage.y * U);
    m.group.rotation.y = Math.PI;                  // Säulen zur Südkante, dort legen die Boote an
    m.group.name = 'service-tankstelle';
    gruppe.add(m.group);
    tank = { stufe: n, group: m.group, update: m.update, pop: mitAnimation ? 0 : 1 };
    if (mitAnimation) m.group.scale.set(1, 0.01, 1);
  }
  game.on('build', (e) => { if (!e || e.id === 'diesel' || e.key === 'diesel') zeigeTankstelle(true); });
  game.on('sim:change', () => zeigeTankstelle(false));
  game.on('stufe', () => queueMicrotask(() => zeigeTankstelle(false)));
  game.on('ready', () => zeigeTankstelle(false));

  // ------------------------------------------------------------------ Absaugstation (Versorgung "absaugen", P31)
  // Steht auf demselben Dienststeg wie die Tankstelle, ein Stück weiter westlich, auch ohne Tankstelle.
  const ABSAUG_STUFE = { 1: 5, 2: 6 };
  const ABSAUG_VERSATZ = -9;                     // Planeinheiten nach Westen von der Tankstelle
  let absaug = null;
  function absaugStufe() {
    if (testStufe) return testStufe >= ABSAUG_STUFE[2] ? 2 : testStufe >= ABSAUG_STUFE[1] ? 1 : 0;
    return Number(game.sim?.state?.facilities?.absaugen) || 0;
  }
  function absaugLage() {
    const l = tankLage();
    return l ? { x: l.x + ABSAUG_VERSATZ, y: l.y } : null;
  }
  function zeigeAbsaugstation(mitAnimation) {
    const n = absaugStufe();
    if (absaug && absaug.stufe === n) return;
    if (absaug) { gruppe.remove(absaug.group); entsorge(absaug.group); absaug = null; }
    const lage = n > 0 ? absaugLage() : null;
    if (!lage) return;
    const m = absaugstation(n);
    buendeln(m.group, m.update);
    m.group.position.set(lage.x * U, 0, -lage.y * U);
    m.group.rotation.y = Math.PI;
    m.group.name = 'service-absaugstation';
    gruppe.add(m.group);
    absaug = { stufe: n, group: m.group, update: m.update, pop: mitAnimation ? 0 : 1 };
    if (mitAnimation) m.group.scale.set(1, 0.01, 1);
  }
  game.on('build', (e) => { if (!e || e.id === 'absaugen' || e.key === 'absaugen') zeigeAbsaugstation(true); });
  game.on('sim:change', () => zeigeAbsaugstation(false));
  game.on('stufe', () => queueMicrotask(() => zeigeAbsaugstation(false)));
  game.on('ready', () => zeigeAbsaugstation(false));

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
    for (const x of [tank, absaug]) {
      if (!x) continue;
      x.update(dt, t);
      if (x.pop < 1) {
        x.pop = Math.min(1, x.pop + dt / 0.9);
        const p = x.pop;
        x.group.scale.set(1, Math.max(0.01, 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)), 1);
      }
    }
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
    // Alles voll ausgebaut; auf Wahlplätzen die erste Option, mit ?wahl=2 die zweite (zum Ansehen der Modelle)
    const z = zustand();
    for (const s of R.katalog) z.gebaut[s.id] = s.stufen.length;
    const nr = params.get('wahl') === '2' ? 1 : 0;
    for (const w of R.wahlen) {
      const weg = w.optionen[1 - nr];
      if (weg.stufe - 1 > 0) z.gebaut[weg.id] = weg.stufe - 1; else delete z.gebaut[weg.id];
    }
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
    // Lage der Absaugstation in Welt-Metern (P31, für die Bau-Vorschau), null ohne Dienststeg
    absaugOrt: () => { const l = absaugLage(); return l ? { x: l.x * U, z: -l.y * U } : null; },
    liste: () => R.liste(zustand(), kontext()).filter((x) => sichtbar(x.id)),
    pruefe: (id) => R.pruefe(zustand(), id, kontext()),
    stufeVon: (id) => R.stufeVon(zustand(), id),
    // Regelmaessiger Besuch der gebauten Stufe ({ art, alleTage, dauer, ... }) oder null
    besuchVon: (id) => R.aktiveStufe(zustand(), id)?.wirkung?.besuch ?? null,
    bauen,
    // Nach Rücknahme eines Kaufs im Baumenü (ui/bauen.js stellt den Zustand wieder her, Roadmap P18)
    neuZeichnen: () => { aktualisiere(); game.emit('services:effekte', R.effekte(zustand())); },
    effekte: () => fuerSpielregeln(R.effekte(zustand())),
    // P23: Bilanz und Schaetzung (F9), Satz zum Dienst eines Gastboots (F2), Wahlplaetze (F3)
    bilanz: (id) => R.bilanz(zustand(), id),
    schaetzung: (id) => R.schaetzung(zustand(), id, letzterTag),
    dienstText: (boot) => dienstText(boot),
    // P37: Rettungsboot der Seenotretter-Station (THREE.Group am Liegeplatz) oder null; features/havarie.js
    // blendet es aus, solange eine Kopie einen Havaristen einschleppt
    seenotBoot: () => anlagen.get('seenotretter')?.boot ?? null,
    wahlen: () => R.wahlen,
    _regeln: () => R,
    abrechnen,
    naechsteBesuche: () => R.naechsteBesuche(zustand(), kontext().tag),
    planeBesuch: (id, tag) => R.planeBesuch(zustand(), id, tag),
    // Ziel Stufe 6 (economy.js ziel.grossschiffBesuche): derselbe Zaehler wie im Abschlussziel
    // (state.bigVisits, gezaehlt in bridge.js nach GROSSSCHIFF_BESUCHE, erst ab der letzten Stufe)
    grossschiffBesuche: () => game.state?.bigVisits ?? 0,
    grossschiffArten: GROSSSCHIFF_BESUCHE,
    // Statistik je Besuchsart ueber das ganze Spiel (auch vor Stufe 6, auch Windjammer), zaehlt nicht fuers Ziel
    besucheJeArt: () => ({ ...(zustand().anzahl ?? {}) }),
    oeffnen,
    schliessen,
    gruppe,
  };
  // Kai K01 gehoert dem Ausflugsschiff, sobald der Fahrgastanleger steht: Gastboote legen dort nicht mehr an
  // (Passregel 'fit' der Spielregeln). Liegt noch ein Gast dort, faehrt das Ausflugsschiff erst nach dessen Abfahrt.
  let k01Gesperrt = false;
  function k01Sperren() {
    if (k01Gesperrt || !game.sim?.addHook) return;
    game.sim.addHook('fit', ({ berth }) => (berth?.id === 'K01' && R.stufeVon(zustand(), 'fahrgastanleger') > 0 ? 'reserved' : null));
    k01Gesperrt = true;
  }
  k01Sperren();
  game.on('ready', k01Sperren);

  // Liegeplatz an der Tankstelle (Welt, Südkante des Dienststegs), null ohne Tankstelle.
  // Boote mit der Geschichte "Tanken" halten hier beim Ablegen kurz (render/boat-view.js).
  api.tankPunkt = () => {
    if (!tank?.group?.visible || !tank.group.parent) return null;
    const p = tank.group.position;
    // Südkante des Stegs (Welt +z): dort liegen die Boote längsseits
    return { x: p.x, z: p.z + 1.6, seite: -1 };
  };
  // ------------------------------------------------------------------ Dienste an Gastbooten (F2)
  // Morgens, wenn die Boote des Tages feststehen (Haken 'arrivals', nach den Bootsgeschichten, die die
  // Naechte setzen), entscheidet sich, wer einen Dienst will (Mast legen, Radtour, Reparatur): Er bleibt
  // laenger und zahlt am ersten Abend. game.sim gibt es erst nach dem Laden der Bootsdaten.
  let dienstHaken = false;
  function dienstEinhaengen() {
    if (dienstHaken || !game.sim?.addHook) return;
    dienstHaken = true;
    game.sim.addHook('arrivals', ({ state, ctx, list }) => {
      const wetter = wetterVon(state.day);
      for (const boat of list ?? []) {
        const typ = ctx?.typeById?.[boat.typeId];
        const b = { id: boat.id, klasse: boat.size, antrieb: boat.motor ? 'motor' : typ?.sail ? 'segel' : 'ruder',
          nights: boat.nights, special: boat.special, stationed: boat.stationed };
        ankuenfteHeute.push({ klasse: b.klasse, antrieb: b.antrieb });
        if (ankuenfteHeute.length > 200) ankuenfteHeute.shift();
        const d = R.dienstBeiAnkunft(zustand(), b, { tag: state.day, wetter });
        if (!d) continue;
        boat.nights += d.naechte;
        boat.dienste = { ...(boat.dienste ?? {}), [d.id]: 'offen' };
      }
    });
  }
  regelnBereit(game).then(dienstEinhaengen).catch(() => {});
  function dienstText(boot) {
    const id = Object.keys(boot?.dienste ?? {})[0];
    if (!id || !DIENST_TEXTE[id]) return null;
    const n = R.aktiveStufe(zustand(), id)?.wirkung?.dienst?.naechte ?? 1;
    return `${DIENST_TEXTE[id]}, bleibt dafür ${n === 1 ? 'eine Nacht' : `${n} Nächte`} länger.`;
  }

  game.services = api;
  api.besuche = initBesuche(game, api);
  api.wirkung = initWirkung(game, api);
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
    // Kein Aufschlag mehr auf jede Bewertung: Gäste wünschen sich Angebote (P19 C3, rules.offerWishes)
    ratingBonus: 0,
    offers: { ...(e.angebote ?? {}) },
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
    .svc-bauen:disabled, .svc-umbau:disabled { background: #a8b4bc; cursor: default; }
    .svc-umbau { margin-top: 6px; min-height: var(--tap, 44px); width: 100%; border: 2px solid #509e80; border-radius: 10px;
      background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .svc-bilanz { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 8px 0 4px; font-size: 0.92rem; }
    .svc-bilanz dt { opacity: 0.7; }
    .svc-bilanz dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .svc-bezahlt { margin: 4px 0; font-size: 0.95rem; color: #3f7f62; }
    .svc-oder { margin: 8px 0 2px; font-size: 0.9rem; line-height: 1.35; opacity: 0.85; }
  `;
  document.head.appendChild(st);
}
