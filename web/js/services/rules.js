// Hafenmeister: Regeln fuer Services und Sonderanlagen. Reine Logik ohne Three.js und ohne DOM,
// laeuft auch unter Node (tests/services.test.mjs).
//
// Zustand (wird mit dem Spielstand gespeichert, nur einfache Werte):
//   { gebaut: { travellift: 2, ... }, besuche: { kreuzfahrtterminal: 12 }, summe: { travellift: 4800 } }
//   gebaut   = erreichte Ausbaustufe je Service (fehlt = nicht gebaut)
//   besuche  = Spieltag des naechsten regelmaessigen Besuchs je Service
//   summe    = Einnahmen seit Spielbeginn je Service (fuer die Baukarte und Erfolge)
//   bezahlt  = Baukosten bisher je Service (Bilanz auf der Karte, P23 F9; fehlt in alten Spielstaenden)
//   verlauf  = Einnahmen der letzten Saisontage je Service (Bilanz: "bezahlt sich in etwa n Tagen")
//   krantag  = letzte Krantag-Einnahme je Service (P20 H5), zählt in der Bilanz anteilig statt im Tagesschnitt
//   heute    = { tag, je: { id: { betrag, teile } } } letzte Abrechnung (Karte: "Heute: 14 Kunden")
//
// Kontext beim Bauen: { stufe, ruf, geld }   stufe = Ausbaustufe des Hafens 1 bis 6, ruf 0 bis 5
// Tagesdaten fuer die Abrechnung:
//   { tag, wetter: 'sonne'|'regen'|'sturm', winter: false,
//     boote: [{ id, klasse: 'S', antrieb: 'segel', dienste: { mastenkran: 'offen' } }] }
// dienste kommen aus den Spielregeln (boat.dienste, gesetzt beim Ankommen ueber dienstBeiAnkunft).
import { SERVICES, RUF_BONUS_MAX, STURMSCHUTZ_MAX, WAHLPLAETZE } from '../data/services.js';
import { zufallAus } from '../random.js';

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

// Besuchsarten, deren Tagesgaeste in den Ort gehen und dort Geld lassen (wirkung.tagesgaeste, P23 F7).
// Die taegliche Ausflugsfahrt gehoert nicht dazu: ihre Gaeste kommen schon ueber den Kiosk.
export const TAGESGAESTE_BESUCHE = ['kreuzfahrt', 'flottenbesuch', 'windjammer', 'tag-der-seenotretter'];
// So viele Saisontage merkt sich die Bilanz je Service
const VERLAUF_TAGE = 6;

export function erstelleRegeln(katalog = SERVICES, wahlplaetze = WAHLPLAETZE) {
  const byId = Object.fromEntries(katalog.map((s) => [s.id, s]));
  const wahlen = wahlplaetze.filter((w) => w.optionen.every((o) => byId[o.id]));

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
    const umbau = wahlKonflikt(z, id, n + 1);
    return { ok: fehlt.length === 0 && !geldFehlt, freigeschaltet: fehlt.length === 0, geldFehlt,
      stufe: n + 1, def, kosten: def.kosten, fehlt, ...(umbau ? { umbau } : {}) };
  }

  // Entweder-oder (F3): Wahlplatz, zu dem diese Ausbaustufe gehoert, oder null
  function wahlplatz(id, stufe) {
    return wahlen.find((w) => w.optionen.some((o) => o.id === id && o.stufe === stufe)) ?? null;
  }
  // Belegt ein anderer Service schon den Wahlplatz dieser Stufe? Dann { platz, id, name, auf, aufName }:
  // so weit wird er beim Bau zurueckgebaut (auf 0 = abgerissen).
  function wahlKonflikt(z, id, stufe) {
    const w = wahlplatz(id, stufe);
    if (!w) return null;
    for (const o of w.optionen) {
      if (o.id === id || stufeVon(z, o.id) < o.stufe) continue;
      const s = byId[o.id];
      const auf = o.stufe - 1;
      return { platz: w.id, platzName: w.name, id: o.id, name: s.stufen[stufeVon(z, o.id) - 1]?.name ?? s.name,
        auf, aufName: auf > 0 ? s.stufen[auf - 1].name : null };
    }
    return null;
  }
  // Fuer Karte und Baumenue: die andere Option eines Wahlplatzes, solange der Platz noch frei ist
  function wahlAlternative(z, id, stufe) {
    const w = wahlplatz(id, stufe);
    if (!w) return null;
    const o = w.optionen.find((x) => x.id !== id);
    const s = byId[o.id];
    return { platz: w.id, platzName: w.name, text: w.text, id: o.id, name: s.stufen[o.stufe - 1]?.name ?? s.name,
      gebaut: stufeVon(z, o.id) >= o.stufe };
  }

  // Baut die naechste Stufe. Zieht kein Geld ab, das macht der Aufrufer mit dem gelieferten Betrag.
  function bauen(z, id, kontext = {}) {
    const p = pruefe(z, id, kontext);
    if (!p.ok) return p;
    z.bezahlt ??= bezahltAlt(z);
    // Wahlplatz: die andere Option weicht (zurueckgebaut auf die Stufe vor dem Wahlplatz)
    if (p.umbau) {
      const u = p.umbau;
      if (u.auf > 0) z.gebaut[u.id] = u.auf; else delete z.gebaut[u.id];
      const b2 = u.auf > 0 ? byId[u.id].stufen[u.auf - 1].wirkung?.besuch : null;
      if (!b2) delete z.besuche[u.id];
    }
    z.gebaut[id] = p.stufe;
    z.bezahlt[id] = (z.bezahlt[id] ?? 0) + (p.kosten ?? 0);
    const besuch = p.def.wirkung?.besuch;
    if (besuch && kontext.tag != null) z.besuche[id] = kontext.tag + (besuch.ersterNach ?? besuch.alleTage);
    return { ...p, ok: true };
  }

  // Alte Spielstaende ohne bezahlt: Preise der gebauten Stufen aus dem Katalog
  function bezahltAlt(z) {
    const out = {};
    for (const id of Object.keys(z.gebaut)) {
      if (!byId[id]) continue;
      out[id] = byId[id].stufen.slice(0, stufeVon(z, id)).reduce((a, st) => a + (st.kosten ?? 0), 0);
    }
    return out;
  }

  // Liste fuer das Baumenue: alles, was in dieser Hafenstufe sichtbar ist (auch noch gesperrt),
  // sortiert nach Hafenstufe. Services spaeterer Stufen bleiben verborgen, damit es Ueberraschungen gibt.
  function liste(z, kontext = {}) {
    return katalog
      .filter((s) => s.abStufe <= (kontext.stufe ?? 1) || stufeVon(z, s.id) > 0)
      .map((s) => ({ id: s.id, name: s.name, kurz: s.kurz, gruppe: s.gruppe, stufe: stufeVon(z, s.id),
        maxStufe: s.stufen.length, aktuell: aktiveStufe(z, s.id)?.name ?? null, naechste: pruefe(z, s.id, kontext),
        oder: stufeVon(z, s.id) < s.stufen.length ? wahlAlternative(z, s.id, stufeVon(z, s.id) + 1) : null }))
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
    // Gebaute Angebote mit Stufe: erfüllen Wünsche der Gäste (sim.js offerWishMet, P19 C3)
    e.angebote = { ...z.gebaut };
    // Wahlplatz mit wunschTeilen (Café oder Eisdiele): wer sich das andere wünscht, ist auch zufrieden
    for (const w of wahlen) {
      if (!w.wunschTeilen) continue;
      const da = w.optionen.find((o) => stufeVon(z, o.id) >= o.stufe);
      if (da) for (const o of w.optionen) if (!e.angebote[o.id]) e.angebote[o.id] = o.stufe;
    }
    e.sturmschutz = Math.min(e.sturmschutz, STURMSCHUTZ_MAX);
    for (const k of Object.keys(e.gaeste)) e.gaeste[k] = runde(e.gaeste[k], 3);
    return e;
  }

  // Einnahme eines Service aus seinem Tagesgeschaeft (ohne Besuche): { betrag, teile, kunden }.
  // tg = Tagesgaeste grosser Schiffe heute (F7), abend = Faktor fuer Abendgaeste.
  function ertrag(z, id, w, tag, rng, tg = 0) {
    const wetter = tag.wetter ?? 'sonne';
    const boote = tag.boote ?? [];
    let betrag = 0, kunden = 0, trailer = 0, abendgaeste = 0;
    const teile = [];
    const wf = (tab) => tab?.[wetter] ?? 1;
    // Dauerlieger (P20 H5): tag.dauerlieger = [{ klasse, antrieb, imHafen, winterlager, kuendigung }]
    const dl = w.dauerlieger;
    const dauer = (tag.dauerlieger ?? []).filter((d) => !dl?.nur || passt(d, dl.nur));
    let dauerlieger = 0;
    if (tag.winter) {
      // Im Winter laufen nur Winterlager und Werft, alles andere ruht.
      if (w.winter?.proTag) { betrag += w.winter.proTag; teile.push('Winter'); }
      if (dl?.winter) {
        dauerlieger = dauer.filter((d) => d.winterlager).length;
        if (dauerlieger) { betrag += dauerlieger * dl.winter; teile.push(`${dauerlieger} Dauerlieger an Land`); }
      }
      return { betrag, teile, kunden, trailer, abendgaeste, dauerlieger };
    }
    if (dl?.krantage && krantag(tag)) {
      // Erster Saisontag: Boote und Masten kommen wieder hinein; letzter: heraus (nicht wer gekündigt hat)
      dauerlieger = dauer.filter((d) => !(d.kuendigung && krantag(tag) === 'herbst')).length;
      if (dauerlieger) { betrag += dauerlieger * dl.preis; teile.push(`Krantag: ${dauerlieger} Dauerlieger`); }
    } else if (dl?.anteil) {
      dauerlieger = zufallsRunden(dauer.filter((d) => d.imHafen).length * dl.anteil, rng);
      if (dauerlieger) { betrag += dauerlieger * dl.preis; teile.push(dauerlieger === 1 ? '1 Dauerlieger' : `${dauerlieger} Dauerlieger`); }
    }
    if (w.proTag) {
      const f = wf(w.wetter);
      if (f > 0) { betrag += w.proTag * f; teile.push('Tagesgeschäft'); }
    }
    // Auslastung (F5): Kunden sind ein Anteil der Crews im Hafen, bei schlechtem Wetter weniger
    if (w.kunden) {
      const passend = boote.filter((b) => passt(b, w.kunden.nur)).length;
      kunden = zufallsRunden(passend * w.kunden.anteil * wf(w.kunden.wetter), rng);
      if (kunden > 0) {
        let f = 1;
        for (const syn of w.synergie ?? []) if (stufeVon(z, syn.id) > 0) f *= syn.faktor;
        betrag += kunden * w.kunden.preis * f;
        teile.push(kunden === 1 ? '1 Crew' : `${kunden} Crews`);
      }
    }
    if (w.trailer) {
      trailer = menge(w.trailer, wetter, tag.tag, id, 1, tag.erwartet);
      if (trailer > 0) { betrag += trailer * w.trailer.preis; teile.push(trailer === 1 ? '1 Trailerboot' : `${trailer} Trailerboote`); }
    }
    if (w.abendgaeste) {
      abendgaeste = menge(w.abendgaeste, wetter, tag.tag, id, 2, tag.erwartet);
      if (abendgaeste > 0) { betrag += abendgaeste * w.abendgaeste.preis; teile.push(`${abendgaeste} Gäste am Abend`); }
    }
    if (w.tagesgaeste && tg > 0) {
      const ein = (tg / 100) * w.tagesgaeste * wf(w.wetter);
      if (ein > 0) { betrag += ein; teile.push('Tagesgäste'); }
    }
    return { betrag, teile, kunden, trailer, abendgaeste, dauerlieger };
  }

  // Krantag (P20 H5): 'fruehling' am ersten Saisontag, 'herbst' am letzten, sonst null
  function krantag(tag) {
    if (tag.winter || !tag.saisonTag) return null;
    if (tag.saisonTag === 1) return 'fruehling';
    if (tag.saisonTage && tag.saisonTag === tag.saisonTage) return 'herbst';
    return null;
  }

  // Trailerboote und Abendgaeste: feste Zahl je Tag und Service (nicht aus rng), damit die Ansicht schon
  // morgens weiss, wie viele Boote am Slip ins Wasser gehen, und abends genau diese abgerechnet werden.
  function menge(def, wetter, tag = 0, id = '', art = 0, erwartet = false) {
    if (!def) return 0;
    const x = def.anzahl * (def.wetter?.[wetter] ?? 1);
    if (erwartet) return x;
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return zufallsRunden(x, zufallAus(((tag * 104729) ^ (h * 7919) ^ (art * 15485863)) >>> 0));
  }
  // Fuer die Ansicht: wie viele Trailerboote (art 'trailer') oder Abendgaeste ('abendgaeste') heute
  function mengeHeute(z, id, art, tag, wetter = 'sonne') {
    const w = aktiveStufe(z, id)?.wirkung;
    return w?.[art] ? menge(w[art], wetter, tag, id, art === 'trailer' ? 1 : 2) : 0;
  }

  // Abrechnung am Ende eines Spieltags. rng = Zufallszahl 0..1 (fuer Spielstaende mit festem Samen).
  // Liefert { tag, einnahmen: [{ id, betrag, text }], summe, besuche: [...], angekuendigt: [...],
  //   dienstBezahlt: [{ boatId, id, betrag }], mengen: { id: { trailer, abendgaeste, kunden } } }
  // Keine laufenden Kosten (plan.md, Leitlinien): Services bringen nur etwas ein.
  // Ohne rng: fester Zufall aus Spieltag und z.seed, damit dieselbe Abrechnung gleich ausfällt.
  function tagesabschluss(z, tag, rng = zufallAus(((z.seed ?? 0) * 7919 + (tag.tag ?? 0) * 104729) >>> 0)) {
    const wetter = tag.wetter ?? 'sonne';
    const boote = tag.boote ?? [];
    const out = { tag: tag.tag, einnahmen: [], summe: 0, besuche: [], angekuendigt: [], dienstBezahlt: [], mengen: {} };
    const je = {};
    const plus = (id, betrag, teil) => {
      const e = (je[id] ??= { betrag: 0, teile: [] });
      e.betrag += betrag;
      if (teil) e.teile.push(teil);
    };

    // 1. Regelmaessige Besuche (Kreuzfahrtschiff, Flottenbesuch, Ausflugsfahrt ...) zuerst: ihre
    //    Tagesgaeste lassen heute auch bei Café, Eisdiele und Fischhalle Geld (F7)
    let tagesgaeste = 0;
    for (const id of Object.keys(z.gebaut)) {
      const s = byId[id];
      const b = aktiveStufe(z, id)?.wirkung?.besuch;
      if (!s || !b || tag.winter) continue;
      const w = aktiveStufe(z, id).wirkung;
      if (z.besuche[id] == null) z.besuche[id] = tag.tag + (b.ersterNach ?? b.alleTage);
      if (z.besuche[id] <= tag.tag) {
        if (wetter === 'sturm') {
          z.besuche[id] = tag.tag + 1;       // bei Sturm einen Tag spaeter, keine Strafe
        } else {
          const f = w.wetter?.[wetter] ?? 1;
          const ein = Math.round(b.einnahme * f);
          const gaeste = Math.round((b.gaeste ?? 0) * f);
          plus(id, ein, b.text);
          out.besuche.push({ id, art: b.art, tag: tag.tag, dauer: b.dauer ?? 1, einnahme: ein,
            gaeste, ruf: b.ruf ?? 0, text: b.text });
          if (TAGESGAESTE_BESUCHE.includes(b.art)) tagesgaeste += gaeste;
          z.besuche[id] = tag.tag + b.alleTage;
          z.anzahl ??= {};
          z.anzahl[b.art] = (z.anzahl[b.art] ?? 0) + 1;     // Zähler je Besuchsart (Stufenziel)
        }
      }
      if (z.besuche[id] === tag.tag + 1 && b.alleTage > 1) {
        out.angekuendigt.push({ id, art: b.art, tag: tag.tag + 1, text: b.text });
      }
    }
    out.tagesgaeste = tagesgaeste;

    // 2. Tagesgeschaeft je Service
    for (const id of Object.keys(z.gebaut)) {
      const st = aktiveStufe(z, id);
      if (!byId[id] || !st) continue;
      const r = ertrag(z, id, st.wirkung ?? {}, tag, rng, tagesgaeste);
      if (r.betrag > 0) plus(id, r.betrag, r.teile.join(', '));
      const m = {};
      for (const k of ['kunden', 'trailer', 'abendgaeste', 'dauerlieger']) if (r[k]) m[k] = r[k];
      if (Object.keys(m).length) out.mengen[id] = m;
      // Krantag (P20 H5): für die Meldung im Spiel
      if (r.dauerlieger && st.wirkung?.dauerlieger?.krantage && krantag(tag)) {
        (out.krantag ??= { art: krantag(tag), boote: 0, betrag: 0, services: [] });
        out.krantag.boote = Math.max(out.krantag.boote, r.dauerlieger);
        out.krantag.betrag += r.dauerlieger * st.wirkung.dauerlieger.preis;
        (out.krantagJe ??= {})[id] = r.dauerlieger * st.wirkung.dauerlieger.preis;
        out.krantag.services.push(id);
      }
    }

    // 3. Dienste an Gastbooten (F2): jedes Boot zahlt seinen Dienst am ersten Abend im Hafen
    if (!tag.winter) {
      const zahl = {};
      for (const boot of boote) {
        for (const [id, zustand] of Object.entries(boot.dienste ?? {})) {
          const d = aktiveStufe(z, id)?.wirkung?.dienst;
          if (zustand !== 'offen' || !d) continue;
          plus(id, d.preis);
          zahl[id] = (zahl[id] ?? 0) + 1;
          out.dienstBezahlt.push({ boatId: boot.id, id, betrag: d.preis });
        }
      }
      for (const [id, n] of Object.entries(zahl)) je[id].teile.push(diensteText(id, n));
    }

    for (const [id, e] of Object.entries(je)) {
      const betrag = Math.round(e.betrag);
      if (betrag <= 0) continue;
      out.einnahmen.push({ id, betrag, text: `${byId[id].name}: ${e.teile.filter(Boolean).join(', ')}` });
      z.summe[id] = (z.summe[id] ?? 0) + betrag;
    }
    out.summe = out.einnahmen.reduce((a, e) => a + e.betrag, 0);

    // Fuer Karte und Bilanz: heute je Service, Verlauf der Saisontage
    z.heute = { tag: tag.tag, winter: !!tag.winter, je: Object.fromEntries(out.einnahmen.map((e) => [e.id, { betrag: e.betrag, text: e.text }])) };
    if (!tag.winter) {
      z.verlauf ??= {};
      // Krantage (P20 H5) kommen nur zweimal je Saison: nicht in den Tagesschnitt, sondern anteilig (bilanz)
      const kran = out.mengen && krantag(tag) ? out.krantagJe ?? {} : {};
      for (const [id, b] of Object.entries(kran)) (z.krantag ??= {})[id] = b;
      if (tag.saisonTage) z.saisonTage = tag.saisonTage;
      for (const id of Object.keys(z.gebaut)) {
        const v = (z.verlauf[id] ??= []);
        v.push(Math.max(0, (out.einnahmen.find((e) => e.id === id)?.betrag ?? 0) - (kran[id] ?? 0)));
        while (v.length > VERLAUF_TAGE) v.shift();
      }
    }
    return out;
  }

  function diensteText(id, n) {
    const wort = { mastenkran: ['Mast gelegt', 'Masten gelegt'], fahrradverleih: ['Radtour', 'Radtouren'],
      travellift: ['Reparatur', 'Reparaturen'] }[id] ?? ['Auftrag', 'Aufträge'];
    return `${n} ${n === 1 ? wort[0] : wort[1]}`;
  }

  // Dienste (F2): Will ein Gast, der gerade ankommt, einen Dienst? boot: { id, klasse, antrieb, nights,
  // special, stationed }. Liefert { id, naechte } oder null. Fester Zufall aus Boot, Tag und laufender
  // Nummer der Ankunft (z.ankunftNr, im Spielstand), damit die
  // Spielregeln ihren eigenen Zufall nicht verbrauchen (Zeitraffer und Rechnung bleiben gleich).
  function dienstBeiAnkunft(z, boot, { tag = 0, wetter = 'sonne' } = {}) {
    if (!boot || boot.stationed || boot.special || !(boot.nights >= 1)) return null;
    // Laufende Nummer je Ankunft (die Spielregeln vergeben die Boots-id erst danach)
    z.ankunftNr = (z.ankunftNr ?? 0) + 1;
    const nr = z.ankunftNr;
    let k = 0;
    for (const s of katalog) {
      const d = aktiveStufe(z, s.id)?.wirkung?.dienst;
      if (!d) continue;
      k++;
      if (!passt(boot, d.nur)) continue;
      if (d.nur?.naechteMax != null && boot.nights > d.nur.naechteMax) continue;
      const p = d.anteil * (d.wetter?.[wetter] ?? 1);
      const r = zufallAus(((Number(boot.id) || 0) * 2654435761 + nr * 374761393 + tag * 40503 + k * 9973) >>> 0)();
      if (r < p) return { id: s.id, naechte: d.naechte ?? 1 };
    }
    return null;
  }

  // Bilanz fuer die Karte (F9): { bezahlt, verdient, proTag, tage } mit proTag = Schnitt der letzten
  // Saisontage und tage = so viele Saisontage noch, bis der Bau sich bezahlt hat (0 = schon bezahlt).
  function bilanz(z, id) {
    if (!(stufeVon(z, id) > 0)) return null;
    const bezahlt = (z.bezahlt ?? bezahltAlt(z))[id] ?? 0;
    const verdient = z.summe[id] ?? 0;
    const v = z.verlauf?.[id] ?? [];
    // dazu die Krantage (zwei je Saison, P20 H5) anteilig je Saisontag
    const kran = z.krantag?.[id] ? (2 * z.krantag[id]) / (z.saisonTage || 16) : 0;
    const proTag = v.length ? v.reduce((a, b) => a + b, 0) / v.length + kran : null;
    const rest = Math.max(0, bezahlt - verdient);
    const tage = rest === 0 ? 0 : proTag > 0 ? Math.ceil(rest / proTag) : null;
    return { bezahlt, verdient, proTag: proTag == null ? null : Math.round(proTag), tage, tageBisher: v.length };
  }

  // Schaetzung fuer die naechste Ausbaustufe (F9): was sie an einem Tag wie dem letzten bringen wuerde,
  // mit Besuchen im Schnitt (Einnahme / alleTage) und Diensten nach Anteil. Ohne Tagesdaten null.
  function schaetzung(z, id, tag) {
    const s = byId[id];
    const n = stufeVon(z, id);
    if (!s || n >= s.stufen.length || !tag) return null;
    const def = s.stufen[n];
    const w = def.wirkung ?? {};
    const mitte = () => 0.5;
    const tg = tag.tagesgaesteSchnitt ?? 0;
    let neu = ertrag(z, id, w, { ...tag, winter: false, erwartet: true }, mitte, tg).betrag;
    if (w.besuch) neu += (w.besuch.einnahme ?? 0) / Math.max(1, w.besuch.alleTage);
    if (w.dienst) neu += (tag.ankuenfte ?? []).filter((b) => passt(b, w.dienst.nur)).length * w.dienst.anteil * w.dienst.preis;
    let alt = 0;
    const a = aktiveStufe(z, id)?.wirkung;
    if (a) {
      alt = ertrag(z, id, a, { ...tag, winter: false, erwartet: true }, mitte, tg).betrag;
      if (a.besuch) alt += (a.besuch.einnahme ?? 0) / Math.max(1, a.besuch.alleTage);
      if (a.dienst) alt += (tag.ankuenfte ?? []).filter((b) => passt(b, a.dienst.nur)).length * a.dienst.anteil * a.dienst.preis;
    }
    const mehr = Math.max(0, Math.round(neu - alt));
    return { proTag: mehr, tage: mehr > 0 ? Math.ceil(def.kosten / mehr) : null, winter: w.winter?.proTag ?? 0 };
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

  return { katalog, byId, wahlen, stufeVon, aktiveStufe, pruefe, bauen, liste, effekte, tagesabschluss, naechsteBesuche, planeBesuch, lage,
    wahlplatz, wahlKonflikt, wahlAlternative, dienstBeiAnkunft, bilanz, schaetzung, mengeHeute };
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
