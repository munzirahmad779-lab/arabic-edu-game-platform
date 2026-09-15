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

        {/* Mode Pembelajaran — 2 Kartu */}
        <section className="grid gap-4 sm:grid-cols-2">
          {/* تدريب ذاتي */}
          <Link
            href="/student/practice"
            className="group flex flex-col gap-4 rounded-[2rem] border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-lg transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-3xl text-white shadow-md transition group-hover:scale-110">
              🎯
            </span>
            <div>
              <h2 className="text-xl font-black text-emerald-900">
                تدريب ذاتي
              </h2>
              <p className="mt-2 text-sm leading-7 text-emerald-800">
                تدرّب بحرية على أسئلة معلمك — بدون وقت، مع تصحيح وشرح لكل
                سؤال.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5">
                بدون كود
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5">
                بلا نهاية + تمرين
              </span>
            </div>
            <span className="mt-auto text-sm font-black text-emerald-700 transition group-hover:translate-x-[-4px]">
              ابدأ التدريب ←
            </span>
          </Link>

          {/* تدريب موجّه */}
          <Link
            href="/join"
            className="group flex flex-col gap-4 rounded-[2rem] border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-lg transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl text-white shadow-md transition group-hover:scale-110">
              🏆
            </span>
            <div>
              <h2 className="text-xl font-black text-violet-900">
                تدريب موجّه
              </h2>
              <p className="mt-2 text-sm leading-7 text-violet-800">
                انضم إلى غرفة المعلم ونافس زملاءك في الألعاب الجماعية.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-violet-700">
              <span className="rounded-full bg-violet-100 px-2 py-0.5">
                يحتاج كود الغرفة
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5">
                تنافسي + تعاوني
              </span>
            </div>
            <span className="mt-auto text-sm font-black text-violet-700 transition group-hover:translate-x-[-4px]">
              ادخل الغرفة ←
            </span>
          </Link>
        </section>

        {/* Hint */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          <p className="font-black">💡 كيف أبدأ؟</p>
          <ul className="mt-2 list-disc space-y-1 pr-5">
            <li>
              <b>تدريب ذاتي:</b> ابدأ مباشرة بالضغط على البطاقة الأولى — لا
              يحتاج كودًا.
            </li>
            <li>
              <b>تدريب موجّه:</b> اطلب كود الغرفة من معلمك، ثم اضغط البطاقة
              الثانية وأدخل الكود مع اسمك.
            </li>
          </ul>
        </section>

        {/* المواد الدراسية */}
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
                          {new Date(m.updated_at).toISOString().slice(0, 10)}
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