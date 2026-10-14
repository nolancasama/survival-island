/**
 * Procedural Web Audio: no files, no network. Ocean swell, wind, birds by day
 * and crickets at dusk, campfire crackle, a quiet marimba tune, and every
 * action sound are synthesised here.
 *
 * Buses: music and ambience duck under spoken English and go silent while the
 * microphone listens (classroom speakers bleed into the mic).
 */

type Wave = OscillatorType;

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type SfxName =
  | "step"
  | "wood"
  | "stone"
  | "coconut"
  | "rope"
  | "chop"
  | "leaves"
  | "build"
  | "bridge"
  | "fill"
  | "gulp"
  | "cast"
  | "plop"
  | "fishSplash"
  | "sizzle"
  | "sleep"
  | "morning"
  | "munch"
  | "craft"
  | "place"
  | "ignite"
  | "box"
  | "correct"
  | "error"
  | "tick"
  | "micOn"
  | "micOff"
  | "sparkle"
  | "ping"
  | "fanfare"
  | "unlock"
  | "full"
  | "faint"
  | "rotate";

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private ambBus!: GainNode;
  private ambDuck!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private musicVolume = 0.35;
  private sfxVolume = 0.75;
  private speaking = false;
  private listening = false;
  private ocean: { near: GainNode; swell: GainNode } | null = null;
  private fire: GainNode | null = null;
  private fireTimer = 0;
  private fireLevel = 0;
  /** 1 = day (birds), 0 = night (crickets). */
  private daylight = 1;
  private seaNearness = 0.5;
  private musicTimer = 0;
  private music: { next: number; step: number; mood: "day" | "dusk" | "night" } | null = null;

  /** Must be called from a user gesture (Start button). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicDuck = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.musicDuck).connect(this.master);
      this.ambDuck = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.ambBus.connect(this.ambDuck).connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.noise = this.makeNoise(3);
      this.applyVolumes();
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Slightly pinked noise: softer than white, nicer for surf and wind.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.6 + white * 0.4;
      data[i] = last * 1.6;
    }
    return buf;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.3, t, 0.05);
    this.ambBus.gain.setTargetAtTime(Math.max(this.musicVolume, 0.25) * 0.7, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.05);
    this.applyDuck();
  }

  private applyDuck() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const music = this.listening ? 0 : this.speaking ? 0.3 : 1;
    const amb = this.listening ? 0.05 : this.speaking ? 0.45 : 1;
    this.musicDuck.gain.setTargetAtTime(music, t, 0.08);
    this.ambDuck.gain.setTargetAtTime(amb, t, 0.08);
  }

  /** English is being spoken: duck the background. */
  setSpeaking(on: boolean) {
    this.speaking = on;
    this.applyDuck();
  }

  /** Microphone open: silence the background and footsteps. */
  setListening(on: boolean) {
    this.listening = on;
    this.applyDuck();
  }

  get isListening() {
    return this.listening;
  }

  // ------------------------------------------------------------------ helpers

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(
    freq: number,
    t: number,
    opts: { type?: Wave; peak?: number; attack?: number; decay?: number; to?: number; bus?: AudioNode; detune?: number }
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.detune) osc.detune.value = opts.detune;
    const attack = opts.attack ?? 0.008;
    const decay = opts.decay ?? 0.3;
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + attack + decay);
    this.env(g, t, opts.peak ?? 0.2, attack, decay);
    osc.connect(g).connect(opts.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private noiseBurst(
    t: number,
    opts: { filter?: BiquadFilterType; freq?: number; to?: number; q?: number; peak?: number; attack?: number; decay?: number; bus?: AudioNode }
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? "lowpass";
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    f.Q.value = opts.q ?? 0.8;
    const attack = opts.attack ?? 0.01;
    const decay = opts.decay ?? 0.2;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, opts.peak ?? 0.2, attack, decay);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfxBus);
    src.start(t, Math.random() * 2, attack + decay + 0.1);
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime + 0.01 : 0;
  }

  private ready(): boolean {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  // --------------------------------------------------------------- one-shots

  play(name: SfxName) {
    if (!this.ready()) return;
    const t = this.now;
    switch (name) {
      case "step": {
        if (this.listening) return;
        const k = 0.85 + Math.random() * 0.3;
        this.noiseBurst(t, { filter: "bandpass", freq: 1100 * k, q: 0.7, peak: 0.035, attack: 0.012, decay: 0.09 });
        break;
      }
      case "wood":
        this.tone(150, t, { to: 110, peak: 0.28, decay: 0.12, type: "triangle" });
        this.noiseBurst(t, { filter: "bandpass", freq: 700, q: 2, peak: 0.12, decay: 0.08 });
        this.tone(midi(84), t + 0.1, { peak: 0.07, decay: 0.25 });
        break;
      case "stone":
        this.noiseBurst(t, { filter: "bandpass", freq: 2600, q: 4, peak: 0.2, decay: 0.05 });
        this.noiseBurst(t + 0.09, { filter: "bandpass", freq: 2200, q: 4, peak: 0.12, decay: 0.05 });
        this.tone(midi(86), t + 0.12, { peak: 0.07, decay: 0.25 });
        break;
      case "coconut":
        this.tone(330, t, { to: 220, peak: 0.25, decay: 0.12, type: "triangle" });
        this.tone(660, t, { to: 440, peak: 0.06, decay: 0.08 });
        this.tone(midi(88), t + 0.1, { peak: 0.07, decay: 0.25 });
        break;
      case "rope":
        this.noiseBurst(t, { filter: "bandpass", freq: 1500, to: 600, q: 1.5, peak: 0.12, attack: 0.04, decay: 0.25 });
        break;
      case "chop":
        this.tone(115, t, { to: 72, peak: 0.38, attack: 0.003, decay: 0.16, type: "triangle" });
        this.noiseBurst(t, { filter: "bandpass", freq: 850, to: 260, q: 1.8, peak: 0.24, attack: 0.003, decay: 0.13 });
        this.noiseBurst(t + 0.08, { filter: "highpass", freq: 2100, q: 0.8, peak: 0.08, attack: 0.002, decay: 0.12 });
        break;
      case "leaves":
        for (let i = 0; i < 4; i++) {
          this.noiseBurst(t + i * 0.055, {
            filter: "bandpass",
            freq: 1800 + Math.random() * 1200,
            to: 900,
            q: 0.7,
            peak: 0.075,
            attack: 0.015,
            decay: 0.11
          });
        }
        break;
      case "build":
        for (let i = 0; i < 3; i++) {
          const tt = t + i * 0.2;
          this.tone(205, tt, { to: 135, peak: 0.28, attack: 0.002, decay: 0.08, type: "triangle" });
          this.noiseBurst(tt, { filter: "bandpass", freq: 1450, q: 3, peak: 0.13, attack: 0.002, decay: 0.06 });
        }
        this.tone(midi(79), t + 0.63, { peak: 0.07, decay: 0.4, type: "triangle" });
        break;
      case "bridge":
        // Low plank knocks alternate with the brighter tap of the hammer.
        for (let i = 0; i < 4; i++) {
          const tt = t + i * 0.17;
          this.tone(120 + i * 12, tt, { to: 75, peak: 0.24, attack: 0.003, decay: 0.12, type: "triangle" });
          this.noiseBurst(tt + 0.045, { filter: "bandpass", freq: 1800, q: 3, peak: 0.12, attack: 0.002, decay: 0.055 });
        }
        break;
      case "fill":
        this.noiseBurst(t, { filter: "bandpass", freq: 1100, to: 450, q: 0.6, peak: 0.19, attack: 0.045, decay: 0.42 });
        for (let i = 0; i < 5; i++) {
          this.tone(350 + i * 65, t + i * 0.07, { to: 240 + i * 40, peak: 0.055, decay: 0.09 });
        }
        break;
      case "gulp":
        for (let i = 0; i < 3; i++) {
          this.tone(280, t + i * 0.16, { to: 125, peak: 0.14, attack: 0.025, decay: 0.1 });
          this.noiseBurst(t + i * 0.16, { filter: "bandpass", freq: 500, q: 2, peak: 0.045, decay: 0.08 });
        }
        break;
      case "cast":
        this.noiseBurst(t, { filter: "bandpass", freq: 400, to: 2800, q: 0.7, peak: 0.13, attack: 0.08, decay: 0.18 });
        break;
      case "plop":
        this.tone(580, t, { to: 150, peak: 0.18, attack: 0.004, decay: 0.16 });
        this.noiseBurst(t, { filter: "bandpass", freq: 1300, to: 450, q: 0.8, peak: 0.11, decay: 0.16 });
        break;
      case "fishSplash":
        this.noiseBurst(t, { filter: "bandpass", freq: 2200, to: 500, q: 0.6, peak: 0.21, attack: 0.015, decay: 0.35 });
        [460, 620, 780].forEach((freq, i) => {
          this.tone(freq, t + i * 0.055, { to: freq * 0.45, peak: 0.065, decay: 0.12 });
        });
        break;
      case "sizzle":
        for (let i = 0; i < 8; i++) {
          this.noiseBurst(t + i * 0.09, { filter: "highpass", freq: 2200 + Math.random() * 1700, peak: 0.065, attack: 0.002, decay: 0.12 });
        }
        break;
      case "sleep":
        // A breathy yawn followed by a tiny, soft lullaby cadence.
        this.noiseBurst(t, { filter: "bandpass", freq: 700, to: 380, q: 1.2, peak: 0.055, attack: 0.18, decay: 0.75 });
        this.tone(midi(69), t + 0.18, { to: midi(62), peak: 0.045, attack: 0.1, decay: 0.75, type: "sine" });
        [65, 69, 72, 69].forEach((m, i) => {
          this.tone(midi(m), t + 0.95 + i * 0.24, { peak: 0.045, attack: 0.04, decay: 0.65, type: "triangle" });
        });
        break;
      case "morning": {
        // A compact flock call for the wake-up transition.
        const notes = [91, 95, 93, 98, 96];
        notes.forEach((m, i) => {
          const tt = t + i * 0.105;
          this.tone(midi(m), tt, { to: midi(m + 3), peak: 0.035, attack: 0.008, decay: 0.09, type: "sine" });
        });
        break;
      }
      case "munch":
        for (let i = 0; i < 4; i++) this.noiseBurst(t + i * 0.14, { filter: "bandpass", freq: 2100, q: 1.5, peak: 0.14, decay: 0.05 });
        this.tone(midi(79), t + 0.6, { peak: 0.08, decay: 0.3 });
        break;
      case "craft":
        for (let i = 0; i < 3; i++) {
          this.tone(170, t + i * 0.18, { peak: 0.22, decay: 0.06, type: "triangle" });
          this.noiseBurst(t + i * 0.18, { filter: "bandpass", freq: 1200, q: 2, peak: 0.1, decay: 0.05 });
        }
        [72, 76, 79, 84].forEach((m, i) => this.tone(midi(m), t + 0.6 + i * 0.07, { peak: 0.1, decay: 0.5, type: "triangle" }));
        break;
      case "place":
        this.tone(95, t, { to: 55, peak: 0.4, decay: 0.25 });
        this.noiseBurst(t, { filter: "lowpass", freq: 600, to: 150, peak: 0.25, decay: 0.25 });
        break;
      case "ignite":
        this.noiseBurst(t, { filter: "bandpass", freq: 300, to: 2400, q: 0.9, peak: 0.3, attack: 0.25, decay: 0.6 });
        this.noiseBurst(t + 0.2, { filter: "lowpass", freq: 900, peak: 0.18, attack: 0.1, decay: 0.8 });
        break;
      case "box":
        this.tone(200, t, { peak: 0.2, decay: 0.08, type: "triangle" });
        this.noiseBurst(t, { filter: "bandpass", freq: 900, q: 2, peak: 0.15, decay: 0.12 });
        [79, 83, 86].forEach((m, i) => this.tone(midi(m), t + 0.15 + i * 0.08, { peak: 0.08, decay: 0.4 }));
        break;
      case "correct":
        this.tone(midi(79), t, { peak: 0.14, decay: 0.3, type: "triangle" });
        this.tone(midi(84), t + 0.11, { peak: 0.14, decay: 0.5, type: "triangle" });
        break;
      case "error":
        this.tone(midi(64), t, { peak: 0.07, decay: 0.16, type: "triangle" });
        this.tone(midi(60), t + 0.17, { peak: 0.07, decay: 0.24, type: "triangle" });
        break;
      case "tick":
        this.tone(1250, t, { peak: 0.05, decay: 0.03 });
        break;
      case "micOn":
        this.tone(880, t, { to: 1320, peak: 0.09, decay: 0.08 });
        break;
      case "micOff":
        this.tone(1100, t, { to: 700, peak: 0.06, decay: 0.08 });
        break;
      case "sparkle":
        [84, 88, 91, 96].forEach((m, i) => this.tone(midi(m), t + i * 0.06, { peak: 0.05, attack: 0.02, decay: 0.6 }));
        break;
      case "ping":
        this.tone(midi(91), t, { peak: 0.07, decay: 0.7 });
        this.tone(midi(96), t + 0.12, { peak: 0.05, decay: 0.8 });
        break;
      case "unlock":
        [76, 79, 83, 88].forEach((m, i) => this.tone(midi(m), t + i * 0.09, { peak: 0.1, decay: 0.45, type: "triangle" }));
        break;
      case "fanfare":
        [72, 76, 79].forEach((m, i) => this.tone(midi(m), t + i * 0.14, { peak: 0.16, decay: 0.22, type: "triangle" }));
        this.tone(midi(84), t + 0.42, { peak: 0.18, attack: 0.02, decay: 1.4, type: "triangle" });
        this.tone(midi(76), t + 0.42, { peak: 0.08, attack: 0.02, decay: 1.4 });
        this.tone(midi(79), t + 0.42, { peak: 0.08, attack: 0.02, decay: 1.4 });
        for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 2400, t + 0.5 + i * 0.08, { peak: 0.025, decay: 0.3 });
        break;
      case "full":
        this.tone(midi(67), t, { peak: 0.08, decay: 0.12, type: "triangle" });
        this.tone(midi(67), t + 0.14, { peak: 0.06, decay: 0.12, type: "triangle" });
        break;
      case "faint":
        this.tone(midi(67), t, { to: midi(55), peak: 0.12, attack: 0.05, decay: 1.2, type: "triangle" });
        break;
      case "rotate":
        this.noiseBurst(t, { filter: "bandpass", freq: 1800, q: 3, peak: 0.07, decay: 0.05 });
        break;
    }
  }

  // ------------------------------------------------------------- ambience

  /** Surf: two noise layers, the swell rising and falling every ~7 s. */
  startAmbience() {
    if (!this.ctx || this.ocean) return;
    const ctx = this.ctx;
    const mk = (type: BiquadFilterType, freq: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      src.connect(f).connect(g);
      src.start(0, Math.random() * 2);
      return { g, f };
    };
    const low = mk("lowpass", 420, 0.6);
    const hiss = mk("bandpass", 2400, 0.5);
    const near = ctx.createGain();
    near.gain.value = 0.6;
    const swell = ctx.createGain();
    swell.gain.value = 0.5;
    low.g.connect(swell);
    hiss.g.gain.value = 0.25;
    hiss.g.connect(swell);
    low.g.gain.value = 0.9;
    swell.connect(near).connect(this.ambBus);
    // Swell LFO.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const depth = ctx.createGain();
    depth.gain.value = 0.32;
    lfo.connect(depth).connect(swell.gain);
    lfo.start();
    // Wind: very soft, slowly moving band.
    const wind = mk("bandpass", 600, 1.4);
    wind.g.gain.value = 0.06;
    wind.g.connect(this.ambBus);
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.05;
    const wdepth = ctx.createGain();
    wdepth.gain.value = 260;
    wlfo.connect(wdepth).connect(wind.f.frequency);
    wlfo.start();
    this.ocean = { near, swell };
    window.setInterval(() => this.critters(), 900);
  }

  /** Louder surf near the water (0 = far inland, 1 = at the waterline). */
  setSeaNearness(k: number) {
    if (!this.ctx || !this.ocean) return;
    this.seaNearness = Math.max(0, Math.min(1, k));
    this.updateOceanLevel();
  }

  setDaylight(d: number) {
    this.daylight = Math.max(0, Math.min(1, d));
    this.updateOceanLevel();
  }

  /** Night keeps the surf present, but softer under the crickets. */
  private updateOceanLevel() {
    if (!this.ctx || !this.ocean) return;
    const proximity = 0.35 + 0.65 * this.seaNearness;
    const nightSoftness = 0.55 + 0.45 * this.daylight;
    this.ocean.near.gain.setTargetAtTime(proximity * nightSoftness, this.ctx.currentTime, 0.5);
  }

  /** Birds by day, crickets at dusk. Randomised, sparse, never while listening. */
  private critters() {
    if (!this.ready() || this.listening) return;
    const t = this.now;
    if (this.daylight > 0.45) {
      if (Math.random() < 0.18) {
        const base = 2200 + Math.random() * 1400;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const tt = t + i * (0.11 + Math.random() * 0.06);
          this.tone(base * (1 + Math.random() * 0.15), tt, { to: base * 1.35, peak: 0.022, attack: 0.01, decay: 0.07, bus: this.ambBus });
        }
      }
    } else if (Math.random() < 0.55) {
      for (let i = 0; i < 6; i++) {
        this.tone(4300 + Math.random() * 150, t + i * 0.055, { peak: 0.012, attack: 0.004, decay: 0.03, bus: this.ambBus, type: "triangle" });
      }
    }
  }

  /** Campfire crackle, scaled by closeness (0..1). */
  setFire(level: number) {
    if (!this.ctx) return;
    this.fireLevel = level;
    if (level > 0.02 && !this.fire) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 380;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.ambBus);
      src.start();
      this.fire = g;
      const crackle = () => {
        if (!this.fire) return;
        if (this.ready() && !this.listening && this.fireLevel > 0.02) {
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            this.noiseBurst(this.now + Math.random() * 0.12, {
              filter: "highpass",
              freq: 1800 + Math.random() * 2500,
              peak: 0.05 * this.fireLevel,
              attack: 0.001,
              decay: 0.02 + Math.random() * 0.03,
              bus: this.ambBus
            });
          }
        }
        this.fireTimer = window.setTimeout(crackle, 70 + Math.random() * 180);
      };
      crackle();
    }
    if (this.fire) this.fire.gain.setTargetAtTime(0.25 * level, this.ctx.currentTime, 0.3);
  }

  stopFire() {
    window.clearTimeout(this.fireTimer);
    if (this.fire && this.ctx) this.fire.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    this.fire = null;
  }

  // ------------------------------------------------------------------ music

  /** Quiet marimba tune. Dusk is slower; night is sparse and softer still. */
  startMusic(mood: "day" | "dusk" | "night") {
    if (!this.ctx) return;
    if (this.music) {
      this.music.mood = mood;
      return;
    }
    this.music = { next: this.ctx.currentTime + 0.3, step: 0, mood };
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  stopMusic() {
    window.clearInterval(this.musicTimer);
    this.music = null;
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    const m = this.music;
    if (!ctx || !m) return;
    const eighth = m.mood === "day" ? 60 / 100 / 2 : m.mood === "dusk" ? 60 / 80 / 2 : 60 / 68 / 2;
    while (m.next < ctx.currentTime + 0.3) {
      this.playStep(m.step, m.next, eighth, m.mood);
      m.step++;
      m.next += eighth;
    }
  }

  private playStep(step: number, t: number, eighth: number, mood: "day" | "dusk" | "night") {
    // 8 bars of 8 eighths. Melody: [step-in-bar, midi]; 0 = rest.
    const MELODY: Array<Array<[number, number]>> = [
      [[0, 72], [2, 74], [3, 77], [6, 74]],
      [[0, 72], [4, 69]],
      [[0, 67], [2, 69], [3, 72], [6, 74]],
      [[0, 72]],
      [[0, 77], [2, 79], [3, 81], [6, 79]],
      [[0, 77], [3, 74], [6, 72]],
      [[0, 74], [2, 72], [4, 69], [6, 67]],
      [[0, 65]]
    ];
    const BASS = [53, 50, 48, 53, 46, 50, 48, 53];
    const bar = Math.floor(step / 8) % 8;
    const s = step % 8;
    const bus = this.musicBus;
    const soft = mood === "night" ? 0.34 : mood === "dusk" ? 0.7 : 1;
    for (const [at, note] of MELODY[bar]) {
      if (at !== s) continue;
      if (mood === "night" && bar % 2 === 1) continue;
      const f = midi(note);
      // Marimba: sine + a quick high partial.
      this.tone(f, t, { peak: 0.13 * soft, attack: 0.004, decay: 0.55, bus });
      this.tone(f * 4, t, { peak: 0.02 * soft, attack: 0.002, decay: 0.08, bus });
    }
    if (s === 0 || (s === 4 && mood !== "night")) {
      this.tone(midi(BASS[bar] - 12), t, { peak: 0.12 * soft, attack: 0.01, decay: eighth * 3.5, bus, type: "triangle" });
    }
    if (mood !== "night" && (s === 2 || s === 6)) {
      for (const n of [BASS[bar] + 7, BASS[bar] + 12]) this.tone(midi(n), t, { peak: 0.025 * soft, attack: 0.01, decay: 0.25, bus });
    }
  }
}

export const audio = new AudioEngine();
