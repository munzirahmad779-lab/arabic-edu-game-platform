"use client";

import { archiveRoomSession } from "../../actions";

type GameRoomDict = {
  archive_confirm_with_participants: string;
  archive_confirm_no_participants: string;
  archive_btn: string;
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
  return (
    <form action={archiveRoomSession} className="mt-5">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="game_id" value={gameId} />
      <button
        type="submit"
        onClick={(e) => {
          const msg =
            participantCount > 0
              ? fmt(gr.archive_confirm_with_participants, {
                  count: participantCount,
                })
              : gr.archive_confirm_no_participants;
          if (!window.confirm(msg)) {
            e.preventDefault();
          }
        }}
        className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
      >
        {gr.archive_btn}
      </button>
    </form>
  );
}