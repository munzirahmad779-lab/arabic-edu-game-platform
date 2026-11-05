"use client";

/**
 * Ketapel Buah — game ketapel buah di pohon (Log 67).
 *
 * Tiap lajur mempunyai pohon berisi 7 buah foto Sulawesi: 4 buah
 * jawaban soal aktif dan 3 buah penyamar berlabel pinjaman dari soal
 * lain (sistem acakan Fruit Blast). Buah benar +10 dan soal berganti;
 * buah salah atau penyamar jatuh dengan skor -1 dan soal yang sama
 * berlanjut sampai buah benarnya kena. Meleset: tembak lagi.
 *
 * Bank soal setara game unggulan lain: 5 mapel bawaan yang bisa
 * diubah, Mapel Guru, impor Markdown/CSV/berkas, ekspor JSON, dan
 * panel Petunjuk & Prompt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LmsBankPicker } from "@/modules/game-bank/connector";
import { hasArabic } from "../lib-pendamping/game-catalog";
import { music } from "../lib-pendamping/music";
import { sfx } from "../lib-pendamping/sfx";
import {
  MODES,
  RULES,
  SUBJECTS,
  targetsFor,
  clearScores,
  Deck,
  emptyLane,
  loadBank,
  loadGuru,
  loadScores,
  loadSettings,
  parseCsvBank,
  parseMarkdownBank,
  playersFor,
  promptTemplateSoal,
  resetBank,
  saveBank,
  saveGuru,
  saveScore,
  saveSettings,
  scoresCsv,
  templateMarkdown,
  winnerName,
  type Bank,
  type GameMode,
  type GuruBank,
  type LaneState,
  type Q,
  type ScoreRec,
  type Screen,
  type Settings,
  type SpriteId,
  type SubjectChoice,
} from "./logic";
import {
  HUD_H,
  buildBackground,
  drawParticles,
  drawPopups,
  drawScene,
  layoutFor,
  targetSway,
  type DragView,
  type LaneLayout,
  type LaneView,
  type Particle,
  type Popup,
  type StoneView,
} from "./render";
import { SPRITES, fruitJuice } from "./sprites";

interface StonePhys { x: number; y: number; vx: number; vy: number; flying: boolean; bounces: number }
interface DragState { lane: number; downX: number; downY: number; pouch: { x: number; y: number } }

const newStone = (): StonePhys => ({ x: 0, y: 0, vx: 0, vy: 0, flying: false, bounces: 0 });

export default function KetapelBuahGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [bank, setBank] = useState<Bank>(() => loadBank());
  const [guru, setGuru] = useState<GuruBank>(() => loadGuru());
  const [scores, setScores] = useState<ScoreRec[]>(() => loadScores());
  const [notice, setNotice] = useState<string>("");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState<number>(RULES.durationSec);
  const [finalLanes, setFinalLanes] = useState<LaneState[]>([]);
  const [showExit, setShowExit] = useState(false);
  const [size, setSize] = useState({ w: 960, h: 600 });
  // Layar sempit (HP): hanya mode Solo yang ditawarkan dan dipakai.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const modeRef = useRef<GameMode>("SOLO");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lanesRef = useRef<LaneState[]>([]);
  const decksRef = useRef<Deck[]>([]);
  const listRef = useRef<Q[]>([]);
  const stonesRef = useRef<StonePhys[]>([]);
  const dragsRef = useRef(new Map<number, DragState>());
  const partsRef = useRef<Particle[]>([]);
  const popsRef = useRef<Popup[]>([]);
  const imagesRef = useRef(new Map<SpriteId, HTMLImageElement | null>());
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef<number>(RULES.durationSec);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastShownSecRef = useRef<number>(RULES.durationSec);
  const endedRef = useRef(false);
  const showExitRef = useRef(false);
  const rndRef = useRef(() => Math.random());
  const elapsedRef = useRef(0);
  const trailsRef = useRef<{ x: number; y: number }[][]>([]);

  const subjectList = useCallback(
    (subject: SubjectChoice, b: Bank, g: GuruBank): Q[] => (subject === "guru" ? g.questions : b[subject]),
    [],
  );

  /* -------------------------------------------------- gambar maskot */
  useEffect(() => {
    for (const def of Object.values(SPRITES)) {
      if (imagesRef.current.has(def.id)) continue;
      const img = new Image();
      img.src = def.src;
      imagesRef.current.set(def.id, img);
    }
  }, []);

  /* -------------------------------------------------- ukuran canvas */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(300, Math.floor(r.width)), h: Math.max(300, Math.floor(r.height)) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen]);

  useEffect(() => {
    bgRef.current = null;
  }, [size.w, size.h]);

  /* -------------------------------------------------- alur main */
  const dealNext = useCallback((slot: number) => {
    const lane = lanesRef.current[slot];
    const deck = decksRef.current[slot];
    if (!lane || !deck) return;
    const q = deck.next();
    lane.q = q;
    lane.targets = q ? targetsFor(q, listRef.current, rndRef.current) : [];
    lane.phase = "aim";
    const stone = stonesRef.current[slot];
    if (stone) stone.flying = false;
  }, []);

  const finishMatch = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const lanes = lanesRef.current;
    setFinalLanes(lanes.map((l) => ({ ...l })));
    const subjectTitle =
      settings.subject === "guru" ? guru.name || "Mapel Guru" : SUBJECTS.find((s) => s.id === settings.subject)?.title ?? settings.subject;
    const rec: ScoreRec = {
      at: new Date().toLocaleString("id-ID"),
      mode: modeRef.current,
      subject: subjectTitle,
      results: lanes.map((l) => ({ name: l.def.name, score: l.score })),
      winner: winnerName(lanes),
    };
    setScores(saveScore(rec));
    setScreen("result");
  }, [settings.mode, settings.subject, guru.name]);

  const startMatch = useCallback(() => {
    const list = subjectList(settings.subject, bank, guru);
    if (settings.subject === "guru" && list.length < 2) {
      setNotice("Mapel Guru butuh minimal 2 soal. Tambahkan dulu lewat Bank Soal.");
      return;
    }
    if (list.length === 0) {
      setNotice("Bank soal kosong untuk mapel ini. Isi dulu lewat Bank Soal.");
      return;
    }
    sfx.setEnabled(settings.sound);
    const effMode: GameMode = narrow ? "SOLO" : settings.mode;
    modeRef.current = effMode;
    const defs = playersFor(effMode);
    lanesRef.current = defs.map((d) => emptyLane(d));
    listRef.current = list;
    decksRef.current = defs.map(() => new Deck(list, rndRef.current));
    stonesRef.current = defs.map(() => newStone());
    trailsRef.current = defs.map(() => []);
    elapsedRef.current = 0;
    dragsRef.current.clear();
    partsRef.current = [];
    popsRef.current = [];
    endedRef.current = false;
    timeRef.current = RULES.durationSec;
    lastShownSecRef.current = RULES.durationSec;
    setTimeLeft(RULES.durationSec);
    defs.forEach((_, i) => dealNext(i));
    setCountdown(3);
    setScreen("countdown");
  }, [settings, bank, guru, subjectList, dealNext, narrow]);

  /* hitung mundur */
  useEffect(() => {
    if (screen !== "countdown") return;
    music.play("ketapel-buah");
    setCountdown(3);
    const iv = window.setInterval(() => {
      if (showExitRef.current) return;
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(iv);
          setScreen("playing");
          return 0;
        }
        return c - 1;
      });
    }, 800);
    return () => window.clearInterval(iv);
  }, [screen]);

  /* musik berhenti saat kembali ke beranda */
  useEffect(() => {
    if (screen === "home" || screen === "bank" || screen === "score") music.stop();
  }, [screen]);

  /* -------------------------------------------------- loop lukis */
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const layouts = (): LaneLayout[] => layoutFor(size.w, size.h, lanesRef.current.length || 1);

    const resolveFruit = (slot: number, ti: number, lay: LaneLayout) => {
      const lane = lanesRef.current[slot];
      const target = lane.targets[ti];
      const stone = stonesRef.current[slot];
      if (!target || !stone || target.state !== "hang") return;
      stone.flying = false;
      const slotPos = lay.slots[ti] ?? lay.anchor;
      const fx = slotPos.x + targetSway(ti, elapsedRef.current);
      const fy = slotPos.y;
      target.state = "fall";
      target.vy = 40;
      if (target.correct) {
        lane.score += RULES.pointsCorrect;
        lane.streak += 1;
        lane.phase = "cheer";
        lane.phaseUntil = performance.now() + RULES.cheerMs;
        sfx.play("correct");
        popsRef.current.push({ x: fx, y: fy - 30, text: `+${RULES.pointsCorrect}`, life: 900, maxLife: 900, color: "#16A34A" });
        const juice = fruitJuice(target.fruitId);
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 150;
          partsRef.current.push({
            x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
            life: 650, maxLife: 650, color: [juice, "#22C55E", "#FDE047"][i % 3], size: 3.5,
          });
        }
      } else {
        lane.score = Math.max(0, lane.score + RULES.pointsWrong);
        lane.streak = 0;
        lane.phase = "aim";
        sfx.play("bonk");
        popsRef.current.push({
          x: fx, y: fy - 30,
          text: target.impostor ? `Penyamar ${RULES.pointsWrong}` : `${RULES.pointsWrong}`,
          life: 800, maxLife: 800, color: "#DC2626",
        });
      }
    };

    const step = (ts: number) => {
      rafRef.current = requestAnimationFrame(step);
      const dtRaw = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0.016;
      lastTsRef.current = ts;
      if (showExitRef.current) return; // jeda: dialog keluar sedang terbuka
      const dt = Math.min(dtRaw, 0.05);
      elapsedRef.current += dt;
      const lays = layouts();
      const now = performance.now();

      /* waktu */
      timeRef.current = Math.max(0, timeRef.current - dt);
      const shown = Math.ceil(timeRef.current);
      if (shown !== lastShownSecRef.current) {
        lastShownSecRef.current = shown;
        setTimeLeft(shown);
      }
      if (timeRef.current <= 0) {
        finishMatch();
        return;
      }

      /* buah yang kena: jatuh ke tanah lalu hilang */
      lanesRef.current.forEach((lane) => {
        lane.targets.forEach((tg) => {
          if (tg.state !== "fall") return;
          tg.vy += 1500 * dt;
          tg.fallY += tg.vy * dt;
          if (tg.fallY > 340) tg.state = "gone";
        });
      });

      /* fisika batu + fase lajur */
      lanesRef.current.forEach((lane, slot) => {
        const lay = lays[slot];
        const stone = stonesRef.current[slot];
        if (!lay || !stone) return;
        if (lane.phase === "cheer" && now >= lane.phaseUntil) {
          dealNext(slot);
        }
        if (stone.flying) {
          const trail = trailsRef.current[slot];
          if (trail) {
            trail.push({ x: stone.x, y: stone.y });
            while (trail.length > 9) trail.shift();
          }
          const sub = 3;
          const sdt = dt / sub;
          for (let s = 0; s < sub && stone.flying; s++) {
            stone.x += stone.vx * sdt;
            stone.y += stone.vy * sdt;
            stone.vy += RULES.gravity * sdt;
            /* Pantulan dinding lajur: pembatas antar lajur dan tepi arena
               adalah dinding padat. Batu yang bergerak KELUAR menabrak
               garis batas lajurnya dipantulkan berbalik arah dengan
               restitusi yang sama seperti pantulan tanah, posisinya
               dijepit tetap di dalam lajur, dan penerbangan berlanjut;
               batu tidak pernah lagi hilang di pembatas. Syarat arah
               gerak menjaga batu yang baru dilepas dari tarikan dalam:
               kantong bisa ditarik sampai 230 px dari jangkar sehingga
               batu mulai sedikit di luar garis lajur, tetapi selalu
               sambil bergerak MASUK, jadi tidak pernah dipantulkan.
               Pantulan dinding tidak memakan jatah pantulan tanah
               (bounces): jatah itu mengakhiri tembakan lewat energi
               tegak yang habis di tanah, sedangkan belokan dinding hanya
               mengubah arah mendatar dan laju mendatarnya menyusut
               0,62 kali pada tiap benturan sampai hilang sendiri. */
            const wallL = lay.x + RULES.stoneR;
            const wallR = lay.x + lay.w - RULES.stoneR;
            if (stone.x < wallL && stone.vx < 0) {
              stone.x = wallL;
              stone.vx = -stone.vx * RULES.bounceRest;
            } else if (stone.x > wallR && stone.vx > 0) {
              stone.x = wallR;
              stone.vx = -stone.vx * RULES.bounceRest;
            }
            for (let ti = 0; ti < lane.targets.length; ti++) {
              const tg = lane.targets[ti];
              if (tg.state !== "hang") continue;
              const slotPos = lay.slots[ti];
              if (!slotPos) continue;
              const tx = slotPos.x + targetSway(ti, elapsedRef.current);
              const ddx = stone.x - tx;
              const ddy = stone.y - slotPos.y;
              const rr = lay.fruitR + RULES.stoneR - 2;
              if (ddx * ddx + ddy * ddy <= rr * rr) {
                resolveFruit(slot, ti, lay);
                break;
              }
            }
          }
          /* Pantulan di tanah: batu yang jatuh pendek memantul dan
             terbang lagi, sampai jumlah pantulannya habis atau lajunya
             sudah terlalu pelan untuk memantul. */
          if (stone.flying && stone.vy > 0 && stone.y >= lay.groundY - RULES.stoneR) {
            if (stone.bounces >= RULES.maxBounces || stone.vy < RULES.bounceMinVy) {
              stone.flying = false; // pantulan habis: batu berhenti di tanah, soal sama
              if (lane.phase === "fly") lane.phase = "aim";
            } else {
              stone.y = lay.groundY - RULES.stoneR;
              stone.vy = -stone.vy * RULES.bounceRest;
              stone.vx *= 0.94;
              stone.bounces += 1;
            }
          }
          /* Meleset hanya lewat arah tegak: terbang keluar dari atas
             layar, atau jatuh menembus ke bawah garis tanah (hanya bisa
             terjadi pada batu yang dilepas dari tarikan dalam ke bawah,
             yang mulai di bawah garis tanah sebelum sempat naik). Arah
             mendatar tidak lagi menggugurkan batu; pembatas lajur sudah
             menjadi dinding padat yang memantulkannya kembali ke dalam
             lajur (lihat pantulan dinding di substep atas). */
          const leaving =
            (stone.vy > 0 && stone.y > lay.groundY + 40) ||
            (stone.vy < 0 && stone.y < -90);
          if (stone.flying && leaving) {
            stone.flying = false; // meleset: batu kembali ke kantong, soal sama
            if (lane.phase === "fly") lane.phase = "aim";
          }
        }
        if (!stone.flying && trailsRef.current[slot]) {
          trailsRef.current[slot] = [];
        }
      });

      /* partikel + popup */
      partsRef.current = partsRef.current.filter((p) => (p.life -= dt * 1000) > 0);
      for (const p of partsRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
      }
      popsRef.current = popsRef.current.filter((p) => (p.life -= dt * 1000) > 0);
      for (const p of popsRef.current) p.y -= 34 * dt;

      /* susun tampilan */
      const views: LaneView[] = lanesRef.current.map((lane, slot) => {
        const lay = lays[slot];
        const stone = stonesRef.current[slot];
        const drag = Array.from(dragsRef.current.values()).find((d) => d.lane === slot);
        let stoneView: StoneView = { x: lay.anchor.x, y: lay.anchor.y, visible: false };
        if (stone.flying) stoneView = { x: stone.x, y: stone.y, visible: true };
        else if (lane.phase === "aim") stoneView = { x: drag ? drag.pouch.x : lay.anchor.x, y: drag ? drag.pouch.y : lay.anchor.y, visible: true };
        return {
          lane,
          stone: stoneView,
          drag: { active: !!drag, pouch: drag ? drag.pouch : lay.anchor } as DragView,
          trail: trailsRef.current[slot] ?? [],
        };
      });

      if (!bgRef.current) bgRef.current = buildBackground(size.w, size.h);
      drawScene(g, size.w, size.h, bgRef.current, lays, views, imagesRef.current, elapsedRef.current);
      drawParticles(g, partsRef.current);
      drawPopups(g, popsRef.current);

      /* kail uji */
      canvas.dataset.lanes = String(lanesRef.current.length);
      canvas.dataset.state = "playing";
      canvas.dataset.timeLeft = String(Math.ceil(timeRef.current));
      lanesRef.current.forEach((lane, slot) => {
        const lay = lays[slot];
        canvas.dataset[`score${slot}`] = String(lane.score);
        canvas.dataset[`question${slot}`] = lane.q?.prompt ?? "";
        canvas.dataset[`targets${slot}`] = JSON.stringify(
          lane.targets.map((tg) => ({
            x: (lay.slots[tg.idx]?.x ?? lay.anchor.x) + targetSway(tg.idx, elapsedRef.current),
            y: lay.slots[tg.idx]?.y ?? lay.anchor.y,
            text: tg.text, correct: tg.correct, impostor: tg.impostor, state: tg.state,
          })),
        );
        canvas.dataset[`anchor${slot}`] = JSON.stringify(lay.anchor);
        const st = stonesRef.current[slot];
        canvas.dataset[`stone${slot}`] = JSON.stringify({ x: Math.round(st?.x ?? 0), y: Math.round(st?.y ?? 0), flying: st?.flying ?? false });
        canvas.dataset[`phase${slot}`] = lane.phase;
      });
      canvas.dataset.headerBottom = String(HUD_H);
    };

    lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, size.w, size.h, dealNext, finishMatch]);

  /* -------------------------------------------------- pointer */
  const canvasPos = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = (canvasRef.current as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * size.w,
      y: ((e.clientY - rect.top) / rect.height) * size.h,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (screen !== "playing") return;
    sfx.resume();
    const pos = canvasPos(e);
    const lays = layoutFor(size.w, size.h, lanesRef.current.length || 1);
    const slot = lays.findIndex((l) => pos.x >= l.x && pos.x < l.x + l.w);
    if (slot < 0) return;
    const lane = lanesRef.current[slot];
    if (!lane || lane.phase !== "aim" || stonesRef.current[slot]?.flying) return;
    // Penjaga seretan ganda: satu lajur hanya boleh punya satu seretan aktif;
    // sentuhan kedua pada lajur yang sama diabaikan.
    if (Array.from(dragsRef.current.values()).some((d) => d.lane === slot)) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragsRef.current.set(e.pointerId, { lane: slot, downX: pos.x, downY: pos.y, pouch: { ...lays[slot].anchor } });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragsRef.current.get(e.pointerId);
    if (!drag) return;
    const pos = canvasPos(e);
    const lays = layoutFor(size.w, size.h, lanesRef.current.length || 1);
    const anchor = lays[drag.lane].anchor;
    let dx = pos.x - drag.downX;
    let dy = pos.y - drag.downY;
    const len = Math.hypot(dx, dy);
    if (len > RULES.maxDrag) {
      dx = (dx / len) * RULES.maxDrag;
      dy = (dy / len) * RULES.maxDrag;
    }
    drag.pouch = { x: anchor.x + dx, y: anchor.y + dy };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragsRef.current.get(e.pointerId);
    if (!drag) return;
    dragsRef.current.delete(e.pointerId);
    // Penjaga seretan ganda: batu hanya diluncurkan bila lajur masih membidik
    // ("aim") dan tidak ada batu yang sedang terbang untuk lajur itu. Lepasan
    // yang tidak memenuhi syarat cukup menghapus entri seretannya sendiri
    // (sudah dilakukan di atas), tanpa mengubah fase dan tanpa meluncurkan.
    const lane = lanesRef.current[drag.lane];
    const stone = stonesRef.current[drag.lane];
    if (!lane || !stone || lane.phase !== "aim" || stone.flying) return;
    const lays = layoutFor(size.w, size.h, lanesRef.current.length || 1);
    const anchor = lays[drag.lane].anchor;
    const vx = (anchor.x - drag.pouch.x) * RULES.launchK;
    const vy = (anchor.y - drag.pouch.y) * RULES.launchK;
    if (Math.hypot(vx, vy) < 130) return; // tarikan terlalu lemah, batal
    stone.x = drag.pouch.x;
    stone.y = drag.pouch.y;
    stone.vx = vx;
    stone.vy = vy;
    stone.bounces = 0;
    stone.flying = true;
    lanesRef.current[drag.lane].phase = "fly";
    sfx.play("laser");
  };

  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
    sfx.setEnabled(next.sound);
  };

  useEffect(() => {
    showExitRef.current = showExit;
  }, [showExit]);

  const exitToHome = () => {
    setShowExit(false);
    music.stop();
    setScreen("home");
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-100 text-indigo-950">
      <header className="flex shrink-0 items-center gap-2 border-b border-indigo-900/10 bg-white/60 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => (screen === "playing" || screen === "countdown" ? setShowExit(true) : setScreen("home"))}
          className="inline-flex min-h-9 items-center rounded-xl bg-white/80 px-4 text-sm font-bold text-indigo-950 ring-1 ring-indigo-900/15 hover:bg-white"
        >
          ← Keluar
        </button>
        <h1 className="text-base font-black tracking-wide">🥭 KETAPEL BUAH</h1>
        <span className="ml-auto flex items-center gap-2">
          {screen === "playing" && (
            <span className="rounded-xl bg-indigo-950 px-3 py-1.5 text-sm font-black text-white" aria-label="Sisa waktu">
              ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button
            type="button"
            aria-label={settings.sound ? "Matikan suara" : "Nyalakan suara"}
            onClick={() => changeSettings({ ...settings, sound: !settings.sound })}
            className="inline-flex min-h-9 items-center rounded-xl bg-white/80 px-3 text-sm font-bold ring-1 ring-indigo-900/15 hover:bg-white"
          >
            {settings.sound ? "🔊" : "🔇"}
          </button>
        </span>
      </header>

      {notice && screen === "home" && (
        <p className="mx-3 mt-2 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 ring-1 ring-rose-300" role="alert">
          {notice}
        </p>
      )}

      <Screens
        screen={screen}
        settings={settings}
        bank={bank}
        guru={guru}
        scores={scores}
        countdown={countdown}
        finalLanes={finalLanes}
        size={size}
        wrapRef={wrapRef}
        canvasRef={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        changeSettings={changeSettings}
        narrow={narrow}
        startMatch={startMatch}
        setScreen={setScreen}
        setBank={setBank}
        setGuru={setGuru}
        setScores={setScores}
        setNotice={setNotice}
      />

      {showExit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <p className="text-lg font-black text-indigo-950">Keluar dari pertandingan?</p>
            <p className="mt-1 text-sm text-indigo-900/70">Skor babak ini tidak disimpan.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => setShowExit(false)} className="min-h-11 rounded-xl bg-indigo-100 px-5 font-bold text-indigo-950 hover:bg-indigo-200">
                Lanjut Main
              </button>
              <button type="button" onClick={exitToHome} className="min-h-11 rounded-xl bg-rose-600 px-5 font-bold text-white hover:bg-rose-500">
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ layar */

interface ScreensProps {
  screen: Screen;
  settings: Settings;
  bank: Bank;
  guru: GuruBank;
  scores: ScoreRec[];
  countdown: number;
  finalLanes: LaneState[];
  size: { w: number; h: number };
  wrapRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  changeSettings: (s: Settings) => void;
  narrow: boolean;
  startMatch: () => void;
  setScreen: (s: Screen) => void;
  setBank: (b: Bank) => void;
  setGuru: (g: GuruBank) => void;
  setScores: (s: ScoreRec[]) => void;
  setNotice: (s: string) => void;
}

function Screens(p: ScreensProps) {
  if (p.screen === "playing" || p.screen === "countdown") {
    return (
      <div ref={p.wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={p.canvasRef}
          width={p.size.w}
          height={p.size.h}
          className="block h-full w-full touch-none"
          onPointerDown={p.onPointerDown}
          onPointerMove={p.onPointerMove}
          onPointerUp={p.onPointerUp}
          onPointerCancel={p.onPointerUp}
          data-testid="ketapel-buah-canvas"
        />
        {p.screen === "countdown" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/30">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Siap-siap</p>
            <p className="text-[7rem] font-black leading-none text-white drop-shadow-lg">{p.countdown}</p>
            <p className="max-w-md px-4 text-center text-sm font-semibold text-white/90">
              Tarik ketapelmu, tembak buah berisi jawaban yang benar!
            </p>
          </div>
        )}
      </div>
    );
  }
  if (p.screen === "bank") return <BankScreen {...p} />;
  if (p.screen === "score") return <ScoreScreen {...p} />;
  if (p.screen === "result") return <ResultScreen {...p} />;
  return <HomeScreen {...p} />;
}

const cardBtn =
  "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1 ring-1 transition active:scale-95";
const selOn = "bg-amber-400 text-indigo-950 ring-amber-600/40 shadow";
const selOff = "bg-white/80 text-indigo-950 ring-indigo-900/15 shadow-sm hover:bg-white";

function HomeScreen(p: ScreensProps) {
  const { settings } = p;
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <section className="rounded-2xl bg-white/70 p-4 text-center ring-1 ring-indigo-900/10">
          <p className="text-5xl" aria-hidden="true">🥭</p>
          <h2 className="mt-1 text-3xl font-black tracking-wide">KETAPEL BUAH</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-indigo-900/70">
            Ketapel buah di pohon: tembak buah yang membawa jawaban benar. Hati-hati, ada buah penyamar berlabel pinjaman dari soal lain.
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold text-indigo-950">
            <li className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-indigo-900/10">Buah benar +10</li>
            <li className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-indigo-900/10">Buah salah/penyamar: -1, soal lanjut</li>
            <li className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-indigo-900/10">Meleset: tembak lagi</li>
            <li className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-indigo-900/10">Babak 3 menit</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-900/60">Mode</h3>
          <div className={`grid gap-2 ${p.narrow ? "grid-cols-1" : "grid-cols-4"}`}>
            {MODES.filter((m) => !p.narrow || m.id === "SOLO").map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => p.changeSettings({ ...settings, mode: m.id as GameMode })}
                className={`${cardBtn} ${(p.narrow ? "SOLO" : settings.mode) === m.id ? selOn : selOff}`}
                aria-pressed={(p.narrow ? "SOLO" : settings.mode) === m.id}
              >
                <span className="text-sm font-black">{m.title}</span>
                <span className="text-[10px] font-semibold opacity-70">{m.sub}</span>
              </button>
            ))}
          </div>
          {p.narrow ? (
            <p className="mt-2 text-[11px] font-semibold text-indigo-900/60">Di layar HP hanya mode Solo yang tersedia. Mode Duel, Trio, dan Squad khusus layar lebar atau TV.</p>
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-900/60">Mata Pelajaran</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => p.changeSettings({ ...settings, subject: s.id })}
                className={`${cardBtn} ${settings.subject === s.id ? selOn : selOff}`}
                aria-pressed={settings.subject === s.id}
              >
                <span className="text-sm font-black">{s.icon} {s.title}</span>
                <span className="text-[10px] font-semibold opacity-70">{p.bank[s.id].length} soal</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => p.changeSettings({ ...settings, subject: "guru" })}
              className={`${cardBtn} ${settings.subject === "guru" ? selOn : selOff}`}
              aria-pressed={settings.subject === "guru"}
            >
              <span className="text-sm font-black">🧑‍🏫 {p.guru.name || "Mapel Guru"}</span>
              <span className="text-[10px] font-semibold opacity-70">{p.guru.questions.length} soal · buat sendiri</span>
            </button>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-2 pb-2">
          <button
            type="button"
            onClick={p.startMatch}
            className="inline-flex min-h-12 items-center rounded-2xl bg-indigo-600 px-8 text-base font-black text-white shadow-lg transition hover:bg-indigo-500 active:scale-95"
          >
            ▶ Mulai Main
          </button>
          <button type="button" onClick={() => p.setScreen("bank")} className="inline-flex min-h-12 items-center rounded-2xl bg-white/80 px-6 text-sm font-bold text-indigo-950 ring-1 ring-indigo-900/15 hover:bg-white">
            📚 Bank Soal
          </button>
          <button type="button" onClick={() => p.setScreen("score")} className="inline-flex min-h-12 items-center rounded-2xl bg-white/80 px-6 text-sm font-bold text-indigo-950 ring-1 ring-indigo-900/15 hover:bg-white">
            🏆 Papan Skor
          </button>
        </div>
      </div>
    </main>
  );
}

function ResultScreen(p: ScreensProps) {
  const lanes = p.finalLanes;
  const winner = winnerName(lanes);
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <section className="w-full rounded-2xl bg-white/80 p-5 text-center ring-1 ring-indigo-900/10">
          <p className="text-5xl" aria-hidden="true">🏆</p>
          <h2 className="mt-1 text-2xl font-black">{winner === "Seri" ? "Babak Berakhir Seri!" : `${winner} Menang!`}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {lanes.map((l) => (
              <div key={l.def.slot} className="rounded-xl bg-white p-3 ring-1 ring-indigo-900/10">
                <p className="text-xs font-black uppercase tracking-wide" style={{ color: l.def.color }}>{l.def.name}</p>
                <p className="text-3xl font-black text-indigo-950">{l.score}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="flex gap-2">
          <button type="button" onClick={p.startMatch} className="min-h-11 rounded-xl bg-indigo-600 px-6 font-black text-white hover:bg-indigo-500">
            ↻ Main Lagi
          </button>
          <button type="button" onClick={() => p.setScreen("home")} className="min-h-11 rounded-xl bg-white/80 px-6 font-bold text-indigo-950 ring-1 ring-indigo-900/15 hover:bg-white">
            Beranda
          </button>
        </div>
      </div>
    </main>
  );
}

function ScoreScreen(p: ScreensProps) {
  const download = () => {
    const blob = new Blob([scoresCsv(p.scores)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "papan-skor-ketapel-buah.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">🏆 Papan Skor</h2>
          <span className="flex gap-2">
            <button type="button" onClick={download} className="min-h-9 rounded-xl bg-white/80 px-4 text-sm font-bold ring-1 ring-indigo-900/15 hover:bg-white">⬇ Ekspor CSV</button>
            <button
              type="button"
              onClick={() => { clearScores(); p.setScores([]); }}
              className="min-h-9 rounded-xl bg-rose-600/90 px-4 text-sm font-bold text-white hover:bg-rose-500"
            >
              Hapus Semua
            </button>
          </span>
        </div>
        {p.scores.length === 0 ? (
          <p className="rounded-xl bg-white/70 p-4 text-center text-sm text-indigo-900/65 ring-1 ring-indigo-900/10">
            Belum ada skor tersimpan. Selesaikan satu babak dulu.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {p.scores.map((r, i) => (
              <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-indigo-900/10">
                <p className="text-sm font-bold text-indigo-950">
                  {r.winner === "Seri" ? "Seri" : `🏆 ${r.winner}`} <span className="font-semibold text-indigo-900/60">· {r.mode} · {r.subject}</span>
                </p>
                <p className="text-xs text-indigo-900/60">
                  {r.at} — {r.results.map((x) => `${x.name} ${x.score}`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------ bank soal */

interface DraftState {
  subjectId: SubjectChoice;
  prompt: string;
  options: string[];
  correctIdx: number;
}

function BankScreen(p: ScreensProps) {
  const [draft, setDraft] = useState<DraftState>({ subjectId: "arab", prompt: "", options: ["", "", "", ""], correctIdx: 0 });
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");

  const addTo = (subjectId: SubjectChoice, items: Q[]) => {
    if (subjectId === "guru") {
      const next: GuruBank = { ...p.guru, questions: [...p.guru.questions, ...items] };
      p.setGuru(next);
      saveGuru(next);
    } else {
      const next: Bank = { ...p.bank, [subjectId]: [...p.bank[subjectId], ...items] };
      p.setBank(next);
      saveBank(next);
    }
  };

  const deleteQuestion = (subjectId: SubjectChoice, id: string) => {
    if (subjectId === "guru") {
      const next: GuruBank = { ...p.guru, questions: p.guru.questions.filter((q) => q.id !== id) };
      p.setGuru(next);
      saveGuru(next);
    } else {
      const next: Bank = { ...p.bank, [subjectId]: p.bank[subjectId].filter((q) => q.id !== id) };
      p.setBank(next);
      saveBank(next);
    }
  };

  const submitDraft = () => {
    const options = draft.options.map((o) => o.trim()).filter(Boolean);
    if (!draft.prompt.trim() || options.length < 2) {
      setMsg("Isi pertanyaan dan minimal 2 pilihan dulu.");
      return;
    }
    const correct = draft.options[draft.correctIdx]?.trim();
    if (!correct || !options.includes(correct)) {
      setMsg("Tandai pilihan yang benar.");
      return;
    }
    const item: Q = {
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      subjectId: draft.subjectId === "guru" ? "arab" : draft.subjectId,
      prompt: draft.prompt.trim(),
      isArabic: hasArabic(draft.prompt),
      options,
      correct,
      custom: true,
    };
    addTo(draft.subjectId, [item]);
    setDraft({ ...draft, prompt: "", options: ["", "", "", ""], correctIdx: 0 });
    setMsg("Soal tersimpan.");
  };

  const doImportText = () => {
    const subjectId = draft.subjectId;
    const md = parseMarkdownBank(importText, subjectId === "guru" ? "arab" : subjectId);
    const csv = md.items.length === 0 ? parseCsvBank(importText, subjectId === "guru" ? "arab" : subjectId) : { items: [] as Q[], skipped: 0 };
    const items = md.items.length > 0 ? md.items : csv.items;
    if (items.length === 0) {
      setMsg("Tidak ada soal yang terbaca. Periksa format Markdown atau CSV-nya.");
      return;
    }
    addTo(subjectId, items.map((q) => ({ ...q, custom: true })));
    setImportText("");
    setMsg(`${items.length} soal terimpor.`);
  };

  const exportBank = () => {
    const blob = new Blob([JSON.stringify({ bank: p.bank, guru: p.guru }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank-soal-ketapel-buah.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptTemplateSoal());
      setMsg("Prompt tersalin. Tempel ke AI favoritmu, lalu impor hasilnya di sini.");
    } catch {
      setMsg("Gagal menyalin otomatis. Buka panel Petunjuk & Prompt dan salin manual.");
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-soal-ketapel-buah.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const subjectTitle = (id: SubjectChoice): string =>
    id === "guru" ? p.guru.name || "Mapel Guru" : SUBJECTS.find((s) => s.id === id)?.title ?? id;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black">📚 Bank Soal</h2>
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={exportBank} className="min-h-9 rounded-xl bg-white/80 px-4 text-sm font-bold ring-1 ring-indigo-900/15 hover:bg-white">⬇ Ekspor JSON</button>
            <button
              type="button"
              onClick={() => { const fresh = resetBank(); p.setBank(fresh); setMsg("Bank bawaan dikembalikan seperti semula."); }}
              className="min-h-9 rounded-xl bg-rose-600/90 px-4 text-sm font-bold text-white hover:bg-rose-500"
            >
              ↺ Reset Bawaan
            </button>
          </span>
        </div>
        <LmsBankPicker
          onSelect={(choice) => {
            const questions: Q[] = choice.questions.map((q, i) => ({
              id: `lms-${choice.bankId}-${i + 1}`,
              subjectId: "arab",
              prompt: q.prompt,
              isArabic: hasArabic(q.prompt),
              options: [
                q.options[0] ?? "",
                q.options[1] ?? "",
                q.options[2] ?? "",
                q.options[3] ?? "",
              ],
              correct: q.options[q.correctIndex] ?? "",
              custom: true,
            }));
            const next: GuruBank = { name: choice.bankName, questions };
            p.setGuru(next);
            saveGuru(next);
            setMsg(`Terpasang: ${questions.length} soal dari bank "${choice.bankName}" sebagai Mapel Guru.`);
          }}
        />
        {msg && <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-300" role="status">{msg}</p>}

        <section className="rounded-xl bg-white/85 p-3 ring-1 ring-indigo-900/10" data-bank-form="1">
          <h3 className="text-sm font-black">Tambah Soal</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr]">
            <label className="text-xs font-bold text-indigo-900/70">
              Subjek
              <select
                value={draft.subjectId}
                onChange={(e) => setDraft({ ...draft, subjectId: e.target.value as SubjectChoice })}
                className="mt-1 min-h-10 w-full rounded-lg bg-white px-2 text-sm font-semibold text-indigo-950 ring-1 ring-indigo-900/15"
              >
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
                <option value="guru">Mapel Guru</option>
              </select>
            </label>
            <label className="text-xs font-bold text-indigo-900/70">
              Soal
              <input
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                placeholder="Tulis pertanyaan"
                dir="auto"
                className="mt-1 min-h-10 w-full rounded-lg bg-white px-2 text-sm text-indigo-950 ring-1 ring-indigo-900/15 placeholder:text-indigo-900/40"
              />
            </label>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {draft.options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-xs font-bold text-indigo-900/70">
                <input
                  type="radio"
                  name="correct"
                  checked={draft.correctIdx === i}
                  onChange={() => setDraft({ ...draft, correctIdx: i })}
                  aria-label={`Tandai pilihan ${i + 1} sebagai jawaban benar`}
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[i] = e.target.value;
                    setDraft({ ...draft, options });
                  }}
                  placeholder={`Pilihan ${i + 1}`}
                  dir="auto"
                  className="min-h-10 flex-1 rounded-lg bg-white px-2 text-sm font-normal text-indigo-950 ring-1 ring-indigo-900/15 placeholder:text-indigo-900/40"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={submitDraft} className="mt-3 min-h-10 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white hover:bg-emerald-400">
            + Simpan Soal
          </button>
        </section>

        <section className="rounded-xl bg-white/85 p-3 ring-1 ring-indigo-900/10" data-import-panel="1">
          <h3 className="text-sm font-black">Impor Soal dari Teks (Markdown / CSV)</h3>
          <p className="mt-1 text-xs text-indigo-900/65">
            Tempel soal, lalu impor ke mapel yang sedang dipilih pada formulir Tambah Soal di atas. Format Markdown memakai pola ## Soal,
            pilihan A. sampai D., dan baris Jawaban. Format CSV memakai enam kolom: soal, A, B, C, D, jawaban.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            dir="auto"
            className="mt-2 w-full rounded-lg bg-white px-2 py-2 text-sm text-indigo-950 ring-1 ring-indigo-900/15 placeholder:text-indigo-900/40"
            placeholder={"## Soal\nIbukota Indonesia adalah...\nA. Bandung\nB. Jakarta\nC. Surabaya\nD. Medan\nJawaban: B"}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={doImportText} className="min-h-10 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white hover:bg-emerald-400">
              ⬆ Impor Teks ke {subjectTitle(draft.subjectId)}
            </button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-bold text-indigo-950">📋 Petunjuk & Prompt untuk Membuat Soal dengan AI</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-indigo-950/5 p-3 text-[11px] leading-relaxed text-indigo-950/80 ring-1 ring-indigo-900/10">
              {promptTemplateSoal()}
            </pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={copyPrompt} className="min-h-9 rounded-xl bg-white px-4 text-sm font-bold ring-1 ring-indigo-900/15 hover:bg-indigo-50">
                📋 Salin Prompt
              </button>
              <button type="button" onClick={downloadTemplate} className="min-h-9 rounded-xl bg-white px-4 text-sm font-bold ring-1 ring-indigo-900/15 hover:bg-indigo-50">
                ⬇ Unduh Template .md
              </button>
            </div>
          </details>
        </section>

        <section data-bank-group="guru-name">
            <label className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-900/70">
              Nama Mapel Guru:
              <input
                value={p.guru.name}
                onChange={(e) => {
                  const next: GuruBank = { ...p.guru, name: e.target.value };
                  p.setGuru(next);
                  saveGuru(next);
                }}
                placeholder="mis. IPA Kelas 5"
                className="min-h-9 flex-1 rounded-lg bg-white px-2 text-sm text-indigo-950 ring-1 ring-indigo-900/15 placeholder:text-indigo-900/40"
              />
            </label>
        </section>

        {SUBJECTS.map((s) => (
          <BankGroup key={s.id} title={`${s.icon} ${s.title}`} items={p.bank[s.id]} onDelete={(id) => deleteQuestion(s.id, id)} />
        ))}
        <BankGroup title="🧑‍🏫 Mapel Guru" items={p.guru.questions} onDelete={(id) => deleteQuestion("guru", id)} />
      </div>
    </main>
  );
}

function BankGroup({ title, items, onDelete }: { title: string; items: Q[]; onDelete: (id: string) => void }) {
  return (
    <section data-bank-group={title}>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-950">
        {title}
        <span className="text-indigo-900/50">{items.length} soal</span>
      </h3>
      {items.length === 0 ? (
        <p className="rounded-lg bg-white/70 p-2 text-[11px] text-indigo-900/65 ring-1 ring-indigo-900/10">Belum ada soal.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} data-bank-item={item.id} className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-indigo-900/10">
              <div className="flex items-start gap-2">
                <p dir={item.isArabic ? "rtl" : "ltr"} className={`min-w-0 flex-1 text-[12px] font-semibold text-indigo-950 ${item.isArabic ? "font-arabic" : ""}`}>
                  {item.prompt}
                </p>
                <button
                  type="button"
                  aria-label={`Hapus soal ${item.prompt}`}
                  onClick={() => onDelete(item.id)}
                  className="min-h-7 shrink-0 rounded-md bg-rose-600/90 px-2 text-[11px] font-bold text-white hover:bg-rose-500"
                >
                  Hapus
                </button>
              </div>
              <p className="mt-1 text-[10px] text-indigo-900/65">
                Benar: <span className="font-bold text-emerald-700">{item.correct}</span>
                {item.custom ? " · buatan sendiri" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
