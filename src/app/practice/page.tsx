import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "@/components/language-switcher";

type Topic = {
  id: string;
  icon: string;
  title: string;
  titleAr: string;
  desc: string;
  level: "Mudah" | "Sedang" | "Menantang";
  questionCount: number;
  badgeColor: string;
};

const PRACTICE_TOPICS: Topic[] = [
  {
    id: "mufradat-dasar",
    icon: "🏠",
    title: "Kosakata Rumah & Sekolah",
    titleAr: "مُفْرَدَاتُ البَيْتِ وَالمَدْرَسَةِ",
    desc: "Kenali nama-nama benda di sekitarmu dalam bahasa Arab dengan pelafalan asli.",
    level: "Mudah",
    questionCount: 15,
    badgeColor: "bg-sage-100 text-sage-800 border-sage-300",
  },
  {
    id: "jam-waktu",
    icon: "⏰",
    title: "Jam & Waktu",
    titleAr: "السَّاعَةُ وَالأَوْقَاتُ",
    desc: "Belajar membaca jam, menit, pagi, siang, dan malam dalam bahasa Arab.",
    level: "Sedang",
    questionCount: 12,
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
  },
  {
    id: "bilangan-angka",
    icon: "🔢",
    title: "Bilangan 1 sampai 20",
    titleAr: "الأَعْدَادُ وَالأَرْقَامُ",
    desc: "Kuasai hitungan dan penyebutan bilangan mudzakkar dan muannats.",
    level: "Mudah",
    questionCount: 20,
    badgeColor: "bg-terracotta-100 text-terracotta-800 border-terracotta-300",
  },
  {
    id: "percakapan-harian",
    icon: "💬",
    title: "Percakapan Santai (At-Ta'aruf)",
    titleAr: "التَّعَارُفُ وَالحِوَارُ اليَوْمِيُّ",
    desc: "Latihan menyusun kalimat tanya dan jawab saat berkenalan dengan teman baru.",
    level: "Sedang",
    questionCount: 10,
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
  },
  {
    id: "tata-bahasa-dhomir",
    icon: "🕌",
    title: "Kata Ganti (Dhomir Munfashil)",
    titleAr: "الضَّمَائِرُ المُنْفَصِلَةُ",
    desc: "Pahami perbedaan Hua, Huma, Hum, Anta, Anti, hingga Nahnu dengan tepat.",
    level: "Menantang",
    questionCount: 14,
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
];

export default async function PracticeCatalogPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden bg-warmwhite text-ink"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* NAVBAR */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-horizontal.png"
            alt="Magguru"
            width={160}
            height={50}
            className="h-10 w-auto sm:h-11"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={locale} />
          <Link
            href="/"
            className="rounded-xl border border-sage-200 bg-white px-3.5 py-1.5 text-xs font-black text-teal-800 shadow-sm transition hover:border-terracotta-500 hover:text-terracotta-600"
          >
            ← {isRtl ? "الرئيسية" : "Beranda"}
          </Link>
        </div>
      </header>

      {/* HEADER BANNER */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-[2.5rem] border border-sage-200/80 bg-gradient-to-br from-cream via-white to-sage-50/50 p-6 shadow-md sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-xs font-black text-teal-800">
            <span>📖</span>
            <span>{isRtl ? "تدريب فردي منزلي" : "Latihan Mandiri di Rumah"}</span>
          </div>

          <h1 className="font-display mt-4 text-3xl font-black text-teal-800 sm:text-4xl">
            {isRtl ? "اختر موضوعك وتدرّب براحة تامة" : "Asah Kemampuan Bahasa Arabmu Santai & Seru"}
          </h1>

          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-softslate sm:text-base">
            {isRtl
              ? "استمتع بالتعلم الفردي بدون قيود الوقت مع صوت نطق عربي فصيح وشرح فوري لكل سؤال."
              : "Setiap topik dirancang dengan audio pelafalan makhraj jernih, tipografi Naskh berharakat lengkap, dan pembahasan instan saat salah menjawab."}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-xs font-black text-teal-900">
            <span className="flex items-center gap-1.5">🔊 Audio Makhraj Asli</span>
            <span className="flex items-center gap-1.5">💡 Pembahasan Langsung</span>
            <span className="flex items-center gap-1.5">⏱️ Waktu Fleksibel Tanpa Panik</span>
          </div>
        </div>

        {/* TOPICS GRID */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PRACTICE_TOPICS.map((topic) => (
            <div
              key={topic.id}
              className="group relative flex flex-col justify-between rounded-3xl border border-sage-200/70 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-terracotta-500/50 hover:shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-2xl shadow-inner">
                    {topic.icon}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-0.5 text-[11px] font-black ${topic.badgeColor}`}
                  >
                    {topic.level}
                  </span>
                </div>

                <h3 className="font-display mt-4 text-lg font-black text-teal-900 group-hover:text-terracotta-600 transition">
                  {topic.title}
                </h3>
                <p className="font-arabic mt-1 text-base font-bold text-teal-700/80" dir="rtl">
                  {topic.titleAr}
                </p>

                <p className="mt-2 text-xs leading-relaxed text-softslate">
                  {topic.desc}
                </p>
              </div>

              <div className="mt-6 border-t border-sage-100 pt-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-softslate/80">
                  <span>📝 {topic.questionCount} Butir Soal</span>
                  <span className="text-teal-700">⭐ Bintang Terbuka</span>
                </div>

                <Link
                  href={`/practice/${topic.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta-500 py-3 px-4 text-center text-xs font-black text-white shadow-md shadow-terracotta-500/20 transition hover:bg-terracotta-600 hover:shadow-lg active:scale-95"
                >
                  <span>🎯 {isRtl ? "ابدأ التدريب الآن" : "Mulai Latihan Sekarang"}</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
