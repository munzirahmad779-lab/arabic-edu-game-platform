"use client";

import { useEffect, useRef, useState } from "react";
import { savePostTestAnswer } from "./actions";

export type PostTestQuestion = {
  id: string;
  urutan: number;
  dars: number;
  pertanyaan: string;
  answered: boolean;
  drive_link: string | null;
  durasi_detik: number | null;
};

function formatDurasi(totalDetik: number): string {
  const m = Math.floor(totalDetik / 60);
  const s = totalDetik % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

type Phase =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "sent"
  | "error";

/**
 * Kirim data rekaman ke rute unggah. Bila fetch pertama terlempar
 * karena jaringan putus sesaat (janji fetch ditolak), coba sekali
 * lagi secara otomatis dengan data yang sama persis sebelum
 * menyerah. Balasan yang diterima dari server, termasuk balasan
 * galat, tidak dicoba ulang di sini; ketahanan di sisi server
 * sudah menangani kegagalan jembatan unggahnya.
 */
async function fetchUnggahJawaban(form: FormData): Promise<Response> {
  try {
    return await fetch("/api/student/post-test/upload", {
      method: "POST",
      body: form,
    });
  } catch {
    return fetch("/api/student/post-test/upload", {
      method: "POST",
      body: form,
    });
  }
}

function SoalCard({
  question,
  onAnsweredChange,
}: {
  question: PostTestQuestion;
  onAnsweredChange: (questionId: string, answered: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>(
    question.answered ? "sent" : "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState<number>(
    question.durasi_detik ?? 0,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sentLink, setSentLink] = useState<string | null>(question.drive_link);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Hasil unggahan Drive yang SUDAH berhasil tetapi simpannya ke
  // server belum berhasil. Disimpan supaya tekanan Kirim berikutnya
  // cukup mengulang RPC simpan dengan file_id yang sama, tanpa
  // mengunggah berkas baru dan tanpa menggandakan berkas di Drive
  // (audit 18 Nov). Dikosongkan hanya saat siswa merekam ulang.
  const [uploaded, setUploaded] = useState<{
    fileId: string;
    link: string;
  } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countedRef = useRef<boolean>(question.answered);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // Pembersihan sekali saat komponen dilepas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mulaiRekam() {
    setErrorMsg(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setPhase("error");
      setErrorMsg(
        "Peramban ini tidak mendukung perekaman suara. Coba buka dari Chrome di HP kamu.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stopStream();
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        setRecordedSeconds(
          Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        );
        setPhase("recorded");
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start();
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setElapsed(
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        );
      }, 500);
    } catch {
      stopStream();
      setPhase("error");
      setErrorMsg(
        "Izin mikrofon ditolak atau tidak tersedia. Aktifkan izin mikrofon untuk situs ini, lalu coba lagi.",
      );
    }
  }

  function berhentiRekam() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function rekamUlang() {
    blobRef.current = null;
    // Rekaman baru berarti unggahan lama tidak dipakai lagi: hasil
    // unggahan tersimpan dibuang supaya kirim berikutnya mengunggah
    // berkas rekaman yang baru.
    setUploaded(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPhase("idle");
    setErrorMsg(null);
  }

  async function kirim() {
    setPhase("uploading");
    setErrorMsg(null);
    try {
      let fileId = uploaded?.fileId;
      let link = uploaded?.link;

      if (!fileId || !link) {
        const blob = blobRef.current;
        if (!blob) {
          setPhase("recorded");
          return;
        }
        const form = new FormData();
        const ext = blob.type.includes("mp4")
          ? "m4a"
          : blob.type.includes("ogg")
            ? "ogg"
            : "webm";
        form.append(
          "audio",
          new File([blob], `jawaban-soal-${question.urutan}.${ext}`, {
            type: blob.type || "audio/webm",
          }),
        );
        form.append("urutan", String(question.urutan));

        const res = await fetchUnggahJawaban(form);
        const payload = (await res.json().catch(() => null)) as {
          file_id?: string;
          link?: string;
          message?: string;
        } | null;
        if (!res.ok || !payload?.file_id || !payload?.link) {
          throw new Error(payload?.message ?? "UPLOAD_FAILED");
        }

        fileId = payload.file_id;
        link = payload.link;
        // Unggahan berhasil: simpan file_id dan tautannya SEBELUM
        // mencoba menyimpan, supaya kegagalan simpan sesudah ini
        // tidak memaksa unggah ulang.
        setUploaded({ fileId, link });
      }

      const saved = await savePostTestAnswer(
        question.id,
        fileId,
        link,
        recordedSeconds,
      );
      if (!saved.ok) {
        throw new Error(
          saved.closed
            ? "Post tes sudah ditutup guru, jawaban tidak tersimpan."
            : "SAVE_FAILED",
        );
      }

      setSentLink(link);
      setPhase("sent");
      if (!countedRef.current) {
        countedRef.current = true;
        onAnsweredChange(question.id, true);
      }
    } catch (err) {
      setPhase("recorded");
      setErrorMsg(
        err instanceof Error && err.message !== "UPLOAD_FAILED" && err.message !== "SAVE_FAILED"
          ? err.message
          : "Jawaban gagal terkirim. Periksa koneksimu, lalu tekan Kirim Jawaban lagi.",
      );
    }
  }

  return (
    <article className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-violet-600">
            Soal {question.urutan} · Dars {question.dars}
          </p>
          <p
            dir="auto"
            className="mt-2 whitespace-pre-wrap text-lg font-bold leading-relaxed text-neutral-900"
          >
            {question.pertanyaan}
          </p>
        </div>
        {phase === "sent" ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
            ✓ Terkirim
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
            Belum dijawab
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {phase === "recording" ? (
          <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <p className="text-sm font-bold text-red-700">
              Sedang merekam... {formatDurasi(elapsed)}
            </p>
          </div>
        ) : null}

        {previewUrl && phase !== "recording" ? (
          <audio controls src={previewUrl} className="w-full" />
        ) : null}

        {phase === "sent" && !previewUrl && sentLink ? (
          <p className="text-sm text-neutral-500">
            Rekaman jawabanmu sudah tersimpan.{" "}
            <a
              href={sentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-violet-700 underline"
            >
              Dengarkan rekamanmu
            </a>
            {recordedSeconds > 0
              ? ` · durasi ${formatDurasi(recordedSeconds)}`
              : ""}
          </p>
        ) : null}

        {errorMsg ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMsg}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {phase === "idle" || phase === "error" ? (
            <button
              type="button"
              onClick={mulaiRekam}
              className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-black text-white shadow transition hover:bg-red-700"
            >
              🎙️ Rekam Jawaban
            </button>
          ) : null}

          {phase === "recording" ? (
            <button
              type="button"
              onClick={berhentiRekam}
              className="rounded-2xl bg-neutral-900 px-5 py-2.5 text-sm font-black text-white shadow transition hover:bg-neutral-700"
            >
              ⏹️ Berhenti
            </button>
          ) : null}

          {phase === "recorded" ? (
            <>
              <button
                type="button"
                onClick={kirim}
                className="rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-black text-white shadow transition hover:bg-teal-700"
              >
                Kirim Jawaban
              </button>
              <button
                type="button"
                onClick={rekamUlang}
                className="rounded-2xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:text-violet-700"
              >
                Rekam Ulang
              </button>
            </>
          ) : null}

          {phase === "uploading" ? (
            <p className="rounded-2xl bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700">
              Mengirim rekaman... tunggu sampai selesai.
            </p>
          ) : null}

          {phase === "sent" ? (
            <button
              type="button"
              onClick={rekamUlang}
              className="rounded-2xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:text-violet-700"
            >
              Rekam Ulang Jawaban
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PostTesClient({
  questions,
  totalQuestions,
  initialAnswered,
}: {
  questions: PostTestQuestion[];
  totalQuestions: number;
  initialAnswered: number;
}) {
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(
    () =>
      new Set([
        ...questions.filter((q) => q.answered).map((q) => q.id),
      ]),
  );
  const answeredCount = Math.max(initialAnswered, answeredIds.size);
  const pct =
    totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;

  function handleAnsweredChange(questionId: string, answered: boolean) {
    setAnsweredIds((prev) => {
      const next = new Set(prev);
      if (answered) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-teal-100 bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between text-sm font-bold text-neutral-800">
          <span>Kemajuan Post Tes: {pct}%</span>
          <span>
            {answeredCount} dari {totalQuestions} terkirim
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          Rekam jawabanmu untuk tiap soal, dengarkan dulu hasilnya, lalu
          tekan Kirim Jawaban. Jawaban yang sudah terkirim masih bisa
          diganti dengan merekam ulang soal yang sama.
        </p>
      </section>

      {questions.map((q) => (
        <SoalCard
          key={q.id}
          question={q}
          onAnsweredChange={handleAnsweredChange}
        />
      ))}

      {answeredCount >= totalQuestions && totalQuestions > 0 ? (
        <section className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="text-5xl">✅</div>
          <p className="mt-3 font-black text-emerald-800">
            Semua jawaban post tes sudah terkirim.
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            Gurumu akan mendengarkan dan menilai rekamanmu. Terima kasih
            sudah mengerjakan ujian akhir ini dengan sungguh-sungguh.
          </p>
        </section>
      ) : null}
    </div>
  );
}
