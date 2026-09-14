import Link from "next/link";
import { headers } from "next/headers";
import JoinLinkActions from "./join-link-actions";
import { createClient } from "@/lib/supabase/server";
import RoomLobby from "./room-lobby";
import StartGameButton from "./start-game-button";
import ArchiveButton from "./archive-button";
import SessionHistory from "./session-history";

type SearchParams = { roomId?: string; archived?: string; error?: string };

type Participant = {
  id: string;
  student_id: string | null;
  guest_name: string | null;
  connection_state: "connected" | "disconnected";
  joined_at: string;
  last_seen_at: string;
};

type SessionRow = {
  session_id: string;
  session_number: number;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
};

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { gameId: string };
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const roomId = searchParams.roomId?.trim();
  if (!roomId) {
    return (
      <main className="mx-auto max-w-4xl p-6" dir="rtl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-900">
          رابط الغرفة غير صحيح.
        </div>
      </main>
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, code, state, capacity, game_id, snapshot, created_at, started_at",
    )
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .eq("game_id", params.gameId)
    .maybeSingle();

  if (roomError || !room) {
    return (
      <main className="mx-auto max-w-4xl p-6" dir="rtl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-900">
          تعذر العثور على الغرفة.
        </div>
      </main>
    );
  }

  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data: participants } = await supabase
    .from("room_participants")
    .select(
      "id, student_id, guest_name, connection_state, joined_at, last_seen_at",
    )
    .eq("room_id", room.id)
    .gte("last_seen_at", cutoff)
    .order("joined_at", { ascending: true });

  const { data: sessionList } = await supabase.rpc("list_room_sessions", {
    p_room_id: room.id,
  });

  const sessions = (sessionList ?? []) as SessionRow[];

  const snapshot = room.snapshot as {
    game?: { name?: string; duration_seconds?: number; mode?: string };
    questions?: unknown[];
  };

  const gameName = snapshot.game?.name ?? "اللعبة";

  const envPublicUrl = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  let publicBaseUrl: string;

  if (envPublicUrl) {
    publicBaseUrl = envPublicUrl;
  } else {
    const headersList = await headers();
    const host = headersList.get("host")?.trim() ?? "";
    const xfp = headersList.get("x-forwarded-proto")?.trim();
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.") ||
      /^\d+\.\d+\.\d+\.\d+/.test(host);
    const proto = xfp ?? (isLocal ? "http" : "https");
    publicBaseUrl = host ? `${proto}://${host}` : "http://localhost:3000";
  }

  const joinUrl = `${publicBaseUrl}/join?code=${room.code}`;
  const questionCount = snapshot.questions?.length ?? 0;

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbeafe,_transparent_35%),radial-gradient(circle_at_bottom_left,_#fce7f3,_transparent_35%)] p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/75">
                غرفة اللعب
              </div>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                {gameName}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                اجمع طلابك هنا قبل بدء سباق الكلمات العربية.
              </p>
            </div>
            <Link
              href="/dashboard/games"
              className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              العودة إلى الألعاب
            </Link>
          </div>
        </header>

        {searchParams.archived === "1" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
            ✓ تم أرشفة الجلسة بنجاح. الغرفة جاهزة لجلسة جديدة.
          </div>
        ) : null}

        {searchParams.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            خطأ: {searchParams.error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-xl">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-indigo-50 p-5 text-center">
                <div className="text-sm font-bold text-indigo-600">
                  كود الغرفة
                </div>
                <div className="mt-2 text-center text-lg font-black tracking-[0.08em] text-indigo-950">
                  {room.code}
                </div>
              </div>
              <div className="rounded-3xl bg-fuchsia-50 p-5 text-center">
                <div className="text-sm font-bold text-fuchsia-600">
                  المشاركون
                </div>
                <div className="mt-2 text-4xl font-black text-fuchsia-950">
                  {participants?.length ?? 0}
                </div>
              </div>
              <div className="rounded-3xl bg-amber-50 p-5 text-center">
                <div className="text-sm font-bold text-amber-700">الأسئلة</div>
                <div className="mt-2 text-4xl font-black text-amber-950">
                  {questionCount}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-center text-white">
              <div className="text-sm font-semibold text-white/60">
                رابط الانضمام
              </div>
              <JoinLinkActions joinUrl={joinUrl} />
            </div>

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              💡 شارك الرابط الموجود أعلاه مع الطلاب. إذا فتحت هذه الصفحة من
              رابط مختلف (مثل Cloudflare أو نطاق Vercel)، سيتبع رابط الانضمام
              نفس العنوان تلقائيًا.
            </div>
          </section>

          <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  الطلاب في الغرفة
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  يظهر فقط الطلاب النشطون خلال آخر 60 ثانية.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {room.state === "waiting"
                  ? "في الانتظار"
                  : room.state === "running"
                    ? "بدأت"
                    : "انتهت"}
              </span>
            </div>

            <RoomLobby
              roomId={room.id}
              initialParticipants={(participants ?? []) as Participant[]}
              capacity={room.capacity}
            />

            {room.state === "waiting" ? (
              <StartGameButton
                roomId={room.id}
                initialCount={participants?.length ?? 0}
              />
            ) : null}

            {room.state === "running" ? (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">
                اللعبة جارية الآن.
              </div>
            ) : null}

            {room.state === "ended" ? (
              <ArchiveButton
                roomId={room.id}
                gameId={params.gameId}
                participantCount={participants?.length ?? 0}
              />
            ) : null}
          </section>
        </div>

        <SessionHistory sessions={sessions} />
      </div>
    </main>
  );
}