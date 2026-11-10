"use client";

/**
 * Jejak Angka Ular Tangga: komponen utama (Log 77). Layar DOM
 * (beranda, bank soal, riwayat, hasil, panel soal) + papan canvas.
 * Mesin giliran hidup di matchRef dan digerakkan fungsi mesin di
 * badan komponen; panel dirender dari snapshot ui yang disalin
 * setiap transisi. Pola dataset uji, startMatch, mode HP, dan
 * cleanup meniru seri ketapel dan versi sungai game ini.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LmsBankPicker, type LmsBankChoice } from "@/modules/game-bank/connector";
import { hasArabic } from "../lib-pendamping/game-catalog";
import { music } from "../lib-pendamping/music";
import { sfx } from "../lib-pendamping/sfx";
import {
  Deck,
  MODES,
  PRINTED,
  RULES,
  SUBJECTS,
  clearScores,
  emptyRacer,
  generateHidden,
  loadBank,
  loadGuru,
  loadLms,
  loadScores,
  loadSettings,
  moveWithBounce,
  playableQuestions,
  playersFor,
  promptTemplateSoal,
  parseCsvBank,
  parseMarkdownBank,
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
  scoresCsv,
  shuffleArr,
  templateMarkdown,
  type Bank,
  type ContentSubjectId,
  type GameMode,
  type GuruBank,
  type HiddenSpecial,
  type Q,
  type RacerState,
  type ScoreRec,
  type Screen,
  type Settings,
  type SpriteId,
  type SubjectChoice,
  type WinReason,
} from "./logic";
import {
  boardGeom,
  buildStaticBoard,
  drawParticles,
  drawScene,
  pathPoint,
  specialPoint,
  squareCenter,
  tokenSlotGeom,
  type Particle,
  type TokenView,
} from "./render";
import { SPRITES } from "./sprites";

const rnd = Math.random;

const subjectList = (subject: SubjectChoice, bank: Bank, guru: GuruBank, lms: GuruBank): Q[] =>
  subject === "guru" ? guru.questions : subject === "lms" ? lms.questions : bank[subject];

const subjectLabel = (subject: SubjectChoice, guru: GuruBank, lms: GuruBank): string => {
  if (subject === "guru") return guru.name.trim() ? guru.name : "Mapel Guru";
  if (subject === "lms") return lms.name.trim() ? lms.name : "Bank Soal LMS";
  return SUBJECTS.find((s) => s.id === subject)?.title ?? subject;
};

function MascotFace({ id, size }: { id: SpriteId; size: number }) {
  const def = SPRITES[id];
  return (
    <div
      aria-label={def.label}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${def.src})`,
        backgroundSize: "200% 200%",
        backgroundPosition: "0% 0%",
      }}
    />
  );
}

type Phase = "tanya" | "lempar" | "dadu" | "jalan";

interface WalkAnim {
  racer: number;
  path: number[] | null;
  special: HiddenSpecial | null;
  t0: number;
  dur: number;
}

interface MatchState {
  racers: RacerState[];
  deck: Deck;
  hiddenByFrom: Map<number, HiddenSpecial>;
  hiddenList: HiddenSpecial[];
  revealed: Map<number, number>;
  turn: number;
  answerer: number;
  phase: Phase;
  q: Q | null;
  options: string[];
  wrong: Set<string>;
  stealOwner: number | null;
  stealTried: Set<number>;
  bonus: boolean;
  rollFrom: "biasa" | "lemparan" | "bonus";
  dice: number | null;
  banner: string;
  bannerColor: string;
  boardBanner: { text: string; color: string; at: number } | null;
  walk: WalkAnim | null;
  walkDone: (() => void) | null;
  walkText: string;
  timeLeft: number;
  timeUp: boolean;
  now: number;
}

interface UiSnap {
  turn: number;
  answerer: number;
  phase: Phase;
  q: Q | null;
  options: string[];
  wrong: string[];
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

/** Jalur kotak yang dilewati pion dari from sejauh roll langkah, memantul di 100. */
function dicePath(from: number, roll: number): number[] {
  const path = [from];
  let cur = from;
  let dir = 1;
  for (let i = 0; i < roll; i++) {
    cur += dir;
    if (cur > 100) {
      cur = 200 - cur;
      dir = -1;
    }
    path.push(cur);
  }
  return path;
}

/** Jalur lurus dari from ke to selangkah demi selangkah. */
function linePath(from: number, to: number): number[] {
  const path = [from];
  const dir = to > from ? 1 : -1;
  let cur = from;
  while (cur !== to) {
    cur += dir;
    path.push(cur);
  }
  return path;
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function JejakAngkaGame() {
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const matchRef = useRef<MatchState | null>(null);
  const boardSizeRef = useRef<{ css: number; dpr: number }>({ css: 300, dpr: 1 });
  const staticRef = useRef<{ key: string; cv: HTMLCanvasElement } | null>(null);
  const imagesRef = useRef<Map<SpriteId, HTMLImageElement | null>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
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

  /** Ke Beranda dari tengah pertandingan: pertandingan dinyatakan berakhir
   *  dan semua timer dibersihkan, supaya tidak ada callback sisa (misalnya
   *  settleDice animasi dadu) yang menembak di layar beranda. */
  const goHome = useCallback(() => {
    endedRef.current = true;
    clearTimers();
    music.stop();
    setPaused(false);
    setScreen("home");
  }, [clearTimers]);

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

  const setBanner = useCallback(
    (text: string, color: string, board: boolean) => {
      const m = matchRef.current;
      if (!m) return;
      m.banner = text;
      m.bannerColor = color;
      if (board) m.boardBanner = { text, color, at: m.now };
    },
    [],
  );

  /* ---------------------------------------------------------- mount */

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    for (const def of Object.values(SPRITES)) {
      const img = new Image();
      img.src = def.src;
      imagesRef.current.set(def.id, img);
    }
  }, []);

  useEffect(() => {
    const wrap = boardWrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const css = Math.max(2, Math.floor(Math.min(r.width, r.height)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      boardSizeRef.current = { css, dpr };
      cv.width = Math.floor(css * dpr);
      cv.height = Math.floor(css * dpr);
      staticRef.current = null;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [screen]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /* ---------------------------------------------------------- musik */

  useEffect(() => {
    if (screen === "home" || screen === "bank" || screen === "score") music.stop();
  }, [screen]);

  useEffect(() => {
    if (screen !== "countdown") return;
    setCount(3);
    if (settings.sound) music.play("jejak-angka");
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
      results: rankRacers(m.racers).map((r) => ({ name: r.def.name, pos: r.pos })),
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
    let nxt = fromIdx;
    for (let k = 0; k < m.racers.length; k++) {
      nxt = (nxt + 1) % m.racers.length;
      const cand = m.racers[nxt];
      if (cand.skipNext) {
        cand.skipNext = false;
        setBanner(`Giliran ${cand.def.name} dilewati karena ujian yang gagal.`, "#B3261E", false);
        continue;
      }
      break;
    }
    startTurn(nxt);
  };

  const burstAt = (x: number, y: number, color: string): void => {
    for (let k = 0; k < 14; k++) {
      particlesRef.current.push({
        x,
        y,
        vx: (rnd() - 0.5) * 240,
        vy: -40 - rnd() * 170,
        life: 0.8,
        maxLife: 0.8,
        color: k % 2 === 0 ? color : "#F5B301",
        size: 2.5 + rnd() * 3,
      });
    }
  };

  const startPathWalk = (racerIdx: number, path: number[], done: () => void): void => {
    const m = matchRef.current;
    if (!m) return;
    m.walk = { racer: racerIdx, path, special: null, t0: m.now, dur: Math.max(1, (path.length - 1) * RULES.stepMs) };
    m.walkDone = done;
    m.phase = "jalan";
    syncUi();
  };

  const startSpecialWalk = (racerIdx: number, spec: HiddenSpecial, done: () => void): void => {
    const m = matchRef.current;
    if (!m) return;
    const dist = Math.abs(spec.to - spec.from);
    const dur = Math.min(900, Math.max(240, dist * 120));
    m.walk = { racer: racerIdx, path: null, special: spec, t0: m.now, dur };
    m.walkDone = done;
    m.phase = "jalan";
    syncUi();
  };

  const resolveLanding = (racerIdx: number, chained: boolean): void => {
    const m = matchRef.current;
    if (!m || endedRef.current) return;
    const r = m.racers[racerIdx];
    if (r.pos >= 100) {
      setBanner(`${r.def.name} mencapai kotak 100!`, "#1F7A3D", true);
      finish("finish");
      return;
    }
    const spec = m.hiddenByFrom.get(r.pos);
    if (spec) {
      if (!m.revealed.has(spec.from)) {
        m.revealed.set(spec.from, m.now);
        if (spec.kind === "tangga") r.ladders += 1;
        else r.snakes += 1;
      }
      const text =
        spec.kind === "tangga"
          ? `Tangga tersembunyi di kotak ${spec.from}! ${r.def.name} naik ke ${spec.to}.`
          : `Ular tersembunyi di kotak ${spec.from}! ${r.def.name} meluncur turun ke ${spec.to}.`;
      setBanner(text, "#8E44AD", true);
      sfx.play(spec.kind === "tangga" ? "swish" : "bonk");
      const ctr = squareCenter(spec.from, boardSizeRef.current.css);
      burstAt(ctr.x, ctr.y, "#8E44AD");
      syncUi();
      later(RULES.bannerMs, () => {
        startSpecialWalk(racerIdx, spec, () => {
          r.pos = spec.to;
          resolveLanding(racerIdx, true);
        });
      });
      return;
    }
    const printed = PRINTED[r.pos];
    if (printed === "bintang") {
      if (m.timeUp) {
        finish("batas");
        return;
      }
      setBanner(`${r.def.name} mendarat di kotak Bintang! Jawab soal bonus untuk melempar lagi.`, "#B8860B", false);
      startQuestion(racerIdx, true);
      return;
    }
    if ((printed === "kilat" || printed === "mundur") && !chained) {
      const delta = printed === "kilat" ? RULES.kilatStep : -RULES.mundurStep;
      const to = Math.max(1, Math.min(99, r.pos + delta));
      const text =
        printed === "kilat"
          ? `Kotak Kilat! ${r.def.name} maju 4 kotak ke ${to}.`
          : `Kotak Rintangan! ${r.def.name} mundur 4 kotak ke ${to}.`;
      setBanner(text, printed === "kilat" ? "#0277BD" : "#C1440E", true);
      sfx.play(printed === "kilat" ? "pop" : "swish");
      m.walkText = text;
      syncUi();
      later(RULES.bannerMs, () => {
        startPathWalk(racerIdx, linePath(r.pos, to), () => {
          r.pos = to;
          resolveLanding(racerIdx, true);
        });
      });
      return;
    }
    if (printed === "ujian" && !r.ujian) {
      r.ujian = true;
      setBanner(
        `Kotak Ujian! ${r.def.name} ditandai ujian. Salah pada giliran berikutnya berarti kehilangan satu giliran.`,
        "#B3261E",
        true,
      );
      syncUi();
      later(RULES.bannerMs, () => endTurn(racerIdx));
      return;
    }
    endTurn(racerIdx);
  };

  const settleDice = (): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.dice === null) return;
    const r = m.racers[m.turn];
    const from = r.pos;
    const roll = m.dice;
    const mv = moveWithBounce(from, roll);
    m.walkText = `Berjalan ${roll} kotak: ${from} → ${mv.to}`;
    sfx.play("pop");
    startPathWalk(m.turn, dicePath(from, roll), () => {
      r.pos = mv.to;
      if (mv.bounced) {
        setBanner(`Kelebihan ${from + roll - 100} angka! ${r.def.name} memantul mundur ke ${mv.to}.`, "#3D6B57", false);
        syncUi();
        later(900, () => resolveLanding(m.turn, false));
        return;
      }
      resolveLanding(m.turn, false);
    });
  };

  const roll = (): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.phase !== "lempar") return;
    m.dice = rollDice(rnd);
    m.phase = "dadu";
    sfx.play("tick");
    syncUi();
  };

  const answer = (opt: string): void => {
    const m = matchRef.current;
    if (!m || endedRef.current || m.phase !== "tanya" || !m.q) return;
    if (m.wrong.has(opt)) return;
    const r = m.racers[m.answerer];
    const isOwnTurn = m.stealOwner === null && !m.bonus;
    r.answered += 1;
    if (opt === m.q.correct) {
      r.correct += 1;
      m.rollFrom = m.bonus ? "bonus" : m.stealOwner !== null ? "lemparan" : "biasa";
      sfx.play("correct");
      let text = `Benar! ${r.def.name} melempar dadu.`;
      if (m.stealOwner !== null) text = `${r.def.name} merebut soal! ${r.def.name} yang melempar dadu.`;
      if (m.bonus) text = `Bonus benar! ${r.def.name} melempar lagi.`;
      if (isOwnTurn && r.ujian) {
        r.ujian = false;
        text = `Ujian lolos! ${r.def.name} menjawab benar, tanda ujian hilang. ${r.def.name} melempar dadu.`;
      }
      m.turn = m.answerer;
      m.stealOwner = null;
      m.stealTried = new Set();
      setBanner(text, "#1F7A3D", false);
      m.phase = "lempar";
      syncUi();
      return;
    }
    sfx.play("wrong");
    m.wrong.add(opt);
    let ujianFailed = false;
    if (isOwnTurn && r.ujian) {
      r.ujian = false;
      r.skipNext = true;
      ujianFailed = true;
    }
    if (m.bonus) {
      setBanner(`Bonus gagal. Giliran ${r.def.name} selesai.`, "#C1440E", false);
      syncUi();
      endTurn(m.turn);
      return;
    }
    const owner = m.stealOwner ?? m.answerer;
    if (m.stealOwner === null) m.stealOwner = m.answerer;
    m.stealTried.add(m.answerer);
    let nxt = -1;
    for (let k = 1; k < m.racers.length; k++) {
      const cand = (m.answerer + k) % m.racers.length;
      if (cand !== owner && !m.stealTried.has(cand)) {
        nxt = cand;
        break;
      }
    }
    if (ujianFailed) {
      setBanner(
        `Ujian gagal! ${r.def.name} salah saat tanda ujian aktif, jadi ${r.def.name} kehilangan giliran berikutnya.`,
        "#B3261E",
        false,
      );
    }
    if (nxt >= 0) {
      m.answerer = nxt;
      if (!ujianFailed) {
        setBanner(`Jawaban salah! Soal dilempar ke ${m.racers[nxt].def.name}. Rebut lemparannya!`, "#B8860B", false);
      }
      m.phase = "tanya";
      syncUi();
    } else {
      if (!ujianFailed) {
        let peek = owner;
        for (let k = 0; k < m.racers.length; k++) {
          peek = (peek + 1) % m.racers.length;
          if (m.racers[peek].skipNext) continue;
          break;
        }
        setBanner(`Tidak ada yang berhasil merebut. Giliran lanjut ke ${m.racers[peek].def.name}.`, "#3D6B57", false);
      } else {
      }
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
    if (settings.subject !== "guru" && playable.length < 2) {
      setNotice("Mapel ini butuh minimal 2 soal siap main. Tambahkan dulu lewat Bank Soal.");
      return;
    }
    setNotice("");
    sfx.setEnabled(settings.sound);
    const effMode: GameMode = narrow ? "SOLO" : settings.mode;
    modeRef.current = effMode;
    clearTimers();
    const hidden = generateHidden(rnd);
    matchRef.current = {
      racers: racersFor(effMode).map(emptyRacer),
      deck: new Deck(playable, rnd),
      hiddenByFrom: new Map(hidden.map((h) => [h.from, h])),
      hiddenList: hidden,
      revealed: new Map(),
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
      banner: "Jawab soal dengan benar untuk bisa melempar dadu.",
      bannerColor: "#3D6B57",
      boardBanner: null,
      walk: null,
      walkDone: null,
      walkText: "",
      timeLeft: RULES.durationSec,
      timeUp: false,
      now: 0,
    };
    particlesRef.current = [];
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
        const pick =
          rnd() < RULES.botAccuracy
            ? mm.q.correct
            : (() => {
                const wrongs = mm.options.filter((o) => o !== mm.q!.correct && !mm.wrong.has(o));
                return wrongs.length > 0 ? wrongs[Math.floor(rnd() * wrongs.length)] : mm.q.correct;
              })();
        machineRef.current.answer(pick);
      } else {
        if (mm.phase !== "lempar" || mm.turn !== actorIdx) return;
        machineRef.current.roll();
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [screen, uiPhase, uiAnswerer, uiTurn, paused]);

  useEffect(() => {
    if (!ui || ui.phase !== "dadu" || screen !== "playing") return;
    let ticks = 0;
    const iv = window.setInterval(() => {
      if (pausedRef.current) return;
      // Layar sudah bukan playing (misalnya Beranda ditekan saat dadu
      // berputar): interval mati di sini dan settleDice tidak menembak.
      if (screenRef.current !== "playing" || endedRef.current) {
        window.clearInterval(iv);
        return;
      }
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
  }, [ui?.phase, ui?.dice, screen]);

  /* ------------------------------------------------------ jam tanding */

  useEffect(() => {
    if (screen !== "playing") return;
    const iv = window.setInterval(() => {
      const m = matchRef.current;
      if (!m || endedRef.current || pausedRef.current) return;
      m.timeLeft = Math.max(0, m.timeLeft - 0.25);
      if (m.timeLeft <= 0 && !m.timeUp) {
        m.timeUp = true;
        setBanner("Waktu habis! Pertandingan berhenti. Posisi tertinggi yang menang.", "#B3261E", true);
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

  /* ---------------------------------------------------------- loop */

  useEffect(() => {
    if (screen !== "playing" && screen !== "countdown") return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let lastTs = 0;
    const step = (ts: number) => {
      raf = requestAnimationFrame(step);
      const dt = lastTs > 0 ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const m = matchRef.current;
      if (!m) return;
      if (!pausedRef.current && screenRef.current === "playing") {
        m.now += dt * 1000;
        if (m.walk && m.now - m.walk.t0 >= m.walk.dur) {
          const done = m.walkDone;
          m.walk = null;
          m.walkDone = null;
          if (done) done();
        }
        for (const p of particlesRef.current) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 420 * dt;
        }
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      }
      const { css, dpr } = boardSizeRef.current;
      const S = css;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const key = `${Math.floor(S * dpr)}`;
      if (!staticRef.current || staticRef.current.key !== key) {
        staticRef.current = { key, cv: buildStaticBoard(Math.floor(S * dpr)) };
      }
      const geom = boardGeom(S);
      const walk = m.walk;
      const groups = new Map<number, number[]>();
      m.racers.forEach((r, i) => {
        if (walk && walk.racer === i) return;
        const arr = groups.get(r.pos) ?? [];
        arr.push(i);
        groups.set(r.pos, arr);
      });
      const tokens: TokenView[] = [];
      m.racers.forEach((r, i) => {
        let x: number;
        let y: number;
        let d: number;
        if (walk && walk.racer === i) {
          const t = Math.min(1, Math.max(0, (m.now - walk.t0) / walk.dur));
          const pt = walk.special ? specialPoint(walk.special, t, S) : pathPoint(walk.path ?? [r.pos], t, S);
          x = pt.x;
          y = pt.y;
          d = 0.92 * geom.cell;
        } else {
          const group = groups.get(r.pos) ?? [i];
          const idx = group.indexOf(i);
          const slot = tokenSlotGeom(group.length, idx, geom.cell);
          const c = squareCenter(r.pos, S);
          x = c.x + slot.dx;
          y = c.y + slot.dy;
          d = slot.d;
        }
        tokens.push({
          racer: r,
          x,
          y,
          d,
          active: i === (m.phase === "tanya" ? m.answerer : m.turn),
        });
      });
      const revealed = Array.from(m.revealed.entries()).map(([from, at]) => ({
        spec: m.hiddenByFrom.get(from)!,
        progress: Math.min(1, Math.max(0, (m.now - at) / 450)),
      }));
      const bb = m.boardBanner;
      const banner =
        bb && m.now - bb.at < RULES.bannerMs
          ? { text: bb.text, color: bb.color, progress: (m.now - bb.at) / RULES.bannerMs }
          : null;
      drawScene(ctx, {
        S,
        bg: staticRef.current.cv,
        revealed,
        tokens,
        images: imagesRef.current,
        banner,
        now: m.now,
      });
      drawParticles(ctx, particlesRef.current);
      cv.dataset.state = pausedRef.current ? "paused" : "playing";
      cv.dataset.lanes = String(playersFor(modeRef.current).length);
      cv.dataset.players = String(m.racers.length);
      cv.dataset.turn = String(m.turn);
      cv.dataset.answerer = String(m.answerer);
      cv.dataset.phase = m.phase;
      cv.dataset.dice = m.dice === null ? "" : String(m.dice);
      cv.dataset.question = m.q?.prompt ?? "";
      cv.dataset.timeLeft = String(Math.ceil(m.timeLeft));
      cv.dataset.banner = m.banner;
      m.racers.forEach((r, i) => {
        cv.dataset[`pos${i}`] = String(r.pos);
        cv.dataset[`skip${i}`] = r.skipNext ? "1" : "0";
        cv.dataset[`ujian${i}`] = r.ujian ? "1" : "0";
      });
      cv.dataset.revealed = JSON.stringify(
        Array.from(m.revealed.keys()).map((from) => {
          const s = m.hiddenByFrom.get(from)!;
          return { kind: s.kind, from: s.from, to: s.to };
        }),
      );
      cv.dataset.specials = JSON.stringify(m.hiddenList);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [screen, syncUi]);

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
      window.setTimeout(() => setCopied(false), 1800);
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
      return answererDef.ujian ? "Menjawab soal · ditandai ujian ✎" : "Menjawab soal";
    }
    if (ui.phase === "lempar") return "Melempar dadu";
    if (ui.phase === "dadu") return "Dadu berputar...";
    return "Berjalan...";
  })();

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-[#CDEEDD] font-sans text-[#22303A]">
      {(screen === "playing" || screen === "countdown") && ui && answererDef && (
        <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#CDEEDD] to-[#F4F1DE]" onPointerDown={() => sfx.resume()}>
          <div className="mx-auto w-full max-w-[1600px] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-black tracking-tight text-[#17352B] sm:text-xl">MALLALENG ANGKA: ULAR TANGGA</h1>
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
                      onClick={goHome}
                    >
                      ⌂
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              <div ref={boardWrapRef} className="relative aspect-square w-full shrink-0 lg:w-[min(92dvh,960px)]">
                <canvas ref={canvasRef} data-testid="jejak-angka-canvas" className="absolute inset-0 h-full w-full" />
              </div>

              <div className="flex w-full max-w-[600px] flex-col gap-3">
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
                      className={`mt-1.5 font-bold leading-snug text-[#17352B] ${ui.q.isArabic ? "font-arabic text-[23px]" : "text-[19px] sm:text-[21px]"}`}
                    >
                      {ui.q.prompt}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-[9px]">
                    {ui.options.map((opt) => {
                      const isWrong = ui.wrong.includes(opt);
                      const isCorrect = ui.q !== null && opt === ui.q.correct;
                      const showMark = (ui.phase !== "tanya" && isCorrect) || isWrong;
                      const locked = ui.phase !== "tanya" || answererDef.isBot;
                      const ar = hasArabic(opt) || (ui.q?.isArabic ?? false);
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={locked || isWrong}
                          onClick={() => answer(opt)}
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
                      {ui.phase === "jalan" && ui.walkText}
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
                      className={`flex h-[46px] items-center gap-2.5 rounded-[11px] px-3 ${i === ui.turn ? "ring-[3px]" : ""}`}
                      style={{ backgroundColor: r.def.soft, ["--tw-ring-color" as string]: r.def.color }}
                    >
                      <MascotFace id={r.def.sprite} size={36} />
                      <span className="flex-1 text-base font-extrabold" style={{ color: r.def.color }}>
                        {r.def.name}
                        {r.isBot ? " (Bot)" : ""}
                        {r.ujian && <span className="ml-1.5 text-[#B3261E]">✎ ujian</span>}
                      </span>
                      <span className="text-sm font-bold text-[#17352B]">Kotak {r.pos}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {screen === "playing" && paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/45">
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
                onClick={goHome}
              >
                Ke Beranda
              </button>
            </div>
          )}
          {screen === "countdown" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#CDEEDD]/85">
              <p className="text-xl font-bold text-[#1F4A4E]">{subjectLabel(settings.subject, guru, lms)}</p>
              <p className="text-8xl font-black text-[#1F7A72]">{count > 0 ? count : "Mulai!"}</p>
              <p className="max-w-md px-4 text-center text-sm font-semibold text-[#4A6B70]">
                Jawab soal dengan benar untuk melempar dadu dan berjalan ke kotak 100. Salah, soal dilempar ke pemain berikutnya. Tangga dan ular
                bersembunyi di papan: baru ketahuan saat terinjak!
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
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#1F4A4E]">Mallaleng Angka</h1>
            <p className="mt-1 max-w-xl text-center text-sm font-semibold text-[#4A6B70]">
              Ular tangga sembunyi: jawab soal dengan benar untuk melempar dadu dan berjalan ke kotak 100. Di papan bersembunyi 10 tangga dan 10
              ular yang diacak setiap pertandingan, baru ketahuan saat terinjak.
            </p>

            <div className="mt-4 w-full rounded-2xl bg-white/70 p-4 text-sm font-semibold text-[#33565C]">
              <p className="font-black text-[#1F4A4E]">Cara Main</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Benar menjawab soal = melempar dadu dan berjalan. Salah = soal dilempar ke pemain berikutnya untuk direbut.</li>
                <li>Kotak Bintang memberi soal bonus, Kilat maju 4, Rintangan mundur 4, Kotak Ujian bisa membuatmu kehilangan satu giliran.</li>
                <li>Masuk kotak 100 harus dengan angka pas; kelebihan angka memantul mundur.</li>
                <li>Waktu habis (15 menit), posisi tertinggi yang menang.</li>
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
              <h2 className="text-2xl font-black text-[#1F4A4E]">Bank Soal Mallaleng Angka</h2>
              <button type="button" className="h-11 rounded-xl bg-white px-4 font-bold" onClick={() => setScreen("home")}>
                Kembali
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#4A6B70]">
              Semua soal dengan jawaban benar yang termasuk dalam pilihan jawabannya dan memiliki minimal 2 pilihan bisa dimainkan. Satu mapel
              dipilih untuk satu pertandingan ular tangga.
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
                <button type="button" className="h-11 rounded-xl bg-[#EDE6D6] font-bold" onClick={() => download("template-soal-jejak-angka.md", templateMarkdown(), "text/markdown")}>
                  Unduh Template
                </button>
                <button type="button" className="h-11 rounded-xl bg-[#EDE6D6] font-bold" onClick={() => download("bank-jejak-angka.json", JSON.stringify(bank, null, 2), "application/json")}>
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
                        ? "Menang bersama karena waktu habis, posisi tertinggi"
                        : winInfo.reason === "finish"
                          ? "Menang dengan mencapai kotak 100"
                          : "Menang karena waktu habis, posisi tertinggi"}
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
                        <p className="text-lg font-bold text-[#17352B]">Kotak {r.pos}</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#3D6B57]">
                          Benar {r.correct} dari {r.answered} soal · Tangga {r.ladders} · Ular {r.snakes}
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
                            Benar {r.correct} dari {r.answered} soal · Tangga {r.ladders} · Ular {r.snakes}
                          </span>
                        </span>
                        <span className="text-base font-bold text-[#17352B]">Kotak {r.pos}</span>
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
                    Pemenang: {r.winner} ({r.reason === "finish" ? "mencapai kotak 100" : "waktu habis"}) ·{" "}
                    {r.results.map((x) => `${x.name} kotak ${x.pos}`).join(" · ")}
                  </p>
                </div>
              ))}
              {scores.length === 0 && <p className="rounded-xl bg-white p-3 text-sm font-semibold text-[#4A6B70]">Belum ada pertandingan yang selesai.</p>}
            </div>
            {scores.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 pb-6">
                <button type="button" className="h-11 rounded-xl bg-[#1F7A72] font-black text-white" onClick={() => download("skor-jejak-angka.csv", scoresCsv(scores), "text/csv")}>
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
