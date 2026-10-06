"use client";

import { useState } from "react";
import { saveAIQuestions } from "../../actions";

type SectionType = "listening" | "structure" | "reading";

type SectionCount = {
  section_type: string;
  current_count: number;
  target_count: number;
};

type GeneratedQuestion = {
  section_type: SectionType;
  question_number: number;
  passage_ref: string | null;
  audio_ref: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  difficulty: "easy" | "medium" | "hard" | null;
};

type GeneratedPassage = {
  ref_id: string;
  title: string | null;
  content: string;
};

type Mode = "generate" | "structure";

type AIGeneratorDict = {
  progress_section_title: string;
  note_title: string;
  note_1: string;
  note_2: string;
  note_3: string;
  note_4: string;
  tab_generate: string;
  tab_structure: string;
  generate_title: string;
  label_section: string;
  saved_prefix: string;
  label_count: string;
  count_5: string;
  count_10: string;
  count_20: string;
  count_30: string;
  count_40: string;
  reading_hint: string;
  label_difficulty: string;
  diff_easy: string;
  diff_medium: string;
  diff_hard: string;
  diff_mixed: string;
  label_language: string;
  lang_english: string;
  lang_arabic: string;
  label_topic: string;
  topic_placeholder: string;
  structure_title: string;
  structure_desc: string;
  structure_limit_warning: string;
  label_draft: string;
  draft_placeholder: string;
  char_suffix: string;
  btn_loading: string;
  btn_generate: string;
  btn_structure_submit: string;
  provider_prefix: string;
  error_generic: string;
  error_conn: string;
  passages_title: string;
  remove: string;
  passage_title_placeholder: string;
  questions_title: string;
  edit_before_save: string;
  badge_question: string;
  badge_audio: string;
  label_correct: string;
  label_diff: string;
  btn_saving: string;
  btn_save_template: string;
  save_success: string;
  save_success_passages: string;
  error_save: string;
  error_save_generic: string;
  answer_marker_title: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function AIGenerator({
  assessmentId,
  assessmentType,
  sectionCounts,
  dict,
}: {
  assessmentId: string;
  assessmentType: string;
  sectionCounts: SectionCount[];
  dict: AIGeneratorDict;
}) {
  const isToafl = assessmentType === "toafl";
  const isToefl = assessmentType === "toefl_itp";

  const [mode, setMode] = useState<Mode>("generate");
  const [sectionType, setSectionType] = useState<SectionType>("structure");
  const [count, setCount] = useState(10);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [language, setLanguage] = useState<"arabic" | "english">(
    isToafl ? "arabic" : "english",
  );
  const [draft, setDraft] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [passages, setPassages] = useState<GeneratedPassage[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    setPassages([]);
    setQuestions([]);
    setProvider(null);

    try {
      const body =
        mode === "generate"
          ? {
              mode: "generate",
              section_type: sectionType,
              count,
              topic: topic.trim() || null,
              difficulty,
              language,
            }
          : {
              mode: "structure",
              draft: draft.trim(),
              language,
            };

      const res = await fetch("/api/assessments/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        provider?: string;
        passages?: GeneratedPassage[];
        questions?: GeneratedQuestion[];
      };

      if (!json.ok) {
        setError(json.message ?? dict.error_generic);
        return;
      }

      setProvider(json.provider ?? null);
      setPassages(json.passages ?? []);
      setQuestions(json.questions ?? []);
    } catch {
      setError(dict.error_conn);
    } finally {
      setLoading(false);
    }
  }

  function updateQuestion(idx: number, patch: Partial<GeneratedQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function removePassage(refId: string) {
    setPassages((prev) => prev.filter((p) => p.ref_id !== refId));
  }

  function updatePassage(idx: number, patch: Partial<GeneratedPassage>) {
    setPassages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  }

  async function handleSave() {
    if (questions.length === 0) return;
    setSaving(true);
    setSaveMsg(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.set("assessment_id", assessmentId);
      fd.set("payload", JSON.stringify({ passages, questions }));

      const result = await saveAIQuestions(fd);

      if (result?.ok) {
        const totalPassages = result.savedPassages ?? 0;
        const passagesPart =
          totalPassages > 0
            ? fmt(dict.save_success_passages, { n: totalPassages })
            : "";
        setSaveMsg(
          fmt(dict.save_success, {
            q: result.savedQuestions ?? 0,
            passages: passagesPart,
          }),
        );
        setQuestions([]);
        setPassages([]);
      } else {
        setError(result?.message ?? dict.error_save);
      }
    } catch {
      setError(dict.error_save_generic);
    } finally {
      setSaving(false);
    }
  }

  const sectionOptions: Array<{ value: SectionType; label: string }> = [
    {
      value: "listening",
      label: isToafl
        ? "Istima' (Listening)"
        : isToefl
          ? "Listening Comprehension"
          : "Listening",
    },
    {
      value: "structure",
      label: isToafl
        ? "Tarakib wa Qawaid"
        : isToefl
          ? "Structure & Written Expression"
          : "Structure",
    },
    {
      value: "reading",
      label: isToafl
        ? "Qira'ah (Reading)"
        : isToefl
          ? "Reading Comprehension"
          : "Reading",
    },
  ];

  const currentSectionInfo = sectionCounts.find(
    (s) => s.section_type === sectionType,
  );

  return (
    <div className="space-y-6">
      {/* PROGRESS PER SECTION */}
      <section className="grid gap-3 sm:grid-cols-3">
        {sectionCounts.map((s) => {
          const pct =
            s.target_count > 0
              ? Math.round((s.current_count / s.target_count) * 100)
              : 0;
          return (
            <div
              key={s.section_type}
              className="rounded-2xl border border-sage-200/60 bg-white p-4"
            >
              <p className="text-xs font-black uppercase tracking-wider text-terracotta-500">
                {s.section_type}
              </p>
              <p className="mt-2 text-2xl font-black text-teal-700">
                {s.current_count}
                <span className="text-base text-softslate/60">
                  {" "}
                  / {s.target_count}
                </span>
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sage-100">
                <div
                  className="h-full bg-terracotta-500 transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      {/* CATATAN PENTING */}
      <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-50 p-4 text-xs text-terracotta-700">
        <p className="font-black">{dict.note_title}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{dict.note_1}</li>
          <li>{dict.note_2}</li>
          <li>{dict.note_3}</li>
          <li>{dict.note_4}</li>
        </ul>
      </div>

      {/* MODE TABS */}
      <div className="flex gap-2 rounded-full border border-sage-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setMode("generate")}
          className={`flex-1 rounded-full px-5 py-2.5 text-sm font-black transition ${
            mode === "generate"
              ? "bg-terracotta-500 text-white shadow-md"
              : "text-teal-700 hover:bg-sage-50"
          }`}
        >
          {dict.tab_generate}
        </button>
        <button
          type="button"
          onClick={() => setMode("structure")}
          className={`flex-1 rounded-full px-5 py-2.5 text-sm font-black transition ${
            mode === "structure"
              ? "bg-terracotta-500 text-white shadow-md"
              : "text-teal-700 hover:bg-sage-50"
          }`}
        >
          {dict.tab_structure}
        </button>
      </div>

      <section className="aesthetic-card">
        {mode === "generate" ? (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-black text-teal-700">
              {dict.generate_title}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-teal-700">
                  {dict.label_section}
                </label>
                <select
                  value={sectionType}
                  onChange={(e) =>
                    setSectionType(e.target.value as SectionType)
                  }
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  {sectionOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {currentSectionInfo ? (
                  <p className="mt-1 text-xs text-softslate/70">
                    {dict.saved_prefix} {currentSectionInfo.current_count} /{" "}
                    {currentSectionInfo.target_count}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  {dict.label_count}
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value={5}>{dict.count_5}</option>
                  <option value={10}>{dict.count_10}</option>
                  <option value={20}>{dict.count_20}</option>
                  <option value={30}>{dict.count_30}</option>
                  <option value={40}>{dict.count_40}</option>
                </select>
                {sectionType === "reading" ? (
                  <p className="mt-1 text-xs text-terracotta-600">
                    {dict.reading_hint}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  {dict.label_difficulty}
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="easy">{dict.diff_easy}</option>
                  <option value="medium">{dict.diff_medium}</option>
                  <option value="hard">{dict.diff_hard}</option>
                  <option value="mixed">{dict.diff_mixed}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  {dict.label_language}
                </label>
                <select
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as "arabic" | "english")
                  }
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="english">{dict.lang_english}</option>
                  <option value="arabic">{dict.lang_arabic}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-teal-700">
                  {dict.label_topic}
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={300}
                  placeholder={dict.topic_placeholder}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-black text-teal-700">
              {dict.structure_title}
            </h2>
            <p className="text-sm text-softslate/70">
              {dict.structure_desc}
            </p>
            <p className="text-xs text-terracotta-600">
              {dict.structure_limit_warning}
            </p>

            <div>
              <label className="block text-sm font-bold text-teal-700">
                {dict.label_language}
              </label>
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "arabic" | "english")
                }
                className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="english">{dict.lang_english}</option>
                <option value="arabic">{dict.lang_arabic}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-teal-700">
                {dict.label_draft}
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={12}
                maxLength={15000}
                placeholder={dict.draft_placeholder}
                className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 font-mono text-sm leading-7 outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
              />
              <p className="mt-1 text-xs text-softslate/60">
                {draft.length} / 15000 {dict.char_suffix}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || (mode === "structure" && draft.length < 20)}
          className="btn-primary mt-5 w-full disabled:opacity-50"
        >
          {loading
            ? dict.btn_loading
            : mode === "generate"
              ? dict.btn_generate
              : dict.btn_structure_submit}
        </button>

        {provider ? (
          <p className="mt-2 text-center text-xs text-softslate/60">
            {dict.provider_prefix} <b>{provider}</b>
          </p>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}
      </section>

      {passages.length > 0 ? (
        <section className="aesthetic-card">
          <h2 className="font-display text-lg font-black text-teal-700">
            {dict.passages_title} ({passages.length})
          </h2>
          <div className="mt-4 space-y-4">
            {passages.map((p, idx) => (
              <div
                key={p.ref_id}
                className="rounded-2xl border border-sage-200/60 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-black text-terracotta-600">
                    {p.ref_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePassage(p.ref_id)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    {dict.remove}
                  </button>
                </div>
                <input
                  type="text"
                  value={p.title ?? ""}
                  onChange={(e) =>
                    updatePassage(idx, { title: e.target.value })
                  }
                  placeholder={dict.passage_title_placeholder}
                  className="mt-3 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />
                <textarea
                  value={p.content}
                  onChange={(e) =>
                    updatePassage(idx, { content: e.target.value })
                  }
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm leading-7 outline-none focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section className="aesthetic-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-black text-teal-700">
              {dict.questions_title} ({questions.length})
            </h2>
            <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
              {dict.edit_before_save}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {questions.map((q, idx) => (
              <article
                key={idx}
                className="rounded-2xl border border-sage-200/60 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-black text-terracotta-600">
                      {q.section_type}
                    </span>
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-700">
                      {dict.badge_question}
                      {q.question_number}
                    </span>
                    {q.passage_ref ? (
                      <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
                        {q.passage_ref}
                      </span>
                    ) : null}
                    {q.audio_ref ? (
                      <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
                        {dict.badge_audio} {q.audio_ref}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    {dict.remove}
                  </button>
                </div>

                <textarea
                  value={q.question_text}
                  onChange={(e) =>
                    updateQuestion(idx, { question_text: e.target.value })
                  }
                  rows={2}
                  className="mt-3 w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["A", "option_a"],
                      ["B", "option_b"],
                      ["C", "option_c"],
                      ["D", "option_d"],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={label} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(idx, { correct_answer: label })
                        }
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition ${
                          q.correct_answer === label
                            ? "bg-sage-500 text-white"
                            : "bg-sage-100 text-teal-700 hover:bg-sage-200"
                        }`}
                        title={dict.answer_marker_title}
                      >
                        {label}
                      </button>
                      <input
                        type="text"
                        value={q[key]}
                        onChange={(e) =>
                          updateQuestion(idx, { [key]: e.target.value })
                        }
                        className="w-full rounded-xl border border-sage-200 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="font-bold text-teal-700">
                      {dict.label_correct}
                    </span>
                    <select
                      value={q.correct_answer}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          correct_answer: e.target
                            .value as GeneratedQuestion["correct_answer"],
                        })
                      }
                      className="rounded-lg border border-sage-200 bg-white px-2 py-1 text-xs font-black"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="font-bold text-teal-700">
                      {dict.label_diff}
                    </span>
                    <select
                      value={q.difficulty ?? "medium"}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          difficulty: e.target
                            .value as GeneratedQuestion["difficulty"],
                        })
                      }
                      className="rounded-lg border border-sage-200 bg-white px-2 py-1 text-xs font-black"
                    >
                      <option value="easy">{dict.diff_easy}</option>
                      <option value="medium">{dict.diff_medium}</option>
                      <option value="hard">{dict.diff_hard}</option>
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary mt-5 w-full"
          >
            {saving
              ? dict.btn_saving
              : fmt(dict.btn_save_template, { n: questions.length })}
          </button>

          {saveMsg ? (
            <div className="mt-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-bold text-sage-600">
              {saveMsg}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}