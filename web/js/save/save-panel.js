// Fenster "Spielstände": Speicherplätze wechseln, neu starten, umbenennen, kopieren,
// überschreiben, löschen, als Datei sichern und laden, Probe-Kopie, als App installieren.
// Dazu der Ablauf "Neues Spiel" mit Hafenname, Stegbild und Einführung.
// Aussehen im Pixel-Stil der Oberfläche (docs/ui/oberflaeche.md), mit Ersatzfarben ohne sie.
//
// Geöffnet von save/index.js (game.spielstand.oeffnen / neuesSpiel). Die Logik der Plätze
// steckt in save/plaetze.js, dieses Fenster zeigt sie nur.

import {
  exportGame, exportDatei, sammlungText, exportFileName, pickAndImport, SaveError, daysSinceExport,
} from './storage.js';
import {
  installState, promptInstall, onInstallStateChange, exportReminderDue, IOS_INSTALL_TEXT,
} from './pwa.js';
import { STEGBILDER } from '../data/stegbilder.js';
import { HAFEN } from '../data/harbor.js';
import { ECONOMY } from '../data/economy.js';
import { FORMEN } from '../render/landschaft/formen.js';

const CSS = `
.hm-save-backdrop{position:fixed;inset:0;background:rgba(20,34,50,.5);display:flex;
  align-items:center;justify-content:center;z-index:1000;
  padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))
    max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
.hm-sp-start .hm-sp{max-width:400px}
.hm-sp{--sp-tinte:var(--hm-tinte,#24364a);--sp-papier:var(--hm-papier,#fffaf0);--sp-mulde:var(--hm-mulde,#e9dfca);
  --sp-meer:var(--hm-meer,#23897d);--sp-koralle:var(--hm-koralle,#ee6454);--sp-px:var(--hm-px,2px);
  position:relative;display:flex;flex-direction:column;width:100%;max-width:480px;max-height:100%;
  background:var(--sp-papier);color:var(--sp-tinte);font:500 15px/1.4 var(--hm-text,system-ui,sans-serif);
  box-shadow:0 0 0 2px var(--sp-tinte),0 6px 0 rgba(0,0,0,.25)}
.hm-neu .hm-sp.hm-px{box-shadow:0 6px 0 rgba(0,0,0,.25)}
.hm-sp *{box-sizing:border-box}
.hm-sp-kopf{display:flex;align-items:center;gap:10px;padding:12px 12px 8px 16px}
.hm-sp h2{flex:1;margin:0;font:600 22px/1.2 var(--hm-pixel,system-ui,sans-serif)}
.hm-sp h3{margin:16px 0 6px;font:600 16px/1.2 var(--hm-pixel,system-ui,sans-serif)}
.hm-sp-inhalt{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 16px 16px}
.hm-sp p{margin:0 0 10px}
.hm-sp .hm-sp-info{font-size:13px;color:var(--hm-tinte-2,#5a6a7c)}
.hm-sp .hm-sp-msg{min-height:0;margin:0 0 10px;padding:8px 10px;background:#e2f2ee;font-size:14px}
.hm-sp .hm-sp-msg.fehler{background:#fdecea;color:#b3261e}
.hm-sp .hm-sp-msg:empty{display:none}
.hm-sp button{font:600 15px/1.2 var(--hm-pixel,system-ui,sans-serif);color:inherit;cursor:pointer}
.hm-sp .hm-sp-k{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;
  padding:0 12px;background:var(--sp-mulde);text-align:center}
body:not(.hm-neu) .hm-sp .hm-sp-k{border:0}
.hm-neu .hm-sp .hm-sp-k.hm-px{background:none;padding:0 10px}
.hm-sp .hm-sp-k.hm-primaer{background:var(--sp-meer);color:#fff}
.hm-neu .hm-sp .hm-sp-k.hm-px.hm-primaer{background:none;border-image-source:var(--rahmen-meer);color:#fff}
.hm-sp .hm-sp-k.hm-gefahr{color:#b8473a}
.hm-neu .hm-sp .hm-sp-k.hm-px.hm-gefahr{border-image-source:var(--rahmen-hell)}
.hm-sp .hm-sp-k:disabled{opacity:.45;cursor:default}
.hm-sp .hm-sp-k.breit{display:flex;width:100%;margin-top:8px}
.hm-sp .hm-sp-reihe{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.hm-sp .hm-sp-reihe>.hm-sp-k{flex:1 1 auto}
.hm-sp .hm-sp-zu{flex:none;width:44px;height:44px;border:0;background:var(--sp-mulde);font-size:0;display:grid;place-items:center}
.hm-sp .hm-sp-zu::before{content:"";width:18px;height:18px;background:currentColor;
  -webkit-mask:var(--px-zu,none) center/contain no-repeat;mask:var(--px-zu,none) center/contain no-repeat}
.hm-sp .hm-sp-zu:not([data-sym])::after{content:"\\00d7";font-size:26px;line-height:1}
.hm-sp .hm-sp-zurueck{border:0;background:none;padding:0 8px 0 0;min-height:44px;color:var(--sp-meer)}
.hm-sp-platz{margin:0 0 8px;padding:10px 12px;background:#fff;box-shadow:inset 0 0 0 var(--sp-px) rgba(36,54,74,.22)}
.hm-sp-platz.aktiv{background:#e2f2ee;box-shadow:inset 0 0 0 var(--sp-px) var(--sp-meer)}
.hm-sp-platz-kopf{display:flex;align-items:center;gap:8px}
.hm-sp-platz-text{flex:1;min-width:0}
.hm-sp-bild{flex:none;width:72px;height:48px;object-fit:cover;image-rendering:pixelated;background:#5eb0bd;
  box-shadow:inset 0 0 0 var(--sp-px) rgba(36,54,74,.35)}
img.hm-sp-bild{box-shadow:0 0 0 var(--sp-px) rgba(36,54,74,.35)}
.hm-sp-platz.korb{background:#f6f1e6}
@media (max-width:380px){.hm-sp-bild{width:56px;height:40px}}
.hm-sp-name{display:block;font:600 17px/1.25 var(--hm-pixel,system-ui,sans-serif);overflow-wrap:anywhere}
.hm-sp-zeile{display:block;font-size:13px;color:var(--hm-tinte-2,#5a6a7c)}
.hm-sp-marke{display:inline-block;margin:0 0 4px;padding:1px 6px;background:var(--sp-meer);color:#fff;
  font:600 12px/1.4 var(--hm-pixel,system-ui,sans-serif)}
.hm-sp-marke.probe{background:#f2c14e;color:var(--sp-tinte)}
.hm-sp .hm-sp-reihe>.hm-sp-mehr{flex:0 0 auto;min-width:88px}
.hm-sp-probe{margin:8px 0 0;padding:8px 10px;background:#fff6dc;box-shadow:inset 0 0 0 var(--sp-px) #cf9a2c}
.hm-sp-frage{margin-top:8px;padding:8px 10px;background:#fdecea}
.hm-sp-frage p{margin:0 0 4px}
.hm-sp input[type=text]{width:100%;min-height:44px;padding:8px 10px;border:0;border-radius:0;
  background:#fff;color:inherit;font:600 17px/1.2 var(--hm-pixel,system-ui,sans-serif);
  box-shadow:inset 0 0 0 var(--sp-px) var(--sp-tinte)}
.hm-sp input[type=text]:focus{outline:3px dashed var(--hm-gold,#f2c14e);outline-offset:2px}
.hm-sp-namezeile{display:flex;gap:6px}
.hm-sp-namezeile input{flex:1;min-width:0}
.hm-sp-stegbilder{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.hm-sp-steg{position:relative;padding:0;border:0;background:#5eb0bd;aspect-ratio:4/3;
  box-shadow:inset 0 0 0 var(--sp-px) rgba(36,54,74,.35)}
.hm-sp-steg canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}
.hm-sp-steg span{position:absolute;left:4px;top:3px;padding:0 4px;background:rgba(255,250,240,.9);font-size:12px}
.hm-sp-steg.zufall{display:grid;place-items:center;background:var(--sp-mulde);font-size:15px}
.hm-sp-steg.zufall span{position:static;background:none;font-size:15px}
.hm-sp-steg[aria-checked=true]{outline:calc(var(--sp-px) * 2) solid var(--sp-tinte);outline-offset:2px}
.hm-sp-steg[aria-checked=true]::after{content:"";position:absolute;right:4px;bottom:4px;width:12px;height:12px;
  background:var(--hm-gold,#f2c14e);box-shadow:0 0 0 2px var(--sp-tinte)}
.hm-sp-kueste{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
.hm-sp-kueste .hm-sp-k{min-height:40px;font-size:14px}
.hm-neu .hm-sp .hm-sp-kueste .hm-sp-k[aria-checked=true]{border-image-source:var(--rahmen-tinte);color:var(--sp-papier)}
body:not(.hm-neu) .hm-sp-kueste .hm-sp-k[aria-checked=true]{background:var(--sp-tinte);color:#fff}
.hm-sp label.hm-sp-haken{display:flex;align-items:center;gap:10px;min-height:44px;margin-top:8px;cursor:pointer}
.hm-sp label.hm-sp-haken input{width:22px;height:22px;accent-color:var(--sp-meer)}
.hm-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));
  width:calc(100% - 32px);max-width:520px;background:#16324a;color:#fff;border-radius:12px;padding:12px 14px;
  display:flex;gap:10px;align-items:center;z-index:999;font:15px/1.4 system-ui,sans-serif}
.hm-banner{flex-wrap:wrap;justify-content:flex-end}
.hm-banner span{flex:1 1 260px}
.hm-banner button{min-height:44px;border:0;border-radius:8px;padding:0 14px;font:600 15px system-ui,sans-serif;
  background:#f2b705;color:#16324a;cursor:pointer}
.hm-banner button.zu{background:transparent;color:#fff}
.hm-neu .hm-banner{border-radius:0;background:var(--hm-tinte);box-shadow:0 4px 0 rgba(0,0,0,.25);font-family:var(--hm-text)}
.hm-neu .hm-banner button{border-radius:0;font-family:var(--hm-pixel);background:var(--hm-gold);color:var(--hm-tinte)}
.hm-neu .hm-banner button.zu{background:transparent;color:#fff}
.hm-neu #hm-seite .hm-probe-chip{border-image-source:var(--rahmen-gold)}
`;

function ensureStyle() {
  if (document.getElementById('hm-save-style')) return;
  const s = document.createElement('style');
  s.id = 'hm-save-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, props = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

const knopf = (text, onclick, art = '') => el('button', { type: 'button', class: `hm-px hm-sp-k ${art}`.trim(), onclick }, text);

// ---------------------------------------------------------------------------
// Texte

const OHNE_SPEICHER_TEXT = 'Dieser Browser speichert gerade nichts (privates Fenster oder Speicher gesperrt). '
  + 'Wenn du die Seite schließt, ist der Hafen weg. Sichere ihn mit "Als Datei sichern".';

function datumText(iso) {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return '';
  return `am ${d.toLocaleDateString('de-DE')} um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Beschädigten Stand unverändert als Datei anbieten. */
function kaputtSichern(k) {
  const name = exportFileName(new Date(k?.zeit ?? Date.now()), `${k?.name ?? 'hafen'} beschaedigt`);
  return exportDatei(k.text, name, { merken: false });
}

function exportInfo() {
  const t = daysSinceExport();
  if (t === null) return 'Noch nie als Datei gesichert.';
  if (t === 0) return 'Zuletzt heute als Datei gesichert.';
  return t === 1 ? 'Zuletzt gestern als Datei gesichert.' : `Zuletzt vor ${t} Tagen als Datei gesichert.`;
}

const geld = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;

function mb(bytes) {
  if (bytes < 100 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

function stufenName(n) {
  return ECONOMY?.stufen?.[n - 1]?.name ?? `Stufe ${n}`;
}

export function infoText(info) {
  if (!info) return 'Noch nicht gespielt';
  return `Stufe ${info.stufe} ${stufenName(info.stufe)} · Tag ${info.tag} · ${geld(info.geld)}`;
}

export function zuletzt(iso, now = Date.now()) {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return '';
  const min = Math.floor((now - t) / 60000);
  if (min < 2) return 'gerade eben gespielt';
  if (min < 60) return `vor ${min} Minuten gespielt`;
  const tage = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  if (tage <= 0) return 'heute gespielt';
  if (tage === 1) return 'gestern gespielt';
  return `vor ${tage} Tagen gespielt`;
}

// ---------------------------------------------------------------------------
// Stegbild als kleines Pixelbild: Stege und Boxen des fertigen Hafens (Stufe 5)

const VARIIERT = new Set(STEGBILDER.stege);

function zeichneStegbild(canvas, nr) {
  const v = STEGBILDER.varianten[nr - 1];
  if (!v) return;
  const stufe = v.stufen['5'] ?? v.stufen[String(Math.max(...Object.keys(v.stufen).map(Number)))];
  const fest = (HAFEN.stufen['5']?.stege ?? []).filter((l) => !VARIIERT.has(l.steg) && l.punkte?.length);
  const linien = [...stufe.stege.map((l) => ({ ...l, fest: false })), ...fest.map((l) => ({ ...l, fest: true }))];
  const boxen = [];
  for (const p of HAFEN.plaetze) {
    const lage = VARIIERT.has(p.steg) ? stufe.lage[p.id] : p.lage?.['5'];
    if (lage) boxen.push({ x: lage[0], y: lage[1], r: lage[2], l: p.laenge ?? 8, b: p.breite ?? 4, fest: !VARIIERT.has(p.steg) });
  }
  // Ausschnitt: die variierten Stege mit Rand, damit die Unterschiede groß zu sehen sind
  const xs = []; const ys = [];
  for (const l of stufe.stege) for (const [x, y] of l.punkte) { xs.push(x); ys.push(y); }
  for (const b of boxen) if (!b.fest) { xs.push(b.x); ys.push(b.y); }
  let minX = Math.min(...xs) - 10; let maxX = Math.max(...xs) + 10;
  let minY = Math.min(...ys) - 10; let maxY = Math.max(...ys) + 10;
  const W = canvas.width; const H = canvas.height;
  const s = Math.min(W / (maxX - minX), H / (maxY - minY));
  const ox = (W - (maxX - minX) * s) / 2; const oy = (H - (maxY - minY) * s) / 2;
  const px = (x) => ox + (x - minX) * s;
  const py = (y) => oy + (maxY - y) * s;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#5eb0bd';
  c.fillRect(0, 0, W, H);
  // Boxen als helle Rechtecke (Bug zeigt in Richtung r)
  for (const b of boxen) {
    c.save();
    c.translate(px(b.x), py(b.y));
    c.rotate(-b.r * Math.PI / 180);
    c.fillStyle = b.fest ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.55)';
    c.fillRect(-b.l * s / 2, -b.b * s / 2 + 0.5, b.l * s, Math.max(1, b.b * s - 1));
    c.restore();
  }
  // Stege
  c.lineCap = 'square';
  c.lineJoin = 'miter';
  for (const l of linien) {
    c.strokeStyle = l.fest ? '#8e9aa3' : '#7a5530';
    c.lineWidth = Math.max(2, (l.breite ?? 2.4) * s);
    c.beginPath();
    l.punkte.forEach(([x, y], i) => (i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))));
    c.stroke();
  }
}

// ---------------------------------------------------------------------------
// Fenster

/**
 * Öffnet das Fenster. opts kommt aus save/index.js:
 *   start: 'liste' | 'neu', getGame, testmodus(), speichern(), plaetze (Modul save/plaetze.js),
 *   namensVorschlag(), stegbildAnzahl(), neuesSpiel({ name, stegbild, einstieg }), wechseln(id),
 *   probeKopie(), probeVerwerfen(), probeUebernehmen() -> name, umbenannt(name)
 * Gibt eine Funktion zum Schließen zurück.
 */
export function openSavePanel(opts) {
  ensureStyle();
  document.querySelector('.hm-save-backdrop')?.remove();
  const P = opts.plaetze;
  const backdrop = el('div', { class: 'hm-save-backdrop' });
  const box = el('div', { class: 'hm-sp hm-px', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-save-title' });
  const titel = el('h2', { id: 'hm-save-title' }, 'Spielstände');
  const zuKnopf = el('button', { type: 'button', class: 'hm-sp-zu', 'aria-label': 'Schließen', onclick: () => close() });
  if (getComputedStyle(document.documentElement).getPropertyValue('--px-zu')) zuKnopf.dataset.sym = '1';
  const kopf = el('div', { class: 'hm-sp-kopf' }, titel, zuKnopf);
  const inhalt = el('div', { class: 'hm-sp-inhalt' });
  const msg = el('p', { class: 'hm-sp-msg', role: 'status' });
  box.append(kopf, inhalt);
  backdrop.append(box);
  document.body.append(backdrop);

  const say = (text, fehler = false) => {
    msg.textContent = text;
    msg.classList.toggle('fehler', fehler);
  };
  const fehlerText = (err, ersatz) => (err instanceof SaveError || err?.message ? err.message : ersatz);
  /** Führt fn aus und zeigt Fehler im Fenster statt sie zu verschlucken. */
  const sicher = (fn, ersatz = 'Das hat nicht geklappt.') => async (...a) => {
    try { return await fn(...a); } catch (err) {
      if (err instanceof SaveError && err.code === 'abgebrochen') return undefined;
      say(fehlerText(err, ersatz), true);
      return undefined;
    }
  };

  let ansicht = opts.start === 'neu' ? 'neu' : 'liste';
  let offenId = null;     // bei welchem Platz die weiteren Aktionen offen sind
  let frage = null;       // { id, art: 'loeschen' | 'ueberschreiben' | 'verwerfen' }
  let umbenennenId = null;
  let unsubInstall = () => {};
  let korbOffen = false;

  function zeichne() {
    unsubInstall();
    unsubInstall = () => {};
    inhalt.replaceChildren();
    if (ansicht === 'neu') zeichneNeu();
    else zeichneListe();
  }

  // ------------------------------------------------------------- Liste
  function zeichneListe() {
    titel.textContent = 'Spielstände';
    const v = P.verzeichnis();
    const test = opts.testmodus();
    const aktiv = v.plaetze.find((p) => p.id === v.aktiv);
    const andere = v.plaetze.filter((p) => p.id !== v.aktiv);
    const voll = v.plaetze.length >= P.MAX_PLAETZE;
    // aktuelle Kurzinfo aus dem laufenden Spiel
    const st = opts.getGame();
    if (aktiv && st && !test) aktiv.info = P.infoAus(st);

    inhalt.append(msg);
    if (test) inhalt.append(el('p', { class: 'hm-sp-msg' }, 'Testansicht: Dieser Hafen wird nicht gespeichert. Ein Wechsel öffnet das normale Spiel.'));
    const ohneSpeicher = !test && opts.speichernGeht && !opts.speichernGeht();
    if (ohneSpeicher) inhalt.append(el('p', { class: 'hm-sp-msg fehler', 'data-art': 'ohne-speicher' }, OHNE_SPEICHER_TEXT));
    const kaputt = P.kaputtLesen?.();
    if (kaputt) inhalt.append(kaputtKarte(kaputt));

    if (aktiv) inhalt.append(platzKarte(aktiv, { laeuft: true, test, voll, v }));
    if (andere.length) {
      inhalt.append(el('h3', {}, 'Weitere Häfen'));
      for (const p of andere) inhalt.append(platzKarte(p, { laeuft: false, test, voll, v }));
    }

    inhalt.append(
      knopf('Neues Spiel', () => { ansicht = 'neu'; say(''); zeichne(); }, `hm-primaer breit${voll ? '' : ''}`),
      el('p', { class: 'hm-sp-info', style: 'margin-top:6px' },
        voll ? `Alle ${P.MAX_PLAETZE} Plätze sind belegt. Lösche einen Hafen, um einen neuen anzufangen.`
          : `${v.plaetze.length} von ${P.MAX_PLAETZE} Plätzen belegt.`),
    );
    if (voll) inhalt.lastElementChild.previousElementSibling.disabled = true;

    const laden = knopf('Aus Datei laden', sicher(async () => {
      const liste = await pickAndImport();
      const frei = P.MAX_PLAETZE - P.verzeichnis().plaetze.length;
      const namen = [];
      for (const { spiel } of liste) opts.pruefeStand?.(spiel); // erst alles prüfen, dann übernehmen
      for (const { name, spiel } of liste.slice(0, frei)) {
        const id = P.importieren(spiel, name);
        namen.push(P.verzeichnis().plaetze.find((p) => p.id === id)?.name ?? 'Hafen');
      }
      offenId = null;
      zeichne();
      const rest = liste.length - namen.length;
      say(namen.length === 1
        ? `"${namen[0]}" ist jetzt unter Weitere Häfen. Tippe auf Spielen, um ihn zu öffnen.`
        : `${namen.length} Häfen geladen, sie stehen unter Weitere Häfen.${rest > 0 ? ` ${rest} passten nicht mehr hinein (höchstens ${P.MAX_PLAETZE}).` : ''}`);
    }, 'Die Datei konnte nicht gelesen werden.'));
    laden.disabled = voll;
    const alle = knopf('Alle als Datei sichern', sicher(async () => {
      opts.speichern();
      const liste = P.alleStaende();
      const r = await exportDatei(sammlungText(liste), exportFileName(new Date(), 'alle-haefen'));
      if (r !== 'abgebrochen') { zeichne(); say(`${liste.length} ${liste.length === 1 ? 'Hafen' : 'Häfen'} in einer Datei gesichert.`); }
    }, 'Sichern hat nicht geklappt.'));
    alle.disabled = v.plaetze.length < 2;
    inhalt.append(el('div', { class: 'hm-sp-reihe' }, laden, alle));

    // Papierkorb
    const korb = v.papierkorb ?? [];
    if (korb.length) {
      const offen = korbOffen;
      const kopfK = knopf(`Papierkorb (${korb.length}) ${offen ? 'zuklappen' : 'zeigen'}`, () => { korbOffen = !korbOffen; zeichne(); }, 'breit');
      kopfK.setAttribute('aria-expanded', String(offen));
      inhalt.append(kopfK);
      if (offen) {
        for (const p of korb) {
          const wieder = knopf('Zurückholen', sicher(() => { const n = P.wiederherstellen(p.id); zeichne(); say(`"${n}" ist wieder da.`); }), 'hm-primaer');
          wieder.disabled = voll;
          inhalt.append(el('div', { class: 'hm-sp-platz korb' },
            el('div', { class: 'hm-sp-platz-kopf' },
              el('div', { class: 'hm-sp-platz-text' },
                el('span', { class: 'hm-sp-name' }, p.name),
                el('span', { class: 'hm-sp-zeile' }, infoText(p.info)),
                el('span', { class: 'hm-sp-zeile' }, zuletzt(p.geloescht).replace('gespielt', 'gelöscht')))),
            el('div', { class: 'hm-sp-reihe' }, wieder,
              knopf('Endgültig löschen', sicher(() => { P.endgueltigLoeschen(p.id); zeichne(); say(`"${p.name}" ist endgültig gelöscht.`); }), 'hm-gefahr'))));
        }
        inhalt.append(el('p', { class: 'hm-sp-info' }, `Im Papierkorb bleiben die letzten ${P.PAPIERKORB_MAX} gelöschten Häfen, bis der Speicher gebraucht wird.`));
      }
    }

    // Installieren
    const btnInstall = knopf('Als App installieren', sicher(async () => {
      if (await promptInstall() === 'angenommen') say('Installiert. Du findest das Spiel jetzt bei deinen Apps.');
    }), 'breit');
    const installHint = el('p', { class: 'hm-sp-info', style: 'margin-top:8px' });
    const renderInstall = (state) => {
      btnInstall.hidden = state !== 'bereit';
      installHint.hidden = state !== 'ios-anleitung';
      installHint.textContent = state === 'ios-anleitung' ? IOS_INSTALL_TEXT : '';
    };
    renderInstall(installState());
    unsubInstall = onInstallStateChange(renderInstall);
    inhalt.append(btnInstall, installHint,
      el('p', { class: 'hm-sp-info', style: 'margin-top:10px' },
        ohneSpeicher ? 'Solange der Browser das Speichern sperrt, sichert nur "Als Datei sichern" deinen Hafen. '
          : 'Alles wird automatisch gespeichert, aber nur in diesem Browser auf diesem Gerät. ',
        'Ein anderes Gerät oder ein anderer Browser sieht deine Häfen nicht, und wer die Website-Daten löscht, löscht sie mit. ',
        exportInfo(), ' Sichere deine Häfen ab und zu als Datei, dann geht nichts verloren.'),
      speicherInfo());
  }

  function platzKarte(p, { laeuft, test, voll, v }) {
    const karte = el('div', { class: `hm-sp-platz${laeuft ? ' aktiv' : ''}`, 'data-platz': p.id });
    const original = p.probeVon ? v.plaetze.find((x) => x.id === p.probeVon) : null;

    // Kopf: Name oder Eingabe beim Umbenennen
    let kopfText;
    if (umbenennenId === p.id) {
      const input = el('input', { type: 'text', value: p.name, maxlength: String(P.NAME_MAX), 'aria-label': 'Name des Hafens' });
      const ok = sicher(() => {
        const name = P.umbenennen(p.id, input.value);
        if (laeuft) opts.umbenannt(name);
        umbenennenId = null;
        zeichne();
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') { e.stopPropagation(); umbenennenId = null; zeichne(); } });
      kopfText = el('div', { class: 'hm-sp-platz-text' }, input,
        el('div', { class: 'hm-sp-reihe' }, knopf('Speichern', ok, 'hm-primaer'), knopf('Abbrechen', () => { umbenennenId = null; zeichne(); })));
      setTimeout(() => { input.focus(); input.select(); }, 0);
      karte.append(kopfText);
      return karte;
    }
    kopfText = el('div', { class: 'hm-sp-platz-text' },
      laeuft ? el('span', { class: 'hm-sp-marke' }, test ? 'Gespeichert' : 'Läuft gerade') : null,
      p.probeVon ? el('span', { class: 'hm-sp-marke probe', style: laeuft ? 'margin-left:4px' : '' }, 'Probe-Kopie') : null,
      el('span', { class: 'hm-sp-name' }, p.name),
      el('span', { class: 'hm-sp-zeile' }, infoText(p.info)),
      !laeuft && p.gespielt ? el('span', { class: 'hm-sp-zeile' }, zuletzt(p.gespielt)) : null,
    );
    const bild = P.bildLesen(p.id);
    const kopfZeile = el('div', { class: 'hm-sp-platz-kopf' },
      bild ? el('img', { class: 'hm-sp-bild', src: bild, alt: '' }) : el('span', { class: 'hm-sp-bild leer', 'aria-hidden': 'true' }),
      kopfText);
    karte.append(kopfZeile);
    if (!laeuft) {
      const mehr = knopf(offenId === p.id ? 'Weniger' : 'Mehr', () => { offenId = offenId === p.id ? null : p.id; frage = null; zeichne(); }, 'hm-sp-mehr');
      mehr.setAttribute('aria-expanded', String(offenId === p.id));
      karte.append(el('div', { class: 'hm-sp-reihe' }, knopf('Spielen', sicher(() => opts.wechseln(p.id)), 'hm-primaer'), mehr));
    }

    // Probe-Kopie läuft: übernehmen oder verwerfen
    if (laeuft && p.probeVon && !test) {
      const probe = el('div', { class: 'hm-sp-probe' },
        el('p', {}, original
          ? `Probe von "${original.name}". Gefällt dir, was du gebaut hast? Übernehmen ersetzt das Original, Verwerfen bringt dich zurück zum Original.`
          : 'Das Original dieser Probe gibt es nicht mehr. Übernehmen macht die Probe zu einem normalen Hafen.'));
      if (frage?.id === p.id && frage.art === 'verwerfen') {
        probe.append(frageBox(`Probe löschen und zu "${original?.name}" zurückkehren?`, 'Ja, verwerfen', sicher(() => opts.probeVerwerfen())));
      } else {
        probe.append(el('div', { class: 'hm-sp-reihe' },
          knopf('Übernehmen', sicher(() => { const n = opts.probeUebernehmen(); zeichne(); say(`Übernommen. Du spielst jetzt "${n}".`); }), 'hm-primaer'),
          original ? knopf('Verwerfen', () => { frage = { id: p.id, art: 'verwerfen' }; zeichne(); }, 'hm-gefahr') : null));
      }
      karte.append(probe);
    }

    // Aktionen
    if (laeuft) {
      const reihe = el('div', { class: 'hm-sp-reihe' },
        knopf('Umbenennen', () => { umbenennenId = p.id; zeichne(); }),
        knopf('Als Datei sichern', sicher(async () => {
          opts.speichern();
          const r = await exportGame(opts.getGame(), { hafenName: p.name });
          if (r !== 'abgebrochen') { zeichne(); say('Gesichert. Die Datei kannst du auf jedem Gerät wieder laden.'); }
        }, 'Sichern hat nicht geklappt.')),
      );
      if (!test && !p.probeVon) {
        const probeK = knopf('Probe-Kopie', sicher(() => opts.probeKopie()));
        probeK.title = 'Kopie anlegen und dort einen teuren Ausbau ausprobieren';
        probeK.disabled = voll;
        reihe.append(probeK);
      }
      if (test) reihe.firstElementChild.disabled = true;
      karte.append(reihe);
      if (!test && !p.probeVon) {
        karte.append(el('p', { class: 'hm-sp-info', style: 'margin:6px 0 0' },
          'Probe-Kopie: Probiere einen teuren Ausbau in einer Kopie aus. Gefällt er nicht, gehst du zurück zum Original.'));
      }
    } else if (offenId === p.id) {
      if (frage?.id === p.id) {
        const texte = {
          loeschen: [`"${p.name}" löschen? Er kommt in den Papierkorb und lässt sich dort zurückholen.`, 'Ja, löschen', sicher(() => { P.loeschen(p.id); offenId = null; frage = null; zeichne(); say(`"${p.name}" liegt im Papierkorb.`); })],
          ueberschreiben: [`"${p.name}" durch eine Kopie des laufenden Hafens ersetzen? Der bisherige Stand kommt in den Papierkorb.`, 'Ja, ersetzen',
            sicher(() => { opts.speichern(); P.ueberschreiben(p.id, JSON.parse(JSON.stringify(opts.getGame()))); offenId = null; frage = null; zeichne(); say('Überschrieben.'); })],
        }[frage.art];
        karte.append(frageBox(...texte));
      } else {
        const kopie = knopf('Kopieren', sicher(() => { P.kopieren(p.id); zeichne(); say(`Kopie von "${p.name}" angelegt.`); }));
        kopie.disabled = voll;
        const ueber = knopf('Mit laufendem Hafen überschreiben', () => { frage = { id: p.id, art: 'ueberschreiben' }; zeichne(); });
        ueber.disabled = test;
        karte.append(el('div', { class: 'hm-sp-reihe' },
          knopf('Umbenennen', () => { umbenennenId = p.id; zeichne(); }),
          kopie,
          knopf('Als Datei sichern', sicher(async () => {
            const r = P.platzLesen(p.id);
            if (!r) throw new SaveError('ungueltig', 'Dieser Platz ist leer oder beschädigt.');
            if (await exportGame(r.game, { hafenName: p.name }) !== 'abgebrochen') { zeichne(); say(`"${p.name}" als Datei gesichert.`); }
          })),
          ueber,
          knopf('Löschen', () => { frage = { id: p.id, art: 'loeschen' }; zeichne(); }, 'hm-gefahr'),
        ));
      }
    }
    return karte;
  }

  // Ein Spielstand ließ sich nicht laden: als Datei sichern oder verwerfen
  function kaputtKarte(k) {
    const karte = el('div', { class: 'hm-sp-platz hm-sp-kaputt', 'data-art': 'kaputt' });
    const wann = datumText(k.zeit);
    karte.append(el('div', { class: 'hm-sp-platz-text' },
      el('strong', {}, k.name ? `"${k.name}" ließ sich nicht laden` : 'Ein Hafen ließ sich nicht laden'),
      el('p', { class: 'hm-sp-info', style: 'margin:4px 0 8px' },
        `Der Spielstand war beschädigt${wann ? ` (bemerkt ${wann})` : ''}. Sichere ihn als Datei, bevor du ihn wegwirfst. Vielleicht lässt er sich später noch retten.`)));
    if (frage?.art === 'kaputt') {
      karte.append(frageBox('Beschädigten Spielstand endgültig wegwerfen?', 'Ja, wegwerfen',
        () => { P.kaputtVerwerfen(); frage = null; zeichne(); say('Weggeworfen.'); }));
    } else {
      karte.append(el('div', { class: 'hm-sp-reihe' },
        knopf('Als Datei sichern', sicher(async () => {
          const r = await kaputtSichern(k);
          if (r !== 'abgebrochen') say('Gesichert. Die Datei enthält den beschädigten Stand, so wie er war.');
        }, 'Sichern hat nicht geklappt.'), 'hm-primaer'),
        knopf('Wegwerfen', () => { frage = { art: 'kaputt' }; zeichne(); })));
    }
    return karte;
  }

  function speicherInfo() {
    const n = P.belegt();
    if (n === null) return null;
    return el('p', { class: 'hm-sp-info' },
      `Deine Häfen belegen etwa ${mb(n)}. Browser erlauben meist etwa 5 MB, das reicht für alle ${P.MAX_PLAETZE} Plätze.`);
  }

  function frageBox(text, jaText, ja) {
    return el('div', { class: 'hm-sp-frage', role: 'alertdialog' },
      el('p', {}, text),
      el('div', { class: 'hm-sp-reihe' },
        knopf(jaText, ja, 'hm-gefahr'),
        knopf('Abbrechen', () => { frage = null; zeichne(); })));
  }

  // ------------------------------------------------------------- Neues Spiel
  let neuName = null;
  let neuStegbild = 0; // 0 = Zufall
  let neuGelaende = 0; // 0 = Zufall
  let neuEinstieg = null;

  function zeichneNeu() {
    titel.textContent = 'Neues Spiel';
    const v = P.verzeichnis();
    const voll = v.plaetze.length >= P.MAX_PLAETZE;
    if (neuName === null) neuName = opts.namensVorschlag();
    if (neuEinstieg === null) neuEinstieg = !v.plaetze.some((p) => (p.info?.tag ?? 1) >= 3 || (p.info?.stufe ?? 1) >= 2);

    const zurueck = el('button', { type: 'button', class: 'hm-sp-zurueck', onclick: () => { ansicht = 'liste'; say(''); zeichne(); } }, '< Zurück zu den Spielständen');
    inhalt.append(zurueck, msg);
    if (voll) say(`Alle ${P.MAX_PLAETZE} Plätze sind belegt. Lösche zuerst einen Hafen.`, true);

    // Name
    const input = el('input', { type: 'text', id: 'hm-neu-name', value: neuName, maxlength: String(P.NAME_MAX), autocomplete: 'off' });
    input.addEventListener('input', () => { neuName = input.value; });
    const wuerfel = knopf('Anderer Name', () => { neuName = opts.namensVorschlag(); input.value = neuName; });
    inhalt.append(el('h3', {}, el('label', { for: 'hm-neu-name' }, 'Name des Hafens')),
      el('div', { class: 'hm-sp-namezeile' }, input, wuerfel));

    // Stegbild
    const anzahl = Math.min(opts.stegbildAnzahl() || STEGBILDER.varianten.length, STEGBILDER.varianten.length);
    if (anzahl > 0) {
      inhalt.append(el('h3', { id: 'hm-neu-steg' }, 'Stegbild'),
        el('p', { class: 'hm-sp-info' }, 'So liegen die Stege, wenn der Hafen fertig ausgebaut ist. Am Anfang baust du nur einen kleinen Teil davon.'));
      const raster = el('div', { class: 'hm-sp-stegbilder', role: 'radiogroup', 'aria-labelledby': 'hm-neu-steg' });
      const kachel = (nr) => {
        const b = el('button', { type: 'button', class: `hm-sp-steg${nr === 0 ? ' zufall' : ''}`, role: 'radio', 'aria-checked': String(neuStegbild === nr), 'data-stegbild': String(nr) });
        if (nr === 0) b.append(el('span', {}, 'Zufall'));
        else {
          const c = el('canvas', { width: 96, height: 72 });
          b.append(c, el('span', {}, String(nr)));
          b.setAttribute('aria-label', `Stegbild ${nr}`);
          try { zeichneStegbild(c, nr); } catch { /* ohne Bild */ }
        }
        b.addEventListener('click', () => {
          neuStegbild = nr;
          for (const k of raster.children) k.setAttribute('aria-checked', String(k === b));
        });
        return b;
      };
      raster.append(kachel(0));
      for (let i = 1; i <= anzahl; i++) raster.append(kachel(i));
      inhalt.append(raster);
    }

    // Küste (Geländeform)
    if (FORMEN.length > 1) {
      inhalt.append(el('h3', { id: 'hm-neu-kueste' }, 'Küste'));
      const idee = el('p', { class: 'hm-sp-info', style: 'margin-top:6px' });
      const zeigeIdee = () => {
        const f = FORMEN.find((x) => x.nr === neuGelaende);
        idee.textContent = f ? f.idee : 'Eine der Küstenformen wird ausgewürfelt.';
      };
      const reihe = el('div', { class: 'hm-sp-kueste', role: 'radiogroup', 'aria-labelledby': 'hm-neu-kueste' });
      for (const f of [{ nr: 0, name: 'Zufall' }, ...FORMEN]) {
        const b = knopf(f.name, () => {
          neuGelaende = f.nr;
          for (const k of reihe.children) k.setAttribute('aria-checked', String(k === b));
          zeigeIdee();
        });
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(neuGelaende === f.nr));
        b.dataset.gelaende = String(f.nr);
        reihe.append(b);
      }
      zeigeIdee();
      inhalt.append(reihe, idee);
    }

    // Einführung
    const haken = el('input', { type: 'checkbox', checked: neuEinstieg });
    haken.addEventListener('change', () => { neuEinstieg = haken.checked; });
    inhalt.append(el('label', { class: 'hm-sp-haken' }, haken, 'Einführung zeigen'));

    const aktiv = v.plaetze.find((p) => p.id === v.aktiv);
    if (aktiv && !opts.testmodus()) {
      inhalt.append(el('p', { class: 'hm-sp-info', style: 'margin-top:8px' },
        `"${aktiv.name}" bleibt gespeichert. Du findest ihn hier unter Weitere Häfen.`));
    }
    const los = knopf('Hafen gründen', sicher(() => {
      const anz = Math.max(1, anzahl);
      const nr = neuStegbild || (anzahl ? 1 + Math.floor(Math.random() * anz) : 0);
      const form = neuGelaende || FORMEN[Math.floor(Math.random() * FORMEN.length)]?.nr || 1;
      opts.neuesSpiel({ name: P.nameSauber(neuName), stegbild: nr, gelaende: form, einstieg: neuEinstieg });
    }, 'Das neue Spiel konnte nicht angelegt werden.'), 'hm-primaer breit');
    los.id = 'hm-neu-los';
    los.disabled = voll;
    inhalt.append(los);
  }

  // ------------------------------------------------------------- Schließen
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (ansicht === 'neu' && opts.start !== 'neu') { ansicht = 'liste'; zeichne(); } else close();
  };
  function close() {
    unsubInstall();
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
  }
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  // Tasten und Tipps im Fenster nicht ans Spiel weitergeben (L, Leertaste, P ...)
  for (const t of ['keydown', 'keyup']) box.addEventListener(t, (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  document.addEventListener('keydown', onKey, true);
  zeichne();
  zuKnopf.focus();
  return close;
}

// ---------------------------------------------------------------------------
// Start mit "Weiter" (nur wenn es mehrere Häfen gibt)

/** Kleine Karte beim Start: Weiter mit dem letzten Hafen, anderen wählen oder neu anfangen. */
export function openStart({ eintrag, info, bild, anzahl, weiter, andere, neu }) {
  ensureStyle();
  document.querySelector('.hm-save-backdrop')?.remove();
  const backdrop = el('div', { class: 'hm-save-backdrop hm-sp-start' });
  const zu = (fn) => () => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); fn(); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); zu(weiter)(); } };
  const los = knopf('Weiter', zu(weiter), 'hm-primaer breit');
  los.id = 'hm-start-weiter';
  const box = el('div', { class: 'hm-sp hm-px', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-start-titel' },
    el('div', { class: 'hm-sp-kopf' }, el('h2', { id: 'hm-start-titel' }, 'Willkommen zurück')),
    el('div', { class: 'hm-sp-inhalt' },
      el('div', { class: 'hm-sp-platz aktiv' },
        el('div', { class: 'hm-sp-platz-kopf' },
          bild ? el('img', { class: 'hm-sp-bild', src: bild, alt: '' }) : el('span', { class: 'hm-sp-bild leer', 'aria-hidden': 'true' }),
          el('div', { class: 'hm-sp-platz-text' },
            el('span', { class: 'hm-sp-name' }, eintrag?.name ?? 'Mein Hafen'),
            el('span', { class: 'hm-sp-zeile' }, infoText(info))))),
      los,
      el('div', { class: 'hm-sp-reihe' },
        knopf(`Anderer Hafen (${anzahl - 1})`, zu(andere)),
        knopf('Neues Spiel', zu(neu)))));
  backdrop.append(box);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) zu(weiter)(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  los.focus();
}

// ---------------------------------------------------------------------------
// Hinweise unten

/**
 * Zeigt auf iPhone/iPad im Safari-Tab einen Hinweis, wenn länger nicht als Datei
 * gesichert wurde. Safari löscht Daten nach 7 Tagen ohne Besuch.
 * Gibt true zurück, wenn der Hinweis angezeigt wird.
 */
export function showExportReminderIfDue({ getGame, nachTagen = 5 }) {
  if (!exportReminderDue({ nachTagen })) return false;
  ensureStyle();
  const bar = el('div', { class: 'hm-banner', role: 'status' });
  const text = el('span', {}, 'Safari löscht Spielstände nach 7 Tagen ohne Besuch. Jetzt als Datei sichern?');
  const ok = el('button', { type: 'button' }, 'Sichern');
  const zu = el('button', { type: 'button', class: 'zu', 'aria-label': 'Hinweis schließen' }, 'Später');
  ok.addEventListener('click', async () => {
    try {
      if (await exportGame(getGame()) !== 'abgebrochen') bar.remove();
    } catch { /* Fenster bleibt offen */ }
  });
  zu.addEventListener('click', () => bar.remove());
  bar.append(text, ok, zu);
  document.body.appendChild(bar);
  return true;
}

/**
 * Hinweis "Neue Version verfügbar". apply() speichert und lädt neu.
 * Wer klickt "Später", bekommt die neue Version beim nächsten Start.
 */
export function showUpdateBanner(apply) {
  if (document.querySelector('.hm-banner[data-art="update"]')) return;
  ensureStyle();
  const bar = el('div', { class: 'hm-banner', role: 'status' });
  bar.dataset.art = 'update';
  const ok = el('button', { type: 'button' }, 'Neu laden');
  const zu = el('button', { type: 'button', class: 'zu' }, 'Später');
  ok.addEventListener('click', () => { bar.remove(); apply(); });
  zu.addEventListener('click', () => bar.remove());
  bar.append(el('span', {}, 'Eine neue Version des Spiels ist da.'), ok, zu);
  document.body.appendChild(bar);
}

/**
 * Kleines Fenster für eine wichtige Meldung (beschädigter Stand, kein Speicher). Es liegt über allem,
 * auch über der Einführung, damit nichts verdeckt wird; pause()/weiter() halten das Spiel so lange an.
 * knoepfe: [{ text, fn, primaer }]; fn darf async sein und false liefern, dann bleibt das Fenster offen.
 */
function openHinweis({ art, titel, text, knoepfe, pause, weiter }) {
  if (document.querySelector(`.hm-save-backdrop[data-art="${art}"]`)) return;
  ensureStyle();
  pause?.();
  const backdrop = el('div', { class: 'hm-save-backdrop hm-sp-start', 'data-art': art });
  const zu = () => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); weiter?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(); } };
  const reihe = el('div', { class: 'hm-sp-reihe' });
  for (const k of knoepfe) {
    reihe.append(knopf(k.text, async () => {
      let bleibt = false;
      try { bleibt = (await k.fn?.()) === false; } catch { bleibt = true; }
      if (!bleibt) zu();
    }, k.primaer ? 'hm-primaer' : ''));
  }
  const box = el('div', { class: 'hm-sp hm-px', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': `hm-hinweis-${art}` },
    el('div', { class: 'hm-sp-kopf' }, el('h2', { id: `hm-hinweis-${art}` }, titel)),
    el('div', { class: 'hm-sp-inhalt' }, el('p', {}, text), reihe));
  backdrop.append(box);
  document.addEventListener('keydown', onKey, true);
  // Liegt schon ein anderes Fenster (Spielstände) offen, kommt dieses darüber
  document.body.append(backdrop);
  reihe.querySelector('button')?.focus();
}

/**
 * Meldung nach dem Start, wenn der gespeicherte Hafen beschädigt war.
 * art 'verloren': es läuft ein neues Spiel; 'sicherung': der vorige Stand wurde geladen;
 * 'zu-neu': der Stand stammt aus einer neueren Version des Spiels.
 * Der beschädigte Text liegt in plaetze.kaputtLesen() und lässt sich als Datei sichern.
 */
export function showKaputtMeldung({ art, name, savedAt, kaputt, pause, weiter }) {
  const wann = datumText(savedAt);
  const hafen = name ? `Dein Hafen "${name}"` : 'Dein gespeicherter Hafen';
  const folge = savedAt ? `Geladen ist der Stand davor${wann ? ` (${wann})` : ''}.` : 'Es läuft ein neues Spiel.';
  const text = art === 'zu-neu'
    ? `${hafen} stammt aus einer neueren Version des Spiels. ${folge} Lade die Seite neu, dann ist er wieder da. Zur Sicherheit kannst du ihn als Datei sichern.`
    : art === 'verloren'
      ? `${hafen} ist beschädigt und ließ sich nicht laden. Es läuft ein neues Spiel. Sichere den alten Stand als Datei, dann geht er nicht verloren.`
      : `Der letzte Spielstand war beschädigt. ${folge} Den beschädigten kannst du als Datei sichern.`;
  openHinweis({
    art: 'kaputt',
    titel: art === 'zu-neu' ? 'Neuere Version' : 'Spielstand beschädigt',
    text,
    pause,
    weiter,
    knoepfe: [
      { text: 'Als Datei sichern', primaer: true, fn: async () => {
        const k = kaputt?.();
        if (!k) return true;
        return (await kaputtSichern(k)) !== 'abgebrochen' ? true : false;
      } },
      // "Später": der Stand bleibt im Fenster "Spielstände", bis er gesichert oder weggeworfen ist
      { text: 'Später', fn: () => true },
    ],
  });
}

/** Meldung, wenn der Browser nichts speichern lässt (privates Fenster, gesperrt, voll). */
export function showOhneSpeicherMeldung({ getGame, pause, weiter }) {
  openHinweis({
    art: 'ohne-speicher',
    titel: 'Kein Speichern möglich',
    text: OHNE_SPEICHER_TEXT,
    pause,
    weiter,
    knoepfe: [
      { text: 'Als Datei sichern', primaer: true, fn: async () => (await exportGame(getGame())) !== 'abgebrochen' },
      { text: 'Verstanden', fn: () => true },
    ],
  });
}
