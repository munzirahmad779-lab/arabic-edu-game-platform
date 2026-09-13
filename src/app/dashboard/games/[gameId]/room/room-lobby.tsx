"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Participant = {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  connection_state: "connected" | "disconnected";
  joined_at: string;
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase browser environment variables are missing.");
  return createClient(url, key);
}

export default function RoomLobby({
  roomId,
  initialParticipants,
  capacity,
}: {
  roomId: string;
  initialParticipants: Participant[];
  capacity: number;
}) {
  const [participants, setParticipants] = useState(initialParticipants);

  useEffect(() => {
    let alive = true;
    const supabase = getClient();

    const refresh = async () => {
      const { data } = await supabase
        .from("room_participants")
        .select("id, student_id, guest_name, connection_state, joined_at")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });
      if (alive && data) setParticipants(data as Participant[]);
    };

    const channel = supabase
      .channel(`room-lobby-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .subscribe();

    refresh();
    const fallback = window.setInterval(refresh, 3000);

    return () => {
      alive = false;
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const connected = useMemo(
    () => participants.filter((participant) => participant.connection_state === "connected"),
    [participants],
  );

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{connected.length} متصل الآن</span>
        <span className="text-slate-400">السعة {capacity}</span>
      </div>

      {participants.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div className="text-4xl">👥</div>
          <p className="mt-3 font-black text-slate-800">بانتظار انضمام الطلاب</p>
          <p className="mt-1 text-sm text-slate-500">أرسل كود الغرفة للطلاب لبدء التجمع.</p>
        </div>
      ) : (
        <div className="grid max-h-[22rem] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
          {participants.map((participant, index) => {
            const label = participant.guest_name ?? `طالب ${index + 1}`;
            return (
              <div
                key={participant.id}
                className="animate-[pulse_2.5s_ease-in-out_infinite] rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-black text-white">
                    {label.trim().charAt(0) || "ط"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-900">{label}</div>
                    <div className="mt-1 text-xs font-bold text-emerald-600">
                      {participant.connection_state === "connected" ? "متصل" : "غير متصل"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
