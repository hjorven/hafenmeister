// Härtetest (docs/extremtest.md): Bericht aus ergebnis.json.
// Auch einzeln aufrufbar, z. B. nach einem abgebrochenen Lauf:
//   node tests/extrem/bericht.cjs /tmp/extremtest

const fs = require('fs');
const path = require('path');

// Arten, die Fehler sind (Fund), und solche, die nur als Hinweis zählen
const NAMEN = {
  fehler: 'Konsole und Skriptfehler', land: 'Boot über Land', steg: 'Boot durch Steg', fest: 'Boote ineinander fest',
  ueberlapp: 'Liegende Boote überlappen', haengt: 'Boot hängt (5 Spielminuten still)', lange: 'Ein-/Auslaufen dauert zu lange',
  sim: 'Spielregeln', menschen: 'Mensch im Wasser', leinen: 'Leine ohne Boot oder ins Leere', xxl: 'Großschiff über Land',
  abgleich: 'Spiel und Bild uneinig', text: 'Kaputte Zahl oder Text in der Oberfläche', regeln: 'Spielstand widersprüchlich',
  ui: 'Bedienung verdeckt oder abgeschnitten', speichern: 'Speichern und Laden',
  boje: 'Gilt als an der Boje, ist dort aber nicht zu sehen (über 20 Spielsekunden)',
  beruehrt: 'Boote berühren sich kurz in Fahrt', pulk: 'Pulk (12+ fahrende Boote auf 45 m)',
};
const FUND = new Set(['boje', 'fehler', 'land', 'steg', 'fest', 'ueberlapp', 'haengt', 'lange', 'sim', 'menschen', 'leinen', 'xxl', 'abgleich', 'text', 'regeln', 'ui', 'speichern']);

function zaehle(E) {
  let f = 0, h = 0;
  for (const [art, m] of Object.entries(E.funde)) { const n = Object.keys(m).length; if (FUND.has(art)) f += n; else h += n; }
  return { f, h };
}

function schreibeBericht(out, G) {
  const L = [];
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  L.push('# Härtetest: Extremlagen im Spiel');
  L.push('');
  L.push(`Stand des Spiels: ${G.commit ?? 'unbekannt'}. Gelaufen ${G.start?.slice(0, 16).replace('T', ' ')} bis ${G.ende?.slice(0, 16).replace('T', ' ') ?? 'abgebrochen'} (UTC)${G.kurz ? ', Kurzfassung (--kurz)' : ''}. Spiel hat ${G.zahlen?.kuesten} Küstentypen und ${G.zahlen?.stegbilder} Stegbilder.`);
  L.push('');
  L.push('Funde sind Fehler, die nicht vorkommen dürfen. Hinweise sind in Extremlagen erwartbar (kurzes Berühren in Fahrt, Pulk), sollen aber nicht überhandnehmen. Jede Lage hat einen Bildbogen; wo ein Video steht, ist es dieselbe Bildserie als Film.');
  L.push('');
  L.push('## Übersicht');
  L.push('');
  L.push('| Gerät | Lage | Funde | Hinweise | Bilder/s (Median) | Dauer |');
  L.push('|---|---|---|---|---|---|');
  for (const [g, R] of Object.entries(G.geraete)) for (const E of R.lagen) {
    const { f, h } = zaehle(E);
    L.push(`| ${g} | ${E.titel}${E.variante ? ' (' + E.variante + ')' : ''} | ${f || '-'} | ${h || '-'} | ${median(E.fps.map((x) => x.fps)) ?? '-'} | ${E.dauerS ?? '?'} s${E.abbruch ? ', abgebrochen' : ''} |`);
  }
  L.push('');
  for (const [g, R] of Object.entries(G.geraete)) for (const E of R.lagen) {
    L.push(`## ${g}: ${E.titel}${E.variante ? ' (' + E.variante + ')' : ''}`);
    L.push('');
    L.push(`${E.was} Adresse: \`${E.adresse || '(neues Spiel)'}\`.`);
    L.push('');
    if (E.abbruch) { L.push(`**Abgebrochen:** ${E.abbruch}`); L.push(''); }
    const arten = Object.keys(E.funde).sort((a, b) => (FUND.has(b) - FUND.has(a)));
    if (!arten.length) L.push('Keine Funde, keine Hinweise.');
    for (const art of arten) {
      const m = E.funde[art]; const keys = Object.keys(m);
      L.push(`- **${FUND.has(art) ? 'Fund' : 'Hinweis'}: ${NAMEN[art] ?? art}** (${keys.length}):`);
      for (const k of keys.slice(0, 8)) L.push(`  - ${k} (${m[k].mal}x, zuerst ${m[k].erst}${m[k].p ? `, bei ${m[k].p.join('/')}` : ''})${m[k].trifft ? `, trifft ${m[k].trifft}` : ''}${m[k].bild ? ` [Nahbild](${m[k].bild})` : ''}`);
      if (keys.length > 8) L.push(`  - und ${keys.length - 8} weitere`);
    }
    for (const h of E.hinweise) L.push(`- Hinweis: ${h}`);
    L.push('');
    const mess = Object.entries(E.messungen);
    if (mess.length) {
      L.push('Messungen: ' + mess.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; '));
      L.push('');
    }
    if (E.verdeckung?.length) {
      L.push('| Tafel | bedeckt | vor allem |');
      L.push('|---|---|---|');
      for (const v of E.verdeckung) L.push(`| ${v.tafel} | ${Math.round(v.anteil * 100)} % | ${Object.entries(v.wer).map(([k, a]) => `${k} ${Math.round(a * 100)} %`).join(', ')} |`);
      L.push('');
    }
    if (E.speichern?.length) { L.push('Speichern und Laden: ' + E.speichern.map((s) => `${s.warum}: ${s.abweichungen.length ? s.abweichungen.join(', ') : 'gleich'}`).join('; ')); L.push(''); }
    if (E.bogen) L.push(`![Bildbogen](${E.bogen})`);
    if (E.video) L.push(`[Video](${E.video})`);
    L.push('');
  }
  fs.writeFileSync(path.join(out, 'bericht.md'), L.join('\n'));
}

module.exports = { schreibeBericht, zaehle, FUND, NAMEN };

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'extremtest'));
  schreibeBericht(out, JSON.parse(fs.readFileSync(path.join(out, 'ergebnis.json'), 'utf8')));
  console.log(path.join(out, 'bericht.md'));
}
