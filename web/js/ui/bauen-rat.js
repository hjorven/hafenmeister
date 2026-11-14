// Reine Rechenteile fuer ui/bauen.js (ohne DOM und Three.js, damit tests/bauen.test.mjs sie pruefen kann):
// Wirkung eines Services als Satz und die Wahl des naechsten sinnvollen Schritts.
import { ECONOMY } from '../data/economy.js';
import { WUNSCH_TEXTE } from '../data/wuensche-texte.js';

export const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
export const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Namen aller Wünsche, auch der Angebote an Land (P19), aus data/wuensche-texte.js
export const WUNSCH = Object.fromEntries(Object.entries(WUNSCH_TEXTE).map(([k, t]) => [k, t.mit]));
export const WUNSCH_KURZ = Object.fromEntries(Object.entries(WUNSCH_TEXTE).map(([k, t]) => [k, t.kurz]));
export const FREI = {
  allesKassieren: 'Der Knopf „Kassieren“ streicht alle Münzen auf einmal ein. Bis dahin streichst du jede Münze selbst.',
  vorschau: 'Funk: Du siehst die nächsten drei Boote mit Größe, Ankunftszeit und Wünschen.',
  sofortKassieren: 'Der Automat kassiert das Liegegeld kleiner und mittlerer Boote (S, M) selbst, sobald sie festgemacht haben. Große Boote zahlen persönlich: Holst du ihre Münze ab, gibt es Trinkgeld.',
  vorschlag: 'Das Büro schlägt für jedes Boot die beste Box vor (goldene Raute). Ein Tipp auf „Vorschlag annehmen“ genügt.',
  nebenkosten: `Das Büro rechnet Strom, Wasser und Duschen ab: Auf jedes Liegegeld kommen ${Math.round((ECONOMY.hafenbuero?.nebenkosten?.anteil ?? 0) * 100)} % dazu.`,
  automatik: 'Das Büro weist Standardboote selbst zu, je Größe abschaltbar. Mehrrumpfboote, große Schiffe, Sondergäste und Boote, für die nur eine Box passt, bleiben bei dir: Über ihnen schwebt eine orange Raute.',
  vorspulen3: 'Dreifach vorspulen.',
};

// Wirkung eines Services in einem Satz, aus den Feldern in data/economy.js
export function wirkungText(w = {}) {
  const t = [];
  if (w.proTag) t.push(`bringt ${euro(w.proTag)} pro Saisontag`);
  if (w.kunden) t.push(`${Math.round(w.kunden.anteil * 100)} % der Gäste kaufen für ${euro(w.kunden.preis)}`);
  for (const [k, f] of Object.entries(w.gaeste ?? {})) if (f > 1) t.push(`${Math.round((f - 1) * 100)} % mehr Boote der Größe ${k}`);
  if (w.hafengeld?.segel > 1) t.push(`Segelboote zahlen ${Math.round((w.hafengeld.segel - 1) * 100)} % mehr Hafengeld`);
  if (w.winter?.proTag) t.push(`im Winter ${euro(w.winter.proTag)} pro Tag`);
  // Tagesgaeste bekommen bewusst keine eigene Zahl (Entscheidung Jorven 2026-11-11)
  if (w.tagesgaeste) t.push('lockt Besucher auf die Promenade');
  if (w.sturmschutz) t.push('hilft bei Sturm, der Ruf leidet nicht');
  if (w.regatta) t.push('macht Regatten möglich');
  if (!t.length) return '';
  const s = t.join(', ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}

export const leer = () => ({ weg: 0, offen: {}, belegt: 0, plaetze: 0, abend: false });

/**
 * Naechster sinnvoller Schritt aus der Lage. Reine Funktion, damit sie ohne Browser testbar ist.
 * lage = { geld, eintraege, bedarf, stufe: { goal, ok, guests, reputation, missing } }
 * Liefert { text, ziel, leistbar } oder null.
 */
export function waehleSchritt({ geld, eintraege, bedarf, stufe, region = null }) {
  const offen = eintraege.filter((e) => !e.gesperrt);
  const leistbar = (e) => e.kosten <= geld;
  const guenstigste = (liste) => [...liste].sort((a, b) => (leistbar(b) - leistbar(a)) || a.kosten - b.kosten)[0];
  // Bei Platzmangel: von dem, was sich leisten laesst, das mit den meisten Plaetzen
  const meistePlaetze = (liste) => [...liste].sort((a, b) => (leistbar(b) - leistbar(a)) || (leistbar(a) ? b.plaetzeNeu - a.plaetzeNeu : 0) || a.kosten - b.kosten)[0];
  const mit = (e, text) => ({ text: leistbar(e) ? text : `${text} Noch ${euro(e.kosten - geld)} sparen.`, ziel: e.key, leistbar: leistbar(e) });

  // 1. Ausbaustufe bereit (bei Bauabschnitten reicht das Geld fuer den naechsten Abschnitt)
  const ausbau = eintraege.find((x) => x.key === 'hafen:stufe');
  const zielErreicht = stufe?.ok || ausbau?.begonnen || (ausbau?.gesamt && (stufe?.missing ?? []).every((m) => m === 'money'));
  if (ausbau && !ausbau.gesperrt && zielErreicht && leistbar(ausbau)) {
    return { text: `Alles bereit: ${ausbau.gesamt ? ausbau.name : stufe?.goal?.name ?? 'nächste Ausbaustufe'} bauen.`, ziel: ausbau.key, leistbar: true };
  }
  // 2. Kein Platz: Boote weggeschickt oder Hafen fast voll
  const stege = offen.filter((e) => e.art === 'steg');
  const voll = bedarf.plaetze > 0 && bedarf.belegt / bedarf.plaetze >= 0.85;
  if (stege.length && (bedarf.weg >= 2 || voll)) {
    const e = meistePlaetze(stege);
    const grund = bedarf.weg >= 2 ? `Zuletzt ${bedarf.weg} Boote weitergefahren.` : `Abends ${bedarf.belegt} von ${bedarf.plaetze} Plätzen belegt.`;
    return mit(e, `${grund} ${e.name} bringt ${e.plaetzeNeu === 1 ? 'einen Platz' : `${e.plaetzeNeu} Plätze`}.`);
  }
  // 3. Wuensche der Gaeste offen
  const wuensche = Object.entries(bedarf.offen).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  for (const [w, n] of wuensche) {
    const e = offen.find((x) => x.wunsch === w);
    if (e) return mit(e, `${n} Gäste wollten ${WUNSCH[w] ?? w}. ${e.name} hilft.`);
  }
  // 4. Grundversorgung fehlt ganz
  const basis = offen.find((e) => e.art === 'versorgung' && e.stufeNeu === 1 && e.wunsch !== 'strom');
  if (basis) return mit(basis, `Gäste wünschen sich ${WUNSCH[basis.wunsch] ?? basis.name}. ${basis.name} bauen.`);
  // 5. Ziel der Ausbaustufe
  if (stufe?.goal) {
    const e = eintraege.find((x) => x.key === 'hafen:stufe');
    const name = stufe.goal.name ?? 'nächsten Ausbaustufe';
    if (e?.gesperrt?.startsWith('Baustelle')) return { text: `Baustelle: ${e.name} wird über Nacht gebaut.`, ziel: e.key, leistbar: false };
    if (e?.begonnen) return { text: `Noch ${euro(e.kosten - geld)} sparen für ${e.name}.`, ziel: e.key, leistbar: false };
    if (stufe.missing.includes('guests')) return { text: `Noch ${stufe.goal.guests - stufe.guests} zufriedene Gäste bis zum ${name}.`, ziel: e?.key ?? null, leistbar: false };
    if (stufe.missing.includes('reputation')) {
      const w = wuensche[0];
      const tipp = w ? ` Gäste vermissen ${WUNSCH[w[0]]}.` : ' Wünsche der Gäste erfüllen hilft.';
      return { text: `Ruf ${num1(stufe.goal.reputation)} nötig für ${name}.${tipp}`, ziel: e?.key ?? null, leistbar: false };
    }
    if (e?.gesamt && zielErreicht) return { text: `Noch ${euro(e.kosten - geld)} sparen für ${e.name}.`, ziel: e.key, leistbar: false };
    if (stufe.missing.includes('money')) return { text: `Noch ${euro(stufe.goal.cost - geld)} sparen für ${name}.`, ziel: e?.key ?? null, leistbar: false };
  }
  // Letzte Stufe: das Abschlussziel der Region geht Kleinkram vor
  const rs = regionsSchritt(region);
  if (rs) return rs;
  // 6. Etwas Neues, das sich leisten laesst
  const neu = offen.filter((e) => leistbar(e)).sort((a, b) => a.kosten - b.kosten)[0];
  if (neu) return { text: `Neu im Bauplan: ${neu.name} für ${euro(neu.kosten)}.`, ziel: neu.key, leistbar: true };
  const spar = guenstigste(offen);
  if (spar) return mit(spar, `Als Nächstes: ${spar.name}.`);
  return null;
}

// Letzte Stufe, nichts mehr zu bauen: das Abschlussziel der Region (sim.regionGoal) als Hinweis
export function regionsSchritt(rg) {
  if (!rg?.active) return null;
  if (rg.done || rg.ok) return { text: 'Dein Seehafen ist fertig ausgebaut. Genieß den Trubel.', ziel: null, leistbar: false };
  const g = rg.goal ?? {};
  if (rg.missing.includes('berths')) return { text: `Noch ${rg.openBerths} ${rg.openBerths === 1 ? 'Platz' : 'Plätze'} bauen, dann ist der Hafen komplett.`, ziel: null, leistbar: false };
  if (rg.missing.includes('bigVisits')) {
    const n = (g.bigVisits || 0) - (rg.visits || 0);
    return { text: `Noch ${n} ${n === 1 ? 'Besuch' : 'Besuche'} großer Schiffe bis zum Abschluss. Kreuzfahrtschiffe und Flottenbesuche zählen.`, ziel: null, leistbar: false };
  }
  if (rg.missing.includes('reputation')) return { text: `Ruf ${num1(g.reputation)} erreichen: Wünsche der Gäste erfüllen.`, ziel: null, leistbar: false };
  return null;
}

// Hinweis im Baumenü vor dem Stufenausbau (Roadmap D4): was mit Booten auf umgebauten Plätzen passiert
export function umbauText(p) {
  if (!p) return null;
  const gone = p.gone?.length || 0;
  const gaeste = p.guests?.length || 0;
  const fest = p.fixed?.length || 0;
  const umlegen = p.moving?.length || 0;
  if (!gone && !umlegen) return null;
  const t = [];
  if (gone) t.push(`Beim Umbau fallen ${gone === 1 ? 'ein Platz' : `${gone} Plätze`} weg.`);
  if (gaeste) t.push(`${gaeste === 1 ? 'Ein Gast reist' : `${gaeste} Gäste reisen`} vorher ab und ${gaeste === 1 ? 'zahlt' : 'zahlen'} noch.`);
  if (fest) t.push(`${fest === 1 ? 'Ein Dauerlieger zieht' : `${fest} feste Boote ziehen`} auf einen freien Platz um.`);
  if (umlegen) t.push(`${umlegen === 1 ? 'Ein Boot legt' : `${umlegen} Boote legen`} in eine passende Box um.`);
  if (gone && !gaeste && !fest) t.push('Gerade liegt dort niemand.');
  return t.join(' ');
}
