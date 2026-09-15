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

const DIFFICULTY_AR: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export function QuestionsPicker({
  banks,
  categories,
  questionsByBank,
}: {
  banks: Bank[];
  categories: Category[];
  questionsByBank: Record<string, Question[]>;
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

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium">اختر الأسئلة</legend>

        {selected.size > 0 ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-800">
            ✓ تم اختيار {selected.size} سؤال
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">
            اضغط على اسم أي بنك لفتحه واختيار الأسئلة منه.
          </p>
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

            return (
              <div
                key={bank.id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenBank(open ? null : bank.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-neutral-50"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {bank.name}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {questions.length} سؤال
                      </span>
                      {selectedInBank > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          ✓ {selectedInBank} مختار
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
                        لا توجد أسئلة في هذا البنك.
                      </p>
                    ) : (
                      <>
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
                              الكل ({questions.length})
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
                                  بدون موضوع ({noneCount})
                                </button>
                              );
                            })()}
                          </div>
                        ) : null}

                        {filtered.length === 0 ? (
                          <p className="rounded-lg bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                            لا توجد أسئلة تطابق الفلتر المحدد.
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
                                      {q.question_text || "(سؤال بلا نص)"}
                                    </span>
                                    {q.difficulty ? (
                                      <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                        {DIFFICULTY_AR[q.difficulty] ??
                                          q.difficulty}
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