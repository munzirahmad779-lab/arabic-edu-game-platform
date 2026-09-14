"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Option = {
  id: string;
  option_key: string;
  option_text: string;
};

type Media = {
  id: string;
  media_type: "image" | "audio" | "video" | string;
  public_url: string;
  mime_type?: string;
  max_play_count?: number | null;
};

type Question = {
  id: string;
  position: number;
  question_text: string;
  difficulty: string;
  explanation_timing: string;
  time_limit_seconds?: number;
  options: Option[];
  media?: Media[];
};

type Session = {
  room_id: string;
  room_code: string;
  game_name: string;
  room_state: "waiting" | "running" | "ended" | "locked";
  participant_id: string;
  participant_name: string;
  participant_count: number;
  capacity: number;
  duration_seconds: number;
  question_index: number;
  question_count: number;
  question_started_at: string | null;
  question: Question | null;
  answer_submitted: boolean;
  server_time: string;
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

const DIFFICULTY_AR: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-rose-100 text-rose-800",
};

const HEARTBEAT_INTERVAL_MS = 5000;

export default function JoinRoomPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const [session, setSession] = useState<Session | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  const skewRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const roomStateRef = useRef<Session["room_state"] | undefined>(undefined);

  useEffect(() => {
    roomStateRef.current = session?.room_state;
  }, [session?.room_state]);

  const loadSession = useCallback(async () => {
    if (!token) {
      setLoadError("رابط الغرفة غير صحيح.");
      return;
    }
    try {
      const supabase = createClient() as unknown as RpcClient;
      const { data, error: rpcError } = await supabase.rpc<Session>(
        "get_game_session",
        { p_join_token: token },
      );

      if (rpcError) {
        // Cek apakah room sudah di-arsip / join_token tidak valid lagi
        if (
          rpcError.message === "INVALID_JOIN_TOKEN" ||
          rpcError.message.includes("INVALID")
        ) {
          setSessionEnded(true);
          return;
        }
        setLoadError("تعذر تحميل حالة اللعبة.");
        return;
      }

      if (!data || !data[0]) {
        setLoadError("تعذر تحميل حالة اللعبة.");
        return;
      }

      const incoming = data[0];
      const serverMs = new Date(incoming.server_time).getTime();
      if (Number.isFinite(serverMs)) {
        skewRef.current = serverMs - Date.now();
      }

      setSession(incoming);
      setLoadError("");
    } catch {
      setLoadError("تعذر الاتصال بالخادم.");
    }
  }, [token]);

  const loadLeaderboard = useCallback(async () => {
    if (!token) return;
    try {
      const supabase = createClient() as unknown as RpcClient;
      const { data, error: rpcError } = await supabase.rpc<LeaderboardRow>(
        "get_room_leaderboard_student",
        { p_join_token: token },
      );
      if (!rpcError && data) {
        setLeaderboard(data);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const sendHeartbeat = useCallback(async () => {
    if (!token) return;
    try {
      const supabase = createClient() as unknown as RpcClient;
      await supabase.rpc("heartbeat_room_participant", {
        p_join_token: token,
      });
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
    void loadLeaderboard();
    void sendHeartbeat();

    const timer = window.setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);

      if (roomStateRef.current !== "ended" && !sessionEnded) {
        void loadSession();
        void loadLeaderboard();
      }

      if (nowTs - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = nowTs;
        void sendHeartbeat();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loadSession, loadLeaderboard, sendHeartbeat, sessionEnded]);

  useEffect(() => {
    setSubmitError("");
  }, [session?.question?.id]);

  const adjustedNow = now + skewRef.current;

  const countdown = useMemo(() => {
    if (
      !session ||
      session.room_state !== "running" ||
      !session.question_started_at
    ) {
      return null;
    }
    const remainingMs =
      new Date(session.question_started_at).getTime() - adjustedNow;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }, [adjustedNow, session]);

  const timeLimitSec = session?.question?.time_limit_seconds ?? 20;

  const answerSecondsLeft = useMemo(() => {
    if (
      !session ||
      session.room_state !== "running" ||
      !session.question_started_at ||
      countdown !== 0
    ) {
      return null;
    }
    const deadline =
      new Date(session.question_started_at).getTime() + timeLimitSec * 1000;
    return Math.max(0, Math.ceil((deadline - adjustedNow) / 1000));
  }, [countdown, adjustedNow, session, timeLimitSec]);

  async function submitAnswer(optionId: string) {
    if (
      !session?.question ||
      submitting ||
      session.answer_submitted ||
      session.room_state !== "running" ||
      countdown !== 0 ||
      answerSecondsLeft === 0
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const supabase = createClient() as unknown as RpcClient;
      const { error: submitErr } = await supabase.rpc("submit_game_answer", {
        p_join_token: token,
        p_question_id: session.question.id,
        p_selected_option_id: optionId,
      });

      if (submitErr) {
        const msg = submitErr.message;
        if (msg === "ALREADY_SUBMITTED") {
          setSubmitError("تم تسجيل إجابتك.");
        } else if (msg === "QUESTION_TIMEOUT") {
          setSubmitError("انتهى وقت السؤال.");
        } else if (msg === "QUESTION_NOT_STARTED") {
          setSubmitError("لم يبدأ السؤال بعد.");
        } else {
          setSubmitError("تعذر تسجيل الإجابة.");
        }
      }

      await loadSession();
      await loadLeaderboard();
    } catch {
      setSubmitError("تعذر الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-white" dir="rtl">
        <div className="mx-auto max-w-2xl rounded-3xl bg-red-900/40 p-8">
          رابط الغرفة غير صحيح.
        </div>
      </main>
    );
  }

  // Sesi direset oleh guru — arahkan siswa untuk join ulang
  if (sessionEnded) {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-4 text-white"
        dir="rtl"
      >
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="rounded-[2rem] bg-white/10 p-8 shadow-2xl backdrop-blur">
            <div className="text-6xl">🔁</div>
            <h1 className="mt-4 text-2xl font-black">
              تم إغلاق هذه الجلسة
            </h1>
            <p className="mt-3 text-white/80">
              بدأ المعلم جلسة جديدة في نفس الغرفة. يمكنك الانضمام من جديد.
            </p>
            <a
              href="/join"
              className="mt-6 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              العودة إلى صفحة الانضمام
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 text-white"
        dir="rtl"
      >
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="text-5xl">🎮</div>
          <h1 className="mt-4 text-2xl font-black">جاري تحميل اللعبة...</h1>
          {loadError ? (
            <>
              <p className="mt-3 text-sm text-white/80">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadSession()}
                className="mt-6 rounded-2xl bg-white px-6 py-3 font-black text-violet-800 shadow-lg transition hover:bg-violet-50"
              >
                إعادة المحاولة
              </button>
            </>
          ) : null}
        </div>
      </main>
    );
  }

  if (session.room_state === "ended") {
    const me = leaderboard.find((r) => r.is_self);
    const podium = leaderboard.slice(0, 3);

    return (
      <main
        className="min-h-screen bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-600 p-4 text-white"
        dir="rtl"
      >
        <div className="mx-auto max-w-3xl space-y-6 py-8">
          <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <div className="text-6xl">🏁</div>
            <h1 className="mt-4 text-3xl font-black">انتهت اللعبة</h1>
            <p className="mt-2 text-white/80">{session.game_name}</p>

            {me ? (
              <div className="mt-8 rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
                <p className="text-xs font-bold text-slate-500">
                  نتيجتك النهائية
                </p>
                <div className="mt-3 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-black tabular-nums text-emerald-700">
                      {me.final_score}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      من 100
                    </div>
                  </div>
                  <div className="h-16 w-px bg-slate-200" />
                  <div className="text-center">
                    <div className="text-5xl font-black tabular-nums text-violet-700">
                      #{me.rnk}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      من {leaderboard.length}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <div className="text-xs font-bold text-emerald-700">
                      إجابات صحيحة
                    </div>
                    <div className="mt-1 text-lg font-black text-emerald-900">
                      {me.correct_count} / {session.question_count}
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <div className="text-xs font-bold text-amber-700">
                      متوسط سرعة الإجابة
                    </div>
                    <div className="mt-1 text-lg font-black text-amber-900">
                      {(me.avg_response_ms / 1000).toFixed(1)} ثانية
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
            <h2 className="text-lg font-black text-white">
              🏆 لوحة المتصدرين
            </h2>

            {podium.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[podium[1], podium[0], podium[2]].map((row, i) => {
                  if (!row) return <div key={i} />;
                  const medal =
                    row.rnk === 1 ? "🥇" : row.rnk === 2 ? "🥈" : "🥉";
                  const height = row.rnk === 1 ? "pt-6" : "pt-3";
                  return (
                    <div key={row.participant_id} className={`${height}`}>
                      <div className="text-3xl">{medal}</div>
                      <div className="mt-1 truncate text-sm font-bold text-white">
                        {row.participant_name}
                      </div>
                      <div className="text-lg font-black tabular-nums text-white/90">
                        {row.final_score}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-6 max-h-96 overflow-auto rounded-2xl bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-right font-bold text-slate-600">
                      #
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600">
                      الاسم
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600">
                      صحيح
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600">
                      النقاط
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.participant_id}
                      className={
                        row.is_self
                          ? "bg-violet-100 font-black text-violet-900"
                          : "border-t border-slate-100"
                      }
                    >
                      <td className="px-3 py-2 font-black">{row.rnk}</td>
                      <td className="px-3 py-2">
                        {row.participant_name}
                        {row.is_self ? (
                          <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">
                            أنت
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {row.correct_count} / {session.question_count}
                      </td>
                      <td className="px-3 py-2 font-mono font-black">
                        {row.final_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center">
            <a
              href="/join"
              className="inline-flex rounded-2xl bg-white px-6 py-3 font-black text-emerald-800 shadow-lg transition hover:bg-emerald-50"
            >
              الخروج من الغرفة
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (session.room_state === "locked") {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4 text-white"
        dir="rtl"
      >
        <div className="mx-auto max-w-2xl py-12">
          <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <div className="text-6xl">🔒</div>
            <h1 className="mt-4 text-3xl font-black">الغرفة مقفلة</h1>
            <p className="mt-3 text-white/80">
              لا يمكن الانضمام إلى هذه الغرفة حالياً.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (session.room_state === "waiting") {
    return (
      <main
        className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 py-8 text-white"
        dir="rtl"
      >
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
            <p className="text-sm font-bold text-violet-100">غرفة اللعب</p>
            <h1 className="mt-2 text-3xl font-black">{session.game_name}</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">
                  كود الغرفة
                </div>
                <div className="mt-2 text-xl font-black tracking-[0.12em]">
                  {session.room_code}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">أنت</div>
                <div className="mt-2 font-black">
                  {session.participant_name}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">
                  المشاركون
                </div>
                <div className="mt-2 text-2xl font-black">
                  {session.participant_count}
                </div>
              </div>
            </div>
            <div className="mt-8 rounded-3xl bg-white/95 p-8 text-center text-slate-900">
              <div className="text-5xl">⏳</div>
              <h2 className="mt-4 text-2xl font-black">أنت في الغرفة</h2>
              <p className="mt-2 text-sm text-slate-600">
                بانتظار بدء المعلم للعبة.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const myRow = leaderboard.find((r) => r.is_self);
  const top3 = leaderboard.slice(0, 3);

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 py-6 text-white"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl">
        <header className="rounded-[2rem] bg-white/10 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white/70">
                سباق الكلمات العربية
              </p>
              <h1 className="mt-1 text-2xl font-black">{session.game_name}</h1>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-center">
              <div className="text-xs text-white/70">السؤال</div>
              <div className="text-lg font-black">
                {Math.min(session.question_index + 1, session.question_count)}{" "}
                / {session.question_count}
              </div>
            </div>
          </div>

          {myRow ? (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 px-4 py-2 text-xs">
              <span className="font-bold">
                ترتيبك: #{myRow.rnk} من {leaderboard.length}
              </span>
              <span className="font-black tabular-nums">
                {myRow.final_score} نقطة
              </span>
            </div>
          ) : null}
        </header>

        {countdown !== null && countdown > 0 ? (
          <div className="mt-6 rounded-[2rem] bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <div className="text-sm font-bold text-white/70">استعد!</div>
            <div className="mt-3 text-8xl font-black tabular-nums">
              {countdown}
            </div>
            <p className="mt-3 text-white/80">
              سيظهر السؤال بعد العد التنازلي
            </p>
          </div>
        ) : session.question ? (
          <section className="mt-6 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  DIFFICULTY_COLOR[session.question.difficulty] ??
                  "bg-slate-100 text-slate-700"
                }`}
              >
                {DIFFICULTY_AR[session.question.difficulty] ??
                  session.question.difficulty}
              </div>
              <div
                className={`rounded-full px-4 py-2 text-xs font-black tabular-nums transition ${
                  (answerSecondsLeft ?? timeLimitSec) <= 5
                    ? "animate-pulse bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                ⏱ {answerSecondsLeft ?? timeLimitSec} ثانية
              </div>
            </div>

            {session.question.media && session.question.media.length > 0 ? (
              <div className="mt-6 space-y-4">
                {session.question.media.map((m) => {
                  if (!m.public_url) return null;
                  if (m.media_type === "image") {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.id}
                        src={m.public_url}
                        alt=""
                        className="mx-auto max-h-80 rounded-2xl border-2 border-slate-200 object-contain"
                      />
                    );
                  }
                  if (m.media_type === "audio") {
                    return (
                      <audio
                        key={m.id}
                        src={m.public_url}
                        controls
                        controlsList={
                          m.max_play_count === 1
                            ? "nodownload noplaybackrate"
                            : undefined
                        }
                        className="mx-auto w-full max-w-md"
                      />
                    );
                  }
                  if (m.media_type === "video") {
                    return (
                      <video
                        key={m.id}
                        src={m.public_url}
                        controls
                        controlsList={
                          m.max_play_count === 1
                            ? "nodownload noplaybackrate"
                            : undefined
                        }
                        className="mx-auto max-h-80 w-full rounded-2xl border-2 border-slate-200"
                      />
                    );
                  }
                  return null;
                })}
              </div>
            ) : null}

            <h2 className="mt-8 text-center text-3xl font-black leading-relaxed sm:text-4xl">
              {session.question.question_text}
            </h2>

            <div className="mt-8 grid gap-4">
              {session.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={
                    submitting ||
                    session.answer_submitted ||
                    answerSecondsLeft === 0
                  }
                  onClick={() => void submitAnswer(option.id)}
                  className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-5 text-right text-lg font-black shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 text-white">
                    {option.option_key}
                  </span>
                  {option.option_text}
                </button>
              ))}
            </div>

            {session.answer_submitted ? (
              <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-center font-black text-emerald-800">
                تم تسجيل إجابتك. بانتظار بقية المشاركين...
              </div>
            ) : null}

            {submitError ? (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-700">
                {submitError}
              </div>
            ) : null}
          </section>
        ) : (
          <div className="mt-6 rounded-[2rem] bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <h2 className="text-2xl font-black">جاري تجهيز السؤال...</h2>
            {loadError ? (
              <p className="mt-3 text-sm text-white/80">{loadError}</p>
            ) : null}
          </div>
        )}

        {top3.length > 0 ? (
          <section className="mt-4 rounded-2xl bg-white/10 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-bold text-white/70">
              🏆 المتصدرون الآن
            </p>
            <div className="mt-2 space-y-1">
              {top3.map((row) => (
                <div
                  key={row.participant_id}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                    row.is_self ? "bg-white/20 font-black" : "bg-white/5"
                  }`}
                >
                  <span className="truncate">
                    #{row.rnk} {row.participant_name}
                    {row.is_self ? " (أنت)" : ""}
                  </span>
                  <span className="font-black tabular-nums">
                    {row.final_score}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}