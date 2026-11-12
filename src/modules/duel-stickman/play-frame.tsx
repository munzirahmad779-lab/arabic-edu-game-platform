"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  LmsBankPicker,
  type LmsBankChoice,
} from "@/modules/game-bank/connector";

/**
 * Halaman main Duel Stickman Berpedang (game mandiri, pola yang sama
 * seperti game /game lain): berkas game statis dimuat di dalam bingkai,
 * dan panel "Ambil dari Bank Soal LMS" menyerahkan soal bank pilihan
 * guru ke game lewat postMessage sesama origin. Game memasang soal itu
 * sebagai kategori soal sendiri dan menyimpannya secara lokal di
 * perangkat ini, sama seperti bank LMS pada game mandiri lain.
 */
export default function DuelStickmanFrame() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const pendingRef = useRef<LmsBankChoice | null>(null);
  const [installed, setInstalled] = useState("");

  const post = useCallback((choice: LmsBankChoice | null) => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    if (choice) {
      win.postMessage(
        {
          type: "magguru:lms-bank",
          bankName: choice.bankName,
          questions: choice.questions.map((q) => ({
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex,
          })),
        },
        window.location.origin,
      );
    } else {
      win.postMessage(
        { type: "magguru:lms-bank-clear" },
        window.location.origin,
      );
    }
  }, []);

  const applyLmsChoice = useCallback(
    (choice: LmsBankChoice) => {
      pendingRef.current = choice;
      setInstalled(choice.bankName);
      post(choice);
    },
    [post],
  );

  const clearLms = useCallback(() => {
    pendingRef.current = null;
    setInstalled("");
    post(null);
  }, [post]);

  return (
    <main className="flex min-h-dvh flex-col bg-[#171310]">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/game/duel-stickman"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-amber-50 transition hover:bg-white/20 active:scale-95"
          >
            ← Kembali
          </Link>
          <p className="text-sm font-black tracking-wide text-amber-100/90">
            Duel Stickman Berpedang
          </p>
        </div>
        <div className="mt-3">
          <LmsBankPicker onSelect={applyLmsChoice} />
        </div>
        {installed ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
            Bank LMS &quot;{installed}&quot; terpasang di game sebagai kategori
            soal.{" "}
            <button
              type="button"
              onClick={clearLms}
              className="font-bold text-amber-50 underline"
            >
              Lepas bank ini
            </button>
          </p>
        ) : null}
      </div>
      <div className="mx-auto mt-3 w-full max-w-6xl flex-1 px-4 pb-4">
        <iframe
          ref={frameRef}
          src="/duel-stickman/index.html"
          title="Duel Stickman Berpedang"
          className="w-full rounded-2xl border-0 bg-[#F6EBD2]"
          style={{ height: "calc(100dvh - 240px)", minHeight: 560 }}
          onLoad={() => {
            if (pendingRef.current) post(pendingRef.current);
          }}
        />
      </div>
    </main>
  );
}
