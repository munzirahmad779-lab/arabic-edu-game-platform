import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">مرحبًا بك</h1>
        <p className="mt-1 text-neutral-600">
          إدارة الفصول الدراسية وبنك الأسئلة وبناء الألعاب.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/classes"
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400 hover:shadow"
        >
          <h2 className="font-semibold">الفصول الدراسية</h2>
          <p className="mt-2 text-sm text-neutral-600">
            إنشاء الفصول الدراسية وإدارتها.
          </p>
        </Link>

        <Link
          href="/dashboard/question-banks"
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400 hover:shadow"
        >
          <h2 className="font-semibold">بنك الأسئلة</h2>
          <p className="mt-2 text-sm text-neutral-600">إنشاء بنوك الأسئلة واستيرادها من Excel.</p>
        </Link>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 opacity-60 shadow-sm">
          <h2 className="font-semibold">بناء الألعاب</h2>
          <p className="mt-2 text-sm text-neutral-600">سيتم تفعيله في المرحلة التالية.</p>
        </div>
      </div>
    </div>
  );
}
