import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherList } from "./teacher-list";
import { StudentSessions } from "./student-sessions";

const SUPER_ADMIN_EMAIL = "munzirahmad779@gmail.com";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <main className="mx-auto max-w-3xl p-6" dir="rtl">
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-3 text-2xl font-black text-red-800">
            غير مصرح لك بالوصول
          </h1>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white"
          >
            العودة إلى لوحة التحكم
          </Link>
        </div>
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teachersData } = await (supabase as any).rpc(
    "admin_list_teachers",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionsData } = await (supabase as any).rpc(
    "admin_list_student_sessions",
  );

  const teachers = (teachersData ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    created_at: string;
    class_count: number;
    student_count: number;
  }>;

  const sessions = (sessionsData ?? []) as Array<{
    student_id: string;
    student_name: string;
    class_name: string;
    expires_at: string;
    last_seen_at: string;
    created_at: string;
  }>;

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

      <header className="rounded-[2rem] bg-gradient-to-l from-slate-800 via-slate-900 to-black p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">
          لوحة الإدارة (Super Admin)
        </p>
        <h1 className="mt-1 text-3xl font-black">🛡️ الإدارة</h1>
        <p className="mt-2 text-sm text-white/85">
          إدارة حسابات المعلمين والجلسات النشطة للطلاب.
        </p>
      </header>

      <TeacherList teachers={teachers} />
      <StudentSessions sessions={sessions} />
    </main>
  );
}