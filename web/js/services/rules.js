// Hafenmeister: Regeln fuer Services und Sonderanlagen. Reine Logik ohne Three.js und ohne DOM,
// laeuft auch unter Node (tests/services.test.mjs).
//
// Zustand (wird mit dem Spielstand gespeichert, nur einfache Werte):
//   { gebaut: { travellift: 2, ... }, besuche: { kreuzfahrtterminal: 12 }, summe: { travellift: 4800 } }
//   gebaut   = erreichte Ausbaustufe je Service (fehlt = nicht gebaut)
//   besuche  = Spieltag des naechsten regelmaessigen Besuchs je Service
//   summe    = Einnahmen seit Spielbeginn je Service (fuer die Baukarte und Erfolge)
//
// Kontext beim Bauen: { stufe, ruf, geld }   stufe = Ausbaustufe des Hafens 1 bis 6, ruf 0 bis 5
// Tagesdaten fuer die Abrechnung:
//   { tag, wetter: 'sonne'|'regen'|'sturm', winter: false, boote: [{ klasse: 'S', antrieb: 'segel' }] }
import { SERVICES, RUF_BONUS_MAX, STURMSCHUTZ_MAX } from '../data/services.js';

export function neuerZustand() {
  return { gebaut: {}, besuche: {}, summe: {} };
}

// Andere Zahlen über den Katalog legen (Tests, Balancing-Versuche): je Service ersetzt eine Stufe aus
// ueberschreiben ihre Felder, wirkung wird als Ganzes ersetzt. Ohne Angabe bleibt der Katalog, wie er ist.
// Die Spielzahlen selbst stehen in js/data/economy.js und sind in SERVICES schon enthalten.
export function mitZahlen(katalog, ueberschreiben) {
  if (!ueberschreiben) return katalog;
  return katalog.map((s) => {
    const o = ueberschreiben[s.id];
    if (!o) return s;
    const stufen = s.stufen.map((st, i) => {
      const n = o.stufen?.[i];
      if (!n) return st;
      const wirkung = n.wirkung ? { ...n.wirkung, ...(st.wirkung?.besuch && n.wirkung.besuch ? { besuch: { ...n.wirkung.besuch, text: n.wirkung.besuch.text ?? st.wirkung.besuch.text } } : {}) } : st.wirkung;
      return { ...st, ...n, name: st.name, wirkung };
    });
    return { ...s, ...(o.abStufe != null ? { abStufe: o.abStufe } : {}), stufen };
  });
}

export function erstelleRegeln(katalog = SERVICES) {
  const byId = Object.fromEntries(katalog.map((s) => [s.id, s]));

  const stufeVon = (z, id) => z.gebaut[id] ?? 0;
  const aktiveStufe = (z, id) => {
    const n = stufeVon(z, id);
    return n > 0 ? byId[id].stufen[n - 1] : null;
  };

  // Was die naechste Ausbaustufe braucht und ob es reicht.
  // Liefert { ok, stufe, def, kosten, fehlt: [Text] } oder { ok: false, fertig: true }.
  function pruefe(z, id, kontext = {}) {
    const s = byId[id];
    if (!s) return { ok: false, fehlt: ['Unbekannter Service'] };
    const n = stufeVon(z, id);
    if (n >= s.stufen.length) return { ok: false, fertig: true, stufe: n, fehlt: ['Voll ausgebaut'] };
    const def = s.stufen[n];
    const fehlt = [];
    const abStufe = def.abStufe ?? s.abStufe;
    if ((kontext.stufe ?? 1) < abStufe) fehlt.push(`ab Ausbaustufe ${abStufe}`);
    if (def.ruf != null && (kontext.ruf ?? 0) < def.ruf) fehlt.push(`Ruf ${zahl(def.ruf)}`);
    for (const b of def.braucht ?? []) {
      if (stufeVon(z, b.id) < (b.stufe ?? 1)) fehlt.push(byId[b.id]?.stufen[(b.stufe ?? 1) - 1]?.name ?? b.id);
    }
    const geldFehlt = kontext.geld != null && kontext.geld < def.kosten;
    return { ok: fehlt.length === 0 && !geldFehlt, freigeschaltet: fehlt.length === 0, geldFehlt,
      stufe: n + 1, def, kosten: def.kosten, fehlt };
  }

  // Baut die naechste Stufe. Zieht kein Geld ab, das macht der Aufrufer mit dem gelieferten Betrag.
  function bauen(z, id, kontext = {}) {
    const p = pruefe(z, id, kontext);
    if (!p.ok) return p;
    z.gebaut[id] = p.stufe;
    const besuch = p.def.wirkung?.besuch;
    if (besuch && kontext.tag != null) z.besuche[id] = kontext.tag + (besuch.ersterNach ?? besuch.alleTage);
    return { ...p, ok: true };
  }

  // Liste fuer das Baumenue: alles, was in dieser Hafenstufe sichtbar ist (auch noch gesperrt),
  // sortiert nach Hafenstufe. Services spaeterer Stufen bleiben verborgen, damit es Ueberraschungen gibt.
  function liste(z, kontext = {}) {
    return katalog
      .filter((s) => s.abStufe <= (kontext.stufe ?? 1) || stufeVon(z, s.id) > 0)
      .map((s) => ({ id: s.id, name: s.name, kurz: s.kurz, gruppe: s.gruppe, stufe: stufeVon(z, s.id),
        maxStufe: s.stufen.length, aktuell: aktiveStufe(z, s.id)?.name ?? null, naechste: pruefe(z, s.id, kontext) }))
      .sort((a, b) => byId[a.id].abStufe - byId[b.id].abStufe);
  }

  // Alle dauerhaften Wirkungen zusammen. Wird von sim.js und Ereignissen gelesen.
  function effekte(z) {
    const e = { ruf: 0, gaeste: { S: 1, M: 1, L: 1, XL: 1, XXL: 1 }, sturmschutz: 0, regatta: 1, hafenfest: 1,
      hafengeld: { segel: 1, motor: 1 }, besucherFuerVersorgung: 0, freischalten: [] };
    for (const id of Object.keys(z.gebaut)) {
      const w = aktiveStufe(z, id)?.wirkung;
      if (!w) continue;
      e.ruf += w.ruf ?? 0;
      for (const [k, f] of Object.entries(w.gaeste ?? {})) e.gaeste[k] = (e.gaeste[k] ?? 1) * f;
      e.sturmschutz += w.sturmschutz ?? 0;
      e.regatta *= w.regatta ?? 1;
      e.hafenfest *= w.hafenfest ?? 1;
      for (const [k, f] of Object.entries(w.hafengeld ?? {})) e.hafengeld[k] *= f;
      e.besucherFuerVersorgung += w.besucherFuerVersorgung ?? 0;
      for (const f of w.freischalten ?? []) if (!e.freischalten.includes(f)) e.freischalten.push(f);
    }
    e.ruf = Math.min(e.ruf, RUF_BONUS_MAX);
    e.sturmschutz = Math.min(e.sturmschutz, STURMSCHUTZ_MAX);
    for (const k of Object.keys(e.gaeste)) e.gaeste[k] = runde(e.gaeste[k], 3);
    return e;
  }

  // Abrechnung am Ende eines Spieltags. rng = Zufallszahl 0..1 (fuer Spielstaende mit festem Samen).
  // Liefert { tag, einnahmen: [{ id, betrag, text }], summe, besuche: [...], angekuendigt: [...] }
  // Keine laufenden Kosten (plan.md, Leitlinien): Services bringen nur etwas ein.
  function tagesabschluss(z, tag, rng = Math.random) {
    const wetter = tag.wetter ?? 'sonne';
    const boote = tag.boote ?? [];
    const out = { tag: tag.tag, einnahmen: [], summe: 0, besuche: [], angekuendigt: [] };

    for (const id of Object.keys(z.gebaut)) {
      const s = byId[id];
      const st = aktiveStufe(z, id);
      if (!s || !st) continue;
      const w = st.wirkung ?? {};
      let betrag = 0;
      const teile = [];

      if (tag.winter) {
        // Im Winter laufen nur Winterlager und Werft, alles andere ruht.
        if (w.winter?.proTag) { betrag += w.winter.proTag; teile.push('Winter'); }
      } else {
        if (w.proTag) {
          const f = w.wetter?.[wetter] ?? 1;
          if (f > 0) { betrag += w.proTag * f; teile.push('Tagesgeschäft'); }
        }
        if (w.kunden) {
          const passend = boote.filter((b) => passt(b, w.kunden.nur)).length;
          const kunden = zufallsRunden(passend * w.kunden.anteil, rng);
          if (kunden > 0) {
            let f = 1;
            for (const syn of w.synergie ?? []) if (stufeVon(z, syn.id) > 0) f *= syn.faktor;
            betrag += kunden * w.kunden.preis * f;
            teile.push(kunden === 1 ? '1 Kunde' : `${kunden} Kunden`);
          }
        }
      }

      // Regelmaessige Besuche (Kreuzfahrtschiff, Flottenbesuch, Ausflugsfahrt ...)
      const b = w.besuch;
      if (b && !tag.winter) {
        if (z.besuche[id] == null) z.besuche[id] = tag.tag + (b.ersterNach ?? b.alleTage);
        if (z.besuche[id] <= tag.tag) {
          if (wetter === 'sturm') {
            z.besuche[id] = tag.tag + 1;       // bei Sturm einen Tag spaeter, keine Strafe
          } else {
            const f = w.wetter?.[wetter] ?? 1;
            const ein = Math.round(b.einnahme * f);
            betrag += ein;
            teile.push(b.text);
            out.besuche.push({ id, art: b.art, tag: tag.tag, dauer: b.dauer ?? 1, einnahme: ein,
              gaeste: Math.round((b.gaeste ?? 0) * f), ruf: b.ruf ?? 0, text: b.text });
            z.besuche[id] = tag.tag + b.alleTage;
            z.anzahl ??= {};
            z.anzahl[b.art] = (z.anzahl[b.art] ?? 0) + 1;     // Zähler je Besuchsart (Stufenziel)
          }
        }
        if (z.besuche[id] === tag.tag + 1 && b.alleTage > 1) {
          out.angekuendigt.push({ id, art: b.art, tag: tag.tag + 1, text: b.text });
        }
      }

      betrag = Math.round(betrag);
      if (betrag > 0) {
        out.einnahmen.push({ id, betrag, text: `${s.name}: ${teile.join(', ')}` });
        z.summe[id] = (z.summe[id] ?? 0) + betrag;
      }
    }
    out.summe = out.einnahmen.reduce((a, e) => a + e.betrag, 0);
    return out;
  }

  // Fuer die Oberflaeche: welche Besuche kommen als naechstes ("Kreuzfahrtschiff in 3 Tagen").
  function naechsteBesuche(z, heute) {
    const out = [];
    for (const id of Object.keys(z.besuche)) {
      const b = aktiveStufe(z, id)?.wirkung?.besuch;
      if (!b) continue;
      out.push({ id, art: b.art, tag: z.besuche[id], inTagen: Math.max(0, z.besuche[id] - heute), text: b.text });
    }
    return out.sort((a, b) => a.tag - b.tag);
  }

  // Fuer den Thread Ereignisse: einen Besuch auf einen bestimmten Tag legen (z. B. Hafenfest).
  function planeBesuch(z, id, tag) {
    if (!aktiveStufe(z, id)?.wirkung?.besuch) return false;
    z.besuche[id] = tag;
    return true;
  }

  // Lage einer gebauten Stufe (manche Stufen ziehen um) in Planeinheiten.
  function lage(z, id) {
    const s = byId[id];
    const st = aktiveStufe(z, id) ?? s.stufen[0];
    return st.lage ?? s.lage;
  }

  return { katalog, byId, stufeVon, aktiveStufe, pruefe, bauen, liste, effekte, tagesabschluss, naechsteBesuche, planeBesuch, lage };
}

function passt(boot, nur) {
  if (!nur) return true;
  if (nur.antrieb && boot.antrieb !== nur.antrieb) return false;
  if (nur.klasse && !nur.klasse.includes(boot.klasse)) return false;
  return true;
}

// 2,4 erwartete Kunden ergeben 2 oder 3, im Mittel 2,4.
function zufallsRunden(x, rng) {
  const ganz = Math.floor(x + 1e-9);
  return ganz + (rng() < x - ganz - 1e-9 ? 1 : 0);
}

function runde(x, n) {
  const f = 10 ** n;
  return Math.round(x * f) / f;
}

function zahl(x) {
  return String(x).replace('.', ',');
}
