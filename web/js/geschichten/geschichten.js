// Bootsgeschichten im Spiel (docs/bootsgeschichten.md, Abschnitt 4).
// Hängt die Regeln (geschichten/regeln.js) an die Spielregeln, liefert Texte für Bootskarte und
// Logbuch und meldet eine Geschichte, die zum ersten Mal vorkommt (über game.meldungen nur selten).
//
// Schnittstelle:
//   game.geschichten.text(boot)      Satz für die Bootskarte oder null
//   game.geschichten.titel(boot)     kurzer Name des Anlasses oder null
//   game.geschichten.landgang(boot)  { ziel: faktor } für die Menschen (render/people.js) oder null
//   game.geschichten.gesehen()       { id: tag } Geschichten, die schon im Hafen waren
//   game.geschichten.alle            Katalog (data/geschichten.js)
// Logbuch: Reiter "Geschichten" (game.logbuch.reiter), neu Erlebtes zählt am Reiter.
// Sendet: 'geschichte:neu' { id, titel, logbuch, boatId } beim ersten Anlegen mit dieser Geschichte.
import * as sim from '../sim.js';
import { GESCHICHTEN } from '../data/geschichten.js';
import { installiere, nachtragen, text, BY_ID, gesehen as merkeGesehen, stand, wetterWorte } from './regeln.js';
import { regelnBereit } from '../features/regeln-bereit.js';

export async function init(game) {
  const api = {
    alle: GESCHICHTEN,
    text: (boot) => text(boot),
    titel: (boot) => BY_ID[boot?.story?.id]?.titel ?? null,
    landgang: (boot) => BY_ID[boot?.story?.id]?.landgang ?? null,
    geschichte: (boot) => BY_ID[boot?.story?.id] ?? null,
    gesehen: () => ({ ...(game.sim?.state ? stand(game.sim.state).gesehen : {}) }),
  };
  game.geschichten = api;
  await regelnBereit(game);
  // Ereignis und Wetter des Tages aus dem Ereignismodul (events/events.js), sonst Alltag
  const umfeld = (state, tag = state.day) => {
    const ev = game.events;
    if (!ev) return {};
    const w = ev.weather?.(tag);
    return { ereignis: w?.event ?? (tag === state.day ? ev.current?.id : null) ?? null, wetter: wetterWorte(w) };
  };
  installiere(game.sim.ctx, sim, { umfeld });
  // Was schon vor dem Einhängen gewürfelt war (erster Tag, geladener Spielstand), bekommt seine Geschichte
  const nach = () => {
    const st = game.sim?.state;
    if (st) nachtragen({ state: st, ctx: game.sim.ctx, mods: sim.modifiers(st, game.sim.ctx), umfeld: { ...umfeld(st), morgen: umfeld(st, st.day + 1).ereignis } });
  };
  nach();
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') nach(); });
  game.on('sim:moored', (e) => {
    const st = game.sim?.state;
    const boot = st?.boats?.[e?.boatId];
    if (!boot || !merkeGesehen(st, boot)) return;
    const g = BY_ID[boot.story.id];
    const s = stand(st);
    (s.neu ||= []).push(g.id);
    game.emit('geschichte:neu', { id: g.id, titel: g.titel, logbuch: g.logbuch, boatId: boot.id });
    if (game.logbuch?.reiterJetzt === 'geschichten') game.logbuch.neuZeichnen?.();
    else game.logbuch?.neuZeichnen?.({ nurZahl: true });
  });

  // Logbuch-Reiter "Geschichten": welche Anlässe schon im Hafen waren (Langzeitziel, x von 65)
  const GRUPPEN = [
    { art: 'kurz', name: 'Kurzer Halt' },
    { art: 'nacht', name: 'Eine Nacht' },
    { art: 'mehr', name: 'Mehrere Nächte' },
    { art: 'besonders', name: 'Besondere Tage' },
  ];
  function teil(state, { el }) {
    const s = stand(state);
    const alle = GESCHICHTEN.length;
    const da = GESCHICHTEN.filter((g) => s.gesehen[g.id]).length;
    const neu = new Set(s.neu || []);
    const teile = [el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' }, el('b', {}, `${da} von ${alle}`), el('span', {}, ' Geschichten im Hafen erlebt')),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(alle), 'aria-valuenow': String(da), 'aria-label': 'Erlebte Geschichten' },
        el('i', { style: `width: ${Math.round((da / alle) * 1000) / 10}%` })))];
    for (const gr of GRUPPEN) {
      const liste = el('ul', { class: 'hm-ef-liste hm-gs-liste' });
      const eintraege = GESCHICHTEN.filter((g) => g.art === gr.art)
        .sort((a, b) => (s.gesehen[b.id] ? 1 : 0) - (s.gesehen[a.id] ? 1 : 0) || (s.gesehen[b.id] ?? 0) - (s.gesehen[a.id] ?? 0));
      for (const g of eintraege) {
        const tag = s.gesehen[g.id];
        liste.append(el('li', { class: `hm-ef-karte${tag ? ' da' : ''}${neu.has(g.id) ? ' neu' : ''}`, 'data-geschichte': g.id },
          el('span', { class: 'hm-ef-text' },
            el('b', {}, tag ? g.titel : '?'),
            el('span', {}, tag ? g.logbuch : (g.abStufe > state.stage ? `Ab Stufe ${g.abStufe}` : 'Noch nicht erlebt')),
            tag ? el('span', { class: 'hm-lb-klein' }, `Tag ${tag}`) : null),
          neu.has(g.id) ? el('span', { class: 'hm-lb-neu' }, 'neu') : null));
      }
      const n = eintraege.filter((g) => s.gesehen[g.id]).length;
      teile.push(el('section', { class: 'hm-lb-art hm-ef-gruppe' },
        el('h3', {}, el('span', {}, gr.name), el('span', { class: 'hm-lb-zahl' }, `${n}/${eintraege.length}`)), liste));
    }
    // Was jetzt zu sehen war, ist nicht mehr neu (die Markierung bleibt bis zum nächsten Öffnen)
    if (neu.size) setTimeout(() => { s.neu = []; game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
    return teile;
  }
  function anmelden() {
    if (!game.logbuch?.reiter) return false;
    game.logbuch.reiter({ id: 'geschichten', name: 'Geschichten', teil, zahl: () => (game.sim?.state ? (stand(game.sim.state).neu || []).length : 0) });
    return true;
  }
  if (!anmelden()) game.on('ready', anmelden);
}
