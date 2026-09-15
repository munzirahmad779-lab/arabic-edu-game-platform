import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

type SearchParams = { saved?: string; error?: string };

type RoomHistoryRow = {
  id: string;
  session_number: number;
  started_at: string | null;
  ended_at: string | null;
  room_code: string;
  room_id: string;
  game_name: string;
  game_mode: string;
  participant_count: number;
};

type PracticeHistoryRow = {
  game_id: string;
  game_name: string;
  mode: string;
  student_id: string;
  student_name: string;
  answered: number;
  correct_count: number;
  total_questions: number;
  last_activity: string;
};

const MODE_AR: Record<string, string> = {
  competitive: "تنافسي",
  cooperative: "تعاوني",
  endless: "بلا نهاية",
  practice: "تمرين",
  learning: "تعليمي",
};

function formatDate(v: string | null): string {
  if (!v) return "—";
  try {
    const d = new Date(v);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const h = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return "—";
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  // History: room-based (competitive, cooperative, learning)
  const { data: roomSessionsData } = await supabase
    .from("room_sessions")
    .select(
      "id, session_number, started_at, ended_at, room_id, rooms!inner(code, game_id, teacher_id, games!inner(name, mode))",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const roomHistory: RoomHistoryRow[] = [];
  if (roomSessionsData) {
    for (const rs of roomSessionsData as unknown as Array<{
      id: string;
      session_number: number;
      started_at: string | null;
      ended_at: string | null;
      room_id: string;
      rooms: {
        code: string;
        game_id: string | null;
        teacher_id: string;
        games: { name: string; mode: string } | null;
      } | null;
    }>) {
      if (!rs.rooms || rs.rooms.teacher_id !== user.id) continue;

      const { count } = await supabase
        .from("room_session_participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", rs.id);

      roomHistory.push({
        id: rs.id,
        session_number: rs.session_number,
        started_at: rs.started_at,
        ended_at: rs.ended_at,
        room_code: rs.rooms.code,
        room_id: rs.room_id,
        game_name: rs.rooms.games?.name ?? "—",
        game_mode: rs.rooms.games?.mode ?? "—",
        participant_count: count ?? 0,
      });
    }
  }

  // History: practice (endless, practice) — aggregated
  const { data: practiceRaw } = await supabase
    .from("student_practice_answers")
    .select(
      "student_id, game_id, is_correct, answered_at, students!inner(name, classes!inner(teacher_id)), games!inner(name, mode, teacher_id)",
    )
    .order("answered_at", { ascending: false });

  const practiceMap = new Map<string, PracticeHistoryRow>();

  if (practiceRaw) {
    type Row = {
      student_id: string;
      game_id: string;
      is_correct: boolean;
      answered_at: string;
      students: { name: string; classes: { teacher_id: string } | null } | null;
      games: { name: string; mode: string; teacher_id: string } | null;
    };

    for (const r of practiceRaw as unknown as Row[]) {
      if (!r.games || r.games.teacher_id !== user.id) continue;
      if (!r.students) continue;

      const key = `${r.student_id}|${r.game_id}`;
      const existing = practiceMap.get(key);

      if (existing) {
        existing.answered += 1;
        if (r.is_correct) existing.correct_count += 1;
        if (r.answered_at > existing.last_activity) {
          existing.last_activity = r.answered_at;
        }
      } else {
        practiceMap.set(key, {
          game_id: r.game_id,
          game_name: r.games.name,
          mode: r.games.mode,
          student_id: r.student_id,
          student_name: r.students.name,
          answered: 1,
          correct_count: r.is_correct ? 1 : 0,
          total_questions: 0,
          last_activity: r.answered_at,
        });
      }
    }
  }

  const practiceHistory = Array.from(practiceMap.values()).sort((a, b) =>
    b.last_activity.localeCompare(a.last_activity),
  );

  // Total question count per game
  const gameIds = [...new Set(practiceHistory.map((p) => p.game_id))];
  if (gameIds.length > 0) {
    const { data: gqCount } = await supabase
      .from("game_questions")
      .select("game_id")
      .in("game_id", gameIds);

    const counts = new Map<string, number>();
    for (const gq of gqCount ?? []) {
      counts.set(gq.game_id, (counts.get(gq.game_id) ?? 0) + 1);
    }
    for (const p of practiceHistory) {
      p.total_questions = counts.get(p.game_id) ?? 0;
    }
  }

  const err = searchParams.error;

  return (
    <main className="space-y-6" dir="rtl">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← العودة إلى لوحة التحكم
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">إدارة الحساب</p>
        <h1 className="mt-1 text-3xl font-black">⚙️ الحساب والسجل</h1>
        <p className="mt-2 text-sm text-white/85">
          عدّل اسمك، وتابع سجل نتائج الطلاب في جميع أوضاع الألعاب.
        </p>
      </header>

      {searchParams.saved === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          ✓ تم حفظ التغييرات.
        </div>
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          خطأ: {err}
        </div>
      ) : null}

      <ProfileForm
        initialName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
      />

      {/* ============== History: Room-based ============== */}
      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-neutral-900">
              🏆 سجل الألعاب التنافسية والتعاونية
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              الجلسات المؤرشفة في الغرف — بترتيب زمني تنازلي.
            </p>
          </div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {roomHistory.length} جلسة
          </span>
        </div>

        {roomHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-sm font-bold text-neutral-700">
              لا توجد جلسات مؤرشفة بعد
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              ابدأ لعبة وأرشف الجلسة لتظهر هنا.
            </p>
          </div>
        ) : (
          <div className="mt-4 max-h-[500px] overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    #
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    اللعبة
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الوضع
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الكود
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    المشاركون
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    التاريخ
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600"></th>
                </tr>
              </thead>
              <tbody>
                {roomHistory.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-black">
                      #{r.session_number}
                    </td>
                    <td className="px-3 py-2 truncate font-bold text-neutral-800">
                      {r.game_name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {MODE_AR[r.game_mode] ?? r.game_mode}
                      </span>
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      dir="ltr"
                    >
                      {r.room_code}
                    </td>
                    <td className="px-3 py-2 font-bold text-neutral-700">
                      {r.participant_count}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {formatDate(r.started_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/games/${r.room_id}?highlight=${r.id}`}
                        className="text-xs font-bold text-violet-700 underline"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============== History: Practice ============== */}
      <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-neutral-900">
              📖 سجل التدريب الذاتي (بلا نهاية + تمرين)
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              نتائج الطلاب في التدريب الذاتي — لكل طالب وكل لعبة.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {practiceHistory.length} سجل
          </span>
        </div>

        {practiceHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-sm font-bold text-neutral-700">
              لا توجد سجلات تدريب بعد
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              عندما يتدرب الطلاب في بوابة الطالب، ستظهر نتائجهم هنا.
            </p>
          </div>
        ) : (
          <div className="mt-4 max-h-[500px] overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الطالب
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    اللعبة
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    الوضع
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    صحيح
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-neutral-600">
                    آخر نشاط
                  </th>
                </tr>
              </thead>
              <tbody>
                {practiceHistory.map((p) => {
                  const pct =
                    p.total_questions > 0
                      ? Math.round((p.correct_count / p.total_questions) * 100)
                      : 0;

                  return (
                    <tr
                      key={`${p.student_id}-${p.game_id}`}
                      className="border-t border-neutral-100"
                    >
                      <td className="px-3 py-2 font-bold text-neutral-800">
                        {p.student_name}
                      </td>
                      <td className="px-3 py-2 truncate text-neutral-700">
                        {p.game_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {MODE_AR[p.mode] ?? p.mode}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono font-black text-emerald-700">
                          {p.correct_count}/{p.total_questions}
                        </span>
                        <span className="mr-2 text-xs text-neutral-500">
                          ({pct}%)
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {formatDate(p.last_activity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        <p className="font-black">💡 ملاحظة</p>
        <p className="mt-1">
          سيتم إضافة رابط مباشر للملخص الكامل لكل فصل (سجل تفصيلي لكل طالب) في
          التحديث القادم. حاليًا يمكنك مشاهدة الملخص العام هنا.
        </p>
      </section>
    </main>
  );
}