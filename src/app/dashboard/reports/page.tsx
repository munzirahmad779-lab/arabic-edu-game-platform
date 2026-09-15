import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "./report-view";

type SearchParams = { date?: string };

function todayWIB(): string {
  // WIB = UTC+7
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
}

function isValidDate(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const date = isValidDate(searchParams.date) ? searchParams.date : todayWIB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("teacher_daily_report", {
    p_date: date,
  });

  if (error) {
    console.error("[reports] rpc error:", error);
  }

  const rows = (data ?? []) as Array<{
    source: string;
    game_name: string;
    game_mode: string;
    student_name: string;
    final_score: number | null;
    rank_position: number | null;
    correct_count: number;
    total_questions: number;
    recorded_at: string;
  }>;

  const roomRows = rows.filter((r) => r.source === "room");
  const practiceRows = rows.filter((r) => r.source === "practice");

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
        <p className="text-sm font-semibold text-white/75">التقارير</p>
        <h1 className="mt-1 text-3xl font-black">📄 التقرير اليومي</h1>
        <p className="mt-2 text-sm text-white/85">
          لخّص نتائج اليوم، وانسخ التقرير إلى ChatGPT / Meta AI لتحليل أعمق.
        </p>
      </header>

      <ReportView
        date={date}
        roomRows={roomRows}
        practiceRows={practiceRows}
      />
    </main>
  );
}