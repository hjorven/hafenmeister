// Zusammenspiel 3 (P85): Kommt jedes Ereignis in einem normalen Spiel vor? Spielt den Ereignisplan
// (events/scheduler.js) für viele Spielstände über 110 Spieltage mit dem Aufstieg eines echten Spiels
// (Stufe 2 ab Tag 6, 3 ab 22, 4 ab 45, 5 ab 69, 6 ab 100; Zusammenspiel 1) und den Bauten, die ein
// Spieler bis dahin hat (Räucherei ab Tag 10, Segelclub ab Tag 30). Zählt je Ereignis: in wie vielen
// Spielen es vorkommt und wann zum ersten Mal.
//   node tools/zusammenspiel/ereignisse.mjs [--spiele 200]
import { createScheduler } from '../../web/js/events/scheduler.js';
import { EVENTS } from '../../web/js/data/events.js';

const i = process.argv.indexOf('--spiele');
const SPIELE = i > 0 ? Number(process.argv[i + 1]) : 200;
const stufeAm = (t) => (t >= 100 ? 6 : t >= 69 ? 5 : t >= 45 ? 4 : t >= 22 ? 3 : t >= 6 ? 2 : 1);
const statistik = Object.fromEntries(EVENTS.map((e) => [e.id, { spiele: 0, anzahl: 0, ersterTag: [] }]));
for (let seed = 1; seed <= SPIELE; seed++) {
  const s = createScheduler({ seed: seed * 7919 });
  const gesehen = new Set();
  for (let tag = 1; tag <= 110; tag++) {
    const buildings = { ...(tag >= 10 ? { raeucherei: 1 } : {}), ...(tag >= 30 ? { segelclub: 1 } : {}) };
    for (const c of s.advanceTo(tag, { stage: stufeAm(tag), buildings })) {
      if (c.type !== 'start') continue;
      const z = statistik[c.event.id];
      if (!z) continue;
      z.anzahl++;
      if (!gesehen.has(c.event.id)) { gesehen.add(c.event.id); z.spiele++; z.ersterTag.push(tag); }
    }
  }
}
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : '-'; };
console.log(`| Ereignis | in Spielen (von ${SPIELE}) | je Spiel im Mittel | erstes Mal (Median Tag) |`);
console.log('|---|---|---|---|');
for (const e of EVENTS) {
  const z = statistik[e.id];
  console.log(`| ${e.id} | ${z.spiele} | ${(z.anzahl / SPIELE).toFixed(1)} | ${median(z.ersterTag)} |`);
}
