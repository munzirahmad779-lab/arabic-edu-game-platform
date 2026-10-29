"use client";

/**
 * Banua Fruit Blast — komponen utama (client-only).
 *
 * Layar: home → mode → countdown → playing → result, plus score & bank.
 * Arena kanvas memenuhi layar: tiap lajur membawa soal di kartu atasnya
 * sendiri dan jawabannya adalah buah foto yang jatuh; potong dengan
 * geseran (gaya Fruit Ninja). Bom & emas sembunyi di dalam buah. Tanpa
 * panel soal terpisah: 2 sampai 4 lajur dalam satu layar.
 *
 * Semua tipe domain berasal dari ./logic — komponen ini tidak mendefinisikan
 * tipe domain sendiri.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LmsBankPicker } from "@/modules/game-bank/connector";
import {
  CONTENT_SUBJECTS,
  RULES,
  MODES,
  SUBJECTS,
  buildDeck,
  buildStream,
  clearScores,
  defaultBank,
  emptyDraft,
  emptyGuru,
  fmtTime,
  loadBank,
  loadGuru,
  loadScores,
  loadSettings,
  makeQuestion,
  parseBank,
  parseCsvBank,
  parseMarkdownBank,
  playersFor,
  promptTemplateSoal,
  resetBankToDefault,
  saveBank,
  saveGuru,
  saveScore,
  saveSettings,
  scoresCsv,
  shuffleArr,
  templateMarkdown,
  uid,
  winnerOf,
  type Bank,
  type ContentSubjectId,
  type DraftQ,
  type EndReason,
  type Fruit,
  type GameMode,
  type GuruBank,
  type Particle,
  type PlayerDef,
  type PlayerScore,
  type Q,
  type ScoreRec,
  type Screen,
  type Settings,
  type StreamEntry,
  type SubjectId,
} from "./logic";
import { sfx } from "../lib-pendamping/sfx";
import { music } from "../lib-pendamping/music";
import { FRAME, FRUIT_SPRITES, type FrameIndex } from "./sprites";
import {
  FX_LIFE_MS,
  POPUP_LIFE_MS,
  burst,
  drawFrame,
  ensureFruitImages,
  ensureImages,
  hudHeight,
  pillHalfWidth,
  stepPhysics,
  type LaneState,
  type Popup,
  type SliceFx,
  type TrailPt,
} from "./render";

/* --------------------------------------------------------------- runtime */

interface Lane {
  def: PlayerDef;
  deck: Q[];
  cursor: number;
  score: number;
  correct: number;
  wrong: number;
  mood: FrameIndex;
  moodUntil: number;
  /** antrean spawn buah untuk soal yang sedang berjalan */
  queue: StreamEntry[];
  /** ms tersisa sampai reshuffle label berikutnya */
  reshuffleIn: number;
  /** waktu (ms) spawn berikutnya di lajur ini */
  spawnAt: number;
  /** seluruh bank mapel lajur ini (sumber comot label impostor) */
  pool: Q[];
}

const currentQ = (lane: Lane): Q | null =>
  lane.deck.length === 0 ? null : lane.deck[lane.cursor % lane.deck.length];

const makeLanes = (mode: GameMode, list: Q[], count: number): Lane[] =>
  playersFor(mode).map((def) => ({
    def,
    deck: buildDeck(list, count),
    cursor: 0,
    score: 0,
    correct: 0,
    wrong: 0,
    mood: FRAME.ready,
    moodUntil: 0,
    queue: [],
    reshuffleIn: RULES.reshuffleMs,
    spawnAt: 0,
    pool: list,
  }));

/* ------------------------------------------------------------------ UI kecil */

function Btn({
  children,
  onClick,
  variant = "solid",
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost" | "danger" | "accent";
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className">) {
  const base =
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60";
  const styles: Record<string, string> = {
    solid: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-white/70 text-emerald-950 ring-1 ring-emerald-900/15 hover:bg-white",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    accent: "bg-lime-400 text-emerald-950 hover:bg-lime-300",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

function Header({
  title,
  onExit,
  right,
}: {
  title: string;
  onExit?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-emerald-900/10 bg-white/60 px-3 py-2 backdrop-blur">
      {onExit ? (
        <Btn variant="ghost" onClick={onExit} aria-label="Keluar dari permainan" data-exit="1">
          ← KELUAR
        </Btn>
      ) : (
        <Link
          href="/game/banua-fruit-blast"
          className="inline-flex min-h-9 items-center rounded-xl bg-white/80 px-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-900/15 hover:bg-white"
        >
          ← BERANDA
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-sm font-black uppercase tracking-wide text-emerald-950">
        {title}
      </h1>
      {right}
    </header>
  );
}

/* --------------------------------------------------------------- komponen */

export default function BanuaFruitBlastGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<Settings>(() => ({
    mode: "DUEL",
    subject: "matematika",
    questionCount: RULES.defaultQuestionCount,
    sound: true,
  }));
  const [bank, setBank] = useState<Bank>(() => defaultBank());
  const [guru, setGuru] = useState<GuruBank>(() => emptyGuru());
  const [importText, setImportText] = useState("");
  const [scores, setScores] = useState<ScoreRec[]>([]);
  const [draft, setDraft] = useState<DraftQ>(() => emptyDraft("matematika"));
  const [hydrated, setHydrated] = useState(false);

  // bermain
  const [timeLeft, setTimeLeft] = useState<number>(RULES.durationSec);
  const [countdown, setCountdown] = useState<number>(RULES.countdownSec);
  const [showExit, setShowExit] = useState(false);
  const [result, setResult] = useState<{ reason: EndReason; rows: PlayerScore[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const lanesRef = useRef<Lane[]>([]);
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const runningRef = useRef(false);
  const fruitIdRef = useRef(1);
  const fxRef = useRef<SliceFx[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const fxIdRef = useRef(1);
  const trailsRef = useRef<Map<number, TrailPt[]>>(new Map());
  const lastPtRef = useRef<Map<number, TrailPt>>(new Map());
  const shakeUntilRef = useRef(0);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  const mountedRef = useRef(true);
  /** true setelah endGame dipanggil — menjaga pencatatan skor tetap idempoten */
  const endedRef = useRef(false);
  /** salinan sisa waktu tanpa bergantung pada updater setState */
  const timeRef = useRef<number>(RULES.durationSec);
  /** salinan hitung mundur tanpa bergantung pada updater setState */
  const countRef = useRef<number>(RULES.countdownSec);

  /* ------------------------------------------------------------ bootstrap */

  useEffect(() => {
    mountedRef.current = true;
    setSettings(loadSettings());
    setBank(loadBank());
    setGuru(loadGuru());
    setScores(loadScores());
    setDraft((d) => ({ ...d, subjectId: loadSettings().subject }));
    setHydrated(true);
    ensureImages();
    ensureFruitImages();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ----------------------------------------------------------- sesi main */

  const endGame = useCallback(
    (reason: EndReason) => {
      // idempoten: StrictMode / event ganda tidak boleh mencatat skor dua kali
      if (endedRef.current) return;
      endedRef.current = true;
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const rows: PlayerScore[] = lanesRef.current.map((l) => ({
        name: l.def.name,
        sprite: l.def.sprite,
        score: l.score,
        correct: l.correct,
        wrong: l.wrong,
      }));
      if (reason === "timeup" && rows.length > 0) {
        const rec: ScoreRec = {
          id: uid(),
          timestamp: Date.now(),
          mode: settings.mode,
          subject: settings.subject,
          reason,
          winner: winnerOf(rows),
          players: rows,
        };
        setScores(saveScore(rec));
      }
      if (!mountedRef.current) return;
      setResult({ reason, rows });
      setScreen("result");
    },
    [settings.mode, settings.subject],
  );

  /** Daftar soal untuk mapel terpilih (Mapel Guru dari simpanan sendiri). */
  const questionsFor = useCallback(
    (subject: SubjectId): Q[] =>
      subject === "guru" ? guru.questions : bank[subject as ContentSubjectId] ?? [],
    [bank, guru],
  );

  /** Mulai soal lajur: susun antrean aliran buahnya (4 jawaban + impostor). */
  const beginQuestion = useCallback((lane: Lane) => {
    const q = currentQ(lane);
    lane.queue = q ? buildStream(q, lane.pool) : [];
    lane.reshuffleIn = RULES.reshuffleMs;
    lane.spawnAt = 0;
  }, []);

  const startMatch = useCallback(() => {
    const list = questionsFor(settings.subject);
    if (list.length === 0) {
      setToast(
        settings.subject === "guru"
          ? "Mapel Guru masih kosong. Isi dulu lewat Bank Soal."
          : "Bank soal mapel ini kosong.",
      );
      return;
    }
    lanesRef.current = makeLanes(settings.mode, list, settings.questionCount);
    lanesRef.current.forEach((lane) => beginQuestion(lane));
    fruitsRef.current = [];
    particlesRef.current = [];
    fxRef.current = [];
    popupsRef.current = [];
    trailsRef.current.clear();
    lastPtRef.current.clear();
    fruitIdRef.current = 1;
    fxIdRef.current = 1;
    endedRef.current = false;
    timeRef.current = RULES.durationSec;
    countRef.current = RULES.countdownSec;
    setTimeLeft(RULES.durationSec);
    setCountdown(RULES.countdownSec);
    setResult(null);
    setShowExit(false);
    setScreen("countdown");
  }, [beginQuestion, questionsFor, settings.mode, settings.subject, settings.questionCount]);

  // hitung mundur 3-2-1 → playing
  useEffect(() => {
    if (screen !== "countdown") return;
    const t = window.setInterval(() => {
      const next = countRef.current - 1;
      countRef.current = next;
      setCountdown(Math.max(0, next));
      if (next <= 0) {
        window.clearInterval(t);
        setScreen("playing");
      }
    }, 800);
    return () => window.clearInterval(t);
  }, [screen]);

  /* ----------------------------------------------------------------- musik */

  // Musik tema "fruit" (Hijaz) selama bersiap & bertanding, mengikuti
  // saklar suara yang sama dengan efek suara.
  useEffect(() => {
    if ((screen === "countdown" || screen === "playing") && settings.sound) {
      music.play("fruit");
    } else {
      music.stop();
    }
  }, [screen, settings.sound]);

  useEffect(() => () => music.stop(), []);

  /* ---------------------------------------------------------------- timer */

  useEffect(() => {
    if (screen !== "playing") return;
    const t = window.setInterval(() => {
      const next = Math.max(0, timeRef.current - 1);
      timeRef.current = next;
      setTimeLeft(next);
      // efek samping di luar updater: endGame tidak boleh dipanggil dari
      // dalam setState karena React bisa menjalankan updater dua kali
      if (next <= 0) {
        window.clearInterval(t);
        endGame("timeup");
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [screen, endGame]);

  /* ------------------------------------------------------------- kanvas */

  /**
   * Batas bawah kartu HUD (buah hanya hidup di bawah garis ini).
   * Kartu memanjang mengikuti jumlah baris soal (Log 59), jadi batas
   * diambil dari kartu tertinggi di antara semua lajur yang aktif.
   */
  const headerBottomOf = useCallback((canvasW: number): number => {
    const laneCount = Math.max(1, lanesRef.current.length);
    const laneW = canvasW / laneCount;
    let maxH = hudHeight(laneW, null);
    for (const lane of lanesRef.current) {
      const q = currentQ(lane);
      maxH = Math.max(maxH, hudHeight(laneW, q ? q.prompt : null));
    }
    return 10 + maxH + 6;
  }, []);

  /** Turunkan satu buah dari antrean aliran lajur, tepat di bawah kartu soal. */
  const spawnNext = useCallback(
    (laneIndex: number) => {
      const lane = lanesRef.current[laneIndex];
      if (!lane || lane.queue.length === 0) return;
      const { w, h } = canvasSizeRef.current;
      if (w <= 0 || h <= 0) return;
      const laneCount = Math.max(1, lanesRef.current.length);
      const laneW = w / laneCount;
      const entry = lane.queue[0];
      lane.queue = lane.queue.slice(1);

      const meta = FRUIT_SPRITES[entry.sprite];
      let fh = Math.min(RULES.fruitH, laneW * 0.66);
      let fw = fh * meta.aspect;
      const maxW = Math.max(56, laneW - 14);
      if (fw > maxW) {
        fw = maxW;
        fh = fw / meta.aspect;
      }
      const headerBottom = headerBottomOf(w);
      // jepit x agar pita jawaban (bisa 2 baris, Log 59) tidak meluber ke lajur tetangga
      const halfNeed = Math.max(fw / 2, pillHalfWidth(entry.text, laneW));
      const minX = laneIndex * laneW + halfNeed + 4;
      const maxX = laneIndex * laneW + laneW - halfNeed - 4;
      const x = minX >= maxX ? laneIndex * laneW + laneW / 2 : minX + Math.random() * (maxX - minX);
      const crossSec =
        RULES.crossSecMin + Math.random() * (RULES.crossSecMax - RULES.crossSecMin);
      const dist = h - headerBottom + fh;

      fruitsRef.current.push({
        id: fruitIdRef.current++,
        lane: laneIndex,
        text: entry.text,
        correct: entry.correct,
        kind: entry.kind,
        optionIndex: entry.optionIndex,
        hasBomb: entry.hasBomb,
        hasGold: entry.hasGold,
        sprite: entry.sprite,
        x,
        y: headerBottom + fh / 2 - 8,
        vy: dist / crossSec,
        w: fw,
        h: fh,
        wobble: Math.random() * Math.PI * 2,
        pop: 1,
        flipUntil: 0,
      });
    },
    [headerBottomOf],
  );

  /**
   * Nilai satu potongan. Benar: soal selesai dan soal berikutnya mulai
   * mengalir. Salah: poin berkurang (bom lebih besar), soal tetap berjalan.
   */
  const applySlice = useCallback(
    (fruit: Fruit) => {
      const laneIndex = fruit.lane;
      const lane = lanesRef.current[laneIndex];
      if (!lane) return;
      const now = performance.now();
      fruitsRef.current = fruitsRef.current.filter((f) => f.id !== fruit.id);

      fxRef.current = [
        ...fxRef.current.slice(-23),
        {
          id: fxIdRef.current++,
          lane: laneIndex,
          sprite: fruit.sprite,
          x: fruit.x,
          y: fruit.y,
          w: fruit.w,
          h: fruit.h,
          reveal: fruit.hasGold ? "gold" : fruit.hasBomb ? "bomb" : "none",
          dark: fruit.hasBomb,
          bornAt: now,
        },
      ];
      const popup = (text: string, color: string) => {
        popupsRef.current = [
          ...popupsRef.current.slice(-11),
          { id: fxIdRef.current++, x: fruit.x, y: fruit.y, text, color, bornAt: now },
        ];
      };

      particlesRef.current = burst(
        particlesRef.current,
        fruit.x,
        fruit.y,
        FRUIT_SPRITES[fruit.sprite].juice,
        14,
      );
      if (fruit.hasBomb) {
        particlesRef.current = burst(particlesRef.current, fruit.x, fruit.y, "#1F2937", 10);
        particlesRef.current = burst(particlesRef.current, fruit.x, fruit.y, "#F97316", 12);
        shakeUntilRef.current = now + 380;
      }
      if (fruit.hasGold) {
        particlesRef.current = burst(particlesRef.current, fruit.x, fruit.y, "#FACC15", 18);
      }

      if (settings.sound) {
        sfx.resume();
        sfx.play("swish");
      }

      if (fruit.correct) {
        const pts = fruit.hasGold ? RULES.goldPoints : RULES.correctPoints;
        lane.score += pts;
        lane.correct += 1;
        lane.mood = FRAME.happy;
        lane.moodUntil = now + 420;
        popup(`+${pts}`, fruit.hasGold ? "#FACC15" : "#4ADE80");
        if (settings.sound) sfx.play("correct");
        fruitsRef.current = fruitsRef.current.filter((f) => f.lane !== laneIndex);
        lane.cursor += 1;
        beginQuestion(lane);
      } else {
        const pen = fruit.hasBomb ? RULES.bombPenalty : RULES.wrongPenalty;
        lane.score = Math.max(RULES.minScore, lane.score - pen);
        lane.wrong += 1;
        lane.mood = fruit.hasBomb ? FRAME.shock : FRAME.miss;
        lane.moodUntil = now + 380;
        popup(`-${pen}`, "#FB7185");
        if (settings.sound) sfx.play(fruit.hasBomb ? "bonk" : "wrong");
      }
    },
    [beginQuestion, settings.sound],
  );

  /** RESHUFFLE: 4 muatan jawaban bertukar tempat di antara buah opsi yang
   *  sedang jatuh (label impostor tidak ikut), dengan animasi jungkir. */
  const doReshuffle = useCallback((laneIndex: number) => {
    const alive = fruitsRef.current.filter((f) => f.lane === laneIndex && f.kind === "option");
    if (alive.length < 2) return;
    const payloads = shuffleArr(
      alive.map((f) => ({
        text: f.text,
        optionIndex: f.optionIndex,
        correct: f.correct,
        hasBomb: f.hasBomb,
        hasGold: f.hasGold,
      })),
    );
    const now = performance.now();
    const byId = new Map(alive.map((f, i) => [f.id, payloads[i]]));
    fruitsRef.current = fruitsRef.current.map((f) => {
      const pl = byId.get(f.id);
      return pl ? { ...f, ...pl, flipUntil: now + 450 } : f;
    });
  }, []);

  // loop render + fisika
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    runningRef.current = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvasSizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.dataset.groundY = String(h);
      canvas.dataset.lanes = String(lanesRef.current.length);
      canvas.dataset.canvasW = String(w);
      canvas.dataset.canvasH = String(h);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    const loop = (ts: number) => {
      if (!runningRef.current) return;
      const last = lastTsRef.current || ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;
      const now = performance.now();

      const { w, h } = canvasSizeRef.current;

      // aliran buah per lajur + reshuffle label berkala
      lanesRef.current.forEach((lane, i) => {
        const alive = fruitsRef.current.reduce((n2, f) => n2 + (f.lane === i ? 1 : 0), 0);
        if (lane.queue.length > 0 && alive < RULES.maxFruitsPerLane && now >= lane.spawnAt) {
          spawnNext(i);
          lane.spawnAt = now + RULES.spawnEveryMs + Math.random() * 170;
        }
        lane.reshuffleIn -= dt * 1000;
        if (lane.reshuffleIn <= 0) {
          lane.reshuffleIn = RULES.reshuffleMs;
          doReshuffle(i);
        }
      });

      const stepped = stepPhysics(fruitsRef.current, particlesRef.current, dt, w, h);
      fruitsRef.current = stepped.fruits;
      particlesRef.current = stepped.particles;

      // Muatan jawaban yang lolos jatuh tanpa dipotong kembali ke antrean:
      // soal yang sama terus mengalir sampai ada siswa yang menjawab benar.
      stepped.missed.forEach((f) => {
        if (f.kind !== "option") return;
        const lane = lanesRef.current[f.lane];
        if (!lane) return;
        lane.queue = [
          ...lane.queue,
          {
            text: f.text,
            kind: f.kind,
            optionIndex: f.optionIndex,
            correct: f.correct,
            hasBomb: f.hasBomb,
            hasGold: f.hasGold,
            sprite: f.sprite,
          },
        ];
      });

      fxRef.current = fxRef.current.filter((f) => now - f.bornAt <= FX_LIFE_MS + 60);
      popupsRef.current = popupsRef.current.filter((pp) => now - pp.bornAt <= POPUP_LIFE_MS + 60);
      const trails = Array.from(trailsRef.current.values())
        .map((pts) => pts.filter((pt) => now - pt.t < 160))
        .filter((pts) => pts.length > 0);

      const arenaLanes: LaneState[] = lanesRef.current.map((l) => {
        if (l.moodUntil > 0 && performance.now() > l.moodUntil) l.mood = FRAME.ready;
        return {
          def: l.def,
          score: l.score,
          question: currentQ(l),
          mood: l.mood,
          moodUntil: l.moodUntil,
        };
      });

      drawFrame(ctx, {
        lanes: arenaLanes,
        fruits: fruitsRef.current,
        particles: particlesRef.current,
        fx: fxRef.current,
        popups: popupsRef.current,
        trails,
        shakeUntil: shakeUntilRef.current,
        now,
        width: w,
        height: h,
      });

      canvas.dataset.fruitCount = String(fruitsRef.current.length);
      const first = fruitsRef.current[0];
      canvas.dataset.fruit0X = first ? String(Math.round(first.x)) : "";
      canvas.dataset.fruit0Y = first ? String(Math.round(first.y)) : "";
      lanesRef.current.forEach((lane) => {
        canvas.dataset[`score${lane.def.slot}`] = String(lane.score);
      });
      // kait uji inert: potret buah yang sedang jatuh (untuk uji otomatis)
      canvas.dataset.fruits = JSON.stringify(
        fruitsRef.current.map((f) => ({
          id: f.id,
          lane: f.lane,
          x: Math.round(f.x),
          y: Math.round(f.y),
          w: Math.round(f.w),
          h: Math.round(f.h),
          text: f.text,
          correct: f.correct,
          kind: f.kind,
          bomb: f.hasBomb,
          gold: f.hasGold,
        })),
      );
      canvas.dataset.headerBottom = String(Math.round(headerBottomOf(w)));
      lanesRef.current.forEach((lane) => {
        canvas.dataset[`question${lane.def.slot}`] = currentQ(lane)?.prompt ?? "";
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
      ro.disconnect();
    };
  }, [screen, spawnNext, doReshuffle, headerBottomOf]);

  /* -------------------------------------------------------- interaksi arena */

  const toLocal = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  /** Ketukan langsung pada buah juga memotong (untuk anak yang mengetuk). */
  const sliceTap = useCallback(
    (x: number, y: number) => {
      const { w } = canvasSizeRef.current;
      const hb = headerBottomOf(w);
      let best: Fruit | null = null;
      for (const f of fruitsRef.current) {
        if (f.y < hb) continue;
        const dx = (x - f.x) / (f.w / 2 + 8);
        const dy = (y - f.y) / (f.h / 2 + 22);
        if (dx * dx + dy * dy <= 1 && (!best || f.y > best.y)) best = f;
      }
      if (best) applySlice(best);
    },
    [applySlice, headerBottomOf],
  );

  /** Geseran cepat yang melewati buah memotongnya (gaya Fruit Ninja). */
  const sliceSegment = useCallback(
    (x1: number, y1: number, x2: number, y2: number, speed: number) => {
      if (speed < 300) return;
      const { w } = canvasSizeRef.current;
      const hb = headerBottomOf(w);
      const hits: Fruit[] = [];
      const vx = x2 - x1;
      const vy = y2 - y1;
      const len2 = vx * vx + vy * vy || 1;
      for (const f of fruitsRef.current) {
        if (f.y < hb) continue;
        let t = ((f.x - x1) * vx + (f.y - y1) * vy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = x1 + t * vx;
        const py = y1 + t * vy;
        const d = Math.hypot(f.x - px, f.y - py);
        if (d < Math.max(f.w, f.h) * 0.38 + 8) hits.push(f);
      }
      hits.forEach((f) => {
        if (fruitsRef.current.some((g) => g.id === f.id)) applySlice(f);
      });
    },
    [applySlice, headerBottomOf],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (screen !== "playing" || !runningRef.current) return;
      const { x, y } = toLocal(e.clientX, e.clientY);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* penunjuk tidak mendukung capture, abaikan */
      }
      const pt: TrailPt = { x, y, t: performance.now() };
      trailsRef.current.set(e.pointerId, [pt]);
      lastPtRef.current.set(e.pointerId, pt);
      sliceTap(x, y);
    },
    [screen, sliceTap, toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const last = lastPtRef.current.get(e.pointerId);
      if (!last || screen !== "playing" || !runningRef.current) return;
      const { x, y } = toLocal(e.clientX, e.clientY);
      const now = performance.now();
      const dt = Math.max(1, now - last.t) / 1000;
      const dist = Math.hypot(x - last.x, y - last.y);
      const pt: TrailPt = { x, y, t: now };
      const trail = trailsRef.current.get(e.pointerId) ?? [];
      trailsRef.current.set(e.pointerId, [...trail.slice(-14), pt]);
      lastPtRef.current.set(e.pointerId, pt);
      sliceSegment(last.x, last.y, x, y, dist / dt);
    },
    [screen, sliceSegment, toLocal],
  );

  const onPointerEnd = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    trailsRef.current.delete(e.pointerId);
    lastPtRef.current.delete(e.pointerId);
  }, []);

  /* --------------------------------------------------------------- keluar */

  const requestExit = useCallback(() => setShowExit(true), []);

  const confirmExit = useCallback(() => {
    setShowExit(false);
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    endGame("exit");
  }, [endGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (screen === "playing" || screen === "countdown") {
        e.preventDefault();
        setShowExit((v) => !v);
      } else if (screen === "mode" || screen === "score" || screen === "bank" || screen === "result") {
        setScreen("home");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  /* ---------------------------------------------------------------- bank */

  const addDraft = useCallback(() => {
    const opts = draft.options.map((o) => o.trim());
    if (draft.prompt.trim().length < 2) {
      setToast("Soal belum diisi.");
      return;
    }
    if (opts.some((o) => o.length === 0)) {
      setToast("Keempat pilihan harus diisi.");
      return;
    }
    if (new Set(opts).size !== 4) {
      setToast("Pilihan tidak boleh kembar.");
      return;
    }
    const created = makeQuestion(draft);
    if (created.subjectId === "guru") {
      setGuru((prev) => {
        const next: GuruBank = { ...prev, questions: [...prev.questions, created] };
        saveGuru(next);
        return next;
      });
    } else {
      const key = created.subjectId as ContentSubjectId;
      setBank((prev) => {
        const next: Bank = { ...prev, [key]: [...prev[key], created] };
        saveBank(next);
        return next;
      });
    }
    setDraft(emptyDraft(draft.subjectId));
    setToast("Soal ditambahkan.");
  }, [draft]);

  const deleteQuestion = useCallback((subject: SubjectId, id: string) => {
    if (subject === "guru") {
      setGuru((prev) => {
        const next: GuruBank = { ...prev, questions: prev.questions.filter((x) => x.id !== id) };
        saveGuru(next);
        return next;
      });
      return;
    }
    const key = subject as ContentSubjectId;
    setBank((prev) => {
      const next: Bank = { ...prev, [key]: prev[key].filter((x) => x.id !== id) };
      saveBank(next);
      return next;
    });
  }, []);

  const resetBank = useCallback(() => {
    setBank(resetBankToDefault());
    setToast("Bank soal kembali ke bawaan.");
  }, []);

  const exportBank = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(bank, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "banua-fruit-blast-bank.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Gagal mengekspor bank.");
    }
  }, [bank]);

  const importBank = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBank(String(reader.result ?? ""));
      if (!parsed) {
        setToast("Berkas bank tidak valid.");
        return;
      }
      const merged = defaultBank();
      CONTENT_SUBJECTS.forEach((k) => {
        if (parsed[k].length > 0) merged[k] = parsed[k];
      });
      saveBank(merged);
      setBank(merged);
      setToast("Bank soal diimpor.");
    };
    reader.readAsText(file);
  }, []);

  /** Impor soal dari teks tempel / berkas .md / .csv ke mapel tujuan.
   *  Format dikenali otomatis: ada pola Markdown -> Markdown, selain
   *  itu CSV. Bila Markdown memuat baris "Mapel:" dan tujuan Mapel Guru,
   *  nama mapel ikut tersimpan. */
  const importTextBank = useCallback(
    (text: string, target: SubjectId) => {
      const looksMd = /##\s*soal|jawaban\s*:/i.test(text);
      const parsedMd = looksMd ? parseMarkdownBank(text, target) : null;
      const items = parsedMd ? parsedMd.items : parseCsvBank(text, target).items;
      const skipped = parsedMd ? parsedMd.skipped : parseCsvBank(text, target).skipped;
      if (items.length === 0) {
        setToast("Tidak ada soal valid yang terbaca dari teks itu.");
        return;
      }
      if (target === "guru") {
        setGuru((prev) => {
          const next: GuruBank = {
            name: parsedMd && parsedMd.name ? parsedMd.name : prev.name,
            questions: [...prev.questions, ...items],
          };
          saveGuru(next);
          return next;
        });
      } else {
        const key = target as ContentSubjectId;
        setBank((prev) => {
          const next: Bank = { ...prev, [key]: [...prev[key], ...items] };
          saveBank(next);
          return next;
        });
      }
      setToast(
        `${items.length} soal diimpor${skipped > 0 ? `, ${skipped} blok dilewati` : ""}.`,
      );
    },
    [],
  );

  const copyPrompt = useCallback(() => {
    const text = promptTemplateSoal();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => setToast("Prompt tersalin. Tempel ke asisten AI mana pun."),
        () => setToast("Gagal menyalin prompt."),
      );
    } else {
      setToast("Peramban tidak mendukung salin otomatis.");
    }
  }, []);

  const downloadTemplate = useCallback(() => {
    try {
      const blob = new Blob([templateMarkdown()], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-soal-fruit.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Gagal mengunduh template.");
    }
  }, []);

  const exportScores = useCallback(() => {
    try {
      const blob = new Blob([scoresCsv(scores)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "banua-fruit-blast-scores.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Gagal mengekspor skor.");
    }
  }, [scores]);

  /* ---------------------------------------------------------------- panel */

  /* ----------------------------------------------------------------- render */

  const subjectTitle =
    settings.subject === "guru"
      ? guru.name || "Mapel Guru"
      : SUBJECTS.find((s) => s.id === settings.subject)?.title ?? "Matematika";
  const totalBank =
    CONTENT_SUBJECTS.reduce((n, k) => n + bank[k].length, 0) + guru.questions.length;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-100 to-lime-100 text-emerald-950">
      {/* ------------------------------------------------------------- HOME */}
      {screen === "home" && (
        <>
          <Header title="Banua Fruit Blast" />
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-6 text-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-600">Game Edukasi</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">
                Banua Fruit Blast
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-emerald-900/70">
                Potong buah jawaban yang benar dengan geseran jarimu. Buah terus
                mengalir sampai ada yang menjawab benar, dan label jawabannya
                terus diacak ulang. Hati-hati: di dalam buah bisa sembunyi emas
                atau bom.
              </p>
              <ul className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-1.5 text-[11px] font-bold text-emerald-950">
                <li className="rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-emerald-900/10">Benar +1</li>
                <li className="rounded-full bg-amber-300/80 px-2.5 py-1 ring-1 ring-amber-700/20">Benar berisi emas +2</li>
                <li className="rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-emerald-900/10">Salah -1</li>
                <li className="rounded-full bg-rose-400/80 px-2.5 py-1 text-white ring-1 ring-rose-700/30">Salah berisi bom -2</li>
              </ul>
            </div>

            <div className="grid w-full max-w-md grid-cols-1 gap-2">
              <button
                type="button"
                onClick={startMatch}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-lime-400 px-6 text-base font-black text-emerald-950 shadow-lg transition active:scale-95"
                data-start="1"
              >
                MULAI
              </button>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-mode={m.id}
                    onClick={() => {
                      setSettings((s) => ({ ...s, mode: m.id }));
                      setScreen("mode");
                    }}
                    className="flex min-h-11 flex-col items-center justify-center rounded-xl bg-white/70 px-2 py-1 ring-1 ring-emerald-900/10 shadow-sm transition hover:bg-white active:scale-95"
                  >
                    <span className="text-sm font-black">{m.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-emerald-900/60">{m.sub}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" onClick={() => setScreen("bank")} className="min-h-10">
                  📚 Bank Soal
                </Btn>
                <Btn variant="ghost" onClick={() => setScreen("score")} className="min-h-10">
                  🏆 Skor
                </Btn>
              </div>
              <Link
                href="/dashboard/games"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/70 px-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-900/15 shadow-sm transition hover:bg-white"
              >
                🎮 Pilih Game Lain (Lobby Magguru)
              </Link>
            </div>

            <p className="max-w-md text-[11px] leading-relaxed text-emerald-900/55">
              {totalBank} soal tersedia · dimainkan 2 sampai 4 orang dalam satu layar · progres disimpan di perangkat.
            </p>
          </main>
        </>
      )}

      {/* ------------------------------------------------------------- MODE */}
      {screen === "mode" && (
        <>
          <Header title="Pilih Mode & Materi" onExit={() => setScreen("home")} />
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <section>
                <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-lime-300">Mode</h2>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => {
                    const active = settings.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-mode-option={m.id}
                        aria-pressed={active}
                        onClick={() => setSettings((s) => ({ ...s, mode: m.id }))}
                        className={`min-h-11 rounded-xl px-2 py-2 text-sm font-black ring-1 transition ${
                          active
                            ? "bg-lime-400 text-emerald-950 ring-lime-300"
                            : "bg-white/70 text-emerald-950 ring-emerald-900/15 shadow-sm hover:bg-white"
                        }`}
                      >
                        {m.title}
                        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-lime-300">Mata Pelajaran</h2>
                <div className="grid grid-cols-3 gap-2">
                  {SUBJECTS.map((s) => {
                    const active = settings.subject === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        data-subject-option={s.id}
                        aria-pressed={active}
                        onClick={() => {
                          setSettings((p) => ({ ...p, subject: s.id }));
                          setDraft((d) => ({ ...d, subjectId: s.id }));
                        }}
                        className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold ring-1 transition ${
                          active
                            ? "bg-lime-400 text-emerald-950 ring-lime-300"
                            : "bg-white/70 text-emerald-950 ring-emerald-900/15 shadow-sm hover:bg-white"
                        }`}
                      >
                        <span aria-hidden="true">{s.icon}</span> {s.title}
                        <span className="mt-0.5 block text-[10px] font-semibold opacity-75">
                          {bank[s.id].length} soal
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    data-subject-option="guru"
                    aria-pressed={settings.subject === "guru"}
                    onClick={() => {
                      setSettings((p) => ({ ...p, subject: "guru" }));
                      setDraft((d) => ({ ...d, subjectId: "guru" }));
                    }}
                    className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold ring-1 transition ${
                      settings.subject === "guru"
                        ? "bg-lime-400 text-emerald-950 ring-lime-300"
                        : "bg-white/70 text-emerald-950 ring-emerald-900/15 shadow-sm hover:bg-white"
                    }`}
                  >
                    <span aria-hidden="true">🧑‍🏫</span> {guru.name || "Mapel Guru"}
                    <span className="mt-0.5 block text-[10px] font-semibold opacity-75">
                      {guru.questions.length} soal
                    </span>
                  </button>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-lime-300">Jumlah Soal</h2>
                <div className="grid grid-cols-4 gap-2">
                  {RULES.questionCountOptions.map((n) => {
                    const active = settings.questionCount === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        data-count-option={String(n)}
                        aria-pressed={active}
                        onClick={() => setSettings((s) => ({ ...s, questionCount: n }))}
                        className={`min-h-9 rounded-xl text-xs font-black ring-1 transition ${
                          active
                            ? "bg-lime-400 text-emerald-950 ring-lime-300"
                            : "bg-white/70 text-emerald-950 ring-emerald-900/15 shadow-sm hover:bg-white"
                        }`}
                      >
                        {n === 0 ? "Semua" : `${n} soal`}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2 ring-1 ring-emerald-900/10">
                <span className="text-sm font-bold">Suara</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.sound}
                  aria-label="Aktifkan suara"
                  data-sound-toggle="1"
                  onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
                  className={`relative h-8 w-14 rounded-full transition ${
                    settings.sound ? "bg-lime-400" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      settings.sound ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </section>


              <button
                type="button"
                data-gass="1"
                onClick={startMatch}
                className="mt-1 min-h-12 rounded-2xl bg-lime-400 text-base font-black text-emerald-950 shadow-lg transition hover:bg-lime-300 active:scale-95"
              >
                Paham, Gass Main!
              </button>
            </div>
          </main>
        </>
      )}

      {/* -------------------------------------------------------- COUNTDOWN */}
      {screen === "countdown" && (
        <>
          <Header title="Bersiap" onExit={requestExit} />
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-lime-300">Siap-siap</p>
            <p className="text-7xl font-black text-white" data-countdown="1">
              {countdown || 1}
            </p>
            <p className="text-sm font-medium text-emerald-900/70">
              {settings.mode} · {subjectTitle} · {RULES.durationSec / 60} menit
            </p>
          </main>
        </>
      )}

      {/* ----------------------------------------------------------- PLAYING */}
      {screen === "playing" && (
        <>
          <Header
            title={subjectTitle}
            onExit={requestExit}
            right={
              <span
                data-timer="1"
                className="rounded-xl bg-lime-400 px-3 py-1 text-sm font-black tabular-nums text-emerald-950"
                aria-live="off"
              >
                {fmtTime(timeLeft)}
              </span>
            }
          />

          <div className="min-h-0 flex-1 p-1.5 lg:p-2">
            <div
              ref={wrapRef}
              className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-emerald-900/10"
            >
              <canvas
                ref={canvasRef}
                data-arena="1"
                className="block h-full w-full touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                aria-label="Arena buah jatuh, potong buah dengan jawaban benar memakai geseran"
              />
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ RESULT */}
      {screen === "result" && result && (
        <>
          <Header title="Hasil Pertandingan" onExit={() => setScreen("home")} />
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300">
                  {result.reason === "timeup" ? "Waktu Habis" : "Dikeluarkan"}
                </p>
                <h2 className="mt-1 text-2xl font-black" data-winner="1">
                  {result.reason === "exit" ? "Poin tidak disimpan" : `Pemenang: ${winnerOf(result.rows)}`}
                </h2>
                <p className="mt-1 text-xs text-emerald-900/65">
                  {result.reason === "timeup"
                    ? "Hasil pertandingan tersimpan di riwayat skor."
                    : "Permainan dihentikan sebelum selesai."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.rows.map((row, i) => {
                  const def = playersFor(settings.mode)[i];
                  return (
                    <div
                      key={row.name}
                      className="rounded-xl p-3"
                      style={{
                        background: `linear-gradient(140deg, ${def.gradFrom}, ${def.gradTo})`,
                        border: `2px solid ${def.accent}`,
                      }}
                      data-result-player={row.name}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black uppercase tracking-wide">{row.name}</span>
                        <span className="text-2xl font-black tabular-nums" style={{ color: def.accent }}>
                          {row.score}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/85">
                        Benar {row.correct} · Salah {row.wrong}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Btn variant="accent" onClick={startMatch} className="min-h-11">
                  Main Lagi
                </Btn>
                <Btn variant="ghost" onClick={() => setScreen("mode")} className="min-h-11">
                  Ganti Topik
                </Btn>
                <Btn variant="ghost" onClick={() => setScreen("home")} className="min-h-11">
                  Beranda
                </Btn>
                <Link
                  href="/dashboard/games"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/70 px-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-900/15 shadow-sm transition hover:bg-white"
                >
                  🎮 Pilih Game Lain
                </Link>
              </div>
            </div>
          </main>
        </>
      )}

      {/* ------------------------------------------------------------- SCORE */}
      {screen === "score" && (
        <>
          <Header title="Riwayat Skor" onExit={() => setScreen("home")} />
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={exportScores} disabled={scores.length === 0}>
                  ⬇ Ekspor CSV
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => {
                    clearScores();
                    setScores([]);
                    setToast("Riwayat skor dihapus.");
                  }}
                  disabled={scores.length === 0}
                >
                  🗑 Hapus Semua
                </Btn>
                <span className="self-center text-[11px] text-emerald-900/65">
                  {scores.length}/{RULES.maxScoreRecords} catatan
                </span>
              </div>

              {scores.length === 0 ? (
                <p className="rounded-xl bg-white/60 p-4 text-center text-sm text-emerald-900/65">
                  Belum ada catatan. Selesaikan satu pertandingan untuk mengisi riwayat.
                </p>
              ) : (
                <ul className="flex flex-col gap-2" data-score-list="1">
                  {scores.map((r) => (
                    <li
                      key={r.id}
                      data-score-row={r.id}
                      className="rounded-xl bg-white/60 p-2.5 ring-1 ring-emerald-900/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-sm font-black">{r.winner}</span>
                        <span className="text-[11px] text-emerald-900/65">
                          {r.mode} · {r.subject} · {new Date(r.timestamp).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-emerald-900/70">
                        {r.players.map((p) => `${p.name} ${p.score}`).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </main>
        </>
      )}

      {/* -------------------------------------------------------------- BANK */}
      {screen === "bank" && (
        <>
          <Header title="Bank Soal" onExit={() => setScreen("home")} />
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <LmsBankPicker
                onSelect={(choice) => {
                  const questions = choice.questions.map((q) =>
                    makeQuestion({
                      subjectId: "guru",
                      prompt: q.prompt,
                      options: [
                        q.options[0] ?? "",
                        q.options[1] ?? "",
                        q.options[2] ?? "",
                        q.options[3] ?? "",
                      ],
                      correctIndex: q.correctIndex,
                    }),
                  );
                  const next: GuruBank = { name: choice.bankName, questions };
                  setGuru(next);
                  saveGuru(next);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={exportBank}>
                  ⬇ Ekspor JSON
                </Btn>
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded-xl bg-white/70 px-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-900/15 hover:bg-white">
                  ⬆ Impor Berkas
                  <input
                    type="file"
                    accept="application/json,.json,.md,.csv,.txt"
                    className="sr-only"
                    data-import-bank="1"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (/\.json$/i.test(f.name)) {
                          importBank(f);
                        } else {
                          const reader = new FileReader();
                          reader.onload = () =>
                            importTextBank(String(reader.result ?? ""), draft.subjectId);
                          reader.readAsText(f);
                        }
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <Btn variant="danger" onClick={resetBank}>
                  ↺ Reset Bawaan
                </Btn>
              </div>

              <section className="rounded-xl bg-white/60 p-3 ring-1 ring-emerald-900/10" data-bank-form="1">
                <h2 className="text-sm font-black">Tambah Soal</h2>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] font-bold">
                    Subjek
                    <select
                      value={draft.subjectId}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subjectId: e.target.value as SubjectId }))
                      }
                      data-draft-subject="1"
                      className="min-h-9 rounded-lg bg-white px-2 text-sm text-emerald-950 ring-1 ring-emerald-900/15"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id} className="text-white">
                          {s.title}
                        </option>
                      ))}
                      <option value="guru" className="text-white">
                        {guru.name || "Mapel Guru"}
                      </option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-bold">
                    Soal
                    <input
                      value={draft.prompt}
                      onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                      data-draft-prompt="1"
                      placeholder="Tulis pertanyaan"
                      className="min-h-9 rounded-lg bg-white px-2 text-sm text-emerald-950 ring-1 ring-emerald-900/15 placeholder:text-emerald-900/40"
                    />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {draft.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-[11px] font-bold">
                      <input
                        type="radio"
                        name="correct-index"
                        checked={draft.correctIndex === oi}
                        onChange={() => setDraft((d) => ({ ...d, correctIndex: oi }))}
                        data-draft-correct={oi}
                        aria-label={`Tandai pilihan ${oi + 1} sebagai jawaban benar`}
                        className="h-4 w-4 accent-lime-400"
                      />
                      <input
                        value={opt}
                        onChange={(e) =>
                          setDraft((d) => {
                            const options = [...d.options] as [string, string, string, string];
                            options[oi] = e.target.value;
                            return { ...d, options };
                          })
                        }
                        data-draft-option={oi}
                        placeholder={`Pilihan ${oi + 1}`}
                        className="min-h-9 flex-1 rounded-lg bg-white px-2 text-sm text-emerald-950 ring-1 ring-emerald-900/15 placeholder:text-emerald-900/40"
                      />
                    </label>
                  ))}
                </div>

                <Btn variant="accent" onClick={addDraft} className="mt-2 min-h-10" data-add-question="1">
                  + Simpan Soal
                </Btn>
              </section>

              <section className="rounded-xl bg-white/60 p-3 ring-1 ring-emerald-900/10" data-import-panel="1">
                <h2 className="text-sm font-black">Impor Soal dari Teks (Markdown / CSV)</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/65">
                  Tempel soal, lalu impor ke mapel yang sedang dipilih pada formulir
                  Tambah Soal di atas. Format Markdown memakai pola ## Soal, pilihan
                  A. sampai D., dan baris Jawaban. Format CSV memakai enam kolom:
                  soal, A, B, C, D, jawaban.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={5}
                  data-import-textarea="1"
                  placeholder={"## Soal\nIbukota Indonesia adalah...\nA. Bandung\nB. Jakarta\nC. Surabaya\nD. Medan\nJawaban: B"}
                  className="mt-2 w-full rounded-lg bg-white px-2 py-2 text-sm text-emerald-950 ring-1 ring-emerald-900/15 placeholder:text-emerald-900/40"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn
                    variant="accent"
                    data-import-run="1"
                    onClick={() => {
                      importTextBank(importText, draft.subjectId);
                      setImportText("");
                    }}
                  >
                    ⬆ Impor Teks ke {draft.subjectId === "guru" ? guru.name || "Mapel Guru" : SUBJECTS.find((x) => x.id === draft.subjectId)?.title}
                  </Btn>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-black text-emerald-950">
                    📋 Petunjuk &amp; Prompt untuk Membuat Soal dengan AI
                  </summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/65">
                    Salin prompt ini ke asisten AI mana pun, isi mapel dan topiknya,
                    lalu tempel hasilnya ke kotak impor di atas.
                  </p>
                  <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-emerald-950/90 p-3 text-[11px] leading-relaxed text-emerald-50">
                    {promptTemplateSoal()}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn variant="ghost" onClick={copyPrompt} data-copy-prompt="1">
                      📋 Salin Prompt
                    </Btn>
                    <Btn variant="ghost" onClick={downloadTemplate} data-download-template="1">
                      ⬇ Unduh Template .md
                    </Btn>
                  </div>
                </details>
              </section>

              {SUBJECTS.map((s) => (
                <section key={s.id} data-bank-group={s.id}>
                  <h2 className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-lime-300">
                    <span aria-hidden="true">{s.icon}</span> {s.title}
                    <span className="text-emerald-100/60" data-bank-count={s.id}>
                      {bank[s.id].length} soal
                    </span>
                  </h2>
                  <ul className="flex flex-col gap-1.5">
                    {bank[s.id].map((item) => (
                      <li
                        key={item.id}
                        data-bank-item={item.id}
                        className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10"
                      >
                        <div className="flex items-start gap-2">
                          <p
                            dir={item.isArabic ? "rtl" : "ltr"}
                            className={`min-w-0 flex-1 text-[12px] font-semibold ${
                              item.isArabic ? "font-arabic" : ""
                            }`}
                          >
                            {item.prompt}
                          </p>
                          <button
                            type="button"
                            data-delete-question={item.id}
                            aria-label={`Hapus soal ${item.prompt}`}
                            onClick={() => deleteQuestion(s.id, item.id)}
                            className="min-h-7 shrink-0 rounded-md bg-rose-600/80 px-2 text-[11px] font-bold text-white hover:bg-rose-500"
                          >
                            Hapus
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-emerald-900/65">
                          Benar: <span className="font-bold text-lime-300">{item.correct}</span>
                          {item.custom ? " · buatan sendiri" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <section data-bank-group="guru">
                <h2 className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-lime-300">
                  <span aria-hidden="true">🧑‍🏫</span> Mapel Guru
                  <span className="text-emerald-100/60" data-bank-count="guru">
                    {guru.questions.length} soal
                  </span>
                </h2>
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-[11px] font-bold text-emerald-900/70" htmlFor="guru-name">
                    Nama mapel:
                  </label>
                  <input
                    id="guru-name"
                    value={guru.name}
                    onChange={(e) => {
                      const next: GuruBank = { ...guru, name: e.target.value };
                      setGuru(next);
                      saveGuru(next);
                    }}
                    data-guru-name="1"
                    placeholder="mis. IPA Kelas 5"
                    className="min-h-9 flex-1 rounded-lg bg-white px-2 text-sm text-emerald-950 ring-1 ring-emerald-900/15 placeholder:text-emerald-900/40"
                  />
                </div>
                {guru.questions.length === 0 ? (
                  <p className="rounded-lg bg-white/5 p-2 text-[11px] text-emerald-900/65 ring-1 ring-white/10">
                    Belum ada soal Mapel Guru. Tambahkan lewat formulir di atas dengan
                    subjek Mapel Guru, atau impor dari teks/berkas.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {guru.questions.map((item) => (
                      <li
                        key={item.id}
                        data-bank-item={item.id}
                        className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10"
                      >
                        <div className="flex items-start gap-2">
                          <p
                            dir={item.isArabic ? "rtl" : "ltr"}
                            className={`min-w-0 flex-1 text-[12px] font-semibold ${
                              item.isArabic ? "font-arabic" : ""
                            }`}
                          >
                            {item.prompt}
                          </p>
                          <button
                            type="button"
                            data-delete-question={item.id}
                            aria-label={`Hapus soal ${item.prompt}`}
                            onClick={() => deleteQuestion("guru", item.id)}
                            className="min-h-7 shrink-0 rounded-md bg-rose-600/80 px-2 text-[11px] font-bold text-white hover:bg-rose-500"
                          >
                            Hapus
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-emerald-900/65">
                          Benar: <span className="font-bold text-lime-300">{item.correct}</span>
                          {item.custom ? " · buatan sendiri" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </main>
        </>
      )}

      {/* --------------------------------------------------- dialog keluar */}
      {showExit && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
          data-exit-dialog="1"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center text-slate-900 shadow-2xl">
            <h2 id="exit-title" className="text-lg font-black">
              Yakin keluar?
            </h2>
            <p className="mt-1 text-sm text-slate-600">Poin tidak disimpan.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowExit(false)}
                data-exit-cancel="1"
                className="min-h-10 rounded-xl bg-slate-200 text-sm font-black text-slate-800 hover:bg-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmExit}
                data-exit-confirm="1"
                className="min-h-10 rounded-xl bg-rose-600 text-sm font-black text-white hover:bg-rose-500"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-black/85 px-4 py-2 text-xs font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
