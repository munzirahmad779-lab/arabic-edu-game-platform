import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

async function startAttempt(fd: FormData) {
  "use server";
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Seluruh validasi token dan pembuatan attempt kini dikerjakan RPC
  // bergerbang token kelas (assessment_start_attempt, migrasi 0093):
  // pemeriksaan is_active/expires_at/max_uses/is_published, pembuatan
  // attempt + baris attempt_sections, dan kenaikan used_count atomik
  // di server. Dulu action ini membaca/menulis tabel assessment_*
  // langsung sebagai anon, dan kenaikan used_count-nya ditolak RLS
  // secara diam-diam sehingga max_uses tidak pernah ditegakkan.
  // Exception berkode dari RPC dipetakan satu-satu ke kode ?error=
  // yang sama seperti sebelumnya; error tak dikenal -> start_failed.
  const { data: attemptToken, error } = await db.rpc(
    "assessment_start_attempt",
    {
      p_token: String(fd.get("token") ?? ""),
      p_student_name: String(fd.get("name") ?? ""),
    },
  );

  if (error || !attemptToken) {
    const message = error?.message ?? "";
    const knownCodes = [
      "missing",
      "token_invalid",
      "token_expired",
      "token_limit",
      "not_published",
    ];
    const code =
      knownCodes.find((c) => message.includes(c)) ?? "start_failed";
    redirect(`/assessment?error=${code}`);
  }

  redirect(`/assessment/${attemptToken}`);
}

export default async function AssessmentEntryPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.assessment_entry;
  const isRtl = locale === "ar";

  const errorCode = searchParams.error;
  const errorMap: Record<string, string> = {
    missing: t.error_missing,
    token_invalid: t.error_token_invalid,
    token_expired: t.error_token_expired,
    token_limit: t.error_token_limit,
    not_published: t.error_not_published,
    start_failed: t.error_start_failed,
  };
  const errorMessage = errorCode ? (errorMap[errorCode] ?? errorCode) : null;

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-warmwhite p-4 sm:p-6"
    >
      <div className="mx-auto max-w-md space-y-6 py-12">
        <div className="flex justify-center">
          <Image
            src="/logo-horizontal.png"
            alt="Magguru"
            width={400}
            height={175}
            className="h-16 w-auto sm:h-20"
            priority
          />
        </div>

        <div className="text-center">
          <h1 className="font-display text-3xl font-black text-teal-700">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-softslate/70">{t.desc}</p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <form action={startAttempt} className="aesthetic-card space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-bold text-teal-700"
            >
              {t.label_token}
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              maxLength={8}
              minLength={8}
              autoComplete="off"
              placeholder={t.placeholder_token}
              autoFocus
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-center text-lg font-mono font-black tracking-[0.3em] uppercase outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
              dir="ltr"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-bold text-teal-700"
            >
              {t.label_name}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-4 py-3 outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            {t.btn_start}
          </button>

          <p className="text-center text-xs text-softslate/60">
            {t.hint_connection}
          </p>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-bold text-teal-700 underline-offset-4 hover:underline"
          >
            {t.back_home}
          </Link>
        </div>
      </div>
    </main>
  );
}