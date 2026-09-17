import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";
  const t = dict.account;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const err = searchParams.error;

  return (
    <main className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← {t.back_dashboard}
        </Link>
      </div>

      <header className="rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-6 text-white shadow-xl">
        <p className="text-sm font-semibold text-white/75">
          {t.header_label}
        </p>
        <h1 className="mt-1 text-3xl font-black">{t.header_title}</h1>
        <p className="mt-2 text-sm text-white/85">{t.header_desc}</p>
      </header>

      {searchParams.saved === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          {t.saved}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          {t.error_prefix} {err}
        </div>
      ) : null}

      <ProfileForm
        initialName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        dict={dict}
      />

      <div className="rounded-[2rem] border border-amber-100 bg-amber-50/60 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <p className="font-black text-amber-900">{t.change_pw_title}</p>
            <p className="mt-1 text-sm text-amber-800">{t.change_pw_desc}</p>
            <Link
              href="/login"
              className="mt-3 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-700"
            >
              {t.change_pw_btn}
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-black text-neutral-900">
          {t.quick_links_title}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">{t.quick_links_desc}</p>

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
                {t.link_students_title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {t.link_students_desc}
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
                {t.link_reports_title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {t.link_reports_desc}
              </p>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}