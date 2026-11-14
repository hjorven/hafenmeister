// Logbuch und Hafenchronik (Roadmap P21, F36, I5): Daten und Texte ohne Browser.
// Oberfläche: ui/logbuch.js. Beschreibung: docs/logbuch.md. Tests: tests/logbuch.test.mjs.
//
// Spielstand:
//   state.logbook                 Bootsart -> Liste der Modell-IDs, die schon angelegt haben (schreibt sim.js)
//   state.modules.logbuch = {
//     erst:     { [modellId]: { tag, stufe, boot?, hafen? } }   wann und mit welchem Boot ein Modell zuerst kam
//     chronik:  [{ tag, stufe, angelegt, gaeste, summe, ruf, rekord?, winter?, merk: [...] }]   eine Zeile je Tag
//     offen:    [{ t: tag, ...merkmal }]                        Merkmale, deren Tag noch nicht in der Chronik steht
//     ungelesen: [modellId]                                      neu im Logbuch, noch nicht angesehen
//     ab:       Tag, ab dem die Chronik geführt wird (1 im neuen Spiel, sonst Tag der Umstellung)
//   }
// Merkmale (merk) eines Tages, kurz gehalten, Namen stehen gleich drin:
//   { a: 'neu', typ, name, art? }  neues Modell im Logbuch (art: true, wenn die ganze Bootsart neu ist)
//   { a: 'stufe', stufe }          Aufstieg
//   { a: 'region' }                Region fertig ausgebaut
//   { a: 'bau', name }             gebaut (Ausbau, Versorgung, Service)
//   { a: 'ereignis', name }        Ereignis beginnt (Sturm, Regatta, Hafenfest ...)
//   { a: 'stamm', name }           neuer Stammgast
//   { a: 'ziel' } / { a: 'woche' } Tagesziel / Wochenziel geschafft
//   { a: 'start' }                 Hafen eröffnet (Tag 1)
//   { a: 'text', text, art? }      freier Satz (für spätere Pakete, zum Beispiel P22 Erfolge: art 'erfolg')

export const LOGBUCH = {
  maxChronik: 2000,       // Tage, die die Chronik höchstens aufhebt (etwa 15 Spieljahre)
  maxMerk: 16,            // Merkmale je Tag
  maxUngelesen: 120,
  maxText: 120,           // Zeichen je freiem Satz und Namen
};

// Reihenfolge, in der Merkmale eines Tages erzählt werden (wichtigstes zuerst)
const WICHTIG = { region: 0, stufe: 1, start: 2, text: 3, neu: 4, bau: 5, ereignis: 6, stamm: 7, woche: 8, ziel: 9 };

const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ganz = (v, min = 0) => (Number.isFinite(v) ? Math.max(min, Math.round(v)) : min);
const kurz = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, LOGBUCH.maxText);

// ------------------------------------------------------------------ Zustand

/** Zustand des Logbuchs, legt ihn an und repariert beschädigte Teile (C03: nie mit kaputten Daten weiter). */
export function buchState(state) {
  state.modules ||= {};
  let m = state.modules.logbuch;
  if (!istObjekt(m)) m = state.modules.logbuch = {};
  if (!istObjekt(m.erst)) m.erst = {};
  if (!Array.isArray(m.chronik)) m.chronik = [];
  if (!Array.isArray(m.ungelesen)) m.ungelesen = [];
  if (!Array.isArray(m.offen)) m.offen = [];
  delete m.heute;
  if (!Number.isInteger(m.ab) || m.ab < 1) m.ab = state.day === 1 && !state.guests ? 1 : state.day;
  return m;
}

/** Prüft und säubert das Logbuch eines geladenen Stands (Typen, Längen). Ändert state an Ort und Stelle. */
export function saeubern(state) {
  // state.logbook: nur Listen aus Text, ohne Doppelte
  if (!istObjekt(state.logbook)) state.logbook = {};
  for (const [typ, liste] of Object.entries(state.logbook)) {
    if (!Array.isArray(liste)) { delete state.logbook[typ]; continue; }
    state.logbook[typ] = [...new Set(liste.filter((x) => typeof x === 'string' && x.length < 40))];
  }
  const m = buchState(state);
  for (const [k, e] of Object.entries(m.erst)) {
    if (!istObjekt(e)) { delete m.erst[k]; continue; }
    m.erst[k] = {
      tag: Number.isInteger(e.tag) && e.tag > 0 ? e.tag : null,
      stufe: Number.isInteger(e.stufe) ? e.stufe : null,
      ...(e.boot ? { boot: kurz(e.boot) } : {}),
      ...(e.hafen ? { hafen: kurz(e.hafen) } : {}),
    };
  }
  m.chronik = m.chronik
    .filter((z) => istObjekt(z) && Number.isInteger(z.tag) && z.tag > 0)
    .map((z) => ({ ...z, merk: Array.isArray(z.merk) ? z.merk.filter(istObjekt).slice(0, LOGBUCH.maxMerk) : [] }))
    .slice(-LOGBUCH.maxChronik);
  m.ungelesen = m.ungelesen.filter((x) => typeof x === 'string').slice(-LOGBUCH.maxUngelesen);
  m.offen = m.offen.filter((x) => istObjekt(x) && Number.isInteger(x.t)).slice(-LOGBUCH.maxMerk * 4);
  return m;
}

/** Ist dieses Modell (oder diese Bootsart ohne Modelle) schon im Logbuch? */
export function gesehen(state, typeId, key = typeId) {
  const l = state?.logbook?.[typeId];
  return Array.isArray(l) && l.includes(key);
}

// ------------------------------------------------------------------ Katalog

/**
 * Alle Bootsarten mit ihren Modellen, nach Größe geordnet, so wie das Logbuch sie zeigt.
 * types: ctx.types (sim.js) oder eine Liste wie BOAT_CATALOG. Arten ohne Modelle zählen als ein Eintrag.
 */
export const GROESSEN = ['S', 'M', 'L', 'XL', 'XXL'];
export function katalog(types) {
  const liste = Array.isArray(types) ? types : Object.values(types || {});
  const out = [];
  for (const g of GROESSEN) {
    const arten = liste
      .filter((t) => t && String(t.size).toUpperCase() === g)
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'de', { numeric: true }))
      .map((t) => {
        const models = Array.isArray(t.models) && t.models.length ? t.models : [{ id: t.id, name: t.name }];
        return {
          id: t.id, name: t.name, size: g, minStage: t.minStage ?? t.fromStage ?? 1, unlock: t.unlock ?? null,
          stationed: !!t.stationed, kind: t.kind ?? null, sail: !!t.sail,
          modelle: models.map((mo) => ({
            id: mo.id, typeId: t.id, name: mo.name || t.name, size: g,
            minStage: mo.minStage ?? mo.fromStage ?? t.minStage ?? 1,
            length: zahl(mo.length ?? t.length), beam: zahl(mo.beam ?? t.beam), draft: zahl(mo.draft ?? t.draft),
            shape: mo.shape ?? null,
          })),
        };
      });
    if (arten.length) out.push({ size: g, arten });
  }
  return out;
}
const zahl = (v) => (Array.isArray(v) ? (v[0] + (v[1] ?? v[0])) / 2 : Number.isFinite(v) ? v : null);

/** Wie viel ist gesammelt? { gesehen, gesamt, arten, artenGesamt, je: { S: { gesehen, gesamt } } } */
export function fortschritt(state, kat) {
  const r = { gesehen: 0, gesamt: 0, arten: 0, artenGesamt: 0, je: {} };
  for (const gr of kat) {
    const j = (r.je[gr.size] = { gesehen: 0, gesamt: 0 });
    for (const art of gr.arten) {
      r.artenGesamt++;
      let eine = false;
      for (const mo of art.modelle) {
        j.gesamt++;
        if (gesehen(state, art.id, mo.id)) { j.gesehen++; eine = true; }
      }
      if (eine) r.arten++;
    }
    r.gesehen += j.gesehen;
    r.gesamt += j.gesamt;
  }
  return r;
}

// ------------------------------------------------------------------ Mitschreiben

/** Merkmale, die für einen Tag vorgemerkt sind (ohne das Feld t). */
export function offeneMerk(state, tag = state.day) {
  return buchState(state).offen.filter((x) => x.t === tag).map(({ t, ...rest }) => rest);
}

/** Ein Merkmal für den laufenden Tag vormerken (gleiche Merkmale nur einmal). */
export function merken(state, merk, tag = state?.day) {
  if (!state || !istObjekt(merk) || typeof merk.a !== 'string') return false;
  const sauber = {};
  for (const [k, v] of Object.entries(merk)) {
    if (typeof v === 'string') sauber[k] = kurz(v);
    else if (typeof v === 'number' && Number.isFinite(v)) sauber[k] = v;
    else if (typeof v === 'boolean') sauber[k] = v;
  }
  const m = buchState(state);
  const schl = JSON.stringify(sauber);
  // Die Zeile des Tages wird schon zu Beginn des Abends geschrieben (sim 'dayEnd'); was abends noch
  // geschieht (späte Boote legen an), kommt gleich in diese Zeile
  const zeile = m.chronik.length && m.chronik[m.chronik.length - 1].tag === tag ? m.chronik[m.chronik.length - 1] : null;
  const liste = zeile ? zeile.merk : offeneMerk(state, tag);
  if (liste.some((x) => JSON.stringify(x) === schl)) return false;
  if (liste.length >= LOGBUCH.maxMerk) return false;
  if (zeile) zeile.merk.push(sauber); else m.offen.push({ t: tag, ...sauber });
  return true;
}

/**
 * Neues Modell im Logbuch (Ereignis 'logbookNew' aus sim.js). boat: das Boot, falls noch da.
 * names: { typ, modell } für den Text. Gibt den Eintrag zurück.
 */
export function neuEintragen(state, e, boat = null, names = {}, tag = state.day) {
  const m = buchState(state);
  const key = e.modelId ?? e.typeId;
  if (!key) return null;
  if (!m.erst[key]) {
    m.erst[key] = { tag, stufe: state.stage };
    if (boat?.bootsname) m.erst[key].boot = kurz(boat.bootsname);
    if (boat?.heimathafen) m.erst[key].hafen = kurz(boat.heimathafen);
  }
  if (!m.ungelesen.includes(key)) {
    m.ungelesen.push(key);
    if (m.ungelesen.length > LOGBUCH.maxUngelesen) m.ungelesen.shift();
  }
  const artNeu = (state.logbook?.[e.typeId] || []).length <= 1;
  merken(state, { a: 'neu', typ: names.typ || e.typeId, name: names.modell || names.typ || key, ...(artNeu ? { art: true } : {}) }, tag);
  return m.erst[key];
}

/** Abend: der Tag kommt als Zeile in die Chronik. bericht = sim.tagesbericht (Ereignis 'dayEnd'). */
export function tagEintragen(state, bericht, { winter = false } = {}) {
  const m = buchState(state);
  const tag = Number.isInteger(bericht?.tag) ? bericht.tag : state.day;
  // Alles, was bis jetzt vorgemerkt ist, gehört zu diesem Abend. Die Spielregeln melden Ereignisse gesammelt
  // nach dem Tick, darum kann state.day schon weiter sein und Merkmale dieses Tages tragen den nächsten Tag;
  // was nach dem Abend geschieht, wird erst danach gemeldet und kommt in die nächste Zeile.
  const merk = [];
  for (const { t, ...rest } of m.offen) if (!merk.some((x) => JSON.stringify(x) === JSON.stringify(rest))) merk.push(rest);
  merk.splice(LOGBUCH.maxMerk);
  m.offen = [];
  const zeile = {
    tag,
    stufe: ganz(bericht?.stufe ?? state.stage, 1),
    angelegt: ganz(bericht?.angelegt),
    gaeste: ganz(bericht?.abgereist),
    summe: ganz(bericht?.summe, -1e12),
    ruf: Number.isFinite(bericht?.ruf?.nachher) ? Math.round(bericht.ruf.nachher * 10) / 10 : null,
    merk: [...merk],
  };
  if (bericht?.rekord) zeile.rekord = true;
  if (winter) zeile.winter = true;
  // Kommt der Abend eines Tages zweimal (Laden, Wiederholung), gehen die Merkmale des ersten nicht verloren
  const i = m.chronik.findIndex((z) => z.tag === tag);
  if (i >= 0) {
    const alt = m.chronik[i].merk || [];
    const schl = new Set(zeile.merk.map((x) => JSON.stringify(x)));
    zeile.merk = [...alt.filter((x) => !schl.has(JSON.stringify(x))), ...zeile.merk].slice(0, LOGBUCH.maxMerk);
    if (m.chronik[i].rekord) zeile.rekord = true;
    m.chronik[i] = zeile;
  } else m.chronik.push(zeile);
  m.chronik.sort((a, b) => a.tag - b.tag);
  if (m.chronik.length > LOGBUCH.maxChronik) m.chronik.splice(0, m.chronik.length - LOGBUCH.maxChronik);
  return zeile;
}

/**
 * Ereignisse der Spielregeln (Liste aus sim.runDay oder einzeln aus 'sim:<typ>') verarbeiten.
 * hilfe: { boot(id), namen(typeId, modelId) -> { typ, modell }, winter(tag) -> bool }
 * Gibt die neuen Logbuch-Einträge zurück: [{ key, typeId, modelId, art }].
 */
export function verarbeite(state, events, hilfe = {}) {
  const neu = [];
  const liste = (events || []).filter((e) => e && typeof e.type === 'string');
  // Die Regeln liefern die Ereignisse eines Ticks gesammelt, state.day ist dann schon der Stand danach.
  // Was vor 'dayEnd' (Tag N) steht, gehört zu Tag N, was vor 'dayStart' (Tag N) steht, zu Tag N - 1.
  const tagVon = (i) => {
    for (let j = i + 1; j < liste.length; j++) {
      const e = liste[j];
      if (!Number.isInteger(e.day)) continue;
      if (e.type === 'dayEnd') return e.day;
      if (e.type === 'dayStart') return e.day - 1;
    }
    return state.day;
  };
  for (const [i, e] of liste.entries()) {
    let tag = tagVon(i);
    if (e.type === 'logbookNew') {
      const names = hilfe.namen?.(e.typeId, e.modelId) ?? {};
      const boot = e.boatId != null ? hilfe.boot?.(e.boatId) ?? state.boats?.[e.boatId] : null;
      const vorher = (state.logbook?.[e.typeId] || []).length;
      // Fest liegende Boote (Fischer) kommen zu Beginn des Tages, vor 'dayStart' dieses Tages
      if (boot?.stationed) {
        const j = liste.findIndex((x, k) => k > i && x.type === 'dayStart' && Number.isInteger(x.day));
        if (j >= 0) tag = liste[j].day;
      }
      if (neuEintragen(state, e, boot, names, tag)) neu.push({ key: e.modelId ?? e.typeId, typeId: e.typeId, modelId: e.modelId ?? null, art: vorher <= 1 });
    } else if (e.type === 'stageUp') {
      if (Number.isInteger(e.stage)) merken(state, { a: 'stufe', stufe: e.stage }, tag);
    } else if (e.type === 'regionDone') {
      if (!e.vorschau) merken(state, { a: 'region' }, tag);
    } else if (e.type === 'stammgastNeu') {
      if (e.bootsname) merken(state, { a: 'stamm', name: e.bootsname }, tag);
    } else if (e.type === 'dayEnd') {
      tagEintragen(state, e.bericht ?? { tag: e.day, summe: e.income }, { winter: !!hilfe.winter?.(e.day) });
    }
  }
  return neu;
}

// ------------------------------------------------------------------ Umstellung alter Spielstände

/**
 * Spielstand ohne Chronik (Version 2 und älter): Logbuch anlegen. Was schon im Logbuch steht, bekommt
 * keinen Tag (es kam vor der Chronik). Die letzten Tage aus state.stats.verlauf werden nachgetragen,
 * dazu eine Zeile "vor der Chronik" mit den Gästen bis dahin. Reines JSON, ändert die Eingabe nicht.
 */
export function aufbauenAusAltstand(game) {
  if (!istObjekt(game)) return game;
  const modules = istObjekt(game.modules) ? { ...game.modules } : {};
  if (istObjekt(modules.logbuch) && Array.isArray(modules.logbuch.chronik)) return { ...game, modules };
  const tagJetzt = Number.isInteger(game.day) && game.day > 0 ? game.day : 1;
  const erst = {};
  for (const liste of Object.values(istObjekt(game.logbook) ? game.logbook : {})) {
    if (!Array.isArray(liste)) continue;
    for (const k of liste) if (typeof k === 'string') erst[k] = { tag: null, stufe: null };
  }
  const verlauf = Array.isArray(game.stats?.verlauf) ? game.stats.verlauf.filter((b) => istObjekt(b) && Number.isInteger(b.tag)) : [];
  // Aufstiege, die features/aufstieg.js schon aufgeschrieben hat: { [stufe]: { abTag } }
  const stufenAb = {};
  const ch = modules.aufstieg?.chronik;
  if (istObjekt(ch)) for (const [s, c] of Object.entries(ch)) if (Number.isInteger(c?.abTag) && Number(s) > 1) stufenAb[c.abTag] = Number(s);
  const chronik = [];
  const erster = verlauf.length ? verlauf[0].tag : tagJetzt;
  if (erster > 1) {
    const vorher = { tag: 1, bis: erster - 1, vorher: true, stufe: 1, angelegt: 0, gaeste: 0, summe: 0, ruf: null, merk: [{ a: 'start' }] };
    // Aufstiege vor dem nachgetragenen Verlauf gehören in diese Zeile
    for (const [t, s] of Object.entries(stufenAb)) if (Number(t) < erster) vorher.merk.push({ a: 'stufe', stufe: s });
    chronik.push(vorher);
  }
  for (const b of verlauf) {
    const z = {
      tag: b.tag, stufe: ganz(b.stufe, 1), angelegt: ganz(b.angelegt), gaeste: ganz(b.abgereist), summe: ganz(b.summe, -1e12),
      ruf: Number.isFinite(b.ruf?.nachher) ? Math.round(b.ruf.nachher * 10) / 10 : null, merk: [],
    };
    if (b.tag === 1) z.merk.push({ a: 'start' });
    if (stufenAb[b.tag]) z.merk.push({ a: 'stufe', stufe: stufenAb[b.tag] });
    if (b.rekord) z.rekord = true;
    chronik.push(z);
  }
  modules.logbuch = { erst, chronik, offen: [], ungelesen: [], ab: tagJetzt };
  return { ...game, modules };
}

// ------------------------------------------------------------------ Texte

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const komma = (n) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Aufzählung: "A", "A und B", "A, B und 2 weitere" */
export function aufzaehlen(namen, max = 2) {
  const n = [...new Set(namen)];
  if (n.length <= 1) return n[0] ?? '';
  // Namen mit "und" (Beiboot und Schlauchboot): dann "sowie", damit klar bleibt, was zusammengehört
  const und = n.some((x) => / und /.test(x)) ? ' sowie ' : ' und ';
  if (n.length <= max + 1 && n.length <= 3) return `${n.slice(0, -1).join(', ')}${und}${n[n.length - 1]}`;
  return `${n.slice(0, max).join(', ')}${und}${n.length - max} weitere`;
}

/** Sätze eines Chronik-Tags, wichtigstes zuerst. */
export function saetze(z) {
  const merk = [...(z.merk || [])].sort((a, b) => (WICHTIG[a.a] ?? 20) - (WICHTIG[b.a] ?? 20));
  const nach = (a) => merk.filter((x) => x.a === a);
  const out = [];
  if (nach('region').length) out.push('Der Hafen ist fertig ausgebaut.');
  for (const s of nach('stufe')) out.push(`Aufstieg auf Stufe ${s.stufe}.`);
  if (nach('start').length) out.push(z.vorher ? 'Der Hafen wird eröffnet.' : 'Der Hafen öffnet zum ersten Mal.');
  for (const t of nach('text')) out.push(/[.!?]$/.test(t.text) ? t.text : `${t.text}.`);
  const neu = nach('neu');
  const neueArten = neu.filter((x) => x.art);
  if (neueArten.length) out.push(`Zum ersten Mal da: ${aufzaehlen(neueArten.map((x) => x.typ))}.`);
  const neueModelle = neu.filter((x) => !x.art);
  if (neueModelle.length) out.push(`Neu im Logbuch: ${aufzaehlen(neueModelle.map((x) => x.name))}.`);
  const bau = nach('bau');
  if (bau.length) out.push(`Gebaut: ${aufzaehlen(bau.map((x) => x.name))}.`);
  for (const e of nach('ereignis')) out.push(`${e.name}.`);
  const stamm = nach('stamm').map((x) => `„${x.name}“`);
  if (stamm.length === 1) out.push(`${stamm[0]} kommt jetzt als Stammgast.`);
  else if (stamm.length > 1) out.push(`Neue Stammgäste: ${aufzaehlen(stamm)}.`);
  if (nach('woche').length) out.push('Wochenziel geschafft.');
  else if (nach('ziel').length) out.push('Tagesziel geschafft.');
  if (z.rekord) out.push('Bester Tag bisher.');
  if (!out.length) {
    if (z.winter) out.push('Winterruhe.');
    else if (!z.angelegt && !z.gaeste) out.push('Ruhiger Tag, niemand hat angelegt.');
    else if (z.angelegt >= 12) out.push('Viel los im Hafen.');
    else out.push('Ein gewöhnlicher Hafentag.');
  }
  return out;
}

/** Zahlen eines Chronik-Tags in einer kurzen Zeile. */
export function zahlenText(z) {
  if (z.vorher) return z.bis > z.tag ? `Tag ${z.tag} bis ${z.bis}, vor dem Logbuch` : 'vor dem Logbuch';
  const t = [];
  if (z.angelegt) t.push(`${z.angelegt} ${z.angelegt === 1 ? 'Boot' : 'Boote'} angelegt`);
  if (z.summe) t.push(euro(z.summe));
  if (z.ruf != null && !z.winter) t.push(`Ruf ${komma(z.ruf)}`);
  return t.join(' · ');
}

/** Ein Satz für den Tag (Tagesabschluss, Meldungen). */
export function tagesSatz(z) {
  return z ? saetze(z).slice(0, 2).join(' ') : '';
}

/**
 * Chronik zum Anzeigen: neueste zuerst, Kapitel je Stufe, ruhige Wintertage zu einem Abschnitt zusammengefasst.
 * Gibt [{ kapitel: stufe, abTag, zeilen: [{ tag, bis?, ... }] }] zurück.
 */
export function chronikAnsicht(chronik) {
  const zeilen = [];
  for (const z of chronik) {
    const letzte = zeilen[zeilen.length - 1];
    const ruhigerWinter = z.winter && !(z.merk || []).length;
    if (ruhigerWinter && letzte?.winter && letzte.ruhig && (letzte.bis ?? letzte.tag) === z.tag - 1) {
      letzte.bis = z.tag;
      letzte.summe += z.summe || 0;
      continue;
    }
    zeilen.push({ ...z, ruhig: ruhigerWinter });
  }
  const kapitel = [];
  for (const z of zeilen) {
    const k = kapitel[kapitel.length - 1];
    if (!k || k.stufe !== z.stufe) kapitel.push({ stufe: z.stufe, abTag: z.tag, zeilen: [z] });
    else k.zeilen.push(z);
  }
  kapitel.reverse();
  for (const k of kapitel) k.zeilen.reverse();
  return kapitel;
}

/** Tag-Überschrift einer Chronik-Zeile. */
export function tagTitel(z) {
  if (z.bis && z.bis > z.tag) return z.ruhig ? `Tag ${z.tag} bis ${z.bis} · Winterpause` : `Tag ${z.tag} bis ${z.bis}`;
  return `Tag ${z.tag}`;
}

/** Steckbrief-Text: "12,0 m lang, 4,0 m breit, 1,9 m Tiefgang" */
export function masse(mo) {
  const m = (v) => `${komma(v)} m`;
  const t = [];
  if (mo.length) t.push(`${m(mo.length)} lang`);
  if (mo.beam) t.push(`${m(mo.beam)} breit`);
  if (mo.draft) t.push(`${m(mo.draft)} Tiefgang`);
  return t.join(', ');
}

/** Wann zuerst gesehen, als Satz. */
export function erstText(e) {
  if (!e) return '';
  const boot = e.boot ? `„${e.boot}“${e.hafen ? ` aus ${e.hafen}` : ''}` : '';
  if (!e.tag) return 'Schon vor dem Logbuch im Hafen gewesen.';
  return `Zuerst am Tag ${e.tag}${e.stufe ? ` (Stufe ${e.stufe})` : ''}${boot ? `: ${boot}` : ''}.`;
}

/** Hinweis für ein Modell, das noch fehlt. */
export function fehltText(art, mo, stufe) {
  const ab = Math.max(art.minStage || 1, mo.minStage || 1);
  if (art.unlock) return 'Kommt mit einem eigenen Anleger';
  if (art.stationed) return ab > stufe ? `Liegt ab Stufe ${ab} fest im Hafen` : 'Liegt fest im Hafen';
  if (ab > stufe) return `Kommt ab Stufe ${ab}`;
  return 'Noch nicht gesehen';
}
