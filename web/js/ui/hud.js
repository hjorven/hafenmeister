// HUD: zeigt die Zahlen der Spielregeln an und bietet die Aktionen als echte Knöpfe an.
// Die Boote warten draußen an Bojen (3D). #queue ist nur eine Übersicht der Wartenden,
// ein Knopf je Boot (data-boat, aria-pressed), damit Tastatur und Bildschirmleser alles erreichen.
// Daten kommen aus game.sim (web/js/bridge.js), siehe docs/spielregeln.md.

const WISH_LABEL = { wc: 'WC', dusche: 'Dusche', essen: 'Essen', strom: 'Strom', diesel: 'Diesel' };
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
  `;
  document.head.append(style);

  // Knopf "Kassieren" erscheint abends neben "Bauen", solange Münzen offen sind
  const collectBtn = el('button', { type: 'button', class: 'hud-btn', id: 'btn-collect', hidden: true });
  buildBtn?.before(collectBtn);
  collectBtn.addEventListener('click', () => game.sim?.collectAll(true));

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
    collectBtn.hidden = pending <= 0;
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
          b.besuche > 1 ? `${b.size} ${b.name} · Stammgast` : `${b.size} ${b.name}`,
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
    // Zuweisen als Entscheidung (P10, Review Bed P2): was das Boot zahlt und wie viele Plätze
    // seinen Platz-Wunsch erfüllen (die leuchten gold)
    const gold = sim.wunschPlaetze?.(b.id) ?? [];
    const wert = sim.platzWert?.(b.id) ?? null;
    const platzWunsch = b.wishes.filter((w) => sim.ctx.rules.berthWishes?.[w]).map((w) => WISH_LABEL[w] ?? w);
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
      wert ? el('p', { class: 'card-zahlt' }, `Zahlt etwa ${wert.fee} € pro Nacht${gold.length ? `, am Wunschplatz ${sim.platzWert(b.id, gold[0])?.fee ?? wert.fee} €` : ''}.`) : null,
      el('p', { class: 'card-hint' }, !fitting.length
        ? 'Gerade ist kein passender Platz frei.'
        : `${fitting.length} passende ${fitting.length === 1 ? 'Platz leuchtet' : 'Plätze leuchten'}${platzWunsch.length ? `, ${gold.length} gold mit ${platzWunsch.join(' und ')}` : ''}. Zieh das Boot hin, sonst sucht es sich selbst eine Box.`),
      note ? el('p', { class: 'card-note', role: 'status' }, note) : null,
      el(
        'div',
        { class: 'card-actions' },
        el('button', { type: 'button', class: 'hud-btn hm-primaer', 'aria-label': 'Automatisch einfahren', title: 'Das Boot sucht sich den besten freien Platz', disabled: !fitting.length, onclick: () => sim.autoEnter(b.id) }, 'Einfahren lassen'),
        el('button', { type: 'button', class: 'hud-btn hm-gefahr', onclick: () => { sim.dismiss(b.id); closeCard(); } }, 'Abweisen'),
      ),
    );
  }

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
    if (cardMode === 'boat') boatCard(sim, st);
    else if (cardMode === 'build') buildCard(sim, st);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  // Passende Plätze als Ringe im Wasser markieren, sobald ein Boot gewählt ist.
  // Antippen eines Rings weist das Boot dort zu (pick type 'berth').
  // Mit Stegen in 3D leuchtet die Box selbst (gleiche Form und Drehung wie der Platz),
  // die runden Ringe sind nur der Ersatz ohne render/stege.js.
  let ringGroup = null;
  let leuchtend = [];
  let gold = new Set();
  function showRings(ids, boatId = null) {
    gold = new Set(boatId != null ? game.sim?.wunschPlaetze?.(boatId) ?? [] : []);
    if (game.stege?.highlight) {
      leuchtend = [...ids];
      game.stege.highlight(leuchtend, '#2a9d8f');
      // Gold: Platz erfüllt einen Wunsch des Boots (Strom), wie beim Ziehen in ui/gesten.js
      for (const id of gold) game.stege.platz?.(id)?.mesh?.material?.color?.set('#f2b01e');
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
    ringGroup?.clear();
    if (leuchtend.length) { leuchtend = []; game.stege?.highlight?.([]); }
  };
  game.onTick(() => {
    if (leuchtend.length) {
      const o = 0.38 + 0.14 * Math.sin(performance.now() / 250);
      for (const id of leuchtend) {
        const mat = game.stege?.platz?.(id)?.mesh?.material;
        if (mat) mat.opacity = gold.has(id) ? o + 0.3 : o;
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
    if (boatId != null) showRings(berths || [], boatId);
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
