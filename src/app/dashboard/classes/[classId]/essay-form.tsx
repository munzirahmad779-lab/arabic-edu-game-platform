"use client";

import { useState } from "react";
import { createEssay } from "./essay-actions";

type EssayFormDict = {
  title_label: string;
  title_placeholder: string;
  theme_label: string;
  theme_placeholder: string;
  theme_hint: string;
  question_label: string;
  question_placeholder: string;
  ideal_label: string;
  ideal_placeholder: string;
  duration_label: string;
  rubric_title: string;
  rubric_content: string;
  rubric_grammar: string;
  rubric_vocab: string;
  submit: string;
  submitting: string;
};

export function EssayForm({
  classId,
  ef,
}: {
  classId: string;
  ef: EssayFormDict;
}) {
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
          {ef.title_label}
        </label>
        <input
          id="essay-title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={ef.title_placeholder}
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label
          htmlFor="essay-theme"
          className="block text-sm font-bold text-neutral-800"
        >
          {ef.theme_label}
        </label>
        <input
          id="essay-theme"
          name="theme"
          type="text"
          maxLength={300}
          placeholder={ef.theme_placeholder}
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
        <p className="mt-1 text-xs text-neutral-500">{ef.theme_hint}</p>
      </div>

      <div>
        <label
          htmlFor="essay-question"
          className="block text-sm font-bold text-neutral-800"
        >
          {ef.question_label}
        </label>
        <textarea
          id="essay-question"
          name="question_text"
          required
          maxLength={5000}
          rows={4}
          placeholder={ef.question_placeholder}
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label
          htmlFor="essay-ideal"
          className="block text-sm font-bold text-neutral-800"
        >
          {ef.ideal_label}
        </label>
        <textarea
          id="essay-ideal"
          name="ideal_answer"
          maxLength={5000}
          rows={4}
          placeholder={ef.ideal_placeholder}
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div>
        <label
          htmlFor="essay-duration"
          className="block text-sm font-bold text-neutral-800"
        >
          {ef.duration_label}
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

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-bold text-neutral-800">{ef.rubric_title}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-neutral-600">
              {ef.rubric_content}
            </label>
            <input
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
            <label className="block text-xs font-bold text-neutral-600">
              {ef.rubric_grammar}
            </label>
            <input
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
            <label className="block text-xs font-bold text-neutral-600">
              {ef.rubric_vocab}
            </label>
            <input
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
        {submitting ? ef.submitting : ef.submit}
      </button>
    </form>
  );
}