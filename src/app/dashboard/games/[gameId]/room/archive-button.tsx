"use client";

import { useRef, useState } from "react";
import { archiveRoomSession } from "../../actions";

type GameRoomDict = {
  archive_confirm_with_participants: string;
  archive_confirm_no_participants: string;
  archive_btn: string;
  confirm_cancel_btn?: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export default function ArchiveButton({
  roomId,
  gameId,
  participantCount,
  gr,
}: {
  roomId: string;
  gameId: string;
  participantCount: number;
  gr: GameRoomDict;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Konfirmasi arsip memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati tanpa
  // pesan error (temuan audit live 5 Nov 2026: Arsipkan diklik 3 kali tanpa
  // efek; pola yang sama sebelumnya mematikan tombol Akhiri/Reset).
  const confirmMsg =
    participantCount > 0
      ? fmt(gr.archive_confirm_with_participants, { count: participantCount })
      : gr.archive_confirm_no_participants;
  const cancelBtn = gr.confirm_cancel_btn ?? "Batal";

  return (
    <form ref={formRef} action={archiveRoomSession} className="mt-5">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="game_id" value={gameId} />
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
      >
        {gr.archive_btn}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {confirmMsg}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitting(true);
                  formRef.current?.requestSubmit();
                }}
                disabled={submitting}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {gr.archive_btn}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
