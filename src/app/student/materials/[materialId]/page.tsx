import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent, getStudentToken } from "@/lib/student-auth";
import { createClient } from "@/lib/supabase/server";
import { hasTiptapContent, renderTiptap } from "@/lib/tiptap-render";
import {
  MaterialYouTube,
  hasYouTube,
} from "@/components/materials/material-youtube";
import { MaterialImage } from "@/components/materials/material-image";
import { MaterialPdf } from "@/components/materials/material-pdf";

const MATERIAL_CSS = `
  .material-content {
    line-height: 1.9;
    color: #171717;
    font-size: 1.05rem;
  }
  .material-content h1 {
    font-size: 1.75rem;
    font-weight: 800;
    margin: 1.25rem 0 0.75rem;
    line-height: 1.4;
  }
  .material-content h2 {
    font-size: 1.4rem;
    font-weight: 800;
    margin: 1.1rem 0 0.6rem;
    line-height: 1.4;
  }
  .material-content h3 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 1rem 0 0.5rem;
    line-height: 1.4;
  }
  .material-content p {
    margin: 0.6rem 0;
  }
  .material-content ul {
    list-style-type: disc;
    padding-inline-start: 1.75rem;
    margin: 0.6rem 0;
  }
  .material-content ul ul { list-style-type: circle; }
  .material-content ul ul ul { list-style-type: square; }
  .material-content ol {
    list-style-type: decimal;
    padding-inline-start: 1.75rem;
    margin: 0.6rem 0;
  }
  .material-content li {
    margin: 0.25rem 0;
  }
  .material-content li > p {
    margin: 0;
  }
  .material-content blockquote {
    border-inline-start: 4px solid #a78bfa;
    background: #f5f3ff;
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    border-radius: 0.5rem;
    color: #4c1d95;
  }
  .material-content hr {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 1.25rem 0;
  }
  .material-content strong { font-weight: 800; }
  .material-content em { font-style: italic; }
  .material-content u { text-decoration: underline; }
  .material-content s { text-decoration: line-through; }
`;

export default async function MaterialReadPage({
  params,
}: {
  params: { materialId: string };
}) {
  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_get_material", {
    p_token: token,
    p_material_id: params.materialId,
  });

  if (error || !data || !data[0]) {
    notFound();
  }

  const material = data[0];
  const hasContent = hasTiptapContent(material.content_json);
  const hasVideo = hasYouTube(material.youtube_url);

  // Generate public URL untuk gambar & PDF (bucket question-media = public)
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
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <nav>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>رجوع إلى المواد</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold text-violet-600">
            {session.class_name}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-neutral-900 sm:text-3xl">
            {material.title}
          </h1>
          <p className="mt-2 text-xs text-neutral-500">
            آخر تحديث: {formattedDate}
          </p>
        </header>

        {hasVideo && material.youtube_url ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-neutral-700">🎬 فيديو</h2>
            <MaterialYouTube url={material.youtube_url} />
          </section>
        ) : null}

        {imageUrl ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-neutral-700">
              🖼️ صورة توضيحية
            </h2>
            <MaterialImage url={imageUrl} alt={material.title} />
          </section>
        ) : null}

        <article className="material-content rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg sm:p-8">
          <style dangerouslySetInnerHTML={{ __html: MATERIAL_CSS }} />
          {hasContent ? (
            renderTiptap(material.content_json)
          ) : (
            <p className="text-center text-sm text-neutral-500">
              لا يوجد محتوى نصي في هذه المادة بعد.
            </p>
          )}
        </article>

        {pdfUrl ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-neutral-700">
              📄 ملف PDF مرفق
            </h2>
            <MaterialPdf url={pdfUrl} title={material.title} />
          </section>
        ) : null}
      </div>
    </main>
  );
}