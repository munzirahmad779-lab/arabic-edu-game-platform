import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinRoomRefresh from "./refresh";

export default async function JoinRoomPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  if (!token) notFound();
  const supabase = await createClient();
  const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).rpc("get_join_session", { p_join_token: token });
  if (error || !data?.[0]) notFound();
  const session = data[0];
  return <main className="min-h-screen bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 px-4 py-10 text-white" dir="rtl">
    <div className="mx-auto max-w-2xl"><div className="rounded-[2rem] bg-white/10 p-6 shadow-2xl backdrop-blur">
      <p className="text-sm font-bold text-violet-100">غرفة اللعب</p>
      <h1 className="mt-2 text-3xl font-black">{session.game_name}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 text-center text-neutral-900"><div className="text-xs font-bold text-neutral-500">كود الغرفة</div><div className="mt-2 text-xl font-black tracking-[0.12em]">{session.room_code}</div></div>
        <div className="rounded-2xl bg-white p-4 text-center text-neutral-900"><div className="text-xs font-bold text-neutral-500">أنت</div><div className="mt-2 font-black">{session.participant_name}</div></div>
        <div className="rounded-2xl bg-white p-4 text-center text-neutral-900"><div className="text-xs font-bold text-neutral-500">المشاركون</div><div className="mt-2 text-2xl font-black">{session.participant_count}</div></div>
      </div>
      <div className="mt-8 rounded-2xl bg-white/95 p-6 text-center text-neutral-900"><div className="text-4xl">🎮</div><h2 className="mt-3 text-xl font-black">{session.room_state === "waiting" ? "أنت في الغرفة" : "بدأت اللعبة"}</h2><p className="mt-2 text-sm text-neutral-600">{session.room_state === "waiting" ? "بانتظار بدء المعلم للعبة." : `حالة الغرفة: ${session.room_state}`}</p></div>
      <JoinRoomRefresh token={token} />
    </div></div>
  </main>;
}
