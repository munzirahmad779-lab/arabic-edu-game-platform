"use client";

import { useState } from "react";
import Link from "next/link";
import { createRoom, cloneGame } from "./actions";
import { DeleteGameButton } from "./delete-game-button";
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
              ▶ Mainkan Permainan
            </button>
          </form>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-700">
            Latihan Mandiri
          </div>
        )}

        {/* Edit Game Link: halaman ubah di /dashboard/games/[gameId].
            Tautan proyektor tidak diulang di sini karena kartu daftar
            permainan sudah menyediakan tombol proyektor utamanya. */}
        <Link
          href={`/dashboard/games/${gameId}`}
          title="Ubah permainan (nama, kelas, mode, soal)"
          className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-100 shadow-sm"
        >
          ✏️ Ubah
        </Link>

        {/* Preview Button */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="Pratinjau Soal"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 shadow-sm"
        >
          👁️ Pratinjau
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
            title="Duplikat Permainan"
            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 shadow-sm"
          >
            {cloning ? "..." : "📋 Duplikat"}
          </button>
        </form>

        {/* Delete Button: komponen bersama DeleteGameButton (modal
            konfirmasi dalam halaman yang sama seperti daftar
            Permainan), supaya tidak ada dua jalur hapus yang berbeda
            perilaku. */}
        <DeleteGameButton
          gameId={gameId}
          gameName={gameName}
          title="Hapus Permainan"
          triggerClassName="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-sm"
        />
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
