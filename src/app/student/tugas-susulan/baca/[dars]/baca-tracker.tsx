"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeCatchupStep } from "../../actions";
import {
  bacaDianggapSelesai,
  hitungPersenBaca,
  tombolSelesaiAktif,
  type UkuranGulir,
} from "@/modules/tugas-susulan/baca-progress";

function ukuranGulirHalaman(): UkuranGulir {
  const el = document.documentElement;
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
}

export function BacaTracker({
  darsNo,
  sudahSelesai,
}: {
  darsNo: number;
  sudahSelesai: boolean;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(0);
  const [bisaSelesai, setBisaSelesai] = useState(false);
  const [done, setDone] = useState(sudahSelesai);
  const [mengirim, setMengirim] = useState(false);
  const [gagal, setGagal] = useState(false);
  const terkirim = useRef(false);

  const kirimSelesai = async (navigasi: boolean) => {
    if (terkirim.current) return;
    terkirim.current = true;
    setMengirim(true);
    setGagal(false);
    const res = await completeCatchupStep(darsNo, "baca");
    if (res.ok) {
      setDone(true);
      if (navigasi) {
        router.push("/student/tugas-susulan");
      } else {
        router.refresh();
      }
    } else {
      terkirim.current = false;
      setMengirim(false);
      setGagal(true);
    }
  };
  const kirimRef = useRef(kirimSelesai);
  kirimRef.current = kirimSelesai;

  useEffect(() => {
    if (done) return;

    const perbarui = () => {
      const u = ukuranGulirHalaman();
      setPct(hitungPersenBaca(u));
      setBisaSelesai(tombolSelesaiAktif(u));
      if (bacaDianggapSelesai(u)) {
        void kirimRef.current(false);
      }
    };

    // Halaman pendek yang tidak bisa digulir langsung dianggap terbaca
    // sampai akhir (hitungPersenBaca menghasilkan 100).
    perbarui();

    window.addEventListener("scroll", perbarui, { passive: true });
    window.addEventListener("resize", perbarui);
    return () => {
      window.removeEventListener("scroll", perbarui);
      window.removeEventListener("resize", perbarui);
    };
  }, [done]);

  const tombolSelesai = (gaya: "utama" | "ringkas") => (
    <button
      type="button"
      onClick={() => void kirimSelesai(true)}
      disabled={!bisaSelesai || mengirim}
      className={
        gaya === "utama"
          ? "w-full rounded-2xl bg-violet-600 px-5 py-3.5 text-base font-black text-white shadow transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 sm:w-auto"
          : "shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      }
    >
      {mengirim ? "Menyimpan..." : "Selesai Membaca"}
    </button>
  );

  return (
    <>
      {!done ? (
        <section className="mx-auto mt-5 w-full max-w-3xl rounded-[2rem] border border-violet-100 bg-white p-6 text-center shadow-lg">
          <p className="font-bold text-neutral-800">
            Sudah sampai di akhir bacaan?
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {bisaSelesai
              ? "Tekan tombol ini untuk mencatat Langkah 1 sebagai selesai."
              : "Gulir sampai dekat akhir halaman, tombol akan aktif dengan sendirinya."}
          </p>
          <div className="mt-4 flex justify-center">{tombolSelesai("utama")}</div>
          {gagal ? (
            <p className="mt-3 text-sm font-bold text-red-600">
              Gagal menyimpan. Periksa koneksimu, lalu tekan tombolnya lagi.
            </p>
          ) : null}
        </section>
      ) : null}

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
              {tombolSelesai("ringkas")}
            </>
          )}
        </div>
      </div>
    </>
  );
}
