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

export function AIGenerator({
  assessmentId,
  assessmentType,
  sectionCounts,
}: {
  assessmentId: string;
  assessmentType: string;
  sectionCounts: SectionCount[];
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
        setError(json.message ?? "Gagal generate soal.");
        return;
      }

      setProvider(json.provider ?? null);
      setPassages(json.passages ?? []);
      setQuestions(json.questions ?? []);
    } catch {
      setError("Gagal terhubung ke server.");
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
        setSaveMsg(
          `✓ ${result.savedQuestions ?? 0} soal tersimpan${
            totalPassages > 0 ? ` + ${totalPassages} bacaan` : ""
          }. Refresh halaman untuk lihat total.`,
        );
        setQuestions([]);
        setPassages([]);
      } else {
        setError(result?.message ?? "Gagal menyimpan soal.");
      }
    } catch {
      setError("Gagal menyimpan.");
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
        <p className="font-black">
          ⚠️ Catatan: Web tidak bisa generate 140 soal sekaligus
        </p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>
            Generate per batch (maks 40 soal). Setiap batch otomatis tersimpan
            dan bertambah.
          </li>
          <li>Untuk mencapai 140 soal, ulangi generate beberapa kali.</li>
          <li>
            <b>Structure/Listening</b>: 20 soal/batch aman. <b>Reading</b>:
            5-10 soal/batch (soal lebih panjang).
          </li>
          <li>
            Kalau gagal, coba lagi — sistem otomatis ganti provider (NVIDIA →
            LLM7 → OpenRouter → Gemini).
          </li>
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
          🪄 Generate Soal Baru
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
          ✨ Strukturkan Draft
        </button>
      </div>

      <section className="aesthetic-card">
        {mode === "generate" ? (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-black text-teal-700">
              Buat soal baru dengan AI
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-teal-700">
                  Section
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
                    Tersimpan: {currentSectionInfo.current_count} /{" "}
                    {currentSectionInfo.target_count} soal
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  Jumlah soal per batch
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value={5}>5 soal</option>
                  <option value={10}>10 soal</option>
                  <option value={20}>20 soal (aman untuk Structure)</option>
                  <option value={30}>30 soal (perlu waktu lebih lama)</option>
                  <option value={40}>40 soal (maks, sabar)</option>
                </select>
                {sectionType === "reading" ? (
                  <p className="mt-1 text-xs text-terracotta-600">
                    💡 Reading: 5-10 soal per batch lebih aman
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  Kesulitan
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="easy">Mudah</option>
                  <option value="medium">Sedang</option>
                  <option value="hard">Sulit</option>
                  <option value="mixed">Campur</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-teal-700">
                  Bahasa soal
                </label>
                <select
                  value={language}
                  onChange={(e) =>
                    setLanguage(e.target.value as "arabic" | "english")
                  }
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="english">
                    Bahasa Inggris (TOEFL Prediction)
                  </option>
                  <option value="arabic">Bahasa Arab (TOAFL)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-teal-700">
                  Topik (opsional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={300}
                  placeholder="Contoh: Present Perfect, fi'il madhi, daily conversation"
                  className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-black text-teal-700">
              Paste draft soal Anda
            </h2>
            <p className="text-sm text-softslate/70">
              Paste soal-soal Anda dalam bentuk apa pun (berantakan, campur
              bahasa, tidak beraturan). AI akan merapikan dan memisahkan
              otomatis ke section yang tepat.
            </p>
            <p className="text-xs text-terracotta-600">
              ⚠️ Maks 15.000 karakter per batch. Kalau draft lebih panjang,
              bagi jadi beberapa bagian.
            </p>

            <div>
              <label className="block text-sm font-bold text-teal-700">
                Bahasa soal
              </label>
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as "arabic" | "english")
                }
                className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="english">
                  Bahasa Inggris (TOEFL Prediction)
                </option>
                <option value="arabic">Bahasa Arab (TOAFL)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-teal-700">
                Draft soal
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={12}
                maxLength={15000}
                placeholder={`Contoh draft:\n\n1. The teacher ____ the exam yesterday.\nA. correct B. corrected C. correcting D. correction\nJawaban: B\n\n2. What does the woman suggest?\nA. Take a break B. Study harder C. Go home D. Call a friend\nJawaban: A`}
                className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 font-mono text-sm leading-7 outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
              />
              <p className="mt-1 text-xs text-softslate/60">
                {draft.length} / 15000 karakter
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
            ? "⏳ Sedang diproses... (bisa 10-30 detik)"
            : mode === "generate"
              ? "🪄 Generate dengan AI"
              : "✨ Strukturkan Draft"}
        </button>

        {provider ? (
          <p className="mt-2 text-center text-xs text-softslate/60">
            Diproses oleh: <b>{provider}</b>
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
            📖 Bacaan ({passages.length})
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
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  value={p.title ?? ""}
                  onChange={(e) =>
                    updatePassage(idx, { title: e.target.value })
                  }
                  placeholder="Judul bacaan (opsional)"
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
              📝 Soal yang dihasilkan ({questions.length})
            </h2>
            <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
              Edit langsung sebelum simpan
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
                      Soal #{q.question_number}
                    </span>
                    {q.passage_ref ? (
                      <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
                        {q.passage_ref}
                      </span>
                    ) : null}
                    {q.audio_ref ? (
                      <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
                        🎧 {q.audio_ref}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Hapus
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
                        title="Tandai sebagai jawaban benar"
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
                      Jawaban benar:
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
                    <span className="font-bold text-teal-700">Kesulitan:</span>
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
                      <option value="easy">Mudah</option>
                      <option value="medium">Sedang</option>
                      <option value="hard">Sulit</option>
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
              ? "⏳ Menyimpan..."
              : `💾 Simpan ${questions.length} Soal ke Ujian`}
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