"use client";

import { useState } from "react";

const AI_PROMPT = `Kamu adalah asisten untuk membuat soal pilihan ganda (MCQ) dalam format Excel siap impor.

Format template resmi: 14 kolom dengan urutan berikut (judul kolom HARUS sama persis):
No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan | Ada Media? | Jenis Media | Nama Media | Maks. Pemutaran | Alasan

Aturan ketat:
1. Output: tabel Markdown atau TSV (dipisah Tab) — supaya bisa langsung di-copy ke Excel.
2. Kolom "No": nomor urut mulai dari 1, tanpa lompatan.
3. Kolom "Pertanyaan": teks soal dalam bahasa Arab.
4. Kolom Pilihan A/B/C/D: empat pilihan, hanya satu yang benar.
5. Kolom "Jawaban Benar": satu huruf saja (A, B, C, atau D).
6. Kolom "Topik": nama topik dalam bahasa Arab (misal: النحو، الصرف، البلاغة، المفردات، القراءة).
7. Kolom "Tingkat Kesulitan": salah satu dari: Mudah / Sedang / Sulit.
8. Kolom "Ada Media?": Ya / Tidak.
9. Kolom "Jenis Media": kalau Ada Media? = Ya, tulis: Audio / Gambar / Video. Kalau Tidak, kosongkan.
10. Kolom "Nama Media": kalau Ada Media? = Ya, tulis nama file saja (misal: listening_01.mp3). Tanpa path. Kalau Tidak, kosongkan.
11. Kolom "Maks. Pemutaran": untuk Audio/Video angka 1-20. Untuk Gambar kosong. Kalau Tidak, kosong.
12. Kolom "Alasan": jelaskan dalam bahasa Arab fusha sederhana mengapa jawaban benar (2-4 baris). Kalau tidak yakin, tulis: لا يوجد شرح

Contoh satu baris (TSV):
1	ما وزن كلمة كاتب؟	فاعل	مفعول	فعيل	فعّال	A	الصرف	Mudah	Tidak			الوزن "فاعل" يدل على من قام بالفعل، وكلمة "كاتب" تعني من يكتب.

Tugas:
- Saya akan menulis jumlah soal dan topik yang diminta di bawah.
- Isi semua 14 kolom untuk setiap soal.
- Pertahankan penomoran berurutan.
- Kembalikan hasil dalam satu tabel saja, tanpa penjelasan tambahan sebelum atau sesudahnya.
- Jika saya minta soal baru, selalu ikuti format di atas.

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
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            🤖 Bantuan AI untuk Membuat Soal
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Copy prompt di bawah, lalu paste ke ChatGPT / Meta AI / asisten AI
            lain. AI akan menghasilkan tabel siap impor dengan kolom
            &quot;Alasan&quot; yang sudah terisi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          {copied ? "✓ Tersalin" : "📋 Copy Prompt"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-black">⚠️ Sebelum memakai prompt</p>
        <ul className="mt-1.5 list-disc space-y-1 pr-5">
          <li>
            Kolom &quot;Alasan&quot; <b>opsional</b>. Kalau AI mengosongkan
            atau menulis &quot;لا يوجد شرح&quot;, siswa akan melihat
            &quot;Tidak ada penjelasan&quot; saat review.
          </li>
          <li>
            Kalau mau isi soal <b>manual</b>, lewati bagian ini dan isi
            template langsung. Semua tetap berfungsi tanpa AI.
          </li>
          <li>
            Pastikan AI memakai nilai:{" "}
            <code className="mx-1 rounded bg-amber-100 px-1">
              Mudah/Sedang/Sulit
            </code>{" "}
            untuk kesulitan, dan{" "}
            <code className="mx-1 rounded bg-amber-100 px-1">Ya/Tidak</code>{" "}
            untuk media.
          </li>
        </ul>
      </div>

      <details className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold text-emerald-900">
          Lihat prompt lengkap sebelum copy
        </summary>
        <pre
          className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-800"
          dir="ltr"
        >
          {AI_PROMPT}
        </pre>
      </details>

      <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-sm text-emerald-900">
        <li>Klik &quot;📋 Copy Prompt&quot; di atas.</li>
        <li>
          Buka ChatGPT / Meta AI / asisten AI lain, lalu paste prompt.
        </li>
        <li>
          Di akhir prompt, tulis: jumlah soal + topik + tingkat kesulitan.
        </li>
        <li>Copy tabel hasilnya, lalu paste ke Excel di 14 kolom.</li>
        <li>Upload file di bagian impor di dalam bank.</li>
      </ol>
    </section>
  );
}