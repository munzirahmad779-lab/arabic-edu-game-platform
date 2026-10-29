"use client";

import { useCallback, useEffect, useState } from "react";
import type { LmsBankSummary, LmsQuestion } from "@/lib/game-bank-feed";

export type { LmsBankSummary, LmsQuestion };

export type LmsBankChoice = {
  bankId: string;
  bankName: string;
  questions: LmsQuestion[];
};

/**
 * Panel "Ambil dari Bank Soal LMS" untuk layar Bank Soal game mandiri.
 * Guru memilih bank miliknya, soal ditarik dari /api/game-bank, lalu
 * diserahkan ke game lewat onSelect untuk dipetakan ke tipe soal game itu.
 * Bank lokal game tidak diubah oleh panel ini.
 */
export function LmsBankPicker({
  onSelect,
}: {
  onSelect: (choice: LmsBankChoice) => void;
}) {
  const [banks, setBanks] = useState<LmsBankSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/game-bank")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((data: { banks?: LmsBankSummary[] }) => {
        if (!alive) return;
        setBanks(Array.isArray(data.banks) ? data.banks : []);
      })
      .catch(() => {
        if (alive) setBanks([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const apply = useCallback(async () => {
    const bank = (banks ?? []).find((b) => b.id === selectedId);
    if (!bank || busy) return;
    setBusy(true);
    setStatus("Memuat soal...");
    try {
      const res = await fetch(
        `/api/game-bank?bankId=${encodeURIComponent(bank.id)}`,
      );
      if (!res.ok) throw new Error("gagal");
      const data = (await res.json()) as { questions?: LmsQuestion[] };
      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (questions.length === 0) {
        setStatus("Bank ini tidak punya soal pilihan ganda 4 opsi yang bisa dipakai.");
        return;
      }
      onSelect({ bankId: bank.id, bankName: bank.name, questions });
      setStatus(`Terpasang: ${questions.length} soal dari bank "${bank.name}".`);
    } catch {
      setStatus("Gagal memuat soal. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }, [banks, selectedId, busy, onSelect]);

  return (
    <div className="rounded-2xl border-2 border-teal-600/40 bg-teal-50 p-4">
      <p className="text-sm font-black text-teal-900">
        Ambil dari Bank Soal LMS
      </p>
      <p className="mt-1 text-xs leading-relaxed text-teal-900/70">
        Pakai soal dari bank yang sudah ada di menu Bank Soal, tanpa mengetik
        ulang. Soal terpilih langsung terpasang sebagai sumber soal di game ini.
      </p>
      {banks === null ? (
        <p className="mt-3 text-sm text-teal-900/70">Memuat daftar bank...</p>
      ) : banks.length === 0 ? (
        <p className="mt-3 text-sm text-teal-900/70">
          Belum ada bank soal. Buat dulu di menu Bank Soal.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-52 flex-1 rounded-xl border border-teal-700/30 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            aria-label="Pilih bank soal LMS"
          >
            <option value="">Pilih bank soal...</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.questionCount} soal)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={!selectedId || busy}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-black text-white transition enabled:hover:bg-teal-800 disabled:opacity-40"
          >
            {busy ? "Memuat..." : "Pakai Bank Ini"}
          </button>
        </div>
      )}
      {status && (
        <p className="mt-2 text-xs font-semibold text-teal-900/80">{status}</p>
      )}
    </div>
  );
}
