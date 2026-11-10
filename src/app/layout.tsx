import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Amiri } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isSuperAdmin } from "@/lib/super-admin";

// Font Arab dimuat sungguhan (bukan hanya nama font sistem): tanpa ini,
// HP yang tidak punya font Naskh menampilkan harakat dengan fallback buruk.
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri-web",
  display: "swap",
});

const GlobalBackgroundAudio = dynamic(
  () =>
    import("@/components/global-background-audio").then(
      (mod) => mod.GlobalBackgroundAudio,
    ),
  { ssr: false, loading: () => null },
);

const SITE_TITLE = "Magguru — Interactive Learning Platform";
const SITE_DESC =
  "Platform pembelajaran interaktif untuk guru dan siswa. Kelola kelas, siswa, materi, dan permainan edukatif dalam satu tempat.";

// URL production. Di Vercel otomatis pakai VERCEL_URL, di lokal pakai localhost.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://magguru.web.id");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESC,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og-image.png"],
  },
};

const THEME_CSS = `
  :root {
    --cream: #F7F1E8;
    --cream-soft: #FBF7F0;
    --terracotta: #D97757;
    --terracotta-dark: #C25F3E;
    --teal: #2F6D72;
    --teal-deep: #1F4A4E;
    --sage: #8FA68E;
    --sage-light: #D4DDD0;
    --ink: #2B2B2B;
    --font-inter: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-playfair: Georgia, "Times New Roman", serif;
    --font-amiri: var(--font-amiri-web), "Traditional Arabic", "Amiri", "Scheherazade New", Tahoma, serif;
    --font-arabic: var(--font-amiri);
  }
  body {
    background-color: var(--cream);
    font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
    color: var(--ink);
  }
  .font-display {
    font-family: var(--font-playfair), Georgia, "Times New Roman", serif;
  }
  .font-arabic, [dir="rtl"], :lang(ar) {
    font-family: var(--font-arabic);
  }
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const isRtl = locale === "ar";

  // Status super-admin dihitung di server dari satu sumber kebenaran
  // (lib/super-admin, env ternormalisasi) lalu diteruskan sebagai boolean;
  // email tidak pernah dikirim ke bundle klien.
  let superAdmin = false;
  if (hasSupabaseEnv()) {
    try {
      superAdmin = isSuperAdmin(await getCurrentUser());
    } catch {
      superAdmin = false;
    }
  }

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"} className={amiri.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <GlobalBackgroundAudio isSuperAdmin={superAdmin} />
      </body>
    </html>
  );
}
