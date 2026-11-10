"use client";

import { useState } from "react";

export function PortalLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard ditolak (izin atau konteks tidak aman): beri tahu guru
      // supaya ia tidak mengira tautan sudah tersalin; tautan tetap
      // tampil di halaman untuk disalin manual.
      setFailed(true);
      window.setTimeout(() => setFailed(false), 3000);
    }
  }

  return (
    <span className="inline-flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Salin tautan portal siswa"
        title="Salin tautan portal siswa"
        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700"
      >
        {copied ? "✓" : "📋"}
      </button>
      {failed ? (
        <span role="alert" className="text-[11px] font-bold text-red-600">
          Gagal menyalin. Salin tautan di samping secara manual.
        </span>
      ) : null}
    </span>
  );
}
