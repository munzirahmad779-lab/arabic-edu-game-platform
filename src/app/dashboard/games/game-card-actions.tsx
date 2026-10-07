"use client";

import { useState } from "react";
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
        <form
          action={deleteGame}
          onSubmit={(e) => {
            if (!window.confirm(`هل أنت متأكد من حذف لعبة "${gameName}"؟`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="game_id" value={gameId} />
          <button
            type="submit"
            title="حذف اللعبة"
            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-sm"
          >
            🗑
          </button>
        </form>
      </div>

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
