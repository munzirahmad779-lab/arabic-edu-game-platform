/**
 * Musik latar orisinal yang DISINTESIS langsung di peramban (Web Audio).
 * Melodi, bas, dan drum di bawah ini digubah khusus untuk Magguru Game —
 * bukan rekaman, bukan sampel, bukan lagu yang sudah ada — jadi bebas
 * hak cipta dan tanpa berkas audio sama sekali.
 *
 * Dua tema berciri khas Magguru (Log 54): tangga nada hijaz + motif
 * pembuka yang sama di kedua game, sesuai identitas web Magguru sebagai
 * platform Bahasa Arab. "basket" = groove darbuka untuk AI Basketball;
 * "tug" = pola genderang pesta untuk Adu Tarik / Sigetteng-Getteng.
 * Pola ditulis per birama 16 langkah, "-" = diam.
 */

import { sfx } from "./sfx";

export type MusicTheme = "basket" | "tug" | "fruit" | "space";

/* ---------- notasi ringkas ---------- */

const SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function noteToMidi(token: string): number {
  const m = token.match(/^([A-G](?:#|b)?)(\d)$/);
  if (!m) return 60;
  return (parseInt(m[2], 10) + 1) * 12 + (SEMITONE[m[1]] ?? 0);
}

/** "E5 - - G5" -> [midi|null, ...] satu birama (16 langkah). */
function bar(pattern: string): (number | null)[] {
  return pattern
    .trim()
    .split(/\s+/)
    .map((t) => (t === "-" ? null : noteToMidi(t)));
}

function bars(...patterns: string[]): (number | null)[] {
  return patterns.flatMap((p) => bar(p));
}

/** "x---x---" -> boolean[16] satu birama drum. */
function drumBar(pattern: string): boolean[] {
  return pattern.split("").map((c) => c === "x");
}

function drumBars(...patterns: string[]): boolean[] {
  return patterns.flatMap((p) => drumBar(p));
}

/** Tabuh akor lembut di langkah tertentu tiap birama. */
function padFrom(
  chords: (readonly number[])[],
  stepsInBar: readonly number[],
): (readonly number[] | null)[] {
  const out: (readonly number[] | null)[] = [];
  for (const chord of chords) {
    const satuBar: (readonly number[] | null)[] = Array.from({ length: 16 }, () => null);
    for (const s of stepsInBar) satuBar[s] = chord;
    out.push(...satuBar);
  }
  return out;
}

/* ---------- lagu ---------- */

interface Song {
  bpm: number;
  lead: (number | null)[];
  bass: (number | null)[];
  pad: (readonly number[] | null)[];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  openHat: boolean[];
  leadGain: number;
  bassGain: number;
  padGain: number;
  snareGain: number;
  hatGain: number;
}

const A = [69, 73, 76] as const;
const Dm = [62, 65, 69] as const;
const Gm = [67, 70, 74] as const;
const Bb = [70, 74, 77] as const;

const SONGS: Record<MusicTheme, Song> = {
  // CIRI KHAS MAGGURU (Log 54): tangga nada HIJAZ di D (D–Eb–F#–G–A–Bb–C),
  // warna Bahasa Arab sesuai identitas web Magguru ("Bahasa Arab &
  // Kurikulum", slogan Belajar • Bermain • Berkembang). Kedua tema
  // membuka dengan MOTIF yang sama (D5 – Eb5 – F#5 – G5) sebagai
  // tanda pengenal suara Magguru; perkusi basket meniru pola darbuka
  // (dum = kick, tak = snare, ka = hat), tema tug memakai pola
  // genderang pesta (dum di langkah 0/6/8/14).
  basket: {
    bpm: 112,
    lead: bars(
      "D5 - - - Eb5 - F#5 - G5 - - - A5 - - -",
      "Bb5 - A5 - G5 - F#5 - Eb5 - F#5 - D5 - - -",
      "G5 - - - A5 - Bb5 - A5 - G5 - F#5 - - -",
      "A5 - - - C#6 - B5 - A5 - G5 - F#5 - Eb5 -",
      "D5 - - - Eb5 - F#5 - G5 - A5 - Bb5 - - -",
      "Bb5 - - - A5 - G5 - F#5 - G5 - A5 - - -",
      "G5 - Bb5 - A5 - G5 - F#5 - Eb5 - F#5 - - -",
      "F#5 - - - Eb5 - - - D5 - - - - - - -",
    ),
    bass: bars(
      "D2 - - D2 - - D3 - D2 - - D2 - - - -",
      "D2 - - D2 - - D3 - D2 - - D2 - - - -",
      "G2 - - G2 - - G3 - G2 - - G2 - - - -",
      "A2 - - A2 - - A3 - A2 - - A2 - - - -",
      "D2 - - D2 - - D3 - D2 - - D2 - - - -",
      "Bb2 - - Bb2 - - Bb3 - Bb2 - - Bb2 - - - -",
      "G2 - - G2 - - G3 - G2 - - G2 - - - -",
      "A2 - - A2 - - A3 - A2 - - A2 - - - -",
    ),
    pad: padFrom([Dm, Dm, Gm, A, Dm, Bb, Gm, A], [6, 14]),
    kick: drumBars(
      "x-------x-------", "x-------x-------", "x-------x-------", "x-------x-------",
      "x-------x-------", "x-------x-------", "x-------x-------", "x-------x-------",
    ),
    snare: drumBars(
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
    ),
    hat: drumBars(
      "--x---x---x---x-", "--x---x---x---x-", "--x---x---x---x-", "--x---x---x---x-",
      "--x---x---x---x-", "--x---x---x---x-", "--x---x---x---x-", "--x---x---x---x-",
    ),
    openHat: drumBars(
      "----------------", "----------------", "----------------", "----------------",
      "----------------", "----------------", "----------------", "----------------",
    ),
    leadGain: 0.13,
    bassGain: 0.2,
    padGain: 0.04,
    snareGain: 0.2,
    hatGain: 0.05,
  },
  tug: {
    bpm: 100,
    lead: bars(
      "D5 - - - Eb5 - F#5 - G5 - - - A5 - - -",
      "G5 - - - F#5 - Eb5 - D5 - - - - - - -",
      "F#5 - G5 - A5 - - - Bb5 - A5 - G5 - - -",
      "A5 - - - G5 - F#5 - Eb5 - D5 - - - - -",
      "D5 - - - Eb5 - F#5 - G5 - - - A5 - - -",
      "Bb5 - A5 - G5 - - - A5 - G5 - F#5 - - -",
      "F#5 - - - G5 - - - A5 - - - Bb5 - - -",
      "A5 - G5 - F#5 - Eb5 - D5 - - - - - - -",
    ),
    bass: bars(
      "D2 - - - - - D2 - D2 - - - - - D2 -",
      "G2 - - - - - G2 - G2 - - - - - G2 -",
      "D2 - - - - - D2 - D2 - - - - - D2 -",
      "A2 - - - - - A2 - A2 - - - - - A2 -",
      "D2 - - - - - D2 - D2 - - - - - D2 -",
      "G2 - - - - - G2 - G2 - - - - - G2 -",
      "D2 - - - - - D2 - D2 - - - - - D2 -",
      "A2 - - - - - A2 - A2 - - - - - A2 -",
    ),
    pad: padFrom([Dm, Gm, Dm, A, Dm, Gm, Dm, A], [0]),
    kick: drumBars(
      "x-----x-x-----x-", "x-----x-x-----x-", "x-----x-x-----x-", "x-----x-x-----x-",
      "x-----x-x-----x-", "x-----x-x-----x-", "x-----x-x-----x-", "x-----x-x-----x-",
    ),
    snare: drumBars(
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
    ),
    hat: drumBars(
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
    ),
    openHat: drumBars(
      "----------------", "----------------", "----------------", "----------------",
      "----------------", "----------------", "----------------", "----------------",
    ),
    leadGain: 0.12,
    bassGain: 0.17,
    padGain: 0.04,
    snareGain: 0.14,
    hatGain: 0.04,
  },
  // Tema kebun untuk Banua Fruit Blast (Log 57): Hijaz di D yang sama,
  // motif pembuka yang sama (D5 - Eb5 - F#5 - G5 di birama 1 dan 5),
  // tempo lebih ceria 116 BPM, melodi lebih lincah meniru buah yang
  // memantul, perkusi ringan pola dum-tak selang-seling.
  fruit: {
    bpm: 116,
    lead: bars(
      "D5 - - - Eb5 - F#5 - G5 - - - A5 - - -",
      "Bb5 - A5 - G5 - A5 - F#5 - - - Eb5 - - -",
      "G5 - A5 - Bb5 - A5 - G5 - F#5 - G5 - - -",
      "A5 - - - G5 - F#5 - Eb5 - D5 - - - - -",
      "D5 - - - Eb5 - F#5 - G5 - - - Bb5 - - -",
      "A5 - Bb5 - A5 - G5 - F#5 - G5 - A5 - - -",
      "Bb5 - - - A5 - - - G5 - F#5 - Eb5 - - -",
      "F#5 - Eb5 - D5 - - - - - - - - - - -",
    ),
    bass: bars(
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "G2 - G3 - G2 - - - G2 - G3 - G2 - - -",
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "A2 - A3 - A2 - - - A2 - A3 - A2 - - -",
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "Bb2 - Bb3 - Bb2 - - - Bb2 - Bb3 - Bb2 - - -",
      "G2 - G3 - G2 - - - G2 - G3 - G2 - - -",
      "A2 - A3 - A2 - - - A2 - A3 - A2 - - -",
    ),
    pad: padFrom([Dm, Gm, Dm, A, Dm, Bb, Gm, A], [4, 12]),
    kick: drumBars(
      "x-------x-x-----", "x-------x-x-----", "x-------x-x-----", "x-------x-x-----",
      "x-------x-x-----", "x-------x-x-----", "x-------x-x-----", "x-------x-x-----",
    ),
    snare: drumBars(
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
    ),
    hat: drumBars(
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
    ),
    openHat: drumBars(
      "----------------", "----------------", "----------------", "----------------",
      "----------------", "----------------", "----------------", "--------------x-",
    ),
    leadGain: 0.13,
    bassGain: 0.18,
    padGain: 0.04,
    snareGain: 0.16,
    hatGain: 0.045,
  },
  // Tema antariksa untuk Perang Antariksa (Log 60): Hijaz di D yang sama,
  // motif pembuka yang sama (D5 - Eb5 - F#5 - G5 di birama 1 dan 5),
  // tempo 126 BPM nuansa petualangan, perkusi lebih lapang.
  space: {
    bpm: 126,
    lead: bars(
      "D5 - - - Eb5 - F#5 - G5 - - - A5 - - -",
      "Bb5 - A5 - G5 - - - A5 - - - G5 - F#5 -",
      "G5 - - - A5 - Bb5 - A5 - G5 - F#5 - G5 -",
      "A5 - - - - - - - F#5 - Eb5 - D5 - - -",
      "D5 - - - Eb5 - F#5 - G5 - - - Bb5 - - -",
      "A5 - G5 - A5 - Bb5 - A5 - - - G5 - - -",
      "F#5 - G5 - A5 - - - Bb5 - A5 - G5 - F#5 -",
      "Eb5 - F#5 - D5 - - - - - - - - - - -",
    ),
    bass: bars(
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "G2 - G3 - G2 - - - G2 - G3 - G2 - - -",
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "A2 - A3 - A2 - - - A2 - A3 - A2 - - -",
      "D2 - D3 - D2 - - - D2 - D3 - D2 - - -",
      "Bb2 - Bb3 - Bb2 - - - Bb2 - Bb3 - Bb2 - - -",
      "G2 - G3 - G2 - - - G2 - G3 - G2 - - -",
      "A2 - A3 - A2 - - - A2 - A3 - A2 - - -",
    ),
    pad: padFrom([Dm, Gm, Dm, A, Dm, Bb, Gm, A], [0, 8]),
    kick: drumBars(
      "x------x--------", "x------x--------", "x------x--------", "x------x--------",
      "x------x--------", "x------x--------", "x------x--------", "x------x---x----",
    ),
    snare: drumBars(
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
      "----x-------x---", "----x-------x---", "----x-------x---", "----x-------x---",
    ),
    hat: drumBars(
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
      "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-", "x-x-x-x-x-x-x-x-",
    ),
    openHat: drumBars(
      "----------------", "----------------", "----------------", "----------------",
      "----------------", "----------------", "----------------", "--------------x-",
    ),
    leadGain: 0.12,
    bassGain: 0.16,
    padGain: 0.045,
    snareGain: 0.13,
    hatGain: 0.04,
  },
};

/* ---------- mesin putar ---------- */

const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

class MusicEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private theme: MusicTheme | null = null;
  private step = 0;
  private nextTime = 0;

  /** Mulai memutar tema. Wajib dipanggil sesudah gestur pengguna
   *  (klik tombol) agar AudioContext boleh berbunyi. Menghormati
   *  saklar suara global yang sama dengan sfx. */
  play(theme: MusicTheme): void {
    if (typeof window === "undefined") return;
    if (!sfx.isEnabled()) return;
    if (this.theme === theme && this.timer !== null) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    this.stopInternal();
    this.theme = theme;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), 90);
    document.documentElement.dataset.music = theme;
  }

  stop(): void {
    this.stopInternal();
    this.theme = null;
    if (typeof document !== "undefined") delete document.documentElement.dataset.music;
  }

  isPlaying(): MusicTheme | null {
    return this.timer !== null ? this.theme : null;
  }

  private stopInternal(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const w = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor: typeof AudioContext | undefined = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
        this.bus = this.ctx.createGain();
        this.bus.gain.value = 0.85;
        this.bus.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
        return null;
      }
    }
    return this.ctx;
  }

  private tick(): void {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
      return;
    }
    const song = SONGS[theme];
    const stepDur = 60 / song.bpm / 4;
    const total = song.lead.length;
    while (this.nextTime < ctx.currentTime + 0.22) {
      this.scheduleStep(song, this.step % total, this.nextTime);
      this.step += 1;
      this.nextTime += stepDur;
    }
  }

  private scheduleStep(song: Song, idx: number, t: number): void {
    const lead = song.lead[idx];
    if (lead !== null) {
      this.tone(mtof(lead), t, 0.26, "triangle", song.leadGain);
      this.tone(mtof(lead + 12), t, 0.18, "sine", song.leadGain * 0.45);
    }
    const bass = song.bass[idx];
    if (bass !== null) this.tone(mtof(bass), t, 0.24, "sine", song.bassGain);
    const pad = song.pad[idx];
    if (pad) for (const n of pad) this.tone(mtof(n), t, 0.34, "triangle", song.padGain);
    if (song.kick[idx]) this.kickDrum(t);
    if (song.snare[idx]) this.noiseHit(t, 1800, 0.13, song.snareGain);
    if (song.hat[idx]) this.noiseHit(t, 7500, 0.045, song.hatGain, true);
    if (song.openHat[idx]) this.noiseHit(t, 7500, 0.3, song.hatGain, true);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kickDrum(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(112, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private noiseHit(t: number, freq: number, dur: number, gain: number, highpass = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = highpass ? "highpass" : "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = highpass ? 0.8 : 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bus);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.02);
  }
}

export const music = new MusicEngine();
