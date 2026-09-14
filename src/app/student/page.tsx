import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { logoutStudent } from "./actions";

export default async function StudentDashboardPage() {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const supabase = await createClient();
  const { data: materials } = await supabase.rpc("student_list_materials", {
    p_token: token,
    p_class_id: session.class_id,
  });

  const list = materials ?? [];

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] bg-white p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-violet-600">
              بوابة الطالب
            </p>
            <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">
              مرحبًا، {session.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              الصف: <span className="font-bold">{session.class_name}</span>
            </p>
          </div>
          <form action={logoutStudent}>
            <button
              type="submit"
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              تسجيل الخروج
            </button>
          </form>
        </header>

        <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black text-neutral-900">
              📖 المواد الدراسية
            </h2>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
              {list.length} مادة
            </span>
          </div>

          {list.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 py-12 text-center">
              <div className="text-5xl">📭</div>
              <p className="mt-4 text-sm text-neutral-600">
                لا توجد مواد منشورة بعد.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                في انتظار إضافة المعلم للمواد.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/student/materials/${m.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700">
                        {m.position}
                      </span>
                      <div>
                        <p className="font-bold text-neutral-900 group-hover:text-violet-700">
                          {m.title}
                        </p>
                        <p className="text-xs text-neutral-500">
                          آخر تحديث:{" "}
                          {new Intl.DateTimeFormat("ar-EG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(m.updated_at))}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl text-neutral-400 transition group-hover:text-violet-600">
                      ←
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}