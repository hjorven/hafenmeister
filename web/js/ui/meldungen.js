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
// Wo eine Meldung steht, entscheidet ihr Modul selbst (nie über Knöpfen oder der linken Spalte).

export const VORRANG = {
  feier: 100,          // features/aufstieg.js, #hm-feier
  kartenwahl: 90,      // features/tagesziele.js, Kartenwahl am Morgen
  abschluss: 80,       // ui/tagesabschluss.js, Karte
  zettel: 70,          // ui/tagesabschluss.js, Morgen-Zettel
  dauerWartet: 65,     // features/dauerlieger.js, Dauerlieger früher zurück (hat eine Frist bis zum Abend)
  einstieg: 50,        // features/einstieg.js, Schritte des Einstiegs
  tipp: 45,            // features/einstieg.js, Tipps beim ersten Mal (kurz, gehen den Dauerplatz-Meldungen vor)
  dauer: 40,           // features/dauerlieger.js, andere Meldungen
  gaestebuch: 20,      // ui/gaestebuch.js, Bewertung eines Boots außerhalb des Bildes (rechts oben, kurz)
};

/** Fenster anderer Module, die als Meldung zählen, solange sie sichtbar sind. */
export const FENSTER = [
  { id: 'feier', sel: '#hm-feier', vorrang: VORRANG.feier },
  { id: 'kartenwahl', sel: '.hm-tafel > ul.tz-wahl', vorrang: VORRANG.kartenwahl },
  { id: 'abschluss', sel: '#hm-tagesabschluss', vorrang: VORRANG.abschluss },
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

  game.meldungen = {
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
