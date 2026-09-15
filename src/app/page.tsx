import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Hero3D } from "@/components/three/hero-3d";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50"
      dir="rtl"
    >
      {/* Background decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-fuchsia-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md">
              ✦
            </span>
            <div>
              <p className="text-xs font-bold text-violet-600">
                منصة التعليم العربية
              </p>
              <p className="text-sm font-black text-neutral-900">
                Arabic Edu Game
              </p>
              <p className="text-[10px] font-bold text-neutral-500">
                by Yusuf
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-700"
              >
                لوحة التحكم →
              </Link>
            ) : (
              <>
                <Link
                  href="/student/login"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                >
                  👥 دخول الطالب
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-700"
                >
                  دخول المعلم
                </Link>
              </>
            )}
          </nav>
        </header>

        {/* Audio hint */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-sm sm:text-sm">
          <span className="text-xl">🔊</span>
          <p className="flex-1">
            <b>تنبيه:</b> الموسيقى الخلفية ستبدأ بعد أول نقرة على الصفحة (قيد
            المتصفح). اضغط في أي مكان لتشغيلها.
          </p>
        </div>

        {/* Hero */}
        <section className="mt-8 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:mt-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-1.5 text-xs font-bold text-violet-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              نسخة محدّثة · دعم TOAFL كامل
            </div>

            <h1 className="text-4xl font-black leading-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              تعلّم العربية
              <br />
              <span className="bg-gradient-to-l from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                بطريقة تفاعلية ممتعة
              </span>
            </h1>

            <p className="max-w-xl text-base leading-8 text-neutral-600 sm:text-lg">
              منصة تعليمية عربية متكاملة: ألعاب تنافسية وتعاونية، تدريب ذاتي،
              مواد دراسية غنية، وبنك أسئلة جاهز لاستيراد 140 سؤال.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-6 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
              >
                🎓 دخول المعلم
              </Link>
              <Link
                href="/student/login"
                className="rounded-2xl border-2 border-violet-200 bg-white px-6 py-4 text-base font-black text-violet-700 shadow-md transition hover:-translate-y-0.5 hover:bg-violet-50"
              >
                👥 دخول الطالب
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {[
                "🎮 4 أوضاع لعب",
                "📖 مواد تفاعلية",
                "🎯 تدريب ذاتي",
                "📊 تقارير يومية",
                "🔊 صوت محيطي",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-700 shadow-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* 3D Hero */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-violet-200/50 to-fuchsia-200/50 blur-2xl" />
            <Hero3D />
          </div>
        </section>

        {/* Features grid */}
        <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="🎮"
            title="4 أوضاع لعب"
            desc="تنافسي، تعاوني، بلا نهاية، وتمرين — كل وضع مصمّم لهدف تعليمي مختلف."
          />
          <FeatureCard
            icon="📊"
            title="تقارير ذكية"
            desc="انسخ التقرير اليومي إلى ChatGPT أو Meta AI، واحصل على تحليل جاهز."
          />
          <FeatureCard
            icon="🎯"
            title="تدريب ذاتي"
            desc="الطالب يتدرّب بحرية، يرى الإجابة الصحيحة وسببها فورًا."
          />
          <FeatureCard
            icon="📚"
            title="بنك أسئلة 140"
            desc="قالب Excel جاهز بمعيار TOAFL، مع مساعد ذكاء اصطناعي لتوليد الأسئلة."
          />
          <FeatureCard
            icon="🔊"
            title="موسيقى محيطية"
            desc="كل معلم يخصص موسيقاه الخاصة لكل صفحة، مع كتم فوري."
          />
          <FeatureCard
            icon="🎨"
            title="ثيمات للمعلم"
            desc="8 ألوان مختلفة لتخصيص لوحة التحكم — دون التأثير على صفحات الطالب."
          />
        </section>

        {/* CTA bottom */}
        <section className="mt-16 rounded-[2rem] bg-gradient-to-l from-violet-700 via-fuchsia-700 to-pink-600 p-8 text-white shadow-2xl sm:p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-black sm:text-3xl">جاهز للبدء؟</h2>
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              أنشئ فصلك الأول، أضف طلابك بالـ PIN، وابدأ بتشغيل أول لعبة خلال
              دقيقتين.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-2xl bg-white px-6 py-3.5 text-base font-black text-violet-700 shadow-lg transition hover:-translate-y-0.5"
              >
                ابدأ الآن →
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500">
          <p>
            <span className="font-black text-neutral-700">
              Arabic Edu Game
            </span>{" "}
            by <span className="font-black text-violet-700">Yusuf</span>
          </p>
          <p className="mt-1">منصة التعليم العربية · 2026</p>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md">
        {icon}
      </span>
      <h3 className="mt-4 font-black text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm leading-7 text-neutral-600">{desc}</p>
    </article>
  );
}