"use client";

import { useFormStatus } from "react-dom";

// Tombol mulai ujian yang menonaktifkan dirinya selama pengiriman
// berjalan: ketukan ganda sebelumnya menjalankan RPC dua kali, memotong
// kuota token dua kali, dan membuat dua attempt (temuan armada audit
// 11 Nov 2026).
export function StartAttemptButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary w-full"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "..." : label}
    </button>
  );
}
