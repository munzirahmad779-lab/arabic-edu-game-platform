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

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        formData.set("content_json", contentJson);
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
          رابط يوتيوب (اختياري)
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
        <p className="mt-1 text-xs text-neutral-500">
          سنضيف دعم عرض الفيديو في تحديث قادم.
        </p>
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