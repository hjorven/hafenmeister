// Handy-Prototyp: zeigt Layout und Touch-Bedienung mit Platzhalterdaten.
// Die Karte ist hier eine flache 2D-Zeichnung, im Spiel wird sie 3D.
// Kein Spielcode: Regeln, Preise und Boote sind nur grobe Annahmen.

import { createTouchView, pickNearest, boundsOf, haptic } from '../../../web/js/ui/touch-view.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const stage = $('#stage');
const canvas = stage.querySelector('canvas');
const ctx = canvas.getContext('2d');
const queueEl = $('#queue');
const card = $('#card');
const toastEl = $('#toast');
const btnNorth = $('#btn-north');

// ---------------------------------------------------------------- Ton

let audio = null;
function ac() {
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  }
  if (audio?.state === 'suspended') audio.resume();
  return audio;
}
function tone(freq, ms = 90, type = 'sine', vol = 0.12, slideTo = null) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + ms / 1000);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000 + 0.02);
}
const sfx = {
  select: () => tone(660, 70, 'triangle', 0.08),
  dock: () => { tone(330, 120, 'triangle', 0.1); setTimeout(() => tone(495, 160, 'triangle', 0.1), 110); },
  coin: (n) => tone(880 * Math.pow(2, Math.min(n, 12) / 12), 80, 'square', 0.05),
  horn: () => { tone(155, 650, 'sawtooth', 0.07); tone(233, 650, 'sawtooth', 0.04); },
  build: () => { tone(220, 60, 'square', 0.06); setTimeout(() => tone(220, 60, 'square', 0.06), 120); setTimeout(() => tone(440, 140, 'triangle', 0.08), 240); },
  nope: () => tone(200, 140, 'triangle', 0.08, 150),
};

// ---------------------------------------------------------------- Hafen (Platzhalter)

const WORLD = { x: 0, y: -24, w: 200, h: 164 };
const SHORE_Y = 112;
const ENTRY = { x: 112, y: -10 };
// Reede: Wartebojen vor der Einfahrt, links und rechts der Fahrrinne
const BUOYS = [70, 84, 98, 128, 142, 156].map((x, i) => ({ x, y: -8 + (i % 2) * 6, boat: null }));
const ANCHORAGE = { x: 60, y: -16, w: 106, h: 20 };

function makeSteg(id, name, x, yTop, cls, len, wid, depth, perSide) {
  const walk = { x: x - 1.2, y: yTop, w: 2.4, h: SHORE_Y - yTop };
  const boxes = [];
  for (let i = 0; i < perSide; i++) {
    const y = yTop + 3 + i * (wid + 0.4);
    boxes.push({ steg: id, side: -1, x: x - 1.2 - len, y, w: len, h: wid, len, wid, depth, boat: null });
    boxes.push({ steg: id, side: 1, x: x + 1.2, y, w: len, h: wid, len, wid, depth, boat: null });
  }
  return { id, name, cls, walk, boxes, depth, x: walk.x - len, y: yTop, w: walk.w + 2 * len, h: walk.h };
}

const stegs = [
  makeSteg('A', 'Steg A', 32, 66, 'S', 6, 3.0, 1.8, 6),
  makeSteg('B', 'Steg B', 80, 52, 'M', 9, 3.9, 2.4, 6),
  makeSteg('C', 'Hauptsteg C', 146, 40, 'L', 14, 5.0, 3.5, 6),
];
const allBoxes = stegs.flatMap((s) => s.boxes);

const sites = [
  { id: 1, x: 16, y: 122, built: null },
  { id: 2, x: 58, y: 124, built: null },
  { id: 3, x: 108, y: 122, built: null },
  { id: 4, x: 176, y: 124, built: null },
];
const BUILDINGS = [
  { key: 'wc', name: 'Toilette', wish: 'WC', cost: 80, text: 'Erfüllt den Wunsch WC für 6 Boote.' },
  { key: 'du', name: 'Dusche', wish: 'Du', cost: 200, text: 'Erfüllt den Wunsch Dusche für 6 Boote.' },
  { key: 'ki', name: 'Kiosk', wish: 'Ki', cost: 500, text: 'Erfüllt den Wunsch Essen für 8 Boote.' },
];

const TYPES = [
  { name: 'Ruderboot', size: 'S', len: 4, wid: 1.4, draft: 0.2, color: '#c96f4a', fee: 10, sail: false },
  { name: 'Segeljolle', size: 'S', len: 5, wid: 1.8, draft: 0.3, color: '#f2f2f2', fee: 10, sail: true },
  { name: 'Konsolenboot', size: 'S', len: 5.5, wid: 2.2, draft: 0.5, color: '#e9e3d0', fee: 12, sail: false },
  { name: 'Jollenkreuzer', size: 'M', len: 7.5, wid: 2.5, draft: 0.3, color: '#ffffff', fee: 20, sail: true },
  { name: 'Kajütmotorboot', size: 'M', len: 8.5, wid: 3.0, draft: 0.8, color: '#dfe7ee', fee: 22, sail: false },
  { name: 'Fahrtenyacht', size: 'L', len: 12, wid: 3.9, draft: 1.9, color: '#f7f7f7', fee: 40, sail: true },
  { name: 'Motoryacht', size: 'L', len: 13, wid: 4.2, draft: 1.1, color: '#fbfbfb', fee: 45, sail: false },
];
const WISHES = ['WC', 'Du', 'Ki'];

// ---------------------------------------------------------------- Spielzustand (Platzhalter)

const state = {
  money: 300, rep: 3.0, day: 1, phase: 'tag', t: 0, paused: false,
  speed: 1, towing: null, queue: [], docked: [], coins: [], floats: [], selected: null, building: false,
  nextId: 1, spawnIn: 1.5,
};
const DAY_S = 60, EVENING_S = 20;

function fits(boat, box) {
  return !box.boat && boat.len <= box.len && boat.wid <= box.wid && box.depth >= boat.draft + 0.3;
}
function freeFitting(boat) { return allBoxes.filter((b) => fits(boat, b)); }

function spawnBoat() {
  const pool = TYPES.filter((t) => state.day > 1 || t.size !== 'L');
  const t = pool[Math.floor(Math.random() * pool.length)];
  const wishes = WISHES.filter(() => Math.random() < 0.35).slice(0, 2);
  const buoy = BUOYS.find((b) => !b.boat);
  if (!buoy) return;
  const boat = { ...t, id: state.nextId++, wishes, patience: 50, nights: 1 + Math.floor(Math.random() * 2), buoy, bx: buoy.x, by: buoy.y };
  buoy.boat = boat;
  state.queue.push(boat);
  renderQueue();
}

// ---------------------------------------------------------------- Kamera und Gesten

const portrait = () => innerHeight >= innerWidth;
// Freier Bereich zwischen den Leisten, damit Kamerafahrten nichts unter dem HUD verstecken
function hudPadding() {
  const top = $('#hud-top').getBoundingClientRect().bottom + 8;
  if (portrait()) {
    const bottom = innerHeight - $('#hud-bottom').getBoundingClientRect().top + 8;
    return { top, bottom, left: 12, right: 12 };
  }
  const right = innerWidth - $('#hud-bottom').getBoundingClientRect().left + 8;
  return { top, bottom: 12, left: 12, right };
}

const cam = createTouchView(stage, {
  x: 100, y: 75, scale: 3, minScale: 1.2, maxScale: 24, bounds: WORLD, rotate: true,
  onTap: handleTap,
  onChange: (v) => btnNorth.classList.toggle('show', Math.abs(v.rot) > 0.02),
});
btnNorth.addEventListener('click', () => cam.animateTo({ ...cam.view, rot: 0 }));
$('#btn-overview').addEventListener('click', () => { cam.animateTo({ ...cam.view, rot: 0 }); overview(); });

function overview(animate = true) {
  const r = stage.getBoundingClientRect();
  cam.setScaleLimits(Math.min(r.width / WORLD.w, r.height / WORLD.h) * 0.9, 24);
  cam.fitRect({ x: 4, y: -18, w: 192, h: 152 }, hudPadding(), { animate });
}

// ---------------------------------------------------------------- Boot waehlen und zuweisen

function selectBoat(b, { fly = true } = {}) {
  if (state.building) toggleBuild(false);
  state.selected = state.selected === b ? null : b;
  renderQueue();
  if (!state.selected) { overview(); return; }
  sfx.select(); haptic(8);
  const cands = freeFitting(b);
  if (!cands.length) { toast('Kein passender Platz frei'); sfx.nope(); return; }
  // Kamera faehrt zu den Stegen mit passenden Plaetzen. Beim Ziehen nicht,
  // sonst rutscht das Ziel unter dem Finger weg.
  if (!fly) return;
  const s = stegs.filter((st) => cands.some((c) => c.steg === st.id));
  cam.fitRect(boundsOf(s), hudPadding(), { maxZoom: 14 });
}

// Spieler tippt einen Steg an, das Spiel waehlt die Box: die kleinste passende,
// bei Gleichstand die naechste zum Finger. Boxen sind auf dem Handy zu klein
// zum Treffen, ein Steg ist es nicht.
function stegAt(world, radiusPx = 28) {
  return pickNearest(stegs, world, cam.view.scale, radiusPx);
}
function chooseBox(boat, steg, world) {
  const cands = steg.boxes.filter((b) => fits(boat, b));
  if (!cands.length) return null;
  cands.sort((a, b) => (a.len * a.wid - b.len * b.wid)
    || (Math.hypot(a.x + a.w / 2 - world.x, a.y + a.h / 2 - world.y) - Math.hypot(b.x + b.w / 2 - world.x, b.y + b.h / 2 - world.y)));
  return cands[0];
}

function assign(boat, steg, world) {
  const box = chooseBox(boat, steg, world);
  if (!box) {
    toast(`${steg.name}: kein passender Platz`); sfx.nope(); haptic(30);
    return false;
  }
  state.queue = state.queue.filter((q) => q !== boat);
  if (boat.buoy) boat.buoy.boat = null;
  box.boat = boat;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const laneX = box.side < 0 ? box.x - 3 : box.x + box.w + 3;
  boat.box = box;
  boat.path = [{ x: boat.bx, y: boat.by }, { x: ENTRY.x, y: 4 }, { x: ENTRY.x, y: 20 }, { x: laneX, y: 20 }, { x: laneX, y: cy }, { x: cx, y: cy }];
  boat.pt = 0;
  boat.heading = -Math.PI / 2;
  state.docked.push(boat);
  state.selected = null;
  renderQueue();
  sfx.dock(); haptic(15);
  setTimeout(() => { if (!state.selected && !state.building) overview(); }, 900);
  return true;
}

// ---------------------------------------------------------------- Tipps auf der Karte

function waitingAt(world, radiusPx = 26) {
  const t = state.queue.map((b) => ({ x: b.bx - b.len / 2, y: b.by - b.len / 2, w: b.len, h: b.len, ref: b }));
  return pickNearest(t, world, cam.view.scale, radiusPx)?.ref ?? null;
}

function handleTap(world) {
  ac();
  if (state.building) {
    const site = pickNearest(sites.filter((s) => !s.built).map((s) => ({ ...s, x: s.x - 3, y: s.y - 3, w: 6, h: 6, ref: s })),
      world, cam.view.scale, 30);
    if (site) openBuildCard(site.ref); else toggleBuild(false);
    return;
  }
  if (state.selected) {
    const steg = stegAt(world);
    if (steg) { assign(state.selected, steg, world); return; }
    state.selected = null; renderQueue(); overview();
    return;
  }
  const boat = pickNearest(state.docked.filter((b) => b.pt >= 1).map((b) => ({ ...b.box, ref: b })), world, cam.view.scale, 16);
  if (boat) { openBoatCard(boat.ref); return; }
  closeCard();
}

// Lang druecken auf ein Boot im Hafen: es hupt und schaukelt.
// Kostet nichts, bringt nichts, macht aber Freude.
let pressTimer = null;
stage.addEventListener('pointerdown', (e) => {
  clearTimeout(pressTimer);
  const p = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    const r = stage.getBoundingClientRect();
    const w = cam.screenToWorld(p.x - r.left, p.y - r.top);
    const hit = pickNearest(state.docked.filter((b) => b.pt >= 1).map((b) => ({ ...b.box, ref: b })), w, cam.view.scale, 16);
    if (hit) { hit.ref.wobble = 1; sfx.horn(); haptic(40); }
  }, 520);
  stage.addEventListener('pointermove', function cancel(ev) {
    if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 10) { clearTimeout(pressTimer); stage.removeEventListener('pointermove', cancel); }
  });
});
['pointerup', 'pointercancel'].forEach((t) => stage.addEventListener(t, () => clearTimeout(pressTimer)));

// ---------------------------------------------------------------- Gesten, die einen Finger uebernehmen
//
// Beginnt ein Finger auf einem wartenden Boot (Schleppleine) oder abends auf
// einer Muenze (Kassierstrich), gehoert er dieser Geste: Die Karte bleibt still.
// Beginnt er woanders, verschiebt er wie gewohnt die Karte.

let own = null;   // { kind: 'tow' | 'stroke', id, ... }
const trail = []; // goldene Spur des Kassierstrichs, Bildschirmkoordinaten
const localPt = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

function coinNear(sx, sy, rad = 30) {
  return state.coins.find((c) => { const p = cam.worldToScreen(c.x, c.y); return Math.hypot(p.x - sx, p.y - sy + 14) < rad; });
}

function collect(c) {
  state.coins = state.coins.filter((k) => k !== c);
  state.money += c.value;
  own.n++;
  sfx.coin(own.n); haptic(6);
  state.floats.push({ x: c.x, y: c.y, text: `+${c.value} €`, t: 0 });
  updateHud();
}

stage.addEventListener('pointerdown', (e) => {
  if (own) { // zweiter Finger: Geste abbrechen, Zoomen gehoert der Karte
    if (own.kind === 'tow') state.towing = null;
    own = null;
    return;
  }
  ac();
  const p = localPt(e);
  const w = cam.screenToWorld(p.x, p.y);
  if (state.phase === 'abend' && !state.building && coinNear(p.x, p.y)) {
    own = { kind: 'stroke', id: e.pointerId, n: 0 };
    trail.length = 0; trail.push({ ...p, t: performance.now() });
    collect(coinNear(p.x, p.y));
  } else if (!state.building) {
    const b = waitingAt(w);
    if (!b) return;
    own = { kind: 'tow', id: e.pointerId, boat: b, start: p, active: false };
  } else return;
  e.stopImmediatePropagation();
  stage.setPointerCapture(e.pointerId);
}, { capture: true });

stage.addEventListener('pointermove', (e) => {
  if (!own || e.pointerId !== own.id) return;
  e.stopImmediatePropagation();
  const p = localPt(e);
  if (own.kind === 'stroke') {
    trail.push({ ...p, t: performance.now() });
    // auch zwischen zwei Bewegungen liegende Muenzen treffen
    let c; while ((c = coinNear(p.x, p.y))) collect(c);
    return;
  }
  if (!own.active && Math.hypot(p.x - own.start.x, p.y - own.start.y) > 10) {
    own.active = true;
    if (state.selected !== own.boat) selectBoat(own.boat, { fly: false });
  }
  if (own.active) {
    // Ziel etwas ueber dem Finger, damit der Finger den Steg nicht verdeckt
    const w = cam.screenToWorld(p.x, p.y - 28);
    state.towing = { boat: own.boat, x: w.x, y: w.y, steg: stegAt(w, 36) };
  }
}, { capture: true });

function endOwn(e) {
  if (!own || e.pointerId !== own.id) return;
  e.stopImmediatePropagation();
  const o = own; own = null;
  if (o.kind === 'stroke') {
    if (o.n >= 3) toast(`${o.n} Münzen in einem Strich`);
    return;
  }
  const t = state.towing; state.towing = null;
  if (!o.active) { if (e.type === 'pointerup') selectBoat(o.boat); return; }
  if (e.type === 'pointerup' && t?.steg) assign(o.boat, t.steg, { x: t.x, y: t.y });
  else if (e.type === 'pointerup') { toast('Kein Steg unter der Leine'); sfx.nope(); }
}
stage.addEventListener('pointerup', endOwn, { capture: true });
stage.addEventListener('pointercancel', endOwn, { capture: true });

// ---------------------------------------------------------------- Automatisch einfahren

function autoDock(boat) {
  const cands = freeFitting(boat);
  if (!cands.length) { toast('Kein passender Platz frei'); sfx.nope(); haptic([20, 40, 20]); return; }
  cands.sort((a, b) => (a.len * a.wid - b.len * b.wid) || (Math.hypot(a.x - ENTRY.x, a.y - ENTRY.y) - Math.hypot(b.x - ENTRY.x, b.y - ENTRY.y)));
  const box = cands[0];
  assign(boat, stegs.find((s) => s.id === box.steg), { x: box.x + box.w / 2, y: box.y + box.h / 2 });
}

// ---------------------------------------------------------------- Sonne ziehen: Vorspulen

const sun = document.createElement('span');
sun.className = 'sun';
sun.setAttribute('role', 'slider');
sun.setAttribute('aria-label', 'Zeit vorspulen');
$('#day').append(sun);
(() => {
  let d = null;
  sun.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    d = { x0: e.clientX, id: e.pointerId };
    sun.setPointerCapture(e.pointerId);
    body.classList.add('fast');
  });
  sun.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const w = $('#day').getBoundingClientRect().width;
    const k = Math.max(0, Math.min(1, (e.clientX - d.x0) / Math.max(60, w * 0.8)));
    const speed = Math.round(1 + 7 * k);
    if (speed !== state.speed) { state.speed = speed; tone(300 + speed * 60, 40, 'triangle', 0.05); haptic(4); }
    sun.style.setProperty('--pull', `${Math.max(0, e.clientX - d.x0)}px`);
    sun.dataset.speed = speed > 1 ? `${speed}x` : '';
  });
  const end = () => { if (!d) return; d = null; state.speed = 1; sun.style.setProperty('--pull', '0px'); sun.dataset.speed = ''; body.classList.remove('fast'); };
  sun.addEventListener('pointerup', end);
  sun.addEventListener('pointercancel', end);
})();

// ---------------------------------------------------------------- Untere Leiste

function boatSvg(b) {
  const L = { S: 30, M: 42, L: 56 }[b.size];
  const sail = b.sail ? `<path d="M${30} 4 L${30} 22 L${30 + L * 0.3} 22 Z" fill="#fff" stroke="#1d3245" stroke-width="1.2"/>` : `<rect x="${32 - L * 0.15}" y="15" width="${L * 0.3}" height="8" rx="2" fill="#dfe7ee" stroke="#1d3245" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 64 34" width="58" height="30" aria-hidden="true">${sail}<path d="M${32 - L / 2} 24 L${32 + L / 2} 24 L${32 + L / 2 - 5} 31 L${32 - L / 2 + 3} 31 Z" fill="${b.color}" stroke="#1d3245" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

// Die Boote warten draussen an den Bojen. Die Leiste zeigt nur, wie viele
// warten (Antippen faehrt zur Reede), und fuer das gewaehlte Boot den Knopf
// "Automatisch einfahren".
function renderQueue() {
  const b = state.selected;
  if (b) {
    const info = document.createElement('div');
    info.className = 'boat';
    info.setAttribute('aria-pressed', 'true');
    info.innerHTML = `<span class="size">${b.size}</span>${boatSvg(b)}<span class="wishes">${b.wishes.map((w) => `<span class="w">${w}</span>`).join('')}</span>`;
    const auto = document.createElement('button');
    auto.className = 'q-btn primary';
    auto.innerHTML = '<b>Automatisch</b><small>einfahren</small>';
    auto.addEventListener('click', () => autoDock(b));
    const x = document.createElement('button');
    x.className = 'q-btn';
    x.setAttribute('aria-label', 'Auswahl aufheben');
    x.textContent = 'Zurück';
    x.addEventListener('click', () => { state.selected = null; renderQueue(); overview(); });
    queueEl.replaceChildren(info, auto, x);
    return;
  }
  if (!state.queue.length) { queueEl.replaceChildren(); return; }
  const chip = document.createElement('button');
  chip.className = 'q-btn wide' + (state.queue.some((q) => q.patience < 12) ? ' hurry' : '');
  chip.innerHTML = `<b>${state.queue.length} ${state.queue.length === 1 ? 'Boot wartet' : 'Boote warten'}</b><small>an der Boje, antippen zum Hinsehen</small>`;
  chip.addEventListener('click', () => { ac(); cam.fitRect(ANCHORAGE, hudPadding(), { maxZoom: 12 }); });
  queueEl.replaceChildren(chip);
}

const fmt = new Intl.NumberFormat('de-DE');
function updateHud() {
  $('#money b').textContent = `${fmt.format(state.money)} €`;
  $('#rep b').textContent = state.rep.toFixed(1).replace('.', ',');
  $('#day b').textContent = String(state.day);
  const p = state.phase === 'tag' ? state.t / DAY_S : state.t / EVENING_S;
  $('#day').style.setProperty('--day-progress', p.toFixed(3));
  body.dataset.phase = state.phase;
}

$('#btn-pause').addEventListener('click', () => {
  state.paused = !state.paused;
  body.classList.toggle('paused', state.paused);
  $('#btn-pause').textContent = state.paused ? 'Weiter' : 'Pause';
  toast(state.paused ? 'Pause' : 'Weiter');
});

function toggleBuild(on = !state.building) {
  state.building = on;
  body.classList.toggle('building', on);
  if (on) {
    state.selected = null; renderQueue();
    cam.fitRect({ x: 4, y: 100, w: 192, h: 32 }, hudPadding(), { maxZoom: 8 });
  } else { closeCard(); overview(); }
}
$('#btn-build').addEventListener('click', () => { ac(); toggleBuild(); });

let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

// ---------------------------------------------------------------- Infokarte (Bottom Sheet)

function openCard(html) {
  card.innerHTML = html;
  card.hidden = false;
  body.classList.add('card-open');
}
function closeCard() {
  card.hidden = true;
  body.classList.remove('card-open');
}

function openBuildCard(site) {
  let pick = BUILDINGS[0];
  const draw = () => {
    openCard(`<h2>Bauplatz ${site.id}</h2><p>${pick.text}</p>
      <div class="options">${BUILDINGS.map((b) => `<button data-k="${b.key}" style="${b === pick ? 'border-color:var(--hm-accent)' : ''}">
        <b>${b.name}</b><small>${fmt.format(b.cost)} €</small></button>`).join('')}</div>
      <div class="actions"><button class="secondary" data-x>Abbrechen</button>
      <button data-ok ${state.money < pick.cost ? 'disabled' : ''}>Bauen ${fmt.format(pick.cost)} €</button></div>`);
    card.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('click', () => { pick = BUILDINGS.find((b) => b.key === el.dataset.k); draw(); }));
    card.querySelector('[data-x]').addEventListener('click', closeCard);
    card.querySelector('[data-ok]').addEventListener('click', () => {
      state.money -= pick.cost; site.built = pick; site.pop = 0;
      updateHud(); sfx.build(); haptic(20); closeCard(); toggleBuild(false);
    });
  };
  draw();
}

function openBoatCard(b) {
  openCard(`<h2>${b.name}</h2>
    <p>Größe ${b.size} · ${String(b.len).replace('.', ',')} m lang · Tiefgang ${String(b.draft).replace('.', ',')} m<br>
    Bleibt noch ${b.nights} ${b.nights === 1 ? 'Nacht' : 'Nächte'} · Wünsche: ${b.wishes.length ? b.wishes.join(', ') : 'keine'}</p>
    <div class="actions"><button class="secondary" data-x>Schließen</button></div>`);
  card.querySelector('[data-x]').addEventListener('click', closeCard);
}

// Karte nach unten wischen schliesst sie (im Querformat nach rechts)
(() => {
  let s = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    s = { x: e.clientX, y: e.clientY, id: e.pointerId };
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove', (e) => {
    if (!s || e.pointerId !== s.id) return;
    const d = portrait() ? Math.max(0, e.clientY - s.y) : Math.max(0, e.clientX - s.x);
    card.style.transform = portrait() ? `translateY(${d}px)` : `translateX(${d}px)`;
    s.d = d;
  });
  const end = () => {
    if (!s) return;
    card.classList.remove('dragging');
    card.style.transform = '';
    if ((s.d || 0) > 70) closeCard();
    s = null;
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
})();

// ---------------------------------------------------------------- Spielschleife (Platzhalter)

function nightFalls() {
  for (const b of state.docked) {
    if (b.pt < 1) continue;
    const met = b.wishes.filter((w) => sites.some((s) => s.built?.wish === w)).length;
    const value = Math.round(b.fee * (1 + 0.25 * met));
    const c = b.box;
    state.coins.push({ x: c.x + c.w / 2, y: c.y + c.h / 2, value, boat: b });
  }
  if (state.coins.length) toast('Abend: über die Münzen wischen');
}
function morning() {
  state.day++;
  for (const b of [...state.docked]) {
    if (b.pt < 1) continue;
    b.nights--;
    if (b.nights <= 0) {
      const met = b.wishes.filter((w) => sites.some((s) => s.built?.wish === w)).length;
      const stars = b.wishes.length ? 1 + 4 * met / b.wishes.length : 4;
      state.rep = Math.max(1, Math.min(5, state.rep * 0.9 + stars * 0.1));
      b.box.boat = null;
      state.docked = state.docked.filter((d) => d !== b);
    }
  }
  // Nicht eingesammelte Muenzen verfallen nicht, im Spiel kassiert sie spaeter das Hafenbuero
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const gdt = dt * state.speed;
  if (!state.paused) {
    const dt = gdt;
    state.t += dt;
    if (state.phase === 'tag') {
      state.spawnIn -= dt;
      if (state.spawnIn <= 0 && BUOYS.some((b) => !b.boat)) { spawnBoat(); state.spawnIn = 5 + Math.random() * 5; }
      for (const b of [...state.queue]) {
        b.patience -= dt;
        if (b.patience <= 0) {
          state.queue = state.queue.filter((q) => q !== b);
          b.buoy.boat = null;
          if (state.selected === b) state.selected = null;
          state.rep = Math.max(1, state.rep - 0.05);
          toast(`${b.name} fährt weiter`);
          renderQueue();
        } else if (b.patience < 12 && !b.warned) { b.warned = true; renderQueue(); }
        b.bx = b.buoy.x + Math.sin(state.t * 0.4 + b.id) * 0.8;  // schwoit an der Boje
      }
      if (state.t >= DAY_S) { state.phase = 'abend'; state.t = 0; nightFalls(); }
    } else if (state.t >= EVENING_S) { state.phase = 'tag'; state.t = 0; morning(); }
    for (const b of state.docked) if (b.pt < 1) b.pt = Math.min(1, b.pt + dt / 3.2);
  }
  for (const f of state.floats) f.t += dt;
  state.floats = state.floats.filter((f) => f.t < 1);
  for (const b of state.docked) if (b.wobble) b.wobble = Math.max(0, b.wobble - dt * 0.8);
  for (const s of sites) if (s.built && s.pop < 1) s.pop = Math.min(1, s.pop + dt * 3);
  updateHud();
  draw(now / 1000);
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- Zeichnen

function pathPos(b) {
  const pts = b.path; const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); total += l; }
  let d = b.pt * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 1;
      const a = pts[i], c = pts[i + 1];
      return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, ang: Math.atan2(c.y - a.y, c.x - a.x) };
    }
    d -= segs[i];
  }
  return { ...pts.at(-1), ang: 0 };
}

function drawHull(b, x, y, ang, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + Math.sin(time * 1.6 + b.id) * 0.02 + (b.wobble ? Math.sin(time * 30) * 0.12 * b.wobble : 0));
  const L = b.len, W = b.wid;
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.quadraticCurveTo(L / 4, -W / 2, -L / 2, -W / 2.2);
  ctx.lineTo(-L / 2, W / 2.2);
  ctx.quadraticCurveTo(L / 4, W / 2, L / 2, 0);
  ctx.fillStyle = b.color; ctx.fill();
  ctx.lineWidth = 0.18; ctx.strokeStyle = '#1d3245'; ctx.stroke();
  if (b.sail) { ctx.fillStyle = '#1d3245'; ctx.beginPath(); ctx.arc(L * 0.08, 0, Math.max(0.25, W * 0.1), 0, 7); ctx.fill(); }
  else { ctx.fillStyle = '#c9d6e0'; ctx.fillRect(-L * 0.15, -W * 0.28, L * 0.3, W * 0.56); }
  ctx.restore();
}

function draw(time) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = stage.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  }
  const v = cam.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#8cc9df'; ctx.fillRect(0, 0, r.width, r.height);

  ctx.save();
  ctx.translate(r.width / 2, r.height / 2);
  ctx.rotate(-v.rot);
  ctx.scale(v.scale, v.scale);
  ctx.translate(-v.x, -v.y);

  // Wasser, Becken und Ufer
  ctx.fillStyle = '#a9dbeb'; ctx.fillRect(WORLD.x - 400, WORLD.y - 400, WORLD.w + 800, WORLD.h + 800);
  ctx.fillStyle = '#86c3db'; ctx.fillRect(118, 30, 66, SHORE_Y - 30);         // ausgebaggertes Becken
  ctx.fillStyle = '#e9d9a6'; ctx.fillRect(WORLD.x - 400, SHORE_Y, WORLD.w + 800, 400);
  ctx.fillStyle = '#9cc47a'; ctx.fillRect(WORLD.x - 400, SHORE_Y + 22, WORLD.w + 800, 400);
  // Fahrrinne mit Tonnen
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#3aa35b'; ctx.beginPath(); ctx.arc(ENTRY.x + 8, 2 + i * 8, 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9534f'; ctx.beginPath(); ctx.arc(ENTRY.x - 8, 2 + i * 8, 0.9, 0, 7); ctx.fill();
  }

  // Passende Plaetze leuchten
  const sel = state.selected;
  const glow = 0.45 + 0.35 * Math.sin(time * 5);
  const hoverSteg = state.towing?.steg ?? null;
  for (const s of stegs) {
    if (sel && s.boxes.some((b) => fits(sel, b))) {
      ctx.fillStyle = s === hoverSteg ? 'rgba(232,163,61,0.35)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
    }
    for (const b of s.boxes) {
      if (sel && fits(sel, b)) {
        ctx.fillStyle = `rgba(70,190,110,${glow})`;
        ctx.fillRect(b.x + 0.3, b.y + 0.3, b.w - 0.6, b.h - 0.6);
      }
      ctx.strokeStyle = 'rgba(29,50,69,0.35)'; ctx.lineWidth = 0.15;
      ctx.beginPath();
      const far = b.side < 0 ? b.x : b.x + b.w;
      ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.stroke();
      ctx.fillStyle = '#6b4a2d'; ctx.beginPath(); ctx.arc(far, b.y + b.h, 0.3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#b07a4a'; ctx.fillRect(s.walk.x, s.walk.y, s.walk.w, s.walk.h);
  }

  // Bauplaetze und Gebaeude
  for (const s of sites) {
    if (s.built) {
      const k = 0.6 + 0.4 * Math.min(1, s.pop * 1.2) - (s.pop > 0.8 ? (s.pop - 0.8) * 0.5 : 0);
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-3, -1.5, 8, 5);
      ctx.fillStyle = '#f5efe2'; ctx.fillRect(-4, -3, 8, 6);
      ctx.fillStyle = '#c8553d'; ctx.beginPath(); ctx.moveTo(-4.8, -3); ctx.lineTo(0, -6.5); ctx.lineTo(4.8, -3); ctx.fill();
      if (state.phase === 'abend') { ctx.fillStyle = '#ffd36b'; ctx.fillRect(-1, -1, 2, 2); }
      ctx.restore();
    }
  }

  // Reede: Wartebojen und wartende Boote
  for (const bu of BUOYS) {
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#1d3245'; ctx.lineWidth = 0.15;
    ctx.beginPath(); ctx.arc(bu.x, bu.y - 3, 0.7, 0, 7); ctx.fill(); ctx.stroke();
  }
  for (const b of state.queue) {
    ctx.strokeStyle = 'rgba(29,50,69,0.5)'; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(b.buoy.x, b.buoy.y - 3); ctx.lineTo(b.bx, b.by - b.len / 2); ctx.stroke();
    drawHull(b, b.bx, b.by, Math.PI / 2, time);
  }
  // Schleppleine vom Boot zum Finger
  if (state.towing) {
    const t = state.towing, b = t.boat;
    ctx.save();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2.5 / v.scale;
    ctx.setLineDash([6 / v.scale, 4 / v.scale]); ctx.lineDashOffset = -time * 20 / v.scale;
    ctx.beginPath(); ctx.moveTo(b.bx, b.by); ctx.quadraticCurveTo((b.bx + t.x) / 2, Math.max(b.by, t.y) + 6, t.x, t.y); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.6; drawHull(b, t.x, t.y, Math.PI / 2, time); ctx.globalAlpha = 1;
  }

  // Boote
  for (const b of state.docked) {
    if (b.pt < 1) { const p = pathPos(b); drawHull(b, p.x, p.y, p.ang, time); }
    else {
      const c = b.box;
      // Bug zum Steg
      drawHull(b, c.x + c.w / 2 + (c.side < 0 ? (c.len - b.len) / 2 : -(c.len - b.len) / 2), c.y + c.h / 2, c.side < 0 ? 0 : Math.PI, time);
    }
  }

  // Abend
  if (state.phase === 'abend') {
    ctx.fillStyle = 'rgba(40,40,110,0.28)';
    ctx.fillRect(WORLD.x - 400, WORLD.y - 400, WORLD.w + 800, WORLD.h + 800);
    const on = Math.sin(time * 3) > 0;
    ctx.fillStyle = on ? '#4bdc6e' : '#1f5a2e'; ctx.beginPath(); ctx.arc(ENTRY.x + 8, 2, 1.2, 0, 7); ctx.fill();
    ctx.fillStyle = on ? '#1f5a2e' : '#ff5a4f'; ctx.beginPath(); ctx.arc(ENTRY.x - 8, 2, 1.2, 0, 7); ctx.fill();
  }
  ctx.restore();

  // Ab hier Bildschirmkoordinaten: gleich gross, egal wie weit gezoomt ist
  if (state.building) {
    for (const s of sites) {
      if (s.built) continue;
      const p = cam.worldToScreen(s.x, s.y);
      const pulse = 1 + 0.08 * Math.sin(time * 4 + s.id);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#e8a33d'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      ctx.restore();
    }
  }
  // Groesse und Geduld der wartenden Boote, immer gut lesbar
  for (const b of state.queue) {
    const p = cam.worldToScreen(b.bx, b.by - b.len / 2);
    const k = Math.max(0, b.patience / 50);
    const sel = state.selected === b;
    ctx.beginPath(); ctx.arc(p.x, p.y - 16, 12, 0, 7);
    ctx.fillStyle = sel ? '#e8a33d' : '#fffaf0'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k < 0.25 ? '#d9534f' : '#3aa35b';
    ctx.beginPath(); ctx.arc(p.x, p.y - 16, 12, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = sel ? '#fff' : '#1d3245'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.size, p.x, p.y - 16);
  }
  // Goldene Spur des Kassierstrichs
  const nowMs = performance.now();
  while (trail.length && nowMs - trail[0].t > 450) trail.shift();
  if (trail.length > 1) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = 1 - (nowMs - trail[i].t) / 450;
      ctx.strokeStyle = `rgba(242,193,78,${a})`; ctx.lineWidth = 10 * a + 2;
      ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
    }
    ctx.restore();
  }
  for (const c of state.coins) {
    const p = cam.worldToScreen(c.x, c.y);
    const bob = Math.sin(time * 4 + c.x) * 2;
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#a77a12'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y - 14 + bob, 11, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a77a12'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('€', p.x, p.y - 14 + bob);
  }
  for (const f of state.floats) {
    const p = cam.worldToScreen(f.x, f.y);
    ctx.globalAlpha = 1 - f.t;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1d3245'; ctx.lineWidth = 3;
    ctx.font = '800 15px system-ui'; ctx.textAlign = 'center';
    ctx.strokeText(f.text, p.x, p.y - 30 - f.t * 30); ctx.fillText(f.text, p.x, p.y - 30 - f.t * 30);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- Start

addEventListener('resize', () => { if (!state.selected && !state.building) overview(false); });
spawnBoat(); spawnBoat(); spawnBoat();
renderQueue();
updateHud();
requestAnimationFrame(() => { overview(false); requestAnimationFrame(tick); });
// Zum Ausprobieren: ?abend startet direkt am Abend mit belegten Plaetzen
if (new URLSearchParams(location.search).has('abend')) {
  for (const t of [TYPES[0], TYPES[3], TYPES[5], TYPES[1], TYPES[4]]) {
    const b = { ...t, id: state.nextId++, wishes: [], patience: 45, nights: 2 };
    const box = allBoxes.find((x) => fits(b, x));
    box.boat = b; b.box = box; b.pt = 1; b.path = [ENTRY]; state.docked.push(b);
  }
  state.phase = 'abend'; state.t = 0; nightFalls();
}
// Nur fuer automatische Tests des Prototyps
window.__demo = { state, cam, stegs, BUOYS };
