"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Option = {
  id: string;
  option_key: string;
  option_text: string;
};

type Question = {
  id: string;
  position: number;
  question_text: string;
  difficulty: string;
  explanation_timing: string;
  options: Option[];
  media?: unknown[];
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
};

export default function JoinRoomPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    if (!token) {
      setError("رابط الغرفة غير صحيح.");
      return;
    }

    const supabase = createClient();

    const rpcClient = supabase as unknown as {
      rpc<TResult>(
        functionName: string,
        args: Record<string, unknown>,
      ): PromiseLike<{
        data: TResult[] | null;
        error: { message: string } | null;
      }>;
    };

    const { data, error: rpcError } = await rpcClient.rpc<Session>(
      "get_game_session",
      { p_join_token: token },
    );

    if (rpcError || !data?.[0]) {
      setError("تعذر تحميل حالة اللعبة.");
      return;
    }

    setSession(data[0] as Session);
    setError("");
  }, [token]);

  useEffect(() => {
    void loadSession();

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void loadSession();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loadSession]);

  const countdown = useMemo(() => {
    if (
      !session ||
      session.room_state !== "running" ||
      !session.question_started_at
    ) {
      return null;
    }

    const remainingMs =
      new Date(session.question_started_at).getTime() - now;

    if (remainingMs > 0) {
      return Math.ceil(remainingMs / 1000);
    }

    return 0;
  }, [now, session]);

  async function submitAnswer(optionId: string) {
    if (
      !session?.question ||
      submitting ||
      session.answer_submitted ||
      session.room_state !== "running" ||
      countdown !== 0
    ) {
      return;
    }

    setSubmitting(true);

    const supabase = createClient();

    const rpcClient = supabase as unknown as {
      rpc<TResult>(
        functionName: string,
        args: Record<string, unknown>,
      ): PromiseLike<{
        data: TResult[] | null;
        error: { message: string } | null;
      }>;
    };

    const { error: submitError } = await rpcClient.rpc(
      "submit_game_answer",
      {
        p_join_token: token,
        p_question_id: session.question.id,
        p_selected_option_id: optionId,
      },
    );

    setSubmitting(false);

    if (submitError) {
      setError(
        submitError.message === "ALREADY_SUBMITTED"
          ? "تم تسجيل إجابتك."
          : "تعذر تسجيل الإجابة.",
      );
      await loadSession();
      return;
    }

    await loadSession();
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

  if (!session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 text-white" dir="rtl">
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="text-5xl">🎮</div>
          <h1 className="mt-4 text-2xl font-black">جاري تحميل اللعبة...</h1>
          {error ? (
            <p className="mt-3 text-sm text-white/80">{error}</p>
          ) : null}
        </div>
      </main>
    );
  }

  if (session.room_state === "ended") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-600 p-4 text-white" dir="rtl">
        <div className="mx-auto max-w-2xl py-12">
          <div className="rounded-[2rem] bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <div className="text-6xl">🏁</div>
            <h1 className="mt-4 text-3xl font-black">انتهت اللعبة</h1>
            <p className="mt-3 text-white/80">{session.game_name}</p>
          </div>
        </div>
      </main>
    );
  }

  if (session.room_state === "waiting") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 py-8 text-white" dir="rtl">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
            <p className="text-sm font-bold text-violet-100">غرفة اللعب</p>
            <h1 className="mt-2 text-3xl font-black">{session.game_name}</h1>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">كود الغرفة</div>
                <div className="mt-2 text-xl font-black tracking-[0.12em]">
                  {session.room_code}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">أنت</div>
                <div className="mt-2 font-black">{session.participant_name}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <div className="text-xs font-bold text-slate-500">المشاركون</div>
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4 py-6 text-white" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-[2rem] bg-white/10 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white/70">سباق الكلمات العربية</p>
              <h1 className="mt-1 text-2xl font-black">{session.game_name}</h1>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-center">
              <div className="text-xs text-white/70">السؤال</div>
              <div className="text-lg font-black">
                {Math.min(session.question_index + 1, session.question_count)} /{" "}
                {session.question_count}
              </div>
            </div>
          </div>
        </header>

        {countdown !== null && countdown > 0 ? (
          <div className="mt-6 rounded-[2rem] bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <div className="text-sm font-bold text-white/70">استعد!</div>
            <div className="mt-3 text-8xl font-black tabular-nums">{countdown}</div>
            <p className="mt-3 text-white/80">ستظهر الإجابة بعد العد التنازلي</p>
          </div>
        ) : null}

        {session.question ? (
          <section className="mt-6 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-800">
                {session.question.difficulty}
              </div>
              <div className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800">
                15 ثانية
              </div>
            </div>

            <h2 className="mt-8 text-center text-3xl font-black leading-relaxed sm:text-4xl">
              {session.question.question_text}
            </h2>

            <div className="mt-8 grid gap-4">
              {session.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={submitting || session.answer_submitted}
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
                ✅ تم تسجيل إجابتك، بانتظار بقية الطلاب.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-700">
                {error}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}