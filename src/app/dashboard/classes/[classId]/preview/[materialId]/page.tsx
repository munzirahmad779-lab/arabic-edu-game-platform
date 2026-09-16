import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MaterialView } from "@/components/materials/material-view";

export default async function MaterialPreviewPage({
  params,
}: {
  params: { classId: string; materialId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classRow } = await supabase
    .from("classes")
    .select("id, name, subject")
    .eq("id", params.classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classRow) notFound();

  const { data: material } = await supabase
    .from("class_materials")
    .select(
      "id, title, content_json, youtube_url, image_path, pdf_path, updated_at",
    )
    .eq("id", params.materialId)
    .eq("class_id", params.classId)
    .maybeSingle();

  if (!material) notFound();

  const imageUrl = material.image_path
    ? supabase.storage.from("question-media").getPublicUrl(material.image_path)
        .data.publicUrl
    : null;
  const pdfUrl = material.pdf_path
    ? supabase.storage.from("question-media").getPublicUrl(material.pdf_path)
        .data.publicUrl
    : null;

  const formattedDate = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(material.updated_at));

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-violet-50 p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-800">
          👁️ معاينة كطالب — هذه هي الطريقة التي سيرى بها الطالب المادة
        </div>

        <nav>
          <Link
            href={`/dashboard/classes/${params.classId}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>العودة إلى إدارة الفصل</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold text-violet-600">
            {classRow.name}
            {classRow.subject ? ` — ${classRow.subject}` : ""}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-neutral-900 sm:text-3xl">
            {material.title}
          </h1>
          <p className="mt-2 text-xs text-neutral-500">
            آخر تحديث: {formattedDate}
          </p>
        </header>

        <MaterialView
          material={material}
          imageUrl={imageUrl}
          pdfUrl={pdfUrl}
        />
      </div>
    </main>
  );
}