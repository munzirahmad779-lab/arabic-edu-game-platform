import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "./report-view";
import { todayWita } from "@/lib/format-wita";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = { date?: string };

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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";

  const date = isValidDate(searchParams.date) ? searchParams.date : todayWita();

  const { data, error } = await supabase.rpc("teacher_daily_report", {
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
    <main className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← {dict.reports.back_dashboard}
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">
          {dict.reports.header_label}
        </p>
        <h1 className="mt-1 text-3xl font-black">
          {dict.reports.header_title}
        </h1>
        <p className="mt-2 text-sm text-white/85">
          {dict.reports.header_desc}
        </p>
      </header>

      <Link
        href="/dashboard/tugas-susulan"
        className="group flex items-center justify-between gap-4 rounded-[2rem] border border-violet-100 bg-white p-5 shadow transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md transition group-hover:scale-110">
            📋
          </span>
          <div>
            <p className="font-black text-neutral-900 group-hover:text-violet-700">
              Progres Tugas Susulan
            </p>
            <p className="text-sm text-neutral-500">
              Lihat siswa yang punya tugas susulan karena bolong, dan berapa
              persen yang sudah lulus.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-2xl text-neutral-400 transition group-hover:text-violet-600">
          →
        </span>
      </Link>

      <ReportView
        date={date}
        roomRows={roomRows}
        practiceRows={practiceRows}
        loadError={Boolean(error)}
        dict={dict as never}
      />
    </main>
  );
}