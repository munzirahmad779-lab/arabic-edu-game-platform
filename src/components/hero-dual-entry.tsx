"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Locale = "id" | "ar" | "en";

interface HeroDualEntryProps {
  locale: Locale;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dict?: Record<string, any>;
}

export function HeroDualEntry({ locale, dict }: HeroDualEntryProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"join" | "solo">("join");
  const [roomCode, setRoomCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRtl = locale === "ar";

  const t = {
    tab_join: dict?.tab_join || (isRtl ? "🚀 انضم للعبة الفصل" : locale === "en" ? "🚀 Join Class Game" : "🚀 Gabung Game Kelas"),
    tab_solo: dict?.tab_solo || (isRtl ? "📖 تدريب منزلي فردي" : locale === "en" ? "📖 Solo Practice" : "📖 Latihan Mandiri di Rumah"),
    room_code_label: dict?.room_code_label || (isRtl ? "رمز الغرفة (6 أحرف/أرقام):" : locale === "en" ? "6-Digit Room Code:" : "Kode Ruangan (6 Digit):"),
    room_code_placeholder: dict?.room_code_placeholder || "8P8PYU",
    name_label: dict?.name_label || (isRtl ? "اسمك المستعار:" : locale === "en" ? "Your Nickname:" : "Nama Panggilanmu:"),
    name_placeholder: dict?.name_placeholder || (isRtl ? "مثال: أحمد" : locale === "en" ? "e.g. Anti" : "Contoh: Anti"),
    btn_join: dict?.btn_join || (isRtl ? "🚀 ادخل إلى الغرفة الآن" : locale === "en" ? "🚀 Enter Game Room" : "🚀 Masuk ke Ruangan"),
    solo_title: dict?.solo_title || (isRtl ? "تعلّم براحة في منزلك" : locale === "en" ? "Practice Anytime at Home" : "Belajar Santai di Rumah Kapan Saja"),
    solo_desc: dict?.solo_desc || (isRtl ? "ألعاب وكلمات عربية بنطق صوتي وشرح فوري بدون ضغط وقت الامتحان." : locale === "en" ? "Bite-sized Arabic vocabulary games with native audio and instant feedback." : "Mainkan kuis kosakata beranimasi dengan audio makhraj asli dan pembahasan instan tanpa tekanan waktu."),
    btn_solo: dict?.btn_solo || (isRtl ? "🎯 ابدأ اللعب الفردي الآن" : locale === "en" ? "🎯 Start Solo Arcade" : "🎯 Mulai Latihan Santai"),
    teacher_link: dict?.teacher_link || (isRtl ? "بوابة المعلم: إطلاق فصل سريع ←" : locale === "en" ? "Teacher Portal: Quick Class Launch →" : "Portal Guru: Luncurkan Kelas Cepat →"),
    student_portal_link: dict?.student_portal_link || (isRtl ? "بوابة طلاب مانغكوسو (تسجيل بالرمز السري) ←" : locale === "en" ? "Mangkoso Student Portal (PIN Login) →" : "Portal Santri Mangkoso (Masuk dengan PIN) →"),
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = studentName.trim();
    if (!cleanCode || !cleanName) return;

    setIsSubmitting(true);
    // Langsung arahkan ke halaman join room dengan parameter
    router.push(`/join?code=${encodeURIComponent(cleanCode)}&name=${encodeURIComponent(cleanName)}`);
  };

  return (
    <div className="w-full rounded-[2rem] border border-sage-200/80 bg-white/95 p-5 shadow-xl backdrop-blur-md transition-all sm:p-7">
      {/* TAB SELECTOR */}
      <div className="flex rounded-2xl bg-cream/70 p-1.5 text-xs font-black sm:text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("join")}
          className={`flex-1 rounded-xl py-3 px-3 transition-all ${
            activeTab === "join"
              ? "bg-terracotta-500 text-white shadow-md scale-[1.01]"
              : "text-teal-700 hover:text-terracotta-600 hover:bg-white/50"
          }`}
        >
          {t.tab_join}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("solo")}
          className={`flex-1 rounded-xl py-3 px-3 transition-all ${
            activeTab === "solo"
              ? "bg-teal-600 text-white shadow-md scale-[1.01]"
              : "text-teal-700 hover:text-teal-800 hover:bg-white/50"
          }`}
        >
          {t.tab_solo}
        </button>
      </div>

      {/* CONTENT TAB 1: JOIN LIVE ROOM */}
      {activeTab === "join" && (
        <form onSubmit={handleJoinSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-teal-800">
              {t.room_code_label}
            </label>
            <div className="mt-1.5 relative">
              <input
                type="text"
                required
                maxLength={8}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder={t.room_code_placeholder}
                className="w-full rounded-2xl border-2 border-sage-200 bg-warmwhite/70 px-4 py-3.5 text-center text-xl font-black uppercase tracking-[0.2em] text-teal-900 outline-none transition focus:border-terracotta-500 focus:bg-white focus:ring-4 focus:ring-terracotta-500/15 sm:text-2xl"
              />
            </div>
            <p className="mt-1 text-[11px] font-bold text-softslate/70">
              {isRtl
                ? "💡 احصل على الرمز المكون من 6 خانات من شاشة عرض معلمك."
                : "💡 Dapatkan kode 6 digit dari layar proyektor gurumu di kelas."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-teal-800">
              {t.name_label}
            </label>
            <input
              type="text"
              required
              maxLength={40}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder={t.name_placeholder}
              className="mt-1.5 w-full rounded-2xl border-2 border-sage-200 bg-warmwhite/70 px-4 py-3 text-sm font-bold text-teal-900 outline-none transition focus:border-terracotta-500 focus:bg-white focus:ring-4 focus:ring-terracotta-500/15 sm:text-base"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full transform rounded-2xl bg-terracotta-500 py-4 px-6 text-center text-sm font-black text-white shadow-lg shadow-terracotta-500/25 transition-all hover:bg-terracotta-600 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 sm:text-base"
          >
            {isSubmitting ? "..." : t.btn_join}
          </button>
        </form>
      )}

      {/* CONTENT TAB 2: SOLO PRACTICE */}
      {activeTab === "solo" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-teal-200/60 bg-teal-50/60 p-4">
            <h3 className="font-display text-base font-black text-teal-800 sm:text-lg">
              {t.solo_title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-softslate sm:text-sm">
              {t.solo_desc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Link
              href="/join?code=PRACTICE"
              className="flex items-center gap-2.5 rounded-xl border border-sage-200/80 bg-warmwhite/80 p-3 transition hover:border-terracotta-500 hover:bg-white"
            >
              <span className="text-xl">🏃</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-teal-900">Mufradat Runner</p>
                <p className="text-[10px] text-softslate/70">Aksi lari kata</p>
              </div>
            </Link>

            <Link
              href="/join?code=PRACTICE"
              className="flex items-center gap-2.5 rounded-xl border border-sage-200/80 bg-warmwhite/80 p-3 transition hover:border-teal-500 hover:bg-white"
            >
              <span className="text-xl">🍉</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-teal-900">Falak Slicer</p>
                <p className="text-[10px] text-softslate/70">Potong kata Arab</p>
              </div>
            </Link>
          </div>

          <Link
            href="/student/login"
            className="block w-full rounded-2xl bg-teal-600 py-3.5 px-6 text-center text-sm font-black text-white shadow-md transition-all hover:bg-teal-700 active:scale-[0.98]"
          >
            {t.btn_solo}
          </Link>
        </div>
      )}

      {/* FOOTER QUICK ACCESS */}
      <div className="mt-6 flex flex-col items-center justify-between gap-2.5 border-t border-sage-200/60 pt-4 text-[11px] font-bold text-softslate sm:flex-row">
        <Link
          href="/login"
          className="text-teal-700 transition hover:text-terracotta-500 hover:underline"
        >
          {t.teacher_link}
        </Link>
        <Link
          href="/student/login"
          className="text-teal-700 transition hover:text-terracotta-500 hover:underline"
        >
          {t.student_portal_link}
        </Link>
      </div>
    </div>
  );
}
