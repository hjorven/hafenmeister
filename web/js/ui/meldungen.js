// Meldungs-Ordnung: Es steht höchstens eine schwebende Meldung zugleich im Bild, die wichtigste zuerst.
// Die anderen warten (ausgeblendet, ihre Zeit läuft nicht ab) und kommen danach.
//
// Wer eine Meldung zeigen will, meldet einen Wunsch an und fragt in seinem Takt, ob er gerade darf:
//   game.meldungen.wunsch(id, vorrang)   Meldung möchte stehen (erneut aufrufen ändert nur den Vorrang)
//   game.meldungen.fertig(id)            Meldung ist weg
//   game.meldungen.darf(id)              true, wenn diese Meldung jetzt stehen darf
//   Ereignis 'meldungen:wechsel'         ein Wunsch kam oder ging: jetzt neu fragen
// Fenster, die andere Module öffnen (Feier, Kartenwahl der Tagesziele, Tagesabschluss-Karte), zählen
// von selbst als Meldung mit ihrem Vorrang, solange sie sichtbar sind (FENSTER unten).
//
// Vorrang (höher geht vor): siehe VORRANG. Bei gleichem Vorrang bleibt, wer zuerst da war.
// Wo eine Meldung steht: Die kurzen Meldungen stehen alle an EINEM Platz, dem Meldeplatz (#hm-meldeplatz, unten).
// Tipps des Einstiegs zeigen mit Pfeil auf ihr Ziel und Fenster liegen, wo ihr Modul sie hinlegt.
//
// Meldeplatz (Jorven 14.11.: "Überall ist irgendwas, was deine Aufmerksamkeit haben will"):
//   Die Elemente in PLATZ (Ankündigung, Dauerplatz-Meldung, Morgen-Zettel, Bewertungen) werden in den
//   Meldeplatz umgehängt und sehen dort gleich aus. Es steht immer nur die vorderste, die anderen warten;
//   ein kleiner Zähler (+2) zeigt, wie viele noch kommen. Am Handy hochkant liegt der Platz unten über
//   Zeit und Bauen (Daumen, Spielfläche bleibt frei), sonst oben in der Mitte zwischen den Spalten.

export const VORRANG = {
  feier: 100,          // features/aufstieg.js, #hm-feier
  kartenwahl: 90,      // features/tagesziele.js, Kartenwahl am Morgen
  abschluss: 80,       // ui/tagesabschluss.js, Karte
  winter: 75,          // features/winter.js, Winterpause und Frühlingsgruß
  zettel: 70,          // ui/tagesabschluss.js, Morgen-Zettel
  dauerWartet: 65,     // features/dauerlieger.js, Dauerlieger früher zurück (hat eine Frist bis zum Abend)
  einstieg: 50,        // features/einstieg.js, Schritte des Einstiegs
  ankuendigung: 55,    // events/banner.js, Ereignisse und Saison ("Heute: Sommertag", "Morgen: Regatta")
  tipp: 45,            // features/einstieg.js, Tipps beim ersten Mal (kurz, gehen den Dauerplatz-Meldungen vor)
  dauer: 40,           // features/dauerlieger.js, andere Meldungen
  logbuch: 22,         // ui/logbuch.js, neues Bootsmodell im Logbuch (kurz)
  gaestebuch: 20,      // ui/gaestebuch.js, Bewertung eines Boots außerhalb des Bildes (kurz)
  bautipp: 10,         // ui/bauen.js, "Als Nächstes" (hält dieses Modul selbst, solange #bau-tipp nicht hidden ist)
};

/** Fenster anderer Module, die als Meldung zählen, solange sie sichtbar sind. */
export const FENSTER = [
  { id: 'feier', sel: '#hm-feier', vorrang: VORRANG.feier },
  { id: 'kartenwahl', sel: '.hm-tafel > ul.tz-wahl', vorrang: VORRANG.kartenwahl },
  { id: 'abschluss', sel: '#hm-tagesabschluss', vorrang: VORRANG.abschluss },
];

/** Kurze Meldungen, die im Meldeplatz stehen: Element und id ihres Wunschs */
export const PLATZ = [
  { sel: '#event-banner', id: 'ankuendigung' },
  { sel: '#dauer-hinweis', id: 'dauer' },
  { sel: '#hm-ta-zettel', id: 'zettel' },
  { sel: '#hm-gb-meldungen', id: 'gaestebuch' },
  { sel: '#hm-lb-meldung', id: 'logbuch' },
  // passiv: das Modul kennt die Meldungs-Ordnung nicht; der Platz meldet den Wunsch selbst an
  // (solange das Element nicht hidden ist) und blendet es mit .zurueck aus, wenn es warten muss
  { sel: '#bau-tipp', id: 'bautipp', passiv: VORRANG.bautipp },
];

/**
 * Welche Meldung darf stehen? wuensche: [{ id, vorrang, seit }]. Gibt die id zurück (oder null).
 * Höchster Vorrang gewinnt, bei Gleichstand der ältere Wunsch.
 */
export function waehle(wuensche) {
  let best = null;
  for (const w of wuensche) {
    if (!best || w.vorrang > best.vorrang || (w.vorrang === best.vorrang && w.seit < best.seit)) best = w;
  }
  return best ? best.id : null;
}

export function init(game) {
  const wuensche = new Map();   // id -> { id, vorrang, seit }
  let zaehler = 0;

  const sichtbar = (e) => {
    if (!e || e.hidden || e.closest('[hidden]')) return false;
    const c = getComputedStyle(e);
    if (c.display === 'none' || c.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function alle() {
    const liste = [...wuensche.values()];
    if (typeof document !== 'undefined') {
      for (const f of FENSTER) {
        if (wuensche.has(f.id)) continue;
        if ([...document.querySelectorAll(f.sel)].some(sichtbar)) liste.push({ id: f.id, vorrang: f.vorrang, seit: -1 });
      }
    }
    return liste;
  }

  // Sofort Bescheid geben, nicht erst im nächsten Bild: nach langem Vorspulen kommen Bilder oft verspätet
  const wechsel = () => game.emit?.('meldungen:wechsel', {});

  // Fenster mit kleinerem Vorrang warten ausgeblendet, solange ein wichtigeres steht (z. B. die Kartenwahl
  // der Tagesziele hinter der Feier). Dafür trägt body das Merkmal data-hm-meldung mit der stehenden Meldung.
  if (typeof document !== 'undefined') {
    const regeln = FENSTER.map((f) => {
      const hoeher = FENSTER.filter((g) => g.vorrang > f.vorrang).map((g) => `body[data-hm-meldung="${g.id}"] ${f.sel}`);
      return hoeher.length ? `${hoeher.join(',\n')} { visibility: hidden !important; pointer-events: none !important; }` : '';
    }).filter(Boolean);
    const style = document.createElement('style');
    style.textContent = regeln.join('\n');
    document.head.append(style);
    const merke = () => {
      const steht = waehle(alle()) || '';
      if ((document.body.dataset.hmMeldung || '') !== steht) {
        if (steht) document.body.dataset.hmMeldung = steht; else delete document.body.dataset.hmMeldung;
      }
    };
    setInterval(merke, 250);
    for (const name of ['meldungen:wechsel', 'feier:auf', 'feier:zu']) game.on?.(name, merke);
  }

  // ---------------------------------------------------------------- Meldeplatz
  let platz = null;
  let zahl = null;
  if (typeof document !== 'undefined') {
    platz = document.createElement('div');
    platz.id = 'hm-meldeplatz';
    platz.setAttribute('role', 'region');
    platz.setAttribute('aria-label', 'Meldungen');
    zahl = document.createElement('span');
    zahl.className = 'hm-meldeplatz-zahl';
    zahl.hidden = true;
    zahl.setAttribute('aria-hidden', 'true');
    platz.append(zahl);
    (document.getElementById('game') ?? document.body).append(platz);
  }
  const ids = new Set(PLATZ.map((p) => p.id));
  const passiv = new Set(PLATZ.filter((p) => p.passiv).map((p) => p.id));
  function umhaengen() {
    for (const p of PLATZ) {
      const e = document.querySelector(p.sel);
      if (e && e.parentNode !== platz) platz.insertBefore(e, zahl);
      if (!p.passiv) continue;
      if (e && !e.hidden) game.meldungen.wunsch(p.id, p.passiv); else game.meldungen.fertig(p.id);
      if (e) e.classList.toggle('zurueck', !e.hidden && !game.meldungen.darf(p.id));
    }
  }
  const rechteck = (sel) => [...document.querySelectorAll(sel)].filter(sichtbar).map((e) => e.getBoundingClientRect());
  // Lage: oben in der Lücke zwischen linker Spalte und rechten Meldungen, wenn sie breit genug ist,
  // sonst unten über den Knöpfen (Handy hochkant).
  function lege() {
    if (!platz) return;
    umhaengen();
    const h = platz.parentNode.getBoundingClientRect();
    const rand = 8;
    const links = Math.max(0, ...rechteck('#hm-seite > *').map((r) => r.right - h.left));
    const oben = Math.max(0, ...rechteck('#hud-top .hm-status, #hud-top .hm-werkzeuge').map((r) => r.bottom - h.top));
    const breite = Math.min(440, h.width - 2 * (links + rand));
    const unten = breite < 300;
    platz.classList.toggle('unten', unten);
    // Auch für die Tipps des Einstiegs (features/einstieg.js), die am Handy an derselben Stelle stehen
    if ((document.body.dataset.hmMeldeplatz || '') !== (unten ? 'unten' : 'oben')) document.body.dataset.hmMeldeplatz = unten ? 'unten' : 'oben';
    const wurzel = document.documentElement.style;
    if (unten) {
      const knoepfe = rechteck('#hm-zeit, #btn-build, #btn-collect, #hud-bottom .hm-px');
      const kante = knoepfe.length ? Math.min(...knoepfe.map((r) => r.top)) : h.bottom;
      wurzel.setProperty('--hm-mp-unten', `${Math.round(h.bottom - kante + rand)}px`);
      wurzel.setProperty('--hm-mp-breite', `${Math.round(Math.min(440, h.width - 2 * 12))}px`);
    } else {
      wurzel.setProperty('--hm-mp-oben', `${Math.round(oben + rand)}px`);
      wurzel.setProperty('--hm-mp-breite', `${Math.round(breite)}px`);
    }
    // Zähler: wie viele kurze Meldungen außer der stehenden noch warten
    const liste = alle();
    const steht = waehle(liste);
    // "Als Nächstes" (passiv) ist ein stehender Rat, keine wartende Meldung: zählt nicht mit
    const n = liste.filter((w) => ids.has(w.id) && w.id !== steht && !passiv.has(w.id)).length;
    const zeigt = ids.has(steht) && n > 0;
    zahl.hidden = !zeigt;
    if (zeigt && zahl.textContent !== `+${n}`) zahl.textContent = `+${n}`;
    platz.dataset.steht = ids.has(steht) ? steht : '';
  }
  if (platz) {
    setInterval(lege, 250);
    game.on?.('meldungen:wechsel', () => requestAnimationFrame(lege));
    window.addEventListener('resize', lege);
    game.on?.('ready', lege);
  }

  game.meldungen = {
    /** Der gemeinsame Meldeplatz (oder null ohne DOM) */
    platz: () => platz,
    VORRANG,
    imPlatz: (e) => !!platz && !!e && e.parentNode === platz,
    /**
     * Ein Modul hängt seine kurze Meldung in den Meldeplatz: anmelden('#mein-schild', 'meine-id').
     * Es bleibt bei wunsch/darf/fertig mit dieser id und blendet sein Element aus, solange darf() nein sagt
     * (hidden oder Klasse .zurueck). Lage und Breite bestimmt der Platz; eigene Lage-Rechnung kann entfallen
     * (game.meldungen.imPlatz(el) ist dann true). passiv: Vorrang, wenn der Platz den Wunsch selbst führen soll.
     */
    anmelden(sel, id, { passiv: p } = {}) {
      if (PLATZ.some((x) => x.sel === sel)) return;
      PLATZ.push({ sel, id, passiv: p });
      ids.add(id);
      if (p != null) passiv.add(id);
      if (platz) lege();
    },
    wunsch(id, vorrang) {
      const alt = wuensche.get(id);
      if (alt) { if (alt.vorrang !== vorrang) { alt.vorrang = vorrang; wechsel(); } return; }
      wuensche.set(id, { id, vorrang, seit: ++zaehler });
      wechsel();
    },
    fertig(id) { if (wuensche.delete(id)) wechsel(); },
    darf(id) { return waehle(alle()) === id; },
    /** Wer steht (mit Vorrang) und wer wartet; vorrang ist -Infinity, wenn nichts steht */
    stand() {
      const liste = alle();
      const steht = waehle(liste);
      return { steht, vorrang: steht ? liste.find((w) => w.id === steht).vorrang : -Infinity, wartet: liste.map((w) => w.id) };
    },
  };
}
