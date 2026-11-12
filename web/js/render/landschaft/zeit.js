// Spielzeit und Uhrzeit, ohne Three.js (auch für Tests und Spielregeln nutzbar).

/**
 * Spielzeit in Sekunden -> Uhrzeit in Stunden, nach dem Spielplan:
 * ein Spieltag dauert 120 s, 90 s Tag und 30 s Abend, danach geht es mit dem Morgen weiter.
 */
export function uhrzeitAusSpielzeit(sek, tagSek = 120, abendSek = 30) {
  const t = ((sek % tagSek) + tagSek) % tagSek;
  const tag = tagSek - abendSek;
  if (t < tag) return 6.5 + (t / tag) * 12.5;                 // 6:30 bis 19:00
  const a = (t - tag) / abendSek;
  if (a < 0.85) return 19 + (a / 0.85) * 3;                    // 19:00 bis 22:00
  return 22 + ((a - 0.85) / 0.15) * 8.5;                       // kurze Nacht bis 6:30
}
