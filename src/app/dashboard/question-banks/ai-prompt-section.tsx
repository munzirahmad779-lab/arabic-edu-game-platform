"use client";

import { useState } from "react";

const AI_PROMPT = `Kamu adalah pakar pembuat soal kuis pilihan ganda bahasa Arab untuk platform "Magguru".
Tugasmu adalah membuat soal dalam format Markdown resmi yang siap langsung disalin tanpa aplikasi tambahan.

ATURAN KETAT PANJANG TEKS & TATA LETAK:
1. Pertanyaan: Maksimal 8-15 kata (tidak lebih dari 75 karakter).
2. Pilihan Jawaban (A, B, C, D): Maksimal 1-3 KATA per pilihan (maksimal 20 karakter).
3. Tepat 4 pilihan (A, B, C, D).
4. Berikan tanda [x] di samping pilihan yang benar.
5. Acak posisi [x] secara seimbang (A, B, C, atau D).
6. Tulis kosa kata Arab dengan harakat yang lengkap dan benar.

FORMAT OUTPUT WAJIB (MARKDOWN):
# Soal 1: Apa arti kata كِتَابٌ ?
- A. Buku [x]
- B. Pena
- C. Meja
- D. Kursi

# Soal 2: Jamak dari kata طَالِبٌ adalah...
- A. طُلَّابٌ [x]
- B. طَالِبَاتٌ
- C. مَطَالِبُ
- D. أَطْلَابٌ

[Tulis permintaanmu di sini: jumlah soal + topik + tingkat kesulitan yang diinginkan]`;

export function AiPromptSection() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
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
          {copied ? "✓ Tersalin" : "📋 Copy Prompt AI"}
        </button>
      </div>

      <details className="mt-4 rounded-xl border border-emerald-200 bg-white p-3.5">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-emerald-900">
          Lihat Isi Prompt Format Markdown
        </summary>
        <pre
          className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3.5 font-mono text-xs leading-6 text-emerald-400"
          dir="ltr"
        >
          {AI_PROMPT}
        </pre>
      </details>

      <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-xs text-emerald-900 font-medium">
        <li>Klik tombol <b>&quot;📋 Copy Prompt AI&quot;</b> di atas.</li>
        <li>Buka ChatGPT / Claude / Gemini / asisten AI favorit Anda, lalu tempel (*paste*) prompt.</li>
        <li>Tuliskan topik yang Anda inginkan (misal: <i>10 soal Mufrodat Sekolah</i>).</li>
        <li>Salin teks Markdown yang dihasilkan, lalu tempelkan langsung ke editor Bank Soal di bawah.</li>
      </ol>
    </section>
  );
}