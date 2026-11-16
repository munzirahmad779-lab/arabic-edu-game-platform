"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayGameName } from "@/lib/game-name";
import type { KosakataPair } from "@/modules/tugas-susulan/kosakata";
import { GAME_STEP } from "@/modules/tugas-susulan/game-step";
import { startCatchupStep, completeCatchupStep } from "./actions";

export type TugasCardData = {
  darsNo: number;
  judul: string;
  meetingNos: number[];
  gameId: string | null;
  gameName: string | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  passCorrect: number;
  bacaDone: boolean;
  kosakataDone: boolean;
  qawaidDone: boolean;
  kosakataStartedAt: string | null;
  qawaidStartedAt: string | null;
  gameDone: boolean;
  latihanLulus: boolean;
  status: string;
  kata: KosakataPair[];
  qawaid: { judul: string; isi: string[] } | null;
};

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  belum: { label: "Belum", cls: "bg-neutral-100 text-neutral-700" },
  proses: { label: "Proses", cls: "bg-amber-100 text-amber-800" },
  lulus: { label: "Lulus", cls: "bg-emerald-100 text-emerald-800" },
};

const TOTAL_DETIK = 600; // timer 10 menit
const BATAS_AKTIF_DETIK = 420; // tombol aktif sesudah 7 menit berjalan

function fmtWaktu(detik: number): string {
  const s = Math.max(0, Math.ceil(detik));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function TimerStep({
  darsNo,
  step,
  icon,
  title,
  doneLabel,
  initialStartedAt,
  initialDone,
  children,
}: {
  darsNo: number;
  step: "kosakata" | "qawaid";
  icon: string;
  title: string;
  doneLabel: string;
  initialStartedAt: string | null;
  initialDone: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt);
  const [done, setDone] = useState(initialDone);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt || done) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt, done]);

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-black text-emerald-800">
          {icon} {title}: Selesai ✓
        </p>
      </div>
    );
  }

  if (!startedAt) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-black text-neutral-900">
          {icon} {title}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Timer 10 menit mulai berjalan saat bagian ini dibuka. Tombol
          selesai baru aktif bila sisa waktu tinggal 3 menit atau kurang.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await startCatchupStep(darsNo, step);
            setBusy(false);
            if (res.ok && res.startedAt) {
              setStartedAt(res.startedAt);
              setNow(Date.now());
            } else {
              setPesan("Belum bisa memulai. Coba lagi sebentar.");
            }
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-amber-600 disabled:opacity-50"
        >
          <span>⏱️</span>
          <span>Mulai (timer 10 menit)</span>
        </button>
        {pesan ? (
          <p className="mt-2 text-xs font-bold text-red-600">{pesan}</p>
        ) : null}
      </div>
    );
  }

  const elapsed = (now - new Date(startedAt).getTime()) / 1000;
  const sisa = TOTAL_DETIK - elapsed;
  const bolehSelesai = elapsed >= BATAS_AKTIF_DETIK;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-neutral-900">
          {icon} {title}
        </p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 shadow-sm">
          Sisa waktu: {fmtWaktu(sisa)}
        </span>
      </div>
      <div className="mt-3">{children}</div>
      <button
        type="button"
        disabled={!bolehSelesai || busy}
        onClick={async () => {
          setBusy(true);
          const res = await completeCatchupStep(darsNo, step);
          setBusy(false);
          if (res.ok) {
            setDone(true);
            router.refresh();
          } else {
            setPesan(
              "Server belum menerima: waktu minimal 7 menit belum tercapai. Tunggu sampai tombol aktif.",
            );
          }
        }}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        <span>✓</span>
        <span>
          {bolehSelesai
            ? doneLabel
            : `${doneLabel} (aktif pada sisa 3:00)`}
        </span>
      </button>
      {pesan ? (
        <p className="mt-2 text-xs font-bold text-red-600">{pesan}</p>
      ) : null}
    </div>
  );
}

function GameStep({ initialDone }: { initialDone: boolean }) {
  if (initialDone) {
    return (
      <p className="mt-1 text-sm font-bold text-emerald-700">
        Sudah main {GAME_STEP.name} ✓ Hasilmu tercatat di server.
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 text-sm text-neutral-500">
        Mainkan {GAME_STEP.name} sampai selesai satu ronde penuh.
        Hasilmu tercatat otomatis ke server sesudah ronde selesai, jadi
        langkah ini tuntas tanpa tombol konfirmasi.
      </p>
      {GAME_STEP.url ? (
        <div className="mt-2">
          <Link
            href={GAME_STEP.url}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-violet-700"
          >
            <span>🎮</span>
            <span>Main: {GAME_STEP.name}</span>
          </Link>
        </div>
      ) : null}
    </>
  );
}

export function TugasCard({ task }: { task: TugasCardData }) {
  const chip = STATUS_CHIP[task.status] ?? STATUS_CHIP.belum;
  const maxWrong = task.totalQuestions - task.passCorrect;
  const langkah2Buka = task.bacaDone;
  const langkah3Buka = task.kosakataDone && task.qawaidDone;

  return (
    <article className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-neutral-900">
            Dars {task.darsNo} · {task.judul}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kamu tidak hadir pada pertemuan {task.meetingNos.join(" dan ")}.
            Selesaikan langkah-langkah berikut secara berurutan.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${chip.cls}`}
        >
          {chip.label}
        </span>
      </div>

      <ol className="mt-5 space-y-5">
        <li>
          <p className="text-sm font-black text-neutral-900">
            Langkah 1 · Baca materi
          </p>
          {task.bacaDone ? (
            <p className="mt-1 text-sm font-bold text-emerald-700">
              Selesai membaca ✓{" "}
              <Link
                href={`/student/tugas-susulan/baca/${task.darsNo}`}
                className="font-bold text-violet-700 underline"
              >
                Baca lagi
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-neutral-500">
                Baca materi Dars {task.darsNo} sampai akhir halaman. Langkah
                ini tercatat selesai begitu kamu mencapai akhir bacaan.
              </p>
              <Link
                href={`/student/tugas-susulan/baca/${task.darsNo}`}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-violet-700"
              >
                <span>📖</span>
                <span>Mulai Membaca</span>
              </Link>
            </>
          )}
        </li>

        <li>
          <p className="text-sm font-black text-neutral-900">
            Langkah 2 · Hafalkan kosakata dan pahami qawaid
          </p>
          {!langkah2Buka ? (
            <p className="mt-1 text-sm text-neutral-500">
              🔒 Terkunci. Selesaikan Langkah 1 (baca materi) dulu.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              <TimerStep
                darsNo={task.darsNo}
                step="kosakata"
                icon="🔤"
                title="Kosakata"
                doneLabel="Sudah Hafal"
                initialStartedAt={task.kosakataStartedAt}
                initialDone={task.kosakataDone}
              >
                <ul className="grid gap-2 sm:grid-cols-2">
                  {task.kata.map((k) => (
                    <li
                      key={k.arab}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-3 py-2"
                    >
                      <span
                        dir="rtl"
                        className="text-base font-bold text-neutral-900"
                      >
                        {k.arab}
                      </span>
                      <span className="text-right text-sm text-neutral-600">
                        {k.arti}
                      </span>
                    </li>
                  ))}
                </ul>
              </TimerStep>

              <TimerStep
                darsNo={task.darsNo}
                step="qawaid"
                icon="📐"
                title="Qawaid"
                doneLabel="Sudah Paham"
                initialStartedAt={task.qawaidStartedAt}
                initialDone={task.qawaidDone}
              >
                {task.qawaid ? (
                  <div className="rounded-xl border border-amber-100 bg-white px-4 py-3">
                    <p className="font-black text-neutral-900">
                      {task.qawaid.judul}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-relaxed text-neutral-700">
                      {task.qawaid.isi.map((baris, i) => (
                        <li key={i}>{baris}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Rangkuman qawaid dars ini belum tersedia. Sampaikan ke
                    gurumu, lalu tekan Sudah Paham sesudah timer
                    memungkinkan.
                  </p>
                )}
              </TimerStep>
            </div>
          )}
        </li>

        <li>
          <p className="text-sm font-black text-neutral-900">
            Langkah 3 · Kerjakan Latihan Mandiri
          </p>
          {!langkah3Buka ? (
            <p className="mt-1 text-sm text-neutral-500">
              🔒 Terkunci. Selesaikan kosakata dan qawaid pada Langkah 2
              dulu.
            </p>
          ) : task.latihanLulus ? (
            <p className="mt-1 text-sm font-bold text-emerald-700">
              Latihan lulus ✓ Benar {task.correctCount} dari{" "}
              {task.totalQuestions} soal.
            </p>
          ) : task.gameId ? (
            <>
              <p className="mt-1 text-sm text-neutral-500">
                Lulus bila benar minimal {task.passCorrect} dari{" "}
                {task.totalQuestions} soal (salah maksimal {maxWrong}).
                Jawabanmu saat ini: {task.answeredCount} terjawab,{" "}
                {task.correctCount} benar.
              </p>
              <Link
                href={`/student/practice/${task.gameId}`}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-emerald-700"
              >
                <span>🎯</span>
                <span>
                  Kerjakan: {displayGameName(task.gameName ?? "Latihan")}
                </span>
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">
              Permainan latihan dars ini belum tersedia. Sampaikan ke
              gurumu.
            </p>
          )}
        </li>

        <li>
          <p className="text-sm font-black text-neutral-900">
            Langkah 4 · Game solo
          </p>
          {!GAME_STEP.required ? (
            <p className="mt-1 text-sm text-neutral-500">
              🎮 Game solo menyusul, menunggu pilihan guru. Langkah ini
              belum menjadi syarat lulus tugas.
            </p>
          ) : !task.latihanLulus ? (
            <p className="mt-1 text-sm text-neutral-500">
              🔒 Terkunci. Luluskan Latihan Mandiri pada Langkah 3 dulu.
            </p>
          ) : (
            <GameStep initialDone={task.gameDone} />
          )}
        </li>
      </ol>
    </article>
  );
}
