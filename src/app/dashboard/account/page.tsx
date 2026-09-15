import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string };
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
        <h1 className="mt-1 text-3xl font-black">⚙️ الحساب</h1>
        <p className="mt-2 text-sm text-white/85">
          عدّل اسمك، وانتقل بسرعة إلى سجل الطلاب أو التقارير.
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

      {/* Quick links */}
      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-black text-neutral-900">
          🔗 روابط سريعة
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          للوصول السريع إلى صفحات السجل والتقارير.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/students"
            className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              👥
            </span>
            <div className="min-w-0">
              <p className="font-bold text-neutral-900 group-hover:text-violet-700">
                سجل الطلاب
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                تفاصيل أداء كل طالب بحسب الوضع
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/reports"
            className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl text-white shadow-md transition group-hover:scale-110">
              📄
            </span>
            <div className="min-w-0">
              <p className="font-bold text-neutral-900 group-hover:text-violet-700">
                التقارير اليومية
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                لخّص اليوم وانسخه إلى ChatGPT / Meta AI
              </p>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}