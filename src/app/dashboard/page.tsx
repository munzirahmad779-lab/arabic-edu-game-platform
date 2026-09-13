import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="space-y-8" dir="rtl">
      <header>
        <p className="text-sm font-medium text-violet-600">
          منصة التعليم العربية
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          مرحبًا بك
        </h1>

        <p className="mt-2 text-neutral-600">
          إدارة الفصول الدراسية وبنك الأسئلة وبناء الألعاب.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <Link
          href="/dashboard/classes"
          className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🏫</p>
              <h2 className="mt-4 font-bold text-sky-950">
                الفصول الدراسية
              </h2>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                إنشاء الفصول الدراسية وإدارتها.
              </p>
            </div>

            <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/question-banks"
          className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">📚</p>
              <h2 className="mt-4 font-bold text-emerald-950">
                بنك الأسئلة
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                إنشاء بنوك الأسئلة واستيرادها من Excel.
              </p>
            </div>

            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/games"
          className="group rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl">🎮</p>
              <h2 className="mt-4 font-bold text-violet-950">
                بناء الألعاب
              </h2>
              <p className="mt-2 text-sm leading-6 text-violet-800">
                إنشاء الألعاب التعليمية وإدارتها وتشغيلها.
              </p>
            </div>

            <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
              فتح
            </span>
          </div>
        </Link>
      </div>
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-600">الطلاب</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">إدارة الطلاب</h2>
            <p className="mt-2 text-sm text-slate-500">
              أضف الطلاب إلى فصولك وأنشئ PIN لكل طالب.
            </p>
          </div>
          <a
            href="/dashboard/students"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg hover:-translate-y-0.5"
          >
            فتح إدارة الطلاب
          </a>
        </div>
      </section>
</main>
  );
}
