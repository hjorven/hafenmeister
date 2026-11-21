// Flottillen (Paket P32, docs/flottillen.md): Texte und Arten. Zahlen stehen in data/economy.js
// (flottillen), die Gruppengröße je Bootsart im Feld `group` der Bootsdaten (data/boats/*.js).
// Diese Datei kennt weder Three.js noch das DOM.

/**
 * Wer als Flottille kommt, je Bootsart: Anlass (für Bootskarte und Funk) und ob alle dasselbe
 * Modell fahren (Charterflotten und Vereine mit gleichen Booten). Nur Arten mit group[1] >= 3.
 */
export const FLOTTILLEN_ARTEN = {
  S2: { anlass: 'Kanu-Wandergruppe', mehrzahl: 'Kanus', gleichesModell: true },
  M1: { anlass: 'Segelverein auf Geschwaderfahrt', mehrzahl: 'Kleinkreuzer', gleichesModell: false },
  M2: { anlass: 'Klassikertreffen', mehrzahl: 'Holzboote', gleichesModell: false },
  M3: { anlass: 'Motorbootclub auf Ausfahrt', mehrzahl: 'Kajütboote', gleichesModell: false },
  L1: { anlass: 'Charterflottille', mehrzahl: 'Yachten', gleichesModell: true },
  L3: { anlass: 'Motoryacht-Rallye', mehrzahl: 'Motoryachten', gleichesModell: false },
};

/** Namen der Flottillen (wie Vereins- und Charterflotten an der Küste heißen). */
export const FLOTTILLEN_NAMEN = [
  'Ostseewind', 'Möwenschar', 'Blaue Bucht', 'Sundfahrer', 'Haff-Geschwader', 'Nordlicht', 'Wellenreiter',
  'Kap Arkona', 'Bodden-Bummler', 'Fördeflotte', 'Seeschwalben', 'Hanse-Törn', 'Lotsenbrüder', 'Leuchtfeuer',
  'Strandhafer', 'Kompassrose', 'Glückauf', 'Achtern Wind', 'Kranich', 'Sturmvogel',
];
