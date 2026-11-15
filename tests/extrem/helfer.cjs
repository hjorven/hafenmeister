// Härtetest (docs/extremtest.md): Helfer, die im Browser Extremlagen herstellen.
// Jede Funktion läuft mit page.evaluate im echten Spiel und nutzt nur die Schnittstellen,
// die das Spiel ohnehin hat (game.sim, game.events, game.services, sim.js als Modul).
// Nichts davon ist im Spiel selbst eingebaut; ohne diesen Test ändert sich am Spiel nichts.

// Installiert window.__ex mit allen Helfern. Muss nach jedem Laden einmal laufen.
const HELFER = async () => {
  const G = window.hafenmeister;
  const sim = await import('./js/sim.js');
  const S = G.sim; const st = () => S.state; const ctx = () => S.ctx;
  const dispatch = (ev) => { if (ev?.length) S.dispatch(ev); };

  // Neues Boot über die Würfel des Spiels (rollBoat), passend zu einem Platz, wenn einer genannt ist
  const wuerfle = (platz = null, versuche = 40) => {
    for (let i = 0; i < versuche; i++) {
      const b = sim.rollBoat(st(), ctx());
      if (!b) return null;
      if (!platz) return b;
      const berth = ctx().berthById[platz];
      if (sim.fits(b, berth, ctx().rules, st().stage) && !sim.hookWhyNotFit(st(), ctx(), b, berth)) return b;
    }
    return null;
  };

  const ex = {
    // n Boote kommen innerhalb von spanne Spielsekunden von See (normaler Weg: upcoming, arrive)
    boote(n, spanne = 30) {
      const s = st(); let k = 0;
      for (let i = 0; i < n; i++) {
        const b = wuerfle(); if (!b) break;
        b.id = s.nextId++;
        b.arriveAt = s.clock + 0.5 + (spanne * i) / Math.max(1, n);
        b.origin = sim.boatOrigin(s, s.day * 7 + i + 100);
        s.upcoming.push(b); k++;
      }
      s.upcoming.sort((a, b) => a.arriveAt - b.arriveAt);
      // Ankünfte nicht am Abend abschneiden: Uhr notfalls an den Vormittag
      return k;
    },
    // Alle freien Plätze belegen. liegen = true: Boote liegen sofort fest (Ansicht gleicht ab wie nach dem Laden),
    // sonst fahren alle gleichzeitig von ihren Bojen in die Boxen.
    fuellen(liegen = true, anteil = 1) {
      const s = st(); let k = 0; const ev = [];
      const frei = sim.availableBerths(s, ctx()).filter((b) => sim.isFree(s, b.id) && !b.reserved);
      for (const berth of frei) {
        if (anteil < 1 && Math.random() > anteil) continue;
        const b = wuerfle(berth.id); if (!b) continue;
        b.id = s.nextId++;
        b.origin = sim.boatOrigin(s, s.day * 7 + k + 300);
        b.status = 'waiting'; b.waitSpot = 0; b.waitingSince = s.clock; b.atBuoy = true; b.atBuoySince = s.clock;
        s.boats[b.id] = b; s.queue.push(b.id);
        const r = sim.assign(s, ctx(), b.id, berth.id, { hand: false });
        if (r.ok) { k++; ev.push(...r.events); } else { delete s.boats[b.id]; s.queue = s.queue.filter((x) => x !== b.id); }
      }
      if (liegen) { G.emit('sim:change', { reason: 'load' }); G.emit('sim:berthState', { plaetze: sim.berthStates(s, ctx()) }); }
      else dispatch(ev);
      return k;
    },
    // Alle liegenden Gäste reisen am nächsten Morgen fast gleichzeitig ab
    allesAblegen(fenster = [0.02, 0.05]) {
      const s = st(); let k = 0;
      for (const b of sim.mooredBoats(s)) if (!b.stationed && !b.trip?.away) { b.nights = 1; k++; }
      ex._fenster ??= ctx().rules.departWindow;
      ctx().rules.departWindow = fenster;
      return k;
    },
    fensterZurueck() { if (ex._fenster) ctx().rules.departWindow = ex._fenster; },
    // Bis zum nächsten Morgen vorspulen (wie der Winter-Test)
    naechsterMorgen() {
      const s = st(); const tag = s.day;
      for (let i = 0; i < 6 && s.day === tag; i++) S.fastForward(1e6);
      G.tagesabschluss?.schliesse?.();
      return s.day;
    },
    // Ereignis heute (und tage weitere Tage) erzwingen
    ereignis(id, tage = 1) {
      const d = st().day;
      G.events.load({ ...G.events.save(), current: { id, startDay: d, endDay: d + tage - 1 }, planned: null });
      G.emit('weather', G.events.weather(d));
      G.wetterEffekte?.sofort?.();
      return G.events.current?.id ?? null;
    },
    // Mehrere Ereignisse übereinander: läuft eines, ist das nächste angekündigt, ein großes geplant, ein Nachspiel offen
    uebereinander() {
      const d = st().day;
      G.events.load({ ...G.events.save(),
        current: { id: 'sturm', startDay: d, endDay: d + 1 },
        planned: { id: 'regatta', startDay: d + 2, endDay: d + 2, announcedDay: d },
        gross: { id: 'hansewoche', startDay: d + 3, endDay: d + 5, announcedDay: d },
        nachspiel: { id: 'nebel', startDay: d, endDay: d + 1 } });
      G.emit('weather', G.events.weather(d));
      G.wetterEffekte?.sofort?.();
      return { current: G.events.current?.id, planned: G.events.planned?.id, gross: G.events.gross?.id };
    },
    // Alle Großschiff-Besuche der gebauten Services auf morgen legen
    grossschiffeMorgen() {
      const morgen = st().day + 1; const ok = [];
      for (const x of G.services?.liste?.() ?? []) if (G.services.planeBesuch(x.id, morgen)) ok.push(x.id);
      return ok;
    },
    geld(v) { st().money = v; G.emit('sim:change', { reason: 'income' }); return st().money; },
    tempo(x) { if (G.oberflaeche?.tempo) G.oberflaeche.tempo(x); else G.speed = x; if (G.paused) G.setPaused(false); return G.speed; },
    // Testmodus (?stufe=n) in einen echten Spielstand verwandeln, damit Speichern und Laden gehen
    echterSpielstand() { st().testmodus = false; if (G.state) G.state.testmodus = false; return !!G.spielstand?.speichern?.(); },
    // Letzter Tag der Saison: einmal vorspulen ergibt den ersten Wintertag
    saisonEnde() { const s = st(); s.day = ctx().rules.seasonDays; return s.day; },
    zustand() {
      const s = st();
      return { tag: s.day, phase: s.phase, uhr: Math.round(s.clock), stufe: s.stage, geld: Math.round(s.money),
        boote: Object.keys(s.boats).length, liegend: sim.mooredBoats(s).length, wartend: s.queue.length, kommen: s.upcoming.length,
        anims: G.boatAnim?.boats?.length ?? 0, ereignis: G.events?.current?.id ?? null, winter: !!S.season()?.winter,
        menschen: G.people?.anzahl?.() ?? null, tempo: G.speed, pause: !!G.paused };
    },
  };
  window.__ex = ex;
  return true;
};

module.exports = { HELFER };
