import type { Metadata } from "next";
import "./globals.css";
import { GlobalBackgroundAudio } from "@/components/global-background-audio";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: "Magguru — Interactive Learning Platform",
  description:
    "Platform pembelajaran interaktif untuk guru dan siswa. Kelola kelas, siswa, materi, dan permainan edukatif dalam satu tempat.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body suppressHydrationWarning>
        <PageTransition>{children}</PageTransition>
        <GlobalBackgroundAudio />
      </body>
    </html>
  );
}