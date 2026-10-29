"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sfx } from "../lib-pendamping/sfx";
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

/** Warna khusus tiap karakter: seluruh panel (soal + jawaban) memakai warna ini. */
const CHAR_THEME: Record<
  string,
  {
    label: string;
    emoji: string;
    side: string;
    panel: string;
    border: string;
    option: string;
    chip: string;
    text: string;
    ring: string;
  }
> = {
  tarsius: {
    label: "Tarsius",
    emoji: "🐒",
    side: "TIM KIRI",
    panel: "bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600",
    border: "border-sky-400",
    option: "bg-white/85 text-slate-900 hover:bg-white border-white/70 shadow-sm",
    chip: "bg-black/20 text-white",
    text: "text-white",
    ring: "ring-sky-400/60",
  },
  anoa: {
    label: "Anoa",
    emoji: "🐃",
    side: "TIM KIRI",
    panel: "bg-gradient-to-br from-violet-400 via-purple-500 to-purple-700",
    border: "border-violet-400",
    option: "bg-white/85 text-slate-900 hover:bg-white border-white/70 shadow-sm",
    chip: "bg-black/20 text-white",
    text: "text-white",
    ring: "ring-violet-400/60",
  },
  maleo: {
    label: "Maleo",
    emoji: "🐦",
    side: "TIM KANAN",
    panel: "bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600",
    border: "border-amber-400",
    option: "bg-white/85 text-slate-900 hover:bg-white border-white/70 shadow-sm",
    chip: "bg-black/20 text-white",
    text: "text-white",
    ring: "ring-amber-400/60",
  },
  yaki: {
    label: "Yaki",
    emoji: "🐵",
    side: "TIM KANAN",
    panel: "bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600",
    border: "border-rose-400",
    option: "bg-white/85 text-slate-900 hover:bg-white border-white/70 shadow-sm",
    chip: "bg-black/20 text-white",
    text: "text-white",
    ring: "ring-rose-400/60",
  },
};

const T = {
  id: {
    title: "SIGETTENG-GETTENG",
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
    title: "SIGETTENG-GETTENG",
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

export default function SigettengGettengGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<ArenaHandle | null>(null);

  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [mode, setMode] = useState<GameMode>("DUEL");
  const [subject, setSubject] = useState<SubjectId>("arab");
  const [bank, setBank] = useState<Bank>(() => defaultBank());
  const [settings, setSettings] = useState<Settings>({ shuffleQuestions: true, shuffleOptions: true });
  // Penanda nilai tersimpan sudah diterapkan; efek simpan di bawah menunggu
  // penanda ini agar state bawaan tidak menimpa preferensi tersimpan.
  const [settingsReady, setSettingsReady] = useState(false);
  const [records, setRecords] = useState<Rec[]>([]);
  const [muted, setMuted] = useState(false);
  const [csvUrl, setCsvUrl] = useState("");
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(RULES.durationSec);
  const [winner, setWinner] = useState<"p1" | "p2" | "draw" | null>(null);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [flashSlot, setFlashSlot] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [layout, setLayout] = useState<"side-lg" | "side-md" | "bottom">("bottom");
  const [vw, setVw] = useState(0);

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
    setSettingsReady(true);
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
    // Pada mount, efek ini berjalan pada commit yang sama dengan efek muat
    // tetapi masih membawa state bawaan; menyimpan di titik itu menimpa
    // nilai tersimpan. Simpan hanya sesudah nilai tersimpan diterapkan.
    if (!settingsReady) return;
    saveSettings(settings);
  }, [settings, settingsReady]);

  useEffect(() => {
    const sync = () => setVw(window.innerWidth);
    sync();
    if (window.innerWidth < 640) setLayout("bottom");
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

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
    a.download = "papan-skor-sigetteng-getteng.csv";
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
      const next: Bank = { arab: [...bank.arab], matematika: [...bank.matematika], biologi: [...bank.biologi], fisika: [...bank.fisika] };
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

  const btn = "rounded-2xl font-black shadow-lg active:scale-95 transition select-none";
  const modeLabel = mode === "SQUAD" ? "2 vs 2" : "1 vs 1";
  const isSide = layout !== "bottom" && vw >= 1024;
  const panelWrap =
    "grid shrink-0 gap-2 border-emerald-900/10 bg-white/50 p-2 backdrop-blur " +
    (isSide
      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:border-l lg:border-t-0 lg:p-3 " +
        (layout === "side-lg" ? "lg:w-[44%] lg:max-w-[660px] " : "lg:w-[34%] lg:max-w-[520px] ") +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-1")
      : "max-h-[52vh] overflow-y-auto border-t lg:max-h-[46vh] " +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"));

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-b from-sky-200 via-emerald-50 to-amber-50 text-white">
      {/* ============================== HOME ============================== */}
      {screen === "home" && (
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-400 px-6 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-25">
            {["🏆", "📚", "⚡", "🧬", "📐", "📖"].map((e, i) => (
              <span key={i} className="absolute text-5xl" style={{ left: `${8 + i * 15}%`, top: `${12 + (i % 3) * 26}%` }}>
                {e}
              </span>
            ))}
          </div>
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <button onClick={() => setLang(lang === "id" ? "en" : "id")} className="h-11 w-11 rounded-full bg-white/85 text-xs font-black text-slate-800 shadow">
              {lang.toUpperCase()}
            </button>
            <button onClick={() => setMuted((m) => !m)} className="h-11 w-11 rounded-full bg-white/85 text-lg shadow">
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => setScreen("bank")} className="h-11 w-11 rounded-full bg-white/85 text-lg shadow" aria-label={t.bank}>
              ⚙️
            </button>
          </div>

          <span className="mb-3 rounded-full bg-white/25 px-4 py-1 text-xs font-black tracking-widest backdrop-blur">SMA · BAHASA ARAB · SAINS</span>
          <h1 className="text-4xl font-black leading-none tracking-tight drop-shadow-lg sm:text-6xl">{t.title}</h1>
          <p className="mt-3 max-w-xl text-sm font-bold text-white/90 sm:text-lg">{t.sub}</p>

          <div className="mt-8 flex items-center gap-3">
            <button onClick={() => setScreen("mode")} className={`${btn} bg-gradient-to-r from-amber-300 to-orange-400 px-9 py-4 text-xl text-slate-950 sm:text-2xl`}>
              {t.start} →
            </button>
            <button
              onClick={() => {
                setRecords(ls());
                setScreen("score");
              }}
              className={`${btn} h-16 w-16 bg-gradient-to-br from-fuchsia-500 to-purple-700 text-2xl`}
              aria-label={t.board}
            >
              🏆
            </button>
            <button onClick={() => setScreen("bank")} className={`${btn} h-16 w-16 bg-gradient-to-br from-teal-500 to-emerald-700 text-2xl`} aria-label={t.bank}>
              📝
            </button>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-black/25 px-3 py-1">⏱ 3 menit</span>
            <span className="rounded-full bg-black/25 px-3 py-1">👥 DUEL 1v1 · SQUAD 2v2</span>
            <span className="rounded-full bg-black/25 px-3 py-1">🎯 {SUBJECTS.length} mapel</span>
            <span className="rounded-full bg-black/25 px-3 py-1">🔀 {settings.shuffleQuestions ? "acak aktif" : "acak mati"}</span>
          </div>

          <Link
            href="/"
            className="relative z-10 mt-5 rounded-full bg-black/30 px-5 py-2 text-xs font-black text-white ring-1 ring-white/40 transition hover:bg-black/45"
          >
            🎮 Pilih Game Lain (Lobby Magguru)
          </Link>
        </div>
      )}

      {/* ============================== MODE ============================== */}
      {screen === "mode" && (
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-emerald-600 to-teal-800 px-6">
          <h2 className="mb-2 text-2xl font-black sm:text-4xl">{t.mode}</h2>
          <p className="mb-8 text-sm text-emerald-100">Jumlah panel soal menyesuaikan jumlah pemain</p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { m: "DUEL" as GameMode, label: "1 vs 1", sub: "2 panel soal", grad: "from-cyan-500 to-blue-700" },
              { m: "SQUAD" as GameMode, label: "2 vs 2", sub: "4 panel soal", grad: "from-amber-400 to-orange-600" },
            ].map((o) => (
              <button
                key={o.m}
                onClick={() => {
                  setMode(o.m);
                  setCsvMsg(null);
                  setScreen("topic");
                }}
                className={`h-44 w-56 rounded-3xl bg-gradient-to-br ${o.grad} ring-4 ring-white/30 text-white shadow-2xl transition active:scale-95`}
              >
                <span className="block text-3xl font-black">{o.m}</span>
                <span className="text-sm font-bold opacity-90">({o.label})</span>
                <span className="mt-2 block text-[11px] font-bold uppercase tracking-widest opacity-80">{o.sub}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <button onClick={() => setScreen("bank")} className="rounded-xl bg-white/20 px-5 py-2 font-bold">
              📝 {t.bank}
            </button>
            <button onClick={() => setScreen("home")} className="rounded-xl bg-black/30 px-5 py-2 font-bold">
              ← {t.home}
            </button>
          </div>
        </div>
      )}

      {/* ============================== TOPIC ============================== */}
      {screen === "topic" && (
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-indigo-700 to-violet-900 px-6">
          <h2 className="mb-1 text-2xl font-black sm:text-4xl">{t.topic}</h2>
          <p className="mb-7 text-sm text-indigo-200">
            {modeLabel} · {slots.length} panel soal · {listOf(subject).length} soal tersedia
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SUBJECTS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => startMatch(s.id)}
                className={`flex h-36 w-36 flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${
                  ["from-sky-400 to-blue-700", "from-emerald-400 to-teal-700", "from-fuchsia-400 to-purple-700", "from-amber-300 to-orange-600"][i % 4]
                } text-white shadow-xl ring-2 ring-white/25 transition active:scale-95`}
              >
                <span className="text-4xl drop-shadow">{s.icon}</span>
                <span className="mt-2 px-2 text-center text-sm font-black">{s.title}</span>
                <span className="text-[10px] font-bold opacity-80">{listOf(s.id).length} soal</span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => setScreen("bank")} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold">
              📝 {t.bank}
            </button>
            <button onClick={() => setSettings((s) => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))} className="rounded-xl bg-white/20 px-4 py-2 text-sm font-bold">
              🔀 {settings.shuffleQuestions ? "Acak: AKTIF" : "Acak: MATI"}
            </button>
            <button onClick={() => setScreen("mode")} className="rounded-xl bg-black/30 px-4 py-2 text-sm font-bold">
              ← {t.mode}
            </button>
          </div>
          {csvMsg && <p className="mt-4 text-xs font-bold text-amber-200">{csvMsg}</p>}
        </div>
      )}

      {/* ============================== COUNTDOWN ============================== */}
      {screen === "countdown" && (
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-sky-300 to-amber-100">
          <span className="text-[9rem] font-black leading-none text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,.45)]">{count}</span>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-slate-600">
            {modeLabel} · {SUBJECTS.find((s) => s.id === subject)?.title}
          </p>
        </div>
      )}

      {/* ============================== PLAYING ============================== */}
      {(screen === "playing" || screen === "result") && (
        <div className="flex h-full flex-col">
          <header className="grid shrink-0 grid-cols-3 items-center gap-2 border-b border-emerald-900/10 bg-white/70 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmQuit(true)} className={`${btn} h-9 rounded-full bg-rose-600 px-3 text-[11px]`}>
                ⏹ {t.quit}
              </button>
              <div className="hidden items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-slate-900 shadow-sm ring-1 ring-cyan-500/40 sm:flex">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-sm font-black tabular-nums">{teamScore("p1")}</span>
                {streakRef.current.p1 >= 2 && (
                  <span className="text-[10px] font-black text-orange-500">🔥x{streakRef.current.p1}</span>
                )}
                <span className="text-[10px] font-black text-sky-700">⚡{powerRef.current.p1}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="relative flex flex-col items-center rounded-2xl bg-white/85 px-5 py-1 shadow ring-1 ring-amber-500/50">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">{t.time}</span>
                <span data-timer className="text-2xl font-black leading-none text-slate-900 tabular-nums sm:text-3xl">
                  {fmtTimer(timeLeft)}
                </span>
                <span className="absolute -bottom-1 h-1 w-10 rounded-full bg-gradient-to-r from-amber-300 to-orange-500" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <div className="hidden items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-slate-900 shadow-sm ring-1 ring-amber-500/40 sm:flex">
                <span className="text-[10px] font-black text-amber-700">⚡{powerRef.current.p2}</span>
                {streakRef.current.p2 >= 2 && (
                  <span className="text-[10px] font-black text-orange-500">🔥x{streakRef.current.p2}</span>
                )}
                <span className="text-sm font-black tabular-nums">{teamScore("p2")}</span>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
              </div>
              <button
                onClick={() =>
                  setLayout((l) => (l === "side-lg" ? "side-md" : l === "side-md" ? "bottom" : "side-lg"))
                }
                className="hidden rounded-full bg-white/85 px-2 py-1 text-[10px] font-black text-slate-800 shadow-sm lg:block"
                title="Ganti tata letak: panel lebar / panel sedang / panel di bawah"
              >
                {layout === "side-lg" ? "⇔ PANEL SEDANG" : layout === "side-md" ? "⇩ PANEL BAWAH" : "⇔ PANEL LEBAR"}
              </button>
              <span className="rounded-full bg-white/85 px-2 py-1 text-[10px] font-black text-slate-700 shadow-sm">{modeLabel}</span>
            </div>
          </header>

          <div className={`flex min-h-0 flex-1 flex-col ${isSide ? "lg:flex-row" : ""}`}>
          <div ref={wrapRef} className="relative min-h-0 flex-1 bg-gradient-to-b from-sky-200 to-emerald-100">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

            {winner && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1 bg-gradient-to-b from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-10 pt-3 text-center">
                  <div
                    className={`rounded-full bg-gradient-to-r px-4 py-0.5 text-[10px] font-black tracking-[0.25em] ${
                      endReason === "quit" ? "from-slate-500 to-slate-700" : winner === "p1" ? "from-cyan-400 to-blue-600" : winner === "p2" ? "from-amber-400 to-orange-600" : "from-slate-500 to-slate-700"
                    }`}
                  >
                    {endReason === "quit" ? "STOP" : winner === "draw" ? "DRAW" : endReason === "time" ? "WAKTU HABIS" : "WINNER"}
                  </div>
                  <h3 className="text-2xl font-black text-amber-300 drop-shadow sm:text-4xl">
                    {endReason === "quit"
                      ? t.ended
                      : winner === "draw"
                        ? t.draw
                        : `${winner === "p1" ? "TIM KIRI" : "TIM KANAN"} ${t.win}`}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-300">
                    TIM KIRI {teamScore("p1")} · TIM KANAN {teamScore("p2")} · {modeLabel}
                  </p>
                </div>
                <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-2 pt-10">
                  <button onClick={() => startMatch(subject)} className={`${btn} bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-2 text-base text-slate-950`}>
                    {t.again}
                  </button>
                  <button
                    onClick={() => {
                      setWinner(null);
                      setEndReason(null);
                      winnerRef.current = null;
                      resultRef.current = null;
                      setScreen("topic");
                    }}
                    className={`${btn} bg-slate-700 px-5 py-2 text-base`}
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
                    className={`${btn} bg-slate-700 px-5 py-2 text-base`}
                  >
                    {t.home}
                  </button>
                  <Link href="/" className={`${btn} bg-slate-700 px-5 py-2 text-base`}>
                    🎮 Pilih Game Lain
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className={panelWrap} data-slots={slots.length} data-layout={layout}>
            {slots.map((slot) => {
              const q = questionOf(slot);
              const theme = CHAR_THEME[slot.char] ?? CHAR_THEME.tarsius;
              const opts = q ? (optRef.current.get(`${slot.key}|${cycleRef.current[slot.key] ?? 0}|${q.id}`) ?? q.options) : [];
              const flash = flashSlot === slot.key;
              const idx = (qiRef.current[slot.key] ?? 0) + 1;
              const total = (queueRef.current[slot.key] ?? []).length;
              return (
                <div
                  key={slot.key}
                  data-panel={slot.key}
                  data-char={slot.char}
                  className={`overflow-y-auto rounded-2xl border-2 ${theme.border} ${theme.panel} ${isSide ? "p-2.5" : "p-2"} ${flash ? `ring-4 ${theme.ring}` : ""}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${theme.chip}`}>
                      <span>{theme.emoji}</span>
                      {theme.label}
                      <span className="opacity-60">· {theme.side}</span>
                    </span>
                    <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-black tabular-nums">
                      {scoreRef.current[slot.side][slot.idx]} poin · {idx}/{total}
                    </span>
                  </div>

                  <div className={`mb-1.5 overflow-y-auto overscroll-contain rounded-xl bg-black/30 ring-1 ${theme.ring} ${isSide ? "max-h-[112px]" : "max-h-[88px]"}`}>
                    <div className={`flex flex-col justify-center px-2 py-1.5 ${isSide ? "min-h-[58px]" : "min-h-[46px]"}`}>
                    <span dir={q?.isArabic ? "rtl" : "ltr"} className={`text-center font-bold leading-snug text-white ${
                        q?.isArabic
                          ? isSide
                            ? "text-[14px] sm:text-[15px]"
                            : "text-[12px] sm:text-[14px]"
                          : isSide
                            ? "text-[12px] sm:text-[13px]"
                            : "text-[11px] sm:text-[12px]"
                      }`}>
                      {q?.prompt ?? "Soal habis — bank kosong"}
                    </span>
                    </div>
                  </div>

                  {(() => {
                    const shownAt = shownAtRef.current[slot.key];
                    const frac = shownAt ? Math.max(0, 1 - (performance.now() - shownAt) / (RULES.questionTimeSec * 1000)) : 1;
                    return (
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-black/30" title="Sisa waktu soal ini">
                        <div
                          className={`h-full rounded-full ${frac > 0.35 ? "bg-emerald-300" : "bg-red-400"}`}
                          style={{ width: `${Math.round(frac * 100)}%` }}
                        />
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-1.5">
                    {opts.map((opt, oi) => (
                      <button
                        key={opt}
                        data-correct={q?.correct === opt ? "1" : "0"}
                        onClick={() => answer(slot, opt)}
                        dir={q?.isArabic ? "rtl" : "ltr"}
                        className={`flex items-center justify-center gap-1 rounded-lg border ${theme.option} text-center font-bold leading-tight shadow active:scale-95 ${
                          isSide
                            ? "min-h-[42px] px-1.5 py-1 text-[11px] sm:min-h-[46px] sm:text-[12px]"
                            : "min-h-[36px] px-1.5 py-1 text-[10px] sm:min-h-[40px] sm:text-[11px]"
                        }`}
                      >
                        <span className="shrink-0 rounded bg-black/35 px-1 text-[9px] font-black">{"ABCD"[oi] ?? oi + 1}</span>
                        <span className="break-words">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          <div className="shrink-0 bg-white/40 pb-1 text-center text-[10px] font-bold text-slate-600">
            {t.tap} · ESC = {t.quit.toLowerCase()} · <span className="text-slate-600">layout {layout} · {vw}px</span>
          </div>

          {confirmQuit && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center">
                <span className="text-4xl">⏹</span>
                <h3 className="mt-2 text-xl font-black text-rose-300">{t.quitTitle}</h3>
                <p className="mt-2 text-xs font-bold text-slate-400">{t.quitBody}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setConfirmQuit(false);
                      finish(ropeRef.current <= -1 ? "p1" : ropeRef.current >= 1 ? "p2" : "draw", "quit", false);
                    }}
                    className={`${btn} bg-gradient-to-r from-rose-500 to-red-700 px-5 py-3 text-sm`}
                  >
                    {t.quitYes}
                  </button>
                  <button onClick={() => setConfirmQuit(false)} className={`${btn} bg-slate-700 px-5 py-3 text-sm`}>
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
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-800/80 p-6 backdrop-blur">
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-black text-amber-400">🏆 {t.board}</h2>
            {records.length === 0 ? (
              <p className="py-8 text-center text-slate-400">{t.empty}</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-xl bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-400">
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
                      <tr key={r.id} className="border-t border-slate-800">
                        <td className="p-2 text-slate-500">{i + 1}</td>
                        <td className="p-2 font-bold">{r.winnerName}</td>
                        <td className="p-2">{r.mode}</td>
                        <td className="p-2">{r.subject}</td>
                        <td className="p-2 font-black text-amber-400">{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={downloadCsv} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold">
                {t.export}
              </button>
              <button
                onClick={() => {
                  clearScores();
                  setRecords([]);
                }}
                className="rounded-xl bg-red-600/30 px-4 py-2 font-bold text-red-300"
              >
                {t.clear}
              </button>
              <button onClick={() => setScreen("home")} className="rounded-xl bg-slate-700 px-4 py-2 font-bold">
                {t.home}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== BANK SOAL ============================== */}
      {screen === "bank" && (
        <div className="flex h-full flex-col bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <h2 className="text-lg font-black sm:text-xl">📝 {t.bank}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${settings.shuffleQuestions ? "bg-emerald-600" : "bg-slate-700"}`}
              >
                🔀 Acak soal: {settings.shuffleQuestions ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, shuffleOptions: !s.shuffleOptions }))}
                className={`rounded-lg px-3 py-1.5 text-xs font-black ${settings.shuffleOptions ? "bg-emerald-600" : "bg-slate-700"}`}
              >
                🎲 Acak pilihan: {settings.shuffleOptions ? "ON" : "OFF"}
              </button>
              <button onClick={() => setScreen("home")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-black">
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
                  editSubject === s.id ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {s.icon} {s.title} ({listOf(s.id).length})
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-4 lg:grid-cols-2">
            {/* daftar soal */}
            <div className="min-h-0 overflow-auto rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Daftar soal · {SUBJECTS.find((s) => s.id === editSubject)?.title}
              </h3>
              <div className="space-y-2">
                {listOf(editSubject).map((item, i) => (
                  <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-bold leading-snug text-slate-100">
                        <span className="mr-1 text-slate-500">{i + 1}.</span>
                        {item.prompt}
                      </p>
                      <button onClick={() => removeQuestion(editSubject, item.id)} className="shrink-0 rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-black text-red-300">
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.options.map((o) => (
                        <span
                          key={o}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            o === item.correct ? "bg-emerald-600/40 text-emerald-200" : "bg-slate-700/70 text-slate-300"
                          }`}
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {listOf(editSubject).length === 0 && <p className="py-6 text-center text-xs text-slate-500">Belum ada soal.</p>}
              </div>
            </div>

            {/* form tambah + impor */}
            <div className="min-h-0 space-y-3 overflow-auto rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{t.addQ}</h3>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder={t.promptPh}
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white"
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
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Jawaban benar:</span>
                <select
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                >
                  <option value="">— pilih —</option>
                  {newOpts.filter((o) => o.trim()).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button onClick={addQuestion} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black">
                  + {t.addQ}
                </button>
                <button onClick={() => restoreDefaults(editSubject)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-black">
                  {t.reset}
                </button>
              </div>

              <hr className="border-slate-700" />
              <label className="block text-[11px] font-bold text-slate-400">Impor CSV (Kategori, Question, options, Correct · opsi dipisah |)</label>
              <input
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              />
              <div className="flex gap-2">
                <button onClick={importCsv} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black">
                  Muat CSV
                </button>
                <button onClick={() => restoreDefaults()} className="rounded-lg bg-red-600/30 px-3 py-1.5 text-xs font-black text-red-300">
                  Reset semua
                </button>
              </div>
              {csvMsg && <p className="text-[11px] font-bold text-amber-300">{csvMsg}</p>}
              <p className="text-[10px] text-slate-500">
                Soal disimpan di perangkat ini (localStorage) dan hanya dipakai game Adu Tarik Dino.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
