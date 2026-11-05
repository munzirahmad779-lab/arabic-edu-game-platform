"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { deleteQuestions } from "./actions";
import { QuestionEditor } from "./question-editor";
import { QuestionMediaManager } from "./media-manager";

type OptionKey = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "medium" | "hard";

type QuestionData = {
  id: string;
  category_id: string | null;
  question_text: string | null;
  difficulty: Difficulty | null;
  correct_option_key: OptionKey | null;
  explanation: string | null;
};

type MediaList = ComponentProps<typeof QuestionMediaManager>["media"];
type EditorDict = ComponentProps<typeof QuestionEditor>["qe"];
type MediaDict = ComponentProps<typeof QuestionMediaManager>["qm"];

export type BulkDict = {
  select_all: string;
  selected_count: string;
  delete_selected: string;
  clear: string;
  select_question: string;
  media_locked: string;
  confirm_title: string;
  confirm_body: string;
  confirm_yes: string;
  cancel: string;
  deleting: string;
  deleted_ok: string;
  deleted_partial: string;
};

export type BankQuestionItem = {
  question: QuestionData;
  options: { option_key: OptionKey; option_text: string }[];
  categoryName: string | null;
  difficultyText: string | null;
  media: MediaList;
  mediaCount: number;
};

type ListLabels = {
  question_word: string;
  correct: string;
  option_missing: string;
  explanation_label: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function BankQuestionList({
  items,
  categories,
  qm,
  qe,
  qb,
  labels,
}: {
  items: BankQuestionItem[];
  categories: { id: string; name: string }[];
  qm: MediaDict;
  qe: EditorDict;
  qb: BulkDict;
  labels: ListLabels;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const selectableIds = new Set(
    items.filter((item) => item.mediaCount === 0).map((item) => item.question.id),
  );
  const selectedIds = [...selected].filter((id) => selectableIds.has(id));
  const selectedCount = selectedIds.length;
  const allSelected =
    selectableIds.size > 0 && selectedCount === selectableIds.size;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(
        [...prev].filter((id) =>
          items.some((item) => item.question.id === id && item.mediaCount === 0),
        ),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

  async function onConfirmDelete() {
    if (busy || selectedCount === 0) return;

    setBusy(true);
    const result = await deleteQuestions(selectedIds);
    setBusy(false);
    setConfirmOpen(false);

    if (result.deleted > 0) {
      setSelected(new Set());
      setMessageIsError(result.failed > 0);
      setMessage(
        result.failed > 0
          ? fmt(qb.deleted_partial, { ok: result.deleted, fail: result.failed })
          : fmt(qb.deleted_ok, { n: result.deleted }),
      );
      router.refresh();
      return;
    }

    setMessageIsError(true);
    setMessage(result.message || qb.deleted_partial);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sage-200/60 bg-sage-50/40 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-teal-900">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={busy || selectableIds.size === 0}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 accent-teal-700"
          />
          {qb.select_all}
        </label>
        <span className="text-sm text-softslate">
          {fmt(qb.selected_count, { n: selectedCount })}
        </span>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={busy}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {qb.clear}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy || selectedCount === 0}
          className="ms-auto rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {qb.delete_selected}
        </button>
      </div>

      {message ? (
        <p
          role="status"
          className={`mt-3 text-sm font-bold ${messageIsError ? "text-red-700" : "text-green-700"}`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {items.map((item, index) => {
          const { question, options } = item;
          const isSelected = selected.has(question.id);
          const locked = item.mediaCount > 0;

          return (
            <article
              key={question.id}
              className={`rounded-2xl border bg-white p-4 ${
                isSelected
                  ? "border-red-300 ring-1 ring-red-200"
                  : "border-sage-200/60"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-softslate/70">
                <span>
                  {labels.question_word} {index + 1}
                </span>
                {item.categoryName ? (
                  <span className="rounded-full bg-terracotta-100 px-2 py-1 text-terracotta-600">
                    {item.categoryName}
                  </span>
                ) : null}
                {item.difficultyText ? (
                  <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">
                    {item.difficultyText}
                  </span>
                ) : null}
                <label
                  className="ms-auto flex items-center gap-1.5"
                  title={locked ? qb.media_locked : qb.select_question}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={busy || locked}
                    onChange={(e) => toggle(question.id, e.target.checked)}
                    aria-label={qb.select_question}
                    className="h-4 w-4 accent-red-600 disabled:opacity-40"
                  />
                </label>
              </div>

              <p
                className="mt-3 text-lg font-bold leading-relaxed text-teal-950 font-arabic"
                style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                dir="auto"
              >
                {question.question_text ?? "—"}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(["A", "B", "C", "D"] as const).map((key) => {
                  const option = options.find(
                    (entry) => entry.option_key === key,
                  );
                  const isCorrect = question.correct_option_key === key;

                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-3 flex items-center justify-between ${
                        isCorrect
                          ? "border-sage-500/40 bg-sage-50 text-sage-600"
                          : "border-sage-200/60 bg-white text-softslate"
                      }`}
                    >
                      <div>
                        <span className="font-black text-sm text-neutral-500">{key}.</span>{" "}
                        <span
                          className="font-bold text-base text-neutral-900"
                          style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                          dir="auto"
                        >
                          {option?.option_text ?? labels.option_missing}
                        </span>
                      </div>
                      {isCorrect ? (
                        <span className="ms-2 text-xs font-black">
                          ✓ {labels.correct}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {question.explanation ? (
                <p
                  className="mt-3 rounded-xl bg-sage-50 p-3 text-sm leading-relaxed text-softslate"
                  dir="auto"
                >
                  <span className="font-black text-teal-700">
                    {labels.explanation_label}:{" "}
                  </span>
                  <span
                    style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                  >
                    {question.explanation}
                  </span>
                </p>
              ) : null}

              <QuestionMediaManager
                questionId={question.id}
                media={item.media}
                qm={qm}
              />
              <QuestionEditor
                question={question}
                options={options}
                categories={categories}
                mediaCount={item.mediaCount}
                qe={qe}
              />
            </article>
          );
        })}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-display text-lg font-black text-teal-950">
              {qb.confirm_title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-softslate">
              {fmt(qb.confirm_body, { n: selectedCount })}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {qb.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={busy}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? qb.deleting : qb.confirm_yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
