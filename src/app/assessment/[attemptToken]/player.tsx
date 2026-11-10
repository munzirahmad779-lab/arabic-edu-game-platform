"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Section = {
  id: string;
  section_order: number;
  section_type: string;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  audio_play_once: boolean;
  allow_review: boolean;
};

type Question = {
  id: string;
  section_id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  passage_id: string | null;
  audio_group_id: string | null;
};

type Passage = {
  id: string;
  section_id: string;
  passage_order: number;
  title: string | null;
  content: string;
};

type AudioGroup = {
  id: string;
  section_id: string;
  group_order: number;
  title: string | null;
  audio_url: string | null;
  storage_path: string | null;
};

type Answer = {
  question_id: string;
  selected_answer: string | null;
};

type AttemptSection = {
  section_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  time_spent_seconds: number | null;
  remaining_seconds: number | null;
};

type Attempt = {
  id: string;
  attempt_token: string;
  assessment_id: string;
  student_name: string;
  status: string;
  started_at: string;
  current_section_order: number;
  current_question_number: number;
};

type Assessment = {
  id: string;
  title: string;
  description: string | null;
};

// Player asesmen versi RPC (perbaikan W3-K3, migrasi 0091).
// Versi lama membaca correct_answer ke peramban, menulis is_correct
// dan skor akhir dari klien, dan menulis cap waktu section dari jam
// perangkat. Versi ini tidak menyentuh tabel assessment_* sama
// sekali: payload datang dari assessment_get_payload (tanpa kunci),
// jawaban dikirim ke assessment_submit_answer (dinilai di server),
// perpindahan section lewat assessment_set_section_state (cap waktu
// server), dan penutupan attempt lewat assessment_finish (skor
// dihitung di server). Tampilan dan alur yang terlihat siswa sama.
export function AssessmentPlayer({
  attempt,
  assessment,
  sections,
  questions,
  passages,
  audioGroups,
  answers,
  attemptSections,
}: {
  attempt: Attempt;
  assessment: Assessment;
  sections: Section[];
  questions: Question[];
  passages: Passage[];
  audioGroups: AudioGroup[];
  answers: Answer[];
  attemptSections: AttemptSection[];
}) {
  // Posisi awal mengikuti current_section_order yang dicatat server,
  // supaya resume sesudah memuat ulang halaman mendarat di section
  // yang sedang berjalan (attempt baru selalu bernilai 1 = section
  // pertama, sama seperti perilaku lama).
  const [currentSectionIdx, setCurrentSectionIdx] = useState(() => {
    const fromOrder = (attempt.current_section_order ?? 1) - 1;
    return Math.min(
      Math.max(fromOrder, 0),
      Math.max(sections.length - 1, 0),
    );
  });
  const [currentQuestionNum, setCurrentQuestionNum] = useState(1);
  const [answerMap, setAnswerMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const a of answers) {
      if (a.selected_answer) map[a.question_id] = a.selected_answer;
    }
    return map;
  });
  const [attemptSectionsState, setAttemptSectionsState] =
    useState<AttemptSection[]>(attemptSections);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassage, setShowPassage] = useState(true);
  const endsAtRef = useRef<number>(Date.now());
  const autoFiredRef = useRef<boolean>(false);
  // Penjaga lewati section kosong: satu pemanggilan otomatis per id
  // section, supaya efek yang berjalan ulang untuk section yang sama
  // tidak menembakkan penyelesaian section dua kali.
  const skippedEmptyRef = useRef<Set<string>>(new Set());
  // Keadaan lokal section yang sedang aktif, dibaca oleh efek lewati
  // tanpa menjadikannya dependensi efek itu. Nilainya disalin dari
  // attemptSectionsState oleh efek penyalin di bawah.
  const attemptSectionsRef = useRef<AttemptSection[]>(attemptSections);

  const currentSection = sections[currentSectionIdx];
  const sectionQuestions = useMemo(
    () =>
      questions
        .filter((q) => q.section_id === currentSection?.id)
        .sort((a, b) => a.question_number - b.question_number),
    [questions, currentSection?.id],
  );

  const currentQuestion = sectionQuestions.find(
    (q) => q.question_number === currentQuestionNum,
  );

  const currentPassage = currentQuestion?.passage_id
    ? passages.find((p) => p.id === currentQuestion.passage_id)
    : null;

  const currentAudioGroup = currentQuestion?.audio_group_id
    ? audioGroups.find((a) => a.id === currentQuestion.audio_group_id)
    : null;

  useEffect(() => {
    if (!currentSection) return;
    const secState = attemptSectionsState.find(
      (s) => s.section_id === currentSection.id,
    );
    const duration = currentSection.duration_minutes * 60;
    // Sisa waktu awal berasal dari hitungan server di payload
    // (remaining_seconds); jam perangkat hanya menghitung mundur
    // untuk tampilan. Keputusan habis waktu ditegakkan server:
    // submit sesudah batas ditolak assessment_submit_answer.
    const initialRemaining = secState?.remaining_seconds ?? duration;
    endsAtRef.current = Date.now() + initialRemaining * 1000;
    autoFiredRef.current = false;

    if (secState?.status === "pending") {
      void startSection(currentSection.id);
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((endsAtRef.current - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining === 0 && !autoFiredRef.current) {
        autoFiredRef.current = true;
        void autoNextSection();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionIdx, currentSection?.id]);

  // Penyalin ref keadaan section: menjaga attemptSectionsRef selalu
  // sama dengan attemptSectionsState tanpa menjadikan state itu
  // dependensi efek lewati. Berjalan sesudah tiap render, sebelum
  // efek lewati di bawahnya pada render yang sama.
  useEffect(() => {
    attemptSectionsRef.current = attemptSectionsState;
  }, [attemptSectionsState]);

  // Lewati section aktif yang tidak mempunyai soal sama sekali:
  // tanpa ini currentQuestion tidak pernah ada dan halaman tertahan
  // di teks memuat selamanya (kasus nyata asesmen TOEFL produksi:
  // section urutan 1 dan 3 kosong, soal hanya di section 2).
  // Urutan di dalam efek ini mengikuti alur manual: section pending
  // dimulai lebih dulu oleh efek section di atas (startSection tidak
  // ditunggu, tetapi panggilan finish di server menolak section yang
  // belum dimulai, dan jalur itu dulu juga dihadapi tombol manual:
  // galat akhirnya sinkron ulang lewat resync bila keadaan belum
  // sepakat), lalu jalur penyelesaian yang sama dengan tombol selesai
  // (finishSection) memajukan ke section berikutnya atau menutup
  // attempt pada section terakhir. Ref per id section mencegah
  // panggilan ganda; resync dari finishSection mengganti
  // attemptSectionsState sehingga efek berjalan lagi dan rantai
  // berlanjut bila section berikutnya juga kosong.
  useEffect(() => {
    if (!currentSection) return;
    if (sectionQuestions.length > 0) return;
    const secState = attemptSectionsRef.current.find(
      (s) => s.section_id === currentSection.id,
    );
    // Section yang sudah selesai di sisi klien tetapi indeks belum
    // berpindah (finish pertama menjawab tanpa arah yang jelas dan
    // resync belum kembali): jangan tembak ulang, tunggu resync.
    if (secState?.status === "completed") return;
    if (skippedEmptyRef.current.has(currentSection.id)) return;
    skippedEmptyRef.current.add(currentSection.id);
    void finishSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSectionIdx,
    currentSection?.id,
    sectionQuestions.length,
    attemptSectionsState,
  ]);

  async function saveAnswer(questionId: string, answer: string) {
    setAnswerMap((prev) => ({ ...prev, [questionId]: answer }));
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error } = await db.rpc("assessment_submit_answer", {
        p_attempt_token: attempt.attempt_token,
        p_question_id: questionId,
        p_answer: answer,
      });
      if (error) {
        const message = error.message ?? "";
        if (message.includes("attempt_completed")) {
          window.location.href = `/assessment/${attempt.attempt_token}/result`;
        } else if (message.includes("section_time_expired")) {
          // Server menyatakan waktu section habis: tutup section
          // lewat jalur yang sama dengan timer.
          void autoNextSection();
        }
        // Error lain diamkan seperti perilaku lama: pilihan siswa
        // tetap tampil terpilih di UI (optimistis).
      }
    } catch {
      // silent
    }
  }

  async function startSection(sectionId: string) {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.rpc("assessment_set_section_state", {
        p_attempt_token: attempt.attempt_token,
        p_section_id: sectionId,
        p_action: "start",
      });
      if (error || !data) return;
      setAttemptSectionsState((prev) =>
        prev.map((s) =>
          s.section_id === sectionId
            ? {
                ...s,
                status: data.status,
                started_at: data.started_at,
                remaining_seconds: data.remaining_seconds,
              }
            : s,
        ),
      );
    } catch {
      // silent: jaring pengaman saja, kegagalan mulai section akan
      // terlihat saat submit/finish dan ditangani di sana
    }
  }

  async function finishSection() {
    if (!currentSection) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db.rpc("assessment_set_section_state", {
      p_attempt_token: attempt.attempt_token,
      p_section_id: currentSection.id,
      p_action: "finish",
    });

    if (error || !data) {
      const message = error?.message ?? "";
      if (message.includes("attempt_completed")) {
        window.location.href = `/assessment/${attempt.attempt_token}/result`;
        return;
      }
      if (message.includes("token_expired")) {
        window.location.href = "/assessment?error=token_expired";
        return;
      }
      if (
        message.includes("section_out_of_order") ||
        message.includes("section_already_completed")
      ) {
        // Keadaan lokal dan server tidak sepakat (mis. panggilan
        // ganda tombol + timer): sinkronkan ulang dari payload server.
        await resyncFromServer();
        return;
      }
      // Error lain: jangan berpindah section; siswa tetap di sini
      // dan dapat menekan tombol selesai lagi.
      return;
    }

    setAttemptSectionsState((prev) =>
      prev.map((s) => {
        if (s.section_id === currentSection.id) {
          return {
            ...s,
            status: data.status,
            started_at: data.started_at,
            finished_at: data.finished_at,
            time_spent_seconds: data.time_spent_seconds,
            remaining_seconds: 0,
          };
        }
        if (data.next_section_id && s.section_id === data.next_section_id) {
          return {
            ...s,
            status: "in_progress",
            started_at: data.next_started_at,
            remaining_seconds: data.next_remaining_seconds,
          };
        }
        return s;
      }),
    );

    if (data.is_last_section) {
      await finishAttempt();
      return;
    }

    if (data.next_section_id) {
      const nextIdx = sections.findIndex(
        (s) => s.id === data.next_section_id,
      );
      if (nextIdx >= 0) {
        setCurrentSectionIdx(nextIdx);
        setCurrentQuestionNum(1);
        if (typeof data.next_remaining_seconds === "number") {
          setTimeLeft(data.next_remaining_seconds);
        }
        return;
      }
    }

    // Respons tidak membawa arah yang jelas (mis. finish ganda yang
    // dijawab idempoten server): sinkronkan ulang dari payload.
    await resyncFromServer();
  }

  async function autoNextSection() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await finishSection();
    } finally {
      setSubmitting(false);
    }
  }

  async function finishAttempt() {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    // Skor dihitung dan ditulis server oleh assessment_finish;
    // halaman hasil membaca kolom skor dari attempt seperti biasa.
    const { error } = await db.rpc("assessment_finish", {
      p_attempt_token: attempt.attempt_token,
    });
    if (error && !(error.message ?? "").includes("attempt_completed")) {
      // Gagal menutup attempt di server: tetap di halaman ini supaya
      // penutupan bisa dicoba lagi, jangan arahkan ke hasil yang
      // belum tersimpan.
      return;
    }
    window.location.href = `/assessment/${attempt.attempt_token}/result`;
  }

  async function resyncFromServer() {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.rpc("assessment_get_payload", {
        p_attempt_token: attempt.attempt_token,
      });
      if (error || !data) {
        if ((error?.message ?? "").includes("attempt_completed")) {
          window.location.href = `/assessment/${attempt.attempt_token}/result`;
        }
        return;
      }
      setAttemptSectionsState(data.attempt_sections ?? []);
      const order = data.attempt?.current_section_order ?? 1;
      setCurrentSectionIdx(
        Math.min(Math.max(order - 1, 0), Math.max(sections.length - 1, 0)),
      );
      setCurrentQuestionNum(1);
    } catch {
      // silent
    }
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Ujian tanpa satu pun section: keadaan akhir yang jujur, bukan
  // memuat tanpa akhir. Pesan ini tidak bergantung pada data yang
  // akan datang, karena sections berasal dari payload awal.
  if (sections.length === 0) {
    return (
      <div className="min-h-screen bg-warmwhite p-6">
        <p className="text-center text-softslate">
          Ujian ini belum memiliki bagian soal.
        </p>
      </div>
    );
  }

  // Sesudah pemeriksaan di atas, currentSection selalu ada (indeks
  // terjepit ke rentang sections). Yang mungkin kosong hanyalah
  // currentQuestion, dan itu hanya sesaat: section tanpa soal sedang
  // dilewati efek lewati, atau nomor soal sedang disinkronkan ulang
  // sesudah resume/resync. Teks memuat di sini karena itu hanya
  // keadaan peralihan, bukan keadaan akhir.
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-warmwhite p-6">
        <p className="text-center text-softslate">Memuat ujian...</p>
      </div>
    );
  }

  const answeredCount = Object.keys(answerMap).length;
  const totalQuestions = questions.length;

  return (
    <div className="min-h-screen bg-warmwhite">
      <header className="sticky top-0 z-30 border-b border-sage-200/60 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-terracotta-500">
              {attempt.student_name}
            </p>
            <h1 className="font-display text-lg font-black text-teal-700">
              {assessment.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs">
              <span className="font-bold text-teal-700">
                Section {currentSectionIdx + 1}/{sections.length}
              </span>
            </div>
            <div className="rounded-xl bg-terracotta-50 px-3 py-1.5 text-xs">
              <span className="font-bold text-terracotta-600">
                Soal {currentQuestionNum}/{sectionQuestions.length}
              </span>
            </div>
            <div
              className={`rounded-xl px-4 py-1.5 text-sm font-mono font-black tabular-nums ${
                (timeLeft ?? 0) <= 60
                  ? "animate-pulse bg-red-100 text-red-700"
                  : "bg-sage-100 text-sage-600"
              }`}
              dir="ltr"
            >
              ⏱ {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <main className="space-y-4">
            <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
                {currentSection.section_type}
              </p>
              <h2 className="font-display mt-1 text-xl font-black text-teal-700">
                {currentSection.title}
              </h2>
              {currentSection.instructions ? (
                <p className="mt-2 text-sm text-softslate/80">
                  {currentSection.instructions}
                </p>
              ) : null}
            </div>

            {currentAudioGroup ? (
              <div className="rounded-2xl border-2 border-terracotta-500/30 bg-terracotta-50 p-4">
                <p className="text-xs font-black text-terracotta-600">
                  🎧 {currentAudioGroup.title ?? "Audio"}
                  {currentSection.audio_play_once
                    ? " — diputar sekali, tidak bisa diulang"
                    : ""}
                </p>
                {currentAudioGroup.audio_url ? (
                  <audio
                    src={currentAudioGroup.audio_url}
                    controls
                    controlsList={
                      currentSection.audio_play_once
                        ? "nodownload noplaybackrate noremoteplayback"
                        : undefined
                    }
                    className="mt-2 w-full"
                  />
                ) : (
                  <p className="mt-2 text-xs text-terracotta-600">
                    Audio belum di-upload guru.
                  </p>
                )}
              </div>
            ) : null}

            {currentPassage ? (
              <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
                <button
                  type="button"
                  onClick={() => setShowPassage((v) => !v)}
                  className="mb-2 flex w-full items-center justify-between text-xs font-black text-teal-700"
                >
                  <span>📖 {currentPassage.title ?? "Bacaan"}</span>
                  <span>{showPassage ? "−" : "+"}</span>
                </button>
                {showPassage ? (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-softslate">
                    {currentPassage.content}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="aesthetic-card">
              <p className="text-sm font-black text-teal-700">
                Soal {currentQuestionNum}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-base font-medium leading-8 text-teal-700">
                {currentQuestion.question_text}
              </p>

              <div className="mt-4 space-y-2">
                {(
                  [
                    ["A", currentQuestion.option_a],
                    ["B", currentQuestion.option_b],
                    ["C", currentQuestion.option_c],
                    ["D", currentQuestion.option_d],
                  ] as const
                ).map(([key, text]) => {
                  const selected = answerMap[currentQuestion.id] === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => saveAnswer(currentQuestion.id, key)}
                      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-start transition ${
                        selected
                          ? "border-terracotta-500 bg-terracotta-50"
                          : "border-sage-200 bg-white hover:border-terracotta-500/50 hover:bg-terracotta-50/50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black ${
                          selected
                            ? "bg-terracotta-500 text-white"
                            : "bg-sage-100 text-teal-700"
                        }`}
                      >
                        {key}
                      </span>
                      <span className="text-sm font-medium leading-7 text-softslate">
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentQuestionNum((n) => Math.max(1, n - 1))
                }
                disabled={currentQuestionNum <= 1}
                className="rounded-full border border-sage-200 bg-white px-5 py-2.5 text-sm font-black text-teal-700 transition hover:bg-sage-50 disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              {currentQuestionNum < sectionQuestions.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionNum((n) => n + 1)}
                  className="rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void finishSection()}
                  disabled={submitting}
                  className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-60"
                >
                  {submitting
                    ? "..."
                    : currentSectionIdx + 1 < sections.length
                      ? "Selesai Section → Next"
                      : "Selesai & Lihat Hasil"}
                </button>
              )}
            </div>
          </main>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-sage-200/60 bg-white p-4">
              <p className="text-xs font-black text-teal-700">Navigasi Soal</p>
              <p className="mt-1 text-[10px] text-softslate/70">
                {answeredCount} dari {totalQuestions} terjawab
              </p>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {sectionQuestions.map((q) => {
                  const answered = Boolean(answerMap[q.id]);
                  const isCurrent = q.question_number === currentQuestionNum;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQuestionNum(q.question_number)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition ${
                        isCurrent
                          ? "bg-teal-700 text-white"
                          : answered
                            ? "bg-terracotta-500 text-white"
                            : "bg-sage-100 text-teal-700 hover:bg-sage-200"
                      }`}
                    >
                      {q.question_number}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-sage-200/60 bg-white p-4 text-xs">
              <p className="font-black text-teal-700">Sections</p>
              <ul className="mt-2 space-y-1">
                {sections.map((s, idx) => (
                  <li
                    key={s.id}
                    className={`rounded-lg px-2 py-1 ${
                      idx === currentSectionIdx
                        ? "bg-teal-50 font-black text-teal-700"
                        : idx < currentSectionIdx
                          ? "text-sage-600"
                          : "text-softslate/50"
                    }`}
                  >
                    {idx + 1}. {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
