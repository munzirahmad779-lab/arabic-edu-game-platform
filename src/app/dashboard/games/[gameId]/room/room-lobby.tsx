"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  connection_state: "connected" | "disconnected";
  joined_at: string;
};

type Submission = {
  room_participant_id: string;
  score_awarded: number;
  is_correct: boolean;
};

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
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    const refresh = async () => {
      const { data: pData, error: pErr } = await supabase
        .from("room_participants")
        .select("id, student_id, guest_name, connection_state, joined_at")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });

      if (!alive) return;
      if (pErr) {
        console.error("[RoomLobby] participants error:", pErr);
        setLoadError(pErr.message);
      } else if (pData) {
        setParticipants(pData as Participant[]);
        setLoadError("");
      }

      const { data: sData, error: sErr } = await supabase
        .from("submissions")
        .select("room_participant_id, score_awarded, is_correct")
        .eq("room_id", roomId);

      if (!alive) return;
      if (sErr) {
        console.error("[RoomLobby] submissions error:", sErr);
      } else if (sData) {
        setSubmissions(sData as Submission[]);
      }
    };

    void refresh();
    const fallback = window.setInterval(refresh, 2000);

    return () => {
      alive = false;
      window.clearInterval(fallback);
    };
  }, [roomId]);

  const connected = useMemo(
    () => participants.filter((p) => p.connection_state === "connected"),
    [participants],
  );

  const scoreByParticipant = useMemo(() => {
    const map = new Map<
      string,
      { score: number; answered: number; correct: number }
    >();
    for (const sub of submissions) {
      const current = map.get(sub.room_participant_id) ?? {
        score: 0,
        answered: 0,
        correct: 0,
      };
      current.score += sub.score_awarded;
      current.answered += 1;
      if (sub.is_correct) current.correct += 1;
      map.set(sub.room_participant_id, current);
    }
    return map;
  }, [submissions]);

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">
          {connected.length} متصل الآن
        </span>
        <span className="text-slate-400">السعة {capacity}</span>
      </div>

      {loadError ? (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          خطأ في تحميل البيانات: {loadError}
        </div>
      ) : null}

      {participants.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div className="text-4xl">👥</div>
          <p className="mt-3 font-black text-slate-800">بانتظار انضمام الطلاب</p>
          <p className="mt-1 text-sm text-slate-500">
            أرسل كود الغرفة للطلاب لبدء التجمع.
          </p>
        </div>
      ) : (
        <div className="grid max-h-[22rem] grid-cols-1 gap-3 overflow-auto sm:grid-cols-2">
          {participants.map((participant, index) => {
            const label = participant.guest_name ?? `طالب ${index + 1}`;
            const stats = scoreByParticipant.get(participant.id);
            return (
              <div
                key={participant.id}
                className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg font-black text-white">
                      {label.trim().charAt(0) || "ط"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-black text-slate-900">
                        {label}
                      </div>
                      <div className="mt-1 text-xs font-bold text-emerald-600">
                        {participant.connection_state === "connected"
                          ? "متصل"
                          : "غير متصل"}
                      </div>
                    </div>
                  </div>
                  {stats ? (
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-700">
                        {stats.score}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stats.correct}/{stats.answered} صحيح
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-400">
                      لم يجب بعد
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}