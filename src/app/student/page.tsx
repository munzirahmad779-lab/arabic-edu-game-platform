import { requireStudent } from "@/lib/student-auth";
import { logoutStudent } from "./actions";

export default async function StudentDashboardPage() {
  const session = await requireStudent();

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
          <div className="text-center">
            <div className="text-5xl">📖</div>
            <h2 className="mt-4 text-2xl font-black text-neutral-900">
              المواد الدراسية
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              قريبًا ستظهر هنا جميع المواد التي يشاركها معك معلمك.
            </p>
            <p className="mt-4 text-xs text-neutral-500">
              في انتظار إضافة المعلم للمواد الدراسية.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}