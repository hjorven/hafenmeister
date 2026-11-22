// Namen und Sätze aller Gästewünsche an einer Stelle (Roadmap P19). Zahlen stehen in economy.js
// (wuensche, angebotWunsch). Versorgung (wc, dusche, essen, diesel) und Strom am Platz kennt die
// Oberfläche schon lange; neu sind die Wünsche an Angebote an Land (P19 C3): erfüllt, sobald der
// Service gebaut ist. Kein Three.js, keine Oberfläche: Regeln, Tests und alle Fenster lesen hier.
//
//   kurz    für Listen und Chips ("Dusche", "Café")
//   mit     im Satz "wünscht sich ..." ("eine Dusche", "ein Café")
//   fehlt   Grund im Gästebuch ("keine Dusche")
//   lang    ausführlich ("Keine Dusche frei")
//   saetze  was der Gast ins Gästebuch schreibt, wenn es fehlte (Angebote und neue Wünsche aus P31)
//   service Angebot, das den Wunsch erfüllt (nur Angebotswünsche)

export const VERSORGUNG_TEXTE = {
  wc:     { kurz: 'WC',     mit: 'ein WC',          fehlt: 'kein WC',             lang: 'Kein WC in der Nähe' },
  dusche: { kurz: 'Dusche', mit: 'eine Dusche',     fehlt: 'keine Dusche',        lang: 'Keine Dusche frei' },
  essen:  { kurz: 'Essen',  mit: 'etwas zu essen',  fehlt: 'nichts zu essen',     lang: 'Nichts zu essen im Hafen' },
  strom:  { kurz: 'Strom',  mit: 'Strom am Platz',  fehlt: 'kein Strom am Platz', lang: 'Kein Strom am Liegeplatz' },
  diesel: { kurz: 'Diesel', mit: 'Diesel',          fehlt: 'kein Diesel',         lang: 'Kein Diesel zu bekommen' },
  // Neue Wünsche (P31, docs/gaestewuensche.md), mit eigenen Sätzen fürs Gästebuch
  wasser: { kurz: 'Wasser', mit: 'Frischwasser am Platz', fehlt: 'kein Wasser am Steg', lang: 'Kein Wasserhahn am Steg',
    saetze: ['Den Wassertank mussten wir mit Kanistern füllen.', 'Kein Wasserhahn am Steg, das Deck blieb salzig.', 'Frischwasser am Platz hätte uns gereicht.'] },
  wlan: { kurz: 'WLAN', mit: 'WLAN', fehlt: 'kein WLAN', lang: 'Kein WLAN im Hafen',
    saetze: ['Kein WLAN, der Wetterbericht kam nicht durch.', 'Wir wollten Fotos nach Hause schicken, aber kein Netz.', 'WLAN gab es nicht oder es war voll.'] },
  waesche: { kurz: 'Wäsche', mit: 'eine Waschmaschine', fehlt: 'keine Waschmaschine', lang: 'Keine Waschmaschine frei',
    saetze: ['Nach einer Woche an Bord: keine Waschmaschine.', 'Die Wäsche stapelt sich, und kein Trockner da.', 'Eine Waschmaschine hätte uns gerettet.'] },
  absaugen: { kurz: 'Absaugen', mit: 'eine Absaugstation', fehlt: 'keine Absaugstation', lang: 'Keine Absaugstation für den Fäkalientank',
    saetze: ['Der Tank war voll und keine Absaugstation da.', 'Ohne Absaugstation mussten wir weiter.', 'Eine Absaugstation gehört in jeden guten Hafen.'] },
};

export const ANGEBOT_TEXTE = {
  broetchen: { service: 'baecker', kurz: 'Brötchen', mit: 'frische Brötchen', fehlt: 'keine Brötchen', lang: 'Morgens keine frischen Brötchen',
    saetze: ['Morgens keine frischen Brötchen, schade.', 'Ein Bäcker am Hafen, das wäre was.'] },
  cafe: { service: 'hafencafe', kurz: 'Café', mit: 'ein Café', fehlt: 'kein Café', lang: 'Kein Café am Hafen',
    saetze: ['Ein Kaffee mit Blick aufs Wasser hat gefehlt.', 'Kein Café, wir saßen an Bord.'] },
  grill: { service: 'grillplatz', kurz: 'Grillplatz', mit: 'einen Grillplatz', fehlt: 'kein Grillplatz', lang: 'Kein Grillplatz für den Abend',
    saetze: ['Wir hätten so gern abends gegrillt.', 'Würstchen dabei, aber kein Grill.'] },
  fisch: { service: 'raeucherei', kurz: 'Räucherfisch', mit: 'Räucherfisch', fehlt: 'kein Räucherfisch', lang: 'Kein Räucherfisch zu kaufen',
    saetze: ['Am Meer und kein Räucherfisch?', 'Wir hatten uns auf Fisch gefreut.'] },
  segelclub: { service: 'segelclub', kurz: 'Segelclub', mit: 'einen Segelclub', fehlt: 'kein Segelclub', lang: 'Kein Segelclub zum Klönen',
    saetze: ['Kein Club, kein Klönschnack unter Seglern.', 'Ein Segelclub hätte gut gepasst.'] },
  rad: { service: 'fahrradverleih', kurz: 'Fahrräder', mit: 'Leihräder', fehlt: 'keine Leihräder', lang: 'Keine Fahrräder für einen Ausflug',
    saetze: ['Wir wollten radeln, aber es gab keine Räder.', 'Ohne Fahrrad kommt man hier nicht weit.'] },
  ausruester: { service: 'ausruester', kurz: 'Ausrüster', mit: 'einen Bootsausrüster', fehlt: 'kein Ausrüster', lang: 'Kein Laden für Bootszubehör',
    saetze: ['Eine Leine gerissen, und nirgends Ersatz.', 'Kein Bootsausrüster, wir mussten improvisieren.'] },
  kran: { service: 'mastenkran', kurz: 'Mastenkran', mit: 'einen Mastenkran', fehlt: 'kein Mastenkran', lang: 'Kein Mastenkran für den Mast',
    saetze: ['Wir mussten den Mast legen, aber kein Kran da.', 'Ohne Mastenkran ging es nicht weiter.'] },
  eis: { service: 'eisdiele', kurz: 'Eis', mit: 'ein Eis', fehlt: 'kein Eis', lang: 'Keine Eisdiele',
    saetze: ['Die Kinder wollten Eis. Gab es nicht.', 'So ein heißer Tag und keine Eisdiele.'] },
  werft: { service: 'travellift', kurz: 'Werft', mit: 'eine Werft', fehlt: 'keine Werft', lang: 'Keine Werft für eine kleine Reparatur',
    saetze: ['Ruder klemmte, und keine Werft weit und breit.', 'Für die Reparatur müssen wir woanders hin.'] },
  segelmacher: { service: 'segelmacher', kurz: 'Segelmacher', mit: 'einen Segelmacher', fehlt: 'kein Segelmacher', lang: 'Kein Segelmacher für das Segel',
    saetze: ['Das Segel ist eingerissen, kein Segelmacher hier.', 'Mit dem kaputten Segel geht es nun weiter.'] },
  // P31: Im Seehafen wollen Crews die großen Schiffe auch vom Wasser aus sehen
  barkasse: { service: 'barkasse', kurz: 'Barkasse', mit: 'eine Hafenrundfahrt', fehlt: 'keine Hafenrundfahrt', lang: 'Keine Barkasse für eine Hafenrundfahrt',
    saetze: ['So viele große Schiffe, aber keine Hafenrundfahrt.', 'Die Kinder wollten mit der Barkasse fahren.'] },
};

/** Alle Wunschtexte (Versorgung, Strom und Angebote). */
export const WUNSCH_TEXTE = { ...VERSORGUNG_TEXTE, ...ANGEBOT_TEXTE };

/** Kurzer Name eines Wunsches, auch für unbekannte Schlüssel (dann der Schlüssel selbst). */
export function wunschKurz(key) {
  return WUNSCH_TEXTE[key]?.kurz ?? key;
}

/** Ist das ein Wunsch an ein Angebot an Land? */
export function istAngebot(key) {
  return !!ANGEBOT_TEXTE[key];
}

/** Welcher Angebotswunsch gehört zu diesem Service? (Schlüssel oder null) */
export function wunschFuerService(serviceId) {
  return Object.keys(ANGEBOT_TEXTE).find((k) => ANGEBOT_TEXTE[k].service === serviceId) ?? null;
}
