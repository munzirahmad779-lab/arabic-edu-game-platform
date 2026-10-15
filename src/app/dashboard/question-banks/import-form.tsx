"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importQuestionBankRows } from "./actions";
import {
  DEFAULT_MAGGURU_TEMPLATE,
  MAGGURU_AI_PROMPT,
  parseMarkdownToImportRows,
} from "@/lib/question-bank/md-parser";
import type { QuestionImportRow } from "@/lib/question-bank/excel";

type ImportDict = {
  file_label?: string;
  file_selected?: string;
  rejected?: string;
  preview_title?: string;
  preview_note?: string;
  th_no?: string;
  th_question?: string;
  th_topic?: string;
  th_difficulty?: string;
  th_media?: string;
  confirm_import?: string;
  importing?: string;
  row_prefix?: string;
  read_fail?: string;
  success?: string;
};

export function QuestionBankImportForm({
  questionBankId,
}: {
  questionBankId: string;
  qi?: ImportDict;
}) {
  const router = useRouter();
  const [mdContent, setMdContent] = useState<string>(DEFAULT_MAGGURU_TEMPLATE);
  const [previewRows, setPreviewRows] = useState<QuestionImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Quick In-App Multi-AI Generator State
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiProvider, setAiProvider] = useState<"auto" | "groq" | "gemini" | "openrouter" | "cutad">("auto");
  const [generating, setGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(MAGGURU_AI_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      // fallback
    }
  }

  function handleParsePreview(customContent?: string) {
    setServerError(null);
    setSuccess(null);
    const content = customContent || mdContent;
    const { rows, errors } = parseMarkdownToImportRows(content);
    setParseErrors(errors);
    setPreviewRows(rows.length > 0 ? rows : null);
  }

  async function handleGenerateAi() {
    if (!aiTopic.trim()) {
      setServerError("Harap tuliskan topik materi soal yang ingin dibuat.");
      return;
    }

    setGenerating(true);
    setServerError(null);
    setAiNotice(null);

    try {
      const res = await fetch("/api/question-banks/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          count: aiCount,
          difficulty: aiDifficulty,
          provider: aiProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setServerError(data.error || "Gagal membuat soal dari AI.");
      } else if (data.markdown) {
        setMdContent(data.markdown);
        setAiNotice(`✓ Berhasil dibuat via ${data.providerUsed} (${data.modelUsed})`);
        handleParsePreview(data.markdown);
      }
    } catch {
      setServerError("Gagal terhubung ke gateway AI.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleImport() {
    if (!previewRows || previewRows.length === 0 || busy || parseErrors.length > 0) {
      return;
    }

    setBusy(true);
    setServerError(null);
    setSuccess(null);

    const result = await importQuestionBankRows(questionBankId, previewRows);

    if (!result.ok) {
      setBusy(false);
      setServerError(result.message);
      return;
    }

    setSuccess(`✓ Berhasil menambahkan ${result.imported} soal ke bank soal!`);
    setPreviewRows(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      {/* Header & Aksi Cepat Salin Prompt */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
            <span>📝</span>
            <span>Tambah & Impor Soal Magguru</span>
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Bisa menambahkan soal berapapun (5, 10, 20, 50 soal). Cukup salin prompt ke AI atau salin tabel spreadsheet Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Utama: Salin Prompt & Format AI */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black shadow-sm transition ${
              copiedPrompt
                ? "bg-emerald-600 text-white shadow-emerald-200"
                : "bg-teal-700 text-white hover:bg-teal-800"
            }`}
          >
            <span>{copiedPrompt ? "✓" : "📋"}</span>
            <span>{copiedPrompt ? "Prompt AI Tersalin!" : "Salin Prompt & Template AI"}</span>
          </button>

          {/* Tombol Alternatif: Buat via AI Internal */}
          <button
            type="button"
            onClick={() => setShowAiGenerator((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              showAiGenerator
                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <span>✨</span>
            <span>{showAiGenerator ? "Tutup AI Internal" : "Buat via AI Internal"}</span>
          </button>

          {/* Tombol Muat Contoh */}
          <button
            type="button"
            onClick={() => {
              setMdContent(DEFAULT_MAGGURU_TEMPLATE);
              handleParsePreview(DEFAULT_MAGGURU_TEMPLATE);
            }}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
          >
            📄 Contoh Soal
          </button>
        </div>
      </div>

      {/* Petunjuk Singkat yang Sangat Jelas */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900 flex items-start gap-2.5">
        <span className="text-base leading-none">💡</span>
        <div className="leading-relaxed">
          <b>Cara Termudah:</b> Klik <b>&quot;📋 Salin Prompt & Template AI&quot;</b> di atas ➔ Tempelkan ke ChatGPT / Claude / Gemini / AI favorit Anda ➔ Minta berapapun jumlah soal yang Anda inginkan ➔ Salin hasilnya dan tempelkan ke kotak di bawah. Sistem Magguru otomatis mengenali format daftar maupun tabel spreadsheet!
        </div>
      </div>

      {/* Generator AI Internal (Opsional jika guru ingin buat langsung di halaman) */}
      {showAiGenerator && (
        <div className="space-y-3 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-teal-50/50 p-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">🤖</span>
              <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Generator AI Internal (Groq • Gemini • OpenRouter • aicutad)
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Auto-Failover Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Topik / Materi Bahasa Arab:
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Misal: Al-Mufrodat Al-Madrosiyyah (Peralatan Sekolah) / Jamak Taksir"
                className="w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-xs font-medium text-neutral-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Jumlah Soal:
              </label>
              <select
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-medium text-neutral-900"
              >
                <option value={5}>5 Soal</option>
                <option value={10}>10 Soal</option>
                <option value={15}>15 Soal</option>
                <option value={20}>20 Soal</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Tingkat Kesulitan:
              </label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value as "easy" | "medium" | "hard")}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-medium text-neutral-900"
              >
                <option value="easy">Mudah (Mufrodat Dasar)</option>
                <option value="medium">Sedang (Kalimat & Terjemah)</option>
                <option value="hard">Sulit (Nahwu & Sharaf)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Mesin AI:
              </label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-medium text-neutral-900"
              >
                <option value="auto">⚡ Otomatis (Failover Cerdas)</option>
                <option value="groq">Groq (Kilat 60ms)</option>
                <option value="gemini">Google Gemini (Harakat Arab)</option>
                <option value="openrouter">OpenRouter (DeepSeek R1 / Nemotron)</option>
                <option value="cutad">aicutad.id (Gateway Lokal)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-indigo-100">
            <span className="text-[11px] text-neutral-500">
              Panjang soal disesuaikan otomatis agar tidak tumpang tindih di game manapun.
            </span>
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={generating || !aiTopic.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-md transition"
            >
              <span>{generating ? "⏳" : "🚀"}</span>
              <span>{generating ? "Menghasilkan Soal..." : "Generate Soal Sekarang"}</span>
            </button>
          </div>

          {aiNotice && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800 font-bold">
              {aiNotice}
            </div>
          )}
        </div>
      )}

      {/* Editor Teks Soal */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
          Kotak Teks Soal (Format Bebas: Daftar Markdown atau Tabel Spreadsheet):
        </label>
        <textarea
          rows={11}
          value={mdContent}
          onChange={(e) => setMdContent(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-neutral-900 p-4 font-mono text-xs sm:text-sm text-emerald-400 placeholder-neutral-500 focus:border-teal-500 focus:outline-none leading-relaxed"
          placeholder="Tempelkan soal dari AI atau tabel spreadsheet Anda di sini..."
        />
      </div>

      {/* Tombol Aksi Parse & Simpan */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleParsePreview()}
          disabled={busy}
          className="rounded-xl bg-neutral-800 px-5 py-2.5 text-xs font-black text-white hover:bg-neutral-900 disabled:opacity-50 shadow transition flex items-center gap-1.5"
        >
          <span>🔍</span>
          <span>Identifikasi & Pratinjau Soal</span>
        </button>

        {previewRows && previewRows.length > 0 && parseErrors.length === 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md transition flex items-center gap-1.5"
          >
            <span>💾</span>
            <span>{busy ? "Menyimpan Soal..." : `Simpan ${previewRows.length} Soal ke Bank Soal`}</span>
          </button>
        )}
      </div>

      {/* Error & Feedback */}
      {parseErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
          <p className="font-bold">❌ Format Soal Belum Terbaca:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {parseErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {serverError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
          ❌ {serverError}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-bold">
          {success}
        </div>
      )}

      {/* Tabel Pratinjau Hasil Identifikasi */}
      {previewRows && previewRows.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800">
              ✓ Berhasil Mengidentifikasi {previewRows.length} Soal:
            </h4>
            <span className="text-[11px] font-bold text-neutral-500">
              Font Arab: Traditional Arabic 16pt
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 font-bold text-neutral-700 sticky top-0">
                <tr>
                  <th className="p-2.5 w-12 text-center">No</th>
                  <th className="p-2.5">Pertanyaan</th>
                  <th className="p-2.5">Pilihan A (Kunci)</th>
                  <th className="p-2.5">Pilihan B</th>
                  <th className="p-2.5">Pilihan C</th>
                  <th className="p-2.5">Pilihan D</th>
                  <th className="p-2.5 w-24">Topik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {previewRows.map((r, i) => (
                  <tr key={i} className="hover:bg-neutral-50">
                    <td className="p-2.5 text-center font-bold text-neutral-600">{r.no}</td>
                    <td
                      className="p-2.5 font-bold text-teal-950 text-base"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {r.question}
                    </td>
                    <td
                      className="p-2.5 font-bold text-emerald-700 text-base bg-emerald-50/50"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {r.options.A} {r.correctOptionKey === "A" ? "✓" : ""}
                    </td>
                    <td
                      className="p-2.5 text-neutral-700 text-base"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {r.options.B} {r.correctOptionKey === "B" ? "✓" : ""}
                    </td>
                    <td
                      className="p-2.5 text-neutral-700 text-base"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {r.options.C} {r.correctOptionKey === "C" ? "✓" : ""}
                    </td>
                    <td
                      className="p-2.5 text-neutral-700 text-base"
                      style={{ fontFamily: "'Traditional Arabic', Amiri, Tahoma, serif" }}
                      dir="auto"
                    >
                      {r.options.D} {r.correctOptionKey === "D" ? "✓" : ""}
                    </td>
                    <td className="p-2.5 text-neutral-500 font-medium">{r.topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}