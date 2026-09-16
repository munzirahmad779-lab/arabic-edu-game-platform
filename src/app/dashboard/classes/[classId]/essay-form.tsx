"use client";

import { useState } from "react";
import { createEssay } from "./essay-actions";

export function EssayForm({ classId }: { classId: string }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        await createEssay(fd);
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="class_id" value={classId} />

      <div>
        <label
          htmlFor="essay-title"
          className="block text-sm font-bold text-neutral-800"
        >
          عنوان المهمة
        </label>
        <input
          id="essay-title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="مثال: اكتب فقرة عن النحو"
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label
          htmlFor="essay-question"
          className="block text-sm font-bold text-neutral-800"
        >
          السؤال / المطلوب
        </label>
        <textarea
          id="essay-question"
          name="question_text"
          required
          maxLength={5000}
          rows={4}
          placeholder="اكتب فقرة من 5 أسطر تصف فيها..."
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label
          htmlFor="essay-ideal"
          className="block text-sm font-bold text-neutral-800"
        >
          الإجابة المثالية (مرجع للذكاء الاصطناعي — اختياري)
        </label>
        <textarea
          id="essay-ideal"
          name="ideal_answer"
          maxLength={5000}
          rows={4}
          placeholder="اكتب نموذج الإجابة المثالية لمساعدة AI في التقييم"
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
        <p className="mt-1 text-xs text-neutral-500">
          كلما كانت الإجابة المرجعية أدق، كان تقييم AI أفضل.
        </p>
      </div>

      <div>
        <label
          htmlFor="essay-duration"
          className="block text-sm font-bold text-neutral-800"
        >
          مدة الكتابة بالدقائق
        </label>
        <input
          id="essay-duration"
          name="duration_minutes"
          type="number"
          min={5}
          max={180}
          step={5}
          defaultValue={30}
          required
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      {/* Rubric */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-bold text-neutral-800">
          معايير التقييم (يجب أن يكون المجموع 100)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="rubric-content"
              className="block text-xs font-bold text-neutral-600"
            >
              المحتوى والأفكار
            </label>
            <input
              id="rubric-content"
              name="rubric_content"
              type="number"
              min={0}
              max={100}
              defaultValue={40}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="rubric-grammar"
              className="block text-xs font-bold text-neutral-600"
            >
              القواعد النحوية
            </label>
            <input
              id="rubric-grammar"
              name="rubric_grammar"
              type="number"
              min={0}
              max={100}
              defaultValue={30}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="rubric-vocab"
              className="block text-xs font-bold text-neutral-600"
            >
              المفردات والأسلوب
            </label>
            <input
              id="rubric-vocab"
              name="rubric_vocabulary"
              type="number"
              min={0}
              max={100}
              defaultValue={30}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {submitting ? "..." : "➕ إنشاء مهمة كتابة"}
      </button>
    </form>
  );
}