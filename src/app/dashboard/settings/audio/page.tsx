import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AudioSettingsForm } from "./audio-settings-form";

type SearchParams = { saved?: string; error?: string };

function errText(code?: string) {
  switch (code) {
    case "invalid_volume":
      return "مستوى الصوت غير صالح.";
    case "invalid_type":
      return "الملف يجب أن يكون بصيغة صوتية (MP3).";
    case "too_large":
      return "حجم الملف يجب أن يكون أقل من 3 ميجابايت.";
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

  const { data: row } = await supabase
    .from("teacher_audio_settings")
    .select(
      "enabled, audio_path, audio_url, volume, play_on_dashboard, play_on_login, play_on_student, play_on_game, play_on_final",
    )
    .eq("teacher_id", user.id)
    .maybeSingle();

  const initial = {
    enabled: row?.enabled ?? false,
    audio_path: row?.audio_path ?? null,
    audio_url: row?.audio_url ?? null,
    volume: row?.volume ?? 50,
    play_on_dashboard: row?.play_on_dashboard ?? true,
    play_on_login: row?.play_on_login ?? true,
    play_on_student: row?.play_on_student ?? true,
    play_on_game: row?.play_on_game ?? true,
    play_on_final: row?.play_on_final ?? true,
  };

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
        <h1 className="mt-1 text-3xl font-black">🎵 الموسيقى الخلفية</h1>
        <p className="mt-2 text-sm text-white/85">
          ارفع ملف MP3 ليتم تشغيله أثناء استخدام الطلاب للمنصة (باستثناء
          صفحات الدراسة لضمان التركيز).
        </p>
      </header>

      {searchParams.saved === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
          ✓ تم حفظ الإعدادات بنجاح.
        </div>
      ) : null}

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
          {err}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
        <AudioSettingsForm initial={initial} />
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        <p className="font-black">💡 أين أحصل على موسيقى مجانية؟</p>
        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>
            <span dir="ltr">pixabay.com/music</span> — موسيقى مجانية بدون
            حقوق (بدون الحاجة لاسم المؤلف).
          </li>
          <li>
            <span dir="ltr">YouTube Audio Library</span> — من استوديو
            يوتيوب، فلتر «بدون حقوق نشر».
          </li>
          <li>
            حمّل الملف، ثم ارفعه هنا. تأكد أن الملف بصيغة MP3 وأقل من 3
            ميجابايت.
          </li>
        </ul>
      </section>
    </main>
  );
}