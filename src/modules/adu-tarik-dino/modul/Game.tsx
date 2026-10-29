"use client";

/**
 * SIGETTENG-GETTENG (Adu Tarik) — antarmuka.
 *
 * Desain ulang visual (poster kartun siang cerah, satu sistem dengan AI
 * Basketball): warna tim biru (kiri) & jingga (kanan), kontur tebal,
 * tombol 3D "chunky", tipografi berskala tinggi layar untuk TV/proyektor.
 * Layar lebar: arena penuh di atas, panel soal berjajar di bawahnya
 * (tiap panel di bawah timnya). HP: arena di atas, panel menggulir.
 * Logika permainan (tali, kekuatan, antrean soal, timer, skor) TIDAK
 * berubah dari versi sebelumnya.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LmsBankPicker } from "@/modules/game-bank/connector";
import { sfx } from "../lib-pendamping/sfx";
import { music } from "../lib-pendamping/music";
import { CHARACTERS, FRAME, SIDE_CHARS } from "./sprites";
import {
  RULES,
  SUBJECTS,
  type Bank,
  type GameMode,
  type Q,
  type Rec,
  type Settings,
  type SubjectId,
  clearScores,
  defaultBank,
  fmtTimer,
  loadBank,
  loadSettings,
  ls,
  makeQuestion,
  resetBank,
  saveBank,
  saveScore,
  saveSettings,
  shuffleArr,
} from "./logic";
import { runArena, type ArenaHandle, type ArenaView, type FloatEnt } from "./render";

type Screen = "home" | "mode" | "topic" | "countdown" | "playing" | "result" | "score" | "bank";
type Side = "p1" | "p2";
type EndReason = "win" | "time" | "quit" | null;

interface Slot {
  side: Side;
  idx: number;
  char: string;
  key: string;
}

const SLOTS: Record<GameMode, Slot[]> = {
  DUEL: [
    { side: "p1", idx: 0, char: "tarsius", key: "p1-0" },
    { side: "p2", idx: 0, char: "maleo", key: "p2-0" },
  ],
  SQUAD: [
    { side: "p1", idx: 0, char: "tarsius", key: "p1-0" },
    { side: "p1", idx: 1, char: "anoa", key: "p1-1" },
    { side: "p2", idx: 0, char: "maleo", key: "p2-0" },
    { side: "p2", idx: 1, char: "yaki", key: "p2-1" },
  ],
};

/** Tema panel per karakter. Tim kiri = keluarga biru (Tarsius langit, Anoa
 *  indigo); tim kanan = keluarga jingga (Maleo amber, Yaki oranye). */
const CHAR_THEME: Record<
  string,
  {
    label: string;
    emoji: string;
    side: string;
    frame: string;
    head: string;
    body: string;
    tint: string;
    badge: string;
    hover: string;
    ring: string;
  }
> = {
  tarsius: {
    label: "Tarsius",
    emoji: "🐒",
    side: "TIM KIRI",
    frame: "border-sky-500",
    head: "from-sky-500 to-blue-600",
    body: "from-sky-100 to-white",
    tint: "bg-sky-50 ring-sky-200",
    badge: "bg-sky-100 text-sky-700",
    hover: "hover:bg-sky-50 hover:border-sky-300",
    ring: "ring-sky-400/70",
  },
  anoa: {
    label: "Anoa",
    emoji: "🐃",
    side: "TIM KIRI",
    frame: "border-indigo-500",
    head: "from-indigo-500 to-blue-700",
    body: "from-indigo-100 to-white",
    tint: "bg-indigo-50 ring-indigo-200",
    badge: "bg-indigo-100 text-indigo-700",
    hover: "hover:bg-indigo-50 hover:border-indigo-300",
    ring: "ring-indigo-400/70",
  },
  maleo: {
    label: "Maleo",
    emoji: "🐦",
    side: "TIM KANAN",
    frame: "border-amber-500",
    head: "from-amber-500 to-orange-600",
    body: "from-amber-100 to-white",
    tint: "bg-amber-50 ring-amber-200",
    badge: "bg-amber-100 text-amber-700",
    hover: "hover:bg-amber-50 hover:border-amber-300",
    ring: "ring-amber-400/70",
  },
  yaki: {
    label: "Yaki",
    emoji: "🐵",
    side: "TIM KANAN",
    frame: "border-orange-500",
    head: "from-orange-500 to-red-600",
    body: "from-orange-100 to-white",
    tint: "bg-orange-50 ring-orange-200",
    badge: "bg-orange-100 text-orange-700",
    hover: "hover:bg-orange-50 hover:border-orange-300",
    ring: "ring-orange-400/70",
  },
};

/* ---------- Sistem gaya bersama ---------- */
const PAGE_BG = "bg-gradient-to-b from-sky-400 via-sky-200 to-amber-100";
const BTN_GOLD =
  "rounded-2xl border-b-4 border-orange-600 bg-gradient-to-b from-amber-300 to-orange-400 font-black text-slate-900 shadow-lg transition active:translate-y-0.5 active:border-b-2 select-none";
const BTN_SKY =
  "rounded-2xl border-b-4 border-blue-700 bg-gradient-to-b from-sky-400 to-blue-500 font-black text-white shadow-lg transition active:translate-y-0.5 active:border-b-2 select-none";
const BTN_GHOST =
  "rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white/90 font-black text-slate-800 shadow-sm transition hover:bg-white active:translate-y-0.5 active:border-b-2 select-none";
const BTN_DANGER =
  "rounded-2xl border-b-4 border-rose-800 bg-gradient-to-b from-rose-400 to-rose-600 font-black text-white shadow-lg transition active:translate-y-0.5 active:border-b-2 select-none";
const CARD =
  "rounded-[2rem] border-4 border-white/90 bg-white/75 text-slate-900 shadow-[0_10px_0_rgba(2,132,199,0.18),0_24px_60px_rgba(2,132,199,0.2)] backdrop-blur-xl";
const INPUT =
  "w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400";

/** Potret frame 0 (kiri-atas) dari lembar sprite karakter. */
function Portrait({ id, size = 40, round = true }: { id: string; size?: number; round?: boolean }) {
  const conf = CHARACTERS[id];
  if (!conf) return null;
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden bg-gradient-to-b from-sky-100 to-sky-200 ring-2 ring-white/80 ${
        round ? "rounded-full" : "rounded-3xl"
      }`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={conf.src} alt={conf.name} style={{ width: size * 2, height: size * 2, maxWidth: "none" }} />
    </span>
  );
}

const T = {
  id: {
    title: "ADU TARIK CERDAS",
    sub: "Arena tarik tambang pengetahuan — Bahasa Arab & Sains SMA",
    start: "MULAI BERMAIN",
    mode: "PILIH FORMAT TANDING",
    topic: "PILIH MATA PELAJARAN",
    time: "SISA WAKTU",
    again: "TANDING LAGI",
    home: "BERANDA",
    board: "PAPAN SKOR",
    bank: "BANK SOAL",
    empty: "Belum ada torehan juara tersimpan.",
    export: "Unduh CSV",
    clear: "Kosongkan",
    quit: "KELUAR",
    quitTitle: "Akhiri pertandingan?",
    quitBody: "Skor pertandingan ini tidak akan dicatat di papan skor.",
    quitYes: "Ya, akhiri",
    quitNo: "Lanjutkan",
    win: "MENANG",
    draw: "SERI",
    ended: "PERMAINAN DIAKHIRI",
    tap: "Ketuk jawaban benar di panelmu",
    shuffle: "Acak soal & pilihan",
    addQ: "Tambah soal",
    promptPh: "Tulis pertanyaan…",
    optPh: "Pilihan",
    save: "Simpan & Kembali",
    reset: "Kembalikan default",
  },
  en: {
    title: "SMART TUG OF WAR",
    sub: "Knowledge tug of war — Arabic & High School Science",
    start: "START PLAYING",
    mode: "CHOOSE MATCH FORMAT",
    topic: "CHOOSE SUBJECT",
    time: "TIME LEFT",
    again: "REMATCH",
    home: "HOME",
    board: "SCOREBOARD",
    bank: "QUESTION BANK",
    empty: "No champion records saved yet.",
    export: "Export CSV",
    clear: "Clear",
    quit: "QUIT",
    quitTitle: "End this match?",
    quitBody: "This match will not be recorded on the scoreboard.",
    quitYes: "Yes, end it",
    quitNo: "Keep playing",
    win: "WINS",
    draw: "DRAW",
    ended: "MATCH ENDED",
    tap: "Tap the correct answer on your panel",
    shuffle: "Shuffle questions & options",
    addQ: "Add question",
    promptPh: "Write the question…",
    optPh: "Option",
    save: "Save & Back",
    reset: "Restore defaults",
  },
} as const;

export default function AduTarikGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<ArenaHandle | null>(null);

  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [mode, setMode] = useState<GameMode>("DUEL");
  const [subject, setSubject] = useState<SubjectId>("arab");
  const [bank, setBank] = useState<Bank>(() => defaultBank());
  const [settings, setSettings] = useState<Settings>({ shuffleQuestions: true, shuffleOptions: true });
  const [records, setRecords] = useState<Rec[]>([]);
  const [muted, setMuted] = useState(false);
  // Musik latar orisinal (lib/music) mengalir selama pertandingan,
  // mengikuti saklar bisu yang sama dengan efek suara.
  useEffect(() => {
    if (!muted && (screen === "countdown" || screen === "playing" || screen === "result")) music.play("tug");
    else music.stop();
  }, [muted, screen]);
  useEffect(() => () => music.stop(), []);
  const [csvUrl, setCsvUrl] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(RULES.durationSec);
  const [winner, setWinner] = useState<"p1" | "p2" | "draw" | null>(null);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [flashSlot, setFlashSlot] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const [confirmQuit, setConfirmQuit] = useState(false);

  // editor soal
  const [editSubject, setEditSubject] = useState<SubjectId>("arab");
  const [newPrompt, setNewPrompt] = useState("");
  const [newOpts, setNewOpts] = useState<string[]>(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState("");

  const ropeRef = useRef(0);
  const scoreRef = useRef<Record<Side, number[]>>({ p1: [0, 0], p2: [0, 0] });
  const streakRef = useRef<Record<Side, number>>({ p1: 0, p2: 0 });
  const powerRef = useRef<Record<Side, number>>({ p1: RULES.powerStart, p2: RULES.powerStart });
  const floatersRef = useRef<FloatEnt[]>([]);
  const shownAtRef = useRef<Record<string, number>>({});
  const frameRef = useRef<Record<Side, number>>({ p1: 0, p2: 0 });
  // Log 34: cap waktu pose peristiwa terakhir per tim — dipakai manajer pose
  // untuk tahu kapan wajah boleh kembali mengikuti keadaan tanding.
  const frameAtRef = useRef<Record<Side, number>>({ p1: 0, p2: 0 });
  const shakeRef = useRef(0);
  const resultRef = useRef<"p1" | "p2" | "draw" | null>(null);
  const imgsRef = useRef<Record<string, HTMLImageElement>>({});
  const winnerRef = useRef<"p1" | "p2" | "draw" | null>(null);
  const queueRef = useRef<Record<string, Q[]>>({});
  const optRef = useRef<Map<string, string[]>>(new Map());
  const qiRef = useRef<Record<string, number>>({});
  // Log 35: siklus antrean per slot (untuk kunci urutan pilihan per putaran)
  // + daftar soal efektif pertandingan ini (untuk membangun ulang antrean).
  const cycleRef = useRef<Record<string, number>>({});
  const matchListRef = useRef<Q[]>([]);
  const timeLeftRef = useRef(RULES.durationSec);
  const bankRef = useRef<Bank>(bank);
  const slotsRef = useRef<Slot[]>(SLOTS[mode]);

  const t = T[lang];
  const slots = SLOTS[mode];
  slotsRef.current = slots;

  const teamScore = (side: Side) => scoreRef.current[side].reduce((a, b) => a + b, 0);
  const listOf = (sid: SubjectId) => bank[sid] ?? [];

  useEffect(() => {
    const b = loadBank();
    setBank(b);
    bankRef.current = b;
    setSettings(loadSettings());
    setRecords(ls());
    (Object.keys(CHARACTERS) as string[]).forEach((id) => {
      const img = new Image();
      img.src = CHARACTERS[id].src;
      img.onload = () => {
        imgsRef.current[id] = img;
      };
      img.onerror = () => {};
    });
  }, []);

  useEffect(() => {
    bankRef.current = bank;
  }, [bank]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // SFX diseragamkan ke lib/sfx Magguru Game (Penyegaran Tahap 2 lanjutan):
  // ok → correct, no → wrong, win → victory. Tombol bisu di beranda tetap
  // menjadi gerbangnya, sama seperti perilaku sebelumnya.
  const beep = useCallback(
    (kind: "ok" | "no" | "win") => {
      if (muted) return;
      sfx.resume();
      sfx.play(kind === "ok" ? "correct" : kind === "no" ? "wrong" : "victory");
    },
    [muted],
  );

  // Log 35 — perputaran soal dimatangkan. Cara lama: SETIAP panel menerima
  // seluruh bank yang diacak sendiri-sendiri, jadi soal yang sama bisa tampil
  // di dua panel pada saat bersamaan (peluangnya besar pada bank 7–9 soal),
  // dan sesudah bank habis urutan yang sama persis berulang selamanya.
  // Cara baru: SATU dek dibagikan bergiliran ke semua panel (antrean tiap
  // panel saling lepas — tidak ada soal kembar antar panel pada saat yang
  // sama); antrean yang habis dibangun ulang segar oleh rebuildQueue.
  const buildQueues = useCallback(
    (sid: SubjectId) => {
      const raw = bankRef.current[sid] ?? [];
      // bank mapel kosong (mis. semua soal dihapus guru) -> pakai bank bawaan
      const list = raw.length ? raw : (defaultBank()[sid] ?? []);
      matchListRef.current = list;
      const anySlots = SLOTS[mode];
      const n = anySlots.length;
      const deck = settings.shuffleQuestions ? shuffleArr(list) : [...list];
      const oMap = new Map<string, string[]>();
      anySlots.forEach((s, si) => {
        const mine =
          list.length >= n
            ? deck.filter((_, i) => i % n === si)
            : settings.shuffleQuestions
              ? shuffleArr(list)
              : [...list];
        queueRef.current[s.key] = mine;
        qiRef.current[s.key] = 0;
        cycleRef.current[s.key] = 0;
        mine.forEach((item) => {
          oMap.set(`${s.key}|0|${item.id}`, settings.shuffleOptions ? shuffleArr(item.options) : [...item.options]);
        });
      });
      optRef.current = oMap;
    },
    [mode, settings.shuffleOptions, settings.shuffleQuestions],
  );

  // Log 35: antrean satu panel habis -> susun putaran baru dari seluruh bank,
  // menyisihkan soal yang SEDANG tampil di panel lain dan soal yang baru saja
  // selesai di panel ini (bila kumpulan sisanya memungkinkan), lalu acak
  // ulang urutan pilihannya juga — putaran tidak pernah mengulang pola lama.
  const rebuildQueue = useCallback(
    (slotKey: string, justDoneId?: string) => {
      const all = matchListRef.current;
      if (!all.length) return;
      const shownElsewhere = new Set<string>();
      slotsRef.current.forEach((s) => {
        if (s.key === slotKey) return;
        const l = queueRef.current[s.key] ?? [];
        if (l.length) shownElsewhere.add(l[(qiRef.current[s.key] ?? 0) % l.length].id);
      });
      let pool = all.filter((x) => !shownElsewhere.has(x.id) && x.id !== justDoneId);
      if (!pool.length) pool = all.filter((x) => x.id !== justDoneId);
      if (!pool.length) pool = [...all];
      const next = settings.shuffleQuestions ? shuffleArr(pool) : pool;
      queueRef.current[slotKey] = next;
      qiRef.current[slotKey] = 0;
      const cyc = (cycleRef.current[slotKey] ?? 0) + 1;
      cycleRef.current[slotKey] = cyc;
      next.forEach((item) => {
        optRef.current.set(`${slotKey}|${cyc}|${item.id}`, settings.shuffleOptions ? shuffleArr(item.options) : [...item.options]);
      });
    },
    [settings.shuffleOptions, settings.shuffleQuestions],
  );

  const startMatch = useCallback(
    (sid: SubjectId) => {
      setSubject(sid);
      setWinner(null);
      setEndReason(null);
      winnerRef.current = null;
      resultRef.current = null;
      ropeRef.current = 0;
      scoreRef.current = { p1: [0, 0], p2: [0, 0] };
      streakRef.current = { p1: 0, p2: 0 };
      powerRef.current = { p1: RULES.powerStart, p2: RULES.powerStart };
      floatersRef.current = [];
      shownAtRef.current = {};
      frameRef.current = { p1: 0, p2: 0 };
      frameAtRef.current = { p1: 0, p2: 0 };
      shakeRef.current = 0;
      buildQueues(sid);
      setTick(0);
      timeLeftRef.current = RULES.durationSec;
      setTimeLeft(RULES.durationSec);
      setCount(3);
      setScreen("countdown");
    },
    [buildQueues],
  );

  useEffect(() => {
    if (screen !== "countdown") return;
    let n = 3;
    setCount(3);
    const id = window.setInterval(() => {
      n -= 1;
      if (n > 0) setCount(n);
      else {
        window.clearInterval(id);
        setScreen("playing");
      }
    }, 900);
    return () => window.clearInterval(id);
  }, [screen]);

  const finish = useCallback(
    (w: "p1" | "p2" | "draw", reason: EndReason, record = true) => {
      if (winnerRef.current) return;
      winnerRef.current = w === "draw" ? "draw" : w;
      resultRef.current = reason === "quit" ? null : w;
      setWinner(w);
      setEndReason(reason);
      if (record) {
        const rec: Rec = {
          id: `rec-${Date.now()}`,
          winnerName: w === "draw" ? "Seri" : w === "p1" ? "TIM KIRI (Tarsius · Anoa)" : "TIM KANAN (Maleo · Yaki)",
          mode,
          subject: SUBJECTS.find((s) => s.id === subject)?.title ?? subject,
          score: Math.max(teamScore("p1"), teamScore("p2")),
          timestamp: Date.now(),
        };
        saveScore(rec);
        setRecords(ls());
      }
      if (reason !== "quit" && w !== "draw") {
        beep("win");
        arenaRef.current?.emitConfetti();
      }
    },
    [beep, mode, subject],
  );

  // Log 35: penentuan pemenang saat waktu habis dipindah KELUAR dari updater
  // setState (updater harus murni — memanggil finish di dalamnya bisa
  // terpanggil ganda); jam kini digerakkan timeLeftRef.
  useEffect(() => {
    if (screen !== "playing" || winner) return;
    const id = window.setInterval(() => {
      if (timeLeftRef.current <= 1) {
        timeLeftRef.current = 0;
        setTimeLeft(0);
        window.clearInterval(id);
        const r = ropeRef.current;
        finish(r <= -1 ? "p1" : r >= 1 ? "p2" : "draw", "time");
        return;
      }
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, winner, finish]);

  // waktu tampil soal per slot: mulai saat pertandingan berjalan
  useEffect(() => {
    if (screen !== "playing") return;
    const now = performance.now();
    slotsRef.current.forEach((s) => {
      shownAtRef.current[s.key] = now;
    });
  }, [screen]);

  // tidak menjawab sampai waktu soal habis: kekuatan -1, soal slot itu berganti
  useEffect(() => {
    if (screen !== "playing" || winner) return;
    const id = window.setInterval(() => {
      if (winnerRef.current) return;
      const now = performance.now();
      let changed = false;
      slotsRef.current.forEach((slot) => {
        const shownAt = shownAtRef.current[slot.key];
        if (!shownAt) return;
        if (now - shownAt < RULES.questionTimeSec * 1000) return;
        powerRef.current[slot.side] = Math.max(RULES.powerMin, powerRef.current[slot.side] - RULES.powerTimeoutPenalty);
        floatersRef.current.push({
          side: slot.side,
          text: `-${RULES.powerTimeoutPenalty}`,
          tag: "TIDAK MENJAWAB",
          tone: "bad",
          bornAt: now,
        });
        streakRef.current[slot.side] = 0;
        frameRef.current[slot.side] = FRAME.shake;
        frameAtRef.current[slot.side] = now;
        const tList = queueRef.current[slot.key] ?? [];
        const tDone = tList.length ? tList[(qiRef.current[slot.key] ?? 0) % tList.length] : undefined;
        qiRef.current[slot.key] = (qiRef.current[slot.key] ?? 0) + 1;
        // Log 35: antrean panel ini habis -> putaran baru
        if ((qiRef.current[slot.key] ?? 0) >= tList.length) rebuildQueue(slot.key, tDone?.id);
        shownAtRef.current[slot.key] = now;
        changed = true;
      });
      if (changed) {
        beep("no");
        setTick((n) => n + 1);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [screen, winner, beep, rebuildQueue]);

  // Log 34 — manajer pose/ekspresi (perintah user 28 Okt 22:46: "kalau menang
  // ya bahagia, kalau kalah ya sebaliknya"). Pose peristiwa (hentakan sesudah
  // jawaban benar, goyah sesudah salah/timeout) tampil ±750 md; sesudah itu
  // wajah mengikuti keadaan tanding: tim yang tertinggal jauh (tali ≥40 poin
  // ke arah lawan) memakai pose MENARIK — wajah berjuang; tim unggul/seimbang
  // kembali SIAGA — tenang dan percaya diri. Saat hasil keluar: pemenang
  // SIAGA (wajah bahagia: senyum Tarsius, seringai Yaki) ditambah lompatan
  // kecil perayaan di renderer; yang kalah GOYAH (wajah terkejut/lesu)
  // ditambah warna diredupkan di renderer. Seri: dua-duanya SIAGA.
  useEffect(() => {
    if (screen !== "playing") return;
    const id = window.setInterval(() => {
      const now = performance.now();
      (["p1", "p2"] as Side[]).forEach((side) => {
        let f: number | null = null;
        const w = winnerRef.current;
        if (w) {
          f = w === "draw" || w === side ? FRAME.idle : FRAME.shake;
        } else if (now - frameAtRef.current[side] >= 750) {
          const fav = side === "p1" ? -ropeRef.current : ropeRef.current;
          f = fav <= -40 ? FRAME.pull : FRAME.idle;
        }
        if (f !== null && frameRef.current[side] !== f) frameRef.current[side] = f;
      });
    }, 150);
    return () => window.clearInterval(id);
  }, [screen]);

  // tombol Escape = keluar
  useEffect(() => {
    if (screen !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmQuit(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const questionOf = useCallback((slot: Slot): Q | undefined => {
    const list = queueRef.current[slot.key] ?? [];
    if (!list.length) return undefined;
    const i = (qiRef.current[slot.key] ?? 0) % list.length;
    return list[i];
  }, []);

  const answer = useCallback(
    (slot: Slot, opt: string) => {
      if (screen !== "playing" || winnerRef.current) return;
      const q = questionOf(slot);
      const right = !!q && opt === q.correct;
      if (right) {
        streakRef.current[slot.side] += 1;
        scoreRef.current[slot.side][slot.idx] += RULES.scorePerCorrect;
        qiRef.current[slot.key] = (qiRef.current[slot.key] ?? 0) + 1;
        // Log 35: antrean panel ini habis -> putaran baru (soal yang baru
        // dijawab tidak langsung muncul lagi)
        if ((qiRef.current[slot.key] ?? 0) >= (queueRef.current[slot.key] ?? []).length) {
          rebuildQueue(slot.key, q?.id);
        }
        // angka kekuatan ala defn: cepat +2, biasa +1; tarikan membesar mengikuti kekuatan
        const shownAt = shownAtRef.current[slot.key];
        const elapsed = shownAt ? (performance.now() - shownAt) / 1000 : 999;
        const fast = elapsed <= RULES.fastAnswerSec;
        const gain = fast ? RULES.powerFastBonus : RULES.powerNormalGain;
        powerRef.current[slot.side] = Math.min(RULES.powerMax, powerRef.current[slot.side] + gain);
        floatersRef.current.push({
          side: slot.side,
          text: `+${gain}`,
          tag: fast ? "BONUS CEPAT" : null,
          tone: "good",
          bornAt: performance.now(),
        });
        shownAtRef.current[slot.key] = performance.now();
        const dir = slot.side === "p1" ? -1 : 1;
        const pull = RULES.pullBase + powerRef.current[slot.side] * RULES.pullPerPower;
        ropeRef.current = Math.max(-RULES.maxOffset, Math.min(RULES.maxOffset, ropeRef.current + dir * pull));
        frameRef.current[slot.side] = FRAME.lunge;
        frameAtRef.current[slot.side] = performance.now();
        shakeRef.current = 4;
        beep("ok");
        arenaRef.current?.emitDust(slot.side, 1.2);
        setFlashSlot(slot.key);
        window.setTimeout(() => setFlashSlot(null), 260);
        if (Math.abs(ropeRef.current) >= RULES.winLimit) finish(ropeRef.current < 0 ? "p1" : "p2", "win");
      } else {
        streakRef.current[slot.side] = 0;
        frameRef.current[slot.side] = FRAME.shake;
        frameAtRef.current[slot.side] = performance.now();
        shakeRef.current = 2;
        beep("no");
        arenaRef.current?.emitDust(slot.side, 0.5);
      }
      setTick((n) => n + 1);
    },
    [beep, finish, questionOf, rebuildQueue, screen],
  );

  useEffect(() => {
    if (screen !== "playing" && screen !== "result") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const pair = mode === "SQUAD" ? 2 : 1;
    const view: ArenaView = {
      rope: ropeRef,
      frame: frameRef,
      shake: shakeRef,
      result: resultRef,
      mode,
      winLimit: RULES.winLimit,
      maxOffset: RULES.maxOffset,
      leftChars: [...SIDE_CHARS.left].slice(0, pair),
      rightChars: [...SIDE_CHARS.right].slice(0, pair),
      images: imgsRef,
      power: powerRef,
      floaters: floatersRef,
      active: true,
    };
    const handle = runArena(canvas, wrap, view);
    arenaRef.current = handle;
    return () => {
      view.active = false;
      handle.stop();
      arenaRef.current = null;
    };
  }, [screen, mode]);

  /* ---------------------------- bank soal ---------------------------- */

  const addQuestion = () => {
    const opts = newOpts.map((o) => o.trim()).filter(Boolean);
    if (!newPrompt.trim() || opts.length < 2) {
      setCsvMsg("Soal butuh pertanyaan + minimal 2 pilihan");
      return;
    }
    const correct = newCorrect.trim() && opts.includes(newCorrect.trim()) ? newCorrect.trim() : opts[0];
    const item = makeQuestion(editSubject, newPrompt, opts, correct);
    const next: Bank = { ...bank, [editSubject]: [...listOf(editSubject), item] };
    setBank(next);
    saveBank(next);
    setNewPrompt("");
    setNewOpts(["", "", "", ""]);
    setNewCorrect("");
    setCsvMsg(`Soal ditambahkan ke ${SUBJECTS.find((s) => s.id === editSubject)?.title}`);
  };

  const removeQuestion = (sid: SubjectId, id: string) => {
    const next: Bank = { ...bank, [sid]: listOf(sid).filter((x) => x.id !== id) };
    setBank(next);
    saveBank(next);
  };

  const restoreDefaults = (sid?: SubjectId) => {
    const next = resetBank(bank, sid);
    setBank(next);
    saveBank(next);
    setCsvMsg(sid ? "Mapel dikembalikan ke default" : "Semua bank dikembalikan ke default");
  };

  const downloadCsv = () => {
    const rows = ["Winner,Mode,Subject,Score,Timestamp"].concat(
      records.map((r) => [r.winnerName, r.mode, r.subject, r.score, new Date(r.timestamp).toISOString()].join(",")),
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "papan-skor-adu-tarik.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async () => {
    if (!csvUrl.trim()) {
      setCsvMsg("URL kosong");
      return;
    }
    setCsvMsg("Memuat...");
    try {
      const res = await fetch(csvUrl.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const head = rows[0].toLowerCase();
      if (!head.includes("question") || !head.includes("option") || !head.includes("correct")) {
        setCsvMsg("Header harus: Kategori, Question, options, Correct");
        return;
      }
      const next: Bank = { arab: [...bank.arab], matematika: [...bank.matematika], biologi: [...bank.biologi], fisika: [...bank.fisika], lms: [...bank.lms] };
      let added = 0;
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const prompt = cells[1] ?? "";
        const opts = (cells[2] ?? "").split("|").map((s) => s.trim()).filter(Boolean);
        const correct = cells[3] ?? "";
        if (!prompt || opts.length < 2 || !correct) continue;
        const cat = (cells[0] ?? "").toLowerCase();
        const sid: SubjectId = cat.includes("arab") ? "arab" : cat.includes("matem") ? "matematika" : cat.includes("bio") ? "biologi" : "fisika";
        next[sid].push(makeQuestion(sid, prompt, opts, opts.includes(correct) ? correct : opts[0]));
        added += 1;
      }
      if (!added) {
        setCsvMsg("Tidak ada baris valid");
        return;
      }
      setBank(next);
      saveBank(next);
      setCsvMsg(`Berhasil menambahkan ${added} soal`);
    } catch (e) {
      setCsvMsg(`Gagal: ${(e as Error).message}`);
    }
  };

  const modeLabel = mode === "SQUAD" ? "2 vs 2" : "1 vs 1";
  const compact = slots.length > 2;

  /** Kartu skor tim di HUD: potret karakter + skor besar + kekuatan. */
  const chip = (side: Side) => {
    const left = side === "p1";
    const ids = (left ? SIDE_CHARS.left : SIDE_CHARS.right).slice(0, mode === "SQUAD" ? 2 : 1);
    const streak = streakRef.current[side];
    return (
      <div
        className={`flex min-w-0 items-center gap-2 rounded-2xl border-4 px-1.5 py-1 text-slate-900 shadow-[0_4px_0_rgba(15,23,42,0.12)] sm:px-2.5 ${
          left ? "border-sky-500 bg-sky-100" : "flex-row-reverse border-amber-500 bg-amber-100"
        }`}
        aria-label={`Skor ${left ? "tim kiri" : "tim kanan"} ${teamScore(side)}`}
      >
        <span className="flex shrink-0 -space-x-2">
          {ids.map((id) => (
            <Portrait key={id} id={id} size={34} />
          ))}
        </span>
        <div className={`min-w-[2.5rem] leading-none ${left ? "text-left" : "text-right"}`}>
          <p className="hidden truncate text-[10px] font-black uppercase tracking-wider opacity-70 sm:block">
            {left ? "TIM KIRI" : "TIM KANAN"} · ⚡{powerRef.current[side]}
          </p>
          <p className="text-2xl font-black tabular-nums lg:text-4xl">{teamScore(side)}</p>
        </div>
        {streak >= 2 && <span className="hidden text-xs font-black text-orange-500 sm:inline">🔥x{streak}</span>}
      </div>
    );
  };

  const winnerIds = winner === "p1" ? SIDE_CHARS.left : winner === "p2" ? SIDE_CHARS.right : null;

  return (
    <div className={`h-dvh w-screen overflow-hidden ${PAGE_BG} text-slate-900`}>
      {/* ============================== HOME ============================== */}
      {screen === "home" && (
        <div className="relative h-full overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 opacity-25">
            {["🏆", "📚", "⚡", "🧬", "📐", "📖"].map((e, i) => (
              <span key={i} className="absolute text-5xl" style={{ left: `${8 + i * 15}%`, top: `${12 + (i % 3) * 26}%` }}>
                {e}
              </span>
            ))}
          </div>
          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <button onClick={() => setLang(lang === "id" ? "en" : "id")} className="h-12 w-12 rounded-full border-2 border-white bg-white/90 text-xs font-black text-slate-800 shadow-lg">
              {lang.toUpperCase()}
            </button>
            <button onClick={() => setMuted((m) => !m)} className="h-12 w-12 rounded-full border-2 border-white bg-white/90 text-xl shadow-lg">
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => setScreen("bank")} className="h-12 w-12 rounded-full border-2 border-white bg-white/90 text-xl shadow-lg" aria-label={t.bank}>
              ⚙️
            </button>
          </div>

          <div className="relative flex min-h-full items-center justify-center px-4 py-20">
            <div className={`${CARD} w-full max-w-4xl p-6 text-center sm:p-10`}>
              <span className="inline-block rounded-full bg-sky-600 px-4 py-1 text-xs font-black tracking-widest text-white">
                SMA · BAHASA ARAB · SAINS
              </span>
              <h1 className="mt-3 text-4xl font-black leading-none tracking-tight text-sky-700 [text-shadow:0_4px_0_rgba(255,255,255,0.95)] sm:text-6xl lg:text-7xl">
                {t.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm font-bold text-slate-600 sm:text-lg">{t.sub}</p>

              <div className="mt-6 flex items-center justify-center gap-2 sm:gap-5">
                <div className="flex rounded-[2rem] border-4 border-white bg-gradient-to-b from-sky-300 to-blue-500 p-1.5 shadow-lg">
                  {SIDE_CHARS.left.map((id) => (
                    <Portrait key={id} id={id} size={88} round={false} />
                  ))}
                </div>
                <span className="rounded-full border-4 border-white bg-gradient-to-b from-amber-300 to-orange-400 px-3 py-1 text-xl font-black text-slate-900 shadow-lg sm:text-2xl">
                  VS
                </span>
                <div className="flex rounded-[2rem] border-4 border-white bg-gradient-to-b from-amber-300 to-orange-500 p-1.5 shadow-lg">
                  {SIDE_CHARS.right.map((id) => (
                    <Portrait key={id} id={id} size={88} round={false} />
                  ))}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button onClick={() => setScreen("mode")} className={`${BTN_GOLD} px-8 py-4 text-xl sm:px-10 sm:text-2xl`}>
                  {t.start} →
                </button>
                <button
                  onClick={() => {
                    setRecords(ls());
                    setScreen("score");
                  }}
                  className={`${BTN_SKY} h-16 w-16 text-2xl`}
                  aria-label={t.board}
                >
                  🏆
                </button>
                <button onClick={() => setScreen("bank")} className={`${BTN_GHOST} h-16 w-16 text-2xl`} aria-label={t.bank}>
                  📝
                </button>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px] font-black">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">⏱ 3 menit</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">👥 DUEL 1v1 · SQUAD 2v2</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">🎯 {SUBJECTS.length} mapel</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">🔀 {settings.shuffleQuestions ? "acak aktif" : "acak mati"}</span>
              </div>

              <Link href="/dashboard/games" className={`${BTN_GHOST} mt-5 inline-block px-5 py-2.5 text-xs`}>
                🎮 Pilih Game Lain (Lobby Magguru)
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ============================== MODE ============================== */}
      {screen === "mode" && (
        <div className="h-full overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
            <h2 className="text-center text-3xl font-black text-sky-800 [text-shadow:0_3px_0_rgba(255,255,255,0.9)] sm:text-5xl">{t.mode}</h2>
            <p className="mb-8 mt-2 text-sm font-bold text-slate-600">Jumlah panel soal menyesuaikan jumlah pemain</p>
            <div className="flex flex-wrap justify-center gap-5">
              {[
                { m: "DUEL" as GameMode, label: "1 vs 1", sub: "2 panel soal", grad: "from-sky-400 to-blue-600", ids: ["tarsius", "maleo"] },
                { m: "SQUAD" as GameMode, label: "2 vs 2", sub: "4 panel soal", grad: "from-amber-400 to-orange-600", ids: ["tarsius", "anoa", "maleo", "yaki"] },
              ].map((o) => (
                <button
                  key={o.m}
                  onClick={() => {
                    setMode(o.m);
                    setCsvMsg(null);
                    setScreen("topic");
                  }}
                  className={`flex w-72 flex-col items-center rounded-[2rem] border-4 border-white bg-gradient-to-b ${o.grad} px-4 py-6 text-white shadow-[0_8px_0_rgba(15,23,42,0.2)] transition active:translate-y-1 active:shadow-[0_3px_0_rgba(15,23,42,0.2)]`}
                >
                  <span className="flex -space-x-3">
                    {o.ids.map((id) => (
                      <Portrait key={id} id={id} size={o.ids.length > 2 ? 54 : 70} />
                    ))}
                  </span>
                  <span className="mt-3 block text-3xl font-black">{o.m}</span>
                  <span className="text-sm font-bold opacity-90">({o.label})</span>
                  <span className="mt-2 block text-[11px] font-black uppercase tracking-widest opacity-85">{o.sub}</span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setScreen("bank")} className={`${BTN_GHOST} px-5 py-2.5 text-sm`}>
                📝 {t.bank}
              </button>
              <button onClick={() => setScreen("home")} className={`${BTN_GHOST} px-5 py-2.5 text-sm`}>
                ← {t.home}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== TOPIC ============================== */}
      {screen === "topic" && (
        <div className="h-full overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
            <h2 className="text-center text-3xl font-black text-sky-800 [text-shadow:0_3px_0_rgba(255,255,255,0.9)] sm:text-5xl">{t.topic}</h2>
            <p className="mb-7 mt-2 text-sm font-bold text-slate-600">
              {modeLabel} · {slots.length} panel soal · {listOf(subject).length} soal tersedia
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SUBJECTS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id === "lms" && listOf("lms").length === 0) {
                      setScreen("bank");
                      return;
                    }
                    startMatch(s.id);
                  }}
                  className={`flex h-36 w-36 flex-col items-center justify-center rounded-[2rem] border-4 border-white bg-gradient-to-b ${
                    ["from-sky-400 to-blue-600", "from-emerald-400 to-teal-600", "from-fuchsia-400 to-purple-600", "from-amber-400 to-orange-600"][i % 4]
                  } text-white shadow-[0_8px_0_rgba(15,23,42,0.2)] transition active:translate-y-1 active:shadow-[0_3px_0_rgba(15,23,42,0.2)] sm:h-40 sm:w-40`}
                >
                  <span className="text-4xl drop-shadow">{s.icon}</span>
                  <span className="mt-2 px-2 text-center text-sm font-black">{s.title}</span>
                  <span className="text-[11px] font-bold opacity-85">{listOf(s.id).length} soal</span>
                </button>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={() => setScreen("bank")} className={`${BTN_GHOST} px-4 py-2.5 text-sm`}>
                📝 {t.bank}
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))}
                className={`${BTN_GHOST} px-4 py-2.5 text-sm`}
              >
                🔀 {settings.shuffleQuestions ? "Acak: AKTIF" : "Acak: MATI"}
              </button>
              <button onClick={() => setScreen("mode")} className={`${BTN_GHOST} px-4 py-2.5 text-sm`}>
                ← {t.mode}
              </button>
            </div>
            {csvMsg && <p className="mt-4 rounded-full bg-white/85 px-4 py-1 text-xs font-black text-amber-700">{csvMsg}</p>}
          </div>
        </div>
      )}

      {/* ============================== COUNTDOWN ============================== */}
      {screen === "countdown" && (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="text-[clamp(8rem,26vw,18rem)] font-black leading-none text-amber-400 [text-shadow:0_8px_0_rgba(255,255,255,0.9),0_0_60px_rgba(251,191,36,0.6)]">
            {count}
          </span>
          <p className="mt-2 rounded-full border-4 border-white bg-white/80 px-5 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-slate-600 shadow-lg">
            {modeLabel} · {SUBJECTS.find((s) => s.id === subject)?.title}
          </p>
        </div>
      )}

      {/* ============================== PLAYING ============================== */}
      {(screen === "playing" || screen === "result") && (
        <div className="relative flex h-full flex-col px-2 pb-2 pt-2 sm:px-4 lg:pt-3">
          <header className="mb-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 lg:mb-3 lg:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setConfirmQuit(true)}
                className="flex h-11 shrink-0 items-center justify-center rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white px-3 text-sm font-black text-rose-600 shadow transition active:translate-y-0.5 active:border-b-2"
                aria-label={t.quit}
              >
                ⏹<span className="ml-1 hidden sm:inline">{t.quit}</span>
              </button>
              {chip("p1")}
            </div>

            <div className="flex flex-col items-center rounded-2xl border-4 border-amber-400 bg-white px-4 py-1 shadow-[0_5px_0_rgba(217,119,6,0.35)] sm:px-7 lg:px-10">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 lg:text-xs">{t.time}</span>
              <span
                data-timer
                className={`text-2xl font-black leading-none tabular-nums lg:text-4xl ${timeLeft <= 30 ? "animate-pulse text-rose-500" : "text-slate-900"}`}
              >
                {fmtTimer(timeLeft)}
              </span>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2">
              {chip("p2")}
              <span className="hidden h-11 shrink-0 items-center rounded-2xl border-2 border-b-4 border-sky-900/10 bg-white px-3 text-xs font-black text-slate-700 shadow sm:flex">
                {modeLabel}
              </span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-2 lg:gap-3">
            {/* Bingkai arena (bergaris tepi) membungkus kotak ukur tanpa garis tepi */}
            <div className="relative h-[34dvh] min-h-[200px] shrink-0 overflow-hidden rounded-[1.75rem] border-4 border-white bg-sky-200 shadow-[0_8px_0_rgba(2,132,199,0.25)] lg:h-auto lg:min-h-0 lg:flex-1">
              <div ref={wrapRef} className="absolute inset-0">
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
              </div>
              <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-white/75 px-3 py-0.5 text-[11px] font-bold text-slate-600 lg:block">
                {t.tap} · ESC = {t.quit.toLowerCase()}
              </div>
            </div>

            {/* Panel soal: tiap panel di bawah timnya (kiri → kanan) */}
            <div
              className={`grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto lg:flex-none lg:overflow-visible lg:gap-3 ${
                compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-2"
              }`}
              data-slots={slots.length}
            >
              {slots.map((slot) => {
                const q = questionOf(slot);
                const theme = CHAR_THEME[slot.char] ?? CHAR_THEME.tarsius;
                const opts = q ? (optRef.current.get(`${slot.key}|${cycleRef.current[slot.key] ?? 0}|${q.id}`) ?? q.options) : [];
                const flash = flashSlot === slot.key;
                const idx = (qiRef.current[slot.key] ?? 0) + 1;
                const total = (queueRef.current[slot.key] ?? []).length;
                const shownAt = shownAtRef.current[slot.key];
                const frac = shownAt ? Math.max(0, 1 - (performance.now() - shownAt) / (RULES.questionTimeSec * 1000)) : 1;
                const qSize = q?.isArabic
                  ? compact
                    ? "text-base sm:text-lg lg:text-[length:clamp(1.05rem,2.4vh,1.7rem)]"
                    : "text-xl sm:text-2xl lg:text-[length:clamp(1.4rem,3.2vh,2.4rem)]"
                  : compact
                    ? "text-sm sm:text-base lg:text-[length:clamp(0.95rem,2.1vh,1.45rem)]"
                    : "text-base sm:text-lg lg:text-[length:clamp(1.1rem,2.7vh,2rem)]";
                const oSize = compact
                  ? "text-xs sm:text-sm lg:text-[length:clamp(0.85rem,1.9vh,1.3rem)]"
                  : "text-sm sm:text-base lg:text-[length:clamp(0.95rem,2.3vh,1.6rem)]";
                return (
                  <div
                    key={slot.key}
                    data-panel={slot.key}
                    data-char={slot.char}
                    className={`flex flex-col overflow-hidden rounded-[1.5rem] border-4 bg-gradient-to-b shadow-[0_6px_0_rgba(15,23,42,0.16)] ${theme.frame} ${theme.body} ${
                      flash ? `ring-4 ${theme.ring}` : ""
                    }`}
                  >
                    <div className={`flex items-center justify-between gap-1 bg-gradient-to-r px-2.5 py-1.5 text-white ${theme.head}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Portrait id={slot.char} size={30} />
                        <span className="min-w-0 truncate text-xs font-black tracking-wide lg:text-sm">
                          {theme.label}
                          <span className="opacity-70"> · {theme.side}</span>
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-black tabular-nums">
                        {scoreRef.current[slot.side][slot.idx]} poin · {idx}/{total}
                      </span>
                    </div>

                    <div className="h-2.5 bg-slate-200" title="Sisa waktu soal ini">
                      <div
                        className={`h-full transition-all duration-1000 ease-linear ${frac > 0.35 ? "bg-emerald-400" : "bg-rose-400"}`}
                        style={{ width: `${Math.round(frac * 100)}%` }}
                      />
                    </div>

                    <div className="flex flex-col gap-2 p-2 lg:p-2.5">
                      <div
                        className={`flex h-[5.5rem] items-center justify-center overflow-y-auto overscroll-contain rounded-xl px-2.5 py-1.5 ring-2 sm:h-[6rem] lg:h-[clamp(5.25rem,13vh,9rem)] ${theme.tint}`}
                      >
                        <span
                          dir={q?.isArabic ? "rtl" : "ltr"}
                          className={`m-auto text-center font-black leading-snug text-slate-900 ${qSize} ${q?.isArabic ? "font-arabic leading-relaxed" : ""}`}
                        >
                          {q?.prompt ?? "Soal habis — bank kosong"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
                        {opts.map((opt, oi) => (
                          <button
                            key={opt}
                            data-correct={q?.correct === opt ? "1" : "0"}
                            onClick={() => answer(slot, opt)}
                            dir={q?.isArabic ? "rtl" : "ltr"}
                            className={`flex min-h-[3rem] items-center justify-center gap-1.5 rounded-xl border-2 border-b-[5px] border-slate-200 border-b-slate-300 bg-white px-1.5 py-1.5 text-center font-bold leading-tight text-slate-800 transition active:translate-y-[2px] active:border-b-[3px] lg:min-h-[clamp(3rem,7vh,4.75rem)] ${theme.hover} ${oSize}`}
                          >
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black lg:h-7 lg:w-7 lg:text-sm ${theme.badge}`}>
                              {"ABCD"[oi] ?? oi + 1}
                            </span>
                            <span className="min-w-0 break-words">{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Hasil: kartu di tengah layar ---- */}
          {winner && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-sky-950/35 p-4 backdrop-blur-[2px]">
              <div className={`${CARD} w-full max-w-lg p-6 text-center sm:p-8`}>
                <span
                  className={`inline-block rounded-full px-4 py-1 text-[11px] font-black tracking-[0.25em] text-white ${
                    endReason === "quit" || winner === "draw"
                      ? "bg-slate-500"
                      : winner === "p1"
                        ? "bg-gradient-to-r from-sky-500 to-blue-600"
                        : "bg-gradient-to-r from-amber-500 to-orange-600"
                  }`}
                >
                  {endReason === "quit" ? "STOP" : winner === "draw" ? "DRAW" : endReason === "time" ? "WAKTU HABIS" : "WINNER"}
                </span>
                {winnerIds && endReason !== "quit" && (
                  <div className="mt-3 flex justify-center">
                    <div
                      className={`flex rounded-[2rem] border-4 border-white p-1.5 shadow-lg ${
                        winner === "p1" ? "bg-gradient-to-b from-sky-300 to-blue-500" : "bg-gradient-to-b from-amber-300 to-orange-500"
                      }`}
                    >
                      {winnerIds.slice(0, mode === "SQUAD" ? 2 : 1).map((id) => (
                        <Portrait key={id} id={id} size={96} round={false} />
                      ))}
                    </div>
                  </div>
                )}
                <h3 className="mt-3 text-3xl font-black text-orange-500 [text-shadow:0_3px_0_rgba(255,255,255,0.95)] sm:text-4xl">
                  {endReason === "quit" ? t.ended : winner === "draw" ? t.draw : `${winner === "p1" ? "TIM KIRI" : "TIM KANAN"} ${t.win}`}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  TIM KIRI {teamScore("p1")} · TIM KANAN {teamScore("p2")} · {modeLabel}
                </p>
                <div className="mt-5 grid gap-2">
                  <button onClick={() => startMatch(subject)} className={`${BTN_GOLD} px-5 py-3.5 text-lg`}>
                    {t.again}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setWinner(null);
                        setEndReason(null);
                        winnerRef.current = null;
                        resultRef.current = null;
                        setScreen("topic");
                      }}
                      className={`${BTN_GHOST} px-3 py-2.5 text-sm`}
                    >
                      {t.topic}
                    </button>
                    <button
                      onClick={() => {
                        setWinner(null);
                        setEndReason(null);
                        winnerRef.current = null;
                        resultRef.current = null;
                        setScreen("home");
                      }}
                      className={`${BTN_GHOST} px-3 py-2.5 text-sm`}
                    >
                      {t.home}
                    </button>
                  </div>
                  <Link href="/dashboard/games" className={`${BTN_GHOST} px-3 py-2.5 text-sm`}>
                    🎮 Pilih Game Lain
                  </Link>
                </div>
              </div>
            </div>
          )}

          {confirmQuit && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
              <div className={`${CARD} w-full max-w-sm p-6 text-center`}>
                <span className="text-5xl">⏹</span>
                <h3 className="mt-2 text-2xl font-black text-rose-600">{t.quitTitle}</h3>
                <p className="mt-2 text-sm font-bold text-slate-600">{t.quitBody}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setConfirmQuit(false);
                      finish(ropeRef.current <= -1 ? "p1" : ropeRef.current >= 1 ? "p2" : "draw", "quit", false);
                    }}
                    className={`${BTN_DANGER} px-5 py-3 text-sm`}
                  >
                    {t.quitYes}
                  </button>
                  <button onClick={() => setConfirmQuit(false)} className={`${BTN_SKY} px-5 py-3 text-sm`}>
                    {t.quitNo}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================== SCORE ============================== */}
      {screen === "score" && (
        <div className="h-full overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`${CARD} w-full max-w-2xl p-6`}>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-black text-amber-600">🏆 {t.board}</h2>
              {records.length === 0 ? (
                <p className="py-8 text-center font-bold text-slate-500">{t.empty}</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-xl border-2 border-sky-100 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-sky-100 text-xs uppercase text-sky-800">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Pemenang</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2">Mapel</th>
                        <th className="p-2">Skor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id} className="border-t border-sky-50">
                          <td className="p-2 text-slate-400">{i + 1}</td>
                          <td className="p-2 font-bold">{r.winnerName}</td>
                          <td className="p-2">{r.mode}</td>
                          <td className="p-2">{r.subject}</td>
                          <td className="p-2 font-black text-amber-600">{r.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button onClick={downloadCsv} className={`${BTN_SKY} px-4 py-2.5 text-sm`}>
                  {t.export}
                </button>
                <button
                  onClick={() => {
                    clearScores();
                    setRecords([]);
                  }}
                  className={`${BTN_GHOST} px-4 py-2.5 text-sm text-rose-600`}
                >
                  {t.clear}
                </button>
                <button onClick={() => setScreen("home")} className={`${BTN_GHOST} px-4 py-2.5 text-sm`}>
                  {t.home}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================== BANK SOAL ============================== */}
      {screen === "bank" && (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-4 border-white/80 bg-white/70 px-4 py-3 backdrop-blur">
            <h2 className="text-lg font-black sm:text-xl">📝 {t.bank}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${settings.shuffleQuestions ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                🔀 Acak soal: {settings.shuffleQuestions ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, shuffleOptions: !s.shuffleOptions }))}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${settings.shuffleOptions ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                🎲 Acak pilihan: {settings.shuffleOptions ? "ON" : "OFF"}
              </button>
              <button onClick={() => setScreen("home")} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-black text-white">
                ← {t.home}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 px-4 py-3">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setEditSubject(s.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  editSubject === s.id ? "bg-amber-400 text-slate-900 shadow" : "border border-sky-900/10 bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                {s.icon} {s.title} ({listOf(s.id).length})
              </button>
            ))}
          </div>

          <div className="shrink-0 px-4 pb-3">
            <LmsBankPicker
              onSelect={(choice) => {
                const next: Bank = {
                  ...bank,
                  lms: choice.questions.map((q) =>
                    makeQuestion("lms", q.prompt, q.options, q.options[q.correctIndex] ?? ""),
                  ),
                };
                setBank(next);
                saveBank(next);
                setEditSubject("lms");
              }}
            />
          </div>

          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 pb-4 lg:grid-cols-2 lg:overflow-hidden">
            {/* daftar soal */}
            <div className="min-h-[16rem] overflow-auto rounded-2xl border-4 border-white bg-white/80 p-3 shadow lg:min-h-0">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">
                Daftar soal · {SUBJECTS.find((s) => s.id === editSubject)?.title}
              </h3>
              <div className="space-y-2">
                {listOf(editSubject).map((item, i) => (
                  <div key={item.id} className="rounded-xl border border-sky-100 bg-sky-50/70 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold leading-snug text-slate-800">
                        <span className="mr-1 text-slate-400">{i + 1}.</span>
                        {item.prompt}
                      </p>
                      <button onClick={() => removeQuestion(editSubject, item.id)} className="shrink-0 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-600">
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.options.map((o) => (
                        <span
                          key={o}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                            o === item.correct ? "bg-emerald-200 text-emerald-800" : "bg-white text-slate-600"
                          }`}
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {listOf(editSubject).length === 0 && <p className="py-6 text-center text-xs font-bold text-slate-400">Belum ada soal.</p>}
              </div>
            </div>

            {/* form tambah + impor */}
            <div className="min-h-0 space-y-3 overflow-auto rounded-2xl border-4 border-white bg-white/80 p-3 shadow">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{t.addQ}</h3>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder={t.promptPh}
                rows={2}
                className={INPUT}
              />
              <div className="grid grid-cols-2 gap-2">
                {newOpts.map((o, i) => (
                  <input
                    key={i}
                    value={o}
                    onChange={(e) => {
                      const next = [...newOpts];
                      next[i] = e.target.value;
                      setNewOpts(next);
                    }}
                    placeholder={`${t.optPh} ${"ABCD"[i]}`}
                    className={INPUT}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black text-slate-500">Jawaban benar:</span>
                <select
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800"
                >
                  <option value="">— pilih —</option>
                  {newOpts.filter((o) => o.trim()).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button onClick={addQuestion} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-white">
                  + {t.addQ}
                </button>
                <button onClick={() => restoreDefaults(editSubject)} className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700">
                  {t.reset}
                </button>
              </div>

              <hr className="border-sky-100" />
              <label className="block text-[11px] font-bold text-slate-500">Impor CSV (Kategori, Question, options, Correct · opsi dipisah |)</label>
              <input
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                className={INPUT}
              />
              <div className="flex gap-2">
                <button onClick={importCsv} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white">
                  Muat CSV
                </button>
                <button onClick={() => restoreDefaults()} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-600">
                  Reset semua
                </button>
              </div>
              {csvMsg && <p className="text-[11px] font-bold text-amber-700">{csvMsg}</p>}
              <p className="text-[11px] text-slate-400">
                Soal disimpan di perangkat ini (localStorage) dan hanya dipakai game Adu Tarik Dino.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
