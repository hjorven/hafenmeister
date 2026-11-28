// Spätankömmling (P53, docs/spaetankoemmling.md): Text der Meldung, ohne Three.js (auch für Tests).

/** Titel und Satz der Meldung. */
export function meldungText(boot, artName = null) {
  const name = boot?.bootsname ? `„${boot.bootsname}“` : null;
  const art = artName ?? 'Ein Boot';
  const wer = name ? `${art} ${name}` : art;
  return {
    titel: 'Spätankömmling',
    satz: `${wer} läuft im Dunkeln ein und sucht noch eine Box.`,
  };
}
