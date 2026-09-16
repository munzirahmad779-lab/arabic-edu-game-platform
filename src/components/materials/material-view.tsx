import type { Json } from "@/types/database";
import { hasTiptapContent, renderTiptap } from "@/lib/tiptap-render";
import { MaterialYouTube, hasYouTube } from "./material-youtube";
import { MaterialImage } from "./material-image";
import { MaterialPdf } from "./material-pdf";

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

export type MaterialViewProps = {
  material: {
    title: string;
    content_json: Json | null;
    youtube_url: string | null;
  };
  imageUrl: string | null;
  pdfUrl: string | null;
};

export function MaterialView({
  material,
  imageUrl,
  pdfUrl,
}: MaterialViewProps) {
  const hasContent = hasTiptapContent(material.content_json);
  const hasVideo = hasYouTube(material.youtube_url);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MATERIAL_CSS }} />

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
    </>
  );
}