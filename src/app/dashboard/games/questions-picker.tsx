"use client";

import { useState } from "react";

type Category = { id: string; name: string };

type Question = {
  id: string;
  question_text: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  category_id: string | null;
};

type Bank = {
  id: string;
  name: string;
  description: string | null;
};

type QuestionsPickerDict = {
  legend: string;
  selected_badge: string;
  hint_open: string;
  questions_count: string;
  selected_in_bank: string;
  no_questions: string;
  all: string;
  none_category: string;
  no_match: string;
  no_text: string;
  difficulty_easy: string;
  difficulty_medium: string;
  difficulty_hard: string;
  select_all: string;
  deselect_all: string;
  select_all_bank: string;
  deselect_all_bank: string;
};

function fmt(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function difficultyLabel(
  d: "easy" | "medium" | "hard" | null,
  qp: QuestionsPickerDict,
): string {
  if (d === "easy") return qp.difficulty_easy;
  if (d === "medium") return qp.difficulty_medium;
  if (d === "hard") return qp.difficulty_hard;
  return "";
}

export function QuestionsPicker({
  banks,
  categories,
  questionsByBank,
  qp,
}: {
  banks: Bank[];
  categories: Category[];
  questionsByBank: Record<string, Question[]>;
  qp: QuestionsPickerDict;
}) {
  const [openBank, setOpenBank] = useState<string | null>(
    banks.length === 1 ? banks[0].id : null,
  );
  const [filterByBank, setFilterByBank] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleQuestion(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setFilter(bankId: string, catId: string) {
    setFilterByBank((prev) => ({ ...prev, [bankId]: catId }));
  }

  /** Pilih semua pertanyaan yang lolos filter saat ini (bank + kategori). */
  function selectAllFiltered(bankId: string, questions: Question[]) {
    const activeCat = filterByBank[bankId] ?? "__all__";
    const filtered =
      activeCat === "__all__"
        ? questions
        : activeCat === "__none__"
          ? questions.filter((q) => !q.category_id)
          : questions.filter((q) => q.category_id === activeCat);

    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of filtered) next.add(q.id);
      return next;
    });
  }

  /** Hapus centang dari semua pertanyaan yang lolos filter saat ini. */
  function deselectAllFiltered(bankId: string, questions: Question[]) {
    const activeCat = filterByBank[bankId] ?? "__all__";
    const filtered =
      activeCat === "__all__"
        ? questions
        : activeCat === "__none__"
          ? questions.filter((q) => !q.category_id)
          : questions.filter((q) => q.category_id === activeCat);

    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of filtered) next.delete(q.id);
      return next;
    });
  }

  /** Pilih/lepas semua di bank (abaikan filter). */
  function selectAllBank(questions: Question[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of questions) next.add(q.id);
      return next;
    });
  }

  function deselectAllBank(questions: Question[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of questions) next.delete(q.id);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium">{qp.legend}</legend>

        {selected.size > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-800">
            <span>{fmt(qp.selected_badge, selected.size)}</span>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
            >
              {qp.deselect_all}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">{qp.hint_open}</p>
        )}

        <div className="mt-3 space-y-3">
          {banks.map((bank) => {
            const questions = questionsByBank[bank.id] ?? [];
            const open = openBank === bank.id;
            const activeCat = filterByBank[bank.id] ?? "__all__";

            const filtered =
              activeCat === "__all__"
                ? questions
                : activeCat === "__none__"
                  ? questions.filter((q) => !q.category_id)
                  : questions.filter((q) => q.category_id === activeCat);

            const selectedInBank = questions.filter((q) =>
              selected.has(q.id),
            ).length;

            // Berapa banyak dari filtered yang BELUM terpilih?
            const filteredUnselected = filtered.filter(
              (q) => !selected.has(q.id),
            ).length;
            // Berapa banyak dari filtered yang SUDAH terpilih?
            const filteredSelected = filtered.filter((q) =>
              selected.has(q.id),
            ).length;

            return (
              <div
                key={bank.id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenBank(open ? null : bank.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-start transition hover:bg-neutral-50"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {bank.name}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {fmt(qp.questions_count, questions.length)}
                      </span>
                      {selectedInBank > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {fmt(qp.selected_in_bank, selectedInBank)}
                        </span>
                      ) : null}
                    </div>
                    {bank.description ? (
                      <p className="mt-0.5 truncate text-sm text-neutral-500">
                        {bank.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-2xl text-neutral-400 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {open ? (
                  <div className="space-y-4 border-t border-neutral-200 p-4">
                    {questions.length === 0 ? (
                      <p className="text-center text-sm text-neutral-500">
                        {qp.no_questions}
                      </p>
                    ) : (
                      <>
                        {/* Tombol massal untuk bank */}
                        <div className="flex flex-wrap gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                          <button
                            type="button"
                            onClick={() => selectAllBank(questions)}
                            disabled={selectedInBank === questions.length}
                            className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {qp.select_all_bank}
                          </button>
                          <button
                            type="button"
                            onClick={() => deselectAllBank(questions)}
                            disabled={selectedInBank === 0}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                          >
                            {qp.deselect_all_bank}
                          </button>
                        </div>

                        {/* Filter kategori */}
                        {categories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setFilter(bank.id, "__all__")}
                              className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                                activeCat === "__all__"
                                  ? "border-neutral-900 bg-neutral-900 text-white"
                                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                              }`}
                            >
                              {qp.all} ({questions.length})
                            </button>

                            {categories.map((cat) => {
                              const count = questions.filter(
                                (q) => q.category_id === cat.id,
                              ).length;
                              if (count === 0) return null;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setFilter(bank.id, cat.id)}
                                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                                    activeCat === cat.id
                                      ? "border-violet-600 bg-violet-600 text-white"
                                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                  }`}
                                >
                                  {cat.name} ({count})
                                </button>
                              );
                            })}

                            {(() => {
                              const noneCount = questions.filter(
                                (q) => !q.category_id,
                              ).length;
                              if (noneCount === 0) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setFilter(bank.id, "__none__")}
                                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                                    activeCat === "__none__"
                                      ? "border-amber-600 bg-amber-600 text-white"
                                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                                  }`}
                                >
                                  {qp.none_category} ({noneCount})
                                </button>
                              );
                            })()}
                          </div>
                        ) : null}

                        {/* Tombol massal untuk filter aktif */}
                        {filtered.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                selectAllFiltered(bank.id, questions)
                              }
                              disabled={filteredUnselected === 0}
                              className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                            >
                              {qp.select_all} ({filtered.length})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                deselectAllFiltered(bank.id, questions)
                              }
                              disabled={filteredSelected === 0}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
                            >
                              {qp.deselect_all} ({filteredSelected})
                            </button>
                          </div>
                        ) : null}

                        {/* Daftar soal */}
                        {filtered.length === 0 ? (
                          <p className="rounded-lg bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                            {qp.no_match}
                          </p>
                        ) : (
                          <div className="max-h-96 space-y-2 overflow-auto rounded-lg bg-neutral-50 p-2">
                            {filtered.map((q, idx) => {
                              const isChecked = selected.has(q.id);
                              return (
                                <label
                                  key={q.id}
                                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                                    isChecked
                                      ? "border-violet-300 bg-violet-50"
                                      : "border-neutral-200 bg-white hover:bg-violet-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) =>
                                      toggleQuestion(q.id, e.target.checked)
                                    }
                                    className="mt-1 h-4 w-4 accent-violet-600"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-neutral-900">
                                      {idx + 1}.{" "}
                                      {q.question_text || qp.no_text}
                                    </span>
                                    {q.difficulty ? (
                                      <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                        {difficultyLabel(q.difficulty, qp)}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>

      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="question_id" value={id} />
      ))}
    </div>
  );
}