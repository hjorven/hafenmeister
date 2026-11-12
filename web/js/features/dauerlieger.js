// Dauerlieger: feste Plätze mit eigenem Boot. Beschreibung in docs/neue-features.md, Abschnitt 3.
//
// - Ab Stufe 2 lässt sich ein freier Liegeplatz zum Dauerplatz machen. Dann liegt dort ein eigenes
//   Boot (stationiert, siehe sim.stationBoat) und zahlt jeden Abend den festen Anteil
//   rules.stationedFeeShare des Gastpreises, ohne dass man etwas tun muss.
// - An vielen Tagen segelt das Boot morgens raus und kommt abends zurück (nur Bild, der Platz bleibt belegt).
// - Manchmal geht es für 1 bis 3 Tage auf Törn. Dann ist das Schild grün und der Platz frei für Gäste,
//   die rechtzeitig wieder abreisen. Kommt es zurück und der Platz ist noch belegt, wartet es eine Nacht.
//
// Die Logik (alles ausser init) läuft ohne Browser und ist in tests/dauerlieger.test.mjs getestet.
// Spielstand: state.modules.dauer = { plaetze: { platzId: { bootId, rueckNacht, boot, tagestoern } } }
//   rueckNacht: Tag, in dessen Nacht das Boot zurückkommt (null = Boot ist da)
//   boot:       das Boot-Objekt, solange es draußen ist (dann nicht in state.boats)
//
// Ereignisse (über game.sim.dispatch, also als sim:<type>): dauerNeu, dauerAufgehoben, dauerAuslaufen,
// dauerEinlaufen. Dazu für Grafik und Ton die Namen aus docs/neue-features.md:
//   dauer:auslaufen { id, platzId, tage }   (tage 0 = nur Tagestörn)
//   dauer:einlaufen { id, platzId }

import * as sim from '../sim.js';
import { random, randomInt } from '../random.js';
import { STAMM } from './stammgaeste.js';

export const DAUER = {
  abStufe: 2,
  tagestoernChance: 0.4,   // Wahrscheinlichkeit pro Tag für eine Runde draußen (morgens raus, abends zurück)
  toernChance: 0.12,       // Wahrscheinlichkeit pro Tag für einen Törn über mehrere Tage
  toernTage: [1, 3],
};

export function dauerState(state) {
  state.modules ||= {};
  state.modules.dauer ||= { plaetze: {} };
  return state.modules.dauer;
}

export function istDauerplatz(state, platzId) {
  return !!dauerState(state).plaetze[platzId];
}

/** Bootsarten, die als Dauerlieger an diesen Platz passen (kleinste Maße der Art). */
export function passendeArten(state, ctx, platzId) {
  const berth = ctx.berthById[platzId];
  if (!berth) return [];
  return ctx.types.filter((t) => {
    if (t.stationed || t.special || t.unlock || t.dayVisitors || t.minStage > state.stage) return false;
    const m = t.models?.[0];
    const probe = {
      size: t.size, stationed: true,
      length: m?.length ?? t.length[0], beam: m?.beam ?? t.beam[0], draft: m?.draft ?? t.draft[0],
    };
    return sim.fits(probe, berth, ctx.rules, state.stage);
  });
}

/** Kann dieser Platz jetzt Dauerplatz werden? { ok, reason } */
export function kannDauerplatz(state, ctx, platzId) {
  const berth = ctx.berthById[platzId];
  if (!berth || !sim.berthAvailable(state, berth)) return { ok: false, reason: 'noBerth' };
  if (state.stage < DAUER.abStufe) return { ok: false, reason: 'stage' };
  if (istDauerplatz(state, platzId)) return { ok: false, reason: 'schon' };
  if (berth.reserved) return { ok: false, reason: 'reserved' };
  if (!sim.isFree(state, platzId)) return { ok: false, reason: 'occupied' };
  if (!passendeArten(state, ctx, platzId).length) return { ok: false, reason: 'keinBoot' };
  return { ok: true };
}

/** Macht den Platz zum Dauerplatz. Am liebsten ein Segelboot, das kann rausfahren und segeln. */
export function machDauerplatz(state, ctx, platzId) {
  const k = kannDauerplatz(state, ctx, platzId);
  if (!k.ok) return { ok: false, reason: k.reason, events: [] };
  const arten = passendeArten(state, ctx, platzId);
  const segler = arten.filter((t) => t.sail);
  const pool = segler.length && random(state) < 0.7 ? segler : arten;
  const art = pool[Math.floor(random(state) * pool.length)];
  const modelle = (art.models || []).filter((m) => (m.minStage ?? art.minStage) <= state.stage);
  const modell = modelle.length ? modelle[Math.floor(random(state) * modelle.length)] : null;
  let r = sim.stationBoat(state, ctx, art.id, platzId, modell?.id ?? null);
  if (!r.ok && modell) r = sim.stationBoat(state, ctx, art.id, platzId, null);
  if (!r.ok) return { ok: false, reason: r.reason, events: [] };
  const boot = state.boats[r.boatId];
  boot.dauer = true;
  dauerState(state).plaetze[platzId] = { bootId: r.boatId, rueckNacht: null, boot: null, tagestoern: false };
  return { ok: true, boatId: r.boatId, events: [...r.events, { type: 'dauerNeu', boatId: r.boatId, berthId: platzId }] };
}

/**
 * Stammgast ab dem 5. Besuch, der gerade hier liegt, als Dauerlieger behalten.
 * Er bleibt an seinem Platz und zahlt ab jetzt den festen Anteil.
 */
export function kannBehalten(state, ctx, platzId) {
  const boot = state.boats[state.berths[platzId]];
  if (!boot || boot.stationed || boot.status !== 'moored') return false;
  if (state.stage < DAUER.abStufe || istDauerplatz(state, platzId)) return false;
  return (boot.besuche ?? 0) >= STAMM.dauerAbBesuch;
}

export function behalte(state, ctx, platzId) {
  if (!kannBehalten(state, ctx, platzId)) return { ok: false, events: [] };
  const boot = state.boats[state.berths[platzId]];
  Object.assign(boot, { stationed: true, dauer: true, nights: null, wishes: [], pendingFee: boot.pendingFee || 0 });
  dauerState(state).plaetze[platzId] = { bootId: boot.id, rueckNacht: null, boot: null, tagestoern: false };
  return { ok: true, boatId: boot.id, events: [{ type: 'dauerNeu', boatId: boot.id, berthId: platzId, stammgast: true }] };
}

/** Dauerplatz wieder zum Gastplatz machen. Das Boot verlässt den Hafen. */
export function hebeAuf(state, ctx, platzId) {
  const d = dauerState(state);
  const p = d.plaetze[platzId];
  if (!p) return { ok: false, events: [] };
  const events = [];
  if (p.boot) {
    // Boot ist draußen: es kommt einfach nicht zurück
  } else if (state.boats[p.bootId]) {
    events.push(...sim.unstationBoat(state, ctx, p.bootId).events);
  }
  delete d.plaetze[platzId];
  events.push({ type: 'dauerAufgehoben', boatId: p.bootId, berthId: platzId });
  return { ok: true, events };
}

/** Ist das Boot gerade auf mehrtägigem Törn? Dann bis zu welcher Nacht? */
export function draussenBis(state, platzId) {
  const p = dauerState(state).plaetze[platzId];
  return p && p.boot ? p.rueckNacht : null;
}

/**
 * Zusätzliche Passregel (Hook 'fit'): Ein Gast darf auf einen Dauerplatz, dessen Boot auf Törn ist,
 * wenn er spätestens in der Nacht abreist, in der das Boot zurückkommt.
 * Ein Gast, der heute (Tag D) kommt und n Nächte bleibt, reist in der Nacht von Tag D + n - 1 ab.
 */
export function fitHook({ state, boat, berth }) {
  const p = dauerState(state).plaetze[berth.id];
  if (!p || boat.stationed) return null;
  if (!p.boot) return 'dauer';   // sollte nicht vorkommen: Platz ist dann ohnehin belegt
  const abreiseNacht = state.day + (boat.nights ?? 1) - 1;
  return abreiseNacht <= p.rueckNacht ? null : 'dauerZurueck';
}

/** Abends: Wer heute nur eine Runde draußen war, ist zurück (Hook 'evening'). */
export function abendHook({ state, events }) {
  for (const [platzId, p] of Object.entries(dauerState(state).plaetze)) {
    if (p.tagestoern) {
      p.tagestoern = false;
      events.push({ type: 'dauerEinlaufen', boatId: p.bootId, berthId: platzId, tagestoern: true });
    }
  }
}

/**
 * Nachts (Hook 'night', nach der Abreise der Gäste): Törn-Boote kommen zurück, andere brechen auf.
 * Was hier als Auslaufen gemeldet wird, sieht man am nächsten Morgen.
 */
export function nachtHook({ state, events }) {
  const d = dauerState(state);
  for (const [platzId, p] of Object.entries(d.plaetze)) {
    if (p.boot) {
      if (p.rueckNacht > state.day) continue;
      if (!sim.isFree(state, platzId)) { p.rueckNacht = state.day + 1; continue; }   // Gast liegt noch da
      const boot = p.boot;
      boot.status = 'moored';
      boot.berthId = platzId;
      state.boats[boot.id] = boot;
      state.berths[platzId] = boot.id;
      p.boot = null;
      p.rueckNacht = null;
      events.push({ type: 'dauerEinlaufen', boatId: boot.id, berthId: platzId, tagestoern: false });
      continue;
    }
    const boot = state.boats[p.bootId];
    if (!boot) { delete d.plaetze[platzId]; continue; }   // Spielstand passt nicht mehr, Platz freigeben
    const wurf = random(state);
    if (wurf < DAUER.toernChance) {
      const tage = randomInt(state, DAUER.toernTage[0], DAUER.toernTage[1]);
      delete state.berths[platzId];
      delete state.boats[boot.id];
      boot.status = 'away';
      p.boot = boot;
      p.rueckNacht = state.day + tage;   // weg an den Tagen day+1 .. day+tage, zurück in deren letzter Nacht
      events.push({ type: 'dauerAuslaufen', boatId: boot.id, berthId: platzId, tage });
    } else if (wurf < DAUER.toernChance + DAUER.tagestoernChance) {
      p.tagestoern = true;
      events.push({ type: 'dauerAuslaufen', boatId: boot.id, berthId: platzId, tage: 0 });
    }
  }
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook) {
  const ab = [addHook('fit', fitHook), addHook('evening', abendHook), addHook('night', nachtHook)];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------------------
// Im Browser: Schilder an den Plätzen und Infokarte beim Antippen eines Platzes

const GRUEN = '#3fae5a';
const ROT = '#d9534f';

export async function init(game) {
  if (!game.sim) {
    // bridge.js lädt die Bootsdaten asynchron; auf die Regeln warten
    await new Promise((resolve) => {
      const off = game.on('sim:change', () => { off(); resolve(); });
      if (game.sim) { off(); resolve(); }
    });
  }
  const api = game.sim;
  haengeEin(api.addHook);

  // Deutsche Ereignisse für Grafik und Ton
  game.on('sim:dauerAuslaufen', (e) => game.emit('dauer:auslaufen', { id: e.boatId, platzId: e.berthId, tage: e.tage }));
  game.on('sim:dauerEinlaufen', (e) => game.emit('dauer:einlaufen', { id: e.boatId, platzId: e.berthId }));

  const { HAFEN, platzInWelt } = await import('../data/harbor.js');
  const platzDaten = Object.fromEntries(HAFEN.plaetze.map((p) => [p.id, p]));
  const THREE = game.THREE;

  // Schild: Pfahl mit Tafel, die Tafel zeigt grün (frei für Gäste) oder rot (Boot ist da)
  const gruppe = new THREE.Group();
  gruppe.name = 'dauerlieger-schilder';
  game.scene.add(gruppe);
  const pfahlGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 6);
  const tafelGeo = new THREE.BoxGeometry(1.1, 0.7, 0.08);
  const pfahlMat = new THREE.MeshLambertMaterial({ color: '#f4efe4' });
  const gruenMat = new THREE.MeshLambertMaterial({ color: GRUEN });
  const rotMat = new THREE.MeshLambertMaterial({ color: ROT });
  const schilder = new Map();

  function schildFuer(platzId) {
    let s = schilder.get(platzId);
    if (s) return s;
    const lage = platzDaten[platzId] && platzInWelt(platzDaten[platzId], api.state.stage);
    if (!lage) return null;
    s = new THREE.Group();
    const pfahl = new THREE.Mesh(pfahlGeo, pfahlMat);
    pfahl.position.y = 1.0;
    const tafel = new THREE.Mesh(tafelGeo, rotMat);
    tafel.position.y = 1.9;
    s.add(pfahl, tafel);
    s.userData.tafel = tafel;
    // Am Kopfende des Platzes (Stegseite), leicht versetzt
    const laenge = (platzDaten[platzId].laenge ?? 8) / 2;
    s.position.set(lage.x - Math.cos(lage.winkel) * laenge, 0, lage.z + Math.sin(lage.winkel) * laenge);
    s.rotation.y = lage.winkel;
    s.userData.pick = { type: 'berth', id: platzId };
    gruppe.add(s);
    schilder.set(platzId, s);
    return s;
  }

  function zeichne() {
    const d = dauerState(api.state);
    for (const [id, s] of schilder) {
      if (!d.plaetze[id]) { gruppe.remove(s); schilder.delete(id); }
    }
    for (const [id, p] of Object.entries(d.plaetze)) {
      const s = schildFuer(id);
      if (s) s.userData.tafel.material = p.boot ? gruenMat : rotMat;
    }
    if (offenerPlatz) karte(offenerPlatz);
  }
  game.on('sim:change', zeichne);
  game.on('stufe', () => { for (const s of schilder.values()) gruppe.remove(s); schilder.clear(); zeichne(); });

  // Infokarte für einen Platz. Die Karte gehört hud.js; wir nutzen sie nur, wenn sie frei ist.
  const card = document.getElementById('card');
  let offenerPlatz = null;
  const anteil = Math.round((api.ctx.rules.stationedFeeShare ?? 0.5) * 100);

  function knopf(text, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud-btn';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function zeile(text, klasse) {
    const p = document.createElement('p');
    if (klasse) p.className = klasse;
    p.textContent = text;
    return p;
  }

  function schliessen() {
    if (!offenerPlatz) return;
    offenerPlatz = null;
    card.hidden = true;
    card.replaceChildren();
    document.body.classList.remove('card-open');
  }

  function karte(platzId) {
    const st = api.state;
    const p = dauerState(st).plaetze[platzId];
    const k = kannDauerplatz(st, api.ctx, platzId);
    // Nur Plätze mit etwas zu tun bekommen eine Karte: kein toter Inhalt
    const behalten = !p && kannBehalten(st, api.ctx, platzId);
    if (!p && !k.ok && !behalten) { schliessen(); return false; }
    offenerPlatz = platzId;
    const teile = [zeile(`Liegeplatz ${platzId}`, 'card-title')];
    const aktionen = document.createElement('div');
    aktionen.className = 'card-actions';
    if (p) {
      const boot = p.boot || st.boats[p.bootId];
      teile.push(zeile(`Dauerplatz: ${boot?.bootsname ? `„${boot.bootsname}“, ${boot.name}` : boot?.name ?? 'Boot'}`));
      if (p.boot) {
        const bisTag = p.rueckNacht + 1;
        teile.push(zeile(`Grün: auf Törn, zurück an Tag ${bisTag}. Frei für Gäste, die vorher abreisen.`, 'card-note'));
      } else {
        teile.push(zeile(`Rot: Boot liegt hier. Zahlt jeden Abend ${anteil} % des Gastpreises.`, 'card-note'));
      }
      aktionen.append(knopf('Dauerplatz aufheben', () => {
        const r = hebeAuf(st, api.ctx, platzId);
        api.dispatch(r.events);
        schliessen();
      }));
    } else if (behalten) {
      const boot = st.boats[st.berths[platzId]];
      teile.push(zeile(`${boot.bootsname ? `„${boot.bootsname}“` : boot.name} ist zum ${boot.besuche}. Mal hier.`));
      teile.push(zeile(`Als Dauerlieger bleibt das Boot hier und zahlt jeden Abend ${anteil} % des Gastpreises.`, 'card-note'));
      aktionen.append(knopf('Als Dauerlieger behalten', () => {
        const r = behalte(st, api.ctx, platzId);
        api.dispatch(r.events);
      }));
    } else {
      teile.push(zeile(`Dauerplatz: ein festes Boot zahlt jeden Abend ${anteil} % des Gastpreises, ohne Zuweisen. Ist es auf Törn, dürfen Gäste hier liegen.`));
      aktionen.append(knopf('Zum Dauerplatz machen', () => {
        const r = machDauerplatz(st, api.ctx, platzId);
        api.dispatch(r.events);
      }));
    }
    aktionen.append(knopf('Schließen', schliessen));
    teile.push(aktionen);
    card.replaceChildren(...teile);
    card.hidden = false;
    document.body.classList.add('card-open');
    return true;
  }

  game.on('tap', ({ pick } = {}) => {
    if (pick?.type !== 'berth') { if (offenerPlatz && pick?.type) schliessen(); return; }
    // Ist ein Boot ausgewählt, weist bridge.js zu; dann keine Platzkarte
    if (api.selected != null) return;
    karte(String(pick.id));
  });
  game.on('sim:select', ({ boatId }) => { if (boatId != null) offenerPlatz = null; });
  game.on('ui:cancel', schliessen);
  game.on('spielstand-geladen', () => { schliessen(); zeichne(); });
  zeichne();

  game.dauerlieger = { machDauerplatz: (id) => api.dispatch(machDauerplatz(api.state, api.ctx, id).events), hebeAuf: (id) => api.dispatch(hebeAuf(api.state, api.ctx, id).events), karte };
}
