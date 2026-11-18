"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPostTestOpen } from "./actions";

export function PostTesToggle({ isOpen }: { isOpen: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function toggle() {
    setFailed(false);
    startTransition(async () => {
      const result = await setPostTestOpen(!isOpen);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`rounded-full px-3 py-1 text-xs font-black ${
          isOpen
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {isOpen ? "Post tes sedang DIBUKA" : "Post tes masih DITUTUP"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition disabled:opacity-60 ${
          isOpen
            ? "bg-neutral-700 hover:bg-neutral-900"
            : "bg-teal-600 hover:bg-teal-700"
        }`}
      >
        {pending
          ? "Memproses..."
          : isOpen
            ? "Tutup Post Tes"
            : "Buka Post Tes"}
      </button>
      {failed ? (
        <span className="text-sm font-bold text-red-600">
          Gagal mengubah keadaan. Coba lagi.
        </span>
      ) : null}
    </div>
  );
}
