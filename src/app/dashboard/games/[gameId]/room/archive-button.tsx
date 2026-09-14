"use client";

import { archiveRoomSession } from "../../actions";

export default function ArchiveButton({
  roomId,
  gameId,
  participantCount,
}: {
  roomId: string;
  gameId: string;
  participantCount: number;
}) {
  return (
    <form action={archiveRoomSession} className="mt-5">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="game_id" value={gameId} />
      <button
        type="submit"
        onClick={(e) => {
          const msg =
            participantCount > 0
              ? `سيتم أرشفة الجلسة الحالية بحفظ النتائج والترتيب، ثم إعادة تعيين الغرفة لجلسة جديدة (نفس كود الغرفة).\n\nالمشاركون الحاليون: ${participantCount}\n\nمتابعة؟`
              : "سيتم إعادة تعيين الغرفة لجلسة جديدة (نفس كود الغرفة).";
          if (!window.confirm(msg)) {
            e.preventDefault();
          }
        }}
        className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
      >
        🔄 أرشفة الجلسة وبدء جلسة جديدة
      </button>
    </form>
  );
}