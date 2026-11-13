// Einstieg für den Modul-Lader in js/main.js (Eintrag './save/index.js').
// Startet Service Worker und Installation, richtet die Speicherplätze ein und hängt
// game.spielstand an. Ein Speicherweg für das ganze Spiel (docs/speichern.md).
//
// Andere Module nutzen:
//   game.spielstand.speichern(zustand)  -> true/false (aktiver Platz, ohne Argument game.state)
//   game.spielstand.laden()             -> { game, savedAt, ausSicherung } oder null (streng geprüft;
//                                          ein beschädigter Stand wird aufgehoben und gemeldet)
//   game.spielstand.vorhanden()         -> true, wenn der aktive Platz einen Stand hat
//   game.spielstand.oeffnen()           -> Fenster "Spielstände" (Menüknopf, Taste L)
//   game.spielstand.neuesSpiel()        -> Fenster direkt bei "Neues Spiel"
//   game.spielstand.probeKopie()        -> Probe-Kopie anlegen und dorthin wechseln
//   game.spielstand.platz()             -> { id, name, probeVon? } des laufenden Hafens
//   game.spielstand.plaetze()           -> Verzeichnis aller Plätze
//
// Wechsel, Neues Spiel und Probe laden die Seite neu, damit jedes Modul sauber neu startet.

import { hasSave, loadGame, rohText, SAVE_VERSION, requestPersistentStorage, storageAvailable } from './storage.js';
import { startPwa } from './pwa.js';
import {
  openSavePanel, openStart, showExportReminderIfDue, showUpdateBanner, showKaputtMeldung, showOhneSpeicherMeldung,
} from './save-panel.js';
import * as plaetze from './plaetze.js';
import { createState, deserialize } from '../state.js';

// Für den Fall, dass index.html die Zeilen noch nicht hat. Doppelt schadet nicht.
function ensureHeadLinks() {
  const add = (sel, tag, attrs) => {
    if (document.head.querySelector(sel)) return;
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    document.head.appendChild(e);
  };
  add('link[rel="manifest"]', 'link', { rel: 'manifest', href: 'manifest.webmanifest' });
  add('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' });
  add('link[rel="icon"]', 'link', { rel: 'icon', href: 'icons/icon.svg', type: 'image/svg+xml' });
  add('meta[name="apple-mobile-web-app-title"]', 'meta', { name: 'apple-mobile-web-app-title', content: 'Hafenmeister' });
}

// Namen für neue Häfen (erfunden, klingen nach Ostsee und Nordsee)
const VORNE = ['Möwen', 'Dünen', 'Schilf', 'Bernstein', 'Sturm', 'Leucht', 'Haff', 'Kranich', 'Seeschwalben', 'Strandhafer', 'Kliff', 'Reet', 'Hering', 'Muschel', 'Nehrungs', 'Brise'];
const HINTEN = ['hafen', 'hafen', 'hafen', 'ort', 'wiek', 'bucht', 'sund', 'deich', 'grund'];
export function namensVorschlag(zufall = Math.random) {
  const v = VORNE[Math.floor(zufall() * VORNE.length)];
  const h = HINTEN[Math.floor(zufall() * HINTEN.length)];
  return `${v}${h}`;
}

/** Seite ohne Testzusätze (?stufe=, ?einstieg=1 ...) neu laden. */
function neuStarten() {
  // Nach Wechsel oder Neuem Spiel nicht noch einmal "Weiter" fragen
  try { sessionStorage.setItem('hafenmeister.direkt', '1'); } catch { /* egal */ }
  try { location.replace(location.pathname); } catch { location.reload(); }
}

function direktGestartet() {
  try {
    const d = sessionStorage.getItem('hafenmeister.direkt');
    sessionStorage.removeItem('hafenmeister.direkt');
    return d === '1';
  } catch { return false; }
}

export function init(game) {
  ensureHeadLinks();

  plaetze.einrichten({ namensVorschlag });

  const aktuell = () => game.state;
  // Testmodus ?stufe=n (state.testmodus, js/bridge.js) überschreibt den echten Spielstand nicht
  const testmodus = () => !!aktuell()?.testmodus;
  // Spiel anhalten, solange eine Meldung offen ist, danach wie vorher weiter (wie der Pause-Knopf)
  function anhalten() {
    let warPausiert = true;
    return {
      pause: () => { warPausiert = !!game.paused; if (!warPausiert) game.setPaused?.(true); },
      weiter: () => { if (!warPausiert) game.setPaused?.(false); },
    };
  }

  // Merkt sich, ob das letzte Speichern geklappt hat (Privatmodus, Speicher voll oder gesperrt)
  let speichernGeht = storageAvailable();
  let ohneSpeicherGemeldet = false;
  const speichern = (zustand = aktuell()) => {
    if (!zustand || zustand.testmodus) return false;
    if (!plaetze.diesesTabAktiv()) return false; // anderer Tab spielt: kein Fehler
    const ok = plaetze.speichernAktiv(zustand);
    speichernGeht = ok;
    if (!ok && !ohneSpeicherGemeldet && document.readyState !== 'loading') {
      ohneSpeicherGemeldet = true;
      showOhneSpeicherMeldung({ getGame: aktuell, ...anhalten() });
    }
    return ok;
  };

  // Laden mit derselben strengen Prüfung wie state.js. Ließ sich der Stand nicht laden,
  // wird sein Text aufgehoben und der Spieler bekommt nach dem Start eine Meldung.
  let ladeMeldung = null; // { art: 'verloren' | 'sicherung', name, savedAt }
  function laden() {
    const roh = rohText();
    const r = loadGame({ pruefen: (spiel) => deserialize(JSON.stringify(spiel)) });
    if (roh !== null && (!r || r.ausSicherung)) {
      // Name nur, wenn er sicher zu diesem Stand gehört (Verzeichnis kannte ihn), sonst aus dem Text
      const e = plaetze.aktiverPlatz();
      const ausText = /"harborName":"((?:[^"\\]|\\.){1,64})"/.exec(roh)?.[1];
      const name = e?.info ? e.name : (ausText ? plaetze.nameSauber(ausText.replace(/\\(.)/g, '$1')) : null);
      plaetze.kaputtMerken(roh, name);
      let version = 0;
      try { version = JSON.parse(roh)?.version; } catch { /* Müll */ }
      const zuNeu = Number.isInteger(version) && version > SAVE_VERSION;
      // Stand aus einer neueren Version (anderer Tab mit neuem Spiel): hier nichts überschreiben,
      // nach dem Neuladen lädt die neue Version ihn wieder
      if (zuNeu) plaetze.sperren();
      ladeMeldung = { art: zuNeu ? 'zu-neu' : r ? 'sicherung' : 'verloren', name, savedAt: r?.savedAt ?? null };
    }
    return r;
  }

  // Vorschaubild des laufenden Hafens: kleines JPEG aus dem 3D-Bild
  function bildMachen() {
    try {
      if (testmodus() || !game.renderer || !game.canvas || !plaetze.diesesTabAktiv()) return;
      game.renderer.render(game.scene, game.camera.camera);
      const src = game.canvas;
      if (!src.width || !src.height) return;
      const c = document.createElement('canvas');
      c.width = 144; c.height = 96;
      const ctx = c.getContext('2d');
      const z = Math.min(src.width / 3, src.height / 2); // Ausschnitt 3:2 aus der Mitte
      ctx.drawImage(src, (src.width - 3 * z) / 2, (src.height - 2 * z) / 2, 3 * z, 2 * z, 0, 0, 144, 96);
      const e = plaetze.aktiverPlatz();
      if (e) plaetze.bildSpeichern(e.id, c.toDataURL('image/jpeg', 0.7));
    } catch { /* ohne Bild */ }
  }

  /** Prüft einen Stand so streng wie beim Laden (state.js), bevor er übernommen wird. */
  function pruefeStand(spiel) {
    try { deserialize(JSON.stringify(spiel)); } catch (err) {
      throw new Error(`Dieser Hafen lässt sich nicht laden (${String(err?.message ?? err).replace(/^Spielstand /, '')}).`);
    }
  }

  /** Neuen Hafen anlegen und starten. stegbild: 1 bis n, gelaende: Küstenform 1 bis 10, einstieg: Einführung zeigen. */
  function neuesSpielAnlegen({ name, stegbild, gelaende, einstieg = true }) {
    const st = createState();
    st.harborName = name;
    st.modules = st.modules ?? {};
    if (Number.isInteger(stegbild) && stegbild >= 1) st.modules.stegbild = { nr: stegbild };
    if (Number.isInteger(gelaende) && gelaende >= 1) st.modules.gelaende = { nr: gelaende };
    if (!einstieg) st.modules.einstieg = { fertig: true, erledigt: [] };
    const id = plaetze.platzAnlegen(st, { name });
    bildMachen();
    try { plaetze.wechseln(id, testmodus() ? null : aktuell()); } catch (err) {
      plaetze.loeschen(id);
      plaetze.endgueltigLoeschen(id);
      throw err;
    }
    neuStarten();
  }

  const panel = (start) => openSavePanel({
    start,
    getGame: aktuell,
    testmodus,
    speichern,
    speichernGeht: () => speichernGeht && storageAvailable(),
    plaetze,
    namensVorschlag,
    stegbildAnzahl: () => game.stegbild?.anzahl ?? 0,
    neuesSpiel: neuesSpielAnlegen,
    wechseln: (id) => {
      const r = plaetze.platzLesen(id);
      if (!r) throw new Error('Dieser Hafen ist leer oder beschädigt.');
      pruefeStand(r.game);
      bildMachen();
      plaetze.wechseln(id, testmodus() ? null : aktuell());
      neuStarten();
    },
    pruefeStand,
    probeKopie: () => probeKopie(),
    probeVerwerfen: () => { plaetze.probeVerwerfen(); neuStarten(); },
    probeUebernehmen: () => {
      const name = plaetze.probeUebernehmen(testmodus() ? null : aktuell());
      zeigeProbe();
      return name;
    },
    umbenannt: (name) => {
      const st = aktuell();
      if (st && !st.testmodus) { st.harborName = name; speichern(st); }
      game.emit('spielstand-name', name);
    },
  });

  function probeKopie() {
    if (testmodus()) throw new Error('Im Testmodus gibt es keine Probe-Kopie.');
    speichern();
    bildMachen();
    const v = plaetze.verzeichnis();
    const id = plaetze.kopieren(v.aktiv, { probe: true });
    plaetze.wechseln(id, null);
    neuStarten();
  }

  game.spielstand = {
    speichern,
    laden,
    vorhanden: hasSave,
    oeffnen: () => panel('liste'),
    neuesSpiel: () => panel('neu'),
    probeKopie,
    platz: () => { const e = plaetze.aktiverPlatz(); return e ? { ...e } : null; },
    plaetze: () => plaetze.verzeichnis(),
  };

  // Beim Verlassen oder Sperren des Handys sichern, falls es schon einen Zustand gibt.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { speichern(); bildMachen(); }
  });
  // Nach jedem Kauf und jedem Stufenaufstieg sofort sichern (nicht erst abends)
  let sichernGeplant = false;
  const baldSichern = () => {
    if (sichernGeplant) return;
    sichernGeplant = true;
    setTimeout(() => { sichernGeplant = false; speichern(); }, 0);
  };
  game.on('sim:built', baldSichern);
  game.on('sim:stageUp', () => { baldSichern(); setTimeout(bildMachen, 3000); });
  game.on('sim:change', (d) => { if (d?.reason === 'spend') baldSichern(); });
  // Abends ein frisches Vorschaubild
  game.on('phase', (p) => { if (p === 'abend') setTimeout(bildMachen, 1500); });
  window.addEventListener('pagehide', () => speichern());

  startPwa({
    onUpdate: (apply) => showUpdateBanner(() => { speichern(); apply(); }),
  });
  requestPersistentStorage();

  // Schild "Probe" links, solange eine Probe-Kopie läuft: ein Tipp öffnet die Spielstände
  let probeSchild = null;
  function zeigeProbe() {
    const e = plaetze.aktiverPlatz();
    const seite = document.getElementById('hm-seite');
    const soll = !!e?.probeVon && !testmodus();
    if (!soll) { probeSchild?.remove(); probeSchild = null; return; }
    if (!probeSchild) {
      probeSchild = document.createElement('button');
      probeSchild.type = 'button';
      probeSchild.id = 'hm-probe';
      probeSchild.className = 'hm-px hm-chip hm-probe-chip';
      probeSchild.innerHTML = '<i class="hm-sym" aria-hidden="true" style="--sym: var(--px-spielstand)"></i><span>Probe-Kopie</span>';
      probeSchild.title = 'Du spielst eine Probe-Kopie. Tippen zum Übernehmen oder Verwerfen.';
      probeSchild.addEventListener('click', () => panel('liste'));
    }
    if (seite && probeSchild.parentNode !== seite) seite.append(probeSchild);
    else if (!seite && !probeSchild.parentNode) document.body.append(probeSchild);
  }

  // Nach dem Laden: Name in den Spielstand, Fenstertitel, Probe-Schild, Erinnerung (einmal).
  // state.js lädt asynchron, darum auf 'ready' und auf das erste 'sim:change' (load) hören.
  let erinnert = false;
  function nachLaden() {
    const st = aktuell();
    if (!st) return;
    if (!st.testmodus) {
      const e = plaetze.aktiverPlatz();
      if (e && st.harborName !== e.name) st.harborName = e.name;
      if (e?.name) document.title = `${e.name} · Hafenmeister`;
    }
    zeigeProbe();
    if (erinnert) return;
    erinnert = true;
    // Beschädigter Stand oder Browser ohne Speicher geht vor jeder anderen Frage
    if (ladeMeldung && !st.testmodus) {
      showKaputtMeldung({ ...ladeMeldung, kaputt: plaetze.kaputtLesen, ...anhalten() });
      return;
    }
    if (!storageAvailable() && !st.testmodus && !ohneSpeicherGemeldet) {
      ohneSpeicherGemeldet = true;
      showOhneSpeicherMeldung({ getGame: aktuell, ...anhalten() });
      return;
    }
    // Safari-Erinnerung erst, wenn es den Hafen schon ein paar Tage gibt (nicht beim ersten Start)
    const seit = Date.parse(plaetze.aktiverPlatz()?.erstellt ?? '');
    const alt = !Number.isNaN(seit) && Date.now() - seit > 3 * 86400000;
    if (!(alt && showExportReminderIfDue({ getGame: aktuell }))) startFrage(st);
    if (!plaetze.bildLesen(plaetze.aktiverPlatz()?.id ?? '')) setTimeout(bildMachen, 4000);
  }
  // Start mit "Weiter": nur wenn es mehrere Häfen gibt und die Seite normal geöffnet wurde
  const direkt = direktGestartet();
  function startFrage(st) {
    if (direkt || st.testmodus || navigator.webdriver || location.search) return;
    const v = plaetze.verzeichnis();
    if (v.plaetze.length < 2) return;
    // Spiel pausieren wie mit dem Pause-Knopf (Anzeige stimmt), danach wie vorher weiter
    const warPausiert = !!game.paused;
    if (!warPausiert) game.setPaused?.(true);
    const weiter = () => { if (!warPausiert) game.setPaused?.(false); };
    openStart({
      eintrag: plaetze.aktiverPlatz(),
      info: plaetze.infoAus(st),
      bild: plaetze.bildLesen(v.aktiv),
      anzahl: v.plaetze.length,
      weiter,
      andere: () => { weiter(); panel('liste'); },
      neu: () => { weiter(); panel('neu'); },
    });
  }

  game.on('ready', nachLaden);
  game.on('sim:change', (d) => { if (d?.reason === 'load') nachLaden(); });
  game.on('spielstand-name', (name) => { document.title = `${name} · Hafenmeister`; });
}
