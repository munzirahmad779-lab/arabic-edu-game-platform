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
  excel_table: "📊 Format Tabel Kolom Excel (Sesuai Template / Copy-Paste Spreadsheet)",
  kahoot: "▲ Kahoot Arena Showdown (4 Pilihan Ganda)",
  millionaire: "💰 Who Wants to Be a Millionaire",
  jeopardy: "🏆 Cerdas Cermat Matriks (5 Kategori)",
  memory_card: "🃏 3D Memory Card Flip (Pasangan Memori)",
  wordle: "🔤 Arabic Wordle / Katla (Tebak 5 Huruf)",
  scramble: "🧩 Word Scramble (Susun Kata Hijaiyah)",
  hangman: "⛄ Manusia Salju Kata (Hangman Tebak Huruf)",
  wheel_fortune: "🎡 Wheel of Fortune (Roda Tantangan)",
  whack_mole: "🔨 Whack-a-Mole (Pukul Tikus Mufrodat)",
  matching_column: "🔗 Drag & Drop Matching Column (Hubungkan Garis)",
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

  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [activeGuideTab, setActiveGuideTab] = useState<"table" | "ai" | "list">("table");
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiProvider, setAiProvider] = useState<"auto" | "groq" | "gemini" | "openrouter" | "cutad">("auto");
  const [generating, setGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  function handleThemeChange(theme: GameThemeId) {
    setSelectedTheme(theme);
    setMdContent(GAME_MD_TEMPLATES[theme]);
    setPreviewRows(null);
    setParseErrors([]);
    setServerError(null);
    setSuccess(null);
  }

  function handleParsePreview(customContent?: string) {
    setServerError(null);
    setSuccess(null);
    const content = customContent || mdContent;
    const { rows, errors } = parseMarkdownToImportRows(content, selectedTheme);
    setParseErrors(errors);
    setPreviewRows(rows.length > 0 ? rows : null);
  }

  async function handleGenerateAi() {
    if (!aiTopic.trim()) {
      setServerError("Harap tuliskan topik soal yang ingin dibuat.");
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

    setSuccess(`✓ Berhasil menambahkan ${result.imported} soal dari template Markdown!`);
    setPreviewRows(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            📝 Input & Pengelolaan Soal via Format Markdown (MD)
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Pilih template game yang sesuai di bawah ini untuk melihat contoh format Markdown, atau gunakan generator AI otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAiGenerator((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black shadow-sm transition ${
            showAiGenerator
              ? "bg-indigo-700 text-white shadow-indigo-200"
              : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
          }`}
        >
          <span>✨</span>
          <span>{showAiGenerator ? "Tutup Generator AI" : "Buat Soal Otomatis (Multi-AI)"}</span>
        </button>
      </div>

      {/* Panduan Interaktif Guru: Cara Memasukkan Soal */}
      <div className="rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-sm text-white">📖</span>
            <div>
              <h4 className="text-sm font-bold text-teal-950">
                Panduan Guru: 3 Cara Mudah Memasukkan Soal
              </h4>
              <p className="text-[11px] text-teal-800/80">
                Pilih metode yang paling nyaman untuk Anda. Tidak perlu lagi upload file Excel rumit!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-50 transition"
          >
            {showGuide ? "Sembunyikan Panduan ▲" : "Buka Panduan ▼"}
          </button>
        </div>

        {showGuide && (
          <div className="mt-3 space-y-3">
            {/* Navigasi Tab Metode */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveGuideTab("table")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeGuideTab === "table"
                    ? "bg-teal-700 text-white shadow"
                    : "bg-white text-teal-900 border border-teal-200 hover:bg-teal-100/50"
                }`}
              >
                <span>📊</span>
                <span>Metode 1: Tabel Excel (Copy-Paste Spreadsheet)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("ai")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeGuideTab === "ai"
                    ? "bg-indigo-700 text-white shadow"
                    : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/50"
                }`}
              >
                <span>✨</span>
                <span>Metode 2: Otomatis via AI (1-Klik)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("list")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeGuideTab === "list"
                    ? "bg-slate-700 text-white shadow"
                    : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100/50"
                }`}
              >
                <span>📝</span>
                <span>Metode 3: Format Daftar Standar (# Soal 1)</span>
              </button>
            </div>

            {/* Konten Tab 1: Format Tabel Excel */}
            {activeGuideTab === "table" && (
              <div className="rounded-xl border border-teal-200 bg-white p-3.5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black uppercase tracking-wider text-teal-900">
                    Format Tabel Kolom (Paling Cocok bagi yang Punya Soal di Excel / Spreadsheet)
                  </h5>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme("excel_table");
                      setMdContent(GAME_MD_TEMPLATES.excel_table);
                      handleParsePreview(GAME_MD_TEMPLATES.excel_table);
                    }}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 underline"
                  >
                    Terapkan Template Tabel ke Editor ➔
                  </button>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Anda tidak perlu lagi menyimpan dan mengunggah file <code>.xlsx</code>. Anda bisa langsung <b>Copy</b> baris soal dari Excel atau Google Sheets, lalu <b>Paste (Ctrl + V)</b> ke editor teks di bawah. Sistem otomatis mendeteksi kolom-kolomnya!
                </p>
                <div className="rounded-lg bg-neutral-900 p-2.5 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-5">
                  <p className="text-neutral-400">// Contoh Format Tabel (Kolom dipisahkan tanda pipa |):</p>
                  <p>| No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan |</p>
                  <p>|---|---|---|---|---|---|---|---|---|</p>
                  <p>| 1 | Apa arti كِتَابٌ ? | Buku | Pena | Meja | Kursi | A | Mufrodat | Mudah |</p>
                  <p>| 2 | Jamak dari طَالِبٌ ? | طُلَّابٌ | طَالِبَاتٌ | مَطَالِبُ | أَطْلَابٌ | A | Nahwu | Sedang |</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-teal-800 bg-teal-50/80 p-2 rounded-lg">
                  <span>💡 <b>Tips Excel:</b> Kunci jawaban cukup tulis hurufnya saja: <code>A</code>, <code>B</code>, <code>C</code>, atau <code>D</code>.</span>
                </div>
              </div>
            )}

            {/* Konten Tab 2: Generator AI */}
            {activeGuideTab === "ai" && (
              <div className="rounded-xl border border-indigo-200 bg-white p-3.5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black uppercase tracking-wider text-indigo-900">
                    Pembuatan Soal Otomatis Berbasis Kecerdasan Buatan (AI)
                  </h5>
                  <button
                    type="button"
                    onClick={() => setShowAiGenerator(true)}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
                  >
                    Buka Panel Generator AI ➔
                  </button>
                </div>
                <ol className="list-decimal space-y-1 pl-4 text-xs text-neutral-700">
                  <li>Klik tombol hijau <b>&quot;✨ Buat Soal Otomatis (Multi-AI)&quot;</b> di atas.</li>
                  <li>Ketik topik / materi Bahasa Arab yang Anda inginkan (misal: <i>Adawatul Madrosiyyah</i> atau <i>Fi&apos;il Madhi</i>).</li>
                  <li>Pilih jumlah soal (5, 10, 15, atau 20) dan tingkat kesulitan.</li>
                  <li>Klik tombol <b>&quot;🚀 Generate Soal Sekarang&quot;</b>. AI secara otomatis menulis kosa kata Arab berharakat rapi dengan opsi jawaban seimbang.</li>
                  <li>Periksa hasil di Pratinjau, lalu klik <b>&quot;💾 Simpan Soal&quot;</b>.</li>
                </ol>
              </div>
            )}

            {/* Konten Tab 3: Format Daftar Standar */}
            {activeGuideTab === "list" && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Format Daftar Catatan Markdown (# Soal)
                  </h5>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme("kahoot");
                      setMdContent(GAME_MD_TEMPLATES.kahoot);
                      handleParsePreview(GAME_MD_TEMPLATES.kahoot);
                    }}
                    className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
                  >
                    Terapkan Template Daftar ke Editor ➔
                  </button>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Menulis seperti mencatat biasa di kertas atau chat. Gunakan tanda <code>[x]</code> di sebelah pilihan yang merupakan kunci jawaban benar.
                </p>
                <div className="rounded-lg bg-neutral-900 p-2.5 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-5">
                  <p># Soal 1: Apa arti dari kata كِتَابٌ ?</p>
                  <p>- A. Buku [x]</p>
                  <p>- B. Pena</p>
                  <p>- C. Meja</p>
                  <p>- D. Kursi</p>
                </div>
              </div>
            )}

            {/* Kotak Aturan Emas Anti-Tumpang Tindih */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 flex items-start gap-2.5">
              <span className="text-base leading-none">🛡️</span>
              <div>
                <span className="font-bold">Pedoman Tata Letak (Anti-Tumpang Tindih di Layar Proyektor & HP Siswa):</span>
                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                  <li><b>Teks Pertanyaan:</b> Idealnya 8–15 kata agar nyaman dibaca dari baris belakang kelas.</li>
                  <li><b>Pilihan Jawaban (A, B, C, D):</b> Cukup 1–3 kata agar tidak bertumpukan di balon, pesawat tempur, maupun tombol buzzer controller siswa.</li>
                  <li><b>Tashkeel / Harakat:</b> Gunakan harakat Arab standar agar terbaca jelas oleh proyektor.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Multi-Provider AI Generator Panel */}
      {showAiGenerator && (
        <div className="space-y-3 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-teal-50/50 p-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">🤖</span>
              <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Generator AI Cerdas (Groq • Gemini • OpenRouter • aicutad)
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
                Provider Mesin AI:
              </label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)}
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs font-medium text-neutral-900"
              >
                <option value="auto">⚡ Otomatis (Failover Groq/Gemini/OpenRouter)</option>
                <option value="groq">Groq (Kilat 60ms - GPT/Qwen)</option>
                <option value="gemini">Google Gemini (Spesialis Harakat Arab)</option>
                <option value="openrouter">OpenRouter (DeepSeek R1 / Nemotron)</option>
                <option value="cutad">aicutad.id (Gateway Lokal)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-indigo-100">
            <span className="text-[11px] text-neutral-500">
              Format otomatis disesuaikan agar tidak tumpang tindih di game manapun.
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
          onClick={() => handleParsePreview()}
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