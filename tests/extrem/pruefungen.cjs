// Härtetest (docs/extremtest.md): Messregeln, die im Browser laufen.
// Die Bootsprüfungen (über Land, durch Steg, ineinander fest, hängt, Pulk, zu lange unterwegs,
// Spielregeln) kommen unverändert aus dem Zeitraffer (tools/zeitraffer/lauf.cjs, PROBE).
// Hier kommen dazu: Menschen im Wasser, Leinen ohne Boot, Großschiffe über Land, Sim und Bild
// stimmen nicht überein, kaputte Zahlen in der Oberfläche, verdeckte oder abgeschnittene Bedienung.

// opts: { ui: true }   ui = false lässt die Oberflächenprüfung weg (z. B. wenn absichtlich Menüs offen sind)
const PRUEFE = (opts = {}) => {
  const G = window.hafenmeister; const T = G.THREE; const S = G.sim; const st = S.state;
  const W = window.__exp ||= { ray: new T.Raycaster(), simSeit: new Map() };
  const out = { menschen: [], leinen: [], xxl: [], abgleich: [], text: [], ui: [], regeln: [] };
  // Rechnung (istWasser) und Bild (gezeichnetes Netz, tools/zeitraffer/bildwasser.cjs) weichen am Ufer um
  // bis zu eine Rasterzelle ab; ein Fund zählt nur, wo beide dasselbe zeigen (P87).
  const rechnung = (x, z) => (G.landschaft?.istWasser ? G.landschaft.istWasser(x, z) : true);
  const bildW = (x, z) => window.__bildWasser?.(x, z) ?? null;
  const wasser = (x, z) => rechnung(x, z) || bildW(x, z) === true;        // Land nur, wenn beide Land sagen
  const nass = (x, z) => rechnung(x, z) && bildW(x, z) !== false;          // Wasser nur, wenn beide Wasser sagen

  // ---------------------------------------------------------------- Menschen im Wasser
  // Gezeichnet wird, wer nicht drinnen, an Bord oder entfernt ist (people.js zeichnen()).
  // Im Wasser heißt: Wasser unter den Füßen, kein Steg, Kai, Boot oder Gebäude darunter.
  const tragend = [];
  for (const g of [G.stege?.group, G.services?.gruppe, G.buildings?.group, ...(G.boatAnim?.boats ?? []).map((a) => a.model)]) g?.traverse?.((o) => { if (o.isMesh && o.visible) tragend.push(o); });
  const traegt = (x, z) => { W.ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0)); return W.ray.intersectObjects(tragend, false).some((t) => t.point.y > 0.1); };
  const ag = G.people?._agenten ?? [];
  let nWasser = 0;
  for (const a of ag) {
    if (['entfernt', 'drinnen', 'anbord', 'wartet-start'].includes(a.zustand)) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.z)) { out.menschen.push({ id: 'mensch-' + (a.id ?? '?'), st: 'Position keine Zahl', p: null }); continue; }
    if (!nass(a.x, a.z)) continue;
    // Uferlinie: erst mindestens 1 m im Wasser zählt (Wellensaum, Figur steht auf der Kante)
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => !nass(a.x + i, a.z + j))) continue;
    if (a.y > 0.25 || traegt(a.x, a.z)) continue;
    // Nach Ort (5-m-Raster) zusammengefasst: ein Weg unter Wasser ist ein Fund, nicht zwanzig
    const ortKey = `${Math.round(a.x / 5) * 5}/${Math.round(a.z / 5) * 5}`;
    if (nWasser++ < 40 && !out.menschen.some((m) => m.id === 'Wasser bei ' + ortKey)) out.menschen.push({ id: 'Wasser bei ' + ortKey, st: `${a.zustand}${a.ziel?.art ? ' zu ' + a.ziel.art : ''}, Füße auf Höhe ${a.y.toFixed(1)} m (Wasserspiegel 0)`, p: [a.x, a.z] });
  }
  out.menschenZahl = G.people?.anzahl?.() ?? null;

  // ---------------------------------------------------------------- Leinen
  // Sichtbare Festmacher gehören zu einem sichtbaren Boot, und keine Leine ist viel länger als das Boot.
  const anims = G.boatAnim?.boats ?? [];
  const eigene = new Set();
  for (const a of anims) {
    if (!a.lineObj) continue;
    eigene.add(a.lineObj);
    if (!a.lineObj.visible) continue;
    const id = a.info?.id ?? a.model?.name ?? '?';
    if (!a.model?.parent || a.model.visible === false) { out.leinen.push({ id, st: 'Leine sichtbar, Boot nicht', p: [a.x, a.z] }); continue; }
    const pos = a.linePos; const L = a.info?.length ?? 10; let max = 0;
    for (let i = 0; i + 2 < pos.length; i += 3) {
      if (pos[i] === 0 && pos[i + 1] === 0 && pos[i + 2] === 0) continue;
      max = Math.max(max, Math.hypot(pos[i] - a.x, pos[i + 2] - a.z));
    }
    if (max > L * 1.6 + 8) out.leinen.push({ id, st: `${a.state}: Leine reicht ${max.toFixed(0)} m weit (Boot ${L.toFixed(0)} m)`, p: [a.x, a.z] });
  }
  G.scene.traverse((o) => { if (o.name === 'mooring-lines' && o.visible && !eigene.has(o)) out.leinen.push({ id: 'ohne Boot', st: 'Leine ohne Besitzer sichtbar', p: null }); });

  // ---------------------------------------------------------------- Großschiffe (Besuche, XXL)
  // Rumpf aus der Geometrie im eigenen Koordinatensystem, 7 Punkte bei 85 % wie beim Zeitraffer
  const besuche = G.scene.getObjectByName('services-besuche');
  for (const s of besuche?.children ?? []) {
    if (!s.visible) continue;
    s.updateWorldMatrix(true, true);
    const inv = new T.Matrix4().copy(s.matrixWorld).invert(); const box = new T.Box3(); const m = new T.Matrix4();
    s.traverse((o) => { if (!o.isMesh || !o.geometry) return; o.geometry.boundingBox || o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)); box.union(b); });
    if (box.isEmpty()) continue;
    const c = box.getCenter(new T.Vector3()); const h = box.getSize(new T.Vector3()).multiplyScalar(0.85 / 2);
    const punkte = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 0]].map(([i, j]) => new T.Vector3(c.x + h.x * i, 0, c.z + h.z * j).applyMatrix4(s.matrixWorld));
    const land = punkte.filter((v) => !wasser(v.x, v.z)).length;
    const w = new T.Vector3().setFromMatrixPosition(s.matrixWorld);
    if (land >= 2) out.xxl.push({ id: s.name, st: `${land} von 7 Rumpfpunkten auf Land`, n: land, p: [w.x, w.z] });
  }

  // ---------------------------------------------------------------- Sim und Bild
  const bild = new Map((G.boatView?.boote ?? []).map((e) => [String(e.id), e]));
  const seen = new Set();
  for (const b of Object.values(st.boats)) {
    if (b.status !== 'moored' || b.trip?.away) continue;
    const k = 'fehlt-' + b.id; seen.add(k);
    const e = bild.get(String(b.id));
    const sichtbar = e && e.anim?.model?.parent && e.anim.model.visible !== false;
    if (sichtbar) { W.simSeit.delete(k); continue; }
    if (!W.simSeit.has(k)) W.simSeit.set(k, G.time);
    // Kurz nach dem Anlegen-Befehl darf die Ansicht noch nachziehen
    if (G.time - W.simSeit.get(k) > 120) out.abgleich.push({ id: 'gast-' + b.id, st: `liegt laut Spiel in ${b.berthId}, ist aber nicht zu sehen`, p: null });
  }
  // Wartende Boote: Das Spiel zählt sie als "an der Boje" (Geduld läuft, Selbst-Einfahren), sind sie dort
  // auch zu sehen? Sonst kann der Spieler sie nicht antippen und zuweisen.
  out.boje = [];
  for (const b of Object.values(st.boats)) {
    if (b.status !== 'waiting' || !b.atBuoy) continue;
    const k = 'boje-' + b.id; seen.add(k);
    const a = G.boatView?.boot?.(b.id);
    const da = a && a.moored && a.berth?.kind === 'buoy' && !a.versteckt;
    if (da) { W.simSeit.delete(k); continue; }
    if (!W.simSeit.has(k)) W.simSeit.set(k, G.time);
    if (G.time - W.simSeit.get(k) > 20) out.boje.push({ id: 'gast-' + b.id, g: b.size, st: a ? `${a.versteckt ? 'unsichtbar draußen' : a.state} bei ${Math.round(a.x)}/${Math.round(a.z)}` : 'ohne Bild', s: Math.round(G.time - W.simSeit.get(k)), p: a && !a.versteckt ? [a.x, a.z] : null });
  }
  for (const k of [...W.simSeit.keys()]) if (!seen.has(k)) W.simSeit.delete(k);
  // Belegung: jeder Platz höchstens ein Boot, jedes liegende Boot steht in seinem Platz
  const proPlatz = {};
  for (const b of Object.values(st.boats)) if (b.status === 'moored') (proPlatz[b.berthId] ||= []).push(b.id);
  for (const [p, ids] of Object.entries(proPlatz)) if (ids.length > 1) out.regeln.push({ art: 'Platz doppelt belegt', id: p, wert: ids.join(',') });
  for (const [p, id] of Object.entries(st.berths || {})) {
    if (id == null) continue;
    const b = st.boats[id];
    if (!b) out.regeln.push({ art: 'Platz zeigt auf fehlendes Boot', id: p, wert: id });
    else if (b.status === 'moored' && b.berthId !== p) out.regeln.push({ art: 'Platz und Boot uneinig', id: p, wert: `${id} liegt in ${b.berthId}` });
  }
  for (const id of st.queue || []) if (!st.boats[id]) out.regeln.push({ art: 'Warteschlange zeigt auf fehlendes Boot', id });
  if (!Number.isFinite(st.money)) out.regeln.push({ art: 'Geld keine Zahl', wert: String(st.money) });
  for (const k of ['day', 'stage', 'clock', 'guests']) if (st[k] != null && !Number.isFinite(st[k])) out.regeln.push({ art: `${k} keine Zahl`, wert: String(st[k]) });

  // ---------------------------------------------------------------- Oberfläche: kaputte Texte
  const text = document.body.innerText || '';
  for (const m of text.matchAll(/[^\n]{0,30}(NaN|undefined|Infinity|\[object [A-Za-z]+\]|null ?€)[^\n]{0,30}/g)) {
    if (out.text.length < 8) out.text.push({ id: m[1], st: m[0].trim() });
  }

  // ---------------------------------------------------------------- Oberfläche: verdeckt oder abgeschnitten
  if (opts.ui !== false) {
    const vw = innerWidth, vh = innerHeight;
    const pflicht = ['#money', '#btn-overview', '#btn-build', '#hm-zeit', '#btn-menu'];
    for (const sel of pflicht) {
      const el = document.querySelector(sel);
      if (!el || el.hidden || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right < 1 || r.bottom < 1 || r.left > vw - 1 || r.top > vh - 1) { out.ui.push({ id: sel, st: 'außerhalb des Bildschirms' }); continue; }
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.ui.push({ id: sel, st: `ragt aus dem Bild (${Math.round(r.left)},${Math.round(r.top)} bis ${Math.round(r.right)},${Math.round(r.bottom)})` });
      const x = Math.min(vw - 2, Math.max(1, r.left + r.width / 2)), y = Math.min(vh - 2, Math.max(1, r.top + r.height / 2));
      const oben = document.elementFromPoint(x, y);
      if (oben && oben !== el && !el.contains(oben) && !oben.contains(el)) out.ui.push({ id: sel, st: 'verdeckt von ' + beschreibe(oben) });
    }
    // Sichtbare Tafeln, die über den Rand hinausragen (abgeschnitten, nicht erreichbar)
    for (const el of document.querySelectorAll('body *')) {
      if (el.id === 'stage' || el.closest('canvas, .__ring, script, style')) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.3) continue;
      if (el.offsetParent === null && cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24) continue;
      if (!(el.innerText || '').trim()) continue;
      // Ganz draußen ist Absicht (eingeklappte Tafeln), teilweise draußen nicht
      const draussen = r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh;
      const teils = !draussen && (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2);
      if (teils && out.ui.length < 12) out.ui.push({ id: beschreibe(el), st: `teilweise außerhalb (${Math.round(r.left)},${Math.round(r.top)} bis ${Math.round(r.right)},${Math.round(r.bottom)} bei ${vw}x${vh})` });
    }
  }
  function beschreibe(e) { return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); }
  return out;
};

// Wie viel der Spielfläche ist von Oberfläche bedeckt? Raster 12 px, Anteil der Punkte, an denen nicht die Leinwand liegt.
const VERDECKUNG = () => {
  const vw = innerWidth, vh = innerHeight; let n = 0, zu = 0; const wer = {};
  for (let y = 6; y < vh; y += 12) for (let x = 6; x < vw; x += 12) {
    n++;
    const e = document.elementFromPoint(x, y);
    if (!e || e.id === 'stage') continue;
    zu++;
    const k = (e.closest('[id]')?.id) || e.tagName.toLowerCase();
    wer[k] = (wer[k] || 0) + 1;
  }
  return { anteil: +(zu / n).toFixed(3), wer: Object.fromEntries(Object.entries(wer).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, +(v / n).toFixed(3)])) };
};

// Was trifft der Strahl beim Fund "Boot durch Steg"? Name und Weg der getroffenen Teile (zum Nachsehen, ob es
// ein sichtbarer Steg, ein Pfahl oder ein unsichtbares Hilfsteil ist)
const STEG_DETAIL = (id) => {
  const G = window.hafenmeister; const T = G.THREE;
  const a = String(id).startsWith('gast-') ? G.boatView?.boot?.(Number(String(id).slice(5))) ?? G.boatView?.boot?.(String(id).slice(5)) : null;
  if (!a?.info) return null;
  const ziele = []; G.stege?.group?.traverse((o) => { if (o.isMesh && o.visible && !(o.material?.transparent && (o.material.opacity ?? 1) < 0.5)) ziele.push(o); });
  const ray = new T.Raycaster(); const c = Math.cos(a.heading), s = -Math.sin(a.heading); const l = a.info.length * 0.85 / 2, w = (a.info.beam ?? a.info.length * 0.33) * 0.85 / 2;
  const out = [];
  for (const [i, j] of [[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 0], [-1, 0], [0, 0]]) {
    const x = a.x + c * l * i - s * w * j, z = a.z + s * l * i + c * w * j;
    ray.set(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0));
    const h = ray.intersectObjects(ziele, false).find((t) => t.point.y > 0.15);
    if (!h) continue;
    const weg = []; let o = h.object; while (o && o !== G.stege.group && weg.length < 4) { weg.push(o.name || o.geometry?.type || o.type); o = o.parent; }
    out.push(`${weg.join('<')} y${h.point.y.toFixed(2)}`);
  }
  return [...new Set(out)].join('; ');
};

module.exports = { PRUEFE, VERDECKUNG, STEG_DETAIL };
