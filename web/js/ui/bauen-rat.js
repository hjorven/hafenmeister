// Reine Rechenteile fuer ui/bauen.js (ohne DOM und Three.js, damit tests/bauen.test.mjs sie pruefen kann):
// Wirkung eines Services als Satz und die Wahl des naechsten sinnvollen Schritts.
export const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
export const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const WUNSCH = { wc: 'ein WC', dusche: 'eine Dusche', essen: 'etwas zu essen', diesel: 'Diesel', strom: 'Strom am Platz' };
export const WUNSCH_KURZ = { wc: 'WC', dusche: 'Dusche', essen: 'Essen', diesel: 'Diesel', strom: 'Strom' };
export const FREI = {
  allesKassieren: 'Ein Tipp auf „Kassieren“ streicht alle Münzen auf einmal ein.',
  automatik: 'Ankommende Boote werden automatisch auf einen passenden Platz gelotst und abends kassiert.',
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
export function waehleSchritt({ geld, eintraege, bedarf, stufe }) {
  const offen = eintraege.filter((e) => !e.gesperrt);
  const leistbar = (e) => e.kosten <= geld;
  const guenstigste = (liste) => [...liste].sort((a, b) => (leistbar(b) - leistbar(a)) || a.kosten - b.kosten)[0];
  // Bei Platzmangel: von dem, was sich leisten laesst, das mit den meisten Plaetzen
  const meistePlaetze = (liste) => [...liste].sort((a, b) => (leistbar(b) - leistbar(a)) || (leistbar(a) ? b.plaetzeNeu - a.plaetzeNeu : 0) || a.kosten - b.kosten)[0];
  const mit = (e, text) => ({ text: leistbar(e) ? text : `${text} Noch ${euro(e.kosten - geld)} sparen.`, ziel: e.key, leistbar: leistbar(e) });

  // 1. Ausbaustufe bereit
  if (stufe?.ok) {
    const e = eintraege.find((x) => x.key === 'hafen:stufe');
    if (e) return { text: `Alles bereit: ${stufe.goal.name ?? 'nächste Ausbaustufe'} bauen.`, ziel: e.key, leistbar: true };
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
    if (stufe.missing.includes('guests')) return { text: `Noch ${stufe.goal.guests - stufe.guests} zufriedene Gäste bis zum ${name}.`, ziel: e?.key ?? null, leistbar: false };
    if (stufe.missing.includes('reputation')) {
      const w = wuensche[0];
      const tipp = w ? ` Gäste vermissen ${WUNSCH[w[0]]}.` : ' Wünsche der Gäste erfüllen hilft.';
      return { text: `Ruf ${num1(stufe.goal.reputation)} nötig für ${name}.${tipp}`, ziel: e?.key ?? null, leistbar: false };
    }
    if (stufe.missing.includes('money')) return { text: `Noch ${euro(stufe.goal.cost - geld)} sparen für ${name}.`, ziel: e?.key ?? null, leistbar: false };
  }
  // 6. Etwas Neues, das sich leisten laesst
  const neu = offen.filter((e) => leistbar(e)).sort((a, b) => a.kosten - b.kosten)[0];
  if (neu) return { text: `Neu im Bauplan: ${neu.name} für ${euro(neu.kosten)}.`, ziel: neu.key, leistbar: true };
  const spar = guenstigste(offen);
  if (spar) return mit(spar, `Als Nächstes: ${spar.name}.`);
  return null;
}
