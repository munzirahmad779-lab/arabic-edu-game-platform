"use client";

import { useMemo, useState } from "react";

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
  const [diffFilterByBank, setDiffFilterByBank] = useState<
    Record<string, "all" | "easy" | "medium" | "hard">
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleQuestion(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setCategoryFilter(bankId: string, catId: string) {
    setFilterByBank((prev) => ({ ...prev, [bankId]: catId }));
  }

  function setDifficultyFilter(
    bankId: string,
    diff: "all" | "easy" | "medium" | "hard",
  ) {
    setDiffFilterByBank((prev) => ({ ...prev, [bankId]: diff }));
  }

  function selectAllInList(questions: Question[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of questions) {
        next.add(q.id);
      }
      return next;
    });
  }

  function deselectAllInList(questions: Question[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const q of questions) {
        next.delete(q.id);
      }
      return next;
    });
  }

  function selectFirstN(questions: Question[], count: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      questions.slice(0, count).forEach((q) => next.add(q.id));
      return next;
    });
  }

  function clearAllSelected() {
    setSelected(new Set());
  }

  // Selected questions breakdown
  const selectedQuestions = useMemo(() => {
    const list: Question[] = [];
    for (const bankQuestions of Object.values(questionsByBank)) {
      for (const q of bankQuestions) {
        if (selected.has(q.id)) list.push(q);
      }
    }
    return list;
  }, [questionsByBank, selected]);

  const diffCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const q of selectedQuestions) {
      if (q.difficulty === "easy") counts.easy++;
      else if (q.difficulty === "medium") counts.medium++;
      else if (q.difficulty === "hard") counts.hard++;
    }
    return counts;
  }, [selectedQuestions]);

  return (
    <div className="space-y-4" dir="rtl">
      <fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-bold text-neutral-900">
            اختر الأسئلة للعبة
          </legend>
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={clearAllSelected}
              className="text-xs font-bold text-rose-600 hover:text-rose-700"
            >
              إلغاء تحديد الكل ({selected.size})
            </button>
          ) : null}
        </div>

        {selected.size > 0 ? (
          <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-black text-violet-900">
                ✓ تم اختيار {selected.size} سؤال
              </span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {diffCounts.easy > 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                    سهل: {diffCounts.easy}
                  </span>
                ) : null}
                {diffCounts.medium > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                    متوسط: {diffCounts.medium}
                  </span>
                ) : null}
                {diffCounts.hard > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-800">
                    صعب: {diffCounts.hard}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">
            اضغط على اسم أي بنك لفتحه، واستخدم الفلاتر والأزرار السريعة لتحديد
            الأسئلة بسهولة.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {banks.map((bank) => {
            const questions = questionsByBank[bank.id] ?? [];
            const open = openBank === bank.id;
            const activeCat = filterByBank[bank.id] ?? "__all__";
            const activeDiff = diffFilterByBank[bank.id] ?? "all";

            const filteredByCat =
              activeCat === "__all__"
                ? questions
                : activeCat === "__none__"
                  ? questions.filter((q) => !q.category_id)
                  : questions.filter((q) => q.category_id === activeCat);

            const filtered =
              activeDiff === "all"
                ? filteredByCat
                : filteredByCat.filter((q) => q.difficulty === activeDiff);

            const selectedInBank = questions.filter((q) =>
              selected.has(q.id),
            ).length;

            return (
              <div
                key={bank.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenBank(open ? null : bank.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-neutral-50"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-neutral-900">
                        {bank.name}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                        {questions.length} سؤال
                      </span>
                      {selectedInBank > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          ✓ {selectedInBank} مختار
                        </span>
                      ) : null}
                    </div>
                    {bank.description ? (
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {bank.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-xl text-neutral-400 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {open ? (
                  <div className="space-y-4 border-t border-neutral-100 bg-neutral-50/50 p-4">
                    {questions.length === 0 ? (
                      <p className="text-center text-sm text-neutral-500">
                        لا توجد أسئلة في هذا البنك.
                      </p>
                    ) : (
                      <>
                        {/* Filters & Categories */}
                        <div className="space-y-3">
                          {/* Categories */}
                          {categories.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-neutral-600">
                                الموضوع:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setCategoryFilter(bank.id, "__all__")
                                }
                                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                                  activeCat === "__all__"
                                    ? "bg-neutral-900 text-white"
                                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
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
                                    onClick={() =>
                                      setCategoryFilter(bank.id, cat.id)
                                    }
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                                      activeCat === cat.id
                                        ? "bg-violet-600 text-white"
                                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
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
                                    onClick={() =>
                                      setCategoryFilter(bank.id, "__none__")
                                    }
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                                      activeCat === "__none__"
                                        ? "bg-amber-600 text-white"
                                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                  >
                                    بدون موضوع ({noneCount})
                                  </button>
                                );
                              })()}
                            </div>
                          ) : null}

                          {/* Difficulty Filter */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-neutral-600">
                              الصعوبة:
                            </span>
                            {(
                              [
                                { key: "all", label: "الكل" },
                                { key: "easy", label: "سهل" },
                                { key: "medium", label: "متوسط" },
                                { key: "hard", label: "صعب" },
                              ] as const
                            ).map((d) => (
                              <button
                                key={d.key}
                                type="button"
                                onClick={() =>
                                  setDifficultyFilter(bank.id, d.key)
                                }
                                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                                  activeDiff === d.key
                                    ? "bg-neutral-800 text-white"
                                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>

                          {/* Quick selection toolbar */}
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2">
                            <span className="text-xs font-bold text-neutral-500">
                              تحديد سريع:
                            </span>
                            <button
                              type="button"
                              onClick={() => selectAllInList(filtered)}
                              className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800 transition hover:bg-violet-200"
                            >
                              تحديد الكل ({filtered.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => deselectAllInList(filtered)}
                              className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100"
                            >
                              إلغاء التحديد
                            </button>
                            {filtered.length >= 5 ? (
                              <button
                                type="button"
                                onClick={() => selectFirstN(filtered, 5)}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                              >
                                أول 5
                              </button>
                            ) : null}
                            {filtered.length >= 10 ? (
                              <button
                                type="button"
                                onClick={() => selectFirstN(filtered, 10)}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                              >
                                أول 10
                              </button>
                            ) : null}
                            {filtered.length >= 20 ? (
                              <button
                                type="button"
                                onClick={() => selectFirstN(filtered, 20)}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                              >
                                أول 20
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {filtered.length === 0 ? (
                          <p className="rounded-xl bg-white p-6 text-center text-sm text-neutral-500">
                            لا توجد أسئلة تطابق الفلاتر المحددة.
                          </p>
                        ) : (
                          <div className="max-h-96 space-y-2 overflow-auto rounded-xl bg-white p-2 border border-neutral-200">
                            {filtered.map((q, idx) => {
                              const isChecked = selected.has(q.id);
                              return (
                                <label
                                  key={q.id}
                                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                    isChecked
                                      ? "border-violet-300 bg-violet-50/60"
                                      : "border-neutral-100 bg-white hover:bg-neutral-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) =>
                                      toggleQuestion(q.id, e.target.checked)
                                    }
                                    className="mt-1 h-4 w-4 rounded accent-violet-600"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-neutral-900">
                                      {idx + 1}.{" "}
                                      {q.question_text || "(سؤال بلا نص)"}
                                    </span>
                                    {q.difficulty ? (
                                      <span
                                        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                          q.difficulty === "easy"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : q.difficulty === "medium"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-rose-100 text-rose-800"
                                        }`}
                                      >
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