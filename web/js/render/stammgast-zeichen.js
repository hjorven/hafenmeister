// Stammgäste sichtbar machen (P25, docs/stammgaeste.md):
//
// 1. Treuewimpel (H7): Ein Stammgast trägt am Heck einen kleinen Flaggenstock mit einem dunkelblauen
//    Doppelstander je fünf Besuchen (features/stammgaeste.js treuewimpel). Er weht, solange das Boot
//    im Bild ist: beim Anfahren, an der Boje, in der Box und beim Ablegen. Dauerlieger tragen keinen.
// 2. Lieblingsplatz (H6): Ist ein wartender Stammgast gewählt und seine alte Box frei, steht dort ein
//    Stander auf einem Stock, wie die Raute des Büro-Vorschlags, nur dunkelblau. Wer ihn dorthin legt,
//    bekommt Anker extra (Platzwert beim Einrasten zeigt „Lieblingsplatz“).
//
// Liest nur: game.sim (state, selected), game.stammgaeste, game.boatView.boot(id).model, game.stege.platz(id).
// Schreibt nichts in den Spielstand. Schnittstelle: game.stammgastZeichen = { wimpel(id), lieblingsplatz }.
import * as THREE from 'three';

const NAVY = '#23395d';
const RAND = '#f4f1e8';

export function init(game) {
  if (!game.scene) return;

  // ---------------------------------------------------------------- Teile
  // Doppelstander: Rechteck mit Schwalbenschwanz, weht nach achtern (-x)
  function standerForm(l, b) {
    const f = new THREE.Shape();
    f.moveTo(0, b / 2);
    f.lineTo(-l, b / 2);
    f.lineTo(-l * 0.72, 0);
    f.lineTo(-l, -b / 2);
    f.lineTo(0, -b / 2);
    f.lineTo(0, b / 2);
    return new THREE.ShapeGeometry(f);
  }
  const tuchMat = new THREE.MeshLambertMaterial({ color: '#2b4a7e', side: THREE.DoubleSide, emissive: '#2b4a7e', emissiveIntensity: 0.6 });
  const randMat = new THREE.MeshBasicMaterial({ color: RAND, side: THREE.DoubleSide });
  const stockMat = new THREE.MeshLambertMaterial({ color: '#d9dde2' });

  // Höhe des Hecks: höchster Punkt im hinteren Zehntel (ohne Mast)
  const _v = new THREE.Vector3();
  function heckHoehe(group, L, B) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    let y = 0;
    group.traverse((o) => {
      const pos = o.geometry?.attributes?.position;
      if (!pos || !o.isMesh || o.userData?.stammWimpel) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, pos.count >> 9)) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (_v.x < -L * 0.36 && _v.x > -L * 0.5 && Math.abs(_v.z) < B * 0.45 && _v.y < 3) y = Math.max(y, _v.y);
      }
    });
    return y || 0.6;
  }

  function wimpelBauen(anim, anzahl) {
    const L = anim.info?.length ?? 6;
    const B = anim.info?.beam ?? 2;
    const g = new THREE.Group();
    g.name = 'treuewimpel';
    g.userData.stammWimpel = true;
    const lang = Math.max(1.1, Math.min(2.6, L * 0.2));
    const breit = lang * 0.42;
    const stab = 0.9 + anzahl * breit * 1.15;
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, stab, 5), stockMat);
    stock.position.y = stab / 2;
    stock.userData.stammWimpel = true;
    g.add(stock);
    g.userData.tuecher = [];
    for (let i = 0; i < anzahl; i++) {
      const t = new THREE.Mesh(standerForm(lang, breit), tuchMat);
      const r = new THREE.Mesh(standerForm(lang * 1.08, breit * 1.25).translate(lang * 0.04, 0, -0.01), randMat);
      t.add(r);
      t.position.y = stab - breit * 0.55 - i * breit * 1.15;
      t.userData.stammWimpel = true;
      r.userData.stammWimpel = true;
      g.add(t);
      g.userData.tuecher.push(t);
    }
    g.position.set(-L * 0.44, heckHoehe(anim.model, L, B), 0);
    g.userData.anzahl = anzahl;
    anim.model.add(g);
    return g;
  }

  // ---------------------------------------------------------------- Treuewimpel an Booten
  const wimpel = new Map();     // bootId -> { g, anzahl, model }
  const zahl = new Map();       // bootId -> Wimpelzahl (bleibt nach der Abrechnung, bis das Boot weg ist)
  let pruefT = 1;
  game.on?.('sim:change', () => { pruefT = 1; });

  function sollZahl(id) {
    const b = game.sim?.state?.boats?.[id];
    if (b) {
      const n = b.stationed || b.dauer ? 0 : game.stammgaeste?.treuewimpel?.(b) ?? 0;
      zahl.set(id, n);
      return n;
    }
    return zahl.get(id) ?? 0;
  }

  function weg(id) {
    const w = wimpel.get(id);
    if (!w) return;
    w.g.removeFromParent();
    w.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    wimpel.delete(id);
  }

  game.onTick?.((dt) => {
    pruefT += dt;
    const t = game.time ?? 0;
    if (pruefT > 0.5) {
      pruefT = 0;
      const da = new Set();
      for (const { id, anim } of game.boatView?.boote ?? []) {
        da.add(id);
        const n = sollZahl(id);
        const w = wimpel.get(id);
        if (w && (w.anzahl !== n || w.model !== anim.model || !anim.model?.parent)) weg(id);
        if (n > 0 && !wimpel.has(id) && anim.model) wimpel.set(id, { g: wimpelBauen(anim, n), anzahl: n, model: anim.model });
      }
      for (const id of [...wimpel.keys()]) if (!da.has(id)) weg(id);
      for (const id of [...zahl.keys()]) if (!da.has(id)) zahl.delete(id);
    }
    // im Wind flattern
    for (const [id, w] of wimpel) {
      w.g.userData.tuecher.forEach((m, i) => {
        // halb geneigt, damit man ihn auch von oben sieht (wie das Bezahlt-Band am Bug)
        m.rotation.y = Math.sin(t * 4.2 + id * 1.7 + i) * 0.3;
        m.rotation.x = -0.9 + Math.sin(t * 6.1 + id + i * 2) * 0.12;
      });
    }
  });

  // ---------------------------------------------------------------- Lieblingsplatz
  let marke = null;
  let markeOrt = null;
  function markeBauen() {
    const g = new THREE.Group();
    g.name = 'lieblingsplatz';
    const ohneTiefe = (m) => { m.depthTest = false; m.transparent = true; return m; };
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), ohneTiefe(new THREE.MeshBasicMaterial({ color: RAND })));
    stock.position.y = 0.8;
    const tuch = new THREE.Mesh(standerForm(1.3, 0.8).translate(0.65, 0, 0), ohneTiefe(new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.DoubleSide })));
    const rand = new THREE.Mesh(standerForm(1.45, 1.0).translate(0.72, 0, -0.01), ohneTiefe(new THREE.MeshBasicMaterial({ color: RAND, side: THREE.DoubleSide })));
    tuch.position.set(-0.65, 1.25, 0);
    rand.position.set(-0.65, 1.25, 0);
    for (const m of [stock, tuch, rand]) m.renderOrder = 12;
    g.add(stock, rand, tuch);
    g.visible = false;
    game.scene.add(g);
    return g;
  }

  function lieblingsplatzJetzt() {
    const sim = game.sim;
    const b = sim?.state?.boats?.[sim?.selected];
    if (!b || b.status !== 'waiting' || !b.stammId || b.lieblingsplatz == null) return null;
    const h = (game.stammgaeste?.hinweise?.(b) ?? []).find((x) => x.art === 'platz');
    return h?.frei ? h.platz : null;
  }

  let platzT = 1;
  game.on?.('sim:select', () => { platzT = 1; });
  game.onTick?.((dt) => {
    platzT += dt;
    if (platzT > 0.3) {
      platzT = 0;
      const id = lieblingsplatzJetzt();
      const w = id ? game.stege?.platz?.(id) : null;
      if (w) {
        marke ||= markeBauen();
        markeOrt = { id, x: w.x, z: w.z };
        marke.visible = true;
      } else if (marke) { marke.visible = false; markeOrt = null; }
    }
    if (marke?.visible && markeOrt) {
      const blick = game.camera?.camera ?? null;
      const tt = game.time ?? 0;
      // neben der Raute des Büro-Vorschlags, falls die auf derselben Box steht
      const rechts = blick ? new THREE.Vector3().setFromMatrixColumn(blick.matrixWorld, 0).setY(0).normalize() : new THREE.Vector3(1, 0, 0);
      marke.position.set(markeOrt.x + rechts.x * 1.1, 0.4 + Math.sin(tt * 2.3) * 0.12, markeOrt.z + rechts.z * 1.1);
      if (blick) marke.rotation.y = Math.atan2(blick.position.x - marke.position.x, blick.position.z - marke.position.z);
      const weit = blick ? blick.position.distanceTo(marke.position) : 60;
      marke.scale.setScalar(Math.min(6, Math.max(1, weit * 0.022)));
    }
  });

  game.stammgastZeichen = {
    wimpel: (id) => wimpel.get(id)?.anzahl ?? 0,
    get lieblingsplatz() { return marke?.visible ? markeOrt?.id ?? null : null; },
  };
}
