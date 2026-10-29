"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function StudentErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Student Portal Error]:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F1E8] px-4 py-12 text-center">
      <div className="w-full max-w-md rounded-3xl border border-[#8FA68E]/30 bg-white p-8 shadow-xl">
        <div className="mx-auto mb-4 flex justify-center">
          <Image
            src="/logo-horizontal.png"
            alt="Magguru"
            width={200}
            height={88}
            className="h-12 w-auto"
          />
        </div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D97757]/10 text-3xl">
          ⚠️
        </div>
        <h2 className="font-display text-xl font-black text-[#1F4A4E]">
          Terjadi Gangguan pada Portal Siswa
        </h2>
        <p className="mt-2 text-sm text-[#2B2B2B]/70 leading-relaxed">
          Jangan khawatir, sesi belajarmu tetap aman. Kamu bisa mencoba memuat ulang halaman atau kembali ke halaman login siswa.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-2xl bg-[#D97757] px-5 py-3 font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#C25F3E]"
          >
            🔄 Coba Lagi
          </button>
          <Link
            href="/student/login"
            className="w-full rounded-2xl border-2 border-[#2F6D72]/30 bg-[#2F6D72]/5 px-5 py-3 text-sm font-bold text-[#2F6D72] transition hover:bg-[#2F6D72]/10"
          >
            ← Kembali ke Login Siswa
          </Link>
        </div>
      </div>
    </main>
  );
}
