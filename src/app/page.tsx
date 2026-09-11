import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">
        منصة الألعاب التعليمية للغة العربية
      </h1>
      <p className="max-w-md text-neutral-600">
        Platform game edukasi Bahasa Arab — Phase 1 foundation.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-neutral-900 px-6 py-2 text-white hover:bg-neutral-700"
      >
        تسجيل دخول المعلم
      </Link>
    </main>
  );
}
