"use client";

import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

interface StudentPrintCard {
  id: string;
  name: string;
  pin_plain: string | null;
}

interface PrintCardsClientProps {
  classNameTitle: string;
  subjectTitle: string | null;
  students: StudentPrintCard[];
  portalUrl: string;
  backUrl: string;
  isRtl?: boolean;
}

export function PrintCardsClient({
  classNameTitle,
  subjectTitle,
  students,
  portalUrl,
  backUrl,
  isRtl = false,
}: PrintCardsClientProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-ink" dir={isRtl ? "rtl" : "ltr"}>
      {/* TOOLBAR (Hidden in Print) */}
      <div className="mx-auto max-w-5xl mb-6 rounded-2xl bg-white p-4 shadow-sm border border-slate-200 print:hidden flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={backUrl}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            ← Kembali
          </Link>
          <div>
            <h1 className="text-base font-black text-teal-900">
              Cetak Kartu Login Siswa — {classNameTitle} {subjectTitle ? `(${subjectTitle})` : ""}
            </h1>
            <p className="text-xs text-softslate">
              Total {students.length} santri/murid siap cetak. Gunakan kertas A4 untuk hasil terbaik.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-terracotta-500 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-terracotta-600 active:scale-95"
        >
          <span>🖨️ Cetak Kartu Sekarang</span>
        </button>
      </div>

      {/* PRINTABLE CARDS CONTAINER */}
      <div className="mx-auto max-w-5xl">
        {students.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-2 text-sm font-bold text-slate-700">
              Belum ada siswa di kelas ini untuk dicetak.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3 print:m-0">
            {students.map((student) => (
              <div
                key={student.id}
                className="relative flex flex-col justify-between rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm print:shadow-none print:border-slate-400 print:break-inside-avoid"
              >
                {/* Scissors Cut indicator on corner */}
                <span className="absolute -top-3 -right-2 text-xs text-slate-400 select-none print:inline">
                  ✂️
                </span>

                <div>
                  {/* Card Header: Brand Logo & Class */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/icon.png"
                        alt="Magguru"
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-lg"
                      />
                      <div>
                        <div className="text-[11px] font-black tracking-wider text-teal-800 uppercase">
                          Magguru Edu
                        </div>
                        <div className="text-[9px] font-bold text-terracotta-600">
                          Belajar • Bermain • Berkembang
                        </div>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black text-teal-800 border border-teal-200">
                        {classNameTitle}
                      </span>
                    </div>
                  </div>

                  {/* Student Name */}
                  <div className="my-3">
                    <span className="text-[10px] font-bold uppercase text-softslate/80">
                      Nama Santri / Murid:
                    </span>
                    <h2 className="text-base font-black text-teal-950 truncate">
                      {student.name}
                    </h2>
                  </div>
                </div>

                {/* Bottom Row: PIN Box & QR Code */}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase text-teal-800">
                      PIN Akses Masuk:
                    </span>
                    <div className="mt-1 inline-flex items-center gap-1 rounded-xl bg-cream/70 border border-sage-300 px-3 py-1.5 font-mono text-base font-black tracking-[0.25em] text-teal-950">
                      {student.pin_plain || "------"}
                    </div>
                    <p className="mt-1 text-[9px] text-softslate">
                      Ketik PIN ini di: {portalUrl}
                    </p>
                  </div>

                  {/* Mini QR Code */}
                  <div className="flex flex-col items-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
                      <QRCodeSVG value={portalUrl} size={64} level="L" />
                    </div>
                    <span className="mt-1 text-[8px] font-bold text-softslate/70">
                      Scan Masuk
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
