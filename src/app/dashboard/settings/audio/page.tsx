import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AudioTrackForm } from "./audio-track-form";
import { AudioTrackList } from "./audio-track-list";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  saved?: string;
  updated?: string;
  deleted?: string;
  error?: string;
};

function errText(
  code: string | undefined,
  t: {
    err_invalid_name: string;
    err_invalid_volume: string;
    err_no_pages: string;
    err_no_file: string;
    err_invalid_type: string;
    err_too_large: string;
    err_not_found: string;
    err_invalid_id: string;
    err_unknown_prefix: string;
  },
): string | null {
  switch (code) {
    case "invalid_name":
      return t.err_invalid_name;
    case "invalid_volume":
      return t.err_invalid_volume;
    case "no_pages":
      return t.err_no_pages;
    case "no_file":
      return t.err_no_file;
    case "invalid_type":
      return t.err_invalid_type;
    case "too_large":
      return t.err_too_large;
    case "not_found":
      return t.err_not_found;
    case "invalid_id":
      return t.err_invalid_id;
    case undefined:
    case "":
      return null;
    default:
      return `${t.err_unknown_prefix} ${code}`;
  }
}

export default async function AudioSettingsPage({
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
  const t = dict.audio_settings;

  const { data: tracks } = await supabase
    .from("teacher_audio_tracks")
    .select("id, name, audio_path, audio_url, volume, enabled, pages")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const list = tracks ?? [];
  const err = errText(searchParams.error, t);

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
          {t.success_created}
        </div>
      ) : null}
      {searchParams.updated === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          {t.success_updated}
        </div>
      ) : null}
      {searchParams.deleted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          {t.success_deleted}
        </div>
      ) : null}
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          {err}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-black text-neutral-900">
          {t.add_title}
        </h2>
        <AudioTrackForm mode="create" dict={dict} />
      </section>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-neutral-900">
            {t.list_title}
          </h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {list.length}
          </span>
        </div>
        <AudioTrackList tracks={list} dict={dict} />
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        <p className="font-black">{t.help_title}</p>
        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>{t.help_item_1}</li>
          <li>{t.help_item_2}</li>
          <li>{t.help_item_3}</li>
        </ul>
      </section>
    </main>
  );
}