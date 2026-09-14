import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AudioTrackForm } from "./audio-track-form";
import { AudioTrackList } from "./audio-track-list";

type SearchParams = {
  saved?: string;
  updated?: string;
  deleted?: string;
  error?: string;
};

function errText(code?: string) {
  switch (code) {
    case "invalid_name":
      return "اسم المقطع غير صالح (1-100 حرف).";
    case "invalid_volume":
      return "مستوى الصوت غير صالح.";
    case "no_pages":
      return "اختر صفحة واحدة على الأقل.";
    case "no_file":
      return "يجب اختيار ملف صوتي.";
    case "invalid_type":
      return "الملف يجب أن يكون بصيغة صوتية.";
    case "too_large":
      return "حجم الملف يجب أن يكون أقل من 5 ميجابايت.";
    case "not_found":
      return "المقطع غير موجود.";
    case "invalid_id":
      return "معرّف غير صالح.";
    case undefined:
    case "":
      return null;
    default:
      return `خطأ: ${code}`;
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

  const { data: tracks } = await supabase
    .from("teacher_audio_tracks")
    .select("id, name, audio_path, audio_url, volume, enabled, pages")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const list = tracks ?? [];
  const err = errText(searchParams.error);

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
        <p className="text-sm font-semibold text-white/75">الإعدادات</p>
        <h1 className="mt-1 text-3xl font-black">
          🎵 إدارة الموسيقى الخلفية
        </h1>
        <p className="mt-2 text-sm text-white/85">
          يمكنك إضافة عدة مقاطع موسيقية، وتحديد الصفحات التي يعمل فيها كل
          مقطع. لن تعمل الموسيقى في صفحات المواد الدراسية وصفحات الفصول
          وبنك الأسئلة لضمان التركيز.
        </p>
      </header>

      {searchParams.saved === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          ✓ تمت إضافة المقطع بنجاح.
        </div>
      ) : null}
      {searchParams.updated === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          ✓ تم تحديث المقطع.
        </div>
      ) : null}
      {searchParams.deleted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          ✓ تم حذف المقطع.
        </div>
      ) : null}
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          {err}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-black text-neutral-900">
          ➕ إضافة مقطع جديد
        </h2>
        <AudioTrackForm mode="create" />
      </section>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-neutral-900">
            🎶 المقاطع المضافة
          </h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {list.length}
          </span>
        </div>
        <AudioTrackList tracks={list} />
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        <p className="font-black">💡 أين أحصل على موسيقى مجانية؟</p>
        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>
            <span dir="ltr">pixabay.com/music</span> — موسيقى مجانية بدون
            حقوق.
          </li>
          <li>
            <span dir="ltr">YouTube Audio Library</span> — من استوديو
            يوتيوب.
          </li>
          <li>تأكد أن الملف بصيغة MP3 وأقل من 5 ميجابايت.</li>
        </ul>
      </section>
    </main>
  );
}