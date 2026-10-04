"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startRoom } from "../../actions";

const ACTIVE_WINDOW_MS = 60_000;

type GameRoomDict = {
  starting_game: string;
  waiting_students_btn: string;
  start_game_btn: string;
  student_singular: string;
  student_plural: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export default function StartGameButton({
  roomId,
  initialCount,
  gr,
}: {
  roomId: string;
  initialCount: number;
  gr: GameRoomDict;
}) {
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    const refresh = async () => {
      const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
      const { count: c, error } = await supabase
        .from("room_participants")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gte("last_seen_at", cutoff);

      if (!alive) return;
      if (!error && typeof c === "number") setCount(c);
    };

    void refresh();
    const timer = window.setInterval(refresh, 1500);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [roomId]);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        try {
          await startRoom(fd);
        } finally {
          setPending(false);
        }
      }}
      className="mt-5"
    >
      <input type="hidden" name="room_id" value={roomId} />
      <button
        type="submit"
        disabled={count === 0 || pending}
        className="w-full rounded-2xl bg-gradient-to-l from-emerald-500 to-cyan-500 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? gr.starting_game
          : count === 0
            ? gr.waiting_students_btn
            : fmt(gr.start_game_btn, {
                count,
                label:
                  count === 1 ? gr.student_singular : gr.student_plural,
              })}
      </button>
    </form>
  );
}