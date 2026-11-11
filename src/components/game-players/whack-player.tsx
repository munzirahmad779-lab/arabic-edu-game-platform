"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { playSfx } from "@/lib/game-engine/audio-bridge";
import type {
  RawQuestion,
  RawOption,
  AnswerSubmission,
  AnswerResult,
} from "@/lib/game-engine/types";

const HOLES = [0, 1, 2, 3, 4, 5];

export function WhackPlayer({
  questions,
  onFinish,
  isRtl = false,
  onSubmitAnswer,
  singleQuestionMode = false,
}: {
  questions: RawQuestion[];
  onFinish?: (finalScore: number, correctCount: number) => void;
  isRtl?: boolean;
  // Kontrak mode room, meniru kosakata GamePlayerProps: bila prop ini
  // diberikan, komponen berjalan sebagai pemain satu soal di room siswa
  // dan vonis jawaban datang dari server lewat AnswerResult.
  onSubmitAnswer?: (submission: AnswerSubmission) => Promise<AnswerResult>;
  singleQuestionMode?: boolean;
}) {
  // Mode room aktif bila induk menyediakan onSubmitAnswer. Pada mode ini
  // skor lokal, nyawa, dan timer lokal (termasuk bonus waktu) dimatikan;
  // pergantian soal diatur induk lewat remount per soal
  // (singleQuestionMode), dan permainan tidak pernah diakhiri dari sini.
  const isRoomMode = onSubmitAnswer !== undefined;
  void singleQuestionMode;
  const [questionList, setQuestionList] = useState(() => [...questions]);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setQuestionList([...questions]);
    }
  }, [questions]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const correctRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);
  const clearPendingTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);
  useEffect(() => clearPendingTimers, [clearPendingTimers]);
  // Satu pintu akhir permainan: onFinish tepat satu kali per sesi.
  // Mode room digerbang di pintu yang sama: akhir permainan adalah
  // urusan induk, jadi onFinish tidak pernah dipanggil dari mode room.
  const finishGame = useCallback(
    (finalScore: number) => {
      if (finishedRef.current) return;
      if (isRoomMode) return;
      finishedRef.current = true;
      setIsGameOver(true);
      onFinish?.(finalScore, correctRef.current);
    },
    [onFinish, isRoomMode],
  );
  const [streak, setStreak] = useState(0);
  const [health, setHealth] = useState(3);
  const [timerLeft, setTimerLeft] = useState(25);
  // Bonus waktu dari jawaban benar, dibawa ke soal berikutnya.
  // Sebelumnya bonus ditambahkan ke timer soal berjalan lalu tertimpa
  // setTimerLeft(25) saat soal berganti, jadi tidak pernah berdampak
  // (cacat K30). Kini bonus disimpan di sini dan dipasang sebagai
  // waktu awal soal berikutnya (25 + bonus, maksimum 30).
  const pendingBonusRef = useRef(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const isProcessingBonkRef = useRef(false);
  // Mode room: waktu soal tampil untuk responseTimeMs yang nyata
  // (komponen di-remount induk per soal, jadi nilai awal ref adalah
  // awal soal ini), dan umpan balik vonis server pada tikus yang
  // dipukul (hijau benar, merah salah) sampai soal berganti.
  const questionShownAtRef = useRef<number>(Date.now());
  const [roomFeedback, setRoomFeedback] = useState<{
    optionId: string;
    isCorrect: boolean;
  } | null>(null);
  const [activeHoles, setActiveHoles] = useState<
    Array<{
      holeId: number;
      option: RawOption;
      isPopped: boolean;
      hit: boolean;
    }>
  >([]);

  // Hammer swing animation coordinates
  const [hammerPos, setHammerPos] = useState<{ x: number; y: number; active: boolean } | null>(null);

  const activeQuestion = useMemo(() => {
    return (
      questionList[currentQIndex % (questionList.length || 1)] || {
        id: "q-mock",
        position: 0,
        question_text: "Pukul Tikus Kosakata",
        options: [
          { id: "1", option_key: "A", option_text: "Jawaban A" },
          { id: "2", option_key: "B", option_text: "Jawaban B" },
          { id: "3", option_key: "C", option_text: "Jawaban C" },
          { id: "4", option_key: "D", option_text: "Jawaban D" },
        ],
        correct_option_key: "A",
      }
    );
  }, [questionList, currentQIndex]);

  const correctKey = (activeQuestion.correct_option_key ?? "A").toUpperCase().trim();

  // Randomly assign options to holes
  const shuffleMoles = useCallback(() => {
    const opts = [...activeQuestion.options].slice(0, 4);
    const shuffledHoles = [...HOLES].sort(() => Math.random() - 0.5);

    const newActiveHoles = opts.map((opt, i) => ({
      holeId: shuffledHoles[i]!,
      option: opt,
      isPopped: true,
      hit: false,
    }));

    setActiveHoles(newActiveHoles);
  }, [activeQuestion.options]);

  useEffect(() => {
    shuffleMoles();
    const interval = setInterval(() => {
      shuffleMoles();
    }, 2800);
    return () => clearInterval(interval);
  }, [shuffleMoles]);

  // Countdown timer per question
  useEffect(() => {
    // Mode room: tidak ada timer lokal; batas waktu soal dipegang
    // induk (cangkang timer room dan penjaga tenggat halaman join),
    // jadi soal tidak pernah maju atau berakhir dari hitung mundur ini.
    if (isRoomMode) return;
    if (isGameOver) return;
    const timer = setInterval(() => {
      setTimerLeft((t) => {
        if (t <= 1) {
          // Timeout penalty: lose 1 heart instead of instant game over
          playSfx("wrong");
          setStreak(0);
          setHealth((h) => {
            if (h <= 1) {
              clearInterval(timer);
              finishGame(score);
              return 0;
            }
            return h - 1;
          });
          // Advance to next question on timeout
          if (currentQIndex + 1 < questionList.length) {
            setCurrentQIndex((idx) => idx + 1);
            return 25;
          } else {
            // Timeout pada soal terakhir dengan nyawa tersisa tetap
            // wajib mengakhiri permainan lewat finishGame, supaya
            // induk menerima onFinish (cacat K30).
            finishGame(score);
            return 0;
          }
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRoomMode, isGameOver, score, onFinish, currentQIndex, questionList.length, finishGame]);

  // Mode room: kirim pukulan sebagai jawaban ke server. Vonis HANYA
  // dari AnswerResult.isCorrect, karena soal room memang tidak membawa
  // correct_option_key (route sesi menghapusnya dengan sengaja), jadi
  // perbandingan kunci lokal di handleWhack tidak boleh dieksekusi di
  // mode ini. Sesudah accepted, masukan tetap terkunci
  // (isProcessingBonkRef tetap terpasang) sampai induk me-remount
  // komponen untuk soal berikutnya; pada accepted: false atau promise
  // yang melempar, kunci dibebaskan supaya siswa bisa mencoba lagi.
  const submitRoomAnswer = async (opt: RawOption) => {
    if (!onSubmitAnswer) {
      isProcessingBonkRef.current = false;
      return;
    }
    const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);
    let result: AnswerResult;
    try {
      result = await onSubmitAnswer({
        questionId: activeQuestion.id,
        selectedOptionId: opt.id,
        answerText: null,
        responseTimeMs,
      });
    } catch {
      isProcessingBonkRef.current = false;
      return;
    }
    if (!result.accepted) {
      isProcessingBonkRef.current = false;
      return;
    }
    playSfx(result.isCorrect ? "correct" : "wrong");
    setRoomFeedback({ optionId: opt.id, isCorrect: result.isCorrect });
  };

  // Handle Bonk
  const handleWhack = (opt: RawOption, e: React.MouseEvent) => {
    if (isGameOver || isProcessingBonkRef.current) return;
    isProcessingBonkRef.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    setHammerPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
      active: true,
    });
    later(() => setHammerPos(null), 300);

    // Mode room berhenti di sini: tidak ada skor lokal, pengurangan
    // nyawa, bonus waktu, atau lanjut soal dari komponen ini.
    if (isRoomMode) {
      void submitRoomAnswer(opt);
      return;
    }

    const isCorrect = opt.option_key.toUpperCase().trim() === correctKey;

    if (isCorrect) {
      playSfx("correct");
      correctRef.current += 1;
      setScore((s) => s + 100 + streak * 25);
      setStreak((st) => st + 1);
      // Bonus +5s: dicatat untuk soal berikutnya (total waktu awal
      // soal berikutnya maksimum 30 detik, sama seperti batas lama).
      pendingBonusRef.current = Math.min(5, pendingBonusRef.current + 5);

      // Advance question
      later(() => {
        isProcessingBonkRef.current = false;
        if (currentQIndex + 1 < questionList.length) {
          setCurrentQIndex((idx) => idx + 1);
          const bonus = pendingBonusRef.current;
          pendingBonusRef.current = 0;
          setTimerLeft(25 + bonus);
        } else {
          finishGame(score + 100 + streak * 25);
        }
      }, 500);
    } else {
      playSfx("wrong");
      setStreak(0);
      setScore((s) => Math.max(0, s - 30));
      // Deduct 1 health heart - only game over when all 3 hearts are depleted!
      setHealth((h) => {
        if (h <= 1) {
          finishGame(score);
          return 0;
        }
        return h - 1;
      });
      later(() => {
        isProcessingBonkRef.current = false;
      }, 400);
    }
  };

  const handleRestartAndReshuffle = () => {
    clearPendingTimers();
    correctRef.current = 0;
    finishedRef.current = false;
    pendingBonusRef.current = 0;
    isProcessingBonkRef.current = false;
    setQuestionList([...questions].sort(() => Math.random() - 0.5));
    setCurrentQIndex(0);
    setScore(0);
    setHealth(3);
    setTimerLeft(25);
    setStreak(0);
    setIsGameOver(false);
  };

  // Daftar soal kosong: tampilkan keadaan kosong yang jujur, jangan
  // memainkan soal tiruan "q-mock" (di mode room mock itu bahkan terkirim
  // ke server sebagai jawaban). Pola yang sama dengan MemoryPlayer.
  if (questionList.length === 0) {
    return (
      <div
        className="relative w-full h-[600px] bg-gradient-to-b from-amber-900 via-amber-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center border-4 border-amber-600 select-none p-6 text-center text-white space-y-4"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <span className="text-6xl">🔨</span>
        <h2 className="text-2xl font-black">Belum Ada Soal untuk Pukul Tikus</h2>
        <p className="max-w-md text-sm text-amber-200/90">
          Permainan ini belum memiliki soal, jadi belum bisa dimainkan.
          Tambahkan soal ke permainan ini dulu, lalu buka lagi halamannya.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[600px] bg-gradient-to-b from-amber-900 via-amber-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-4 border-amber-600 select-none p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/60 border border-white/20 p-3.5 rounded-2xl text-white backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔨</span>
          <div>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              WHACK-A-MOLE VOCAB (SOAL #{currentQIndex + 1} / {questionList.length})
            </span>
            <h3
              className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-[1.6]"
              style={{ fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif" }}
              dir="auto"
            >
              {activeQuestion.question_text}
            </h3>
          </div>
        </div>

        {/* Mode room: cip nyawa, timer, dan skor lokal disembunyikan
            karena ketiganya dimatikan; skor dan sisa waktu soal tampil
            di cangkang room milik induk. */}
        {!isRoomMode && (
          <div className="flex items-center gap-3">
            {/* Health Hearts */}
            <div className="flex items-center gap-1 text-sm bg-black/40 px-3 py-1 rounded-xl border border-white/10">
              {[1, 2, 3].map((h) => (
                <span key={h} className={h <= health ? "text-rose-500 text-lg" : "text-slate-600 text-lg"}>
                  ♥
                </span>
              ))}
            </div>

            <div className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-400/40">
              ⏱️ {timerLeft}s
            </div>
            <div className="px-3 py-1 rounded-xl bg-black/40 font-mono font-black text-emerald-400 text-sm border border-white/10">
              {score} Pts
            </div>
          </div>
        )}
      </div>

      {/* 6 Arcade Holes Grid. Pada lebar 390 kolom hanya sekitar
          108-114 px, jadi gundukan dan papan pilihan memakai ukuran
          kecil dulu (w-24, papan selebar kolom) dan baru membesar di
          sm ke atas; tanpa ini keduanya lebih lebar dari kolomnya dan
          bertumpang tindih (cacat K30). */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 my-auto max-w-3xl mx-auto w-full z-10 py-4">
        {HOLES.map((hId) => {
          const mole = activeHoles.find((h) => h.holeId === hId);

          return (
            <div key={hId} className="relative flex flex-col items-center justify-end h-36 sm:h-40">
              {/* Mole Hole Dirt Mound */}
              <div className="absolute bottom-0 w-24 sm:w-44 h-12 bg-amber-950 border-4 border-amber-800 rounded-full shadow-inner flex items-center justify-center">
                <div className="w-[4.5rem] sm:w-36 h-7 bg-black/80 rounded-full" />
              </div>

              {/* Animated Mole popping up */}
              {mole && (
                <button
                  type="button"
                  onClick={(e) => handleWhack(mole.option, e)}
                  className="relative z-10 mb-2 w-full transform transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center animate-in slide-in-from-bottom-8 cursor-pointer"
                >
                  {/* Mole Head & Face */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-700 border-2 border-amber-900 rounded-t-full relative shadow-md flex flex-col items-center pt-2">
                    {/* Ears */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-800 rounded-full" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-800 rounded-full" />
                    {/* Eyes */}
                    <div className="flex gap-2 mb-1">
                      <div className="w-2.5 h-2.5 bg-black rounded-full" />
                      <div className="w-2.5 h-2.5 bg-black rounded-full" />
                    </div>
                    {/* Snout */}
                    <div className="w-4 h-2.5 bg-rose-400 rounded-full mb-1" />
                  </div>

                  {/* Choice Board held by Mole - Adaptive Width and No Truncation */}
                  <div
                    className={`px-2 sm:px-3.5 py-2 rounded-2xl bg-white border-2 border-amber-900 shadow-xl text-center min-w-0 w-full sm:w-auto sm:min-w-[130px] sm:max-w-[240px] -mt-1 z-20 choice-board flex items-center justify-center gap-1.5 ${
                      roomFeedback && roomFeedback.optionId === mole.option.id
                        ? roomFeedback.isCorrect
                          ? "border-emerald-500 bg-emerald-100"
                          : "border-rose-500 bg-rose-100"
                        : ""
                    }`}
                  >
                    <span className="font-mono font-black text-xs text-amber-700 shrink-0">
                      {mole.option.option_key}:
                    </span>
                    <span
                      className={`font-black text-slate-900 break-words leading-tight ${
                        mole.option.option_text.length > 20
                          ? "text-xs"
                          : mole.option.option_text.length > 12
                          ? "text-xs sm:text-sm"
                          : "text-sm sm:text-base"
                      }`}
                      style={{
                        fontFamily: "'Traditional Arabic', var(--font-amiri), Amiri, Tahoma, serif",
                        lineHeight: 1.25,
                      }}
                      dir="auto"
                    >
                      {mole.option.option_text}
                    </span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Mallet Swing Effect */}
      {hammerPos && (
        <div
          className="fixed pointer-events-none z-50 text-5xl transform -rotate-45 animate-spin"
          style={{ left: hammerPos.x - 30, top: hammerPos.y - 40 }}
        >
          🔨
        </div>
      )}

      {/* Bottom Hint */}
      <div className="text-center text-xs text-amber-200/80 bg-black/40 py-2 rounded-xl">
        {isRoomMode
          ? "Pukul tikus yang membawa jawaban yang benar!"
          : "Pukul tikus yang membawa jawaban yang benar secepat mungkin! Anda memiliki 3 nyawa."}
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <span className="text-6xl animate-bounce">🏆</span>
          <h2 className="text-3xl font-black">Permainan Selesai!</h2>
          <p className="text-xl font-bold font-mono text-emerald-400">Total Skor Akhir: {score} Poin</p>
          <button
            type="button"
            onClick={handleRestartAndReshuffle}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl transition hover:scale-105 flex items-center gap-2"
          >
            <span>🎲</span>
            <span>Acak Soal & Main Lagi</span>
          </button>
        </div>
      )}
    </div>
  );
}
