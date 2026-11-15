// Doppelboxen (Roadmap P59, D5 und D6): Zwei nebeneinanderliegende Heckpfahl-Boxen eines Stegs lassen
// sich zu einer breiten Box zusammenlegen. In die breite Box passen Boote, die in keine einzelne Box
// passen, zum Beispiel Mehrrumpfboote (Katamarane, 6 bis 7,5 m breit). Beschreibung: docs/stege-umbauen.md.
//
// doppelboxenAnlegen(hafen) hängt für jedes feste Paar einen Platz an hafen.plaetze an:
//   { id: 'C01-02', art: 'box', doppel: ['C01', 'C02'], requires: 'doppel:C01-02', ... }
// Die beiden Einzelboxen bekommen ohne: ['doppel:C01-02']. Die Spielregeln (sim.berthAvailable) und die
// Stege (render/stege.js) zeigen so je nach state.buildings entweder die zwei schmalen oder die breite Box.
//
// Paare sind fest: Boxen desselben Stegs, derselben Klasse und Richtung, die in jeder Stufe, in der es
// beide gibt, Seite an Seite liegen. Von vorn nach hinten (nach id) wird jeweils das nächste freie Paar
// genommen, jede Box gehört höchstens zu einem Paar. Läuft am Ende von stegbildSetzen (data/stegbild.js),
// damit die Paare zum Stegbild des Spiels passen.

const NAH = 0.6;   // Planeinheiten Toleranz beim Nebeneinander

/** Liegen a und b in dieser Stufe Seite an Seite (gleiche Richtung, Abstand = halbe Breiten)? */
export function nebeneinander(a, b, stufe) {
  const la = a.lage?.[stufe], lb = b.lage?.[stufe];
  if (!la || !lb) return false;
  if (Math.abs(((la[2] - lb[2]) % 360 + 540) % 360 - 180) > 1) return false;
  const r = (la[2] * Math.PI) / 180;
  const dx = lb[0] - la[0], dy = lb[1] - la[1];
  const laengs = dx * Math.cos(r) + dy * Math.sin(r);       // entlang der Box (Bug-Richtung)
  const quer = -dx * Math.sin(r) + dy * Math.cos(r);        // quer, Richtung Nachbar
  return Math.abs(laengs) < NAH && Math.abs(Math.abs(quer) - (a.breite + b.breite) / 2) < NAH;
}

/** Feste Paare aus den Plätzen: [[a, b, stufen], ...] */
export function paareFinden(plaetze, klassen) {
  const boxen = plaetze.filter((p) => p.art === 'box' && !p.doppel && klassen.includes(p.klasse));
  const vergeben = new Set();
  const paare = [];
  const sortiert = [...boxen].sort((a, b) => a.steg.localeCompare(b.steg) || a.id.localeCompare(b.id, 'de', { numeric: true }));
  for (const a of sortiert) {
    if (vergeben.has(a.id)) continue;
    for (const b of sortiert) {
      if (b === a || vergeben.has(b.id) || b.steg !== a.steg || b.klasse !== a.klasse) continue;
      const gemeinsam = a.stufen.filter((s) => b.stufen.includes(s));
      if (!gemeinsam.length || !gemeinsam.every((s) => nebeneinander(a, b, String(s)))) continue;
      vergeben.add(a.id).add(b.id);
      paare.push([a, b, gemeinsam]);
      break;
    }
  }
  return paare;
}

export function doppelId(a, b) {
  return `${a.id}-${b.id.slice(b.steg.length)}`;
}

/**
 * Doppelboxen an hafen.plaetze anhängen. regeln = ECONOMY.doppelbox ({ klassen, maxBreite }).
 * Ruft man es noch einmal auf (anderes Stegbild), entstehen die Doppelboxen neu.
 */
export function doppelboxenAnlegen(hafen, regeln) {
  // Vorherige Doppelboxen weg (anderes Stegbild): Paare und Lagen neu aus den Einzelboxen
  hafen.plaetze = hafen.plaetze.filter((p) => !p.doppel);
  for (const p of hafen.plaetze) {
    if (!p.ohne) continue;
    p.ohne = p.ohne.filter((k) => !k.startsWith('doppel:'));
    if (!p.ohne.length) delete p.ohne;
  }
  if (!regeln) return [];
  const neu = [];
  for (const [a, b, stufen] of paareFinden(hafen.plaetze, regeln.klassen ?? ['L'])) {
    const id = doppelId(a, b);
    const key = `doppel:${id}`;
    const lage = {};
    const tiefe = {};
    for (const s of stufen) {
      const la = a.lage[s], lb = b.lage[s];
      lage[s] = [(la[0] + lb[0]) / 2, (la[1] + lb[1]) / 2, la[2]];
      tiefe[s] = Math.min(a.tiefe?.[s] ?? Infinity, b.tiefe?.[s] ?? Infinity);
    }
    const p = {
      id, steg: a.steg, klasse: a.klasse, art: 'box',
      laenge: Math.min(a.laenge, b.laenge), breite: a.breite + b.breite,
      maxLaenge: Math.min(a.maxLaenge, b.maxLaenge),
      maxBreite: Math.min(regeln.maxBreite ?? a.maxBreite + b.maxBreite, a.maxBreite + b.maxBreite),
      stufen: [...stufen], lage, tiefe,
      doppel: [a.id, b.id], requires: key,
    };
    for (const x of [a, b]) x.ohne = [...(x.ohne ?? []), key];
    hafen.plaetze.push(p);
    neu.push(p);
  }
  return neu;
}
