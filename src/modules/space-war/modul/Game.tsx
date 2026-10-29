"use client";

/**
 * Perang Antariksa — game ketik jawaban (Log 60).
 *
 * Asteroid membawa soal, pemain MENGETIK jawabannya di keypad besar
 * lajurnya sendiri lalu menembak. Jawaban benar: asteroid meledak +10.
 * Jawaban salah: asteroid terguncang dan melompat lebih dekat. Asteroid
 * yang menembus garis pertahanan: -5. Ronde 180 detik, skor tertinggi
 * menang. Sistem sama dengan game besar lain: mapel bawaan + Mapel Guru
 * + impor Markdown/CSV + papan skor lokal + musik hijaz tema "space".
 */

import Link from "next/link";
import { LmsBankPicker } from "@/modules/game-bank/connector";
import { useCallback, useEffect, useRef, useState } from "react";
import { music } from "../lib-pendamping/music";
import { sfx } from "../lib-pendamping/sfx";
import {
  LANE_DEFS, MODES, RULES, SUBJECTS,
  effectiveBank, genNumerasi, hasArabic, loadBankOverrides, loadGuru, loadScores,
  loadSettings, makeQueue, parseCsvBank, parseMarkdownBank, promptTemplateSoal,
  saveBankOverrides, saveGuru, saveScore, saveSettings, shuffle, templateMarkdown, uid,
  type BankOverrides, type GuruBank, type ModeId, type NQ, type QKind, type ScoreEntry,
  type Settings, type SubjectId,
} from "./logic";
import {
  burst, defenceY, drawFrame, ensureImages, hudHeight,
  type LaneView, type Laser, type Particle, type Popup, type Rock,
} from "./render";
import { FRAME } from "./sprites";

type Screen = "home" | "countdown" | "playing" | "result" | "bank";

interface Lane {
  def: (typeof LANE_DEFS)[number];
  nextQ: () => NQ | null;
  score: number;
  streak: number;
  input: string;
  nextSpawnAt: number;
  mood: number;
  moodUntil: number;
}

const fmtTime = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export default function SpaceWarGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<Settings>({ mode: "DUEL", subject: "matematika", sound: true });
  const [overrides, setOverrides] = useState<BankOverrides>({});
  const [guru, setGuru] = useState<GuruBank>({ name: "", questions: [] });
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(RULES.durationSec);
  const [countdown, setCountdown] = useState(3);
  const [result, setResult] = useState<{ name: string; score: number }[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inputsView, setInputsView] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [importText, setImportText] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftSubject, setDraftSubject] = useState<Exclude<SubjectId, "numerasi">>("matematika");
  const [draftKind, setDraftKind] = useState<QKind>("angka");
  const [draftOptions, setDraftOptions] = useState<string[]>(["", "", "", ""]);
  const [draftCorrect, setDraftCorrect] = useState(0);
  /** cermin soal aktif tiap lajur untuk panel jawaban DOM (keypad / pilihan) */
  const [activeQs, setActiveQs] = useState<({ q: NQ; opts: string[] } | null)[]>([]);
  const activeIdsRef = useRef<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lanesRef = useRef<Lane[]>([]);
  const rocksRef = useRef<Rock[]>([]);
  const lasersRef = useRef<Laser[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const rockIdRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastTsRef = useRef(0);
  const startAtRef = useRef(0);
  const endedRef = useRef(false);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  const lastSecondRef = useRef(-1);

  /* ---------------------------------------------------------- bootstrap */

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    sfx.setEnabled(s.sound);
    setOverrides(loadBankOverrides());
    setGuru(loadGuru());
    setScores(loadScores());
    setHydrated(true);
    ensureImages();
  }, []);

  useEffect(() => () => { music.stop(); if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const subjectLabel = useCallback((id: SubjectId): string => {
    if (id === "guru") return guru.name.trim() || "Mapel Guru";
    return SUBJECTS.find((s) => s.id === id)?.label ?? id;
  }, [guru.name]);

  /* ------------------------------------------------------------- musik */

  useEffect(() => {
    if (!hydrated) return;
    if ((screen === "countdown" || screen === "playing" || screen === "result") && settings.sound) {
      music.play("space");
    } else {
      music.stop();
    }
  }, [screen, settings.sound, hydrated]);

  /* -------------------------------------------------------- alur main */

  const buildLanes = useCallback((mode: ModeId, subject: SubjectId): Lane[] => {
    const players = MODES.find((m) => m.id === mode)?.players ?? 2;
    const bank: NQ[] =
      subject === "guru" ? guru.questions :
      subject === "numerasi" ? [] :
      effectiveBank(subject, overrides);
    return LANE_DEFS.slice(0, players).map((def) => {
      const queue = subject === "numerasi" ? null : makeQueue(bank);
      return {
        def,
        nextQ: subject === "numerasi"
          ? () => genNumerasi(Math.floor((performance.now() - startAtRef.current) / 1000))
          : () => (queue ? queue() : null),
        score: 0, streak: 0, input: "", nextSpawnAt: 0,
        mood: FRAME.ready, moodUntil: 0,
      };
    });
  }, [guru.questions, overrides]);

  const startMatch = useCallback(() => {
    if (settings.subject === "guru" && guru.questions.length < 2) {
      notify("Mapel Guru masih kurang dari 2 soal. Isi dulu lewat Bank Soal.");
      return;
    }
    lanesRef.current = buildLanes(settings.mode, settings.subject);
    rocksRef.current = [];
    lasersRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    endedRef.current = false;
    lastSecondRef.current = -1;
    activeIdsRef.current = "";
    setActiveQs([]);
    setResult(null);
    setInputsView(lanesRef.current.map(() => ""));
    setCountdown(3);
    setScreen("countdown");
  }, [buildLanes, settings.mode, settings.subject, guru.questions.length, notify]);

  useEffect(() => {
    if (screen !== "countdown") return;
    if (countdown <= 0) {
      startAtRef.current = performance.now();
      setTimeLeft(RULES.durationSec);
      setScreen("playing");
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 750);
    return () => window.clearTimeout(t);
  }, [screen, countdown]);

  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    runningRef.current = false;
    const rows = lanesRef.current.map((l) => ({ name: l.def.name, score: l.score }));
    saveScore({
      date: new Date().toISOString(),
      subjectLabel: subjectLabel(settings.subject),
      mode: settings.mode,
      results: rows,
    });
    setScores(loadScores());
    setResult([...rows].sort((a, b) => b.score - a.score));
    setScreen("result");
  }, [settings.mode, settings.subject, subjectLabel]);

  /* ------------------------------------------------------------ input */

  const activeRock = useCallback((slot: number): Rock | null => {
    let best: Rock | null = null;
    for (const r of rocksRef.current) {
      if (r.lane === slot && (!best || r.y > best.y)) best = r;
    }
    return best;
  }, []);

  const syncInputs = useCallback(() => {
    setInputsView(lanesRef.current.map((l) => l.input));
  }, []);

  const pressDigit = useCallback((slot: number, d: string) => {
    const lane = lanesRef.current[slot];
    if (!lane || screen !== "playing") return;
    if (lane.input.replace("-", "").length >= RULES.maxInputDigits) return;
    lane.input += d;
    syncInputs();
  }, [screen, syncInputs]);

  const pressBack = useCallback((slot: number) => {
    const lane = lanesRef.current[slot];
    if (!lane || screen !== "playing") return;
    lane.input = lane.input.slice(0, -1);
    syncInputs();
  }, [screen, syncInputs]);

  /** Satu tembakan dinilai: benar meledakkan asteroid, salah mengguncangnya. */
  const resolveShot = useCallback((slot: number, rock: Rock, ok: boolean) => {
    const lane = lanesRef.current[slot];
    if (!lane) return;
    const now = performance.now();
    const { w, h } = canvasSizeRef.current;
    const laneW = w / Math.max(1, lanesRef.current.length);
    lasersRef.current.push({ lane: slot, x: slot * laneW + laneW / 2, yTop: rock.y, bornAt: now, color: lane.def.ship });
    if (settings.sound) { sfx.resume(); sfx.play("laser"); }
    if (ok) {
      lane.score += RULES.scoreCorrect;
      lane.streak += 1;
      lane.mood = FRAME.happy; lane.moodUntil = now + 500;
      particlesRef.current.push(...burst(rock.x, rock.y, lane.def.ship, now, 18));
      popupsRef.current.push({ x: rock.x, y: rock.y, text: `+${RULES.scoreCorrect}`, color: "#15803D", bornAt: now });
      rocksRef.current = rocksRef.current.filter((r) => r.id !== rock.id);
      if (settings.sound) sfx.play("correct");
    } else {
      lane.streak = 0;
      lane.mood = FRAME.shock; lane.moodUntil = now + 450;
      rock.shakeUntil = now + 380;
      rock.y = Math.min(defenceY(h) - rock.r * 0.6, rock.y + 16);
      popupsRef.current.push({ x: rock.x, y: rock.y, text: "Meleset!", color: "#DC2626", bornAt: now });
      if (settings.sound) sfx.play("wrong");
    }
  }, [settings.sound]);

  const fire = useCallback((slot: number) => {
    const lane = lanesRef.current[slot];
    if (!lane || screen !== "playing") return;
    const rock = activeRock(slot);
    if (!rock || rock.q.kind !== "angka" || lane.input.trim() === "") return;
    const typed = parseInt(lane.input, 10);
    resolveShot(slot, rock, !Number.isNaN(typed) && typed === rock.q.answer);
    lane.input = "";
    syncInputs();
  }, [activeRock, screen, resolveShot, syncInputs]);

  const fireOption = useCallback((slot: number, text: string) => {
    if (screen !== "playing") return;
    const rock = activeRock(slot);
    if (!rock || rock.q.kind !== "teks") return;
    resolveShot(slot, rock, text === rock.q.correct);
  }, [activeRock, screen, resolveShot]);

  useEffect(() => {
    if (screen !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressDigit(0, e.key);
      else if (e.key === "Backspace") pressBack(0);
      else if (e.key === "Enter") fire(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, pressDigit, pressBack, fire]);

  /* -------------------------------------------------------------- loop */

  const headerBottomOf = useCallback((canvasW: number): number => {
    const laneCount = Math.max(1, lanesRef.current.length);
    const laneW = canvasW / laneCount;
    // Tinggi kartu dicadangkan tetap (3 baris) selama ronde: spawn asteroid
    // selalu dari garis yang sama, urutan asteroid tidak pernah tertukar.
    return 10 + hudHeight(laneW, "soal") + 6;
  }, []);

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
      const dt = Math.min(0.25, (ts - last) / 1000);
      lastTsRef.current = ts;
      const now = performance.now();
      const { w, h } = canvasSizeRef.current;
      const laneCount = Math.max(1, lanesRef.current.length);
      const laneW = w / laneCount;
      const elapsed = (now - startAtRef.current) / 1000;
      const remain = Math.max(0, RULES.durationSec - elapsed);
      const remainInt = Math.ceil(remain);
      if (remainInt !== lastSecondRef.current) {
        lastSecondRef.current = remainInt;
        setTimeLeft(remainInt);
      }
      if (remain <= 0) { endGame(); return; }

      const headerBottom = headerBottomOf(w);
      const defY = defenceY(h);
      const frac = Math.min(1, elapsed / RULES.durationSec);
      const crossSec = RULES.crossSecStart + (RULES.crossSecEnd - RULES.crossSecStart) * frac;

      // spawn asteroid per lajur
      lanesRef.current.forEach((lane, i) => {
        const alive = rocksRef.current.reduce((n2, r) => n2 + (r.lane === i ? 1 : 0), 0);
        if (alive < RULES.maxAsteroidsPerLane && now >= lane.nextSpawnAt) {
          const nextQ = lane.nextQ();
          lane.nextSpawnAt = now + RULES.spawnGapMs;
          if (nextQ) {
            const r = Math.max(38, Math.min(60, laneW * 0.17));
            const dist = Math.max(120, defY - headerBottom);
            rocksRef.current.push({
              id: rockIdRef.current++,
              lane: i,
              q: nextQ,
              opts: nextQ.kind === "teks" ? shuffle(nextQ.options) : undefined,
              x: i * laneW + laneW / 2 + (Math.random() - 0.5) * Math.max(0, laneW - r * 2 - 24),
              y: headerBottom + r * 0.55,
              r,
              vy: dist / crossSec,
              wobble: Math.random() * Math.PI * 2,
              shakeUntil: 0,
            });
          }
        }
      });

      // gerakkan + tabrakan garis pertahanan
      const survivors: Rock[] = [];
      for (const rock of rocksRef.current) {
        rock.y += rock.vy * dt;
        if (rock.y + rock.r * 0.55 >= defY) {
          const lane = lanesRef.current[rock.lane];
          if (lane) {
            lane.score = Math.max(0, lane.score + RULES.scoreCrash);
            lane.streak = 0;
            lane.mood = FRAME.miss; lane.moodUntil = now + 550;
            popupsRef.current.push({ x: rock.x, y: defY - 16, text: `${RULES.scoreCrash}`, color: "#DC2626", bornAt: now });
            particlesRef.current.push(...burst(rock.x, defY - 8, "#94A3B8", now, 12));
            if (settings.sound) sfx.play("bonk");
          }
          continue;
        }
        survivors.push(rock);
      }
      rocksRef.current = survivors;
      lasersRef.current = lasersRef.current.filter((l) => now - l.bornAt < 200);
      particlesRef.current = particlesRef.current.filter((p) => now - p.bornAt < p.life + 60);
      popupsRef.current = popupsRef.current.filter((p) => now - p.bornAt < 1000);

      const views: LaneView[] = lanesRef.current.map((lane, i) => ({
        def: lane.def,
        score: lane.score,
        streak: lane.streak,
        mood: lane.mood,
        moodUntil: lane.moodUntil,
        question: activeRock(i)?.q ?? null,
      }));
      drawFrame(ctx, {
        lanes: views,
        rocks: rocksRef.current,
        lasers: lasersRef.current,
        particles: particlesRef.current,
        popups: popupsRef.current,
        now, width: w, height: h,
      });

      canvas.dataset.headerBottom = String(Math.round(headerBottom));
      canvas.dataset.rocks = String(rocksRef.current.length);
      canvas.dataset.rocksY = rocksRef.current.map((r) => Math.round(r.y)).join(",");
      canvas.dataset.rocksInfo = rocksRef.current.map((r) => `${r.id}:${r.q.prompt.slice(0, 9)}@${Math.round(r.y)}`).join("|");
      lanesRef.current.forEach((lane, i) => {
        canvas.dataset[`score${lane.def.slot}`] = String(lane.score);
        canvas.dataset[`question${lane.def.slot}`] = activeRock(i)?.q.prompt ?? "";
        canvas.dataset[`kind${lane.def.slot}`] = activeRock(i)?.q.kind ?? "";
        canvas.dataset[`input${lane.def.slot}`] = lane.input;
      });

      // cerminkan soal aktif ke panel DOM hanya saat asteroid aktif berganti
      const idsKey = lanesRef.current.map((_, i) => activeRock(i)?.id ?? 0).join("|");
      if (idsKey !== activeIdsRef.current) {
        activeIdsRef.current = idsKey;
        setActiveQs(lanesRef.current.map((_, i) => {
          const rock = activeRock(i);
          return rock ? { q: rock.q, opts: rock.opts ?? rock.q.options } : null;
        }));
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [screen, endGame, headerBottomOf, activeRock, settings.sound]);

  /* ------------------------------------------------------------ bank */

  const bankList = useCallback((subject: Exclude<SubjectId, "numerasi" | "guru">): NQ[] => {
    return subject === "matematika" || subject === "arab" || subject === "kosakata" ? effectiveBank(subject, overrides) : [];
  }, [overrides]);

  const addQuestion = useCallback(() => {
    const prompt = draftPrompt.trim();
    if (!prompt) { notify("Isi pertanyaannya dulu."); return; }
    let item: NQ;
    if (draftKind === "teks") {
      const options = draftOptions.map((o) => o.trim());
      if (options.some((o) => o.length === 0)) { notify("Isi keempat pilihan jawabannya dulu."); return; }
      item = { id: uid(), subjectId: draftSubject, prompt, kind: "teks", answer: 0, options, correct: options[draftCorrect], isArabic: hasArabic(prompt), custom: true };
    } else {
      const ans = parseInt(draftAnswer, 10);
      if (Number.isNaN(ans)) { notify("Isi jawaban angkanya dulu."); return; }
      item = { id: uid(), subjectId: draftSubject, prompt, kind: "angka", answer: Math.max(0, ans), options: [], correct: "", isArabic: hasArabic(prompt), custom: true };
    }
    if (draftSubject === "guru") {
      setGuru((g) => { const next = { ...g, questions: [...g.questions, item] }; saveGuru(next); return next; });
    } else {
      setOverrides((o) => {
        const base = effectiveBank(draftSubject, o);
        const next = { ...o, [draftSubject]: [...base, item] };
        saveBankOverrides(next);
        return next;
      });
    }
    setDraftPrompt(""); setDraftAnswer("");
    setDraftOptions(["", "", "", ""]); setDraftCorrect(0);
    notify("Soal ditambahkan.");
  }, [draftPrompt, draftAnswer, draftSubject, draftKind, draftOptions, draftCorrect, notify]);

  const deleteQuestion = useCallback((subject: Exclude<SubjectId, "numerasi">, id: string) => {
    if (subject === "guru") {
      setGuru((g) => { const next = { ...g, questions: g.questions.filter((x) => x.id !== id) }; saveGuru(next); return next; });
    } else {
      setOverrides((o) => {
        const base = effectiveBank(subject, o);
        const next = { ...o, [subject]: base.filter((x) => x.id !== id) };
        saveBankOverrides(next);
        return next;
      });
    }
  }, []);

  const doImport = useCallback((kind: "md" | "csv") => {
    const parsed = kind === "md" ? parseMarkdownBank(importText) : { name: "", questions: parseCsvBank(importText) };
    if (parsed.questions.length === 0) { notify("Tidak ada soal yang terbaca. Periksa formatnya."); return; }
    setGuru((g) => {
      const next: GuruBank = {
        name: parsed.name || g.name,
        questions: [...g.questions, ...parsed.questions],
      };
      saveGuru(next);
      return next;
    });
    setImportText("");
    notify(`${parsed.questions.length} soal terimpor ke Mapel Guru.`);
  }, [importText, notify]);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptTemplateSoal());
      notify("Prompt tersalin. Tempel ke AI mana pun untuk membuat soal.");
    } catch { notify("Gagal menyalin. Salin manual dari teks di panel."); }
  }, [notify]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([templateMarkdown(subjectLabel(draftSubject))], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-soal-perang-antariksa.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [draftSubject, subjectLabel]);

  /* -------------------------------------------------------------- JSX */

  const players = MODES.find((m) => m.id === settings.mode)?.players ?? 2;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-200 via-indigo-100 to-rose-100 text-indigo-950">
      {screen === "home" && (
        <>
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-4">
            <Link href="/dashboard/games" className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold shadow ring-1 ring-indigo-900/10">← Lobby</Link>
            <button
              type="button"
              onClick={() => {
                const next = { ...settings, sound: !settings.sound };
                setSettings(next); saveSettings(next); sfx.setEnabled(next.sound);
              }}
              className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold shadow ring-1 ring-indigo-900/10"
            >{settings.sound ? "🔊 Suara" : "🔇 Bisu"}</button>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pb-10 pt-2">
            <div className="text-center">
              <div className="text-6xl" aria-hidden>🚀</div>
              <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">PERANG ANTARIKSA</h1>
              <p className="mt-2 text-base font-semibold text-indigo-900/70">Asteroid membawa soal. Jawab dengan keypad atau tombol pilihan, lalu tembak!</p>
            </div>

            <section className="mt-8 w-full max-w-3xl">
              <h2 className="text-center text-xs font-black uppercase tracking-widest text-indigo-900/60">Jumlah Pemain</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODES.map((m) => (
                  <button key={m.id} type="button" data-mode={m.id}
                    onClick={() => { const next = { ...settings, mode: m.id }; setSettings(next); saveSettings(next); }}
                    className={`rounded-2xl px-3 py-3 text-left shadow ring-2 transition ${settings.mode === m.id ? "bg-indigo-600 text-white ring-indigo-800" : "bg-white/85 ring-indigo-900/10 hover:bg-white"}`}>
                    <span className="block text-lg font-black">{m.label}</span>
                    <span className={`block text-xs font-semibold ${settings.mode === m.id ? "text-indigo-100" : "text-indigo-900/60"}`}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-6 w-full max-w-3xl">
              <h2 className="text-center text-xs font-black uppercase tracking-widest text-indigo-900/60">Mata Pelajaran</h2>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUBJECTS.map((s) => (
                  <button key={s.id} type="button" data-subject-option={s.id}
                    onClick={() => { const next = { ...settings, subject: s.id }; setSettings(next); saveSettings(next); }}
                    className={`rounded-2xl px-4 py-3 text-left shadow ring-2 transition ${settings.subject === s.id ? "bg-teal-600 text-white ring-teal-800" : "bg-white/85 ring-indigo-900/10 hover:bg-white"}`}>
                    <span className="block text-base font-black">{s.id === "guru" && guru.name.trim() ? guru.name.trim() : s.label}</span>
                    <span className={`block text-xs font-semibold ${settings.subject === s.id ? "text-teal-100" : "text-indigo-900/60"}`}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <button type="button" data-gass="1" onClick={startMatch}
              className="mt-8 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 px-10 py-4 text-xl font-black text-white shadow-lg ring-2 ring-rose-900/30 transition hover:scale-[1.03]">
              🚀 MULAI MISI
            </button>
            {settings.subject === "guru" && guru.questions.length < 2 && (
              <p className="mt-2 text-sm font-bold text-rose-700">Mapel Guru masih kurang dari 2 soal. Isi dulu lewat Bank Soal.</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => setScreen("bank")} className="rounded-full bg-white/85 px-5 py-2.5 text-sm font-black shadow ring-1 ring-indigo-900/10">📚 Bank Soal</button>
              <button type="button" onClick={() => setShowHelp((v) => !v)} className="rounded-full bg-white/85 px-5 py-2.5 text-sm font-black shadow ring-1 ring-indigo-900/10">❓ Cara Bermain</button>
            </div>
            {showHelp && (
              <div className="mt-3 w-full max-w-2xl rounded-2xl bg-white/85 p-4 text-sm font-semibold leading-relaxed shadow ring-1 ring-indigo-900/10">
                <p>1. Soal aktif tampil di kartu lajurmu dan di asteroid yang bercincin kuning.</p>
                <p>2. Soal angka: ketik jawaban pada keypad besar di bawah lajurnya, lalu tekan TEMBAK. Soal biasa: tembak langsung tombol pilihan jawaban yang benar.</p>
                <p>3. Benar: asteroid meledak, +10 poin. Salah: asteroid melompat lebih dekat. Bila asteroid menembus garis putus-putus merah, poinmu berkurang 5.</p>
                <p>4. Ronde 3 menit. Skor tertinggi saat waktu habis adalah pemenangnya.</p>
              </div>
            )}

            {scores.length > 0 && (
              <section className="mt-8 w-full max-w-2xl">
                <h2 className="text-center text-xs font-black uppercase tracking-widest text-indigo-900/60">Misi Terakhir</h2>
                <ul className="mt-2 space-y-1">
                  {scores.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2 text-sm font-bold shadow-sm ring-1 ring-indigo-900/5">
                      <span>{s.subjectLabel} · {s.mode}</span>
                      <span>{s.results.map((r) => `${r.name} ${r.score}`).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="mt-8 text-center text-xs font-semibold text-indigo-900/50">Dimainkan 1 sampai 4 orang dalam satu layar · soal bisa dibuat guru sendiri</p>
          </main>
        </>
      )}

      {screen === "countdown" && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="text-lg font-black uppercase tracking-widest text-indigo-900/60">{subjectLabel(settings.subject)} · {settings.mode}</p>
          <div className="mt-4 text-[9rem] font-black leading-none text-indigo-700" aria-live="polite">{countdown > 0 ? countdown : "🚀"}</div>
          <p className="mt-2 text-xl font-bold">Bersiap di kokpit masing-masing…</p>
        </div>
      )}

      {(screen === "playing" || screen === "result") && (
        <div className="flex min-h-dvh flex-col">
          <header className="flex items-center justify-between gap-3 px-4 py-2">
            <button type="button" onClick={() => { runningRef.current = false; setScreen("home"); }} className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold shadow ring-1 ring-indigo-900/10">← Keluar</button>
            <span className="text-sm font-black uppercase tracking-widest">{subjectLabel(settings.subject)}</span>
            <span className={`rounded-full px-4 py-1.5 text-sm font-black shadow ${timeLeft <= 30 ? "bg-rose-600 text-white" : "bg-lime-400 text-lime-950"}`}>{fmtTime(timeLeft)}</span>
          </header>

          <div ref={wrapRef} className="relative mx-2 flex-1 overflow-hidden rounded-3xl shadow-inner ring-1 ring-indigo-900/15" style={{ minHeight: 320 }}>
            <canvas ref={canvasRef} data-arena="1" className="absolute inset-0 h-full w-full" />
            {screen === "result" && result && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-950/45 p-4">
                <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
                  <div className="text-5xl" aria-hidden>🏆</div>
                  <h2 className="mt-1 text-2xl font-black">{result.length > 1 && result[0].score === result[1].score ? "Seri!" : `${result[0].name} Menang!`}</h2>
                  <ul className="mt-4 space-y-1.5">
                    {result.map((r, i) => (
                      <li key={r.name} className={`flex items-center justify-between rounded-xl px-4 py-2 font-black ${i === 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                        <span>{i + 1}. {r.name}</span><span>{r.score} poin</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={startMatch} className="rounded-full bg-rose-600 px-6 py-2.5 font-black text-white shadow">Main Lagi</button>
                    <button type="button" onClick={() => setScreen("home")} className="rounded-full bg-white px-6 py-2.5 font-black shadow ring-1 ring-indigo-900/15">Beranda</button>
                    <Link href="/dashboard/games" className="rounded-full bg-white px-6 py-2.5 font-black shadow ring-1 ring-indigo-900/15">🎮 Game Lain</Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {screen === "playing" && (
            <div className="mx-2 mb-2 mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${players}, minmax(0, 1fr))` }}>
              {LANE_DEFS.slice(0, players).map((def) => {
                const aq = activeQs[def.slot];
                if (aq && aq.q.kind === "teks") {
                  return (
                    <div key={def.slot} data-options={def.slot} className="rounded-2xl bg-white/85 p-2 shadow ring-1 ring-indigo-900/10">
                      <div className="mb-1.5 flex items-center justify-between rounded-lg bg-indigo-950 px-3 py-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: def.accent }}>{def.name}</span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-white/80">Pilih jawaban</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {aq.opts.map((opt) => (
                          <button key={opt} type="button" data-option={def.slot} data-correct={opt === aq.q.correct ? "1" : "0"} onClick={() => fireOption(def.slot, opt)}
                            className="rounded-xl bg-indigo-100 px-2 py-3 text-base font-black leading-tight text-indigo-950 shadow-sm transition active:scale-95"
                            dir={aq.q.isArabic ? undefined : undefined}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                <div key={def.slot} data-keypad={def.slot} className="rounded-2xl bg-white/85 p-2 shadow ring-1 ring-indigo-900/10">
                  <div className="mb-1.5 flex items-center justify-between rounded-lg bg-indigo-950 px-3 py-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: def.accent }}>{def.name}</span>
                    <span data-input={def.slot} className="min-w-10 text-right font-mono text-xl font-black text-white">{inputsView[def.slot] || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button key={d} type="button" data-digit={d} onClick={() => pressDigit(def.slot, d)}
                        className="rounded-xl bg-indigo-100 py-2.5 text-xl font-black text-indigo-950 shadow-sm transition active:scale-95">{d}</button>
                    ))}
                    <button type="button" data-clear={def.slot} onClick={() => pressBack(def.slot)}
                      className="rounded-xl bg-amber-200 py-2.5 text-xl font-black text-amber-900 shadow-sm transition active:scale-95">⌫</button>
                    <button type="button" data-digit="0" onClick={() => pressDigit(def.slot, "0")}
                      className="rounded-xl bg-indigo-100 py-2.5 text-xl font-black text-indigo-950 shadow-sm transition active:scale-95">0</button>
                    <button type="button" data-fire={def.slot} onClick={() => fire(def.slot)}
                      className="rounded-xl py-2.5 text-sm font-black text-white shadow-sm transition active:scale-95" style={{ background: def.ship }}>TEMBAK</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {screen === "bank" && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-12">
          <header className="flex items-center justify-between py-4">
            <button type="button" onClick={() => setScreen("home")} className="rounded-full bg-white/80 px-4 py-2 text-sm font-bold shadow ring-1 ring-indigo-900/10">← Kembali</button>
            <h1 className="text-xl font-black">Bank Soal</h1>
            <span className="w-24" />
          </header>

          <div className="mb-4">
            <LmsBankPicker
              onSelect={(choice) => {
                const questions: NQ[] = choice.questions.map((q) => ({
                  id: uid(),
                  subjectId: "guru",
                  prompt: q.prompt,
                  kind: "teks",
                  answer: 0,
                  options: q.options,
                  correct: q.options[q.correctIndex] ?? "",
                  isArabic: q.isArabic,
                  custom: true,
                }));
                const next: GuruBank = { name: choice.bankName, questions };
                setGuru(next);
                saveGuru(next);
              }}
            />
          </div>

          <section className="rounded-2xl bg-white/85 p-4 shadow ring-1 ring-indigo-900/10" data-bank-form="1">
            <h2 className="font-black">Tambah Soal</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDraftKind("angka")} className={`rounded-full px-4 py-1.5 text-sm font-black shadow-sm ${draftKind === "angka" ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-indigo-900/15"}`}>Soal Angka</button>
              <button type="button" onClick={() => setDraftKind("teks")} className={`rounded-full px-4 py-1.5 text-sm font-black shadow-sm ${draftKind === "teks" ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-indigo-900/15"}`}>Soal Biasa (Pilihan)</button>
              <select value={draftSubject} onChange={(e) => setDraftSubject(e.target.value as Exclude<SubjectId, "numerasi">)} className="ml-auto rounded-xl bg-white px-3 py-1.5 font-bold ring-1 ring-indigo-900/15">
                <option value="matematika">Matematika</option>
                <option value="arab">Angka Arab</option>
                <option value="kosakata">Kosakata Arab</option>
                <option value="guru">Mapel Guru</option>
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px]">
              <input value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} placeholder="Pertanyaan" className="rounded-xl bg-white px-3 py-2.5 font-semibold ring-1 ring-indigo-900/15" />
              {draftKind === "angka" && (
                <input value={draftAnswer} onChange={(e) => setDraftAnswer(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Jawaban (angka)" inputMode="numeric" className="rounded-xl bg-white px-3 py-2.5 font-semibold ring-1 ring-indigo-900/15" />
              )}
            </div>
            {draftKind === "teks" && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {draftOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={opt} onChange={(e) => setDraftOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Pilihan ${"ABCD"[i]}`} className="flex-1 rounded-xl bg-white px-3 py-2.5 font-semibold ring-1 ring-indigo-900/15" />
                    <button type="button" onClick={() => setDraftCorrect(i)} className={`rounded-full px-3 py-1.5 text-xs font-black ${draftCorrect === i ? "bg-teal-600 text-white" : "bg-white ring-1 ring-indigo-900/15"}`}>{draftCorrect === i ? "✓ Benar" : "Benar?"}</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={addQuestion} className="mt-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-black text-white shadow">+ Tambah</button>
            <p className="mt-2 text-xs font-semibold text-indigo-900/60">Soal angka dijawab dengan mengetik di keypad; soal biasa dijawab dengan menembak tombol pilihannya. Mapel Numerasi Cepat dibuat otomatis oleh game dan tidak perlu bank soal.</p>
          </section>

          <section className="mt-4 rounded-2xl bg-white/85 p-4 shadow ring-1 ring-indigo-900/10">
            <button type="button" onClick={() => setShowHelp((v) => !v)} className="font-black">📋 Petunjuk & Prompt {showHelp ? "▾" : "▸"}</button>
            {showHelp && (
              <div className="mt-2 space-y-2 text-sm font-semibold leading-relaxed">
                <p>Impor soal ke Mapel Guru: tempel teks Markdown atau CSV di kotak impor, atau pilih berkas. Dua jenis boleh dicampur. Soal angka: akhiri “Jawaban: &lt;angka&gt;”. Soal biasa: tulis 4 pilihan berlabel A. sampai D. lalu akhiri “Jawaban: &lt;huruf&gt;”. CSV angka: “pertanyaan,jawaban”. CSV biasa: “pertanyaan,A,B,C,D,jawaban”.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copyPrompt} className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-black text-white">Salin Prompt</button>
                  <button type="button" onClick={downloadTemplate} className="rounded-full bg-white px-4 py-2 text-xs font-black ring-1 ring-indigo-900/15">Unduh Template</button>
                </div>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder={"## Soal\nIbu membeli 4 kantong kelereng. Tiap kantong berisi 8 kelereng. Berapa kelereng semuanya?\nJawaban: 32\n\n## Soal\nHewan yang mengeong adalah ...\nA. Anjing\nB. Kucing\nC. Ayam\nD. Bebek\nJawaban: B"} className="w-full rounded-xl bg-white px-3 py-2 font-mono text-xs ring-1 ring-indigo-900/15" />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => doImport("md")} className="rounded-full bg-teal-600 px-4 py-2 text-xs font-black text-white">Impor Markdown</button>
                  <button type="button" onClick={() => doImport("csv")} className="rounded-full bg-teal-600 px-4 py-2 text-xs font-black text-white">Impor CSV</button>
                  <label className="cursor-pointer rounded-full bg-white px-4 py-2 text-xs font-black ring-1 ring-indigo-900/15">
                    Pilih Berkas .md/.csv
                    <input type="file" accept=".md,.csv,.txt" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) f.text().then((t) => setImportText(t));
                    }} />
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="mt-4 rounded-2xl bg-white/85 p-4 shadow ring-1 ring-indigo-900/10" data-bank-group="guru">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black">Mapel Guru</h2>
              <span className="text-xs font-bold text-indigo-900/50" data-bank-count="guru">{guru.questions.length} soal</span>
              <input value={guru.name} onChange={(e) => setGuru((g) => { const next = { ...g, name: e.target.value }; saveGuru(next); return next; })} placeholder="Nama mapel custom" className="ml-auto rounded-xl bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-indigo-900/15" />
            </div>
            <ul className="mt-2 space-y-1">
              {guru.questions.map((item) => (
                <li key={item.id} data-bank-item={item.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-indigo-900/10">
                  <span className="flex-1">{item.prompt}</span>
                  {item.kind === "teks"
                    ? <span className="rounded-full bg-teal-100 px-2.5 py-0.5 font-black text-teal-800">✓ {item.correct}</span>
                    : <span className="rounded-full bg-teal-100 px-2.5 py-0.5 font-black text-teal-800">{item.answer}</span>}
                  <button type="button" onClick={() => deleteQuestion("guru", item.id)} className="rounded-full bg-rose-100 px-2.5 py-0.5 font-black text-rose-700">✕</button>
                </li>
              ))}
              {guru.questions.length === 0 && <li className="text-sm font-semibold text-indigo-900/50">Belum ada soal. Tambahkan lewat formulir di atas atau impor.</li>}
            </ul>
          </section>

          {(["matematika", "arab", "kosakata"] as const).map((subject) => (
            <section key={subject} className="mt-4 rounded-2xl bg-white/85 p-4 shadow ring-1 ring-indigo-900/10" data-bank-group={subject}>
              <div className="flex items-center gap-2">
                <h2 className="font-black">{subject === "matematika" ? "Matematika" : subject === "arab" ? "Angka Arab" : "Kosakata Arab"}</h2>
                <span className="text-xs font-bold text-indigo-900/50" data-bank-count={subject}>{bankList(subject).length} soal</span>
              </div>
              <ul className="mt-2 space-y-1">
                {bankList(subject).map((item) => (
                  <li key={item.id} data-bank-item={item.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-indigo-900/10">
                    <span className="flex-1" dir={item.isArabic ? "rtl" : undefined}>{item.prompt}</span>
                    {item.kind === "teks"
                      ? <span className="rounded-full bg-teal-100 px-2.5 py-0.5 font-black text-teal-800">✓ {item.correct}</span>
                      : <span className="rounded-full bg-teal-100 px-2.5 py-0.5 font-black text-teal-800">{item.answer}</span>}
                    <button type="button" onClick={() => deleteQuestion(subject, item.id)} className="rounded-full bg-rose-100 px-2.5 py-0.5 font-black text-rose-700">✕</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-indigo-950 px-5 py-2.5 text-sm font-bold text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}
