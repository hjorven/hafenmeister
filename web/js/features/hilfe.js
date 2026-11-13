// Hilfe für alle Geräte (Roadmap P03, J7 und J8): eine Tafel mit den sechs Grundgriffen, je mit
// Pixelbild aus ui/pixel-symbole.js, und dem Knopf „Einstieg wiederholen“ (startet features/einstieg.js neu).
// Der Knopf #btn-hilfe steht im Menü (ui/oberflaeche.js, Liste MENUE). Texte unterscheiden Finger und Maus.
//
// Schnittstelle: game.hilfe = { oeffnen(), schliessen() }

import { pixelBild } from '../ui/pixel-symbole.js';

const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Die sechs Karten der Hilfe, in der Reihenfolge des Einstiegs. bild = Name in PIXEL. */
export const KARTEN = [
  {
    bild: 'schiff', titel: 'Boote warten an den Bojen',
    text: 'Gastboote kommen übers Wasser und warten an den gelben Bojen. Nach einer Weile fahren sie selbst in eine freie Box; passt keine, fahren sie weiter.',
  },
  {
    bild: 'pfeil', titel: 'Boot einweisen',
    text: TOUCH
      ? 'Zieh ein wartendes Boot mit dem Finger auf einen leuchtenden Platz (grünes Schild heißt frei). Oder tipp es an und drück „Einfahren“.'
      : 'Zieh ein wartendes Boot mit der Maus auf einen leuchtenden Platz (grünes Schild heißt frei). Oder klick es an und drück „Einfahren“.',
  },
  {
    bild: 'muenze', titel: 'Liegegeld einstreichen',
    text: TOUCH
      ? 'Liegt ein Boot fest, zahlt es: Tipp auf die Münze oder streich mit dem Finger über mehrere. Was liegen bleibt, holt abends der Hafenmeister, aber nicht ganz.'
      : 'Liegt ein Boot fest, zahlt es: Klick auf die Münze oder fahr mit gedrückter Maustaste über mehrere. Was liegen bleibt, holt abends der Hafenmeister, aber nicht ganz.',
  },
  {
    bild: 'tempo2', titel: 'Zeit',
    text: TOUCH
      ? 'Unten links: Pause, 1x, 3x und 8x. Kommt ein Boot an die Boje, schaltet 8x von selbst zurück.'
      : 'Unten links: Pause, 1x, 3x und 8x. Taste F schaltet 3x ein und aus. Kommt ein Boot an die Boje, schaltet 8x von selbst zurück.',
  },
  {
    bild: 'bauen', titel: 'Bauen',
    text: '„Bauen“ hält die Zeit an und zeigt erst eine Vorschau. Gekauft wird mit „Bauen für …“. Neue Liegeplätze, Anlagen für die Gäste und die nächste Ausbaustufe.',
  },
  {
    bild: 'ziele', titel: 'Tagesziele und Ausbau',
    text: 'Links stehen drei kleine Ziele für den Tag, die etwas Geld bringen, und das Ziel der Ausbaustufe. Ist es geschafft, kann der Hafen wachsen.',
  },
];

const CSS = `
body #hm-hilfe.hm-hilfe { position: absolute; z-index: 42; inset: 0; margin: auto; translate: none; height: fit-content;
  width: min(560px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow-y: auto; box-sizing: border-box;
  padding: 12px 14px 14px; display: grid; gap: 8px; }
#hm-hilfe.hm-hilfe[hidden] { display: none; }
#hm-hilfe.hm-hilfe .hm-karte-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#hm-hilfe.hm-hilfe .hm-klapp-kopf { margin: 0; font-size: calc(var(--hm-s, 14px) + 3px); }
#hm-hilfe.hm-hilfe ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
#hm-hilfe.hm-hilfe li { display: grid; grid-template-columns: 44px 1fr; gap: 4px 10px; align-items: start; padding: 8px; background: var(--hm-mulde, rgba(0,0,0,.05)); }
#hm-hilfe.hm-hilfe li .hm-pixelbild { grid-row: span 2; width: 40px; height: 40px; color: var(--hm-tinte, #283648); }
#hm-hilfe.hm-hilfe li strong { font-size: var(--hm-s, 14px); }
#hm-hilfe.hm-hilfe li span { font-size: calc(var(--hm-s, 14px) - 1px); line-height: 1.35; }
#hm-hilfe.hm-hilfe #hm-hilfe.hm-hilfe-knoepfe { display: flex; justify-content: flex-end; }
@media (max-width: 599px), (max-height: 499px) { #hm-hilfe.hm-hilfe ol { grid-template-columns: 1fr; } }
body.foto #hm-hilfe { display: none !important; }
`;

export function init(game) {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('game') || document.body;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const el = (tag, attrs = {}, ...kinder) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'onclick') e.addEventListener('click', v);
      else e.setAttribute(k, v);
    }
    e.append(...kinder);
    return e;
  };

  const tafel = el('div', { id: 'hm-hilfe', class: 'hm-hilfe hm-px hm-tafel-px', role: 'dialog', 'aria-label': 'Hilfe' });
  tafel.hidden = true;
  const zu = el('button', { type: 'button', class: 'hm-zu', 'aria-label': 'Hilfe schließen', onclick: () => schliessen() });
  const liste = el('ol', {}, ...KARTEN.map((k) => el('li', {}, pixelBild(k.bild, 40), el('strong', {}, k.titel), el('span', {}, k.text))));
  const nochmal = el('button', { type: 'button', class: 'hud-btn hm-knopf', onclick: () => { schliessen(); game.einstieg?.start?.(); } }, 'Einstieg wiederholen');
  tafel.append(el('div', { class: 'hm-karte-kopf' }, el('p', { class: 'hm-klapp-kopf' }, 'So geht der Hafen'), zu), liste, el('div', { class: 'hm-hilfe-knoepfe' }, nochmal));
  // Klicks in der Tafel nicht als Klick auf die Karte durchreichen
  tafel.addEventListener('pointerdown', (e) => e.stopPropagation());
  host.append(tafel);

  // Knopf für das Menü (ui/oberflaeche.js räumt ihn dort ein)
  const knopf = el('button', { type: 'button', id: 'btn-hilfe', class: 'hud-btn', 'aria-haspopup': 'dialog', 'aria-controls': 'hm-hilfe' }, 'Hilfe');
  knopf.addEventListener('click', () => { if (tafel.hidden) oeffnen(); else schliessen(); });
  (document.getElementById('hud-top') || host).append(knopf);

  function oeffnen() {
    tafel.hidden = false;
    knopf.setAttribute('aria-expanded', 'true');
    zu.focus({ preventScroll: true });
  }
  function schliessen() {
    tafel.hidden = true;
    knopf.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tafel.hidden) schliessen(); });
  document.addEventListener('pointerdown', (e) => { if (!tafel.hidden && !tafel.contains(e.target) && e.target !== knopf) schliessen(); });

  game.hilfe = { oeffnen, schliessen };
}
