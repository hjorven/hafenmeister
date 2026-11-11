// Platzhalter-Landschaft fuer das Grundgeruest: Festland, Binnensee, Nehrung, Ostsee als flache Baender,
// dazu ein einfacher Steg in 3D. Wird vom Landschafts-Thread ersetzt.
// Masse grob nach skripte/konzeptbilder/hafen_von_oben.py (eine Planeinheit = 0,62 m, Norden ist -z).
import * as THREE from 'three';

const U = 0.62;   // Meter je Planeinheit

export function addPlaceholderWorld(game, size) {
  const { scene } = game;
  const group = new THREE.Group();
  group.name = 'placeholder';

  const band = (z0, z1, color, y = 0) => {
    const geo = new THREE.PlaneGeometry(size.width, Math.abs(z1 - z0));
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.position.set(size.centerX, y, (z0 + z1) / 2);
    group.add(m);
  };
  // Plan-y (Norden) -> Welt-z = -y * U
  band(0, 200, '#b8dca8', 0.3);                 // Festland
  band(-186 * U, 0, '#9ccfc0');                  // Binnensee
  band(-224 * U, -186 * U, '#f7e4b6', 0.3);      // Nehrung
  band(-352 * U, -224 * U, '#62b4c2');           // Ostsee

  // Steg A aus Stufe 1, als Holzsteg auf Pfaehlen
  const wood = new THREE.MeshLambertMaterial({ color: '#e2b67e' });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 18), wood);
  deck.position.set(-60 * U, 0.6, -9);
  deck.userData.pick = { type: 'jetty', id: 'A' };
  group.add(deck);
  const pile = new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6);
  const pileMat = new THREE.MeshLambertMaterial({ color: '#5c5460' });
  for (let i = 0; i < 6; i++) {
    for (const side of [-0.9, 0.9]) {
      const p = new THREE.Mesh(pile, pileMat);
      p.position.set(-60 * U + side, 0.3, -1 - i * 3.3);
      group.add(p);
    }
  }

  // Ein Boot als Wuerfel-Platzhalter, das langsam vor dem Steg kreuzt
  const boat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 4), new THREE.MeshLambertMaterial({ color: '#fffcf6' }));
  boat.position.set(-60 * U + 8, 0.4, -14);
  boat.userData.pick = { type: 'boat', id: 'platzhalter' };
  group.add(boat);
  game.onTick((dt) => {
    boat.position.x = -60 * U + 8 + Math.sin(game.time * 0.3) * 6;
    boat.rotation.y = Math.cos(game.time * 0.3) > 0 ? 0.15 : -0.15;
  });

  scene.add(new THREE.HemisphereLight('#ffffff', '#88aabb', 1.6));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.4);
  sun.position.set(-80, 120, 60);
  scene.add(sun);
  scene.add(group);
  return group;
}
