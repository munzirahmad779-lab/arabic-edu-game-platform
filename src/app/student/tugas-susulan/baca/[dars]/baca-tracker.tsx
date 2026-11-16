"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeCatchupStep } from "../../actions";

export function BacaTracker({
  darsNo,
  sudahSelesai,
}: {
  darsNo: number;
  sudahSelesai: boolean;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(sudahSelesai);
  const terkirim = useRef(false);

  useEffect(() => {
    if (done) return;

    const hitung = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      const jalan = total > 0 ? Math.min(1, el.scrollTop / total) : 1;
      setPct(Math.round(jalan * 100));
      return jalan;
    };

    const kirimSelesai = async () => {
      if (terkirim.current) return;
      terkirim.current = true;
      const res = await completeCatchupStep(darsNo, "baca");
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        terkirim.current = false;
      }
    };

    const onScroll = () => {
      if (hitung() >= 0.98) {
        void kirimSelesai();
      }
    };

    // Halaman pendek yang tidak bisa digulir langsung dianggap terbaca
    // sampai akhir.
    if (hitung() >= 0.98) {
      void kirimSelesai();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [darsNo, done, router]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-100 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        {done ? (
          <>
            <p className="flex-1 text-sm font-black text-emerald-700">
              ✓ Selesai membaca. Langkah baca sudah tercatat.
            </p>
            <Link
              href="/student/tugas-susulan"
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-emerald-700"
            >
              Lanjut ke Langkah 2
            </Link>
          </>
        ) : (
          <>
            <p className="shrink-0 text-sm font-bold text-neutral-700">
              Belum selesai membaca · {pct}%
            </p>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="hidden shrink-0 text-xs text-neutral-500 sm:block">
              Gulir sampai akhir bacaan
            </p>
          </>
        )}
      </div>
    </div>
  );
}
