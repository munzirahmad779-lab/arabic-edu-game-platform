"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteQuestion, updateQuestion } from "./actions";

type OptionKey = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "medium" | "hard";

type Question = {
  id: string;
  category_id: string | null;
  question_text: string | null;
  difficulty: Difficulty | null;
  correct_option_key: OptionKey | null;
};

type Option = {
  option_key: OptionKey;
  option_text: string;
};

type QuestionEditorDict = {
  edit_question: string;
  delete_question: string;
  media_warning: string;
  question_label: string;
  topic_label: string;
  difficulty_label: string;
  difficulty_easy: string;
  difficulty_medium: string;
  difficulty_hard: string;
  correct_label: string;
  saving: string;
  save_edit: string;
  cancel: string;
  confirm_delete: string;
  update_success: string;
};

export function QuestionEditor({
  question,
  options,
  categories,
  mediaCount,
  qe,
}: {
  question: Question;
  options: Option[];
  categories: { id: string; name: string }[];
  mediaCount: number;
  qe: QuestionEditorDict;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const optionMap = new Map(
    options.map((option) => [option.option_key, option.option_text]),
  );
  const initialCategory = question.category_id ?? categories[0]?.id ?? "";
  const initialDifficulty = question.difficulty ?? "easy";
  const initialCorrect = question.correct_option_key ?? "A";

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await updateQuestion(formData);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setEditing(false);
    setMessage(qe.update_success);
    router.refresh();
  }

  async function onDelete() {
    if (busy) return;

    const confirmed = window.confirm(qe.confirm_delete);
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    const result = await deleteQuestion(question.id);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    router.refresh();
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setEditing(true);
          }}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {qe.edit_question}
        </button>
        {mediaCount > 0 ? (
          <span className="text-sm text-amber-700">{qe.media_warning}</span>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {qe.delete_question}
          </button>
        )}
        {message ? (
          <span role="status" className="text-sm text-green-700">
            {message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={onSubmit}
      className="mt-4 space-y-3 border-t border-neutral-200 pt-4"
    >
      <input type="hidden" name="question_id" value={question.id} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {qe.question_label}
        </span>
        <textarea
          name="question_text"
          defaultValue={question.question_text ?? ""}
          required
          maxLength={5000}
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{qe.topic_label}</span>
          <select
            name="category_id"
            defaultValue={initialCategory}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {qe.difficulty_label}
          </span>
          <select
            name="difficulty"
            defaultValue={initialDifficulty}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="easy">{qe.difficulty_easy}</option>
            <option value="medium">{qe.difficulty_medium}</option>
            <option value="hard">{qe.difficulty_hard}</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["A", "B", "C", "D"] as const).map((key) => (
          <label key={key} className="block">
            <span className="mb-1 block text-sm font-medium">{key}</span>
            <input
              name={`option_${key}`}
              defaultValue={optionMap.get(key) ?? ""}
              required
              maxLength={2000}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {qe.correct_label}
        </span>
        <select
          name="correct_option_key"
          defaultValue={initialCorrect}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
        </select>
      </label>

      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? qe.saving : qe.save_edit}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMessage(null);
            setEditing(false);
          }}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {qe.cancel}
        </button>
      </div>
    </form>
  );
}