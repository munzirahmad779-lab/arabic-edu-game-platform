"use client";

import Link from "next/link";
import { displayGameName } from "@/lib/game-name";

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
  latihanLulus: boolean;
  status: string;
};

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  belum: { label: "Belum", cls: "bg-neutral-100 text-neutral-700" },
  proses: { label: "Proses", cls: "bg-amber-100 text-amber-800" },
  lulus: { label: "Lulus", cls: "bg-emerald-100 text-emerald-800" },
};

function WajibChip() {
  return (
    <span className="ms-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-xs font-black text-white shadow-sm">
      WAJIB · KERJAKAN SEGERA
    </span>
  );
}

export function TugasCard({ task }: { task: TugasCardData }) {
  const chip = STATUS_CHIP[task.status] ?? STATUS_CHIP.belum;
  const maxWrong = task.totalQuestions - task.passCorrect;
  const langkah2Buka = task.bacaDone;

  return (
    <article className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-neutral-900">
            Dars {task.darsNo} · {task.judul}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kamu tidak hadir pada pertemuan {task.meetingNos.join(" dan ")}.
            Dua langkah WAJIB dan harus dikerjakan segera: Baca Materi
            (Langkah 1) dan Latihan dars ini (Langkah 2). Tugas ini lulus
            bila kedua langkah wajib itu selesai.
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
            <WajibChip />
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
              <p className="mt-1 break-words text-sm leading-relaxed text-neutral-500">
                Baca materi Dars {task.darsNo} sampai akhir halaman. Langkah ini tercatat selesai begitu kamu mencapai akhir bacaan.
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
            Langkah 2 · Kerjakan Latihan Mandiri
            <WajibChip />
          </p>
          {!langkah2Buka ? (
            <p className="mt-1 text-sm text-neutral-500">
              🔒 Terkunci. Selesaikan Langkah 1 (baca materi) dulu.
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
      </ol>
    </article>
  );
}
