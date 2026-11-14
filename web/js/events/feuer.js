// Mittsommerfeuer (P24, Ereignis Mittsommer, Abendeffekt 'mittsommerfeuer'): Steht ein Grillplatz, brennt
// am Mittsommerabend daneben ein großes Feuer mit warmem Licht und aufsteigender Glut. Ohne Grillplatz
// gibt es kein Feuer; die Ankündigung nennt den Grillplatz als Tipp (events/vorbereiten.js, Bauten G7).
// Wird von events/events.js gestartet, kein eigener Eintrag in MODULES.

const GLUT = 18;

export function initFeuer(game) {
  const THREE = game.THREE;
  const scene = game.scene;
  if (!THREE || !scene) return;

  let feuer = null;          // { group, flammen, licht, glut }
  let an = false;
  let ruhig = game.einstellungen ? !!game.einstellungen.wert('ruhig') : false;
  game.on?.('einstellungen', ({ alle } = {}) => { if (alle) ruhig = !!alle.ruhig; });

  function baue() {
    const group = new THREE.Group();
    group.name = 'mittsommerfeuer';
    const holz = new THREE.MeshLambertMaterial({ color: 0x6b4026 });
    for (let i = 0; i < 4; i++) {
      const scheit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.28), holz);
      scheit.rotation.y = (i * Math.PI) / 4;
      scheit.position.y = 0.15 + i * 0.05;
      group.add(scheit);
    }
    // Flammen: drei Kegel, außen rot, innen gelb (unbeleuchtet, damit sie leuchten)
    const flammen = [];
    const farben = [0xe0562a, 0xf0a03a, 0xffd95a];
    farben.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.9 - i * 0.25, 2.4 - i * 0.5, 6),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: [0.62, 0.85, 0.95][i], depthWrite: false }),
      );
      m.position.y = 1.2 - i * 0.15;
      m.userData.phase = i * 1.7;
      group.add(m);
      flammen.push(m);
    });
    // Steinkreis und warmer Schein auf dem Boden (von oben gut zu sehen)
    const stein = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
    for (let i = 0; i < 9; i++) {
      const w = (i / 9) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), stein);
      st.position.set(Math.cos(w) * 1.5, 0.15, Math.sin(w) * 1.5);
      st.rotation.y = w;
      group.add(st);
    }
    const schein = new THREE.Mesh(
      new THREE.CircleGeometry(5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    schein.rotation.x = -Math.PI / 2;
    schein.position.y = 0.06;
    group.add(schein);
    const licht = new THREE.PointLight(0xffa04a, 0, 28, 1.6);
    licht.position.y = 1.6;
    group.add(licht);
    // Glut: kleine Würfel, die aufsteigen und verglühen
    const glut = [];
    const glutMat = new THREE.MeshBasicMaterial({ color: 0xffc04a });
    for (let i = 0; i < GLUT; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), glutMat);
      g.userData = { t: Math.random() * 3, x: 0, z: 0 };
      group.add(g);
      glut.push(g);
    }
    group.traverse((o) => { o.raycast = () => {}; });
    group.visible = false;
    scene.add(group);
    return { group, flammen, licht, glut, schein };
  }

  // Stelle neben dem Grillplatz (render/services.js stellt ihn als 'service-grillplatz' auf)
  function stelle() {
    const grill = game.services?.gruppe?.getObjectByName?.('service-grillplatz');
    if (!grill) return null;
    const p = new THREE.Vector3();
    grill.getWorldPosition(p);
    const x = p.x + 5, z = p.z - 4;
    const y = game.landschaft?.hoeheBei?.(x, z);
    return { x, y: Number.isFinite(y) ? Math.max(y, p.y) : p.y, z };
  }

  function pruefe() {
    const ev = game.events?.current?.event;
    const soll = !!ev && ev.evening === 'mittsommerfeuer' && game.events.phase === 'abend';
    const ort = soll ? stelle() : null;
    an = !!ort;
    if (!an) { if (feuer) feuer.group.visible = false; return; }
    feuer ??= baue();
    feuer.group.position.set(ort.x, ort.y, ort.z);
    feuer.group.visible = true;
  }
  game.on('event:phase', pruefe);
  game.on('event:start', pruefe);
  game.on('event:end', pruefe);
  game.on('services:gebaut', pruefe);

  let t = 0;
  game.onTick((dt) => {
    if (!an || !feuer) return;
    t += Math.min(0.1, dt || 0.016);
    const ruhe = ruhig ? 0.3 : 1;
    feuer.flammen.forEach((m, i) => {
      const k = 1 + Math.sin(t * (7 + i * 2) + m.userData.phase) * 0.12 * ruhe + Math.sin(t * 13.1 + i) * 0.06 * ruhe;
      m.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      m.rotation.y = t * (0.6 + i * 0.3);
    });
    feuer.licht.intensity = 2.4 + Math.sin(t * 9) * 0.4 * ruhe + Math.sin(t * 23) * 0.2 * ruhe;
    feuer.schein.material.opacity = 0.28 + Math.sin(t * 7) * 0.05 * ruhe;
    for (const g of feuer.glut) {
      const u = g.userData;
      u.t += (dt || 0.016) * (ruhig ? 0.4 : 1);
      if (u.t > 3) { u.t = 0; u.x = (Math.random() - 0.5) * 1.2; u.z = (Math.random() - 0.5) * 1.2; }
      g.position.set(u.x + Math.sin(u.t * 2 + u.x * 5) * 0.3, 1.2 + u.t * 2.2, u.z);
      const s = Math.max(0.01, 1 - u.t / 3);
      g.scale.setScalar(s);
    }
  });

  game.mittsommerfeuer = { get an() { return an; }, pruefe };
}
