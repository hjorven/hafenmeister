// Hafen schauen: ein Ruhemodus für ein Tablet auf dem Tisch. Beschreibung in docs/neue-features.md, Abschnitt 2.
//
// - Im Fotomodus erscheint der Knopf „Hafen schauen“, sobald das Hafenbüro selbst zuweisen kann
//   (state.office >= rules.office.autoAssign). Vorher gibt es den Knopf nicht.
// - Dann gleitet die Kamera (Rundflug), das Büro weist alle wartenden Boote zu, auch die,
//   die man sonst selbst einweisen würde, und kassiert. Der Bildschirm bleibt an (Wake Lock, wo es das gibt).
// - Antippen, Mausrad oder Escape beendet den Modus; das Spiel läuft normal weiter.

import { regelnBereit } from './regeln-bereit.js';

const TAKT = 2;   // Sekunden zwischen zwei Runden des Büros

export function darfSchauen(state, rules) {
  return (state?.office ?? 0) >= (rules?.office?.autoAssign ?? 3);
}

export async function init(game) {
  const api = await regelnBereit(game);
  const start = Date.now();
  while (!game.foto?.leiste && Date.now() - start < 30000) await new Promise((r) => setTimeout(r, 100));
  const foto = game.foto;
  if (!foto?.leiste) return;

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.textContent = 'Hafen schauen';
  knopf.setAttribute('aria-label', 'Hafen schauen: Büro weist alles zu, Kamera gleitet, Bildschirm bleibt an');
  knopf.setAttribute('aria-pressed', 'false');
  foto.leiste.insertBefore(knopf, foto.leiste.lastElementChild);   // vor „Zurück“

  let aktiv = false;
  let wakeLock = null;
  let takt = 0;

  function sichtbar() {
    knopf.hidden = !darfSchauen(api.state, api.ctx.rules);
    if (knopf.hidden && aktiv) aus();
  }

  async function an() {
    if (aktiv || !darfSchauen(api.state, api.ctx.rules)) return;
    aktiv = true;
    knopf.setAttribute('aria-pressed', 'true');
    if (!foto.aktiv) foto.an();
    if (game.paused) game.setPaused(false);
    foto.rundflug(true);
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
    game.emit('schauen:an');
  }

  function aus() {
    if (!aktiv) return;
    aktiv = false;
    knopf.setAttribute('aria-pressed', 'false');
    foto.rundflug(false);
    try { wakeLock?.release(); } catch { /* egal */ }
    wakeLock = null;
    game.emit('schauen:aus');
  }

  knopf.addEventListener('click', (e) => { e.stopPropagation(); aktiv ? aus() : an(); });
  game.on('foto:aus', aus);
  game.on('ui:cancel', aus);
  // Berührung oder Mausrad außerhalb der Leiste beenden den Modus (der Rundflug hält dabei ohnehin an)
  const root = document.getElementById('game') || document.body;
  root.addEventListener('pointerdown', (e) => { if (aktiv && !foto.leiste.contains(e.target)) aus(); });
  root.addEventListener('wheel', () => aus(), { passive: true });

  game.onTick((dt) => {
    if (!aktiv) return;
    takt += dt;
    if (takt < TAKT) return;
    takt = 0;
    if (api.waitingBoats().length) api.autoAssign();
    api.collectAll(true);
    if (!foto.rundflugAktiv) foto.rundflug(true);
  });

  game.on('sim:change', sichtbar);
  game.on('foto:an', sichtbar);
  sichtbar();
  game.hafenSchauen = { an, aus, get aktiv() { return aktiv; } };
}
