// Wetter an der Flagge: Ein Flaggenmast mit Windsack am Ufer zeigt das Wetter, ohne Text.
// Beschreibung in docs/neue-features.md, Abschnitt 5.
//
// - Der Windsack steht so steif, wie der Wind heute weht (game.events.weather), und flattert.
// - Ist für morgen ein Sturm angesagt, wehen zwei rote Sturmwimpel am Mast (wie das alte Sturmsignal).
//   Ist eine Regatta angesagt oder läuft sie, hängt eine bunte Signalflaggen-Leine vom Mast.
// - Antippen des Masts öffnet den Wetterbericht (Knopf #weather-chip aus events/banner.js).
//
// Braucht game.events (events/events.js). Ohne Ereignis-Modul erscheint kein Mast (kein totes Element).

const WIND_FARBE = '#f08a24';
const WEISS = '#f6f3ec';
const SIGNAL = ['#d9443b', '#f2c14e', '#2f6db5', '#f6f3ec', '#3f8f55', '#283648'];

export function zeichen(forecast) {
  // forecast: [heute, morgen, ...] aus game.events.forecast(), Einträge { day, event: { id } | null, weather: { wind } }
  const heute = forecast?.[0] ?? null;
  const morgen = forecast?.[1] ?? null;
  const id = (w) => w?.event?.id ?? w?.event ?? null;
  return {
    wind: Math.max(0, Math.min(1, heute?.weather?.wind ?? heute?.wind ?? 0.2)),
    sturmMorgen: id(morgen) === 'sturm',
    regatta: id(heute) === 'regatta' || id(morgen) === 'regatta',
  };
}

export async function init(game) {
  // Auf das Ereignis-Modul warten (es hängt sich beim Laden an game.events)
  const start = Date.now();
  while (!game.events?.forecast && Date.now() - start < 30000) await new Promise((r) => setTimeout(r, 100));
  if (!game.events?.forecast) return;
  const THREE = game.THREE;
  const { HAFEN, platzInWelt } = await import('../data/harbor.js');

  const mast = new THREE.Group();
  mast.name = 'wetterflagge';
  mast.userData.pick = { type: 'building', id: 'wetterflagge' };
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });

  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), mat(WEISS));
  stange.position.y = 3.5;
  const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat('#e9c46a'));
  knauf.position.y = 7.1;
  const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 10), mat('#c9c2b4'));
  fuss.position.y = 0.15;
  mast.add(stange, knauf, fuss);

  // Windsack: Kegel mit Ringen, hängt am Gelenk und wird mit dem Wind waagerecht
  const gelenk = new THREE.Group();
  gelenk.position.set(0, 6.6, 0);
  const sack = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r0 = 0.42 - i * 0.07;
    const teil = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.07, r0, 0.55, 12, 1, true), mat(i % 2 ? WEISS : WIND_FARBE));
    teil.rotation.z = Math.PI / 2;
    teil.position.x = 0.3 + i * 0.55;
    sack.add(teil);
  }
  gelenk.add(sack);
  mast.add(gelenk);

  // Sturmwimpel: zwei rote Dreiecke übereinander
  const wimpel = new THREE.Group();
  const dreieck = new THREE.Shape();
  dreieck.moveTo(0, 0.35); dreieck.lineTo(1.2, 0); dreieck.lineTo(0, -0.35); dreieck.lineTo(0, 0.35);
  for (const y of [5.6, 4.7]) {
    const w = new THREE.Mesh(new THREE.ShapeGeometry(dreieck), mat('#d9443b'));
    w.position.set(-0.1, y, 0);
    w.rotation.y = Math.PI;
    wimpel.add(w);
  }
  mast.add(wimpel);

  // Signalflaggen-Leine: vom Knauf schräg zum Boden
  const leine = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), mat(SIGNAL[i % SIGNAL.length]));
    f.position.set(-0.4 - t * 5.5, 6.9 - t * 6.0, 0);
    f.rotation.z = -0.83;
    leine.add(f);
  }
  mast.add(leine);
  game.scene.add(mast);

  // Lage: am Ufer neben der Wurzel von Steg A, in jeder Stufe neu
  function lage() {
    const stufe = game.state?.stage ?? 1;
    const a = HAFEN.plaetze.filter((p) => p.steg === 'A').map((p) => platzInWelt(p, stufe)).filter(Boolean);
    if (!a.length) { mast.visible = false; return; }
    const ufer = a.reduce((best, p) => (p.z > best.z ? p : best));
    mast.position.set(ufer.x - 6, 0, ufer.z + 2);
    mast.visible = true;
  }

  let stand = zeichen(null);
  function aktualisiere() {
    stand = zeichen(game.events.forecast(2));
    wimpel.visible = stand.sturmMorgen;
    leine.visible = stand.regatta;
  }

  let t = 0;
  game.onTick((dt) => {
    t += dt || 0.016;
    // Windsack: bei Flaute hängt er (fast senkrecht), bei Sturm steht er waagerecht und zittert
    const w = stand.wind;
    const winkel = -Math.PI / 2 + w * (Math.PI / 2) * 0.95;
    gelenk.rotation.z = winkel + Math.sin(t * (2 + w * 8)) * (0.03 + w * 0.08);
    gelenk.rotation.y = 0.4 + Math.sin(t * 0.3) * 0.15;
    sack.children.forEach((teil, i) => { teil.rotation.x = Math.sin(t * (3 + w * 10) + i) * 0.08 * w; });
    wimpel.children.forEach((f, i) => { f.rotation.x = Math.sin(t * 6 + i) * 0.3 * (0.3 + w); });
  });

  for (const n of ['weather', 'event:announce', 'event:start', 'event:end', 'event:loaded', 'day:start']) game.on(n, aktualisiere);
  game.on('stufe', lage);
  game.on('spielstand-geladen', () => { lage(); aktualisiere(); });

  // Antippen des Masts öffnet den Wetterbericht
  game.on('tap', ({ pick } = {}) => {
    if (pick?.type === 'building' && pick.id === 'wetterflagge') document.getElementById('weather-chip')?.click();
  });

  lage();
  aktualisiere();
  game.wetterflagge = { mast, zeichen: () => ({ ...stand }) };
}
