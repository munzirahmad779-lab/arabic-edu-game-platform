"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  connection_state: "connected" | "disconnected";
  joined_at: string;
};

type LeaderboardRow = {
  participant_id: string;
  participant_name: string;
  is_self: boolean;
  answered_count: number;
  correct_count: number;
  weighted_correct: number;
  weighted_total: number;
  avg_response_ms: number;
  final_score: number;
  rnk: number;
};

type RpcClient = {
  rpc<TResult>(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: TResult[] | null;
    error: { message: string } | null;
  }>;
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
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

      const client = supabase as unknown as RpcClient;
      const { data: lData, error: lErr } = await client.rpc<LeaderboardRow>(
        "get_room_leaderboard_teacher",
        { p_room_id: roomId },
      );

      if (!alive) return;
      if (lErr) {
        console.error("[RoomLobby] leaderboard error:", lErr);
      } else if (lData) {
        setLeaderboard(lData);
      }
    };

    void refresh();
    const fallback = window.setInterval(refresh, 2000);

    return () => {
      alive = false;
      window.clearInterval(fallback);
    };
  }, [roomId]);

  const connectedCount = participants.filter(
    (p) => p.connection_state === "connected",
  ).length;

  const boardByParticipant = new Map(
    leaderboard.map((r) => [r.participant_id, r]),
  );

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">
          {connectedCount} متصل الآن
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
        <div className="max-h-[28rem] space-y-2 overflow-auto">
          {leaderboard.length > 0 ? (
            <div className="mb-3 rounded-2xl border-2 border-amber-200 bg-gradient-to-l from-amber-50 to-yellow-50 p-3">
              <p className="text-xs font-black text-amber-700">
                🏆 ترتيب مباشر
              </p>
              <div className="mt-2 space-y-1">
                {leaderboard.slice(0, 5).map((row) => (
                  <div
                    key={row.participant_id}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 font-bold text-slate-800">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">
                        {row.rnk}
                      </span>
                      <span className="truncate">{row.participant_name}</span>
                    </span>
                    <span className="font-mono font-black text-amber-700 tabular-nums">
                      {row.final_score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {participants.map((participant, index) => {
              const label =
                boardByParticipant.get(participant.id)?.participant_name ??
                participant.guest_name ??
                `طالب ${index + 1}`;
              const stats = boardByParticipant.get(participant.id);
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
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-black text-amber-800">
                            #{stats.rnk}
                          </span>
                          <span className="font-mono text-lg font-black text-indigo-700 tabular-nums">
                            {stats.final_score}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {stats.correct_count}/{stats.answered_count} صحيح
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
        </div>
      )}
    </div>
  );
}