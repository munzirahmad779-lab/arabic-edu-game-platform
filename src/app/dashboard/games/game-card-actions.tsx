"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createRoom, deleteGame, cloneGame } from "./actions";
import { GamePreviewModal } from "./game-preview-modal";

export function GameCardActions({
  gameId,
  gameName,
  gameModeAr,
  isRoomMode,
}: {
  gameId: string;
  gameName: string;
  gameModeAr: string;
  isRoomMode: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [cloning, setCloning] = useState(false);
  // Konfirmasi hapus memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
        {isRoomMode ? (
          <form action={createRoom} className="flex-1 min-w-[120px]">
            <input type="hidden" name="game_id" value={gameId} />
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 shadow-sm"
            >
              ▶ تشغيل اللعبة
            </button>
          </form>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-700">
            تدريب ذاتي
          </div>
        )}

        {/* Projector Hot Seat Mode Link */}
        <Link
          href={`/dashboard/games/${gameId}/projector`}
          title="Mode Proyektor / Hot Seat Kelas"
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 shadow-sm"
        >
          📽️ بروجكتور
        </Link>

        {/* Preview Button */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="معاينة الأسئلة"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 shadow-sm"
        >
          👁️ معاينة
        </button>

        {/* Clone Button */}
        <form
          action={cloneGame}
          onSubmit={() => setCloning(true)}
        >
          <input type="hidden" name="game_id" value={gameId} />
          <button
            type="submit"
            disabled={cloning}
            title="نسخ اللعبة"
            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 shadow-sm"
          >
            {cloning ? "..." : "📋 نسخ"}
          </button>
        </form>

        {/* Delete Button */}
        <form ref={deleteFormRef} action={deleteGame}>
          <input type="hidden" name="game_id" value={gameId} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            title="حذف اللعبة"
            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-sm"
          >
            🗑
          </button>
        </form>
      </div>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`هل أنت متأكد من حذف لعبة "${gameName}"؟`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(true);
                  deleteFormRef.current?.requestSubmit();
                }}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <GamePreviewModal
        gameId={gameId}
        gameName={gameName}
        gameMode={gameModeAr}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
