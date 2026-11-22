// Signalflaggen und Positionslichter an Booten (Roadmap P49, F33, docs/signalflaggen.md).
//
// 1. Signalflaggen als Wunschanzeige: Jeder Gast setzt für jeden Wunsch eine Buchstabenflagge an einer
//    kleinen Rah an Steuerbord (Segelboote unter der Saling, Motorboote am Radarmast, kleine Boote an
//    einem Flaggenstock). Hafen-Code: data/signalflaggen.js (W wie WC, D wie Dusche ...).
//    - wartend und beim Anfahren: alle Wünsche
//    - in der Box: nur, was noch fehlt. Erfüllte Flaggen gleiten die Leine hinab (eingeholt), sobald der
//      Wunsch erfüllt ist, auch gleich nach dem Bau des passenden Gebäudes.
//    - vor dem Auslaufen: nur der Blaue Peter (P), bis das Boot abgelegt hat
//    - nach Sonnenuntergang holen alle ihre Flaggen ein (Flaggenparade), morgens gehen sie wieder hoch
//    - Dauerlieger, Fischer und Behörden setzen keine.
// 2. Positionslichter: Boote, die in der Dämmerung oder nachts fahren, zeigen Rot an Backbord, Grün an
//    Steuerbord, ein weißes Hecklicht und Motorboote ein weißes Topplicht. (Das Ankerlicht an der Boje
//    kommt aus render/boat-view.js.)
//
// Liest nur: game.sim (state, ctx, platzWert), game.boatView.boote, game.boatAnim.wind,
// game.landscape.licht.zustand.nacht. Schreibt nichts in den Spielstand.
// Ereignis: 'signalflagge:gesetzt' { buchstabe, boatId, wunsch } beim Setzen jeder Flagge (Hafenwissen).
// Schnittstelle: game.signalflaggen = { flaggen(id), soll(id), lichter(id), anzahl() }.
import * as THREE from 'three';
import { flaggenRaster, FARBEN, BREITE, HOEHE, flaggeFuer, wunschVon, AUSLAUFEN } from '../data/signalflaggen.js';

const MOVING = new Set(['sailing', 'docking', 'casting-off', 'leaving']);
// Ab dieser Dunkelheit sind die Flaggen unten und die Positionslichter an
const NACHT_FLAGGEN = 0.3;
const NACHT_LICHTER = 0.12;
const HOECHSTENS = 3;              // so viele Flaggen untereinander (echte Signale haben bis zu vier)
const KURZHALT_VORLAUF = 0.04;
const WEIT_M = 220;                // Bildbreite in Metern, ab der die Flaggen nicht gezeichnet werden     // Anteil der Tageslänge: so lange vor dem Ablegen setzt ein Kurzhalter P

export function init(game) {
  if (!game.scene || typeof document === 'undefined') return;

  // ---------------------------------------------------------------- Tuch je Buchstabe
  const mats = new Map();
  function material(b) {
    if (mats.has(b)) return mats.get(b);
    const r = flaggenRaster(b);
    const c = document.createElement('canvas');
    c.width = BREITE;
    c.height = HOEHE;
    const g = c.getContext('2d');
    r.forEach((zeile, y) => [...zeile].forEach((f, x) => {
      if (f === '.') return;
      g.fillStyle = FARBEN[f];
      g.fillRect(x, y, 1, 1);
    }));
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshLambertMaterial({
      map: tex, side: THREE.DoubleSide, alphaTest: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.32,
    });
    mats.set(b, m);
    return m;
  }
  // Tuch: Liek (Mastseite) bei x = 0, weht nach +x
  const tuchGeo = new THREE.PlaneGeometry(1, HOEHE / BREITE).translate(0.5, -HOEHE / BREITE / 2, 0);
  const leineMat = new THREE.MeshBasicMaterial({ color: '#2a2f38' });
  const rahMat = new THREE.MeshLambertMaterial({ color: '#c9ced6' });
  const stabGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 5);

  // ---------------------------------------------------------------- Maße am Modell (einmal je Modell)
  const masse = new WeakMap();
  const _v = new THREE.Vector3();
  function vermessen(anim) {
    const model = anim.model;
    if (masse.has(model)) return masse.get(model);
    const L = anim.info?.length ?? 6;
    const B = anim.info?.beam ?? 2;
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    let top = { y: 0, x: 0, z: 0 };
    let rumpf = 0;   // höchster Punkt am Rand mittschiffs (Deckskante), für die Seitenlichter
    model.traverse((o) => {
      const pos = o.geometry?.attributes?.position;
      if (!pos || !o.isMesh || o.userData?.signal) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, pos.count >> 9)) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (Math.abs(_v.x) > L * 0.75 || Math.abs(_v.z) > B) continue;   // Fender, Leinen, Wimpel weit draußen
        if (_v.y > top.y) top = { y: _v.y, x: _v.x, z: _v.z };
        if (Math.abs(_v.x) < L * 0.3 && Math.abs(_v.z) > B * 0.32 && _v.y < 3.5) rumpf = Math.max(rumpf, _v.y);
      }
    });
    const kind = anim.info?.kind ?? 'motor';
    const deck = Math.max(0.3, rumpf || anim.info?.freeboard || 0.6);
    let art;
    let anker;
    if (top.y - deck > 4) {
      // Mast: Rah auf halber Höhe (Saling)
      art = 'mast';
      anker = { x: top.x, y: deck + (top.y - deck) * 0.5, z: 0 };
    } else if (top.y - deck > 1.2) {
      // Aufbau mit Radarmast oder Antenne: Rah oben
      art = 'aufbau';
      anker = { x: top.x, y: top.y + 0.15, z: 0 };
    } else {
      // kleines Boot: Flaggenstock mittschiffs an Steuerbord
      art = 'stock';
      anker = { x: L * 0.05, y: deck + 1.5, z: 0 };
    }
    const fw = Math.max(0.55, Math.min(1.25, L * 0.11));
    const r = { L, B, deck, top: top.y, kind, art, anker, fw, fh: fw * (HOEHE / BREITE) };
    masse.set(model, r);
    return r;
  }

  // ---------------------------------------------------------------- Welche Flaggen ein Boot setzen soll
  const st = () => game.sim?.state ?? null;
  const nachtJetzt = () => game.landscape?.licht?.zustand?.nacht ?? 0;
  function leaving(s, id) {
    for (const l of Object.values(s?.leaving || {})) if (String(l.boatId) === String(id)) return l;
    return null;
  }
  // Wünsche, die ein liegendes Boot erfüllt hat: beim letzten Prüfen der Spielregeln (sim.js checkWishes,
  // boat.erfuellt, beim Anlegen und jeden Morgen) oder schon jetzt sicher für morgen:
  // - Platz- und Angebotswünsche (Strom, Wasserhahn, Café ...), sobald Platz oder Angebot sie erfüllen
  // - Versorgung (WC, Dusche ...), sobald sie für alle liegenden Gäste mit diesem Wunsch reicht
  let nachfrage = null;   // { wunsch: Zahl liegender Gäste }, je Prüfrunde neu
  let last = null;        // Auslastung der Versorgung, je Prüfrunde neu
  function nachfrageJetzt(s) {
    if (nachfrage) return nachfrage;
    nachfrage = {};
    for (const b of Object.values(s.boats || {})) {
      if (b?.status !== 'moored' || b.stationed) continue;
      for (const w of b.wishes || []) nachfrage[w] = (nachfrage[w] || 0) + 1;
    }
    return nachfrage;
  }
  function erfuellt(s, b) {
    const ok = new Set(Array.isArray(b.erfuellt) ? b.erfuellt : []);
    const rules = game.sim?.ctx?.rules ?? {};
    let jetzt = null;
    for (const w of b.wishes || []) {
      if (ok.has(w)) continue;
      if (rules.berthWishes?.[w] || rules.offerWishes?.[w]) {
        try { jetzt ||= new Set(game.sim?.platzWert?.(b.id, b.berthId)?.met ?? []); } catch { jetzt = new Set(); }
        if (jetzt.has(w)) ok.add(w);
      } else {
        last ||= game.sim?.auslastung?.() ?? {};
        const kap = last[w]?.kapazitaet ?? 0;
        if (kap > 0 && kap >= (nachfrageJetzt(s)[w] || 0)) ok.add(w);
      }
    }
    return ok;
  }
  // Liste der Buchstaben (oben zuerst)
  function soll(id, anim) {
    const s = st();
    if (!s || nachtJetzt() > NACHT_FLAGGEN) return [];
    const b = s.boats?.[id];
    if (!b) {
      // abgereist: liegt noch in der Box und wartet auf seine Ablegezeit
      const l = leaving(s, id);
      return l && anim && (anim.moored || anim.state === 'casting-off') ? [AUSLAUFEN] : [];
    }
    if (b.stationed || b.dauer) return [];
    const wishes = Array.isArray(b.wishes) ? b.wishes : [];
    if (b.status === 'moored') {
      // Kurzhalter kurz vor dem Ablegen
      const dl = game.sim?.ctx?.rules?.dayLength ?? 0;
      if (b.nights === 0 && b.leaveClock != null && dl && s.clock >= b.leaveClock - dl * KURZHALT_VORLAUF) return [AUSLAUFEN];
      if (b.trip?.away) return [];
      const ok = erfuellt(s, b);
      return wishes.filter((w) => !ok.has(w)).map(flaggeFuer).filter(Boolean).slice(0, HOECHSTENS);
    }
    return wishes.map(flaggeFuer).filter(Boolean).slice(0, HOECHSTENS);
  }

  // ---------------------------------------------------------------- Rah und Flaggen am Boot
  const boote = new Map();   // id -> { g, model, mass, flaggen: [{ b, mesh, k, weg, y }], lichter }
  function aufbauen(id, anim) {
    const mass = vermessen(anim);
    const g = new THREE.Group();
    g.name = 'signalflaggen';
    g.userData.signal = true;
    g.position.set(mass.anker.x, mass.anker.y, 0);
    // Rah nach Steuerbord (+z), an ihrem Ende hängt die Flaggleine
    const rahLang = Math.max(0.5, mass.B * 0.5);
    const rah = new THREE.Mesh(stabGeo, rahMat);
    rah.scale.set(1, rahLang, 1);
    rah.rotation.x = Math.PI / 2;
    rah.position.z = rahLang / 2;
    rah.userData.signal = true;
    g.add(rah);
    if (mass.art === 'stock') {
      const stock = new THREE.Mesh(stabGeo, rahMat);
      stock.scale.set(1, mass.anker.y - mass.deck + 0.05, 1);
      stock.position.y = -(mass.anker.y - mass.deck) / 2;
      stock.userData.signal = true;
      g.add(stock);
    }
    const leine = new THREE.Mesh(stabGeo, leineMat);
    leine.userData.signal = true;
    leine.position.z = rahLang;
    leine.visible = false;
    g.add(leine);
    const traeger = new THREE.Group();   // dreht sich mit dem Wind um die Leine
    traeger.position.z = rahLang;
    traeger.userData.signal = true;
    g.add(traeger);
    g.visible = false;
    anim.model.add(g);
    const e = { g, rah, leine, traeger, model: anim.model, mass, flaggen: [], lichter: null, zuletzt: '' };
    boote.set(id, e);
    return e;
  }
  function weg(id) {
    const e = boote.get(id);
    if (!e) return;
    e.g.removeFromParent();
    if (e.lichter) e.lichter.removeFromParent();
    boote.delete(id);
  }

  function abgleichen(id, e, liste) {
    const sig = liste.join('');
    if (sig === e.zuletzt) return;
    e.zuletzt = sig;
    const s = st();
    // was nicht mehr gebraucht wird, holt die Crew ein
    for (const f of e.flaggen) if (!liste.includes(f.b)) f.weg = true;
    for (const b of liste) {
      const da = e.flaggen.find((f) => f.b === b && !f.weg);
      if (da) continue;
      const alt = e.flaggen.find((f) => f.b === b && f.weg);
      if (alt) { alt.weg = false; continue; }
      const mesh = new THREE.Mesh(tuchGeo, material(b));
      mesh.scale.set(e.mass.fw, e.mass.fw, 1);
      mesh.userData.signal = true;
      e.traeger.add(mesh);
      e.flaggen.push({ b, mesh, k: 0, weg: false, y: -e.mass.fh * 3 });
      game.emit?.('signalflagge:gesetzt', { buchstabe: b, boatId: id, wunsch: wunschVon(b), tag: s?.day ?? null });
    }
    // Reihenfolge wie in der Liste (oben zuerst), Eingeholte bleiben unten, bis sie weg sind
    e.flaggen.sort((a, c) => (a.weg - c.weg) || (liste.indexOf(a.b) - liste.indexOf(c.b)));
  }

  // ---------------------------------------------------------------- Positionslichter
  const lichtGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const glanzGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const LICHT = {
    rot: [new THREE.MeshBasicMaterial({ color: '#ff3b3b' }), new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.4, depthWrite: false })],
    gruen: [new THREE.MeshBasicMaterial({ color: '#3bff7a' }), new THREE.MeshBasicMaterial({ color: '#53ff8c', transparent: true, opacity: 0.4, depthWrite: false })],
    weiss: [new THREE.MeshBasicMaterial({ color: '#fff6d8' }), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.35, depthWrite: false })],
  };
  function lichtPunkt(farbe, x, y, z, name) {
    const [kern, glanz] = LICHT[farbe];
    const l = new THREE.Mesh(lichtGeo, kern);
    l.add(new THREE.Mesh(glanzGeo, glanz));
    l.position.set(x, y, z);
    l.name = name;
    l.userData.signal = true;
    return l;
  }
  function lichterBauen(e) {
    const { L, B, deck, top, kind } = e.mass;
    const g = new THREE.Group();
    g.name = 'positionslichter';
    g.userData.signal = true;
    const y = deck + 0.25;
    g.add(lichtPunkt('rot', L * 0.22, y, -B * 0.47, 'backbord'));
    g.add(lichtPunkt('gruen', L * 0.22, y, B * 0.47, 'steuerbord'));
    g.add(lichtPunkt('weiss', -L * 0.48, y, 0, 'heck'));
    if (kind !== 'sail' && kind !== 'row' && top > deck + 0.5) g.add(lichtPunkt('weiss', e.mass.anker.x, top + 0.1, 0, 'topp'));
    g.visible = false;
    e.model.add(g);
    e.lichter = g;
    return g;
  }

  // ---------------------------------------------------------------- Takt
  let pruefT = 1;
  game.on?.('sim:change', () => { pruefT = 1; nachfrage = null; last = null; });
  game.on?.('sim:moored', () => { pruefT = 1; });
  game.on?.('build', () => { pruefT = 1; });
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  game.onTick?.((dt) => {
    pruefT += dt;
    const t = game.time ?? 0;
    const nacht = nachtJetzt();
    if (pruefT > 0.5) {
      pruefT = 0;
      nachfrage = null;
      last = null;
      const da = new Set();
      for (const { id, anim } of game.boatView?.boote ?? []) {
        if (!anim?.model) continue;
        da.add(id);
        let e = boote.get(id);
        if (e && (e.model !== anim.model || !anim.model.parent)) { weg(id); e = null; }
        const liste = soll(id, anim);
        const lichtAn = nacht > NACHT_LICHTER && !anim.moored && MOVING.has(anim.state) && (anim.info?.size ?? 'M') !== 'XXL';
        if (!e && !liste.length && !lichtAn) continue;
        e ||= aufbauen(id, anim);
        abgleichen(id, e, liste);
        if (lichtAn && !e.lichter) lichterBauen(e);
        if (e.lichter) e.lichter.visible = lichtAn;
      }
      for (const id of [...boote.keys()]) if (!da.has(id)) weg(id);
    }
    // Wind: Flaggen wehen nach Lee
    const w = game.boatAnim?.wind ?? { fromDeg: 180, strength: 0.3 };
    const von = (w.fromDeg * Math.PI) / 180;
    const k = 1 - Math.exp(-dt * 3);
    // Aus großer Höhe sind die Tücher nicht zu erkennen: dann gar nicht zeichnen (spart Zeichenaufrufe)
    const weitWeg = (game.camera?.viewWidth ?? 0) > WEIT_M;
    for (const [id, e] of boote) {
      // Flaggen gleiten auf ihren Platz, Eingeholte nach unten und weg
      let platz = 0;
      const gap = e.mass.fh * 0.18;
      for (let i = e.flaggen.length - 1; i >= 0; i--) {
        const f = e.flaggen[i];
        f.k += ((f.weg ? 0 : 1) - f.k) * k;
        if (f.weg && f.k < 0.03) {
          f.mesh.removeFromParent();
          e.flaggen.splice(i, 1);
        }
      }
      for (const f of e.flaggen) {
        const ziel = -(gap + platz * (e.mass.fh + gap));
        if (!f.weg) platz++;
        // eingeholte rutschen die Leine hinunter und werden dabei kleiner
        const zielY = f.weg ? ziel - (1 - f.k) * e.mass.fh * 3 : ziel - (1 - f.k) * e.mass.fh * 2;
        f.y += (zielY - f.y) * k;
        f.mesh.position.y = f.y;
        const sc = e.mass.fw * (0.35 + 0.65 * f.k);
        f.mesh.scale.set(sc, sc, 1);
        f.mesh.rotation.x = Math.sin(t * 5.3 + id * 1.3 + f.y * 3) * 0.12;
      }
      const sichtbar = e.flaggen.length > 0 && !weitWeg;
      e.g.visible = sichtbar;
      if (!sichtbar) continue;
      const tiefe = gap + Math.max(1, e.flaggen.length) * (e.mass.fh + gap);
      e.leine.visible = true;
      e.leine.scale.set(0.6, tiefe, 0.6);
      e.leine.position.y = -tiefe / 2;
      // Windrichtung im Bootsraum: die Flagge zeigt vom Wind weg
      e.model.getWorldQuaternion(_q);
      _e.setFromQuaternion(_q, 'YXZ');
      const rel = von - _e.y + Math.PI;
      e.traeger.rotation.y = rel + Math.sin(t * (2.4 + w.strength * 3) + id) * (0.12 + w.strength * 0.25);
    }
  });

  game.signalflaggen = {
    // Buchstaben, die gerade gesetzt sind (ohne eingeholte)
    flaggen: (id) => (boote.get(id)?.flaggen ?? []).filter((f) => !f.weg && f.k > 0.5).map((f) => f.b),
    soll: (id) => { nachfrage = null; last = null; return soll(id, game.boatView?.boot?.(id) ?? null); },
    lichter: (id) => !!boote.get(id)?.lichter?.visible,
    anzahl: () => [...boote.values()].reduce((n, e) => n + e.flaggen.filter((f) => !f.weg).length, 0),
    masse: (id) => { const a = game.boatView?.boot?.(id); return a?.model ? { ...vermessen(a) } : null; },
  };
}

export default init;
