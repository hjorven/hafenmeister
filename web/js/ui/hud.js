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
    #queue .boat-chip[aria-pressed="true"] { outline: 3px solid #f2c14e; }
    /* Handy: die Bootskarte zeigt nur Bootsname/Heimathafen, Hinweis und Knöpfe, damit die Stege frei bleiben */
    @media (max-width: 600px) { body.card-boat #card h2, body.card-boat #card p:not(.card-note):not(.card-hint):not(.card-boatname) { display: none; } }
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
    rep.textContent = `Ruf ${num1(sim.reputation())}`;
    const season = sim.season();
    const phase = season.winter ? ' · Winter' : st.phase === 'evening' ? ' · Abend' : '';
    day.textContent = `Tag ${st.day}${phase}`;
    const pending = sim.mooredBoats().reduce((a, b) => a + (b.pendingFee || 0), 0);
    collectBtn.hidden = pending <= 0;
    collectBtn.textContent = `Kassieren ${euro(pending)}`;
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
    // Sitzt der Knopf "Einfahren" schon am Boot (ui/gesten.js), zeigt die Karte keinen zweiten.
    const amBoot = game.gesten?.einfahrenAmBoot ?? Boolean(game.gesten && game.boatsVisible);
    const wishes = b.wishes.length ? b.wishes.map((w) => WISH_LABEL[w] ?? w).join(', ') : 'keine';
    fill(card,
      el('h2', {}, b.name),
      // Name am Heck und Heimathafen (features/stammgaeste.js), falls vorhanden
      b.bootsname ? el('p', { class: 'card-boatname' }, game.stammgaeste?.beschreibung(b) ?? `„${b.bootsname}“`) : null,
      el(
        'p',
        {},
        `Größe ${b.size} · ${meters(b.length)} lang, ${meters(b.beam)} breit, Tiefgang ${meters(b.draft)} · ${b.nights} ${b.nights === 1 ? 'Nacht' : 'Nächte'}`,
      ),
      el('p', {}, `Wünsche: ${wishes}`),
      el('p', { class: 'card-hint' }, !fitting.length ? `${b.name}: gerade ist kein passender Platz frei.` : amBoot ? `${b.name}: ${fitting.length} passende Plätze leuchten. Boot auf eine leuchtende Box ziehen oder „Einfahren“ am Boot antippen.` : `${b.name}: ${fitting.length} passende Plätze leuchten. Box antippen oder:`),
      note ? el('p', { class: 'card-note', role: 'status' }, note) : null,
      el(
        'div',
        { class: 'card-actions' },
        amBoot ? null : el('button', { type: 'button', class: 'hud-btn', disabled: !fitting.length, onclick: () => sim.autoEnter(b.id) }, 'Automatisch einfahren'),
        el('button', { type: 'button', class: 'hud-btn', onclick: () => { sim.dismiss(b.id); closeCard(); } }, 'Abweisen'),
        el('button', { type: 'button', class: 'hud-btn', onclick: () => { sim.select(null); closeCard(); } }, 'Schließen'),
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
      rows.push(
        el('button', { type: 'button', class: 'hud-btn', disabled: !adv.ok, onclick: () => act(sim.advanceStage()) }, `${adv.goal.name ?? 'Hafen erweitern'} · ${euro(adv.goal.cost)}`),
      );
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
