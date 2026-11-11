"use client";

/**
 * Ludo Angka: komponen utama (Log 79). Layar DOM penuh: beranda,
 * bank soal, riwayat, hasil, panel soal, dan papan kisi 15x15
 * (bukan canvas). Mesin giliran hidup di matchRef dan digerakkan
 * fungsi mesin di badan komponen; panel dan papan dirender dari
 * snapshot ui yang disalin setiap transisi. Pola soal lemparan,
 * pendorong bot, hitung mundur, mode proyektor (Log 78), dan
 * cleanup meniru Jejak Angka; geometri papan dan aturan gerak
 * dari logic.ts game ini (rancangan terkunci di DESIGN.md).
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LmsBankPicker, type LmsBankChoice } from "@/modules/game-bank/connector";
import { hasArabic } from "../lib-pendamping/game-catalog";
import { music } from "../lib-pendamping/music";
import { sfx } from "../lib-pendamping/sfx";
import {
  FINISH_PROGRESS,
  HOME_COLS,
  MODES,
  PATH,
  RULES,
  SAFE_INDEXES,
  SPECIALS,
  START_INDEX,
  SUBJECTS,
  advanceProgress,
  clearScores,
  Deck,
  emptyRacer,
  loadBank,
  loadGuru,
  loadLms,
  loadScores,
  loadSettings,
  parseCsvBank,
  parseMarkdownBank,
  playableQuestions,
  playersFor,
  progressCell,
  progressLabel,
  promptTemplateSoal,
  raceWinners,
  racersFor,
  rankRacers,
  resetBank,
  rollDice,
  saveBank,
  saveGuru,
  saveLms,
  saveScore,
  saveSettings,
  shuffleArr,
  templateMarkdown,
  trackIndexOf,
  type Bank,
  type ContentSubjectId,
  type GameMode,
  type GuruBank,
  type Q,
  type RacerState,
  type ScoreRec,
  type Screen,
  type Settings,
  type SpriteId,
  type SubjectChoice,
  type WinReason,
} from "./logic";
import { FRAME, FRAME_INSET, SPRITES, frameCrop } from "./sprites";

const rnd = Math.random;

const subjectList = (subject: SubjectChoice, bank: Bank, guru: GuruBank, lms: GuruBank): Q[] =>
  subject === "guru" ? guru.questions : subject === "lms" ? lms.questions : bank[subject];

const subjectLabel = (subject: SubjectChoice, guru: GuruBank, lms: GuruBank): string => {
  if (subject === "guru") return guru.name.trim() ? guru.name : "Mapel Guru";
  if (subject === "lms") return lms.name.trim() ? lms.name : "Bank Soal LMS";
  return SUBJECTS.find((s) => s.id === subject)?.title ?? subject;
};

/**
 * Wajah maskot dari lembar banua 2x2: bingkai senang (FRAME.happy)
 * dipotong lewat frameCrop, lalu diperbesar sebesar FRAME_INSET
 * supaya telapak tokoh mencapai tepi bawah bingkai seperti di
 * renderer Jejak Angka.
 */
function MascotFace({ id, size }: { id: SpriteId; size: number | string }) {
  const def = SPRITES[id];
  const crop = frameCrop(FRAME.happy);
  const inset = FRAME_INSET[id][FRAME.happy] ?? 0;
  const zoom = 256 / Math.max(1, 256 - inset);
  const denom = 2 * zoom - 1;
  const posX = denom > 0 ? ((crop.sx * zoom) / 256 / denom) * 100 : 0;
  const posY = denom > 0 ? ((crop.sy * zoom) / 256 / denom) * 100 : 0;
  return (
    <div
      aria-label={def.label}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${def.src})`,
        backgroundSize: `${200 * zoom}% ${200 * zoom}%`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

type Phase = "tanya" | "lempar" | "dadu" | "jalan";

interface MatchState {
  racers: RacerState[];
  deck: Deck;
  turn: number;
  answerer: number;
  phase: Phase;
  q: Q | null;
  options: string[];
  wrong: Set<number>;
  stealOwner: number | null;
  stealTried: Set<number>;
  bonus: boolean;
  rollFrom: "biasa" | "lemparan" | "bonus";
  dice: number | null;
  banner: string;
  walkText: string;
  timeLeft: number;
  timeUp: boolean;
}

interface UiSnap {
  turn: number;
  answerer: number;
  phase: Phase;
  q: Q | null;
  options: string[];
  wrong: number[];
  dice: number | null;
  banner: string;
  stealing: boolean;
  bonus: boolean;
  walkText: string;
  racers: RacerState[];
  timeLeft: number;
}

const mmss = (sec: number): string => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** CSV riwayat skor lokal (logic game ini tidak mengekspor scoresCsv). */
const scoresCsv = (rows: ScoreRec[]): string => {
  const esc = (v: string): string => `"${v.replace(/"/g, '""')}"`;
  const head = "Waktu,Mode,Mapel,Pemenang,Alasan,Hasil";
  const lines = rows.map((r) =>
    [
      r.at,
      r.mode,
      r.subject,
      r.winner,
      r.reason === "finish" ? "mencapai FINISH" : "waktu habis",
      r.results.map((x) => `${x.name} ${progressLabel(x.pos)}`).join(" · "),
    ]
      .map(esc)
      .join(","),
  );
  return [head, ...lines].join("\n");
};

/* ------------------------------------------------------------ papan */

/** Indeks lintasan tiap koordinat sel, untuk render kisi. */
const TRACK_INDEX: ReadonlyMap<string, number> = new Map(PATH.map((rc, i) => [`${rc[0]},${rc[1]}`, i]));

/** Pemilik kolom rumah tiap koordinat sel. */
const HOME_OWNER: ReadonlyMap<string, number> = new Map(
  HOME_COLS.flatMap((cells, owner) => cells.map((rc) => [`${rc[0]},${rc[1]}`, owner] as [string, number])),
);

/** Pemilik kotak start menurut indeks lintasan. */
const START_OWNER: ReadonlyMap<number, number> = new Map(START_INDEX.map((idx, owner) => [idx, owner]));

/** Glif panah kolom rumah menuju pusat, per pemilik. */
const HOME_ARROWS: readonly string[] = ["▶", "▼", "◀", "▲"];

/** Sudut kartu kandang per slot pemain (searah jarum jam dari kiri atas). */
const YARD_POS: readonly CSSProperties[] = [
  { left: "11px", top: "11px" },
  { right: "11px", top: "11px" },
  { right: "11px", bottom: "11px" },
  { left: "11px", bottom: "11px" },
];

/**
 * Sudut token kecil pada kartu kandang: sudut yang menghadap pusat
 * papan, sepenuhnya DI DALAM kartu. Jarak negatif pernah membuat
 * token menggantung di luar kotak (keluhan user 3 Nov 18:17).
 */
/* Pion kandang TIDAK lagi ditempel di sudut kartu (dua kali dikeluhkan user:
   menggantung di luar kartu, lalu menutupi teks dan terasa bukan di arenanya).
   Pion kini duduk di cakram markas di tengah bawah kartu kandang, sesudah
   maskot diperkecil ke 42% agar ada ruang nyata untuk markas itu. */

/**
 * Pusat sel (baris/kolom 0..14) sebagai string calc CSS yang persis
 * mengikuti kisi: padding 8px, gap 2px, lebar sel (100% - 44px) / 15.
 */
const cellCenter = (i: number): string =>
  `calc(8px + ${i} * ((100% - 44px) / 15 + 2px) + (100% - 44px) / 30)`;

export default function LudoAngkaGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [bank, setBank] = useState<Bank>(() => loadBank());
  const [guru, setGuru] = useState<GuruBank>(() => loadGuru());
  const [lms, setLms] = useState<GuruBank>(() => loadLms());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [scores, setScores] = useState<ScoreRec[]>(() => loadScores());
  const [notice, setNotice] = useState<string>("");
  const [narrow, setNarrow] = useState<boolean>(false);
  const [count, setCount] = useState<number>(3);
  const [paused, setPaused] = useState<boolean>(false);
  const [bankTab, setBankTab] = useState<SubjectChoice>("matematika");
  const [form, setForm] = useState<{ prompt: string; options: [string, string, string, string]; correctIdx: number }>({
    prompt: "",
    options: ["", "", "", ""],
    correctIdx: 0,
  });
  const [importText, setImportText] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [finalRacers, setFinalRacers] = useState<RacerState[]>([]);
  const [winInfo, setWinInfo] = useState<{ reason: WinReason; winners: string[] }>({ reason: "batas", winners: [] });
  const [ui, setUi] = useState<UiSnap | null>(null);
  const [diceFace, setDiceFace] = useState<number>(1);
  const matchRef = useRef<MatchState | null>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const modeRef = useRef<GameMode>("DUEL");
  const endedRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const screenRef = useRef<Screen>("home");
  const settingsRef = useRef<Settings>(settings);
  const guruRef = useRef<GuruBank>(guru);
  const lmsRef = useRef<GuruBank>(lms);
  const narrowRef = useRef<boolean>(false);
  const winInfoRef = useRef<{ reason: WinReason; winners: string[] }>({ reason: "batas", winners: [] });
  screenRef.current = screen;
  pausedRef.current = paused;
  settingsRef.current = settings;
  guruRef.current = guru;
  lmsRef.current = lms;
  narrowRef.current = narrow;

  /* ---------------------------------------------------------- util */

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      if (endedRef.current) return;
      if (screenRef.current !== "playing" && screenRef.current !== "countdown") return;
      if (pausedRef.current) {
        later(250, fn);
        return;
      }
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);

  const syncUi = useCallback(() => {
    const m = matchRef.current;
    if (!m) return;
    setUi({
      turn: m.turn,
      answerer: m.answerer,
      phase: m.phase,
      q: m.q,
      options: [...m.options],
      wrong: Array.from(m.wrong),
      dice: m.dice,
      banner: m.banner,
      stealing: m.stealOwner !== null,
      bonus: m.bonus,
      walkText: m.walkText,
      racers: m.racers.map((r) => ({ ...r })),
      timeLeft: m.timeLeft,
    });
  }, []);

  const setBanner = useCallback((text: string) => {
    const m = matchRef.current;
    if (!m) return;
    m.banner = text;
  }, []);

  /* ---------------------------------------------------------- mount */

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /* ---------------------------------------------------------- musik */

  useEffect(() => {
    if (screen === "home" || screen === "bank" || screen === "score") music.stop();
  }, [screen]);

  useEffect(() => {
    if (screen !== "countdown") return;
    setCount(3);
    if (settings.sound) music.play("ludo-angka");
    const iv = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(iv);
          setScreen("playing");
          return 0;
        }
        return c - 1;
      });
    }, 800);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen === "countdown"]);

  /* ------------------------------------------------- mesin giliran */

  const finish = (reason: WinReason): void => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimers();
    music.stop();
    const m = matchRef.current;
    if (!m) return;
    const winners = raceWinners(m.racers);
    const humanWon = winners.some((w) => !w.isBot);
    sfx.play(reason === "finish" || humanWon ? "victory" : "gameover");
    const winnerStr = winners.map((w) => w.def.name).join(" dan ");
    const rec: ScoreRec = {
      at: new Date().toLocaleString("id-ID"),
      mode: modeRef.current,
      subject: subjectLabel(settingsRef.current.subject, guruRef.current, lmsRef.current),
      results: rankRacers(m.racers).map((r) => ({ name: r.def.name, pos: r.progress })),
      winner: winnerStr,
      reason,
    };
    setScores(saveScore(rec));
    setFinalRacers(rankRacers(m.racers).map((r) => ({ ...r })));
    winInfoRef.current = { reason, winners: winners.map((w) => w.def.name) };
    setWinInfo({ reason, winners: winners.map((w) => w.def.name) });
    setScreen("result");
  };

  const startQuestion = (answererIdx: number, bonus: boolean): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    const q = m.deck.next();
    if (!q) {
      finish("batas");
      return;
    }
    m.q = q;
    m.options = shuffleArr(q.options, rnd);
    m.wrong = new Set();
    m.bonus = bonus;
    m.answerer = answererIdx;
    m.phase = "tanya";
    syncUi();
  };

  const startTurn = (idx: number): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    m.turn = idx;
    m.stealOwner = null;
    m.stealTried = new Set();
    startQuestion(idx, false);
  };

  const endTurn = (fromIdx: number): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    if (m.timeUp) {
      finish("batas");
      return;
    }
    const skippedNames: string[] = [];
    let nxt = fromIdx;
    for (let k = 0; k < m.racers.length; k++) {
      nxt = (nxt + 1) % m.racers.length;
      const cand = m.racers[nxt];
      if (cand.skipNext) {
        cand.skipNext = false;
        skippedNames.push(cand.def.name);
        continue;
      }
      break;
    }
    if (skippedNames.length > 0) {
      setBanner(`${skippedNames.join(" dan ")} melewati giliran karena kotak Berhenti.`);
    }
    startTurn(nxt);
  };

  /**
   * Tangkap di satu sel lintasan; mengembalikan nama pion yang
   * tertangkap. Sesuai DESIGN.md Bagian 4, tangkapan hanya terjadi
   * bila sel itu ditempati tepat satu pion lawan; bila tidak ada atau
   * lebih dari satu, tidak ada yang ditangkap.
   */
  const doCapture = (moverIdx: number, trackIdx: number): string[] => {
    const m = matchRef.current;
    if (!m || SAFE_INDEXES.has(trackIdx)) return [];
    const occupants = m.racers.filter(
      (o, oi) =>
        oi !== moverIdx &&
        o.progress >= 1 &&
        o.progress <= 51 &&
        trackIndexOf(oi, o.progress) === trackIdx,
    );
    if (occupants.length !== 1) return [];
    const victim = occupants[0];
    victim.progress = 0;
    m.racers[moverIdx].captures += 1;
    return [victim.def.name];
  };

  /** Penutup gerak: putuskan soal bonus atau akhiri giliran. */
  const finishMove = (P: number, D: number, bonusTangkap: boolean, bonusBintang: boolean): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    if (m.timeUp) {
      finish("batas");
      return;
    }
    if (D === 6 || bonusTangkap || bonusBintang) {
      if (D === 6 && !bonusTangkap && !bonusBintang) {
        setBanner(`Angka 6! ${m.racers[P].def.name} menjawab soal bonus untuk melempar lagi.`);
      }
      startQuestion(P, true);
      return;
    }
    endTurn(P);
  };

  /** Resolusi sel akhir sesudah pion selesai berjalan dari lemparan dadu. */
  const resolveLanding = (P: number, D: number): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    const r = m.racers[P];
    if (r.progress >= FINISH_PROGRESS) {
      setBanner(`${r.def.name} mencapai FINISH!`);
      syncUi();
      finish("finish");
      return;
    }
    let bonusTangkap = false;
    let bonusBintang = false;
    if (r.progress >= 1 && r.progress <= 51) {
      const idx = trackIndexOf(P, r.progress);
      const captured = doCapture(P, idx);
      if (captured.length > 0) {
        bonusTangkap = true;
        setBanner(`${r.def.name} menangkap ${captured.join(" dan ")}! Pion lawan pulang ke kandang, ${r.def.name} dapat bonus lemparan.`);
        sfx.play("bonk");
      }
      const spec = SPECIALS[idx];
      if (spec === "bintang") {
        bonusBintang = true;
        setBanner(`${r.def.name} mendarat di kotak Bintang! Jawab soal bonus untuk melempar lagi.`);
        syncUi();
        later(RULES.bannerMs, () => finishMove(P, D, bonusTangkap, bonusBintang));
        return;
      }
      if (spec === "berhenti") {
        r.skipNext = true;
        setBanner(`Kotak Berhenti! ${r.def.name} melewati satu giliran berikutnya.`);
        syncUi();
        later(RULES.bannerMs, () => finishMove(P, D, bonusTangkap, false));
        return;
      }
      if (spec === "kilat" || spec === "mundur") {
        const isKilat = spec === "kilat";
        const to = isKilat ? Math.min(56, r.progress + RULES.kilatStep) : Math.max(1, r.progress - RULES.mundurStep);
        setBanner(
          isKilat ? `Kotak Kilat! ${r.def.name} maju 4 langkah.` : `Kotak Mundur! ${r.def.name} mundur 4 langkah.`,
        );
        sfx.play(isKilat ? "pop" : "swish");
        syncUi();
        later(400, () => {
          const from = r.progress;
          const dir = to > from ? 1 : -1;
          const jumpSteps: number[] = [];
          let c = from;
          while (c !== to) {
            c += dir;
            jumpSteps.push(c);
          }
          const stepJump = (i: number): void => {
            if (i >= jumpSteps.length) {
              if (r.progress >= 1 && r.progress <= 51) {
                const cap2 = doCapture(P, trackIndexOf(P, r.progress));
                if (cap2.length > 0) {
                  bonusTangkap = true;
                  setBanner(`${r.def.name} menangkap ${cap2.join(" dan ")}! Pion lawan pulang ke kandang.`);
                  sfx.play("bonk");
                }
              }
              syncUi();
              finishMove(P, D, bonusTangkap, false);
              return;
            }
            r.progress = jumpSteps[i];
            syncUi();
            later(RULES.stepMs, () => stepJump(i + 1));
          };
          stepJump(0);
        });
        return;
      }
    }
    syncUi();
    finishMove(P, D, bonusTangkap, bonusBintang);
  };

  const settleDice = (): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.dice === null || m.phase !== "dadu") return;
    const P = m.turn;
    const r = m.racers[P];
    const D = m.dice;
    m.phase = "jalan";
    if (r.progress === 0) {
      if (D !== 6) {
        m.walkText = "";
        setBanner(`Butuh angka 6 untuk keluar kandang. ${r.def.name} tetap di kandang.`);
        syncUi();
        later(900, () => endTurn(P));
        return;
      }
      r.progress = 1;
      m.walkText = `${r.def.name} keluar kandang ke kotak start.`;
      setBanner(`${r.def.name} dapat angka 6 dan keluar kandang ke kotak start.`);
      sfx.play("pop");
      syncUi();
      later(RULES.stepMs + 250, () => resolveLanding(P, D));
      return;
    }
    const from = r.progress;
    const target = advanceProgress(from, D);
    const steps: number[] = [];
    let cur = from;
    let dir = 1;
    for (let i = 0; i < D; i++) {
      cur += dir;
      if (cur > FINISH_PROGRESS) {
        cur = 2 * FINISH_PROGRESS - cur;
        dir = -1;
      }
      steps.push(cur);
    }
    m.walkText = `Berjalan ${D} langkah: ${progressLabel(from)} menuju ${progressLabel(target)}.`;
    if (from + D > FINISH_PROGRESS) {
      setBanner(`Kelebihan angka! ${r.def.name} memantul mundur dari FINISH ke ${progressLabel(target)}.`);
    }
    sfx.play("pop");
    syncUi();
    const stepNext = (i: number): void => {
      if (i >= steps.length) {
        resolveLanding(P, D);
        return;
      }
      r.progress = steps[i];
      syncUi();
      later(RULES.stepMs, () => stepNext(i + 1));
    };
    later(RULES.stepMs, () => stepNext(0));
  };

  const roll = (): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.phase !== "lempar") return;
    m.dice = rollDice(rnd);
    m.phase = "dadu";
    sfx.play("tick");
    syncUi();
  };

  const answer = (idx: number, optIndex: number): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.phase !== "tanya" || !m.q) return;
    if (idx !== m.answerer) return;
    if (optIndex < 0 || optIndex >= m.options.length) return;
    if (m.wrong.has(optIndex)) return;
    const r = m.racers[idx];
    const opt = m.options[optIndex];
    r.answered += 1;
    if (opt === m.q.correct) {
      r.correct += 1;
      m.rollFrom = m.bonus ? "bonus" : m.stealOwner !== null ? "lemparan" : "biasa";
      sfx.play("correct");
      let text = `Benar! ${r.def.name} melempar dadu.`;
      if (m.stealOwner !== null) text = `${r.def.name} merebut soal! ${r.def.name} yang melempar dadu.`;
      if (m.bonus) text = `Bonus benar! ${r.def.name} melempar lagi.`;
      m.turn = idx;
      m.stealOwner = null;
      m.stealTried = new Set();
      setBanner(text);
      m.phase = "lempar";
      syncUi();
      return;
    }
    sfx.play("wrong");
    m.wrong.add(optIndex);
    if (m.bonus) {
      setBanner(`Bonus gagal. Giliran ${r.def.name} selesai.`);
      syncUi();
      endTurn(m.turn);
      return;
    }
    const owner = m.stealOwner ?? idx;
    if (m.stealOwner === null) m.stealOwner = idx;
    m.stealTried.add(idx);
    let nxt = -1;
    for (let k = 1; k < m.racers.length; k++) {
      const cand = (idx + k) % m.racers.length;
      if (cand !== owner && !m.stealTried.has(cand)) {
        nxt = cand;
        break;
      }
    }
    if (nxt >= 0) {
      m.answerer = nxt;
      setBanner(`Jawaban salah! Soal dilempar ke ${m.racers[nxt].def.name}. Rebut lemparannya!`);
      m.phase = "tanya";
      syncUi();
    } else {
      let peek = owner;
      for (let k = 0; k < m.racers.length; k++) {
        peek = (peek + 1) % m.racers.length;
        if (m.racers[peek].skipNext) continue;
        break;
      }
      setBanner(`Tidak ada yang berhasil merebut. Giliran lanjut ke ${m.racers[peek].def.name}.`);
      syncUi();
      endTurn(owner);
    }
  };

  const machineRef = useRef({ answer, roll, settleDice });
  machineRef.current = { answer, roll, settleDice };

  const startMatch = (): void => {
    const list = subjectList(settings.subject, bank, guru, lms);
    const playable = playableQuestions(list);
    if (settings.subject === "guru" && playable.length < 2) {
      setNotice("Mapel Guru butuh minimal 2 soal siap main. Tambahkan dulu lewat Bank Soal.");
      return;
    }
    if (settings.subject !== "guru" && playable.length === 0) {
      setNotice("Mapel ini belum punya soal siap main. Tambahkan dulu lewat Bank Soal.");
      return;
    }
    setNotice("");
    sfx.setEnabled(settings.sound);
    const effMode: GameMode = narrow ? "SOLO" : settings.mode;
    modeRef.current = effMode;
    clearTimers();
    matchRef.current = {
      racers: racersFor(effMode).map(emptyRacer),
      deck: new Deck(playable, rnd),
      turn: 0,
      answerer: 0,
      phase: "tanya",
      q: null,
      options: [],
      wrong: new Set(),
      stealOwner: null,
      stealTried: new Set(),
      bonus: false,
      rollFrom: "biasa",
      dice: null,
      banner: "Jawab soal dengan benar untuk bisa melempar dadu. Keluar kandang butuh angka 6.",
      walkText: "",
      timeLeft: RULES.durationSec,
      timeUp: false,
    };
    endedRef.current = false;
    setDiceFace(1);
    setPaused(false);
    startQuestion(0, false);
    setScreen("countdown");
  };

  /* ---------------------------------------------------- bot dan dadu */

  const uiPhase = ui?.phase;
  const uiAnswerer = ui?.answerer;
  const uiTurn = ui?.turn;

  useEffect(() => {
    if (screen !== "playing" || !uiPhase || paused) return;
    if (uiPhase !== "tanya" && uiPhase !== "lempar") return;
    const m = matchRef.current;
    if (!m) return;
    const actorIdx = uiPhase === "tanya" ? (uiAnswerer ?? 0) : (uiTurn ?? 0);
    const actor = m.racers[actorIdx];
    if (!actor || !actor.isBot) return;
    const phase = uiPhase;
    const delay = phase === "tanya" ? 900 + rnd() * 500 : 600;
    const id = window.setTimeout(() => {
      const mm = matchRef.current;
      if (!mm || endedRef.current || pausedRef.current) return;
      if (phase === "tanya") {
        if (mm.phase !== "tanya" || mm.answerer !== actorIdx || !mm.q) return;
        const correctIdx = mm.options.indexOf(mm.q.correct);
        const wrongIdxs = mm.options
          .map((o, oi) => ({ o, oi }))
          .filter(({ o, oi }) => o !== mm.q!.correct && !mm.wrong.has(oi))
          .map(({ oi }) => oi);
        const pick =
          rnd() < RULES.botAccuracy || wrongIdxs.length === 0
            ? correctIdx
            : wrongIdxs[Math.floor(rnd() * wrongIdxs.length)];
        machineRef.current.answer(actorIdx, pick);
      } else {
        if (mm.phase !== "lempar" || mm.turn !== actorIdx) return;
        machineRef.current.roll();
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [screen, uiPhase, uiAnswerer, uiTurn, paused]);

  useEffect(() => {
    if (!ui || ui.phase !== "dadu") return;
    let ticks = 0;
    const iv = window.setInterval(() => {
      if (pausedRef.current) return;
      ticks += 1;
      if (ticks >= 9) {
        window.clearInterval(iv);
        const m = matchRef.current;
        if (m && m.dice !== null) setDiceFace(m.dice);
        machineRef.current.settleDice();
        return;
      }
      setDiceFace(1 + Math.floor(rnd() * 6));
    }, 80);
    return () => window.clearInterval(iv);
  }, [ui?.phase, ui?.dice]);

  /* ------------------------------------------------------ jam tanding */

  useEffect(() => {
    if (screen !== "playing") return;
    const iv = window.setInterval(() => {
      const m = matchRef.current;
      if (!m || endedRef.current || pausedRef.current) return;
      m.timeLeft = Math.max(0, m.timeLeft - 0.25);
      if (m.timeLeft <= 0 && !m.timeUp) {
        m.timeUp = true;
        setBanner("Waktu habis! Pertandingan berhenti. Kemajuan tertinggi yang menang.");
        if (m.phase === "tanya" || m.phase === "lempar" || m.phase === "dadu") {
          finish("batas");
          return;
        }
        syncUi();
        return;
      }
      setUi((prev) => (prev ? { ...prev, timeLeft: m.timeLeft } : prev));
    }, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  /* ---------------------------------------------------------- bank */

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  /** Pasang soal dari Bank Soal LMS sebagai mapel "Bank Soal LMS":
   *  dipetakan ke tipe soal game ini (pola pemilih bank modul Sigetteng)
   *  dan disimpan di simpanan lms sendiri, terpisah dari Mapel Guru. */
  const applyLmsChoice = (choice: LmsBankChoice) => {
    const questions: Q[] = choice.questions.map((q, i) => ({
      id: `lms-${choice.bankId}-${i}`,
      subjectId: "guru",
      prompt: q.prompt,
      isArabic: /[\u0600-\u06FF]/.test(q.prompt),
      options: [...q.options],
      correct: q.options[q.correctIndex] ?? "",
      custom: true,
    }));
    const next: GuruBank = { name: choice.bankName, questions };
    setLms(next);
    saveLms(next);
    setBankTab("lms");
    setNotice(`Bank "${choice.bankName}" terpasang sebagai Bank Soal LMS: ${questions.length} soal. Pilih "Bank Soal LMS" di beranda untuk memainkannya.`);
  };

  const bankItems = subjectList(bankTab, bank, guru, lms);
  const bankPlayable = playableQuestions(bankItems).length;

  const addQuestion = () => {
    const prompt = form.prompt.trim();
    const options = form.options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!prompt || options.length < 2) {
      setNotice("Soal wajib terisi dan minimal ada 2 pilihan jawaban.");
      return;
    }
    const correct = options[Math.min(form.correctIdx, options.length - 1)];
    const q: Q = {
      id: `q-${Date.now()}-${Math.floor(rnd() * 1e6)}`,
      subjectId: bankTab === "guru" || bankTab === "lms" ? "arab" : bankTab,
      prompt,
      isArabic: hasArabic(prompt) || hasArabic(correct),
      options,
      correct,
      custom: true,
    };
    if (bankTab === "guru") {
      const next = { ...guru, questions: [...guru.questions, q] };
      setGuru(next);
      saveGuru(next);
    } else if (bankTab === "lms") {
      const next = { ...lms, questions: [...lms.questions, q] };
      setLms(next);
      saveLms(next);
    } else {
      const next: Bank = { ...bank, [bankTab]: [...bank[bankTab], q] };
      setBank(next);
      saveBank(next);
    }
    setForm({ prompt: "", options: ["", "", "", ""], correctIdx: 0 });
    setNotice(
      playableQuestions([q]).length === 1
        ? "Soal tersimpan dan siap main."
        : "Soal tersimpan, tetapi belum siap main: jawaban benar harus termasuk dalam pilihan.",
    );
  };

  const deleteQuestion = (id: string) => {
    if (bankTab === "guru") {
      const next = { ...guru, questions: guru.questions.filter((q) => q.id !== id) };
      setGuru(next);
      saveGuru(next);
    } else if (bankTab === "lms") {
      const next = { ...lms, questions: lms.questions.filter((q) => q.id !== id) };
      setLms(next);
      saveLms(next);
    } else {
      const next: Bank = { ...bank, [bankTab]: bank[bankTab].filter((q) => q.id !== id) };
      setBank(next);
      saveBank(next);
    }
  };

  const runImport = () => {
    const parseSubject: ContentSubjectId = bankTab === "guru" || bankTab === "lms" ? "arab" : bankTab;
    const md = parseMarkdownBank(importText, parseSubject);
    const csv = md.items.length === 0 ? parseCsvBank(importText, parseSubject) : { items: [] as Q[], skipped: 0 };
    const items = md.items.length > 0 ? md.items : csv.items;
    const skipped = md.items.length > 0 ? md.skipped : csv.skipped;
    if (items.length === 0) {
      setNotice("Tidak ada soal yang terbaca dari teks itu. Periksa formatnya lewat Petunjuk & Prompt.");
      return;
    }
    if (bankTab === "guru") {
      const next: GuruBank = {
        name: md.name && md.name.trim() ? md.name : guru.name,
        questions: [...guru.questions, ...items],
      };
      setGuru(next);
      saveGuru(next);
    } else if (bankTab === "lms") {
      const next: GuruBank = {
        name: md.name && md.name.trim() ? md.name : lms.name,
        questions: [...lms.questions, ...items],
      };
      setLms(next);
      saveLms(next);
    } else {
      const next: Bank = { ...bank, [bankTab]: [...bank[bankTab], ...items] };
      setBank(next);
      saveBank(next);
    }
    const playable = playableQuestions(items).length;
    setImportText("");
    setNotice(`Impor selesai: ${items.length} soal masuk (${playable} siap main), ${skipped} baris dilewati.`);
  };

  const download = (name: string, text: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptTemplateSoal());
      setCopied(true);
      // Timer status tercatat di timersRef yang sama dengan timer lain
      // (dibersihkan clearTimers), bukan later() karena callback later
      // bergerbang layar playing/countdown sedangkan tombol ini ditekan
      // di layar bank; pola pencatatan dan penghapusan dirinya meniru
      // later().
      const copiedTimerId = window.setTimeout(() => {
        timersRef.current.delete(copiedTimerId);
        setCopied(false);
      }, 1800);
      timersRef.current.add(copiedTimerId);
    } catch {
      setShowPrompt(true);
    }
  };

  /* ---------------------------------------------------------- render */

  const effSubjectList = subjectList(settings.subject, bank, guru, lms);
  const effPlayable = playableQuestions(effSubjectList).length;

  const answererDef = ui ? ui.racers[ui.answerer] : null;
  const displayFace = ui ? (ui.phase === "dadu" ? diceFace : (ui.dice ?? 1)) : 1;
  const chipSub = (() => {
    if (!ui || !answererDef) return "";
    if (answererDef.isBot) return "Bot sedang berpikir";
    if (ui.phase === "tanya") {
      if (ui.stealing) return "Soal lemparan untukmu";
      if (ui.bonus) return "Soal bonus: benar, lempar lagi";
      return answererDef.progress === 0 ? "Menjawab soal · pion masih di kandang" : "Menjawab soal";
    }
    if (ui.phase === "lempar") return "Melempar dadu";
    if (ui.phase === "dadu") return "Dadu berputar...";
    return "Berjalan...";
  })();

  /** Papan kisi 15x15 + kartu kandang + token, dirender dari snapshot ui. */
  const renderBoard = () => {
    if (!ui) return null;
    const quadDefs = playersFor("QUAD");
    const cells: ReactNode[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          if (r === 6 && c === 6) {
            cells.push(
              <div
                key="center"
                className="flex items-center justify-center rounded-[10px] shadow-[0_3px_8px_rgba(0,0,0,0.2)]"
                style={{
                  gridRow: "7 / span 3",
                  gridColumn: "7 / span 3",
                  background:
                    "conic-gradient(from 45deg, #4C1D95 0 25%, #1F7A72 0 50%, #4E9B47 0 75%, #D9A404 0 100%)",
                }}
              >
                <span className="rounded-lg bg-white px-2 py-0.5 text-[clamp(10px,1.4vw,16px)] font-black text-[#17352B]">
                  FINISH
                </span>
              </div>,
            );
          }
          continue;
        }
        const key = `${r},${c}`;
        const tIdx = TRACK_INDEX.get(key);
        const hOwner = HOME_OWNER.get(key);
        let bg = "transparent";
        let glyph: string | null = null;
        let glyphColor = "#17352B";
        let small: string | null = null;
        if (tIdx !== undefined) {
          bg = "#FFFDF4";
          const spec = SPECIALS[tIdx];
          const sOwner = START_OWNER.get(tIdx);
          if (spec === "bintang") {
            bg = "#FFF3C4";
            glyph = "★";
            glyphColor = "#B8860B";
          } else if (spec === "kilat") {
            bg = "#D8F3FF";
            glyph = "⚡";
            glyphColor = "#0277BD";
          } else if (spec === "mundur") {
            bg = "#FFE3D3";
            glyph = "▼";
            glyphColor = "#C1440E";
            small = "-4";
          } else if (spec === "berhenti") {
            bg = "#FFD9D9";
            glyph = "⛔";
          } else if (sOwner !== undefined) {
            bg = quadDefs[sOwner].soft;
            glyph = "⌂";
            glyphColor = quadDefs[sOwner].color;
          }
        } else if (hOwner !== undefined) {
          bg = quadDefs[hOwner].soft;
          glyph = HOME_ARROWS[hOwner];
          glyphColor = quadDefs[hOwner].color;
        }
        const onBoard = tIdx !== undefined || hOwner !== undefined;
        cells.push(
          <div
            key={key}
            className="relative flex items-center justify-center rounded-[4px]"
            style={{
              backgroundColor: bg,
              boxShadow: onBoard ? "inset 0 0 0 1px #B9D9C6" : undefined,
              fontSize: "clamp(9px, 1.9vw, 21px)",
              lineHeight: 1,
            }}
          >
            {glyph && <span style={{ color: glyphColor }}>{glyph}</span>}
            {small && (
              <span className="absolute bottom-0 right-[2px] text-[8px] font-black" style={{ color: glyphColor }}>
                {small}
              </span>
            )}
          </div>,
        );
      }
    }

    const groups = new Map<string, number[]>();
    ui.racers.forEach((r, i) => {
      if (r.progress <= 0) return;
      const cell = progressCell(i, r.progress);
      const gkey =
        cell.kind === "finish" ? "finish" : cell.kind === "track" ? `t${cell.index}` : cell.kind === "home" ? `h${i}-${cell.step}` : "base";
      const arr = groups.get(gkey) ?? [];
      arr.push(i);
      groups.set(gkey, arr);
    });

    return (
      <div
        data-testid="ludo-angka-board"
        data-state={screen === "countdown" ? "countdown" : paused ? "paused" : "playing"}
        data-phase={ui.phase}
        data-turn={String(ui.turn)}
        data-answerer={String(ui.answerer)}
        data-question={ui.q?.prompt ?? ""}
        data-options={JSON.stringify(ui.options)}
        data-dice={ui.dice === null ? "" : String(ui.dice)}
        data-kind={ui.bonus ? "bonus" : ui.stealing ? "lemparan" : "biasa"}
        data-winner={winInfo.winners.join(" dan ")}
        data-timeleft={String(Math.ceil(ui.timeLeft))}
        data-pos0={ui.racers[0] ? String(ui.racers[0].progress) : undefined}
        data-pos1={ui.racers[1] ? String(ui.racers[1].progress) : undefined}
        data-pos2={ui.racers[2] ? String(ui.racers[2].progress) : undefined}
        data-pos3={ui.racers[3] ? String(ui.racers[3].progress) : undefined}
        className="relative aspect-square w-full shrink-0 lg:w-[min(92dvh,60%,960px)]"
      >
        <div
          className="grid h-full w-full gap-[2px] rounded-[18px] bg-[#8FD0B2] p-2 shadow-[0_8px_24px_rgba(23,53,43,0.18)]"
          style={{ gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(15, 1fr)" }}
        >
          {cells}
        </div>

        {racersFor("QUAD").map((rd) => {
          const def = rd.def;
          const r = ui.racers.find((x) => x.def.slot === def.slot) ?? null;
          return (
            <div
              key={`yard-${def.slot}`}
              className="absolute z-[2]"
              style={{ width: "calc(40% - 14px)", height: "calc(40% - 14px)", ...YARD_POS[def.slot] }}
            >
              <div
                className={`relative flex h-full w-full flex-col items-center justify-start rounded-2xl bg-white pt-[5%] shadow-[0_3px_8px_rgba(0,0,0,0.18)] ${
                  r ? "" : "opacity-60"
                }`}
              >
                <div style={{ width: "42%", aspectRatio: "1" }}>
                  <MascotFace id={def.sprite} size="100%" />
                </div>
                <p className="text-[clamp(12px,1.7vw,19px)] font-black leading-tight" style={{ color: def.color }}>
                  {def.name}
                  {r?.isBot ? " (Bot)" : ""}
                </p>
                <p className="text-[11px] font-semibold text-[#5A7267]">{r ? progressLabel(r.progress) : "Tidak bermain"}</p>
                {/* Markas pion di tengah bawah kartu: pion duduk penuh di
                    dalamnya selama di kandang; kosong bergaris putus-putus
                    warna pemain sesudah pion keluar atau tidak bermain. */}
                <div className="mt-auto flex w-full items-center justify-center pb-[6%]">
                  {r && r.progress === 0 ? (
                    <div
                      className="flex items-center justify-center overflow-hidden rounded-full bg-white"
                      style={{
                        width: "19%",
                        aspectRatio: "1",
                        border: `3px solid ${def.color}`,
                        boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
                      }}
                    >
                      <MascotFace id={def.sprite} size="100%" />
                    </div>
                  ) : (
                    <div
                      className="rounded-full"
                      style={{
                        width: "19%",
                        aspectRatio: "1",
                        border: `2px dashed ${def.color}`,
                        background: def.soft,
                        opacity: 0.55,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {ui.racers.map((r, i) => {
          if (r.progress <= 0) return null;
          const cell = progressCell(i, r.progress);
          if (cell.kind === "base") return null;
          const left = cell.kind === "finish" ? "50%" : cellCenter(cell.col);
          const top = cell.kind === "finish" ? "50%" : cellCenter(cell.row);
          const gkey =
            cell.kind === "finish" ? "finish" : cell.kind === "track" ? `t${cell.index}` : `h${i}-${cell.step}`;
          const group = groups.get(gkey) ?? [i];
          const slotInGroup = group.indexOf(i);
          const grouped = group.length > 1;
          const qx = grouped ? (slotInGroup % 2 === 0 ? -32 : 32) : 0;
          const qy = grouped ? (slotInGroup < 2 ? -32 : 32) : 0;
          const active = i === (ui.phase === "tanya" ? ui.answerer : ui.turn);
          return (
            <div
              key={`token-${r.def.slot}`}
              className={`absolute z-[3] flex items-center justify-center overflow-hidden rounded-full bg-white ${active ? "animate-pulse" : ""}`}
              style={{
                left,
                top,
                width: grouped ? "3.8%" : "6.1%",
                aspectRatio: "1",
                transform: `translate(-50%, -50%) translate(${qx}%, ${qy}%)`,
                border: `3px solid ${r.def.color}`,
                boxShadow: active
                  ? `0 0 0 4px ${r.def.color}55, 0 4px 10px rgba(0,0,0,0.25)`
                  : "0 4px 10px rgba(0,0,0,0.25)",
                transition: "left 200ms ease, top 200ms ease",
              }}
            >
              <MascotFace id={r.def.sprite} size="100%" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-[#CDEEDD] font-sans text-[#22303A]">
      {(screen === "playing" || screen === "countdown") && ui && answererDef && (
        <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#CDEEDD] to-[#F4F1DE]" onPointerDown={() => sfx.resume()}>
          <div className="mx-auto w-full max-w-[1600px] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-black tracking-tight text-[#17352B] sm:text-xl">MACCULE LUDO</h1>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-[10px] px-3 py-1.5 text-lg font-extrabold text-[#F4F1DE] ${ui.timeLeft < 60 ? "animate-pulse bg-[#B3261E]" : "bg-[#17352B]"}`}
                >
                  {mmss(ui.timeLeft)}
                </span>
                {screen === "playing" && (
                  <>
                    <button
                      type="button"
                      aria-label={paused ? "Lanjut" : "Jeda"}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg shadow"
                      onClick={() => setPaused((p) => !p)}
                    >
                      {paused ? "▶" : "⏸"}
                    </button>
                    <button
                      type="button"
                      aria-label="Beranda"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg shadow"
                      onClick={() => {
                        music.stop();
                        setPaused(false);
                        setScreen("home");
                      }}
                    >
                      ⌂
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              {renderBoard()}

              <div className="flex w-full min-w-0 max-w-[600px] flex-1 flex-col gap-3">
                <div className="flex items-stretch gap-3">
                  <div
                    className="flex flex-1 items-center gap-3 rounded-[14px] px-3.5 py-3 text-white"
                    style={{ backgroundColor: answererDef.def.color }}
                  >
                    <span className="rounded-full p-1" style={{ backgroundColor: answererDef.def.soft }}>
                      <MascotFace id={answererDef.def.sprite} size={44} />
                    </span>
                    <span>
                      <span className="block text-[19px] font-extrabold leading-tight">
                        {answererDef.def.name}
                        {answererDef.isBot ? " (Bot)" : ""}
                      </span>
                      <span className="block text-xs font-semibold opacity-90">{chipSub}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Dadu"
                    disabled={!(ui.phase === "lempar" && !ui.racers[ui.turn].isBot)}
                    onClick={() => roll()}
                    className={`relative aspect-square w-[76px] shrink-0 rounded-[14px] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.15)] ring-2 ring-inset ring-[rgba(23,53,43,0.13)] sm:w-[92px] ${ui.phase === "lempar" && !ui.racers[ui.turn].isBot ? "cursor-pointer" : "cursor-default"} ${ui.phase === "tanya" ? "opacity-45" : ""}`}
                  >
                    <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[14%]">
                      {Array.from({ length: 9 }, (_, i) => (
                        <span key={i} className="flex items-center justify-center">
                          {PIPS[displayFace]?.includes(i) && <span className="block h-[18px] w-[18px] rounded-full bg-[#17352B]" />}
                        </span>
                      ))}
                    </span>
                  </button>
                </div>

                <div className={`rounded-[14px] bg-white p-4 shadow ${ui.stealing ? "ring-[3px] ring-[#D9A404]" : ""}`}>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#1F7A72]">
                    {ui.stealing
                      ? `Soal Lemparan: ${subjectLabel(settings.subject, guru, lms)}`
                      : ui.bonus
                        ? `Soal Bonus: ${subjectLabel(settings.subject, guru, lms)}`
                        : `Soal untuk ${answererDef.def.name}: ${subjectLabel(settings.subject, guru, lms)}`}
                  </p>
                  {ui.q && (
                    <p
                      dir={ui.q.isArabic ? "rtl" : "ltr"}
                      lang={ui.q.isArabic ? "ar" : undefined}
                      className={`mt-1.5 break-words font-bold leading-snug text-[#17352B] ${ui.q.isArabic ? "font-arabic text-[23px]" : "text-[19px] sm:text-[21px]"}`}
                    >
                      {ui.q.prompt}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-[9px]">
                    {ui.options.map((opt, oi) => {
                      const isWrong = ui.wrong.includes(oi);
                      const isCorrect = ui.q !== null && opt === ui.q.correct;
                      const showMark = (ui.phase !== "tanya" && isCorrect) || isWrong;
                      const locked = ui.phase !== "tanya" || answererDef.isBot;
                      const ar = hasArabic(opt) || (ui.q?.isArabic ?? false);
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={locked || isWrong}
                          onClick={() => answer(ui.answerer, oi)}
                          className={`flex min-h-[52px] items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-bold text-[#17352B] sm:min-h-[56px] ${
                            isWrong
                              ? "border-[#C1440E] bg-[#FFE3D3] opacity-70"
                              : showMark && isCorrect
                                ? "border-[#4E9B47] bg-[#DCF2DC]"
                                : "border-[#D8E4DA] bg-[#FBFCF7]"
                          } ${locked && ui.phase !== "tanya" ? "opacity-55" : ""}`}
                        >
                          {showMark && <span className="shrink-0 text-lg">{isWrong ? "✗" : "✓"}</span>}
                          <span dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : undefined} className={ar ? "font-arabic text-[22px]" : "text-lg sm:text-xl"}>
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex h-[52px] items-center sm:h-14">
                  {ui.phase === "lempar" && !ui.racers[ui.turn].isBot ? (
                    <button
                      type="button"
                      onClick={() => roll()}
                      className="h-full w-full rounded-[14px] text-xl font-extrabold text-white shadow"
                      style={{ backgroundColor: ui.racers[ui.turn].def.color }}
                    >
                      🎲 Lempar Dadu
                    </button>
                  ) : (
                    <p className="w-full text-center text-sm font-semibold text-[#3D6B57]">
                      {ui.phase === "tanya" && "Jawab soal dulu untuk bisa melempar."}
                      {ui.phase === "lempar" && ui.racers[ui.turn].isBot && "Bot melempar dadu..."}
                      {ui.phase === "dadu" && "Melempar..."}
                      {ui.phase === "jalan" && (ui.walkText || "Berjalan...")}
                    </p>
                  )}
                </div>

                <div className="flex min-h-16 items-center rounded-xl border-2 border-dashed border-[#D9A404] bg-[#FFF8E1] px-3.5 py-2">
                  <p className="text-[14.5px] font-semibold leading-snug text-[#17352B]">{ui.banner}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {ui.racers.map((r, i) => (
                    <div
                      key={r.def.slot}
                      className={`flex min-h-[46px] items-center gap-2.5 rounded-[11px] px-3 py-1 ${i === ui.turn ? "ring-[3px]" : ""}`}
                      style={{ backgroundColor: r.def.soft, ["--tw-ring-color" as string]: r.def.color }}
                    >
                      <MascotFace id={r.def.sprite} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-extrabold leading-tight" style={{ color: r.def.color }}>
                          {r.def.name}
                          {r.isBot ? " (Bot)" : ""}
                          {r.skipNext && <span className="ml-1.5 text-sm text-[#B3261E]">⛔ giliran berikut dilewati</span>}
                        </span>
                        <span className="block text-[11px] font-semibold text-[#3D6B57]">
                          Benar {r.correct} dari {r.answered} soal · Tangkap {r.captures}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-[#17352B]">{progressLabel(r.progress)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {screen === "playing" && paused && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/45">
              <p className="text-3xl font-black text-white">Jeda</p>
              <button type="button" className="h-11 rounded-xl bg-white px-6 font-bold" onClick={() => setPaused(false)}>
                Lanjut Main
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-white px-6 font-bold"
                onClick={() => {
                  setPaused(false);
                  startMatch();
                }}
              >
                Ulang dari Awal
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-white px-6 font-bold"
                onClick={() => {
                  music.stop();
                  setPaused(false);
                  setScreen("home");
                }}
              >
                Ke Beranda
              </button>
            </div>
          )}
          {screen === "countdown" && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-[#CDEEDD]/85">
              <p className="text-xl font-bold text-[#1F4A4E]">{subjectLabel(settings.subject, guru, lms)}</p>
              <p className="text-8xl font-black text-[#1F7A72]">{count > 0 ? count : "Mulai!"}</p>
              <p className="max-w-md px-4 text-center text-sm font-semibold text-[#4A6B70]">
                Jawab soal dengan benar untuk melempar dadu. Keluar kandang hanya dengan angka 6, dan FINISH harus pas di langkah
                57. Tangkap pion lawan untuk mengirimnya pulang ke kandang!
              </p>
            </div>
          )}
        </div>
      )}

      {screen === "home" && (
        <div className="absolute inset-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center px-4 py-6">
            <div className="flex items-end gap-1">
              {playersFor("QUAD").map((p) => (
                <MascotFace key={p.slot} id={p.sprite} size={64} />
              ))}
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#1F4A4E]">MACCULE LUDO</h1>
            <p className="mt-1 max-w-xl text-center text-sm font-semibold text-[#4A6B70]">
              Ludo kelas dengan gerbang soal: jawab benar untuk melempar dadu, keluar kandang dengan angka 6, tangkap pion lawan,
              dan balapan mencapai FINISH di pusat papan.
            </p>

            <div className="mt-4 w-full rounded-2xl bg-white/70 p-4 text-sm font-semibold text-[#33565C]">
              <p className="font-black text-[#1F4A4E]">Cara Main</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Keluar kandang hanya dengan dadu 6. Benar menjawab soal = melempar dadu; salah = soal dilempar ke pemain berikutnya untuk direbut.</li>
                <li>Mendarat di kotak lawan menangkap pionnya pulang ke kandang. Kotak start dan kotak Bintang aman, tidak ada tangkapan di sana.</li>
                <li>Bintang memberi soal bonus, Kilat maju 4 langkah, Mundur mundur 4 langkah, Berhenti membuat satu giliranmu berikutnya dilewati.</li>
                <li>Dadu 6, menangkap lawan, dan Bintang memberi kesempatan bonus: jawab soal baru untuk melempar lagi.</li>
                <li>FINISH harus pas di langkah 57; kelebihan angka memantul mundur. Waktu habis (15 menit), kemajuan tertinggi yang menang.</li>
              </ul>
            </div>

            <p className="mt-6 self-start text-sm font-black text-[#1F4A4E]">Pilih Mata Pelajaran</p>
            <div className="mt-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
              {SUBJECTS.map((s) => {
                const n = playableQuestions(bank[s.id]).length;
                const active = settings.subject === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateSettings({ subject: s.id })}
                    className={`rounded-2xl border-2 p-3 text-left ${active ? "border-[#1F7A72] bg-white" : "border-transparent bg-white/70"}`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="block text-sm font-black">{s.title}</span>
                    <span className="block text-xs font-semibold text-[#4A6B70]">{n} soal siap main</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => updateSettings({ subject: "guru" })}
                className={`rounded-2xl border-2 p-3 text-left ${settings.subject === "guru" ? "border-[#1F7A72] bg-white" : "border-transparent bg-white/70"}`}
              >
                <span className="text-xl">🧑‍🏫</span>
                <span className="block text-sm font-black">{guru.name.trim() ? guru.name : "Mapel Guru"}</span>
                <span className="block text-xs font-semibold text-[#4A6B70]">{playableQuestions(guru.questions).length} soal siap main</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ subject: "lms" })}
                className={`rounded-2xl border-2 p-3 text-left ${settings.subject === "lms" ? "border-[#1F7A72] bg-white" : "border-transparent bg-white/70"}`}
              >
                <span className="text-xl">🏦</span>
                <span className="block text-sm font-black">{lms.name.trim() ? lms.name : "Bank Soal LMS"}</span>
                <span className="block text-xs font-semibold text-[#4A6B70]">{playableQuestions(lms.questions).length} soal siap main</span>
              </button>
            </div>

            <p className="mt-5 self-start text-sm font-black text-[#1F4A4E]">Mode Main</p>
            <div className="mt-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              {MODES.filter((m) => !narrow || m.id === "SOLO").map((m) => {
                const active = (narrow ? "SOLO" : settings.mode) === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateSettings({ mode: m.id })}
                    className={`rounded-2xl border-2 p-3 text-left ${active ? "border-[#1F7A72] bg-white" : "border-transparent bg-white/70"}`}
                  >
                    <span className="block text-sm font-black">{m.title}</span>
                    <span className="block text-xs font-semibold text-[#4A6B70]">{m.sub}</span>
                  </button>
                );
              })}
            </div>
            {narrow && (
              <p className="mt-2 w-full rounded-xl bg-white/70 p-3 text-xs font-semibold text-[#4A6B70]">
                Di HP hanya mode Solo yang ditawarkan (melawan bot). Mode Duel, Trio, dan Quad memakai layar lebar atau TV.
              </p>
            )}

            {notice && <p className="mt-3 w-full rounded-xl bg-[#FDEBD7] p-3 text-sm font-bold text-[#8F3E12]">{notice}</p>}

            <button
              type="button"
              className="mt-6 h-14 w-full rounded-2xl bg-[#1F7A72] text-xl font-black text-white shadow"
              onClick={startMatch}
            >
              Mulai Main ({effPlayable} soal siap main)
            </button>
            <div className="mt-3 grid w-full grid-cols-3 gap-2 pb-6">
              <button type="button" className="h-11 rounded-xl bg-white font-bold" onClick={() => { setBankTab(settings.subject); setScreen("bank"); }}>
                Bank Soal
              </button>
              <button type="button" className="h-11 rounded-xl bg-white font-bold" onClick={() => setScreen("score")}>
                Riwayat Skor
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-white font-bold"
                onClick={() => {
                  const next = { ...settings, sound: !settings.sound };
                  setSettings(next);
                  saveSettings(next);
                  sfx.setEnabled(next.sound);
                  if (!next.sound) music.stop();
                }}
              >
                Suara: {settings.sound ? "Nyala" : "Mati"}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "bank" && (
        <div className="absolute inset-0 overflow-y-auto bg-[#F4F1DE]">
          <div className="mx-auto w-full max-w-3xl px-4 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[#1F4A4E]">Bank Soal Maccule Ludo</h2>
              <button type="button" className="h-11 rounded-xl bg-white px-4 font-bold" onClick={() => setScreen("home")}>
                Kembali
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#4A6B70]">
              Semua soal dengan jawaban benar yang termasuk dalam pilihan jawabannya dan memiliki minimal 2 pilihan bisa dimainkan. Satu mapel
              dipilih untuk satu pertandingan Ludo.
            </p>
            <div className="mt-4">
              <LmsBankPicker onSelect={applyLmsChoice} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-bank-group={s.id}
                  onClick={() => setBankTab(s.id)}
                  className={`h-10 rounded-full px-4 text-sm font-bold ${bankTab === s.id ? "bg-[#1F7A72] text-white" : "bg-white"}`}
                >
                  {s.title} ({playableQuestions(bank[s.id]).length})
                </button>
              ))}
              <button
                type="button"
                data-bank-group="guru"
                onClick={() => setBankTab("guru")}
                className={`h-10 rounded-full px-4 text-sm font-bold ${bankTab === "guru" ? "bg-[#1F7A72] text-white" : "bg-white"}`}
              >
                Mapel Guru ({playableQuestions(guru.questions).length})
              </button>
              <button
                type="button"
                data-bank-group="lms"
                onClick={() => setBankTab("lms")}
                className={`h-10 rounded-full px-4 text-sm font-bold ${bankTab === "lms" ? "bg-[#1F7A72] text-white" : "bg-white"}`}
              >
                Bank Soal LMS ({playableQuestions(lms.questions).length})
              </button>
            </div>

            {bankTab === "guru" && (
              <label className="mt-4 block">
                <span className="text-sm font-black">Nama Mapel Guru</span>
                <input
                  className="mt-1 h-11 w-full rounded-xl border border-[#B8AC93] bg-white px-3 font-semibold"
                  value={guru.name}
                  placeholder="Misalnya: IPA Kelas 5"
                  onChange={(e) => {
                    const next = { ...guru, name: e.target.value };
                    setGuru(next);
                    saveGuru(next);
                  }}
                />
              </label>
            )}

            <p className="mt-3 text-sm font-bold">
              {bankItems.length} soal tersimpan, {bankPlayable} siap main.
            </p>
            {notice && <p className="mt-2 rounded-xl bg-[#FDEBD7] p-3 text-sm font-bold text-[#8F3E12]">{notice}</p>}

            <div className="mt-3 space-y-2">
              {bankItems.map((q) => {
                const ready = playableQuestions([q]).length === 1;
                return (
                  <div key={q.id} data-bank-item={q.id} className="flex items-start gap-3 rounded-xl bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p dir={q.isArabic ? "rtl" : "ltr"} lang={q.isArabic ? "ar" : undefined} className={q.isArabic ? "font-arabic font-bold" : "font-bold"}>
                        {q.prompt}
                      </p>
                      <p className="text-xs font-semibold text-[#4A6B70]">
                        Jawaban benar: {q.correct}
                        {ready ? " (siap main)" : " (belum siap main)"}
                      </p>
                    </div>
                    <button type="button" className="h-9 shrink-0 rounded-lg bg-[#FDEBD7] px-3 text-sm font-bold text-[#8F3E12]" onClick={() => deleteQuestion(q.id)}>
                      Hapus
                    </button>
                  </div>
                );
              })}
              {bankItems.length === 0 && <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#4A6B70]">Belum ada soal di kelompok ini.</p>}
            </div>

            <form
              data-bank-form="1"
              className="mt-5 rounded-2xl bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                addQuestion();
              }}
            >
              <p className="font-black">Tambah Soal</p>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[#B8AC93] px-3 font-semibold"
                placeholder="Tulis soal, misalnya: 8 + 7 = ..."
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                {form.options.map((o, i) => (
                  <input
                    key={i}
                    className="h-11 rounded-xl border border-[#B8AC93] px-3 font-semibold"
                    placeholder={`Pilihan ${"ABCD"[i]}`}
                    value={o}
                    onChange={(e) => {
                      const options = [...form.options] as [string, string, string, string];
                      options[i] = e.target.value;
                      setForm({ ...form, options });
                    }}
                  />
                ))}
              </div>
              <label className="mt-2 block text-sm font-bold">
                Jawaban benar:
                <select
                  className="ml-2 h-10 rounded-lg border border-[#B8AC93] px-2 font-bold"
                  value={form.correctIdx}
                  onChange={(e) => setForm({ ...form, correctIdx: Number(e.target.value) })}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <option key={i} value={i}>
                      Pilihan {"ABCD"[i]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="mt-3 h-11 w-full rounded-xl bg-[#1F7A72] font-black text-white">
                Simpan Soal
              </button>
            </form>

            <div data-import-panel="1" className="mt-4 rounded-2xl bg-white p-4">
              <p className="font-black">Impor Soal Massal (Markdown / CSV)</p>
              <textarea
                className="mt-2 h-32 w-full rounded-xl border border-[#B8AC93] p-3 font-mono text-sm"
                placeholder="Tempel soal berformat Markdown atau CSV di sini"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="h-11 rounded-xl bg-[#1F7A72] font-black text-white" onClick={runImport}>
                  Impor Sekarang
                </button>
                <button type="button" className="h-11 rounded-xl bg-[#EDE6D6] font-bold" onClick={() => download("template-soal-ludo-angka.md", templateMarkdown(), "text/markdown")}>
                  Unduh Template
                </button>
                <button type="button" className="h-11 rounded-xl bg-[#EDE6D6] font-bold" onClick={() => download("bank-ludo-angka.json", JSON.stringify(bank, null, 2), "application/json")}>
                  Ekspor JSON
                </button>
                <button
                  type="button"
                  className="h-11 rounded-xl bg-[#EDE6D6] font-bold"
                  onClick={() => {
                    if (window.confirm("Atur ulang bank bawaan ke isi semula? Suntingan pada mapel bawaan akan hilang.")) {
                      const fresh = resetBank();
                      setBank(fresh);
                      setNotice("Bank bawaan sudah diatur ulang.");
                    }
                  }}
                >
                  Atur Ulang Bank
                </button>
              </div>
              <button type="button" className="mt-3 text-sm font-black text-[#1F7A72] underline" onClick={() => setShowPrompt((s) => !s)}>
                Petunjuk & Prompt untuk AI
              </button>
              {showPrompt && (
                <div className="mt-2">
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#F4F1DE] p-3 text-xs font-semibold">{promptTemplateSoal()}</pre>
                  <button type="button" className="mt-2 h-11 w-full rounded-xl bg-[#1F7A72] font-black text-white" onClick={copyPrompt}>
                    {copied ? "Prompt Tersalin" : "Salin Prompt"}
                  </button>
                  <p className="mt-2 text-xs font-semibold text-[#4A6B70]">
                    Ingat: jawaban benar harus termasuk dalam pilihan jawaban, dan pilihan minimal 2, agar soal siap main.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {screen === "result" && (
        <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#CDEEDD] to-[#F4F1DE]">
          <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col items-center px-4 py-8">
            <p className="mt-2 text-6xl">🏆</p>
            {(() => {
              const champs = finalRacers.filter((r) => winInfo.winners.includes(r.def.name));
              const others = finalRacers.filter((r) => !winInfo.winners.includes(r.def.name));
              const champColor = champs[0]?.def.color ?? "#1F7A72";
              return (
                <>
                  <div className="mt-3 flex min-h-[84px] w-full flex-col items-center justify-center rounded-2xl px-4 py-3 text-center text-white" style={{ backgroundColor: champColor }}>
                    <p className="text-3xl font-black">{winInfo.winners.join(" dan ")}</p>
                    <p className="mt-0.5 text-base font-semibold">
                      {winInfo.winners.length > 1
                        ? "Menang bersama karena waktu habis, kemajuan tertinggi"
                        : winInfo.reason === "finish"
                          ? "Menang dengan mencapai FINISH"
                          : "Menang karena waktu habis, kemajuan tertinggi"}
                    </p>
                  </div>
                  <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                    {champs.map((r) => (
                      <div key={r.def.slot} className="flex flex-col items-center rounded-2xl bg-white p-4">
                        <MascotFace id={r.def.sprite} size={96} />
                        <p className="mt-1 text-[26px] font-black" style={{ color: r.def.color }}>
                          {r.def.name}
                          {r.isBot ? " (Bot)" : ""}
                        </p>
                        <p className="text-lg font-bold text-[#17352B]">{progressLabel(r.progress)}</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#3D6B57]">
                          Benar {r.correct} dari {r.answered} soal · Tangkap {r.captures}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 w-full space-y-2">
                    {others.map((r) => (
                      <div key={r.def.slot} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                        <MascotFace id={r.def.sprite} size={48} />
                        <span className="flex-1">
                          <span className="block text-lg font-extrabold" style={{ color: r.def.color }}>
                            {r.def.name}
                            {r.isBot ? " (Bot)" : ""}
                          </span>
                          <span className="block text-[13px] font-semibold text-[#3D6B57]">
                            Benar {r.correct} dari {r.answered} soal · Tangkap {r.captures}
                          </span>
                        </span>
                        <span className="text-base font-bold text-[#17352B]">{progressLabel(r.progress)}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <button type="button" className="mt-6 h-14 w-full rounded-[14px] bg-[#1F7A72] text-xl font-extrabold text-white" onClick={startMatch}>
              Main Lagi
            </button>
            <button type="button" className="mt-3 h-[52px] w-full rounded-[14px] border-[3px] border-[#17352B] bg-white text-lg font-extrabold text-[#17352B]" onClick={() => setScreen("home")}>
              Beranda
            </button>
          </div>
        </div>
      )}

      {screen === "score" && (
        <div className="absolute inset-0 overflow-y-auto bg-[#F4F1DE]">
          <div className="mx-auto w-full max-w-3xl px-4 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[#1F4A4E]">Riwayat Skor</h2>
              <button type="button" className="h-11 rounded-xl bg-white px-4 font-bold" onClick={() => setScreen("home")}>
                Kembali
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {scores.map((r, i) => (
                <div key={i} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-black">
                    {r.at} · {r.mode} · {r.subject}
                  </p>
                  <p className="font-semibold text-[#4A6B70]">
                    Pemenang: {r.winner} ({r.reason === "finish" ? "mencapai FINISH" : "waktu habis"}) ·{" "}
                    {r.results.map((x) => `${x.name} ${progressLabel(x.pos)}`).join(" · ")}
                  </p>
                </div>
              ))}
              {scores.length === 0 && <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#4A6B70]">Belum ada pertandingan yang selesai.</p>}
            </div>
            {scores.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 pb-6">
                <button type="button" className="h-11 rounded-xl bg-[#1F7A72] font-black text-white" onClick={() => download("skor-ludo-angka.csv", scoresCsv(scores), "text/csv")}>
                  Unduh CSV
                </button>
                <button
                  type="button"
                  className="h-11 rounded-xl bg-white font-bold"
                  onClick={() => {
                    clearScores();
                    setScores([]);
                  }}
                >
                  Hapus Riwayat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
