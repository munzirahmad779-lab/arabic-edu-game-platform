"use client";

import { useState } from "react";

const PROMPT_TABLE = `Kamu adalah pakar pembuat soal kuis pilihan ganda bahasa Arab untuk platform "Magguru".
Tugasmu adalah membuat soal dalam format TABEL MARKDOWN resmi (sesuai template kolom spreadsheet Magguru).

ATURAN KETAT PANJANG TEKS & TATA LETAK:
1. Pertanyaan: Maksimal 8-15 kata (tidak lebih dari 75 karakter) agar nyaman dibaca di layar proyektor dan HP.
2. Pilihan Jawaban (A, B, C, D): Maksimal 1-3 KATA per pilihan (maksimal 20 karakter) agar pas di balon, pesawat tempur, dan papan mini-game.
3. Jawaban Benar: Tulis satu huruf saja (A, B, C, atau D) secara acak seimbang.
4. Tulis kosa kata Arab dengan harakat/tashkeel yang lengkap dan benar.

FORMAT OUTPUT WAJIB (TABEL MARKDOWN):
| No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan |
|---|---|---|---|---|---|---|---|---|
| 1 | Apa arti dari kata كِتَابٌ ? | Buku | Pena | Meja | Kursi | A | Mufrodat | Mudah |
| 2 | Jam'u dari kata طَالِبٌ adalah... | طُلَّابٌ | طَالِبَاتٌ | مَطَالِبُ | أَطْلَابٌ | A | Nahwu | Sedang |
| 3 | Fi'il madhi dari kata "يَكْتُبُ" adalah... | كَتَبَ | كِتَابَةٌ | كَاتِبٌ | اِكْتُبْ | A | Sharaf | Sedang |

[Tulis permintaan Anda di sini: misal 10 soal tentang Peralatan Sekolah / Bab Jamak]`;

const PROMPT_LIST = `Kamu adalah pakar pembuat soal kuis pilihan ganda bahasa Arab untuk platform "Magguru".
Tugasmu adalah membuat soal dalam format DAFTAR MARKDOWN resmi.

ATURAN KETAT PANJANG TEKS & TATA LETAK:
1. Pertanyaan: Maksimal 8-15 kata (tidak lebih dari 75 karakter).
2. Pilihan Jawaban (A, B, C, D): Maksimal 1-3 KATA per pilihan (maksimal 20 karakter).
3. Berikan tanda [x] di samping pilihan yang benar.
4. Tulis kosa kata Arab dengan harakat lengkap.

FORMAT OUTPUT WAJIB (MARKDOWN):
# Soal 1: Apa arti dari kata كِتَابٌ ?
- A. Buku [x]
- B. Pena
- C. Meja
- D. Kursi

# Soal 2: Jam'u dari kata طَالِبٌ adalah...
- A. طُلَّابٌ [x]
- B. طَالِبَاتٌ
- C. مَطَالِبُ
- D. أَطْلَابٌ

[Tulis permintaan Anda di sini: misal 10 soal tentang Al-Mufrodat]`;

export function AiPromptSection() {
  const [selectedFormat, setSelectedFormat] = useState<"table" | "list">("table");
  const [copied, setCopied] = useState(false);

  const activePrompt = selectedFormat === "table" ? PROMPT_TABLE : PROMPT_LIST;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(activePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-emerald-950">
            🤖 Prompt AI Generator Soal Markdown
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Salin prompt di bawah, lalu tempel ke ChatGPT / Claude / asisten AI lain. AI akan menghasilkan soal berformat Markdown yang bisa langsung Anda tempel ke editor tanpa perlu mengunduh atau mengedit file Excel!
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow transition hover:bg-emerald-700"
        >
          {copied ? "✓ Tersalin" : `📋 Copy Prompt (${selectedFormat === "table" ? "Tabel" : "Daftar"})`}
        </button>
      </div>

      {/* Pilihan Format Prompt */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-neutral-700">Pilih Format Prompt:</span>
        <button
          type="button"
          onClick={() => setSelectedFormat("table")}
          className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
            selectedFormat === "table"
              ? "bg-emerald-700 text-white shadow"
              : "bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100"
          }`}
        >
          📊 Format Tabel Kolom (Template Excel)
        </button>
        <button
          type="button"
          onClick={() => setSelectedFormat("list")}
          className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
            selectedFormat === "list"
              ? "bg-emerald-700 text-white shadow"
              : "bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100"
          }`}
        >
          📝 Format Daftar (# Soal 1: ...)
        </button>
      </div>

      <details open className="mt-3 rounded-xl border border-emerald-200 bg-white p-3.5">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-emerald-900">
          Lihat Isi Prompt ({selectedFormat === "table" ? "Format Tabel Kolom" : "Format Daftar"})
        </summary>
        <pre
          className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3.5 font-mono text-xs leading-6 text-emerald-400"
          dir="ltr"
        >
          {activePrompt}
        </pre>
      </details>

      <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-xs text-emerald-900 font-medium">
        <li>Klik tombol <b>&quot;📋 Copy Prompt&quot;</b> di atas.</li>
        <li>Buka ChatGPT / Claude / Gemini / asisten AI favorit Anda, lalu tempel (*paste*) prompt.</li>
        <li>Tuliskan topik yang Anda inginkan (misal: <i>10 soal Mufrodat Sekolah</i>).</li>
        <li>Salin teks yang dihasilkan AI, lalu tempelkan langsung ke editor Bank Soal di bawah.</li>
      </ol>
    </section>
  );
}