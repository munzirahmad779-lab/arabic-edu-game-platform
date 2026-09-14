import type { Metadata } from "next";
import "./globals.css";
import { GlobalBackgroundAudio } from "@/components/global-background-audio";

export const metadata: Metadata = {
  title: "منصة الألعاب التعليمية للغة العربية",
  description: "Platform game edukasi Bahasa Arab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <GlobalBackgroundAudio />
      </body>
    </html>
  );
}