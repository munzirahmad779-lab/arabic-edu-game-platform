"use client";

/**
 * AI BASKETBALL — duel 2 pemain (Log 38).
 *
 * Desain ulang mengikuti rujukan papan interaktif (perintah user 28 Okt
 * 23:46): dua pemain, dua tim, satu layar. Tiap pemain punya panel soal di
 * sisinya sendiri (kiri/kanan), arena di tengah; Anoa menembak ke ring tim
 * pemain yang menjawab. Mata pelajaran & bank soal sama dengan game pertama
 * (Adu Tarik): Bahasa Arab, Matematika SMA, Biologi SMA, Fisika SMA.
 *
 * Alur: beranda → pilih mapel → hitung mundur → tanding (timer per panel
 * 20 dtk, timer pertandingan 180 dtk, target 10 poin) → hasil.
 * Antrean soal dibagikan bergiliran dari satu dek (pola Log 35): kedua
 * panel tidak pernah menampilkan soal yang sama bersamaan.
 *
 * Log 44: sesudah menjawab benar, SISWA MELEMPAR BOLA SENDIRI dengan
 * geseran jari/tetikus (pola game buang sampah) — masuk +2 poin, meleset
 * tetap +1 poin karena jawaban benar (aturan poin dari user).
 *
 * Desain ulang visual (poster kartun siang cerah): layar lebar = arena
 * penuh di atas + dua panel di bawah (tiap panel tepat di bawah timnya),
 * teks berskala tinggi layar untuk TV/proyektor, area soal/umpan balik
 * berukuran tetap (tanpa lompatan tata letak), HP = arena menempel di atas
 * dan panel menggulir di bawahnya.
 */

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import Link from "next/link";
import { LmsBankPicker } from "@/modules/game-bank/connector";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasArabic } from "../lib-pendamping/game-catalog";
import { recordGameResult, starsForAccuracy } from "../lib-pendamping/session";
import { sfx } from "../lib-pendamping/sfx";
import { music } from "../lib-pendamping/music";
import {
  RULES,
  SUBJECTS,
  SUBJECT_LABEL,
  bankFor,
  bestScore,
  dealQueues,
  effectiveBank,
  freshQueue,
  loadBankOverrides,
  loadCustomBank,
  loadScores,
  makeCustomQ,
  parseCustomCsv,
  parseMarkdownBank,
  promptTemplateSoal,
  saveBankOverrides,
  saveCustomBank,
  saveScore,
  shuffle,
  type BankOverrides,
  type CustomBank,
  type Q,
  type ScoreRecord,
  type SubjectId,
} from "./logic";
import { createArena, type ArenaHandle, type MascotId } from "./render";
import type { StaticImageData } from "next/image";
import anoaSheetImg from "../assets/sprites/characters/anoa_sheet.png";
import maleoSheetImg from "../assets/sprites/characters/maleo_sheet.png";
import tarsiusSheetImg from "../assets/sprites/characters/tarsius_sheet.png";
import yakiSheetImg from "../assets/sprites/characters/yaki_sheet.png";

/** 4 maskot utama Magguru — bisa dipilih tiap tim (Log 38 lanjutan).
 *  face = arah hadap gambar asli di lembar sprite. */
const MASCOT_LIST: { id: MascotId; name: string; sheet: StaticImageData; face: "R" | "L" }[] = [
  { id: "tarsius", name: "Tarsius", sheet: tarsiusSheetImg, face: "R" },
  { id: "anoa", name: "Anoa", sheet: anoaSheetImg, face: "R" },
  { id: "maleo", name: "Maleo", sheet: maleoSheetImg, face: "L" },
  { id: "yaki", name: "Yaki", sheet: yakiSheetImg, face: "L" },
];
const mascotName = (id: MascotId) => MASCOT_LIST.find((m) => m.id === id)?.name ?? id;

type Screen = "home" | "countdown" | "playing" | "result" | "bank";
type TeamId = "p1" | "p2";

/** Potret frame 0 (kiri-atas) dari lembar sprite, untuk pemilih & chip.
 *  side: bila diberikan, potret dibalik agar menghadap ke tengah lapangan. */
function MascotThumb({
  id,
  size = 44,
  side,
  square = false,
}: {
  id: MascotId;
  size?: number;
  side?: TeamId;
  square?: boolean;
}) {
  const m = MASCOT_LIST.find((x) => x.id === id) ?? MASCOT_LIST[1];
  const want = side === "p2" ? "L" : "R";
  const flip = side !== undefined && m.face !== want;
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden bg-gradient-to-b from-sky-100 to-sky-200 ring-2 ring-white/80 ${
        square ? "rounded-3xl" : "rounded-full"
      }`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.sheet.src}
        alt={m.name}
        style={{
          width: size * 2,
          height: size * 2,
          maxWidth: "none",
          transformOrigin: `${size / 2}px 50%`,
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      />
    </span>
  );
}

/** Mapel yang bisa dimainkan: 4 mapel bawaan + Mapel Guru (kustom). */
type PlaySubject = SubjectId | "guru";
type Winner = TeamId | "draw";

interface TeamPlay {
  score: number;
  streak: number;
  best: number;
  correct: number;
  answered: number;
  qi: number;
  cycle: number;
  selected: number | null;
  reveal: boolean;
  timedOut: boolean;
  timeLeft: number;
  /** Alur sesudah menjawab: "question" menjawab, "aim" mengarahkan
   *  lemparan, "thrown" bola sedang terbang (Log 44 — lemparan manual). */
  phase: "question" | "aim" | "thrown";
  throwLeft: number;
  throwResult: "score" | "miss" | null;
}

interface FloatNote {
  readonly id: number;
  readonly text: string;
  readonly tone: "gold" | "rose" | "sky";
  readonly x: number;
}

/* Pujian netral untuk semua mapel. Kata pujian Arab (Mumtaz, Jayyid)
 * HANYA muncul bila mapel Bahasa Arab yang dipilih (perintah user
 * Log 45) — mapel lain & Mapel Guru tidak ditaburi bahasa Arab. */
const PRAISE_ID = ["Hebat!", "Keren!", "Mantap!", "Brilian!", "Luar Biasa!"] as const;
const PRAISE_AR = ["Mumtaz!", "Jayyid Jiddan!", "Hebat!", "Mantap!", "Brilian!"] as const;
const praiseFor = (s: PlaySubject): readonly string[] => (s === "arab" ? PRAISE_AR : PRAISE_ID);
const TEAMS: TeamId[] = ["p1", "p2"];
const other = (t: TeamId): TeamId => (t === "p1" ? "p2" : "p1");
const teamName = (t: TeamId) => (t === "p1" ? "TIM KIRI" : "TIM KANAN");
/** Posisi teks melayang di arena (persen lebar) — sejajar ring tiap tim. */
const floatX = (t: TeamId) => (t === "p1" ? 27 : 73);

/* ---------- Sistem gaya bersama (poster kartun siang cerah) ---------- */
const PAGE_BG = "bg-gradient-to-b from-sky-400 via-sky-200 to-amber-100";
const BTN_GOLD =
  "rounded-2xl border-b-4 border-orange-600 bg-gradient-to-b from-amber-300 to-orange-400 font-black text-slate-900 shadow-lg transition active:translate-y-0.5 active:border-b-2";
const BTN_SKY =
  "rounded-2xl border-b-4 border-blue-700 bg-gradient-to-b from-sky-400 to-blue-500 font-black text-white shadow-lg transition active:translate-y-0.5 active:border-b-2";
const BTN_GHOST =
  "rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white/90 font-black text-emerald-950/80 shadow-sm transition hover:bg-white active:translate-y-0.5 active:border-b-2";
const CARD =
  "rounded-[2rem] border-4 border-white/90 bg-white/70 shadow-[0_10px_0_rgba(2,132,199,0.18),0_24px_60px_rgba(2,132,199,0.2)] backdrop-blur-xl";

const PANEL_THEME = {
  p1: {
    frame: "border-sky-500",
    head: "bg-gradient-to-r from-sky-500 to-blue-600",
    stage: "bg-sky-50 ring-sky-200",
    bar: "bg-sky-400",
    hover: "hover:bg-sky-50 hover:border-sky-300",
    body: "bg-gradient-to-b from-sky-100 to-white",
    badge: "bg-sky-100 text-sky-700",
  },
  p2: {
    frame: "border-amber-500",
    head: "bg-gradient-to-r from-amber-500 to-orange-600",
    stage: "bg-amber-50 ring-amber-200",
    bar: "bg-amber-400",
    hover: "hover:bg-amber-50 hover:border-amber-300",
    body: "bg-gradient-to-b from-amber-100 to-white",
    badge: "bg-amber-100 text-amber-700",
  },
} as const;

const freshTeam = (): TeamPlay => ({
  score: 0,
  streak: 0,
  best: 0,
  correct: 0,
  answered: 0,
  qi: 0,
  cycle: 0,
  selected: null,
  reveal: false,
  timedOut: false,
  timeLeft: RULES.questionTime,
  phase: "question",
  throwLeft: RULES.aimTime,
  throwResult: null,
});

export default function AiBasketballGame() {
  const [screen, setScreen] = useState<Screen>("home");
  // Musik latar orisinal (lib/music) mengalir selama pertandingan.
  const [soundOn, setSoundOn] = useState<boolean>(() => sfx.isEnabled());
  useEffect(() => {
    if (screen === "countdown" || screen === "playing" || screen === "result") music.play("basket");
    else music.stop();
  }, [screen]);
  useEffect(() => () => music.stop(), []);
  const toggleSound = () => {
    const v = !soundOn;
    setSoundOn(v);
    sfx.setEnabled(v);
    if (!v) music.stop();
    else if (screen === "countdown" || screen === "playing" || screen === "result") music.play("basket");
    else sfx.play("click");
  };
  const [subject, setSubject] = useState<PlaySubject>("arab");
  // Mapel Guru (kustom): nama + bank soal buatan guru, tersimpan lokal.
  const [custom, setCustom] = useState<CustomBank>(() => ({ name: "", questions: [] }));
  // Editan guru atas bank 4 mapel bawaan (Log 46).
  const [overrides, setOverrides] = useState<BankOverrides>({});
  const [startWarn, setStartWarn] = useState("");
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [showScore, setShowScore] = useState(false);

  // ---- state pertandingan ----
  const [teams, setTeams] = useState<Record<TeamId, TeamPlay>>({ p1: freshTeam(), p2: freshTeam() });
  const [matchLeft, setMatchLeft] = useState<number>(RULES.matchTime);
  const [paused, setPaused] = useState(false);
  const [floats, setFloats] = useState<FloatNote[]>([]);
  const [damageKey, setDamageKey] = useState(0);
  // Goyang layar saat ada jawaban salah — jangan pakai key={shake-...} pada
  // pembungkus layar (remount membunuh canvas); pakai AnimationControls.
  const shakeControls = useAnimationControls();
  useEffect(() => {
    if (damageKey > 0) {
      void shakeControls.start({
        x: [0, -9, 8, -5, 3, 0],
        transition: { duration: 0.4 },
      });
    }
  }, [damageKey, shakeControls]);
  const [countdown, setCountdown] = useState(3);
  const [exitAsk, setExitAsk] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);

  // Pilihan maskot tiap tim — dua maskot terpilih tampil di lapangan.
  const [mascots, setMascotsState] = useState<Record<TeamId, MascotId>>({ p1: "anoa", p2: "maleo" });
  const mascotsRef = useRef(mascots);
  const pickMascot = useCallback((team: TeamId, id: MascotId) => {
    const cur = mascotsRef.current;
    if (cur[team] === id) return;
    const foe = other(team);
    // Maskot yang sama tidak bisa dipakai dua tim: bila memilih maskot
    // lawan, kedua tim bertukar maskot.
    const next =
      cur[foe] === id ? { ...cur, [team]: id, [foe]: cur[team] } : { ...cur, [team]: id };
    mascotsRef.current = next;
    setMascotsState(next);
    sfx.play("click");
  }, []);

  const arenaBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaRef = useRef<ArenaHandle | null>(null);
  const teamsRef = useRef(teams);
  const queuesRef = useRef<Record<TeamId, Q[]>>({ p1: [], p2: [] });
  const optsRef = useRef<Map<string, { options: string[]; correctIndex: number }>>(new Map());
  const procRef = useRef<Record<TeamId, boolean>>({ p1: false, p2: false });
  const finishedRef = useRef(false);
  const pausedRef = useRef(false);
  const matchLeftRef = useRef<number>(RULES.matchTime);
  const subjectRef = useRef<PlaySubject>("arab");
  const customRef = useRef<CustomBank>({ name: "", questions: [] });
  const overridesRef = useRef<BankOverrides>({});
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const floatId = useRef(0);

  useEffect(() => {
    setRecords(loadScores());
    const loaded = loadCustomBank();
    customRef.current = loaded;
    setCustom(loaded);
    const loadedOverrides = loadBankOverrides();
    overridesRef.current = loadedOverrides;
    setOverrides(loadedOverrides);
  }, []);

  /** Daftar soal aktif: Mapel Guru, atau bank bawaan (versi editan guru bila ada). */
  const activeList = useCallback(
    (s: PlaySubject): readonly Q[] =>
      s === "guru" ? customRef.current.questions : effectiveBank(s, overridesRef.current),
    [],
  );

  /** Simpan perubahan Mapel Guru ke state + ref + penyimpanan lokal. */
  const updateCustom = useCallback((next: CustomBank) => {
    customRef.current = next;
    setCustom(next);
    saveCustomBank(next);
  }, []);

  /** Simpan editan bank bawaan ke state + ref + penyimpanan lokal. */
  const updateOverrides = useCallback((next: BankOverrides) => {
    overridesRef.current = next;
    setOverrides(next);
    saveBankOverrides(next);
  }, []);

  /** Label mapel untuk HUD & hitung mundur (Mapel Guru memakai namanya). */
  const subjectLabel =
    subject === "guru" ? custom.name.trim() || "Mapel Guru" : SUBJECT_LABEL[subject];

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timeoutsRef.current.delete(t);
      fn();
    }, ms);
    timeoutsRef.current.add(t);
  }, []);

  useEffect(() => {
    const pending = timeoutsRef.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
      arenaRef.current?.dispose();
      arenaRef.current = null;
    };
  }, []);

  const patchTeam = useCallback((team: TeamId, patch: Partial<TeamPlay>) => {
    const next = { ...teamsRef.current, [team]: { ...teamsRef.current[team], ...patch } };
    teamsRef.current = next;
    setTeams(next);
  }, []);

  const questionOf = useCallback((team: TeamId): Q | undefined => {
    const t = teamsRef.current[team];
    return queuesRef.current[team][t.qi];
  }, []);

  /** Urutan pilihan per tim per putaran per soal — diacak sekali, lalu di-cache. */
  const optionsOf = useCallback((team: TeamId): { options: string[]; correctIndex: number } => {
    const t = teamsRef.current[team];
    const q = queuesRef.current[team][t.qi];
    if (!q) return { options: [], correctIndex: 0 };
    const key = `${team}|${t.cycle}|${q.id}`;
    const hit = optsRef.current.get(key);
    if (hit) return hit;
    const order = shuffle(q.options.map((_, i) => i));
    const built = {
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.correctIndex),
    };
    optsRef.current.set(key, built);
    return built;
  }, []);

  const spawnFloat = useCallback(
    (text: string, tone: FloatNote["tone"], x = 50) => {
      const id = ++floatId.current;
      setFloats((prev) => [...prev.slice(-4), { id, text, tone, x }]);
      trackTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1250);
    },
    [trackTimeout],
  );

  const startRound = useCallback((nextSubject: PlaySubject) => {
    setSubject(nextSubject);
    subjectRef.current = nextSubject;
    queuesRef.current = dealQueues(activeList(nextSubject));
    optsRef.current.clear();
    procRef.current = { p1: false, p2: false };
    finishedRef.current = false;
    const fresh = { p1: freshTeam(), p2: freshTeam() };
    teamsRef.current = fresh;
    setTeams(fresh);
    matchLeftRef.current = RULES.matchTime;
    setMatchLeft(RULES.matchTime);
    setWinner(null);
    setPaused(false);
    setScreen("countdown");
  }, [activeList]);

  const finishMatch = useCallback(
    (w: Winner) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setWinner(w);
      const now = teamsRef.current;
      const recTeam: TeamId = w === "draw" ? (now.p1.score >= now.p2.score ? "p1" : "p2") : w;
      const rt = now[recTeam];
      const acc = rt.answered > 0 ? rt.correct / rt.answered : 0;
      setRecords(
        saveScore({
          score: rt.score,
          correct: rt.correct,
          total: Math.max(rt.answered, 1),
          bestStreak: rt.best,
          at: new Date().toISOString(),
        }),
      );
      recordGameResult({
        slug: "ai-basketball",
        score: rt.score,
        streak: rt.best,
        stars: starsForAccuracy(acc || (w !== "draw" ? 1 : 0)),
        coinsEarned: rt.score + (w !== "draw" ? 2 : 0),
      });
      sfx.play("victory");
      setScreen("result");
    },
    [],
  );

  const finishByScore = useCallback(() => {
    const now = teamsRef.current;
    finishMatch(now.p1.score === now.p2.score ? "draw" : now.p1.score > now.p2.score ? "p1" : "p2");
  }, [finishMatch]);

  const advanceTeam = useCallback(
    (team: TeamId) => {
      if (finishedRef.current) return;
      if (pausedRef.current) {
        trackTimeout(() => advanceTeam(team), 500);
        return;
      }
      const t = teamsRef.current[team];
      let qi = t.qi + 1;
      let cycle = t.cycle;
      if (qi >= queuesRef.current[team].length) {
        const exclude = new Set<string>();
        const foeQ = questionOf(other(team));
        if (foeQ) exclude.add(foeQ.id);
        const doneQ = queuesRef.current[team][t.qi];
        if (doneQ) exclude.add(doneQ.id);
        queuesRef.current[team] = freshQueue(activeList(subjectRef.current), exclude);
        qi = 0;
        cycle += 1;
      }
      procRef.current[team] = false;
      patchTeam(team, {
        qi,
        cycle,
        selected: null,
        reveal: false,
        timedOut: false,
        timeLeft: RULES.questionTime,
        phase: "question",
        throwLeft: RULES.aimTime,
        throwResult: null,
      });
    },
    [activeList, patchTeam, questionOf, trackTimeout],
  );

  /** Lemparan selesai (masuk / meleset): poin Log 44 diberikan di sini —
   *  masuk +2, meleset tetap +1 karena jawaban benar. */
  const resolveThrow = useCallback(
    (team: TeamId, result: "score" | "miss") => {
      if (finishedRef.current) return;
      const t = teamsRef.current[team];
      const pts = result === "score" ? RULES.throwMake : RULES.throwMiss;
      const newScore = t.score + pts;
      if (result === "score") {
        sfx.play("correct");
      }
      patchTeam(team, { score: newScore, phase: "question", throwResult: result, reveal: true });
      spawnFloat(
        result === "score" ? `Masuk! +${pts} poin` : `Tetap +${pts} poin`,
        result === "score" ? "gold" : "sky",
        floatX(team),
      );
      if (newScore >= RULES.targetScore) {
        trackTimeout(() => finishMatch(team), 1400);
      } else {
        trackTimeout(() => advanceTeam(team), 2000);
      }
    },
    [advanceTeam, finishMatch, patchTeam, spawnFloat, trackTimeout],
  );

  /** Sesudah jawaban benar: maskot memegang bola, siswa melempar sendiri. */
  const startAim = useCallback(
    (team: TeamId) => {
      if (finishedRef.current) return;
      const handle = arenaRef.current;
      if (!handle) {
        resolveThrow(team, "miss");
        return;
      }
      handle.beginAim(team === "p1" ? 0 : 1, (result) => resolveThrow(team, result));
    },
    [resolveThrow],
  );

  /** Alur jawaban salah / waktu habis: tanpa lemparan — maskot terkejut,
   *  penjelasan tampil sebentar, lalu soal berikutnya. */
  const wrongFlow = useCallback(
    (team: TeamId) => {
      arenaRef.current?.react(team === "p1" ? 0 : 1, "confused");
      trackTimeout(() => {
        if (finishedRef.current) return;
        patchTeam(team, { reveal: true });
        trackTimeout(() => advanceTeam(team), 1750);
      }, 550);
    },
    [advanceTeam, patchTeam, trackTimeout],
  );

  const answer = useCallback(
    (team: TeamId, index: number) => {
      if (finishedRef.current || pausedRef.current || procRef.current[team]) return;
      const t = teamsRef.current[team];
      if (t.selected !== null) return;
      const q = questionOf(team);
      if (!q) return;
      const opts = optionsOf(team);
      const correct = index === opts.correctIndex;
      procRef.current[team] = true;
      sfx.play("pop");
      if (correct) {
        const nextStreak = t.streak + 1;
        patchTeam(team, {
          selected: index,
          answered: t.answered + 1,
          streak: nextStreak,
          best: Math.max(t.best, nextStreak),
          correct: t.correct + 1,
          phase: "aim",
          throwLeft: RULES.aimTime,
          throwResult: null,
        });
        const pujian = praiseFor(subjectRef.current);
        spawnFloat(pujian[nextStreak % pujian.length], "gold", floatX(team));
        startAim(team);
      } else {
        patchTeam(team, { selected: index, answered: t.answered + 1, streak: 0 });
        setDamageKey((k) => k + 1);
        spawnFloat("Ayo Coba Lagi!", "rose", floatX(team));
        wrongFlow(team);
      }
    },
    [optionsOf, patchTeam, questionOf, spawnFloat, startAim, wrongFlow],
  );

  const handleTimeout = useCallback(
    (team: TeamId) => {
      if (finishedRef.current || procRef.current[team]) return;
      const t = teamsRef.current[team];
      if (t.selected !== null) return;
      const opts = optionsOf(team);
      const wrongIdx = opts.correctIndex === 0 ? 1 : 0;
      procRef.current[team] = true;
      patchTeam(team, {
        selected: wrongIdx,
        timedOut: true,
        answered: t.answered + 1,
        streak: 0,
        timeLeft: 0,
      });
      spawnFloat("Waktu Habis!", "rose", floatX(team));
      wrongFlow(team);
    },
    [optionsOf, patchTeam, spawnFloat, wrongFlow],
  );

  // ---- hitung mundur ----
  useEffect(() => {
    if (screen !== "countdown") return;
    setCountdown(3);
    sfx.play("click");
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setScreen("playing");
          return 0;
        }
        sfx.play("tick");
        return c - 1;
      });
    }, 750);
    return () => clearInterval(iv);
  }, [screen]);

  // ---- siklus hidup arena canvas ----
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    const box = arenaBoxRef.current;
    if (!canvas || !box) return;

    const handle = createArena(canvas);
    arenaRef.current = handle;
    handle.setMascots(mascotsRef.current.p1, mascotsRef.current.p2);
    handle.setImpactHandler((outcome) => {
      if (outcome === "score") {
        sfx.play("swish");
        sfx.play("correct");
      } else {
        sfx.play("clank");
        sfx.play("wrong");
      }
    });

    // Ring, papan pantul, dan label tim kini digambar & dihitung renderer
    // sendiri di kanvas; Game cukup memberi tahu ukuran arena.
    const measure = () => {
      const rect = box.getBoundingClientRect();
      handle.resize(rect.width, rect.height);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 260);
    timeoutsRef.current.add(t);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
      timeoutsRef.current.delete(t);
      handle.dispose();
      arenaRef.current = null;
    };
  }, [screen]);

  // ---- timer per panel (250 ms) + mood arena ----
  useEffect(() => {
    if (screen !== "playing" || paused || winner) return;
    const iv = setInterval(() => {
      let tense = false;
      for (const team of TEAMS) {
        const t = teamsRef.current[team];
        if (t.selected === null && !procRef.current[team]) {
          if (t.timeLeft <= 5.25) tense = true;
          const next = t.timeLeft - 0.25;
          if (next <= 0) {
            handleTimeout(team);
          } else {
            patchTeam(team, { timeLeft: next });
          }
        }
      }
      arenaRef.current?.setMood(tense ? "tense" : "calm");
    }, 250);
    return () => clearInterval(iv);
  }, [handleTimeout, patchTeam, paused, screen, winner]);

  // ---- hitung mundur lemparan manual (Log 44): habis -> lemparan otomatis ----
  useEffect(() => {
    if (screen !== "playing" || paused || winner) return;
    const iv = setInterval(() => {
      for (const team of TEAMS) {
        const t = teamsRef.current[team];
        if (t.phase !== "aim") continue;
        const next = t.throwLeft - 0.25;
        if (next <= 0) {
          patchTeam(team, { phase: "thrown", throwLeft: 0 });
          arenaRef.current?.autoThrow(team === "p1" ? 0 : 1);
        } else {
          patchTeam(team, { throwLeft: next });
        }
      }
    }, 250);
    return () => clearInterval(iv);
  }, [patchTeam, paused, screen, winner]);

  // ---- timer pertandingan ----
  useEffect(() => {
    if (screen !== "playing" || paused || winner) return;
    const iv = setInterval(() => {
      matchLeftRef.current -= 1;
      setMatchLeft(matchLeftRef.current);
      if (matchLeftRef.current <= 0) {
        clearInterval(iv);
        finishByScore();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [finishByScore, paused, screen, winner]);

  // ---- keyboard: kiri 1–4, kanan 7–0, Esc jeda ----
  useEffect(() => {
    if (screen !== "playing") return;
    function onKey(e: KeyboardEvent) {
      if (exitAsk) return;
      if (e.key === "Escape") {
        setPaused((p) => !p);
        sfx.play("click");
        return;
      }
      if (paused) return;
      if (["1", "2", "3", "4"].includes(e.key)) answer("p1", Number(e.key) - 1);
      else if (["7", "8", "9", "0"].includes(e.key)) answer("p2", e.key === "0" ? 3 : Number(e.key) - 7);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, exitAsk, paused, screen]);

  // ===================== LAYAR =====================
  if (screen === "home") {
    return (
      <main className={`relative flex min-h-dvh items-center justify-center overflow-hidden ${PAGE_BG} px-4 py-6 text-emerald-950 sm:py-10`}>
        <AmbientBackground bright />
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Matikan suara dan musik" : "Nyalakan suara dan musik"}
          className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white/90 text-xl shadow-lg transition active:scale-95"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 grid w-full max-w-6xl items-stretch gap-4 lg:grid-cols-[1.05fr_1fr] lg:gap-8"
        >
          {/* ---------- Sisi pahlawan: judul + dua maskot saling berhadapan ---------- */}
          <section className={`${CARD} flex flex-col items-center justify-center p-6 text-center lg:p-10`}>
            <div className="animate-float-bob text-6xl lg:text-8xl">🏀</div>
            <h1 className="mt-2 text-4xl font-black leading-none tracking-tight sm:text-5xl lg:text-7xl">
              <span className="block text-sky-600 [text-shadow:0_4px_0_rgba(255,255,255,0.9)]">AI</span>
              <span className="block text-orange-500 [text-shadow:0_4px_0_rgba(255,255,255,0.9)]">BASKETBALL</span>
            </h1>
            <p className="mt-3 max-w-md text-sm font-bold text-emerald-950/65 sm:text-base">
              Duel 2 tim, satu layar. Jawab soal dari panelmu, lalu lempar bolanya sendiri ke ring timmu!
            </p>

            <div className="mt-6 flex items-center justify-center gap-3 sm:gap-6">
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-[2rem] border-4 border-white bg-gradient-to-b from-sky-300 to-blue-500 p-1.5 shadow-lg">
                  <MascotThumb id={mascots.p1} size={120} side="p1" square />
                </div>
                <span className="rounded-full bg-sky-600 px-3 py-0.5 text-xs font-black text-white">
                  {mascotName(mascots.p1)}
                </span>
              </div>
              <span className="rounded-full border-4 border-white bg-gradient-to-b from-amber-300 to-orange-400 px-3 py-1 text-xl font-black text-slate-900 shadow-lg sm:text-2xl">
                VS
              </span>
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-[2rem] border-4 border-white bg-gradient-to-b from-amber-300 to-orange-500 p-1.5 shadow-lg">
                  <MascotThumb id={mascots.p2} size={120} side="p2" square />
                </div>
                <span className="rounded-full bg-orange-600 px-3 py-0.5 text-xs font-black text-white">
                  {mascotName(mascots.p2)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <button type="button" onClick={() => setShowScore(true)} className={`${BTN_GHOST} px-5 py-2.5`}>
                🏅 Rekor: {bestScore(records)}
              </button>
              <Link href="/dashboard/games" className={`${BTN_GHOST} px-5 py-2.5`}>
                ← Lobby
              </Link>
            </div>
          </section>

          {/* ---------- Sisi pengaturan ---------- */}
          <section className={`${CARD} p-5 sm:p-7`}>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-950/55">
              1 · Pilih Mata Pelajaran
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSubject(s.id);
                    setStartWarn("");
                    sfx.play("click");
                  }}
                  className={`min-h-[4.25rem] px-2 py-3 text-sm ${
                    subject === s.id
                      ? `${BTN_GOLD} ring-4 ring-amber-300/60`
                      : BTN_GHOST
                  }`}
                >
                  <span className="block text-base">
                    {s.icon} {s.title}
                  </span>
                  <span className="block text-[11px] font-bold opacity-70">{activeList(s.id).length} soal</span>
                </button>
              ))}
            </div>

            {/* Mapel Guru — mapel kustom apa pun (Log 45) */}
            <div
              className={`mt-2 flex items-center gap-2 px-3 py-2.5 text-left ${
                subject === "guru"
                  ? `${BTN_GOLD} ring-4 ring-amber-300/60`
                  : BTN_GHOST
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSubject("guru");
                  setStartWarn("");
                  sfx.play("click");
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-black">
                  ✏️ {custom.name.trim() || "Mapel Guru (Kustom)"}
                </span>
                <span className="block text-[11px] font-bold opacity-70">
                  {custom.questions.length} soal · mapel apa pun, soal buatan guru
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScreen("bank")}
                className="shrink-0 rounded-xl border-b-4 border-emerald-950 bg-emerald-800 px-3 py-2 text-xs font-black text-white shadow transition active:translate-y-0.5 active:border-b-2"
              >
                Kelola Bank
              </button>
            </div>

            <p className="mb-2 mt-5 text-xs font-black uppercase tracking-widest text-emerald-950/55">
              2 · Pilih Maskot Tim
            </p>
            <div className="grid gap-3">
              {TEAMS.map((team) => (
                <div key={team}>
                  <p className="mb-1.5 text-left text-xs font-black text-emerald-950/65">
                    {team === "p1" ? "🔵 Tim Kiri" : "🟠 Tim Kanan"}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {MASCOT_LIST.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMascot(team, m.id)}
                        aria-pressed={mascots[team] === m.id}
                        className={`flex flex-col items-center gap-1 px-1 py-2 text-xs ${
                          mascots[team] === m.id
                            ? `${BTN_GOLD} ring-4 ring-amber-300/60`
                            : BTN_GHOST
                        }`}
                      >
                        <MascotThumb id={m.id} size={44} side={team} />
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (subject === "guru" && custom.questions.length < 2) {
                  setStartWarn("Bank Mapel Guru minimal berisi 2 soal. Klik “Kelola Bank” untuk mengisi nama mapel & soalnya.");
                  return;
                }
                setStartWarn("");
                sfx.resume();
                startRound(subject);
              }}
              className={`${BTN_SKY} mt-6 w-full px-6 py-4 text-lg sm:text-xl`}
            >
              🎮 Mulai Pertandingan
            </button>
            {startWarn ? (
              <p role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-100/80 px-3 py-2 text-xs font-bold text-rose-700">
                {startWarn}
              </p>
            ) : null}

          </section>
        </motion.div>

        <AnimatePresence>
          {showScore ? <ScoreSheet records={records} onClose={() => setShowScore(false)} /> : null}
        </AnimatePresence>
      </main>
    );
  }

  if (screen === "bank") {
    return (
      <BankScreen
        custom={custom}
        onCustomChange={updateCustom}
        overrides={overrides}
        onOverridesChange={updateOverrides}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "countdown") {
    return (
      <main className={`relative flex min-h-dvh items-center justify-center overflow-hidden ${PAGE_BG} text-emerald-950`}>
        <AmbientBackground bright />
        <div className="relative z-10 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={countdown}
              initial={{ scale: 2.4, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="text-[clamp(8rem,26vw,18rem)] font-black leading-none text-amber-400 [text-shadow:0_8px_0_rgba(255,255,255,0.9),0_0_60px_rgba(251,191,36,0.6)]"
            >
              {countdown > 0 ? countdown : "GO!"}
            </motion.div>
          </AnimatePresence>
          <p className="mt-2 inline-block rounded-full border-4 border-white bg-white/80 px-5 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-emerald-950/70 shadow-lg sm:text-base">
            {subjectLabel} · Siapkan tembakanmu
          </p>
        </div>
      </main>
    );
  }

  // ===================== TANDING =====================
  if (screen === "playing") {
    const mm = Math.floor(matchLeft / 60);
    const ss = String(Math.max(0, matchLeft % 60)).padStart(2, "0");
    return (
      <main className={`relative min-h-dvh overflow-x-hidden ${PAGE_BG} text-emerald-950 lg:h-dvh lg:overflow-hidden`}>
        <AnimatePresence>
          {damageKey > 0 && (
            <motion.div
              key={`dmg-${damageKey}`}
              className="pointer-events-none fixed inset-0 z-40 bg-red-500/20"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={shakeControls}
          className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[120rem] flex-col px-2 pb-3 sm:px-4 lg:h-full lg:min-h-0"
        >
          <header className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2 lg:mb-3 lg:gap-4 lg:pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExitAsk(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white text-lg font-black shadow transition active:translate-y-0.5 active:border-b-2"
                  aria-label="Keluar dari pertandingan"
                >
                  ←
                </button>
                <ScoreChip team="p1" score={teams.p1.score} streak={teams.p1.streak} mascot={mascots.p1} />
              </div>

              <div className="flex flex-col items-center rounded-2xl border-4 border-amber-400 bg-white px-3 py-1 shadow-[0_5px_0_rgba(217,119,6,0.35)] sm:px-6 lg:px-8">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 lg:text-xs">Sisa Waktu</span>
                <span
                  className={`text-2xl font-black leading-none tabular-nums lg:text-4xl ${
                    matchLeft <= 30 ? "animate-pulse text-rose-500" : "text-slate-900"
                  }`}
                >
                  {mm}:{ss}
                </span>
                <span className="mt-0.5 hidden max-w-[16rem] truncate text-[10px] font-bold text-emerald-950/55 sm:block lg:text-xs">
                  {subjectLabel} · target {RULES.targetScore}
                </span>
              </div>

              <div className="flex min-w-0 items-center justify-end gap-2">
                <ScoreChip team="p2" score={teams.p2.score} streak={teams.p2.streak} mascot={mascots.p2} />
                <button
                  type="button"
                  onClick={() => {
                    setPaused((p) => !p);
                    sfx.play("click");
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white text-base font-black shadow transition active:translate-y-0.5 active:border-b-2"
                  aria-label="Jeda"
                >
                  {paused ? "▶" : "❚❚"}
                </button>
              </div>
            </header>

          {/* ===== BADAN: panel soal KIRI - arena TENGAH - panel soal KANAN (perintah user 29 Okt 19:07: soal tetap kanan kiri, visual Claude dipertahankan) ===== */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            <div className="order-2 flex lg:order-1 lg:w-[27%] lg:max-w-[430px] lg:shrink-0 [&>*]:w-full">
            <TeamPanel
              team="p1"
              mascot={mascots.p1}
              play={teams.p1}
              question={questionOf("p1")}
              opts={optionsOf("p1")}
              paused={paused}
              onAnswer={(i) => answer("p1", i)}
            />
            </div>

            {/* Kotak luar = bingkai bergaris tepi. Kotak dalam (arenaBoxRef) tanpa
                garis tepi supaya ukuran yang diukur = ukuran kanvas sebenarnya. */}
            <div className="relative order-1 h-[38dvh] min-h-[260px] overflow-hidden rounded-[1.75rem] border-4 border-white bg-sky-200 shadow-[0_8px_0_rgba(2,132,199,0.25),inset_0_2px_18px_rgba(2,132,199,0.15)] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
              <div ref={arenaBoxRef} className="absolute inset-0">
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
              </div>

              {/* Floating text di atas arena */}
              <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                {floats.map((f) => (
                  <span
                    key={f.id}
                    className={`absolute top-[40%] animate-rise-fade whitespace-nowrap text-2xl font-black sm:text-3xl lg:text-5xl [text-shadow:0_3px_0_rgba(255,255,255,0.95),0_6px_14px_rgba(15,23,42,0.35)] ${
                      f.tone === "gold" ? "text-amber-500" : f.tone === "rose" ? "text-rose-500" : "text-sky-600"
                    }`}
                    style={{ left: `${f.x}%`, transform: "translateX(-50%)" }}
                  >
                    {f.text}
                  </span>
                ))}
              </div>

              <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-white/70 px-3 py-0.5 text-[11px] font-bold tracking-wide text-emerald-950/60 lg:block">
                Kiri tekan 1–4 · Kanan tekan 7–0 · Esc jeda
              </div>
            </div>
            <div className="order-3 flex lg:w-[27%] lg:max-w-[430px] lg:shrink-0 [&>*]:w-full">
            <TeamPanel
              team="p2"
              mascot={mascots.p2}
              play={teams.p2}
              question={questionOf("p2")}
              opts={optionsOf("p2")}
              paused={paused}
              onAnswer={(i) => answer("p2", i)}
            />
            </div>
          </div>
        </motion.div>

        {/* Dialog keluar */}
        <AnimatePresence>
          {exitAsk ? (
            <Overlay>
              <DialogCard>
                <div className="text-5xl">🚪</div>
                <h2 className="mt-2 text-2xl font-black">Yakin keluar?</h2>
                <p className="mt-1 text-sm font-bold text-emerald-950/60">Poin pertandingan ini tidak disimpan.</p>
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExitAsk(false);
                      sfx.play("click");
                    }}
                    className={`${BTN_SKY} px-5 py-3.5`}
                  >
                    Lanjut Main
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExitAsk(false);
                      finishedRef.current = true;
                      setScreen("home");
                    }}
                    className={`${BTN_GHOST} px-5 py-3 text-rose-600`}
                  >
                    Keluar
                  </button>
                </div>
              </DialogCard>
            </Overlay>
          ) : null}
        </AnimatePresence>

        {/* Menu jeda */}
        <AnimatePresence>
          {paused ? (
            <Overlay>
              <DialogCard>
                <div className="text-5xl">⏸️</div>
                <h2 className="mt-2 text-2xl font-black">Dijeda</h2>
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaused(false);
                      sfx.play("click");
                    }}
                    className={`${BTN_SKY} px-5 py-3.5`}
                  >
                    ▶ Lanjutkan
                  </button>
                  <button type="button" onClick={() => startRound(subject)} className={`${BTN_GHOST} px-5 py-3`}>
                    🔄 Ulangi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      finishedRef.current = true;
                      setScreen("home");
                    }}
                    className={`${BTN_GHOST} px-5 py-3`}
                  >
                    🏠 Ke Beranda
                  </button>
                </div>
              </DialogCard>
            </Overlay>
          ) : null}
        </AnimatePresence>
      </main>
    );
  }

  // ===================== HASIL =====================
  const wTeam: TeamId = winner === "p2" ? "p2" : "p1";
  const wt = teams[wTeam];
  const accW = wt.answered > 0 ? wt.correct / wt.answered : 0;
  const stars = starsForAccuracy(accW || (winner && winner !== "draw" ? 1 : 0));
  const bestCombo = Math.max(teams.p1.best, teams.p2.best);
  return (
    <main className={`relative flex min-h-dvh items-center justify-center overflow-hidden ${PAGE_BG} px-4 py-8 text-emerald-950`}>
      <AmbientBackground bright />
      <motion.div
        initial={{ scale: 0.85, y: 26, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
        className={`${CARD} relative z-10 w-full max-w-xl overflow-hidden p-6 text-center sm:p-9`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-300/40 blur-[80px]"
        />
        {winner === "draw" ? (
          <div className="relative text-7xl animate-float-bob">🤝</div>
        ) : (
          <div className="relative flex items-center justify-center gap-3">
            <span className="text-5xl animate-float-bob">🏆</span>
            <div className={`rounded-[2rem] border-4 border-white p-1.5 shadow-lg ${wTeam === "p1" ? "bg-gradient-to-b from-sky-300 to-blue-500" : "bg-gradient-to-b from-amber-300 to-orange-500"}`}>
              <MascotThumb id={mascots[wTeam]} size={112} side={wTeam} square />
            </div>
          </div>
        )}
        <h2 className="relative mt-3 text-3xl font-black sm:text-5xl">
          {winner === "draw" ? (
            "Seri!"
          ) : (
            <>
              <span className={wTeam === "p1" ? "text-sky-600" : "text-orange-500"}>{teamName(wTeam)}</span> Menang!
            </>
          )}
        </h2>
        <p className="relative mt-1 text-sm font-bold text-emerald-950/60 sm:text-base">
          {winner === "draw"
            ? "Sama kuat — tanding lagi untuk penentuan."
            : `${mascotName(mascots[wTeam])} tampil gemilang untuk ${teamName(wTeam).toLowerCase()}.`}
        </p>

        <div className="relative mt-4 flex items-center justify-center gap-1 text-4xl">
          {[1, 2, 3].map((s) => (
            <motion.span
              key={s}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3 + s * 0.15, type: "spring", stiffness: 300 }}
              className={stars >= s ? "text-glow-gold" : "opacity-20 grayscale"}
            >
              ⭐
            </motion.span>
          ))}
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Skor Kiri" value={teams.p1.score} tone="text-sky-600" />
          <Stat label="Skor Kanan" value={teams.p2.score} tone="text-orange-500" />
          <Stat label="Combo" value={`x${bestCombo}`} tone="text-rose-500" />
        </div>
        <p className="relative mt-3 text-sm font-bold text-emerald-950/60">
          🪙 Koin: <strong className="text-amber-600">+{Math.floor(wt.score / 100) + (winner !== "draw" ? 2 : 0)}</strong>
        </p>

        <div className="relative mt-6 grid gap-2">
          <button type="button" onClick={() => startRound(subject)} className={`${BTN_GOLD} px-5 py-4 text-lg`}>
            🔄 Main Lagi
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowScore(true);
                sfx.play("click");
              }}
              className={`${BTN_GHOST} px-5 py-3`}
            >
              🏅 Rekor
            </button>
            <Link href="/dashboard/games" className={`${BTN_GHOST} px-5 py-3`} onClick={() => sfx.play("click")}>
              🎮 Game Lain
            </Link>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showScore ? <ScoreSheet records={records} onClose={() => setShowScore(false)} /> : null}
      </AnimatePresence>
    </main>
  );
}

// ===================== Sub-komponen =====================

function ScoreChip({ team, score, streak, mascot }: { team: TeamId; score: number; streak: number; mascot: MascotId }) {
  const left = team === "p1";
  const pct = Math.max(0, Math.min(100, (score / RULES.targetScore) * 100));
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-2xl border-4 px-1.5 py-1 shadow-[0_4px_0_rgba(15,23,42,0.12)] sm:px-2.5 ${
        left ? "border-sky-500 bg-sky-100" : "flex-row-reverse border-amber-500 bg-amber-100"
      }`}
      aria-label={`Skor ${teamName(team)} ${score}`}
    >
      <MascotThumb id={mascot} size={36} side={team} />
      <div className={`min-w-[3.25rem] leading-none ${left ? "text-left" : "text-right"}`}>
        <p className="hidden truncate text-[10px] font-black uppercase tracking-wider opacity-70 sm:block">
          {teamName(team)} · {mascotName(mascot)}
        </p>
        <p className="text-2xl font-black tabular-nums lg:text-4xl">{score}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${left ? "bg-sky-500" : "bg-amber-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {streak >= 2 && <span className="hidden text-xs font-black text-orange-500 sm:inline">🔥x{streak}</span>}
    </div>
  );
}

function TeamPanel({
  team,
  mascot,
  play,
  question,
  opts,
  paused,
  onAnswer,
}: {
  team: TeamId;
  mascot: MascotId;
  play: TeamPlay;
  question: Q | undefined;
  opts: { options: string[]; correctIndex: number };
  paused: boolean;
  onAnswer: (index: number) => void;
}) {
  const left = team === "p1";
  const th = PANEL_THEME[team];
  const inAim = play.phase === "aim";
  const inFlight = play.phase === "thrown";
  const answered = play.selected !== null;
  const showFeedback = play.reveal && !!question && !inAim && !inFlight;
  const wasCorrect = answered && play.selected === opts.correctIndex && !play.timedOut;
  const urgent = inAim ? play.throwLeft <= 3 : !answered && play.timeLeft <= 5;
  const secs = inAim ? Math.ceil(play.throwLeft) : answered ? null : Math.ceil(play.timeLeft);
  const barPct = inAim
    ? Math.max(0, (play.throwLeft / RULES.aimTime) * 100)
    : answered
      ? 100
      : Math.max(0, (play.timeLeft / RULES.questionTime) * 100);

  const qArabic = !!question && hasArabic(question.prompt);
  const qLen = question?.prompt.length ?? 0;
  const qSize = qArabic
    ? qLen > 70
      ? "text-lg sm:text-xl lg:text-[length:clamp(1.2rem,2.6vh,1.9rem)]"
      : "text-xl sm:text-2xl lg:text-[length:clamp(1.4rem,3.2vh,2.4rem)]"
    : qLen > 90
      ? "text-sm sm:text-base lg:text-[length:clamp(1rem,2.1vh,1.5rem)]"
      : qLen > 55
        ? "text-base sm:text-lg lg:text-[length:clamp(1.1rem,2.5vh,1.8rem)]"
        : "text-lg sm:text-xl lg:text-[length:clamp(1.2rem,3vh,2.2rem)]";

  const stageKey = inAim ? "aim" : inFlight ? "fly" : showFeedback ? "fb" : `q-${question?.id ?? "none"}`;
  const stageTone = showFeedback
    ? wasCorrect || play.throwResult
      ? "bg-emerald-50 ring-emerald-300"
      : "bg-rose-50 ring-rose-300"
    : th.stage;

  const feedbackTitle = play.timedOut
    ? `Waktu Habis! Jawaban: ${opts.options[opts.correctIndex]}`
    : play.throwResult === "score"
      ? "Masuk! Lemparan +2 poin 🎉"
      : play.throwResult === "miss"
        ? "Meleset — tetap +1 poin karena jawaban benar"
        : play.selected === opts.correctIndex
          ? "Jawaban benar! 🎉"
          : `Belum tepat! Jawaban: ${opts.options[opts.correctIndex]}`;

  return (
    <section
      data-panel={team}
      className={`flex flex-col overflow-hidden rounded-[1.75rem] border-4 shadow-[0_6px_0_rgba(15,23,42,0.16)] ${th.frame} ${th.body}`}
    >
      {/* Kepala panel: tim + maskot + hitung waktu */}
      <div className={`flex items-center justify-between gap-2 px-3 py-2 text-white ${th.head}`}>
        <span className="flex min-w-0 items-center gap-2">
          <MascotThumb id={mascot} size={34} side={team} />
          <span className="min-w-0 truncate text-sm font-black tracking-wide lg:text-lg">
            {teamName(team)} · {mascotName(mascot)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-black lg:text-base">
          {play.streak >= 2 && <span className="rounded-full bg-white/25 px-2 py-0.5">🔥 x{play.streak}</span>}
          <span className="hidden rounded-full bg-black/20 px-2.5 py-0.5 tabular-nums min-[1700px]:inline">
            Soal {play.answered + (play.selected === null ? 1 : 0)} · ✓{play.correct}
          </span>
          {secs !== null && (
            <span
              className={`min-w-[3rem] rounded-full px-2.5 py-0.5 text-center tabular-nums ${
                urgent ? "animate-pulse bg-rose-500" : "bg-white/25"
              }`}
            >
              ⏱ {secs}
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 bg-slate-200">
        <div
          className={`h-full transition-all duration-200 ease-linear ${urgent ? "bg-rose-400" : th.bar}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex flex-col gap-2 p-2.5 sm:p-3 lg:gap-3">
        {/* Panggung: soal / petunjuk lempar / umpan balik — tinggi TETAP agar tata letak tidak melompat */}
        <div
          className={`flex h-[7.25rem] items-center justify-center overflow-y-auto rounded-2xl px-3 py-2 ring-2 sm:h-[7.75rem] lg:h-[clamp(6.5rem,15vh,10.5rem)] ${stageTone}`}
        >
          <motion.div
            key={stageKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="m-auto w-full text-center"
          >
            {inAim || inFlight ? (
              <>
                <p className="text-xl font-black leading-snug text-emerald-950 sm:text-2xl lg:text-[length:clamp(1.3rem,3vh,2.2rem)]">
                  {inAim ? "🎯 Giliran Melempar!" : "🏀 Bola Terbang..."}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-emerald-950/65 sm:text-sm lg:text-[length:clamp(0.85rem,1.9vh,1.2rem)]">
                  {inAim
                    ? `Tekan bola di tangan ${mascotName(mascot)}, geser untuk mengarahkan ke RING ${left ? "KIRI" : "KANAN"}, lalu lepaskan!`
                    : "Semoga masuk..."}
                </p>
              </>
            ) : showFeedback && question ? (
              <div role="status" aria-live="polite">
                <p className="text-base font-black leading-snug text-emerald-950 sm:text-lg lg:text-[length:clamp(1.1rem,2.5vh,1.8rem)]">
                  {feedbackTitle}
                </p>
                <p
                  className="mt-1 text-xs font-semibold leading-snug text-emerald-950/75 sm:text-sm lg:text-[length:clamp(0.85rem,1.9vh,1.2rem)]"
                  dir={hasArabic(question.explanation) ? "rtl" : "auto"}
                >
                  {question.explanation}
                </p>
              </div>
            ) : (
              <h2
                dir={qArabic ? "rtl" : "auto"}
                lang={qArabic ? "ar" : "id"}
                className={`${qSize} ${qArabic ? "font-arabic font-bold leading-relaxed" : "font-black leading-snug"} text-emerald-950`}
              >
                {question?.prompt ?? "Soal habis — bank kosong"}
              </h2>
            )}
          </motion.div>
        </div>

        {/* Pilihan jawaban: 2 kolom di panel lebar (HP), 1 kolom bertumpuk di panel samping sempit (lg) */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {opts.options.map((option, i) => {
            const chosen = play.selected === i;
            const isRight = answered && i === opts.correctIndex;
            const isWrongPick = answered && chosen && !isRight;
            const dim = answered && !isRight && !chosen;
            const arabic = hasArabic(option);
            const stateCls = isRight
              ? "border-emerald-700 bg-emerald-400 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
              : isWrongPick
                ? "border-rose-700 bg-rose-400 text-white"
                : dim
                  ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                  : `border-slate-200 border-b-slate-300 bg-white text-slate-800 ${th.hover}`;
            const badgeCls = isRight || isWrongPick ? "bg-white/30 text-white" : th.badge;
            return (
              <button
                key={`${question?.id ?? "q"}-${i}`}
                type="button"
                data-correct={i === opts.correctIndex ? "1" : "0"}
                disabled={answered || paused}
                onClick={() => onAnswer(i)}
                dir={arabic ? "rtl" : "auto"}
                lang={arabic ? "ar" : "id"}
                className={`flex min-h-[3.25rem] w-full items-center gap-2 rounded-2xl border-2 border-b-[5px] px-2 py-2 text-start font-bold transition active:translate-y-[2px] active:border-b-[3px] lg:min-h-[clamp(3.25rem,7.5vh,5rem)] lg:px-3 ${stateCls} ${
                  arabic
                    ? "font-arabic text-lg leading-relaxed lg:text-[length:clamp(1.2rem,2.8vh,2rem)]"
                    : "text-sm sm:text-base lg:text-[length:clamp(0.95rem,2.2vh,1.5rem)]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black lg:h-9 lg:w-9 lg:text-base ${badgeCls}`}
                >
                  {"ABCD"[i] ?? i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{option}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AmbientBackground({ bright = false }: { bright?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={`absolute -top-40 left-[-12%] h-[34rem] w-[34rem] rounded-full blur-[130px] animate-float-bob ${
          bright ? "bg-sky-400/30" : "bg-neon-sky/10"
        }`}
      />
      <div
        className={`absolute right-[-14%] top-1/3 h-[30rem] w-[30rem] rounded-full blur-[130px] animate-float-bob [animation-delay:1.4s] ${
          bright ? "bg-amber-400/30" : "bg-neon-purple/10"
        }`}
      />
      <div className={`absolute inset-0 grid-floor ${bright ? "opacity-40" : "opacity-70"}`} />
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  );
}

function DialogCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.9, y: 18 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.94, y: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="w-full max-w-sm rounded-[2rem] border-4 border-white bg-white p-6 text-center text-emerald-950 shadow-[0_10px_0_rgba(2,132,199,0.2),0_30px_60px_rgba(15,23,42,0.3)]"
    >
      {children}
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border-2 border-sky-900/5 bg-white/80 px-2 py-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-950/50">{label}</p>
      <p className={`text-2xl font-black tabular-nums sm:text-3xl ${tone}`}>{value}</p>
    </div>
  );
}

function ScoreSheet({ records, onClose }: { records: readonly ScoreRecord[]; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-[2rem] border-4 border-white bg-white p-6 text-emerald-950 shadow-[0_10px_0_rgba(2,132,199,0.2),0_30px_60px_rgba(15,23,42,0.3)]"
      >
        <h2 className="text-center text-xl font-black">🏅 Riwayat Skor</h2>
        {records.length === 0 ? (
          <p className="mt-4 text-center text-sm text-emerald-950/55">Belum ada rekor. Mulai main!</p>
        ) : (
          <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm">
            {records.map((r, i) => (
              <li
                key={`${r.at}-${i}`}
                className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2"
              >
                <span className="font-black text-amber-600 tabular-nums">{r.score}</span>
                <span className="text-xs text-emerald-950/55">
                  {r.correct}/{r.total} benar · x{r.bestStreak}
                </span>
                <span className="text-[10px] text-emerald-950/40">
                  {new Date(r.at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onClose} className={`${BTN_SKY} mt-4 w-full px-5 py-3`}>
          Tutup
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ================= BANK SOAL GURU (Log 45 + 46) =================
 * Semua bank bisa diubah guru dari layar ini: 4 mapel bawaan (tambah/
 * hapus soal, impor CSV, kembalikan ke bawaan) + Mapel Guru (nama
 * bebas + bank sendiri). Semua tersimpan lokal di perangkat ini. */
function BankScreen({
  custom,
  onCustomChange,
  overrides,
  onOverridesChange,
  onBack,
}: {
  custom: CustomBank;
  onCustomChange: (next: CustomBank) => void;
  overrides: BankOverrides;
  onOverridesChange: (next: BankOverrides) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<PlaySubject>("guru");
  const [prompt, setPrompt] = useState("");
  const [opts, setOpts] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [expl, setExpl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [msg, setMsg] = useState("");
  const [armClear, setArmClear] = useState(false);
  const [armReset, setArmReset] = useState(false);

  const isGuru = tab === "guru";
  const builtinId = isGuru ? null : (tab as SubjectId);
  const list: Q[] = isGuru
    ? custom.questions
    : (overrides[tab as SubjectId] ?? [...bankFor(tab as SubjectId)]);
  const isOverride = builtinId !== null && overrides[builtinId] !== undefined;

  const setList = (next: Q[]) => {
    if (isGuru) onCustomChange({ ...custom, questions: next });
    else onOverridesChange({ ...overrides, [tab]: next });
    setArmClear(false);
    setArmReset(false);
  };

  const pickTab = (next: PlaySubject) => {
    setTab(next);
    setMsg("");
    setArmClear(false);
    setArmReset(false);
  };

  const inputCls =
    "w-full rounded-xl border border-sky-900/10 bg-white/85 px-3 py-2 text-sm font-semibold text-emerald-950 shadow-sm outline-none backdrop-blur-md placeholder:text-emerald-950/35 focus:border-sky-400";

  const addQuestion = () => {
    if (!prompt.trim() || opts.some((o) => !o.trim())) {
      setMsg("Isi soal dan keempat pilihan dulu.");
      return;
    }
    const item = makeCustomQ(
      prompt.trim(),
      opts.map((o) => o.trim()) as [string, string, string, string],
      correct,
      expl.trim(),
      isGuru ? "arab" : (tab as SubjectId),
    );
    setList([...list, item]);
    setPrompt("");
    setOpts(["", "", "", ""]);
    setCorrect(0);
    setExpl("");
    setMsg("Soal ditambahkan.");
  };

  /** Impor teks: format dikenali otomatis — Markdown (ada "Jawaban:"
   *  atau judul ##) atau CSV (Soal;A;B;C;D;NomorBenar). */
  const importText = (text: string) => {
    if (!text.trim()) {
      setMsg("Tempel teks soal dulu, atau pilih berkas .md.");
      return;
    }
    const subj = isGuru ? "arab" : (tab as SubjectId);
    if (/(^|\n)\s*#{1,6}\s|jawaban\s*:/i.test(text)) {
      const hasil = parseMarkdownBank(text, subj);
      if (hasil.items.length === 0) {
        setMsg("Tidak ada soal Markdown yang terbaca. Ikuti format template: ## Soal, pilihan A-D, lalu baris Jawaban:.");
        return;
      }
      if (isGuru) {
        onCustomChange({
          name: hasil.name || custom.name,
          questions: [...custom.questions, ...hasil.items],
        });
        setArmClear(false);
        setArmReset(false);
      } else {
        setList([...list, ...hasil.items]);
      }
      setCsvText("");
      setMsg(
        `${hasil.items.length} soal ditambahkan dari Markdown${isGuru && hasil.name ? `, nama mapel "${hasil.name}" dipakai` : ""}${hasil.skipped > 0 ? `, ${hasil.skipped} blok dilewati (tidak lengkap)` : ""}.`,
      );
      return;
    }
    const { items, skipped } = parseCustomCsv(text, subj);
    if (items.length === 0) {
      setMsg("Tidak ada soal yang terbaca. Periksa formatnya: Soal;Opsi A;Opsi B;Opsi C;Opsi D;NomorBenar");
      return;
    }
    setList([...list, ...items]);
    setCsvText("");
    setMsg(`${items.length} soal ditambahkan dari CSV${skipped > 0 ? `, ${skipped} baris dilewati` : ""}.`);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const pickFile = (f: File | undefined) => {
    if (!f) return;
    void f.text().then((t) => importText(t));
  };

  // Petunjuk buka-tutup + salin prompt (Log 52, menggantikan unduh .md)
  const [showGuide, setShowGuide] = useState(false);
  const copyPrompt = () => {
    const teks = promptTemplateSoal();
    const sukses = () => setMsg("Prompt tersalin. Tempel ke asisten AI untuk membuatkan soal, hasilnya impor ke sini.");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(teks).then(sukses, () => setMsg("Gagal menyalin otomatis — buka petunjuk lalu salin teks promptnya manual."));
    } else {
      const ta = document.createElement("textarea");
      ta.value = teks;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        sukses();
      } catch {
        setMsg("Gagal menyalin otomatis — buka petunjuk lalu salin teks promptnya manual.");
      }
      ta.remove();
    }
  };

  const tabCls = (active: boolean) =>
    `rounded-xl px-3 py-2 text-[11px] font-black transition-all ${
      active
        ? "bg-gradient-to-r from-neon-gold to-orange-400 text-ink-950 shadow"
        : "border border-sky-900/10 bg-white/70 text-emerald-950/70 hover:bg-white"
    }`;

  return (
    <main className="relative min-h-dvh overflow-y-auto bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100 px-4 py-6 text-emerald-950">
      <AmbientBackground bright />
      <div className="relative z-10 mx-auto w-full max-w-2xl rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black">🏦 Bank Soal</h1>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-emerald-950/85 px-4 py-2 text-xs font-black text-white shadow transition active:scale-95"
          >
            ← Kembali
          </button>
        </div>
        <p className="mt-1 text-sm text-emerald-950/60">
          Semua bank soal bisa diubah di sini, termasuk 4 mapel bawaan. Perubahan tersimpan di perangkat ini.
        </p>

        <div className="mt-4">
          <LmsBankPicker
            onSelect={(choice) => {
              onCustomChange({
                name: choice.bankName,
                questions: choice.questions.map((q) => ({
                  id: q.id,
                  subject: "arab" as SubjectId,
                  prompt: q.prompt,
                  options: q.options,
                  correctIndex: q.correctIndex,
                  explanation: "",
                })),
              });
              setMsg(`Terpasang: ${choice.questions.length} soal dari bank LMS "${choice.bankName}" menjadi Mapel Guru.`);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Pilih bank soal">
          {SUBJECTS.map((s) => (
            <button key={s.id} type="button" onClick={() => pickTab(s.id)} className={tabCls(tab === s.id)}>
              {s.icon} {s.title} · {(overrides[s.id] ?? bankFor(s.id)).length}
            </button>
          ))}
          <button type="button" onClick={() => pickTab("guru")} className={tabCls(isGuru)}>
            ✏️ Mapel Guru · {custom.questions.length}
          </button>
        </div>

        {isGuru ? (
          <>
            <label className="mt-5 block text-[11px] font-bold uppercase tracking-widest text-emerald-950/50">
              Nama Mapel
            </label>
            <input
              value={custom.name}
              onChange={(e) => onCustomChange({ ...custom, name: e.target.value })}
              placeholder="cth: IPA Kelas 5"
              className={`${inputCls} mt-1`}
              maxLength={40}
            />
          </>
        ) : (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-900/5 bg-white/70 px-3 py-2.5">
            <p className="text-xs font-bold text-emerald-950/70">
              {isOverride
                ? "Bank ini versi editan guru. Soal bawaan asli tetap aman tersimpan di aplikasi."
                : "Ini bank bawaan asli. Menambah/menghapus soal akan membuat versi editan guru."}
            </p>
            {isOverride ? (
              <button
                type="button"
                onClick={() => {
                  if (!armReset) {
                    setArmReset(true);
                    setMsg("Ketuk sekali lagi untuk membuang editan dan kembali ke bank bawaan asli.");
                    return;
                  }
                  const next = { ...overrides };
                  delete next[builtinId as SubjectId];
                  onOverridesChange(next);
                  setArmReset(false);
                  setMsg("Bank dikembalikan ke bawaan asli.");
                }}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-black shadow transition active:scale-95 ${
                  armReset ? "bg-rose-500 text-white" : "bg-white text-sky-700 border border-sky-900/10"
                }`}
              >
                {armReset ? "Yakin? Buang Editan" : "↩️ Kembalikan ke Bawaan"}
              </button>
            ) : null}
          </div>
        )}

        <h2 className="mt-6 text-sm font-black">Tambah Soal</h2>
        <div className="mt-2 grid gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Tulis soalnya di sini..."
            rows={2}
            className={inputCls}
          />
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => {
                  const next = [...opts] as [string, string, string, string];
                  next[i] = e.target.value;
                  setOpts(next);
                }}
                placeholder={`Pilihan ${"ABCD"[i]}`}
                className={inputCls}
              />
              <label className="flex shrink-0 items-center gap-1 text-xs font-bold">
                <input
                  type="radio"
                  name="jawaban-benar"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Benar
              </label>
            </div>
          ))}
          <input
            value={expl}
            onChange={(e) => setExpl(e.target.value)}
            placeholder="Penjelasan (boleh kosong)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-2xl bg-gradient-to-r from-neon-gold to-orange-400 px-5 py-3 text-sm font-black text-ink-950 shadow transition active:scale-95"
          >
            + Tambah Soal
          </button>
        </div>

        <h2 className="mt-6 text-sm font-black">Impor Sekaligus (Markdown / CSV / Berkas)</h2>
        <p className="mt-1 text-xs text-emerald-950/55">
          Cara termudah: buka petunjuk di bawah, salin promptnya, minta AI membuatkan soal, lalu impor hasilnya di sini.
          Format dikenali otomatis. Markdown: <code className="font-bold">## Soal</code>, pertanyaan, pilihan{" "}
          <code className="font-bold">A. ...</code> s.d. <code className="font-bold">D. ...</code>, lalu{" "}
          <code className="font-bold">Jawaban: B</code>. CSV: satu soal per baris{" "}
          <code className="font-bold">Soal;Opsi A;Opsi B;Opsi C;Opsi D;NomorBenar (1-4)</code>.
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"Tempel soal Markdown atau CSV di sini...\n## Soal\nIbu kota Indonesia adalah...\nA. Bandung\nB. Jakarta\nC. Surabaya\nD. Medan\nJawaban: B"}
          rows={5}
          className={`${inputCls} mt-2 font-mono text-xs`}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="hidden"
          aria-label="Pilih berkas soal Markdown"
          onChange={(e) => {
            pickFile(e.target.files?.[0] ?? undefined);
            e.target.value = "";
          }}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => importText(csvText)}
            className="rounded-2xl border border-sky-900/10 bg-white/80 px-5 py-2.5 text-sm font-black shadow-sm transition active:scale-95"
          >
            ⬆️ Impor Teks
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl border border-sky-900/10 bg-white/80 px-5 py-2.5 text-sm font-black shadow-sm transition active:scale-95"
          >
            📄 Pilih Berkas .md
          </button>
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            aria-expanded={showGuide}
            className="rounded-2xl bg-gradient-to-r from-neon-sky to-neon-indigo px-5 py-2.5 text-sm font-black text-ink-950 shadow transition active:scale-95"
          >
            📋 Petunjuk & Prompt {showGuide ? "▴" : "▾"}
          </button>
        </div>

        {showGuide ? (
          <div className="mt-3 rounded-2xl border border-sky-900/10 bg-white/80 p-4 shadow-sm">
            <ol className="list-decimal space-y-1 pl-5 text-xs font-semibold text-emerald-950/75">
              <li>Klik <b>Salin Prompt</b> di bawah.</li>
              <li>Tempel prompt ke asisten AI (ChatGPT, Gemini, dll), isi mapel & topiknya, lalu kirim.</li>
              <li>AI membalas soal berformat Markdown. Salin hasilnya.</li>
              <li>Impor ke sini: tempel di kotak impor lalu klik <b>Impor Teks</b>, atau simpan sebagai berkas .md lalu klik <b>Pilih Berkas .md</b>.</li>
              <li>Bisa juga tanpa AI: tulis sendiri soal mengikuti pola format di dalam prompt.</li>
            </ol>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-emerald-950/[0.04] p-3 font-mono text-[11px] leading-relaxed text-emerald-950/80">
              {promptTemplateSoal()}
            </pre>
            <button
              type="button"
              onClick={copyPrompt}
              className="mt-3 rounded-2xl bg-gradient-to-r from-neon-gold to-orange-400 px-5 py-2.5 text-sm font-black text-ink-950 shadow transition active:scale-95"
            >
              📋 Salin Prompt
            </button>
          </div>
        ) : null}

        {msg ? (
          <p role="status" className="mt-3 rounded-xl border border-sky-300 bg-sky-100/80 px-3 py-2 text-xs font-bold text-sky-800">
            {msg}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-black">Soal Tersimpan ({list.length})</h2>
          {list.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (!armClear) {
                  setArmClear(true);
                  setMsg(
                    isGuru
                      ? "Ketuk sekali lagi untuk menghapus SEMUA soal Mapel Guru."
                      : "Ketuk sekali lagi untuk mengosongkan daftar ini. Saat bermain, mapel ini akan memakai bank bawaan asli.",
                  );
                  return;
                }
                setList([]);
                setMsg(isGuru ? "Semua soal Mapel Guru dihapus." : "Daftar dikosongkan — saat bermain dipakai bank bawaan asli.");
              }}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-black shadow transition active:scale-95 ${
                armClear ? "bg-rose-500 text-white" : "bg-white/80 text-rose-600"
              }`}
            >
              {armClear ? "Yakin? Hapus Semua" : "Hapus Semua"}
            </button>
          ) : null}
        </div>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-950/50">
            {isGuru
              ? "Belum ada soal. Tambahkan lewat formulir atau impor CSV di atas. Minimal 2 soal untuk mulai bermain."
              : "Daftar kosong. Saat bermain, mapel ini memakai bank bawaan asli."}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {list.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2 rounded-2xl border border-sky-900/5 bg-white/75 px-3 py-2 shadow-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{i + 1}. {q.prompt}</span>
                  <span className="block truncate text-xs text-emerald-950/55">Jawaban: {q.options[q.correctIndex]}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Hapus soal ${i + 1}`}
                  onClick={() => setList(list.filter((x) => x.id !== q.id))}
                  className="shrink-0 rounded-lg bg-rose-100 px-2 py-1 text-xs font-black text-rose-600 transition active:scale-95"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
