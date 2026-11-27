// Hafen verschönern (Roadmap P60, D8). Beschreibung: docs/verschoenern.md. Zahlen: ECONOMY.verschoenern.
//
// Im Baumenü, Reiter "Deko", stehen vier Arten, jede in Abschnitten (mehr Stücke, wenn der Hafen wächst):
// - Bänke am Wasser: Leute aus dem Ort und Crews setzen sich darauf und schauen aufs Wasser.
// - Blumenkübel: bei den Häusern und an den Wegen, blühen von Frühling bis Herbst, im Winter Tannengrün.
// - Bäume: an den Wegen, wachsen nach dem Pflanzen ein paar Tage, Laub je Jahreszeit.
// - Laternen am Weg: abends und nachts warmes Licht an Land (die Steglaternen auf den Stegen kommen aus P30).
// Dazu "Hafenhäuser streichen": eine Farbe für alle Hafengebäude, einmal je Saison neu wählbar.
// Jeder gebaute Abschnitt hebt die Bewertung jedes Gastes um ECONOMY.verschoenern.anker (Hook 'schoen'
// der Spielregeln, im Gästebuch "schöner Hafen"), der erste Anstrich um anstrich.anker.
// Den Flaggenmast gibt es schon (P44 Hafenmast), die Lichterketten am Abend auch (P46): hier nicht doppelt.
//
// Die Regeln (alles außer init) laufen ohne Browser, getestet in tests/verschoenern.test.mjs.
// Spielstand: state.modules.verschoenern = { baenke: n, kuebel: n, baeume: n, laternen: n (gebaute Abschnitte),
//   baumTage: [Tag je Baum-Abschnitt], anstrich: farbe | null, anstrichJahr: Saison | null }
// Schnittstelle: game.verschoenern = { angebote(), kaufen(art, farbe?), stand(), bonus(), farben,
//   wahl(farbe?), ort(art), geist(art), ziele(), stuecke() }
// Ereignisse: 'build' { id: 'deko:<art>' }, 'verschoenern:gebaut' { art, kosten, farbe? }, 'verschoenern:neu'.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { regelnBereit } from './regeln-bereit.js';

export const REGELN = ECONOMY.verschoenern ?? { anker: 0, arten: {}, anstrich: null };
export const ARTEN = Object.keys(REGELN.arten ?? {});

/** Farben für den Anstrich der Hafenhäuser (nur Aussehen, darum hier und nicht in economy.js). */
export const FARBEN = [
  { id: 'schwedenrot', name: 'Schwedenrot', farbe: '#9c3b2f' },
  { id: 'friesenblau', name: 'Friesenblau', farbe: '#3f6f98' },
  { id: 'kalkweiss', name: 'Kalkweiß', farbe: '#f1ece1' },
  { id: 'ockergelb', name: 'Ockergelb', farbe: '#dfae4c' },
  { id: 'salbeigruen', name: 'Salbeigrün', farbe: '#7f9e7c' },
];
export const farbeVon = (id) => FARBEN.find((f) => f.id === id) ?? null;

/** Plural und Einzahl für Texte. */
export const WORT = {
  baenke: ['Bank', 'Bänke'], kuebel: ['Blumenkübel', 'Blumenkübel'], baeume: ['Baum', 'Bäume'], laternen: ['Laterne', 'Laternen'],
};

export function dekoState(state) {
  state.modules ||= {};
  const m = (state.modules.verschoenern ||= {});
  for (const art of ARTEN) {
    const n = Math.floor(Number(m[art]) || 0);
    m[art] = Math.max(0, Math.min(REGELN.arten[art].abschnitte.length, n));
  }
  if (!Array.isArray(m.baumTage)) m.baumTage = [];
  if (m.anstrich != null && !farbeVon(m.anstrich)) m.anstrich = null;
  m.anstrichJahr ??= null;
  return m;
}

/** Gebaute Abschnitte einer Art (ohne den Spielstand anzufassen). */
export function abschnitteGebaut(state, art) {
  const n = Math.floor(Number(state?.modules?.verschoenern?.[art]) || 0);
  return Math.max(0, Math.min(REGELN.arten[art]?.abschnitte.length ?? 0, n));
}

/** Stücke einer Art nach n Abschnitten. */
export function stueckBis(art, n) {
  return (REGELN.arten[art]?.abschnitte ?? []).slice(0, n).reduce((s, a) => s + a.stueck, 0);
}

/** Stücke einer Art, die stehen. */
export const stueckZahl = (state, art) => stueckBis(art, abschnitteGebaut(state, art));

/** Höchstzahl der Stücke einer Art (alle Abschnitte). */
export const stueckMax = (art) => stueckBis(art, Infinity);

/** Saison (Jahr), in der gestrichen wurde bzw. die heute läuft. */
export function saison(state, ctx) {
  return ctx?.rules?.seasonDays ? sim.season(state, ctx).year : 1;
}

/** Anker, um die jeder Gast den Hafen besser bewertet. */
export function bonus(state) {
  const m = state?.modules?.verschoenern;
  if (!m) return 0;
  let n = 0;
  for (const art of ARTEN) n += abschnitteGebaut(state, art);
  const b = n * (REGELN.anker ?? 0) + (m.anstrich && farbeVon(m.anstrich) ? REGELN.anstrich?.anker ?? 0 : 0);
  return Math.round(b * 1000) / 1000;
}

/**
 * Was im Baumenü steht: je Art der nächste Abschnitt (auch gesperrt für die nächste Ausbaustufe),
 * dazu der Anstrich. { art, nr (1...), stueck, kosten, gesperrt, erster, anker }
 * Anstrich: { art: 'anstrich', kosten, gesperrt, erster (noch nie gestrichen), farbe (aktuelle), anker }
 */
export function angebote(state, ctx) {
  const out = [];
  const stufe = state.stage ?? 1;
  for (const art of ARTEN) {
    const n = abschnitteGebaut(state, art);
    const a = REGELN.arten[art].abschnitte[n];
    if (!a || stufe + 1 < a.abStufe) continue;
    out.push({ art, nr: n + 1, stueck: a.stueck, kosten: a.kosten, erster: n === 0, anker: REGELN.anker ?? 0,
      gesperrt: stufe < a.abStufe ? `ab Ausbaustufe ${a.abStufe}` : null });
  }
  const an = REGELN.anstrich;
  if (an && stufe + 1 >= an.abStufe) {
    const m = state.modules?.verschoenern ?? {};
    const farbe = farbeVon(m.anstrich) ? m.anstrich : null;
    const diesesJahr = farbe && m.anstrichJahr === saison(state, ctx);
    out.push({ art: 'anstrich', nr: 1, kosten: an.kosten[Math.min(an.kosten.length, stufe) - 1] ?? an.kosten[an.kosten.length - 1],
      erster: !farbe, farbe, anker: farbe ? 0 : an.anker ?? 0,
      gesperrt: stufe < an.abStufe ? `ab Ausbaustufe ${an.abStufe}` : diesesJahr ? 'nächste Saison wieder' : null });
  }
  return out;
}

/**
 * Bauen. bezahle(kosten) bucht die Ausgabe. Anstrich braucht eine Farbe aus FARBEN.
 * { ok, grund? ('unbekannt' | 'stufe' | 'saison' | 'farbe' | 'geld'), angebot? }
 */
export function kaufen(state, ctx, art, farbe = null, bezahle = (k) => sim.spend(state, k, 'bau')) {
  const a = angebote(state, ctx).find((x) => x.art === art);
  if (!a) return { ok: false, grund: 'unbekannt' };
  if (a.gesperrt) return { ok: false, grund: a.gesperrt.startsWith('ab') ? 'stufe' : 'saison' };
  if (art === 'anstrich' && !farbeVon(farbe)) return { ok: false, grund: 'farbe' };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld' };
  const m = dekoState(state);
  if (art === 'anstrich') {
    m.anstrich = farbe;
    m.anstrichJahr = saison(state, ctx);
  } else {
    m[art] += 1;
    if (art === 'baeume') m.baumTage[m[art] - 1] = state.day ?? 1;
  }
  return { ok: true, angebot: a };
}

/** Wie weit ein Baum gewachsen ist (0,4 frisch gepflanzt bis 1 ausgewachsen). */
export function baumWuchs(state, abschnitt) {
  const tag = state?.modules?.verschoenern?.baumTage?.[abschnitt];
  const tage = REGELN.baumWachsTage ?? 3;
  if (tag == null || !tage) return 1;
  const k = Math.max(0, Math.min(1, ((state.day ?? tag) - tag) / tage));
  return 0.4 + 0.6 * k;
}

/** Hook in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook, getState) {
  return addHook('schoen', () => { const s = getState(); return s ? bonus(s) : 0; });
}

// ---------------------------------------------------------------------------
// Im Browser

export async function init(game) {
  const schnittstelle = game.verschoenern = {
    angebote: () => [], kaufen: () => ({ ok: false }), stand: () => null, bonus: () => 0, farben: FARBEN, worte: WORT,
    wahl: () => null, ort: () => null, geist: () => null, ziele: () => [], stuecke: () => [],
  };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  haengeEin(api.addHook, st);
  if (st()) dekoState(st());

  // Gewählte Farbe in der Vorschau des Anstrichs (noch nicht gekauft)
  let wahlFarbe = null;
  const wahl = (id) => {
    if (id !== undefined) wahlFarbe = farbeVon(id) ? id : null;
    return wahlFarbe ?? st()?.modules?.verschoenern?.anstrich ?? FARBEN[0].id;
  };

  function kaufenBrowser(art, farbe = null) {
    const f = art === 'anstrich' ? farbe ?? wahl() : null;
    const r = kaufen(st(), ctx(), art, f, (k) => api.spend(k, 'bau'));
    if (r.ok) {
      wahlFarbe = null;
      game.emit('build', { id: `deko:${art}`, level: 1 });
      game.emit('sim:change', { reason: 'verschoenern' });
      game.emit('verschoenern:gebaut', { art, kosten: r.angebot.kosten, ...(f ? { farbe: f } : {}) });
    }
    return { ...r, geldFehlt: r.grund === 'geld' };
  }

  Object.assign(schnittstelle, {
    angebote: () => (st() ? angebote(st(), ctx()) : []),
    kaufen: kaufenBrowser,
    stand: () => (st() ? structuredClone(dekoState(st())) : null),
    bonus: () => (st() ? bonus(st()) : 0),
    wahl,
  });

  // Bild: Modelle, Plätze, Geisterbild, Licht, Jahreszeit (render/verschoenern-bild.js)
  if (!game.THREE || !game.scene) return;
  const { bildInit } = await import('../render/verschoenern-bild.js');
  bildInit(game, { st, ctx, wahl });

  // Zum Ausprobieren (docs/tests.md): ?verschoenern=alle baut im Testmodus (?stufe=n) alles, was die Stufe
  // erlaubt, ?verschoenern=1 je Art den ersten Abschnitt; &anstrich=<farbe> streicht gleich.
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const wunsch = q.get('verschoenern');
  if (wunsch) {
    const legeAn = () => {
      const s = st();
      if (!s?.testmodus) return;
      const m = dekoState(s);
      const bis = wunsch === 'alle' ? Infinity : Math.max(0, Number(wunsch) || 0);
      let neu = false;
      for (const art of ARTEN) {
        const ab = REGELN.arten[art].abschnitte;
        while (m[art] < Math.min(bis, ab.length) && ab[m[art]].abStufe <= s.stage) {
          m[art]++;
          if (art === 'baeume') m.baumTage[m[art] - 1] = (s.day ?? 1) - (REGELN.baumWachsTage ?? 3);
          neu = true;
        }
      }
      const f = q.get('anstrich');
      if (farbeVon(f) && m.anstrich !== f && s.stage >= (REGELN.anstrich?.abStufe ?? 1)) { m.anstrich = f; m.anstrichJahr = saison(s, ctx()); neu = true; }
      if (neu) { game.emit('build', { id: 'deko:test' }); game.emit('sim:change', { reason: 'verschoenern' }); }
    };
    legeAn();
    game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') setTimeout(legeAn, 0); });
  }
}

export default init;
