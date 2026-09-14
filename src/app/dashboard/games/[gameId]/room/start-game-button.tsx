"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startRoom } from "../../actions";

const ACTIVE_WINDOW_MS = 60_000;

export default function StartGameButton({
  roomId,
  initialCount,
}: {
  roomId: string;
  initialCount: number;
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
          ? "جاري بدء اللعبة..."
          : count === 0
            ? "بانتظار انضمام الطلاب..."
            : `بدء اللعبة ▶ (${count} ${count === 1 ? "طالب" : "طلاب"})`}
      </button>
    </form>
  );
}