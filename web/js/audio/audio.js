// Hafenmeister: Ton und Musik
//
// Alle Klänge werden zur Laufzeit mit der Web Audio API erzeugt.
// Es gibt keine Audiodateien, also auch keine Lizenzfragen und nichts zu laden.
//
// main.js lädt diese Datei automatisch und ruft init(game) auf. Danach:
//   game.audio.play('muenze');    // oder ohne Import: game.emit('sound', 'muenze')
//
// Direkt ohne Spielobjekt (z.B. Testseite):
//   import { audio } from './audio.js';
//   audio.init();                 // einmal beim Start, wartet auf die erste Berührung
//   audio.play('muenze');         // Effekt abspielen
//   audio.horn('L');              // Schiffshorn nach Größe
//   audio.setPhase('abend');      // 'tag' | 'abend' | 'nacht'
//   audio.setWeather('sturm');    // 'ruhig' | 'wind' | 'sturm'
//   audio.setHarbor({ stufe: 3, boote: 12 });
//   audio.setVolume('musik', 0.4);
//   audio.toggleMute();
//
// Details und Liste aller Klänge: web/js/audio/README.md

const STORAGE_KEY = 'hafenmeister.audio.v1';
const DEFAULTS = Object.freeze({ master: 0.8, musik: 0.5, atmo: 0.7, effekte: 0.8, stumm: false });
const VOLUME_KEYS = ['master', 'musik', 'atmo', 'effekte'];
const BUSES = ['musik', 'atmo', 'effekte'];
const MAX_VOICES = 24;
const SFX_GAIN = 2.2; // Effekte sind leise gebaut, hier auf Spielniveau angehoben
const MUSIC_GAIN = 3;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Regler 0..1 auf Lautstärke abbilden, damit sich der Regler gleichmäßig anfühlt.
const perceptual = (v) => v * v;

function loadSettings() {
  const s = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const k of VOLUME_KEYS) {
        if (typeof data[k] === 'number' && isFinite(data[k])) s[k] = clamp(data[k], 0, 1);
      }
      if (typeof data.stumm === 'boolean') s.stumm = data.stumm;
    }
  } catch (e) { /* privater Modus oder gesperrter Speicher: Standardwerte */ }
  return s;
}

function saveSettings(s) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* egal */ }
}

// ---------------------------------------------------------------------------
// Atmosphäre: Werte je Wetter und Tageszeit
// ---------------------------------------------------------------------------

const WETTER = {
  ruhig: { wave: 1.0, waveEvery: [4, 8], wind: 0.025, windF: [250, 600], windQ: 0.8, rain: 0, gull: 1, rig: 1, lap: 1, thunder: false },
  wind: { wave: 1.4, waveEvery: [3, 6], wind: 0.09, windF: [350, 1000], windQ: 1.2, rain: 0, gull: 0.6, rig: 2.2, lap: 1.4, thunder: false },
  sturm: { wave: 2.0, waveEvery: [2, 4], wind: 0.2, windF: [500, 1600], windQ: 2.0, rain: 0.05, gull: 0, rig: 3.5, lap: 2, thunder: true },
};

const TAGESZEIT = {
  tag: { gull: 1, vol: 1 },
  abend: { gull: 0.35, vol: 0.9 },
  nacht: { gull: 0, vol: 0.75 },
};

// ---------------------------------------------------------------------------
// Musik: 6/8-Takt, leichte Seemannslied-Stimmung, D-Dur
// ---------------------------------------------------------------------------

const DUR = [0, 4, 7];
const MOLL = [0, 3, 7];
const PENTA_DUR = [62, 64, 66, 69, 71]; // D E Fis A H
const PENTA_MOLL = [62, 65, 67, 69, 72]; // D F G A C

const MUSIK = {
  tag: {
    e: 0.21, pad: 0.03, pluck: 0.85, bass: 0.2, pulse: false, melody: 0.9, scale: PENTA_DUR,
    chords: [[62, DUR], [67, DUR], [62, DUR], [69, DUR], [71, MOLL], [67, DUR], [62, DUR], [69, DUR]],
  },
  abend: {
    e: 0.26, pad: 0.035, pluck: 0.35, bass: 0.17, pulse: false, melody: 0.7, scale: PENTA_DUR,
    chords: [[71, MOLL], [67, DUR], [62, DUR], [69, DUR]],
  },
  nacht: {
    e: 0.3, pad: 0.03, pluck: 0, bass: 0.13, pulse: false, melody: 0.45, scale: PENTA_DUR,
    chords: [[62, DUR], [71, MOLL], [67, DUR], [62, DUR]],
  },
  sturm: {
    e: 0.19, pad: 0.03, pluck: 0, bass: 0.13, pulse: true, melody: 0.5, scale: PENTA_MOLL,
    chords: [[62, MOLL], [70, DUR], [65, DUR], [69, DUR]],
  },
};

// Rhythmen für einen 6/8-Takt: [Achtel-Position, Länge in Achteln]
const RHYTHMEN = [
  [[0, 2], [2, 1], [3, 3]],
  [[0, 3], [3, 2], [5, 1]],
  [[0, 1], [1, 1], [2, 1], [3, 3]],
  [[0, 2], [2, 1], [3, 2], [5, 1]],
  [[0, 3], [3, 3]],
];
const SCHLUSS = [[[0, 6]], [[0, 3], [3, 3]]];

// ---------------------------------------------------------------------------
// Effekte
// ---------------------------------------------------------------------------

// label: Anzeige in der Testseite, wet: Hallanteil, gap: Mindestabstand in s
export const SOUNDS = {
  klick: { label: 'Antippen', wet: 0, gap: 0.03 },
  auswahl: { label: 'Boot ausgewählt', wet: 0.1, gap: 0.05 },
  abbrechen: { label: 'Abbrechen', wet: 0, gap: 0.05 },
  platz: { label: 'Platz zugewiesen', wet: 0.1, gap: 0.05 },
  anlegen: { label: 'Boot legt an', wet: 0.15, gap: 0.08 },
  ablegen: { label: 'Boot legt ab (Motor)', wet: 0.15, gap: 0.2 },
  platsch: { label: 'Platschen', wet: 0.1, gap: 0.05 },
  muenze: { label: 'Münze kassieren', wet: 0.15, gap: 0.015 },
  'strich-ende': { label: 'Münzstrich fertig', wet: 0.35, gap: 0.2 },
  'leine-greifen': { label: 'Leine greifen', wet: 0.1, gap: 0.1 },
  'leine-einrasten': { label: 'Leine rastet ein', wet: 0.15, gap: 0.06 },
  'vorspulen-start': { label: 'Vorspulen Start', wet: 0.3, gap: 0.3 },
  'vorspulen-ende': { label: 'Vorspulen Ende', wet: 0.3, gap: 0.3 },
  kasse: { label: 'Alles kassieren', wet: 0.2, gap: 0.3 },
  bauen: { label: 'Bauen (Hämmern)', wet: 0.15, gap: 0.3 },
  fertig: { label: 'Bau fertig', wet: 0.3, gap: 0.2 },
  stufe: { label: 'Neue Ausbaustufe', wet: 0.4, gap: 1 },
  bewertung: { label: 'Bewertung (Anker)', wet: 0.25, gap: 0.1 },
  abgelehnt: { label: 'Boot fährt weiter', wet: 0.2, gap: 0.3 },
  fehler: { label: 'Geht nicht', wet: 0, gap: 0.15 },
  hinweis: { label: 'Hinweis', wet: 0.25, gap: 0.3 },
  glocke: { label: 'Schiffsglocke', wet: 0.35, gap: 0.5 },
  horn: { label: 'Schiffshorn', wet: 0.3, gap: 0.25 },
  hafenhorn: { label: 'Hafenhorn (Kassieren)', wet: 0.45, gap: 0.8 },
  sturmwarnung: { label: 'Sturmwarnung', wet: 0.4, gap: 2 },
  regatta: { label: 'Regatta-Startschuss', wet: 0.5, gap: 1 },
  seenot: { label: 'Seenotretter läuft aus', wet: 0.3, gap: 2 },
};

// Schiffshörner: kleine Boote hoch und kurz, große tief und lang
const HOERNER = {
  S: { f: [523], len: 0.35, cut: 3500, peak: 0.11, wet: 0.15 },
  M: { f: [311], len: 0.7, cut: 2500, peak: 0.12, wet: 0.25 },
  L: { f: [185, 233], len: 1.1, cut: 1800, peak: 0.09, wet: 0.35 },
  XL: { f: [98, 147], len: 1.8, cut: 1100, peak: 0.09, wet: 0.5 },
  XXL: { f: [65, 98, 131], len: 2.6, cut: 800, peak: 0.065, wet: 0.6 }, // Kreuzfahrtschiff
};

// ---------------------------------------------------------------------------

class HafenAudio {
  constructor() {
    this.supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this.settings = typeof window !== 'undefined' ? loadSettings() : { ...DEFAULTS };
    this.state = { phase: 'tag', wetter: 'ruhig', stufe: 1, boote: 3 };
    this.ctx = null;
    this._initialized = false;
    this._listeners = new Set();
    this._lastPlayed = new Map();
    this._voiceEnds = [];
    this._timer = null;
    this._amb = null;
    this._mus = null;
    this._hiddenSuspended = false;
    this._onGesture = this._onGesture.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  // ---- Öffentliche Schnittstelle ------------------------------------------

  /** Einmal beim Start aufrufen. Ton beginnt mit der ersten Berührung oder Taste. */
  init() {
    if (this._initialized || !this.supported) return this;
    this._initialized = true;
    // Browser erlauben Ton erst nach einer Nutzeraktion. Auf iOS zählt touchend,
    // in Chrome pointerup oder keydown. Die Listener bleiben, damit der Ton nach
    // einer Unterbrechung (Anruf, Bildschirmsperre) wieder anspringt.
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown']) {
      window.addEventListener(ev, this._onGesture, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    return this;
  }

  /** true, sobald Ton tatsächlich läuft. */
  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Kann direkt aus einem Klick-Handler aufgerufen werden. */
  unlock() {
    if (!this.supported) return Promise.resolve(false);
    if (!this.ctx) this._build();
    const ctx = this.ctx;
    // iOS: einen stillen Puffer innerhalb der Geste abspielen
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch (e) { /* egal */ }
    const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    return Promise.resolve(p).then(() => {
      if (ctx.state === 'running') {
        this._startEngines();
        const p = this._pending;
        this._pending = null;
        if (p && Date.now() - p.at < 600) this.play(p.name, p.opts);
      }
      this._emit();
      return ctx.state === 'running';
    }).catch(() => false);
  }

  /** Effekt abspielen. opts: { pan: -1..1, volume: 0..1, delay: s, ... } */
  play(name, opts = {}) {
    const def = SOUNDS[name];
    if (def && !this.ready && this.ctx && !this.settings.stumm) {
      // Ton wird gerade freigeschaltet (erste Berührung): kurz merken und gleich nachholen
      this._pending = { name, opts, at: Date.now() };
      return false;
    }
    if (!def || !this.ready || this.settings.stumm || this.settings.effekte <= 0 || this.settings.master <= 0) return false;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const last = this._lastPlayed.get(name) || -1;
    if (now - last < def.gap) return false;
    this._voiceEnds = this._voiceEnds.filter((t) => t > now);
    if (this._voiceEnds.length >= MAX_VOICES) return false;
    this._lastPlayed.set(name, now);

    const t = now + 0.01 + Math.max(0, opts.delay || 0);
    const bus = this.bus.effekte;
    const out = ctx.createGain();
    out.gain.value = SFX_GAIN * clamp(opts.volume == null ? 1 : opts.volume, 0, 1.5);
    const pan = this._panner(opts.pan);
    out.connect(pan || bus.dry);
    if (pan) pan.connect(bus.dry);
    let wetAmount = def.wet;
    if (name === 'horn') wetAmount = (HOERNER[String(opts.groesse || 'M').toUpperCase()] || HOERNER.M).wet;
    let send = null;
    if (wetAmount > 0) {
      send = ctx.createGain();
      send.gain.value = wetAmount;
      (pan || out).connect(send);
      send.connect(bus.wet);
    }
    const dur = this._sfx[name].call(this, t, out, opts) || 1;
    this._voiceEnds.push(t + dur);
    this._cleanup([out, pan, send], dur + (t - now));
    return true;
  }

  /** Gleiche Funktion wie play(), Name für die Gesten-Module. */
  sfx(name, opts = {}) {
    return this.play(name, opts);
  }

  /** Schiffshorn. groesse: 'S' | 'M' | 'L' | 'XL' | 'XXL'. opts.stoesse: Anzahl Töne. */
  horn(groesse = 'M', opts = {}) {
    return this.play('horn', { ...opts, groesse });
  }

  setPhase(phase) {
    if (!TAGESZEIT[phase] || phase === this.state.phase) return;
    this.state.phase = phase;
    if (this._mus) this._mus.pendingChange = true;
    this._emit();
  }

  setWeather(wetter) {
    if (!WETTER[wetter] || wetter === this.state.wetter) return;
    this.state.wetter = wetter;
    if (this._mus) this._mus.pendingChange = true;
    if (this._amb) this._amb.next.wind = 0;
    this._emit();
  }

  /** stufe: Ausbaustufe 1..5, boote: Anzahl Boote im Hafen. Steuert, wie belebt es klingt. */
  setHarbor({ stufe, boote } = {}) {
    if (typeof stufe === 'number' && isFinite(stufe)) this.state.stufe = clamp(Math.round(stufe), 1, 9);
    if (typeof boote === 'number' && isFinite(boote)) this.state.boote = Math.max(0, Math.round(boote));
  }

  /** bus: 'master' | 'musik' | 'atmo' | 'effekte', value 0..1 */
  setVolume(bus, value) {
    if (!VOLUME_KEYS.includes(bus)) return;
    this.settings[bus] = clamp(Number(value) || 0, 0, 1);
    saveSettings(this.settings);
    this._applyVolumes();
    this._emit();
  }

  getVolume(bus) {
    return this.settings[bus];
  }

  setMuted(muted) {
    this.settings.stumm = !!muted;
    saveSettings(this.settings);
    this._applyVolumes();
    // Ein Knopfdruck auf "Ton an" ist eine Nutzeraktion, also gleich freischalten.
    if (!muted) this.unlock();
    this._emit();
  }

  toggleMute() {
    this.setMuted(!this.settings.stumm);
    return this.settings.stumm;
  }

  get muted() {
    return this.settings.stumm;
  }

  getSettings() {
    return { ...this.settings, ready: this.ready, ...this.state };
  }

  /** Wird bei jeder Änderung aufgerufen. Gibt eine Abmelde-Funktion zurück. */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * Fertiges Bedienfeld: Stummschalter und vier Regler.
   * Klassen beginnen mit hm-audio-, Aussehen in web/audio/audio.css.
   */
  createPanel() {
    const el = document.createElement('div');
    el.className = 'hm-audio-panel';
    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'hm-audio-mute';
    mute.addEventListener('click', () => this.toggleMute());
    el.appendChild(mute);
    const rows = [['master', 'Gesamt'], ['musik', 'Musik'], ['atmo', 'Hafen'], ['effekte', 'Effekte']];
    const inputs = {};
    for (const [key, text] of rows) {
      const label = document.createElement('label');
      label.className = 'hm-audio-row';
      const span = document.createElement('span');
      span.textContent = text;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.addEventListener('input', () => {
        this.setVolume(key, Number(input.value) / 100);
        if (key === 'effekte' || key === 'master') this.play('klick');
      });
      label.append(span, input);
      el.appendChild(label);
      inputs[key] = input;
    }
    const update = () => {
      mute.textContent = this.settings.stumm ? 'Ton an' : 'Ton aus';
      mute.setAttribute('aria-pressed', String(this.settings.stumm));
      el.classList.toggle('hm-audio-stumm', this.settings.stumm);
      for (const key of Object.keys(inputs)) {
        const v = String(Math.round(this.settings[key] * 100));
        if (inputs[key].value !== v) inputs[key].value = v;
      }
    };
    update();
    el.hmAudioDestroy = this.onChange(update);
    return el;
  }

  // ---- Aufbau ---------------------------------------------------------------

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      // Klingelt nicht, wenn das iPhone auf lautlos steht, und lässt eigene Musik weiterlaufen.
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch (e) { /* egal */ }
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    if (ctx.onstatechange !== undefined) ctx.onstatechange = () => this._emit();

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this._noise = { white: this._makeNoise('white', 3), brown: this._makeNoise('brown', 4) };
    const ir = this._makeImpulse(2.4, 2.8);

    this.bus = {};
    for (const name of BUSES) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      const dry = ctx.createGain();
      dry.connect(gain);
      let wet = dry;
      if (name !== 'atmo') {
        wet = ctx.createGain();
        const conv = ctx.createConvolver();
        conv.buffer = ir;
        wet.connect(conv);
        conv.connect(gain);
      }
      this.bus[name] = { node: gain, dry, wet };
    }
    this._applyVolumes(true);
  }

  _setDuck(factor) {
    this._duck = clamp(factor, 0, 1);
    this._applyVolumes();
  }

  _applyVolumes(instant = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const s = this.settings;
    const duck = this._duck == null ? 1 : this._duck;
    const set = (param, v) => {
      if (instant) param.setValueAtTime(v, now);
      else param.setTargetAtTime(v, now, 0.05);
    };
    set(this.master.gain, s.stumm ? 0 : perceptual(s.master));
    for (const name of BUSES) set(this.bus[name].node.gain, perceptual(s[name]) * (name === 'effekte' ? 1 : duck));
  }

  _makeNoise(kind, seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    // Übergang am Schleifenende glätten
    const fade = Math.min(2000, len >> 2);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
    }
    return buf;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.5;
    }
    return buf;
  }

  _startEngines() {
    if (!this._amb) this._ambStart();
    if (!this._mus) this._musStart();
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  }

  _tick() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._ambTick(now);
    this._musTick(now);
  }

  _onGesture() {
    if (this.ready || (typeof document !== 'undefined' && document.hidden)) return;
    if (this.settings.stumm && !this.ctx) return; // stumm: Kontext erst bei "Ton an" anlegen
    this.unlock();
  }

  _onVisibility() {
    if (!this.ctx) return;
    if (document.hidden) {
      // Hintergrund: Ton anhalten, spart Akku auf Handy und Tablet
      if (this.ctx.state === 'running') {
        this._hiddenSuspended = true;
        this.ctx.suspend().catch(() => {});
      }
    } else if (this._hiddenSuspended) {
      this._hiddenSuspended = false;
      // Kann auf iOS scheitern, dann springt der Ton bei der nächsten Berührung an.
      this.ctx.resume().then(() => this._emit()).catch(() => {});
    }
  }

  _emit() {
    const s = this.getSettings();
    for (const fn of this._listeners) {
      try { fn(s); } catch (e) { console.error(e); }
    }
  }

  // ---- Bausteine ------------------------------------------------------------

  _panner(pan) {
    if (typeof pan !== 'number' || !isFinite(pan) || !this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  _cleanup(nodes, after) {
    setTimeout(() => {
      for (const n of nodes) {
        if (n) try { n.disconnect(); } catch (e) { /* egal */ }
      }
    }, (after + 1.5) * 1000);
  }

  /** Lautstärke-Hüllkurve: 0 -> peak in a, halten, dann abklingen in d. */
  _env(dest, t, a, peak, d, hold = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    g.connect(dest);
    return g;
  }

  _filter(dest, type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  _osc(dest, type, freq, t, stop, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  /** Einzelner Ton mit Hüllkurve, optional mit Tonhöhengleiten. */
  _tone(dest, { type = 'sine', f, t, a = 0.005, d = 0.3, hold = 0, peak = 0.2, glide = 0, glideT = 0, detune = 0 }) {
    const g = this._env(dest, t, a, peak, d, hold);
    const end = t + a + hold + d + 0.05;
    const o = this._osc(g, type, f, t, end, detune);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + (glideT || a + hold + d));
    return end - t;
  }

  /** Gefiltertes Rauschen mit Hüllkurve. */
  _burst(dest, { kind = 'white', t, a = 0.002, d = 0.1, hold = 0, peak = 0.2, ftype = 'bandpass', f = 1000, q = 1, fTo = 0, fToT = 0 }) {
    const g = this._env(dest, t, a, peak, d, hold);
    const fl = this._filter(g, ftype, f, q);
    if (fTo) {
      fl.frequency.setValueAtTime(f, t);
      fl.frequency.exponentialRampToValueAtTime(fTo, t + (fToT || a + hold + d));
    }
    const end = t + a + hold + d + 0.05;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise[kind];
    src.loop = true;
    src.connect(fl);
    src.start(t, Math.random() * (src.buffer.duration - 0.5));
    src.stop(end);
    return end - t;
  }

  /** Metallischer Klang aus unharmonischen Teiltönen (Glocke, Fall am Mast). */
  _metal(dest, t, f, ratios, gains, decays, peak) {
    let len = 0;
    for (let i = 0; i < ratios.length; i++) {
      len = Math.max(len, this._tone(dest, { f: f * ratios[i], t, a: 0.002, d: decays[i], peak: peak * gains[i] }));
    }
    return len;
  }

  /** Ausgang für Atmosphäre-Ereignisse, wird nach dur wieder abgebaut. */
  _ambVoice(pan, vol, dur) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this._panner(pan);
    g.connect(p || this.bus.atmo.dry);
    if (p) p.connect(this.bus.atmo.dry);
    this._cleanup([g, p], dur + 0.5);
    return g;
  }

  // ---- Atmosphäre -------------------------------------------------------------

  _ambStart() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.bus.atmo.dry;
    const loop = (kind, node) => {
      const s = ctx.createBufferSource();
      s.buffer = this._noise[kind];
      s.loop = true;
      s.connect(node);
      s.start(now, Math.random() * 2);
      return s;
    };
    // Wellen: tiefes Rauschen, Lautstärke und Filter schwellen an und ab
    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0, now);
    waveGain.gain.linearRampToValueAtTime(0.08, now + 2);
    waveGain.connect(dest);
    const waveFilter = this._filter(waveGain, 'lowpass', 400, 0.5);
    loop('brown', waveFilter);
    // Wind
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windGain.connect(dest);
    const windFilter = this._filter(windGain, 'bandpass', 500, 0.8);
    loop('white', windFilter);
    // Regen bei Sturm
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(dest);
    const rainFilter = this._filter(rainGain, 'highpass', 2500, 0.5);
    loop('white', rainFilter);

    this._amb = {
      waveGain, waveFilter, windGain, windFilter, rainGain,
      next: {
        wave: now + 0.3, lap: now + 0.2, gull: now + rand(2, 6), rig: now + rand(1, 3),
        bell: now + rand(4, 10), thunder: now + rand(15, 30), wind: now, ship: now + rand(30, 60),
      },
    };
  }

  _ambTick(now) {
    const a = this._amb;
    const w = WETTER[this.state.wetter];
    const z = TAGESZEIT[this.state.phase];
    const { stufe, boote } = this.state;
    const n = a.next;
    const horizon = now + 0.25;

    // Wind und Regen nachführen
    if (n.wind <= now) {
      a.windFilter.frequency.setTargetAtTime(rand(w.windF[0], w.windF[1]), now, 0.8);
      a.windFilter.Q.setTargetAtTime(w.windQ, now, 0.8);
      a.windGain.gain.setTargetAtTime(w.wind * rand(0.6, 1.3) * z.vol, now, 1.0);
      a.rainGain.gain.setTargetAtTime(w.rain * rand(0.8, 1.1), now, 1.5);
      n.wind = now + rand(0.8, 1.6);
    }

    // Welle läuft an den Strand / die Mole
    if (n.wave < horizon) {
      const t = Math.max(n.wave, now);
      const peak = Math.min(0.6, 0.26 * w.wave * z.vol * rand(0.7, 1.2));
      const base = 0.08 * Math.min(1.6, w.wave) * z.vol;
      a.waveGain.gain.setTargetAtTime(peak, t, 0.7);
      a.waveGain.gain.setTargetAtTime(base, t + 1.8, 1.3);
      a.waveFilter.frequency.setTargetAtTime(rand(800, 1200) * Math.min(1.4, w.wave), t, 0.7);
      a.waveFilter.frequency.setTargetAtTime(380, t + 1.8, 1.3);
      n.wave = t + rand(w.waveEvery[0], w.waveEvery[1]);
    }

    // Plätschern am Rumpf und an den Stegen
    if (n.lap < horizon) {
      const t = Math.max(n.lap, now);
      const out = this._ambVoice(rand(-0.7, 0.7), z.vol, 0.5);
      this._burst(out, { t, a: 0.02, d: rand(0.08, 0.22), peak: 0.035 * w.lap, f: rand(500, 1400), q: 1.4 });
      n.lap = t + rand(0.25, 1.0) / Math.min(2, w.lap);
    }

    // Möwen
    if (n.gull < horizon) {
      const t = Math.max(n.gull, now);
      const rate = w.gull * z.gull;
      if (rate > 0 && Math.random() < rate) this._gull(t);
      n.gull = t + rand(7, 20) / Math.max(0.35, rate || 0.35);
    }

    // Fallen klappern an den Masten, mehr Boote und mehr Wind = öfter
    if (n.rig < horizon) {
      const t = Math.max(n.rig, now);
      if (boote > 0) this._rigging(t, w.wind);
      const busy = 0.3 + Math.min(boote, 40) / 10;
      n.rig = t + rand(1.5, 5) / (w.rig * busy);
    }

    // Glockentonne an der Ansteuerung (ab Stufe 5)
    if (n.bell < horizon) {
      const t = Math.max(n.bell, now);
      if (stufe >= 5) {
        const out = this._ambVoice(rand(-0.9, -0.5), 0.6 * z.vol, 5);
        this._metal(out, t, rand(370, 400), [0.5, 1, 1.19, 1.5, 2, 2.5], [0.6, 1, 0.5, 0.35, 0.3, 0.15], [4, 3, 2, 1.6, 1.2, 0.8], 0.05);
      }
      n.bell = t + rand(6, 16) / Math.min(2, w.wave);
    }

    // Fernes Schiffshorn, wenn der Hafen groß ist
    if (n.ship < horizon) {
      const t = Math.max(n.ship, now);
      if (stufe >= 4 && this.state.wetter !== 'sturm') {
        const out = this._ambVoice(rand(-0.8, 0.8), 0.6, 4);
        const lp = this._filter(out, 'lowpass', 500, 0.7);
        this._sfx.horn.call(this, t, lp, { groesse: Math.random() < 0.5 ? 'XL' : 'XXL' });
      }
      n.ship = t + rand(40, 90);
    }

    // Ferner Donner bei Sturm
    if (n.thunder < horizon) {
      const t = Math.max(n.thunder, now);
      if (w.thunder) {
        const out = this._ambVoice(rand(-0.6, 0.6), 1, 6);
        this._burst(out, { kind: 'brown', t, a: 0.15, hold: 0.4, d: 3.5, peak: 0.5, ftype: 'lowpass', f: 220, fTo: 70, fToT: 3, q: 0.7 });
      }
      n.thunder = t + rand(15, 40);
    }
  }

  _gull(t) {
    const out = this._ambVoice(rand(-0.9, 0.9), rand(0.35, 1), 3);
    const f0 = rand(1250, 1650);
    const calls = 2 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let i = 0; i < calls; i++) {
      const long = i === 0 ? rand(0.3, 0.45) : rand(0.15, 0.25);
      const f = f0 * rand(0.95, 1.05);
      const g = this._env(out, tt, 0.02, 0.05, long);
      const bp = this._filter(g, 'bandpass', 1900, 1.8);
      const end = tt + long + 0.1;
      for (const [type, mul, det] of [['sawtooth', 1, 0], ['triangle', 2, 8]]) {
        const o = this._osc(bp, type, f * mul * 0.82, tt, end, det);
        o.frequency.exponentialRampToValueAtTime(f * mul, tt + 0.04);
        o.frequency.exponentialRampToValueAtTime(f * mul * 0.62, tt + long);
      }
      tt += long + rand(0.06, 0.14);
    }
  }

  _rigging(t, wind) {
    const out = this._ambVoice(rand(-0.8, 0.8), rand(0.5, 1), 1.5);
    const f = rand(1500, 2600);
    const peak = 0.025 + wind * 0.08;
    this._metal(out, t, f, [1, 2.32, 4.25, 6.63], [1, 0.5, 0.3, 0.15], [0.45, 0.3, 0.2, 0.12], peak);
    if (Math.random() < 0.4) this._metal(out, t + rand(0.08, 0.2), f * 0.98, [1, 2.32, 4.25], [1, 0.5, 0.3], [0.35, 0.25, 0.15], peak * 0.7);
  }

  // ---- Musik ----------------------------------------------------------------

  _musStart() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const input = ctx.createGain();
    input.gain.setValueAtTime(0, now);
    input.gain.linearRampToValueAtTime(MUSIC_GAIN, now + 4);
    input.connect(this.bus.musik.dry);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    input.connect(send);
    send.connect(this.bus.musik.wet);
    this._mus = {
      input,
      nextBar: now + 0.3,
      bar: 12, // 4 Takte Begleitung, dann die erste Melodie
      chord: 0,
      prog: this._musProg(),
      melody: null,
      pendingChange: false,
    };
  }

  _musProg() {
    return this.state.wetter === 'sturm' ? MUSIK.sturm : MUSIK[this.state.phase];
  }

  _musAudible() {
    const s = this.settings;
    return !s.stumm && s.master > 0 && s.musik > 0;
  }

  _musTick(now) {
    const m = this._mus;
    if (!this._musAudible()) {
      m.nextBar = now + 0.3;
      return;
    }
    if (m.nextBar < now - 0.1) m.nextBar = now + 0.05; // nach Pause oder Hintergrund
    while (m.nextBar < now + 0.3) {
      if (m.pendingChange) {
        m.pendingChange = false;
        m.prog = this._musProg();
        m.chord = 0;
        m.bar = 12;
        m.melody = null;
      }
      this._musBar(m.nextBar);
      m.nextBar += m.prog.e * 6;
    }
  }

  _musBar(t) {
    const m = this._mus;
    const p = m.prog;
    const e = p.e;
    const bar = m.bar % 16;
    const [root, quality] = p.chords[m.chord % p.chords.length];
    const out = m.input;

    // Fläche: weiche, leicht verstimmte Sägezähne hinter einem Tiefpass
    const padLen = e * 6;
    const lp = this._filter(out, 'lowpass', 900, 0.6);
    for (const iv of quality) {
      const f = mtof(root - 12 + iv);
      const g = this._env(lp, t, 0.5, p.pad, 0.9, Math.max(0, padLen - 0.5));
      const end = t + padLen + 1;
      this._osc(g, 'sawtooth', f, t, end, -7);
      this._osc(g, 'sawtooth', f, t, end, 7);
    }

    // Bass
    if (p.pulse) {
      for (let s = 0; s < 6; s++) {
        this._tone(out, { type: 'triangle', f: mtof(root - 24), t: t + s * e, a: 0.01, d: e * 0.9, peak: s % 3 === 0 ? p.bass : p.bass * 0.6 });
      }
    } else {
      this._tone(out, { type: 'triangle', f: mtof(root - 24), t, a: 0.01, d: e * 2.5, peak: p.bass });
      this._tone(out, { type: 'triangle', f: mtof(root - 24 + 7), t: t + 3 * e, a: 0.01, d: e * 2, peak: p.bass * 0.75 });
    }

    // Gezupfte Begleitung
    if (p.pluck > 0) {
      const tones = quality.map((iv) => root + iv);
      const steps = [[1, tones[1]], [2, tones[2]], [4, tones[1]], [5, tones[0] + 12]];
      for (const [s, note] of steps) {
        if (Math.random() < p.pluck) {
          this._tone(out, { type: 'triangle', f: mtof(note), t: t + s * e, a: 0.003, d: 0.4, peak: 0.045 });
        }
      }
    }

    // Melodie: 16 Takte im Kreis, Takt 0..7 Melodie, Takt 8..15 Pause
    if (bar === 0) m.melody = Math.random() < p.melody ? this._musMelody(m.chord, p) : null;
    if (m.melody && bar < 8) {
      for (const n of m.melody[bar]) {
        this._flute(out, t + n.step * e, n.len * e, mtof(n.midi));
      }
    }

    m.bar++;
    m.chord++;
  }

  /** Erzeugt 8 Takte Melodie: Phrase A (4 Takte) und A' (gleicher Anfang, anderes Ende). */
  _musMelody(startChord, p) {
    const scale = [];
    for (const o of [0, 12, 24]) for (const s of p.scale) scale.push(s + o);
    const usable = scale.filter((x) => x >= 66 && x <= 88);
    const nearestIdx = (midi) => {
      let best = 0;
      for (let i = 0; i < usable.length; i++) if (Math.abs(usable[i] - midi) < Math.abs(usable[best] - midi)) best = i;
      return best;
    };
    const chordAt = (b) => p.chords[(startChord + b) % p.chords.length];
    const isChordTone = (midi, b) => {
      const [root, q] = chordAt(b);
      return q.some((iv) => ((midi - root - iv) % 12 + 12) % 12 === 0);
    };
    const r1 = pick(RHYTHMEN);
    const r2 = pick(RHYTHMEN);
    const rhythm = [r1, r2, r1, pick(SCHLUSS)];
    let idx = nearestIdx(74 + Math.floor(rand(-2, 5)));
    const gen = (b, from, last) => {
      const notes = [];
      const pattern = rhythm[b % 4];
      for (let k = 0; k < pattern.length; k++) {
        const [step, len] = pattern[k];
        if (last && k === pattern.length - 1) {
          // Phrasenende auf dem Grundton des Akkords
          const root = chordAt(b)[0];
          let target = root;
          while (target < 70) target += 12;
          idx = nearestIdx(target);
        } else if (step === 0 || step === 3) {
          let tries = 0;
          let cand = idx;
          do {
            cand = clamp(idx + Math.round(rand(-2, 2)), 0, usable.length - 1);
            tries++;
          } while (!isChordTone(usable[cand], b) && tries < 8);
          idx = cand;
        } else {
          idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2]), 0, usable.length - 1);
        }
        notes.push({ step, len, midi: usable[idx] });
      }
      return notes;
    };
    const bars = [];
    for (let b = 0; b < 4; b++) bars.push(gen(b, idx, b === 3));
    bars.push(bars[0].map((n) => ({ ...n })), bars[1].map((n) => ({ ...n })));
    idx = nearestIdx(bars[1][bars[1].length - 1].midi);
    bars.push(gen(6, idx, false), gen(7, idx, true));
    return bars;
  }

  /** Flötenartige Stimme mit leichtem Vibrato. */
  _flute(dest, t, len, f) {
    const ctx = this.ctx;
    const hold = Math.max(0.05, len * 0.85 - 0.05);
    const g = this._env(dest, t, 0.05, 0.06, 0.25, hold);
    const end = t + hold + 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.3, hold));
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(end);
    const o1 = this._osc(g, 'sine', f, t, end);
    const tri = ctx.createGain();
    tri.gain.value = 0.25;
    tri.connect(g);
    const o2 = this._osc(tri, 'triangle', f, t, end);
    depth.connect(o1.frequency);
    depth.connect(o2.frequency);
  }
}

// ---------------------------------------------------------------------------
// Effekt-Erzeuger. Jeder bekommt (t, out, opts) und gibt die Dauer in s zurück.
// ---------------------------------------------------------------------------

HafenAudio.prototype._sfx = {
  klick(t, out) {
    return this._tone(out, { f: 1100, glide: 850, t, a: 0.002, d: 0.05, peak: 0.12 });
  },

  auswahl(t, out) {
    this._tone(out, { type: 'triangle', f: 660, t, d: 0.08, peak: 0.13 });
    return 0.06 + this._tone(out, { type: 'triangle', f: 990, t: t + 0.06, d: 0.14, peak: 0.12 });
  },

  abbrechen(t, out) {
    this._tone(out, { type: 'triangle', f: 700, t, d: 0.08, peak: 0.1 });
    return 0.06 + this._tone(out, { type: 'triangle', f: 500, t: t + 0.06, d: 0.12, peak: 0.1 });
  },

  platz(t, out) {
    // Holzklopfen auf dem Steg
    this._burst(out, { t, d: 0.05, peak: 0.3, f: 900, q: 3 });
    return this._tone(out, { f: 230, glide: 150, t, a: 0.002, d: 0.12, peak: 0.25 });
  },

  anlegen(t, out) {
    // dumpfer Stoß gegen den Fender, Wasser schwappt, Leine knarzt
    this._tone(out, { f: 90, glide: 55, t, a: 0.01, d: 0.35, peak: 0.4 });
    this._burst(out, { kind: 'brown', t, a: 0.03, d: 0.45, peak: 0.25, ftype: 'lowpass', f: 450, q: 0.7 });
    const g = this._env(out, t + 0.18, 0.05, 0.11, 0.25, 0.15);
    const bp = this._filter(g, 'bandpass', 1200, 4);
    const o = this._osc(bp, 'sawtooth', 48, t + 0.18, t + 0.7);
    o.frequency.linearRampToValueAtTime(31, t + 0.6);
    return 0.8;
  },

  ablegen(t, out) {
    // Außenborder springt an und entfernt sich
    const g = this._env(out, t, 0.2, 0.13, 1.0, 0.7);
    const lp = this._filter(g, 'lowpass', 520, 1);
    const end = t + 2;
    const o1 = this._osc(lp, 'sawtooth', 55, t, end);
    const o2 = this._osc(lp, 'square', 110, t, end, 9);
    for (const o of [o1, o2]) o.frequency.exponentialRampToValueAtTime(o === o1 ? 75 : 150, t + 0.9);
    this._burst(out, { kind: 'brown', t: t + 0.1, a: 0.3, hold: 0.5, d: 0.9, peak: 0.14, ftype: 'lowpass', f: 650 });
    return 2;
  },

  platsch(t, out) {
    this._burst(out, { t, a: 0.005, d: 0.35, peak: 0.28, f: 2500, fTo: 600, q: 0.8 });
    return this._burst(out, { kind: 'brown', t, a: 0.01, d: 0.5, peak: 0.2, ftype: 'lowpass', f: 320 });
  },

  muenze(t, out, o) {
    // opts.combo: Nummer der Münze in einem Strich (1, 2, 3, ...). Jede klingt eine
    // Stufe höher auf der Pentatonik, nach zwei Oktaven fängt es eine Oktave tiefer neu an.
    let det = (o.pitch || 0) * 100 + rand(-10, 10);
    if (o.combo > 1) {
      const PENTA = [0, 200, 400, 700, 900];
      const k = (Math.round(o.combo) - 1) % 10;
      det = Math.floor(k / 5) * 1200 + PENTA[k % 5] - 500 + rand(-5, 5);
    }
    this._tone(out, { f: 1975.5, t, a: 0.001, d: 0.08, peak: 0.12, detune: det });
    this._tone(out, { type: 'triangle', f: 2637, t: t + 0.07, a: 0.001, d: 0.12, peak: 0.05, detune: det });
    return 0.07 + this._tone(out, { f: 2637, t: t + 0.07, a: 0.001, d: 0.4, peak: 0.12, detune: det });
  },

  'strich-ende'(t, out, o) {
    // Akkord zum Abschluss eines Münzstrichs: je mehr Münzen, desto voller und heller
    const n = Math.max(1, Math.round(o.anzahl || 1));
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    const count = clamp(1 + Math.floor(Math.log2(n + 1)), 2, notes.length);
    const peak = 0.07 / Math.sqrt(count) * 1.6;
    for (let i = 0; i < count; i++) {
      this._tone(out, { type: 'triangle', f: notes[i], t: t + i * 0.03, a: 0.005, d: 0.9, peak });
      this._tone(out, { f: notes[i] * 2, t: t + i * 0.03, a: 0.002, d: 0.4, peak: peak * 0.3 });
    }
    if (n >= 10) this._tone(out, { f: 2093, t: t + 0.2, a: 0.001, d: 1.0, peak: 0.08 });
    return 1.4;
  },

  'leine-greifen'(t, out) {
    // Tau wird gegriffen: kurzes Reiben und ein weiches Rucken
    this._burst(out, { t, a: 0.01, d: 0.12, peak: 0.12, f: 1800, q: 0.9, fTo: 900 });
    return this._tone(out, { f: 160, glide: 120, t: t + 0.02, a: 0.005, d: 0.1, peak: 0.12 });
  },

  'leine-einrasten'(t, out) {
    // Platz gefunden: hölzernes Klacken und ein kleiner heller Ton
    this._burst(out, { t, d: 0.04, peak: 0.22, f: 1400, q: 4 });
    this._tone(out, { f: 330, glide: 260, t, a: 0.002, d: 0.07, peak: 0.16 });
    return this._tone(out, { type: 'triangle', f: 1318.51, t: t + 0.04, a: 0.003, d: 0.25, peak: 0.07 });
  },

  'vorspulen-start'(t, out) {
    // Zeit zieht an: aufsteigendes Rauschen mit Tick
    this._burst(out, { t, a: 0.35, d: 0.25, peak: 0.13, f: 400, fTo: 3000, fToT: 0.6, q: 2 });
    for (let i = 0; i < 4; i++) this._tone(out, { f: 1500 + i * 250, t: t + i * 0.12, a: 0.001, d: 0.04, peak: 0.05 });
    return 0.8;
  },

  'vorspulen-ende'(t, out) {
    this._burst(out, { t, a: 0.05, d: 0.5, peak: 0.1, f: 2500, fTo: 350, q: 2 });
    return 0.35 + this._tone(out, { type: 'triangle', f: 783.99, t: t + 0.35, a: 0.004, d: 0.6, peak: 0.08 });
  },

  kasse(t, out) {
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.06 + rand(0, 0.02);
      const det = rand(-60, 60);
      this._tone(out, { f: 1975.5, t: tt, a: 0.001, d: 0.06, peak: 0.07, detune: det });
      this._tone(out, { f: 2637, t: tt + 0.05, a: 0.001, d: 0.25, peak: 0.07, detune: det });
    }
    this._tone(out, { f: 2093, t: t + 0.38, a: 0.001, d: 0.9, peak: 0.12 });
    this._tone(out, { f: 4186, t: t + 0.38, a: 0.001, d: 0.5, peak: 0.04 });
    return 1.4;
  },

  bauen(t, out) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.22;
      this._burst(out, { t: tt, d: 0.06, peak: 0.28, f: 2200, q: 1.2 });
      this._tone(out, { f: 190 - i * 8, glide: 120, t: tt, a: 0.002, d: 0.1, peak: 0.28 });
    }
    return 0.7;
  },

  fertig(t, out) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this._tone(out, { type: 'triangle', f, t: t + i * 0.08, a: 0.004, d: 0.45, peak: 0.1 }));
    return 0.9;
  },

  stufe(t, out) {
    // kleine Fanfare mit Messing-Klang
    const play = (f, tt, len, peak) => {
      const g = this._env(out, tt, 0.03, peak, 0.3, len);
      const lp = this._filter(g, 'lowpass', f * 5, 0.8);
      this._osc(lp, 'sawtooth', f, tt, tt + len + 0.4, -5);
      this._osc(lp, 'sawtooth', f, tt, tt + len + 0.4, 5);
    };
    play(392, t, 0.12, 0.07);
    play(523.25, t + 0.16, 0.12, 0.07);
    play(659.25, t + 0.32, 0.12, 0.07);
    play(783.99, t + 0.48, 0.7, 0.08);
    play(523.25, t + 0.48, 0.7, 0.05);
    play(392, t + 0.48, 0.7, 0.05);
    [1568, 2093, 2637, 3136].forEach((f, i) => this._tone(out, { f, t: t + 0.5 + i * 0.07, a: 0.002, d: 0.5, peak: 0.04 }));
    return 2;
  },

  bewertung(t, out, o) {
    const n = clamp(Math.round(o.anker || 5), 1, 5);
    const scale = n >= 3 ? [880, 987.77, 1108.73, 1318.51, 1479.98] : [659.25, 622.25];
    for (let i = 0; i < n; i++) {
      const f = scale[Math.min(i, scale.length - 1)];
      this._tone(out, { f, t: t + i * 0.1, a: 0.002, d: 0.3, peak: 0.1 });
      this._tone(out, { type: 'triangle', f: f * 2, t: t + i * 0.1, a: 0.002, d: 0.15, peak: 0.03 });
    }
    return n * 0.1 + 0.4;
  },

  abgelehnt(t, out) {
    [523.25, 440, 349.23].forEach((f, i) => this._tone(out, { f, t: t + i * 0.13, a: 0.01, d: 0.25, peak: 0.09 }));
    return 0.7;
  },

  fehler(t, out) {
    this._tone(out, { type: 'triangle', f: 330, t, a: 0.005, d: 0.12, peak: 0.13 });
    return 0.1 + this._tone(out, { type: 'triangle', f: 247, t: t + 0.1, a: 0.005, d: 0.2, peak: 0.13 });
  },

  hinweis(t, out) {
    this._tone(out, { f: 784, t, a: 0.003, d: 0.3, peak: 0.1 });
    return 0.12 + this._tone(out, { f: 1175, t: t + 0.12, a: 0.003, d: 0.4, peak: 0.09 });
  },

  glocke(t, out, o) {
    // Schiffsglocke, zwei Schläge (opts.schlaege: 1..8)
    const n = clamp(Math.round(o.schlaege || 2), 1, 8);
    let tt = t;
    for (let i = 0; i < n; i++) {
      this._metal(out, tt, 1020, [1, 2.0, 2.4, 3.0, 4.1], [1, 0.5, 0.35, 0.25, 0.15], [1.6, 1.0, 0.8, 0.6, 0.4], 0.11);
      tt += i % 2 === 0 ? 0.32 : 0.75; // paarweise wie beim Glasen
    }
    return tt - t + 1.6;
  },

  horn(t, out, o) {
    const spec = HOERNER[String(o.groesse || 'M').toUpperCase()] || HOERNER.M;
    const n = clamp(Math.round(o.stoesse || 1), 1, 5);
    const len = o.kurz ? spec.len * 0.4 : spec.len;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const g = this._env(out, tt, 0.07, spec.peak, 0.3, len);
      const lp = this._filter(g, 'lowpass', spec.cut, 0.7);
      const end = tt + len + 0.45;
      for (const f of spec.f) {
        for (const [type, det, mul] of [['sawtooth', -7, 1], ['sawtooth', 7, 1], ['square', 0, 0.5]]) {
          const osc = this._osc(lp, type, f * mul * 0.96, tt, end, det);
          osc.frequency.exponentialRampToValueAtTime(f * mul, tt + 0.1);
        }
      }
      tt += len + 0.35;
    }
    return tt - t + 0.6;
  },

  hafenhorn(t, out, o) {
    // Warmes Signalhorn des Hafenbüros: Dreiklang D-A-D mit weichem Einsatz.
    // opts.lang: true für einen längeren Ton
    const len = o.lang ? 1.6 : 0.9;
    const g = this._env(out, t, 0.12, 0.11, 0.6, len);
    const lp = this._filter(g, 'lowpass', 300, 0.9);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1400, t + 0.15);
    lp.frequency.linearRampToValueAtTime(900, t + len);
    const end = t + len + 0.8;
    for (const [f, vol] of [[146.83, 1], [220, 0.7], [293.66, 0.55]]) {
      const v = this.ctx.createGain();
      v.gain.value = vol;
      v.connect(lp);
      for (const det of [-6, 6]) {
        const osc = this._osc(v, 'sawtooth', f * 0.97, t, end, det);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      }
    }
    // tiefer Grundton für Fülle, auf Handy-Lautsprechern kaum hörbar, auf Kopfhörern schön
    this._tone(out, { f: 73.42, t, a: 0.15, hold: len, d: 0.6, peak: 0.12 });
    return len + 1.4;
  },

  sturmwarnung(t, out) {
    let len = this._sfx.horn.call(this, t, out, { groesse: 'XL', stoesse: 2, kurz: true });
    len = Math.max(len, 1.6 + this._sfx.glocke.call(this, t + 1.6, out, { schlaege: 4 }));
    return len;
  },

  regatta(t, out) {
    // Startschuss
    this._burst(out, { t, a: 0.001, d: 0.7, peak: 0.35, ftype: 'lowpass', f: 3000, fTo: 200, q: 0.7 });
    this._tone(out, { f: 60, glide: 35, t, a: 0.002, d: 0.5, peak: 0.3 });
    return 1.5;
  },

  seenot(t, out) {
    // Zweiklang-Signal, dann das Horn eines Seenotrettungskreuzers
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.45;
      const f = i % 2 === 0 ? 466.16 : 622.25;
      const g = this._env(out, tt, 0.02, 0.04, 0.1, 0.3);
      const lp = this._filter(g, 'lowpass', 2500, 0.7);
      this._osc(lp, 'square', f, tt, tt + 0.5);
    }
    return 1.9 + this._sfx.horn.call(this, t + 1.9, out, { groesse: 'L', kurz: true, stoesse: 2 });
  },
};

export const audio = new HafenAudio();

// ---------------------------------------------------------------------------
// Anbindung an das Grundgerüst (main.js ruft init(game) auf)
// ---------------------------------------------------------------------------

/**
 * Hängt den Ton an das Spielobjekt:
 *   game.audio                         die Audio-Instanz
 *   game.emit('sound', 'muenze')       Effekt, auch als { name, pan, volume, ... }
 *   game.emit('horn', 'XL')            Schiffshorn, auch als { groesse, stoesse, pan }
 *   game.emit('phase', 'abend')        Tageszeit, wird auch aus body[data-phase] gelesen
 *   game.emit('weather', 'sturm')      Wetter
 *   game.emit('harbor', { stufe, boote })
 * Legt außerdem einen Knopf "Ton" in die obere Leiste (#hud-top), der Stummschalter
 * und Regler öffnet. options.button = false lässt ihn weg.
 */
export function init(game, options = {}) {
  audio.init();
  if (!game) return audio;
  game.audio = audio;

  game.on('sound', (d) => {
    if (typeof d === 'string') audio.play(d);
    else if (d && d.name) audio.play(d.name, d);
  });
  game.on('horn', (d) => {
    if (typeof d === 'string') audio.horn(d);
    else audio.horn((d && d.groesse) || 'M', d || {});
  });
  game.on('phase', (p) => {
    const ph = typeof p === 'string' ? p : p && p.phase;
    const before = audio.state.phase;
    audio.setPhase(ph);
    // Abend: die Schiffsglocke schlägt, der Tag ist vorbei
    if (ph === 'abend' && before === 'tag') audio.play('glocke', { schlaege: 4, volume: 0.7 });
  });
  let lastStufe = null;
  game.on('stufe', (n) => {
    if (typeof n !== 'number') return;
    audio.setHarbor({ stufe: n });
    if (lastStufe != null && n > lastStufe) audio.play('stufe');
    lastStufe = n;
  });
  if (game.state && typeof game.state.stufe === 'number') {
    lastStufe = game.state.stufe;
    audio.setHarbor({ stufe: lastStufe });
  }
  // ui:mute ohne Daten schaltet um, mit true/false oder { stumm } gezielt
  game.on('ui:mute', (d) => {
    if (typeof d === 'boolean') audio.setMuted(d);
    else if (d && typeof d.stumm === 'boolean') audio.setMuted(d.stumm);
    else audio.toggleMute();
  });
  // Hafenhorn beim Kassieren, wenn der Auslöser das Horn war: game.emit('ui:collect', { horn: true })
  game.on('ui:collect', (d) => { if (d && d.horn) audio.play('hafenhorn'); });
  game.on('weather', (w) => audio.setWeather(typeof w === 'string' ? w : w && w.wetter));
  game.on('harbor', (h) => audio.setHarbor(h || {}));

  // Pause: Musik und Hafen leiser, aber nicht aus
  game.on('pause', (p) => audio._setDuck(p ? 0.45 : 1));

  // Tageszeit aus body[data-phase] übernehmen, falls jemand sie dort setzt
  const body = document.body;
  if (body) {
    const readPhase = () => {
      const ph = body.getAttribute('data-phase');
      if (ph) audio.setPhase(ph);
    };
    readPhase();
    new MutationObserver(readPhase).observe(body, { attributes: true, attributeFilter: ['data-phase'] });
  }

  if (options.button !== false) addSoundButton();
  return audio;
}

function addSoundButton() {
  if (document.getElementById('btn-sound')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./audio.css', import.meta.url).href;
  document.head.appendChild(link);

  const bar = document.getElementById('hud-top');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-sound';
  btn.className = 'hud-btn hm-audio-btn';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');

  const panel = audio.createPanel();
  panel.id = 'hm-audio-popover';
  panel.hidden = true;

  const close = () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    audio.unlock();
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!panel.hidden && !panel.contains(ev.target) && ev.target !== btn) close();
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });

  const label = () => {
    btn.textContent = audio.muted ? 'Stumm' : 'Ton';
    btn.setAttribute('aria-label', audio.muted ? 'Ton ist aus, Einstellungen öffnen' : 'Ton-Einstellungen');
    btn.classList.toggle('hm-audio-off', audio.muted);
  };
  label();
  audio.onChange(label);

  if (bar) {
    const before = document.getElementById('btn-overview');
    bar.insertBefore(btn, before && before.parentNode === bar ? before : null);
    (bar.parentNode || document.body).appendChild(panel);
  } else {
    btn.classList.add('hm-audio-float');
    document.body.append(btn, panel);
  }
}

export default init;
