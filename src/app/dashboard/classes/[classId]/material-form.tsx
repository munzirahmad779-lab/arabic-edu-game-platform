"use client";

import { useState } from "react";
import MaterialEditor from "@/components/material-editor";

type Mode = "create" | "edit";

type MaterialFormProps = {
  mode: Mode;
  classId: string;
  action: (formData: FormData) => void | Promise<void>;
  initialData?: {
    id: string;
    title: string;
    content_json: string | null;
    youtube_url: string | null;
    image_path: string | null;
    pdf_path: string | null;
  };
  onCancel?: () => void;
};

export default function MaterialForm({
  mode,
  classId,
  action,
  initialData,
  onCancel,
}: MaterialFormProps) {
  const [contentJson, setContentJson] = useState<string>(
    initialData?.content_json ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  const [removeImage, setRemoveImage] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);

  const hasExistingImage = Boolean(initialData?.image_path) && !removeImage;
  const hasExistingPdf = Boolean(initialData?.pdf_path) && !removePdf;

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        formData.set("content_json", contentJson);
        if (removeImage) formData.set("remove_image", "1");
        if (removePdf) formData.set("remove_pdf", "1");
        await action(formData);
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="class_id" value={classId} />
      {mode === "edit" && initialData ? (
        <input type="hidden" name="material_id" value={initialData.id} />
      ) : null}

      <div>
        <label
          htmlFor={`material-title-${initialData?.id ?? "new"}`}
          className="block text-sm font-bold text-neutral-800"
        >
          عنوان المادة
        </label>
        <input
          id={`material-title-${initialData?.id ?? "new"}`}
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={initialData?.title ?? ""}
          placeholder="مثال: مقدمة في النحو"
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-neutral-800">
          محتوى المادة
        </label>
        <div className="mt-2">
          <MaterialEditor value={contentJson} onChange={setContentJson} />
        </div>
      </div>

      <div>
        <label
          htmlFor={`material-yt-${initialData?.id ?? "new"}`}
          className="block text-sm font-bold text-neutral-800"
        >
          🎬 رابط يوتيوب (اختياري)
        </label>
        <input
          id={`material-yt-${initialData?.id ?? "new"}`}
          name="youtube_url"
          type="url"
          defaultValue={initialData?.youtube_url ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <label
            htmlFor={`material-image-${initialData?.id ?? "new"}`}
            className="block text-sm font-bold text-neutral-800"
          >
            🖼️ صورة توضيحية (اختياري)
          </label>
          <p className="mt-1 text-xs text-neutral-500">
            PNG / JPG / WEBP — الحد الأقصى 1MB
          </p>

          {hasExistingImage ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              <span>✓ صورة موجودة</span>
              <button
                type="button"
                onClick={() => setRemoveImage(true)}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50"
              >
                حذف
              </button>
            </div>
          ) : null}

          {removeImage ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              <span>سيتم حذف الصورة عند الحفظ</span>
              <button
                type="button"
                onClick={() => setRemoveImage(false)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              >
                تراجع
              </button>
            </div>
          ) : null}

          <input
            id={`material-image-${initialData?.id ?? "new"}`}
            name="image_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="mt-3 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <label
            htmlFor={`material-pdf-${initialData?.id ?? "new"}`}
            className="block text-sm font-bold text-neutral-800"
          >
            📄 ملف PDF (اختياري)
          </label>
          <p className="mt-1 text-xs text-neutral-500">
            ملف PDF فقط — الحد الأقصى 1MB
          </p>

          {hasExistingPdf ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              <span>✓ ملف PDF موجود</span>
              <button
                type="button"
                onClick={() => setRemovePdf(true)}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50"
              >
                حذف
              </button>
            </div>
          ) : null}

          {removePdf ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              <span>سيتم حذف الملف عند الحفظ</span>
              <button
                type="button"
                onClick={() => setRemovePdf(false)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              >
                تراجع
              </button>
            </div>
          ) : null}

          <input
            id={`material-pdf-${initialData?.id ?? "new"}`}
            name="pdf_file"
            type="file"
            accept="application/pdf"
            className="mt-3 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "جاري الحفظ..."
            : mode === "create"
              ? "إضافة المادة"
              : "حفظ التعديلات"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
          >
            إلغاء
          </button>
        ) : null}
      </div>
    </form>
  );
}