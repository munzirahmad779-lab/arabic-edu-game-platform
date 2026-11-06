/**
 * Web Audio synthesised SFX — zero audio assets, instant feedback.
 * A single AudioContext is created lazily on the first user gesture.
 */

export type SfxName =
  | "correct"
  | "wrong"
  | "laser"
  | "pop"
  | "bonk"
  | "gameover"
  | "victory"
  | "click"
  | "swish"
  | "clank"
  | "tick";

const STORAGE_KEY = "magguru_game_sfx";

interface Voice {
  freq: number;
  freqEnd?: number;
  type: OscillatorType;
  dur: number;
  gain: number;
  delay?: number;
}

/** Small, hand-tuned synth recipes for each effect. */
const RECIPES: Record<SfxName, readonly Voice[]> = {
  // Resonant golden coin chime
  correct: [
    { freq: 880, freqEnd: 884, type: "sine", dur: 0.16, gain: 0.24 },
    { freq: 1318.5, type: "triangle", dur: 0.3, gain: 0.16, delay: 0.07 },
    { freq: 1760, type: "sine", dur: 0.34, gain: 0.09, delay: 0.12 },
  ],
  // Bass thud buzzer
  wrong: [
    { freq: 140, freqEnd: 62, type: "sawtooth", dur: 0.3, gain: 0.26 },
    { freq: 98, freqEnd: 55, type: "square", dur: 0.22, gain: 0.14, delay: 0.02 },
  ],
  laser: [{ freq: 920, freqEnd: 180, type: "sawtooth", dur: 0.2, gain: 0.18 }],
  pop: [{ freq: 420, freqEnd: 860, type: "sine", dur: 0.09, gain: 0.22 }],
  bonk: [{ freq: 200, freqEnd: 92, type: "square", dur: 0.16, gain: 0.2 }],
  gameover: [
    { freq: 392, type: "triangle", dur: 0.22, gain: 0.2 },
    { freq: 311, type: "triangle", dur: 0.22, gain: 0.2, delay: 0.2 },
    { freq: 233, freqEnd: 155, type: "triangle", dur: 0.5, gain: 0.22, delay: 0.4 },
  ],
  victory: [
    { freq: 523.25, type: "triangle", dur: 0.14, gain: 0.2 },
    { freq: 659.25, type: "triangle", dur: 0.14, gain: 0.2, delay: 0.12 },
    { freq: 783.99, type: "triangle", dur: 0.16, gain: 0.2, delay: 0.24 },
    { freq: 1046.5, type: "sine", dur: 0.42, gain: 0.22, delay: 0.36 },
  ],
  click: [{ freq: 1200, freqEnd: 900, type: "sine", dur: 0.045, gain: 0.12 }],
  swish: [
    { freq: 640, freqEnd: 1400, type: "sine", dur: 0.13, gain: 0.14 },
    { freq: 1600, freqEnd: 2100, type: "triangle", dur: 0.1, gain: 0.08, delay: 0.06 },
  ],
  clank: [
    { freq: 2200, freqEnd: 1700, type: "square", dur: 0.06, gain: 0.16 },
    { freq: 320, freqEnd: 210, type: "square", dur: 0.18, gain: 0.18, delay: 0.03 },
  ],
  tick: [{ freq: 1000, freqEnd: 980, type: "sine", dur: 0.03, gain: 0.06 }],
};

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastPlay = new Map<SfxName, number>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
      } catch {
        this.enabled = true;
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // ignore
      }
    }
    if (next) this.resume();
  }

  /** Must be called from a user gesture at least once (browser autoplay policy). */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return null;
      }
    }
    return this.ctx;
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state === "suspended") {
      if (ctx && ctx.state === "suspended") void ctx.resume();
      return;
    }
    // Throttle identical sounds to avoid clutter (>= 30 ms apart).
    const now = ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlay.set(name, now);

    for (const v of RECIPES[name]) {
      const start = now + (v.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, v.freqEnd), start + v.dur);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(v.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + v.dur + 0.02);
    }
  }
}

export const sfx = new SfxEngine();
