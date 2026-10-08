import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { PrintCardsClient } from "./print-cards-client";

export const metadata = {
  title: "Cetak Kartu Login Siswa - Magguru",
};

export default async function PrintStudentsPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const classId = searchParams.classId?.trim();
  if (!classId) {
    redirect("/dashboard/students");
  }

  // 1. Fetch class details ensuring teacher ownership
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, name, subject")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    notFound();
  }

  // 2. Fetch all students for this class with plain PINs
  const { data: studentsData } = await supabase
    .from("students")
    .select("id, name, pin_plain")
    .eq("class_id", classRow.id)
    .order("name", { ascending: true });

  const students = studentsData ?? [];

  // 3. Resolve public portal URL
  const envPublicUrl = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  let portalUrl: string;

  if (envPublicUrl) {
    portalUrl = `${envPublicUrl}/student/login`;
  } else {
    const headersList = await headers();
    const host = headersList.get("host")?.trim() ?? "";
    const xfp = headersList.get("x-forwarded-proto")?.trim();
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.") ||
      /^\d+\.\d+\.\d+\.\d+/.test(host);
    const proto = xfp ?? (isLocal ? "http" : "https");
    portalUrl = host
      ? `${proto}://${host}/student/login`
      : "http://localhost:3000/student/login";
  }

  const locale = await getLocale();
  const isRtl = locale === "ar";

  return (
    <PrintCardsClient
      classNameTitle={classRow.name}
      subjectTitle={classRow.subject}
      students={students}
      portalUrl={portalUrl}
      backUrl={`/dashboard/students?classId=${classRow.id}`}
      isRtl={isRtl}
    />
  );
}
