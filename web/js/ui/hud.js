// HUD: zeigt die Zahlen der Spielregeln an und bietet die Aktionen als echte Knöpfe an.
// Die Boote warten draußen an Bojen (3D). #queue ist nur eine Übersicht der Wartenden,
// ein Knopf je Boot (data-boat, aria-pressed), damit Tastatur und Bildschirmleser alles erreichen.
// Daten kommen aus game.sim (web/js/bridge.js), siehe docs/spielregeln.md.

const WISH_LABEL = { wc: 'WC', dusche: 'Dusche', essen: 'Essen', strom: 'Strom', diesel: 'Diesel' };
// Warum das Hafenbüro ein Boot dem Spieler lässt (sim.officeSpecialCase)
const SONDERFALL_LABEL = {
  mehrrumpf: 'Mehrrumpfboot',
  gross: 'Großes Schiff',
  sondergast: 'Sondergast',
  einzigerPlatz: 'Nur eine Box passt',
};
const FACILITY_LABEL = { wc: 'Toilette', dusche: 'Dusche', essen: 'Kiosk', diesel: 'Tankstelle' };
const REASON_LABEL = {
  length: 'Das Boot ist zu lang für diesen Platz.',
  beam: 'Das Boot ist zu breit für diesen Platz.',
  draft: 'Hier ist das Wasser zu flach für dieses Boot.',
  size: 'Dieser Platz ist für andere Schiffsgrößen.',
  reserved: 'Dieser Platz ist fest vergeben.',
  occupied: 'Der Platz ist schon belegt.',
  noBerth: 'Diesen Platz gibt es noch nicht.',
  noFreeBerth: 'Gerade ist kein passender Platz frei.',
  money: 'Dafür reicht das Geld noch nicht.',
  stage: 'Das gibt es erst in einer späteren Ausbaustufe.',
  max: 'Schon voll ausgebaut.',
};

import { HAFEN, platzInWelt } from '../data/harbor.js';
import { pixelBild } from './pixel-symbole.js';

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const meters = (n) => `${num1(n)} m`;

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') e.addEventListener('click', v);
    else if (k === 'class') e.className = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

function fill(parent, ...children) {
  parent.replaceChildren(...children.flat().filter((c) => c != null && c !== false));
}

export function init(game) {
  const $ = (id) => document.getElementById(id);
  const money = $('money');
  const rep = $('rep');
  const day = $('day');
  const queue = $('queue');
  const card = $('card');
  const buildBtn = $('btn-build');
  if (!money || !queue || !card) return;

  // Kleine Ergänzung zu base.css: gesperrte Knöpfe sichtbar blasser, Kartenknöpfe umbrechen
  const style = document.createElement('style');
  style.textContent = `
    .hud-btn:disabled { opacity: 0.45; cursor: default; }
    #card .card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    #card .card-note { font-weight: 600; }
    #hud-goal { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); z-index: 5;
      max-width: min(520px, calc(100vw - 250px)); width: max-content; margin: 0; padding: 4px 12px; border-radius: 16px; font-size: 0.85rem; text-align: center;
      background: rgba(16, 42, 60, 0.82); color: #fff; pointer-events: none; }
    @media (max-width: 600px) { #hud-goal { bottom: calc(env(safe-area-inset-bottom, 0px) + 124px); max-width: calc(100vw - 32px); font-size: 0.8rem; } }
    #hud-goal.done { pointer-events: auto; cursor: pointer; background: rgba(32, 110, 62, 0.92); font-weight: 600; }
    #queue .boat-chip[aria-pressed="true"] { outline: 3px solid #f2c14e; }
    #card .hm-sonderfall { color: #8a4206; font-weight: 600; }
    #card .hm-vorschlag { color: #6b4e00; font-weight: 600; }
    #card .hm-sonderfall .hm-pixelbild, #card .hm-vorschlag .hm-pixelbild { vertical-align: -2px; margin-right: 6px; }
    .hm-flugtext { position: fixed; z-index: 6; pointer-events: none; transform: translate(-50%, -100%); white-space: nowrap;
      padding: 2px 8px; border: 2px solid #24364a; background: #fffcf6; color: #24364a; font: 600 14px var(--hm-pixel, sans-serif);
      animation: hm-flug 1.6s ease-out forwards; }
    .hm-flugtext.gold { background: #fde49a; }
    @keyframes hm-flug { 0% { opacity: 0; margin-top: 0; } 15% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; margin-top: -36px; } }
  `;
  document.head.append(style);

  // Knopf "Kassieren" erscheint neben "Bauen", solange Münzen offen sind, aber erst mit dem
  // Hafenmeister (Hafenbüro Stufe 1, rules.office.collectAllButton). Vorher streicht man die
  // Münzen einzeln ein (ui/gesten.js).
  const collectBtn = el('button', { type: 'button', class: 'hud-btn', id: 'btn-collect', hidden: true });
  buildBtn?.before(collectBtn);
  collectBtn.addEventListener('click', () => game.sim?.collectAll(false));

  // Knopf "Spielstand" (Sichern, Laden, Installieren) aus dem Speichermodul
  const saveBtn = el('button', { type: 'button', class: 'hud-btn', id: 'btn-save', 'aria-label': 'Spielstand sichern oder laden' }, 'Spielstand');
  document.getElementById('btn-pause')?.before(saveBtn);
  saveBtn.addEventListener('click', () => game.spielstand?.oeffnen?.());
  const updateSaveBtn = () => (saveBtn.hidden = !game.spielstand?.oeffnen);

  // Abschlussziel der letzten Ausbaustufe: kleine Zeile unter der oberen Leiste
  const goalLine = el('p', { id: 'hud-goal', role: 'status', hidden: true });
  document.body.append(goalLine);
  let doneShown = false;
  goalLine.addEventListener('click', () => { if (doneShown) { doneShown = false; goalLine.hidden = true; goalLine.classList.remove('done'); } });

  /** Text zum Abschlussziel, zum Beispiel "Großschiffbesuche 4/8 · Ruf 4,3 von 4,5 · noch 3 Plätze bauen". */
  function goalText(g) {
    const parts = [`Großschiffbesuche ${Math.min(g.visits, g.goal.bigVisits)}/${g.goal.bigVisits}`, `Ruf ${num1(g.reputation)} von ${num1(g.goal.reputation)}`];
    if (g.goal.allBerths) parts.push(g.openBerths > 0 ? `noch ${g.openBerths} ${g.openBerths === 1 ? 'Platz' : 'Plätze'} bauen` : 'alle Plätze gebaut');
    return parts.join(' · ');
  }

  function renderGoal(sim) {
    if (doneShown) return;
    const g = sim.regionGoal?.();
    const show = !!g?.active && !g.done && !g.ok;
    goalLine.hidden = !show;
    if (show) goalLine.textContent = `Ziel: ${goalText(g)}`;
  }

  let cardMode = null; // 'boat' | 'build' | null
  let note = '';
  let scheduled = false;

  function closeCard() {
    if (cardMode === 'boat') clearRings();
    document.body.classList.remove('card-boat');
    cardMode = null;
    note = '';
    card.hidden = true;
    fill(card);
    document.body.classList.remove('card-open');
  }

  function openCard(mode) {
    cardMode = mode;
    document.body.classList.toggle('card-boat', mode === 'boat');
    card.hidden = false;
    document.body.classList.add('card-open');
    render();
  }

  function renderStats(sim, st) {
    money.textContent = euro(st.money);
    // Der Stern davor steht für den Ruf (oberflaeche.css), die Zahl reicht
    rep.textContent = num1(sim.reputation());
    rep.title = `Ruf ${num1(sim.reputation())} von 5,0`;
    rep.setAttribute('aria-label', rep.title);
    const season = sim.season();
    const phase = season.winter ? ' · Winter' : st.phase === 'evening' ? ' · Abend' : '';
    day.textContent = `Tag ${st.day}${phase}`;
    const pending = sim.mooredBoats().reduce((a, b) => a + (b.pendingFee || 0), 0);
    const darfKnopf = st.office >= (sim.ctx?.rules?.office?.collectAllButton ?? 0);
    collectBtn.hidden = pending <= 0 || !darfKnopf;
    collectBtn.textContent = `Kassieren ${euro(pending)}`;
    renderGoal(sim);
  }

  function renderQueue(sim) {
    // Sobald die Boote im Wasser an den Bojen zu sehen sind (game.boatsVisible), entfällt die Leiste
    queue.hidden = !!game.boatsVisible;
    if (queue.hidden) return queue.replaceChildren();
    const waiting = sim.waitingBoats();
    const spots = sim.waitSpotCount();
    queue.setAttribute('aria-label', `Wartende Boote: ${waiting.length} von ${spots} Bojen belegt`);
    queue.replaceChildren(
      ...waiting.map((b) =>
        el(
          'button',
          {
            type: 'button',
            class: 'hud-btn boat-chip',
            'data-boat': String(b.id),
            'data-size': b.size,
            'aria-pressed': sim.selected === b.id ? 'true' : 'false',
            title: `${b.name}, ${meters(b.length)} lang`,
            onclick: () => {
              if (sim.selected === b.id) {
                sim.select(null);
                closeCard();
              } else {
                sim.select(b.id);
                openCard('boat');
              }
            },
          },
          `${b.size} ${b.name}${b.besuche > 1 ? ' · Stammgast' : ''}${sim.sonderfall?.(b.id) ? ' · für dich' : ''}`,
        ),
      ),
    );
  }

  function boatCard(sim, st) {
    const b = st.boats[sim.selected];
    if (!b || b.status !== 'waiting') {
      clearRings();
      return closeCard();
    }
    const fitting = sim.fittingBerths(b.id);
    const vorschlag = sim.vorschlag?.(b.id) ?? null;
    vorschlagZeigen(vorschlag);
    const schliessen = () => { sim.select(null); closeCard(); };
    // Kurz und auf einen Blick: Name, Eckdaten als Schilder, ein Satz, zwei Knöpfe.
    // "Einfahren" steht immer groß in der Karte, auf jedem Gerät an derselben Stelle.
    const nacht = `${b.nights} ${b.nights === 1 ? 'Nacht' : 'Nächte'}`;
    fill(card,
      el('div', { class: 'hm-karte-kopf' },
        el('div', {},
          el('h2', {}, b.name),
          // Name am Heck und Heimathafen (features/stammgaeste.js), falls vorhanden
          b.bootsname ? el('p', { class: 'card-boatname' }, game.stammgaeste?.beschreibung(b) ?? `„${b.bootsname}“`) : null),
        el('button', { type: 'button', class: 'hm-zu', 'aria-label': 'Schließen', title: 'Schließen', onclick: schliessen }, 'Schließen')),
      el('ul', { class: 'hm-fakten', 'aria-label': 'Eckdaten' },
        el('li', { class: 'groesse', title: 'Größenklasse' }, `Größe ${b.size}`),
        el('li', { title: 'Länge und Breite' }, `${meters(b.length)} × ${meters(b.beam)}`),
        el('li', { title: 'Tiefgang' }, `Tiefgang ${meters(b.draft)}`),
        el('li', { title: 'Aufenthalt' }, nacht),
        ...b.wishes.map((w) => el('li', { class: 'wunsch', title: 'Wunsch' }, `Wunsch: ${WISH_LABEL[w] ?? w}`))),
      sonderfallHinweis(sim.sonderfall?.(b.id), fitting.length, sim.bueroAutomatik?.(b.size)),
      vorschlag ? el('p', { class: 'card-hint hm-vorschlag' }, pixelBild('rauteGold', 14), vorschlagText(b, vorschlag)) : null,
      el('p', { class: 'card-hint' }, !fitting.length
        ? 'Gerade ist kein passender Platz frei.'
        : `${fitting.length} passende ${fitting.length === 1 ? 'Platz leuchtet' : 'Plätze leuchten'}. Zieh das Boot hin oder ${vorschlag ? 'nimm den Vorschlag an' : 'lass es einfahren'}.`),
      note ? el('p', { class: 'card-note', role: 'status' }, note) : null,
      el(
        'div',
        { class: 'card-actions' },
        vorschlag
          ? el('button', { type: 'button', class: 'hud-btn hm-primaer', 'aria-label': `Vorschlag annehmen: ${vorschlag}`, title: 'Das Boot fährt in die Box, die das Hafenbüro vorschlägt', onclick: () => sim.autoEnter(b.id) }, 'Vorschlag annehmen')
          : el('button', { type: 'button', class: 'hud-btn hm-primaer', 'aria-label': 'Automatisch einfahren', title: 'Das Boot nimmt die nächste passende Box, ohne auf Wünsche zu achten', disabled: !fitting.length, onclick: () => sim.autoEnter(b.id) }, 'Einfahren lassen'),
        el('button', { type: 'button', class: 'hud-btn hm-gefahr', onclick: () => { sim.dismiss(b.id); closeCard(); } }, 'Abweisen'),
      ),
    );
  }

  // Vorschlag des Hafenbüros (ab Bürostufe 3): beste Box, welche Wünsche sie erfüllt
  function vorschlagText(b, platzId) {
    const erfuellt = (sim0()?.platzWuensche?.(b.id, platzId) ?? []).map((w) => WISH_LABEL[w] ?? w);
    return `Vorschlag des Büros: Box ${platzId}${erfuellt.length ? ` mit ${erfuellt.join(' und ')}` : ''}. Sie ist mit einer goldenen Raute markiert.`;
  }
  const sim0 = () => game.sim;

  // Hafenbüro mit Automatik: Sonderfälle bleiben beim Spieler (plan.md Abschnitt 3)
  // Ab Bürostufe 3 (Vorschläge) gilt es schon: Für Sonderfälle schlägt das Büro nichts vor.
  function sonderfallHinweis(grund, frei, automatisch) {
    if (!grund) return null;
    const warum = grund === 'einzigerPlatz' ? 'Nur noch eine Box passt' : SONDERFALL_LABEL[grund] ?? 'Sonderfall';
    if (!automatisch) {
      return el('p', { class: 'card-hint hm-sonderfall' }, pixelBild('raute', 14), `${warum}: Dafür macht das Büro keinen Vorschlag, du entscheidest.`);
    }
    const sek = game.sim?.ctx?.rules?.office?.special?.selfEnterAfter;
    const sonst = frei && sek ? ` Sonst fährt es nach ${sek} s selbst ein.` : '';
    return el('p', { class: 'card-hint hm-sonderfall' }, pixelBild('raute', 14), `${warum}: Die Leitstelle lässt dir die Wahl.${sonst}`);
  }

  // Kurzer Text, der über einem Boot aufsteigt (Trinkgeld, Nebenkosten, Bonus fürs Einweisen)
  function flugtext(boatId, text, gold = false) {
    const a = game.boatView?.boot(boatId);
    const cam = game.camera;
    if (!a?.model || !cam?.camera || !game.THREE) return;
    const v = a.model.position.clone();
    v.y += 2;
    v.project(cam.camera);
    if (v.z > 1) return;
    const x = (v.x + 1) / 2 * (cam.screenW ?? innerWidth);
    const y = (1 - v.y) / 2 * (cam.screenH ?? innerHeight);
    // Mehrere Texte am selben Boot stapeln statt übereinander
    const n = flugAktiv.get(boatId) ?? 0;
    flugAktiv.set(boatId, n + 1);
    const t = el('div', { class: `hm-flugtext hm-px${gold ? ' gold' : ''}`, role: 'status' }, text);
    t.style.left = `${Math.round(x)}px`;
    t.style.top = `${Math.round(y - n * 30)}px`;
    document.body.append(t);
    setTimeout(() => {
      t.remove();
      const m = (flugAktiv.get(boatId) ?? 1) - 1;
      if (m > 0) flugAktiv.set(boatId, m); else flugAktiv.delete(boatId);
    }, 1700);
  }
  const flugAktiv = new Map();
  game.on('sim:collected', (e) => {
    if (e?.tip) flugtext(e.boatId, `Trinkgeld +${euro(e.tip)}`, true);
    if (e?.extras) flugtext(e.boatId, `Strom, Wasser, Duschen +${euro(e.extras)}`);
  });
  game.on('sim:moored', (e) => {
    const sim = game.sim;
    const b = sim?.state?.boats?.[e?.boatId];
    // Der Bonus fürs Einweisen zählt immer; gezeigt wird er, sobald das Büro es auch könnte
    if (b?.byHand && sim.state.office >= (sim.ctx.rules.office.propose ?? Infinity) && sim.ctx.rules.handAssignBonus) {
      setTimeout(() => flugtext(b.id, 'Selbst eingewiesen: +¼ Anker'), 600);
    }
  });

  function buildCard(sim, st) {
    const rows = [];
    const rules = sim.ctx.rules;
    for (const p of sim.openJettyProjects()) {
      rows.push(
        el(
          'button',
          { type: 'button', class: 'hud-btn', disabled: st.money < p.cost, onclick: () => act(sim.buildJettyProject(p.id)) },
          `${p.name} · ${euro(p.cost)}`,
        ),
      );
    }
    for (const key of Object.keys(rules.facilities)) {
      const u = sim.facilityUpgrade(key);
      if (!u || u.reason === 'max' || u.reason === 'stage') continue;
      const label = rules.facilities[key].names?.[u.level] ?? `${rules.facilityNames?.[key] ?? FACILITY_LABEL[key] ?? key} Stufe ${u.level}`;
      rows.push(
        el(
          'button',
          { type: 'button', class: 'hud-btn', disabled: !u.available, title: u.available ? '' : REASON_LABEL[u.reason], onclick: () => act(sim.upgradeFacility(key)) },
          `${label} · ${euro(u.cost)}`,
        ),
      );
    }
    const office = sim.ctx.rules.office;
    const next = st.office + 1;
    if (office.cost[next] && st.stage >= office.fromStage[next]) {
      rows.push(
        el(
          'button',
          { type: 'button', class: 'hud-btn', disabled: st.money < office.cost[next], onclick: () => act(sim.upgradeOffice()) },
          `${office.names?.[next] ?? `Hafenbüro Stufe ${next}`} · ${euro(office.cost[next])}`,
        ),
      );
    }
    const adv = sim.canAdvanceStage();
    let stageLine = null;
    if (adv.goal) {
      stageLine = el(
        'p',
        {},
        `Nächste Ausbaustufe: Gäste ${adv.guests}, nötig ${adv.goal.guests} · Ruf ${num1(adv.reputation)}, nötig ${num1(adv.goal.reputation)} · Kosten ${euro(adv.goal.cost)}`,
      );
      // Hinweis: Beim Umbau fallen Plätze weg, Gäste dort reisen ab, feste Boote ziehen um
      const umbau = sim.stageUpPreview?.();
      if (umbau && umbau.guests.length + umbau.fixed.length > 0) {
        const teile = [];
        if (umbau.guests.length) teile.push(`${umbau.guests.length} ${umbau.guests.length === 1 ? 'Gast reist' : 'Gäste reisen'} ab`);
        if (umbau.fixed.length) teile.push(`${umbau.fixed.length} ${umbau.fixed.length === 1 ? 'festes Boot zieht' : 'feste Boote ziehen'} um`);
        stageLine.append(el('br'), `Beim Umbau fallen ${umbau.gone.length} Plätze weg: ${teile.join(', ')}.`);
      }
      rows.push(
        el('button', { type: 'button', class: 'hud-btn', disabled: !adv.ok, onclick: () => act(sim.advanceStage()) }, `${adv.goal.name ?? 'Hafen erweitern'} · ${euro(adv.goal.cost)}`),
      );
    }
    const rg = sim.regionGoal?.();
    if (!stageLine && rg?.active) {
      stageLine = el('p', {}, rg.done || rg.ok ? 'Region abgeschlossen: Dein Seehafen ist fertig.' : `Abschlussziel: ${goalText(rg)}`);
    }
    fill(card,
      el('h2', {}, 'Bauen'),
      stageLine,
      note ? el('p', { class: 'card-note', role: 'status' }, note) : null,
      el('div', { class: 'card-actions' }, ...rows, el('button', { type: 'button', class: 'hud-btn', onclick: closeCard }, 'Schließen')),
    );
  }

  function act(result) {
    note = result?.ok ? '' : REASON_LABEL[result?.reason] ?? (result?.missing ? 'Ziel noch nicht erreicht.' : '');
    render();
  }

  function render() {
    scheduled = false;
    const sim = game.sim;
    const st = sim?.state;
    if (!st) return;
    // Bauen und Pause funktionieren, sobald die Regeln laufen
    if (buildBtn) buildBtn.hidden = false;
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.hidden = false;
    renderStats(sim, st);
    renderQueue(sim);
    rautenAbgleich(sim);
    if (cardMode === 'boat') boatCard(sim, st);
    else if (cardMode === 'build') buildCard(sim, st);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  // Orange Raute über wartenden Sonderfällen: Das Hafenbüro weist sie nicht zu, sie warten auf
  // den Spieler. Schwebt über dem Boot, folgt ihm (game.boatView), pulsiert leicht.
  // (Kein Wimpel: Den tragen bezahlte Boote am Bug.)
  const rauten = new Map(); // bootId -> Group
  let rautenTeile = null;
  function rauteBauen(gold = false) {
    const THREE = game.THREE;
    if (!rautenTeile) {
      const form = new THREE.Shape();
      form.moveTo(0, 0.62); form.lineTo(0.62, 0); form.lineTo(0, -0.62); form.lineTo(-0.62, 0); form.lineTo(0, 0.62);
      rautenTeile = {
        stock: new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6),
        punkt: new THREE.CircleGeometry(0.16, 12),
        tuch: new THREE.ShapeGeometry(form),
        stockMat: new THREE.MeshBasicMaterial({ color: '#f4f1e8', depthTest: false, transparent: true }),
        tuchMat: new THREE.MeshBasicMaterial({ color: '#f08a24', side: THREE.DoubleSide, depthTest: false, transparent: true }),
        randMat: new THREE.MeshBasicMaterial({ color: '#7a3a08', side: THREE.DoubleSide, depthTest: false, transparent: true }),
        goldMat: new THREE.MeshBasicMaterial({ color: '#f5c542', side: THREE.DoubleSide, depthTest: false, transparent: true }),
        goldRandMat: new THREE.MeshBasicMaterial({ color: '#8a6300', side: THREE.DoubleSide, depthTest: false, transparent: true }),
      };
    }
    const t = rautenTeile;
    const g = new THREE.Group();
    g.name = 'hafenbuero-raute';
    const stock = new THREE.Mesh(t.stock, t.stockMat);
    stock.position.y = 0.55;
    const raute = new THREE.Group();
    raute.position.y = 1.7;
    const rand = new THREE.Mesh(t.tuch, gold ? t.goldRandMat : t.randMat);
    rand.scale.setScalar(1.18);
    rand.position.z = -0.01;
    const tuch = new THREE.Mesh(t.tuch, gold ? t.goldMat : t.tuchMat);
    const punkt = new THREE.Mesh(t.punkt, t.stockMat);
    punkt.position.z = 0.01;
    for (const m of [stock, rand, tuch, punkt]) m.renderOrder = 12;
    raute.add(rand, tuch, punkt);
    g.add(stock, raute);
    g.userData.raute = raute;
    return g;
  }
  function rautenAbgleich(sim) {
    if (!game.THREE || !game.scene || !game.boatView) return;
    // Raute nur mit Leitstelle: vorher weist ohnehin niemand außer dem Spieler zu
    const soll = new Set(sim.waitingBoats().filter((b) => sim.sonderfall?.(b.id) && sim.bueroAutomatik?.(b.size)).map((b) => b.id));
    for (const [id, g] of rauten) if (!soll.has(id)) { g.parent?.remove(g); rauten.delete(id); }
    for (const id of soll) {
      if (rauten.has(id)) continue;
      const g = rauteBauen();
      g.userData.t0 = game.time ?? 0;
      game.scene.add(g);
      rauten.set(id, g);
    }
  }
  // Goldene Raute über der vorgeschlagenen Box, solange das Boot ausgewählt ist
  let vorschlagMarke = null;
  let vorschlagPlatz = null;
  function vorschlagZeigen(platzId) {
    vorschlagPlatz = platzId;
    if (!platzId) { if (vorschlagMarke) vorschlagMarke.visible = false; return; }
    if (!game.THREE || !game.scene) return;
    if (!vorschlagMarke) {
      vorschlagMarke = rauteBauen(true);
      vorschlagMarke.name = 'hafenbuero-vorschlag';
      game.scene.add(vorschlagMarke);
    }
    // Lage aus den gezeichneten Stegen (render/stege.js), sonst aus den Platzdaten
    const platz = HAFEN.plaetze.find((p) => p.id === platzId);
    const w = game.stege?.platz?.(platzId) ?? (platz && platzInWelt(platz, game.sim?.state?.stage ?? 1));
    vorschlagMarke.visible = !!w;
    if (w) vorschlagMarke.userData.ort = w;
  }
  game.onTick?.(() => {
    const blick = game.camera?.camera ?? null;
    if (vorschlagMarke?.visible) {
      const w = vorschlagMarke.userData.ort;
      const tt = performance.now() / 1000;
      vorschlagMarke.position.set(w.x, 1.2 + Math.sin(tt * 2) * 0.15, w.z);
      if (blick) vorschlagMarke.rotation.y = Math.atan2(blick.position.x - w.x, blick.position.z - w.z);
      const weit = blick ? blick.position.distanceTo(vorschlagMarke.position) : 60;
      vorschlagMarke.scale.setScalar(Math.min(6, Math.max(1, weit * 0.022)));
    }
  });
  game.onTick?.(() => {
    if (!rauten.size) return;
    const t = game.time ?? 0;
    const blick = game.camera?.camera ?? null;
    for (const [id, g] of rauten) {
      const a = game.boatView?.boot(id);
      if (!a?.model) { g.visible = false; continue; }
      g.visible = true;
      // Über der Mastspitze: Höhe des Modells einmal messen (Segel und Takelage eingeschlossen)
      if (g.userData.hoehe == null && game.THREE) {
        const box = new game.THREE.Box3().setFromObject(a.model);
        g.userData.hoehe = Number.isFinite(box.max.y) ? box.max.y - a.model.position.y : 0;
      }
      const h = Math.max(2.4, a.model.userData.iconHeight ?? 0, g.userData.hoehe ?? 0) + 1.0;
      g.position.set(a.model.position.x, h + Math.sin(t * 1.6 + id) * 0.12, a.model.position.z);
      // Immer quer zur Kamera, damit die Raute von jeder Seite gleich gut zu sehen ist
      if (blick) g.rotation.y = Math.atan2(blick.position.x - g.position.x, blick.position.z - g.position.z);
      const k = Math.min(1, (t - g.userData.t0) * 3);
      // Etwa gleich groß auf dem Bildschirm, egal wie weit die Kamera weg ist
      const weit = blick ? blick.position.distanceTo(g.position) : 60;
      const groesse = Math.max(0.01, k) * Math.min(6, Math.max(1, weit * 0.022));
      g.scale.setScalar(groesse);
      g.userData.raute.scale.setScalar(1 + Math.max(0, Math.sin(t * 3 + id)) * 0.12);
    }
  });

  // Passende Plätze als Ringe im Wasser markieren, sobald ein Boot gewählt ist.
  // Antippen eines Rings weist das Boot dort zu (pick type 'berth').
  // Mit Stegen in 3D leuchtet die Box selbst (gleiche Form und Drehung wie der Platz),
  // die runden Ringe sind nur der Ersatz ohne render/stege.js.
  let ringGroup = null;
  let leuchtend = [];
  function showRings(ids) {
    if (game.stege?.highlight) {
      leuchtend = [...ids];
      game.stege.highlight(leuchtend, '#2a9d8f');
      return;
    }
    const THREE = game.THREE;
    if (!THREE || !game.scene) return;
    if (!ringGroup) {
      ringGroup = new THREE.Group();
      ringGroup.name = 'hud-ringe';
      ringGroup.userData.geo = new THREE.RingGeometry(1.6, 2.4, 40).rotateX(-Math.PI / 2);
      ringGroup.userData.mat = new THREE.MeshBasicMaterial({ color: '#2a9d8f', transparent: true, opacity: 0.85, depthTest: false });
      game.scene.add(ringGroup);
    }
    ringGroup.clear();
    const stufe = game.sim?.state?.stage ?? 1;
    for (const id of ids) {
      const platz = HAFEN.plaetze.find((p) => p.id === id);
      const w = platz && platzInWelt(platz, stufe);
      if (!w) continue;
      const m = new THREE.Mesh(ringGroup.userData.geo, ringGroup.userData.mat);
      m.position.set(w.x, 0.08, w.z);
      m.renderOrder = 10;
      m.userData.pick = { type: 'berth', id };
      ringGroup.add(m);
    }
  }
  const clearRings = () => {
    vorschlagZeigen(null);
    ringGroup?.clear();
    if (leuchtend.length) { leuchtend = []; game.stege?.highlight?.([]); }
  };
  game.onTick(() => {
    if (leuchtend.length) {
      const o = 0.38 + 0.14 * Math.sin(performance.now() / 250);
      for (const id of leuchtend) {
        const mat = game.stege?.platz?.(id)?.mesh?.material;
        if (mat) mat.opacity = o;
      }
    }
    if (!ringGroup?.children.length) return;
    const s = 1 + 0.08 * Math.sin(performance.now() / 250);
    for (const m of ringGroup.children) m.scale.setScalar(s);
  });

  // Den Bauen-Knopf uebernimmt ui/bauen.js (Baumodus mit Vorschau); die Liste hier bleibt nur als Rueckfall
  buildBtn?.addEventListener('click', () => { if (game.bauen) return; cardMode === 'build' ? closeCard() : openCard('build'); });
  game.on('sim:change', schedule);
  game.on('sim:regionDone', () => {
    doneShown = true;
    goalLine.hidden = false;
    goalLine.classList.add('done');
    goalLine.textContent = 'Geschafft: Dein Seehafen ist fertig ausgebaut. Antippen zum Schließen.';
  });
  game.on('sim:select', ({ boatId, berths }) => {
    note = '';
    if (boatId != null) showRings(berths || []);
    else clearRings();
    if (boatId != null) openCard('boat');
    else if (cardMode === 'boat') closeCard();
    schedule();
  });
  game.on('sim:moored', ({ boatId }) => {
    if (game.sim?.selected == null) clearRings();
    if (cardMode === 'boat' && game.sim?.selected == null) closeCard();
    schedule();
    return boatId;
  });
  game.on('sim:assignFailed', ({ reason }) => {
    note = REASON_LABEL[reason] ?? '';
    if (cardMode === 'boat') schedule();
  });
  game.on('ui:cancel', () => {
    clearRings();
    game.sim?.select(null);
    closeCard();
  });
  game.on('spielstand-geladen', () => {
    closeCard();
    schedule();
  });
  game.on('ready', () => {
    updateSaveBtn();
    schedule();
  });
  updateSaveBtn();
  // Die Uhr läuft auch ohne Ereignis weiter (Tagesbalken)
  game.onTick(() => {
    if (game.sim?.state) day.dataset.progress = String(Math.round((game.sim.state.clock / (game.sim.ctx.rules.dayLength + game.sim.ctx.rules.eveningLength)) * 100));
  });
  schedule();
}
