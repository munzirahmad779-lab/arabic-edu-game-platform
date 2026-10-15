"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importQuestionBankRows } from "./actions";
import {
  GAME_MD_TEMPLATES,
  parseMarkdownToImportRows,
  type GameThemeId,
} from "@/lib/question-bank/md-parser";
import type { QuestionImportRow } from "@/lib/question-bank/excel";

type ImportDict = {
  file_label: string;
  file_selected: string;
  rejected: string;
  preview_title: string;
  preview_note: string;
  th_no: string;
  th_question: string;
  th_topic: string;
  th_difficulty: string;
  th_media: string;
  confirm_import: string;
  importing: string;
  row_prefix: string;
  read_fail: string;
  success: string;
};

const GAME_THEME_LABELS: Record<GameThemeId, string> = {
  kahoot: "Kahoot Arena (4 Pilihan Ganda)",
  millionaire: "Who Wants to Be a Millionaire",
  jeopardy: "Cerdas Cermat Matriks (5 Kategori)",
  memory_card: "3D Memory Card Flip (Pasangan Memori)",
  wordle: "Arabic Wordle / Katla (Tebak 5 Huruf)",
  scramble: "Word Scramble (Susun Kata Hijaiyah)",
  hangman: "Manusia Salju Kata (Hangman Tebak Huruf)",
  wheel_fortune: "Wheel of Fortune (Roda Karnaval)",
  whack_mole: "Whack-a-Mole (Pukul Tikus Mufrodat)",
  matching_column: "Drag & Drop Matching Column (Hubungkan Garis)",
};

export function QuestionBankImportForm({
  questionBankId,
}: {
  questionBankId: string;
  qi?: ImportDict;
}) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState<GameThemeId>("kahoot");
  const [mdContent, setMdContent] = useState<string>(GAME_MD_TEMPLATES.kahoot);
  const [previewRows, setPreviewRows] = useState<QuestionImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleThemeChange(theme: GameThemeId) {
    setSelectedTheme(theme);
    setMdContent(GAME_MD_TEMPLATES[theme]);
    setPreviewRows(null);
    setParseErrors([]);
    setServerError(null);
    setSuccess(null);
  }

  function handleParsePreview() {
    setServerError(null);
    setSuccess(null);
    const { rows, errors } = parseMarkdownToImportRows(mdContent, selectedTheme);
    setParseErrors(errors);
    setPreviewRows(rows.length > 0 ? rows : null);
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

    setSuccess(`✓ Berhasil menambahkan ${result.imported} soal dari template Markdown!`);
    setPreviewRows(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-base font-bold text-neutral-900">
          📝 Input & Pengelolaan Soal via Format Markdown (MD)
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Pilih template game yang sesuai di bawah ini untuk melihat contoh format Markdown, lalu edit teks soal secara langsung tanpa perlu upload file.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
          Pilih Template Game Pembelajaran:
        </label>
        <select
          value={selectedTheme}
          onChange={(e) => handleThemeChange(e.target.value as GameThemeId)}
          className="w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm font-medium text-neutral-900 focus:border-indigo-500 focus:bg-white"
        >
          {Object.entries(GAME_THEME_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
          Editor Teks Markdown Soal ({selectedTheme}):
        </label>
        <textarea
          rows={10}
          value={mdContent}
          onChange={(e) => setMdContent(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-neutral-900 p-3.5 font-mono text-xs text-emerald-400 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
          placeholder="Tuliskan format Markdown soal di sini..."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleParsePreview}
          disabled={busy}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-900 disabled:opacity-50"
        >
          🔍 Pratinjau & Parse Soal MD
        </button>

        {previewRows && previewRows.length > 0 && parseErrors.length === 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Menyimpan Soal..." : `💾 Simpan ${previewRows.length} Soal ke Bank Soal`}
          </button>
        )}
      </div>

      {parseErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-bold">❌ Error Format Markdown:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {parseErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {serverError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
          ❌ {serverError}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-bold">
          {success}
        </div>
      )}

      {previewRows && previewRows.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Hasil Pratinjau Soal ({previewRows.length} Soal Terbaca):
          </h4>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 font-bold text-neutral-700">
                <tr>
                  <th className="p-2">No</th>
                  <th className="p-2">Pertanyaan / Kata</th>
                  <th className="p-2">Pilihan A (Jawaban)</th>
                  <th className="p-2">Pilihan B</th>
                  <th className="p-2">Topik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {previewRows.map((r, i) => (
                  <tr key={i} className="hover:bg-neutral-50">
                    <td className="p-2 font-bold">{r.no}</td>
                    <td className="p-2" dir="auto">{r.question}</td>
                    <td className="p-2 font-medium text-emerald-700" dir="auto">{r.options.A}</td>
                    <td className="p-2 text-neutral-500" dir="auto">{r.options.B}</td>
                    <td className="p-2 text-neutral-600">{r.topic}</td>
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