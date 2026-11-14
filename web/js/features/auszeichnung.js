// Auszeichnung des Hafens (Roadmap P19 C5, docs/ruf.md): Ein guter Ruf über mehrere Abende bringt
// eine Auszeichnung mit Namen ("Gastlicher Hafen", "Empfohlener Hafen", "Ausgezeichneter Hafen").
//
// - Die Spielregeln (sim.js updateAward) zählen abends die Abende in Folge, an denen der Ruf die
//   nächste Stufe erreicht (ECONOMY.ruf.auszeichnung), und melden 'sim:awardUp' / 'sim:awardDown'.
// - Am Flaggenmast des Hafenmeisterhauses (und des Hafenbüros) weht darunter ein Wimpel in der Farbe
//   der Stufe, mit so vielen Streifen wie die Stufe hoch ist.
// - Nach dem Tagesabschluss sagt eine kleine Karte, dass die Auszeichnung neu ist (oder verloren ging).
// - Das Gästebuch zeigt Name und was zur nächsten Stufe fehlt (game.auszeichnung.text()).
//
// Schnittstelle: game.auszeichnung = { stand(), text(), zeigen(e) }. Schreibt nichts in den Spielstand
// (der Stand liegt in state.award und gehört den Spielregeln).
import { regelnBereit } from './regeln-bereit.js';
import { VORRANG } from '../ui/meldungen.js';

export const FARBEN = ['#8a9aa8', '#3f8f55', '#2f6db5', '#e0a526'];   // keine, 1, 2, 3
const WIMPEL = ['#.........', '####......', '#######...', '##########', '#######...', '####......', '#.........', '#.........', '#.........', '#.........'];

const komma = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const abende = (n) => (n === 1 ? 'einen Abend' : `${n} Abende`);

/** Satz für das Gästebuch: wie der Hafen ausgezeichnet ist und was zur nächsten Stufe fehlt. */
export function text(a) {
  if (!a) return '';
  const teile = [];
  if (a.level) teile.push(`Auszeichnung: „${a.name}“, der Wimpel weht am Hafenmeisterhaus.`);
  else teile.push('Noch keine Auszeichnung.');
  if (a.next) {
    const fehlt = Math.max(1, a.days - a.up);
    teile.push(a.up > 0
      ? `Noch ${abende(fehlt)} mit Ruf ab ${komma(a.next.from)}, dann heißt der Hafen „${a.next.name}“.`
      : `${abende(a.days).replace(/^e/, 'E')} in Folge mit Ruf ab ${komma(a.next.from)}, dann heißt der Hafen „${a.next.name}“.`);
  } else if (a.level) {
    teile.push('Höher geht es nicht.');
  }
  if (a.level && a.hold != null) teile.push(`Fällt der Ruf ${abende(a.days)} in Folge unter ${komma(a.hold)}, geht sie eine Stufe zurück.`);
  return teile.join(' ');
}

/** Titel und Satz der Karte nach dem Tagesabschluss. */
export function karte(e, days = 3) {
  if (e.type === 'awardUp') {
    return {
      titel: e.name,
      satz: `Der Ruf lag ${abende(days)} in Folge über der Marke. ${e.first ? 'Ein neuer Wimpel weht' : 'Der Wimpel weht wieder'} am Hafenmeisterhaus.`,
    };
  }
  return {
    titel: e.name ? `Nur noch „${e.name}“` : 'Auszeichnung verloren',
    satz: `Der Ruf lag ${abende(days)} in Folge zu niedrig, „${e.lost}“ ist erst einmal weg. Gute Plätze und erfüllte Wünsche holen sie zurück.`,
  };
}

const CSS = `
#hm-auszeichnung { position: absolute; z-index: 30; left: 50%; top: calc(var(--hm-oben, 12px) + var(--hm-knopf, 48px) + 16px); transform: translateX(-50%);
  display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; width: min(360px, calc(100vw - 32px)); padding: 12px 14px;
  font-family: var(--hm-pixel); pointer-events: auto; animation: hm-az-rein .4s steps(4) both; }
#hm-auszeichnung[hidden], body.foto #hm-auszeichnung { display: none !important; }
#hm-auszeichnung .hm-az-wimpel { grid-row: 1 / 3; width: 40px; height: 40px; image-rendering: pixelated; }
#hm-auszeichnung h3 { margin: 0; font-size: 17px; }
#hm-auszeichnung p { margin: 0; font: 500 13px/1.35 var(--hm-text); }
#hm-auszeichnung button { grid-column: 1 / -1; justify-self: end; min-height: 40px; }
@keyframes hm-az-rein { from { transform: translate(-50%, -12px); opacity: 0; } to { transform: translateX(-50%); opacity: 1; } }
/* Steht die Karte, ruht "Als Nächstes" (ui/bauen.js) */
.hm-neu:has(#hm-auszeichnung:not([hidden])) .bau-tipp { display: none; }
.hm-gb-auszeichnung { display: flex; gap: 8px; align-items: flex-start; }
.hm-gb-auszeichnung .hm-az-wimpel { flex: none; width: 20px; height: 20px; image-rendering: pixelated; }
`;

export function wimpelSvg(level) {
  const farbe = FARBEN[Math.max(0, Math.min(3, level))];
  let r = '';
  WIMPEL.forEach((z, y) => [...z].forEach((c, x) => {
    if (c !== '#') return;
    const stange = x === 0;
    // Streifen im Wimpel: so viele helle Spalten wie die Stufe
    const streifen = !stange && level > 0 && [2, 4, 6].slice(0, level).includes(x) && y >= 2 && y <= 4;
    r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${stange ? '#24364a' : streifen ? '#fffbea' : farbe}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" shape-rendering="crispEdges">${r}</svg>`;
}

export async function init(game) {
  const api = await regelnBereit(game).catch(() => null);
  if (!api) return;
  const stand = () => game.sim?.auszeichnung?.() ?? null;

  // ------------------------------------------------------------ Wimpel am Flaggenmast
  const THREE = game.THREE;
  const wimpel = new Map();   // Gebäude-id -> Mesh
  function wimpelSetzen() {
    if (!THREE || !game.buildings?.items) return;
    const a = stand();
    const level = a?.level ?? 0;
    for (const id of ['hafenmeister', 'hafenbuero']) {
      const it = game.buildings.items.find((i) => i.id === id);
      let mast = null;
      it?.mesh?.traverse?.((o) => { if (!mast && o.userData?.flagge) mast = o; });   // Gruppe des Flaggenmasts
      let m = wimpel.get(id);
      if (m && m.parent !== mast) { m.parent?.remove(m); m = null; wimpel.delete(id); }
      if (!mast || !level) { if (m) m.visible = false; continue; }
      if (!m) {
        const form = new THREE.Shape();
        form.moveTo(0, 0); form.lineTo(1.6, -0.3); form.lineTo(0, -0.6); form.lineTo(0, 0);
        m = new THREE.Mesh(new THREE.ShapeGeometry(form), new THREE.MeshLambertMaterial({ color: FARBEN[level], side: THREE.DoubleSide }));
        m.name = 'auszeichnung-wimpel';
        const y = (mast.userData.flagge?.position?.y ?? 6) - 0.7;
        m.position.set(0.05, y, 0);
        mast.add(m);
        wimpel.set(id, m);
      }
      m.visible = true;
      m.material.color.set(FARBEN[level]);
    }
  }
  game.onTick?.(() => {
    const t = performance.now() / 1000;
    for (const m of wimpel.values()) if (m.visible) m.rotation.y = Math.sin(t * 2.1) * 0.25;
  });
  for (const ev of ['build', 'stufe', 'region', 'ready', 'sim:awardUp', 'sim:awardDown', 'spielstand-geladen']) game.on(ev, () => setTimeout(wimpelSetzen, 0));
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') setTimeout(wimpelSetzen, 0); });
  setTimeout(wimpelSetzen, 500);

  // ------------------------------------------------------------ Karte nach dem Tagesabschluss
  let warte = null;
  let node = null;
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.id = 'hm-auszeichnung-stil';
    style.textContent = CSS;
    document.head.append(style);
  }
  function schliessen() {
    if (zu) { clearTimeout(zu); zu = null; }
    if (node) { node.remove(); node = null; }
    game.meldungen?.fertig?.('auszeichnung');
  }
  function zeigen(e) {
    if (typeof document === 'undefined' || !e) return;
    schliessen();
    game.meldungen?.wunsch?.('auszeichnung', VORRANG.auszeichnung ?? 60);
    const k = karte(e, stand()?.days ?? 3);
    node = document.createElement('div');
    node.id = 'hm-auszeichnung';
    node.className = 'hm-px';
    node.setAttribute('role', 'status');
    const bild = document.createElement('img');
    bild.className = 'hm-az-wimpel';
    bild.alt = '';
    bild.src = `data:image/svg+xml,${encodeURIComponent(wimpelSvg(e.level))}`;
    const h = document.createElement('h3');
    h.textContent = k.titel;
    const p = document.createElement('p');
    p.textContent = k.satz;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hm-knopf';
    b.textContent = 'Schön';
    b.onclick = schliessen;
    node.append(bild, h, p, b);
    (document.getElementById('game') || document.body).append(node);
    sichtbarMachen();
  }
  // Hochkant (schmal) unten über Zeit und Bauen, damit die linke Spalte frei bleibt; sonst oben mittig
  function platzieren() {
    if (!node || node.hidden) return;
    const host = node.parentElement?.getBoundingClientRect();
    const zeit = document.getElementById('hm-zeit')?.getBoundingClientRect();
    if (host && host.width < 600 && zeit && zeit.height > 0) {
      Object.assign(node.style, { top: 'auto', bottom: `${Math.round(host.bottom - zeit.top + 8)}px` });
    } else Object.assign(node.style, { top: '', bottom: '' });
  }
  // Steht eine wichtigere Meldung, wartet die Karte versteckt; ihre zwölf Sekunden laufen erst, wenn sie steht
  let zu = null;
  function sichtbarMachen() {
    if (!node) return;
    node.hidden = !(game.meldungen?.darf?.('auszeichnung') ?? true);
    platzieren();
    if (!node.hidden && !zu) zu = setTimeout(() => { zu = null; schliessen(); }, 12000);
  }
  game.on('sim:awardUp', (e) => { warte = e; game.meldungen?.wunsch?.('auszeichnung', VORRANG.auszeichnung ?? 60); });
  game.on('sim:awardDown', (e) => { warte = e; game.meldungen?.wunsch?.('auszeichnung', VORRANG.auszeichnung ?? 60); });
  // Erst wenn Tagesabschluss-Karte und Morgen-Zettel weg sind (oder es keinen Abschluss gibt)
  const nachAbschluss = () => {
    if (!warte) return;
    if (game.tagesabschluss?.beschaeftigt?.()) return;
    const e = warte;
    warte = null;
    zeigen(e);
  };
  game.on('tagesabschluss:fertig', nachAbschluss);
  game.on('day:start', () => setTimeout(nachAbschluss, 1500));
  game.on('meldungen:wechsel', sichtbarMachen);
  // Leiste, Drehen des Geräts, aufgeklappte Spalten: Lage nachführen, solange die Karte steht
  setInterval(() => { if (node) sichtbarMachen(); }, 300);

  game.auszeichnung = { stand, text: () => text(stand()), zeigen, wimpelSvg };
}
