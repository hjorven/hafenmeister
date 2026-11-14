// Richtungsgebundene Freigabe fuer Engstellen (aus Jorvens Engpass-Patch uebernommen).
// Gleichgerichtete Boote duerfen als kleiner Konvoi passieren; Gegenverkehr wartet,
// bis der aktuelle Konvoi die Engstelle verlassen hat. Reihenfolge nach Ankunft (FIFO).
// Anders als im Patch gilt die Freigabe nur, solange das Boot in der Engstelle ist, nicht fuer die
// ganze Fahrt; welche Stellen eng sind, ergibt sich aus der Karte (world/fahrwasser.js).
export class ChannelLock {
  constructor(maxKonvoi = 3) {
    this.maxKonvoi = Math.max(1, maxKonvoi | 0);
    this.richtung = null;
    this.aktiv = new Set();
    this.queue = [];
  }

  // bild: laufende Nummer des Bildes (game.boatAnim.frame). Wartende fragen jedes Bild neu; wer
  // ein paar Bilder lang nicht mehr fragt (Boot entfernt, Weg neu geplant, Wartezeit abgelaufen),
  // faellt aus der Schlange und haelt den Gegenverkehr nicht mehr auf.
  request(boat, richtung = 'ein', bild = null) {
    if (this.aktiv.has(boat)) return true;
    if (bild != null) this.queue = this.queue.filter((e) => e.boat === boat || e.bild == null || bild - e.bild <= 20);
    const q = this.queue.find((e) => e.boat === boat);
    if (!q) this.queue.push({ boat, richtung, bild });
    else { q.richtung = richtung; q.bild = bild; }

    // Ist die Engstelle leer, bestimmt das aelteste wartende Boot die Fahrtrichtung.
    if (this.aktiv.size === 0 && this.queue.length) this.richtung = this.queue[0].richtung;

    // Gleiche Richtung wie der laufende Konvoi: darf mitfahren, solange vor ihm in der Schlange
    // kein Boot der Gegenrichtung wartet (niemand ueberholt den Gegenverkehr).
    if (richtung !== this.richtung) return false;
    if (this.aktiv.size >= this.maxKonvoi) return false;
    for (const e of this.queue) {
      if (e.boat === boat) break;
      if (e.richtung !== richtung) return false;
    }
    this.queue.splice(this.queue.findIndex((e) => e.boat === boat), 1);
    this.aktiv.add(boat);
    return true;
  }

  release(boat) {
    this.aktiv.delete(boat);
    const i = this.queue.findIndex((q) => q.boat === boat);
    if (i !== -1) this.queue.splice(i, 1);
    if (this.aktiv.size === 0) this.richtung = null;
  }

  get leer() { return this.aktiv.size === 0 && this.queue.length === 0; }
}

/** Alle Engstellen eines Reviers: je Nummer eine Freigabe. */
export class Engstellen {
  constructor(maxKonvoi = 3) { this.maxKonvoi = maxKonvoi; this.locks = new Map(); this.epoche = 0; }
  lock(nr) {
    let l = this.locks.get(nr);
    if (!l) { l = new ChannelLock(this.maxKonvoi); this.locks.set(nr, l); }
    return l;
  }
  request(nr, boat, richtung, bild = null) { return this.lock(nr).request(boat, richtung, bild); }
  release(nr, boat) { this.locks.get(nr)?.release(boat); }
  releaseAll(boat) { for (const l of this.locks.values()) l.release(boat); }
  /** Neue Karte (andere Stufe, neue Stege): alle Freigaben verfallen. */
  reset() { this.locks.clear(); this.epoche++; }
}
