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
import { getLocale } from "@/lib/i18n/server";
import { judulDars } from "@/modules/tugas-susulan/judul";
import { cocokMateri } from "@/modules/tugas-susulan/materi";
import { BacaTracker } from "./baca-tracker";

const MATERIAL_CSS = `
  .material-content { line-height: 1.9; color: #171717; font-size: 1.05rem; }
  .material-content h1 { font-size: 1.75rem; font-weight: 800; margin: 1.25rem 0 0.75rem; line-height: 1.4; }
  .material-content h2 { font-size: 1.4rem; font-weight: 800; margin: 1.1rem 0 0.6rem; line-height: 1.4; }
  .material-content h3 { font-size: 1.15rem; font-weight: 700; margin: 1rem 0 0.5rem; line-height: 1.4; }
  .material-content p { margin: 0.6rem 0; }
  .material-content ul { list-style-type: disc; padding-inline-start: 1.75rem; margin: 0.6rem 0; }
  .material-content ul ul { list-style-type: circle; }
  .material-content ul ul ul { list-style-type: square; }
  .material-content ol { list-style-type: decimal; padding-inline-start: 1.75rem; margin: 0.6rem 0; }
  .material-content li { margin: 0.25rem 0; }
  .material-content li > p { margin: 0; }
  .material-content blockquote { border-inline-start: 4px solid #a78bfa; background: #f5f3ff; padding: 0.75rem 1rem; margin: 0.75rem 0; border-radius: 0.5rem; color: #4c1d95; }
  .material-content hr { border: none; border-top: 1px solid #e5e5e5; margin: 1.25rem 0; }
  .material-content strong { font-weight: 800; }
  .material-content em { font-style: italic; }
  .material-content u { text-decoration: underline; }
  .material-content s { text-decoration: line-through; }
  /* Di layar sentuh, bingkai PDF tidak boleh menelan gestur gulir:
     PDF di dalam iframe tidak tampil di Chrome Android dan sentuhan
     yang mulai di atas iframe membuat halaman induk berhenti bergulir,
     sehingga kemajuan membaca mentok sebelum akhir. Sentuhan dibiarkan
     lewat ke halaman; PDF tetap bisa dibuka lewat tombol Download PDF. */
  @media (pointer: coarse) { .baca-pdf iframe { pointer-events: none; } }
`;

export default async function BacaMateriSusulanPage({
  params,
}: {
  params: { dars: string };
}) {
  const darsNo = Number(params.dars);
  if (!Number.isInteger(darsNo) || darsNo < 1 || darsNo > 15) notFound();

  const session = await requireStudent();
  const token = await getStudentToken();
  if (!token) redirect("/student/login");

  const locale = await getLocale();
  const isRtl = locale === "ar";

  const supabase = await createClient();

  const { data: tasks } = await supabase.rpc("student_get_catchup_tasks", {
    p_token: token,
  });
  const task = (tasks ?? []).find((t) => t.dars_no === darsNo);
  const bacaDone = task?.baca_done ?? false;

  const { data: materials } = await supabase.rpc("student_list_materials", {
    p_token: token,
    p_class_id: session.class_id,
  });
  const ringkas = (materials ?? []).find((m) => cocokMateri(m.title, darsNo));

  const judul = judulDars(darsNo);

  let isi: React.ReactNode = null;
  let judulMateri = ringkas?.title ?? null;

  if (ringkas) {
    const { data, error } = await supabase.rpc("student_get_material", {
      p_token: token,
      p_material_id: ringkas.id,
    });
    const material = !error && data && data[0] ? data[0] : null;
    if (material) {
      judulMateri = material.title;
      const hasContent = hasTiptapContent(material.content_json);
      const imageUrl = material.image_path
        ? supabase.storage
            .from("question-media")
            .getPublicUrl(material.image_path).data.publicUrl
        : null;
      const pdfUrl = material.pdf_path
        ? supabase.storage.from("question-media").getPublicUrl(material.pdf_path)
            .data.publicUrl
        : null;
      isi = (
        <>
          {hasYouTube(material.youtube_url) && material.youtube_url ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-neutral-700">Video</h2>
              <MaterialYouTube url={material.youtube_url} />
            </section>
          ) : null}
          {imageUrl ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-neutral-700">Gambar</h2>
              <MaterialImage url={imageUrl} alt={material.title} />
            </section>
          ) : null}
          <article className="material-content rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg sm:p-8">
            <style dangerouslySetInnerHTML={{ __html: MATERIAL_CSS }} />
            {hasContent ? (
              renderTiptap(material.content_json)
            ) : (
              <p className="text-center text-sm text-neutral-500">
                Materi ini belum mempunyai isi bacaan.
              </p>
            )}
          </article>
          {pdfUrl ? (
            <section className="baca-pdf space-y-2">
              <h2 className="text-sm font-bold text-neutral-700">Berkas PDF</h2>
              <MaterialPdf url={pdfUrl} title={material.title} />
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                Bila PDF tidak tampil di layar HP-mu, tekan tombol{" "}
                <strong>Download PDF</strong> di atas bingkai untuk membukanya,
                lalu kembali ke halaman ini, gulir sampai bawah, dan selesaikan
                langkah membaca ini.
              </p>
            </section>
          ) : null}
        </>
      );
    }
  }

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 pb-28 sm:p-6 sm:pb-28"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <nav>
          <Link
            href="/student/tugas-susulan"
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <span>→</span>
            <span>Kembali ke Tugas Susulan</span>
          </Link>
        </nav>

        <header className="rounded-[2rem] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold text-violet-600">
            LANGKAH 1 · BACA MATERI · {session.class_name}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-neutral-900 sm:text-3xl">
            Dars {darsNo} · {judul ?? ""}
          </h1>
          <p className="mt-2 text-xs text-neutral-500">
            {judulMateri
              ? `Sumber bacaan: materi "${judulMateri}"`
              : "Materi dars ini belum terbit di kelasmu."}
          </p>
        </header>

        {isi ?? (
          <section className="rounded-[2rem] border-2 border-dashed border-neutral-200 bg-white p-12 text-center shadow-lg">
            <div className="text-6xl">📚</div>
            <p className="mt-4 font-bold text-neutral-700">
              Materi Dars {darsNo} belum tersedia.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Sampaikan ke gurumu agar materinya diterbitkan, lalu kembali ke
              halaman Tugas Susulan.
            </p>
          </section>
        )}
      </div>

      {isi ? <BacaTracker darsNo={darsNo} sudahSelesai={bacaDone} /> : null}
    </main>
  );
}
