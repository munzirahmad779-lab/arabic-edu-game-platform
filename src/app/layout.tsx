import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { GlobalBackgroundAudio } from "@/components/global-background-audio";
import { PageTransition } from "@/components/page-transition";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const SITE_TITLE = "Magguru — Interactive Learning Platform";
const SITE_DESC =
  "Platform pembelajaran interaktif untuk guru dan siswa. Kelola kelas, siswa, materi, dan permainan edukatif dalam satu tempat.";

export const metadata: Metadata = {
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
  }
  body {
    background-color: var(--cream);
    font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
    color: var(--ink);
  }
  .font-display {
    font-family: var(--font-playfair), Georgia, "Times New Roman", serif;
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      dir="ltr"
      className={`${inter.variable} ${playfair.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body suppressHydrationWarning>
        <PageTransition>{children}</PageTransition>
        <GlobalBackgroundAudio />
      </body>
    </html>
  );
}