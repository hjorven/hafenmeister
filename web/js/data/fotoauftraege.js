// Fotoaufträge und Postkarten (P43, docs/fotoauftraege.md): Texte der Motive. Zahlen in data/economy.js
// (ECONOMY.fotoauftraege), Regeln in features/fotoauftraege-regeln.js.
//
// Jedes Motiv: titel (Postkarte und Knopf), auftrag (Satz der Meldung), hinweis (wann und wie es gelingt),
// fehlt (kurzer Grund im Fotomodus, wenn es gerade nicht klappt), sym (Pixel-Symbol aus ui/pixel-symbole.js),
// art 'regel' (wechselnde Aufträge) oder 'sonder' (nur an einem besonderen Tag),
// abStufe, nurWinter, ereignisse (ids aus data/events.js, an deren Tagen das Motiv geht).

export const MOTIVE = {
  abendrot: {
    titel: 'Sonnenuntergang', art: 'regel', sym: 'sonne',
    auftrag: 'Der Hafen im Abendrot, mit Booten am Steg.',
    hinweis: 'Abends zwischen 18:30 und 21:30, mindestens drei Boote im Bild.',
  },
  morgen: {
    titel: 'Morgenstimmung', art: 'regel', sym: 'sonne',
    auftrag: 'Der Hafen am frühen Morgen, bevor die ersten Gäste kommen.',
    hinweis: 'Morgens bis 8:30, mindestens drei Boote im Bild.',
  },
  anlegen: {
    titel: 'Anleger', art: 'regel', sym: 'schiff',
    auftrag: 'Ein Boot, das gerade an seinem Platz anlegt.',
    hinweis: 'Ein Boot auf den letzten Metern vor seiner Box oder seinem Platz am Steg, groß im Bild.',
  },
  'voller-steg': {
    titel: 'Voller Steg', art: 'regel', sym: 'raute',
    auftrag: 'Ein ganzer Steg, an dem jeder Platz belegt ist.',
    hinweis: 'Ein Steg mit mindestens vier Plätzen, alle belegt, ganz im Bild.',
  },
  'ganzer-hafen': {
    titel: 'Der ganze Hafen', art: 'regel', sym: 'uebersicht',
    auftrag: 'Der ganze Hafen auf einer Karte, mit allen Stegen.',
    hinweis: 'Fast alle Liegeplätze im Bild und mindestens vier Boote im Hafen.',
  },
  winter: {
    titel: 'Hafen im Schnee', art: 'regel', sym: 'schnee', nurWinter: true,
    auftrag: 'Der Hafen im Schnee, für die Weihnachtskarten.',
    hinweis: 'Nur in den Wintertagen nach der Saison, mit den Stegen im Bild.',
  },
  besucher: {
    titel: 'Hoher Besuch', art: 'sonder', sym: 'stern', abStufe: 2,
    auftrag: 'Das besondere Schiff, das heute in den Hafen kommt.',
    hinweis: 'Wenn ein seltener Besucher im Hafen ist: das Schiff groß im Bild.',
  },
  grossschiff: {
    titel: 'Großes Schiff', art: 'sonder', sym: 'schiff', abStufe: 6,
    auftrag: 'Das große Schiff an der Pier, solange es da ist.',
    hinweis: 'Kreuzfahrtschiff, Flottenbesuch oder Großsegler im Seehafen, groß im Bild.',
  },
  nebel: {
    titel: 'Hafen im Nebel', art: 'sonder', sym: 'nebel', ereignisse: ['nebel'],
    auftrag: 'Der Hafen im Nebel, Boote nur schemenhaft.',
    hinweis: 'An einem Nebeltag, mindestens drei Boote im Bild.',
  },
  sommertag: {
    titel: 'Sommertag', art: 'sonder', sym: 'sonne', ereignisse: ['sommertag'],
    auftrag: 'Der volle Hafen an einem heißen Sommertag.',
    hinweis: 'An einem Sommertag, mindestens vier Boote im Bild.',
  },
  regatta: {
    titel: 'Regatta', art: 'sonder', sym: 'regatta', abStufe: 3, ereignisse: ['regatta'],
    auftrag: 'Die Regattabahn draußen vor dem Hafen.',
    hinweis: 'Am Regattatag: zwei gelbe Tonnen der Bahn und Boote im Bild.',
  },
  fest: {
    titel: 'Festtag', art: 'sonder', sym: 'fest', abStufe: 2,
    ereignisse: ['hafenfest', 'mittsommer', 'heringstage', 'holzboote', 'hansewoche'],
    auftrag: 'Der Hafen an einem Festtag, voller Boote.',
    hinweis: 'An einem Festtag (Hafenfest, Mittsommer, Heringstage, Holzboot-Treffen, Hanse-Woche), mindestens vier Boote im Bild.',
  },
};

export const MOTIV_IDS = Object.keys(MOTIVE);

/** Gründe im Fotomodus, warum das Bild gerade nicht zur Postkarte reicht (kurz, eine Zeile). */
export const FEHLT = {
  zeit: 'Noch nicht die richtige Uhrzeit',
  regen: 'Bei Regen geht keine Sonne auf oder unter. Warte, bis es aufklart',
  boote: 'Zu wenige Boote im Bild',
  anlegen: 'Gerade legt kein Boot im Bild an',
  klein: 'Näher heran',
  rand: 'Motiv in die Mitte holen',
  steg: 'Kein voller Steg ganz im Bild',
  hafen: 'Nicht alle Stege im Bild',
  fehlt: 'Das Motiv ist gerade nicht im Hafen',
  tonnen: 'Die Regattabahn ist nicht im Bild',
  vorbei: 'Heute nicht mehr',
};
