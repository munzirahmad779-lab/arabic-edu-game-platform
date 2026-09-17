"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayWib, yesterdayWib, toWibTime } from "@/lib/format-wib";

type Row = {
  source: string;
  game_name: string;
  game_mode: string;
  student_name: string;
  final_score: number | null;
  rank_position: number | null;
  correct_count: number;
  total_questions: number;
  recorded_at: string;
};

const AI_PROMPT = `Kamu adalah asisten pendidikan yang ahli menganalisis performa siswa.

Saya akan melampirkan laporan harian dari platform pembelajaran, yang berisi:
- Hasil permainan kompetitif dan kooperatif (dengan timer)
- Hasil latihan mandiri (tanpa timer)

Yang dibutuhkan:
1. Ringkasan umum: jumlah sesi, jumlah siswa, rata-rata performa.
2. Siswa berprestasi: 3 teratas dengan persentasenya.
3. Siswa yang butuh dukungan: yang di bawah 60% dengan rekomendasi.
4. Pola yang terlihat: apakah ada kesulitan di mode tertentu atau topik tertentu?
5. Rekomendasi praktis untuk guru: 3-5 tindakan untuk besok.

Kembalikan hasil dalam bahasa Indonesia yang jelas, dengan paragraf, judul, dan poin-poin bernomor.

---
`;

export function ReportView({
  date,
  roomRows,
  practiceRows,
}: {
  date: string;
  roomRows: Row[];
  practiceRows: Row[];
}) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(date);

  const MODE_AR: Record<string, string> = {
    competitive: "Kompetitif",
    cooperative: "Kooperatif",
    endless: "Tanpa Batas",
    practice: "Latihan",
    learning: "Pembelajaran",
  };

  function buildMarkdown(
    dateStr: string,
    room: Row[],
    practice: Row[],
  ): string {
    const lines: string[] = [];
    lines.push(`# 📊 Laporan Harian — ${dateStr}`);
    lines.push("");
    lines.push(`**Total Sesi:** ${room.length + practice.length}`);
    lines.push(`**Permainan dengan Timer:** ${room.length}`);
    lines.push(`**Latihan Mandiri:** ${practice.length}`);
    lines.push("");

    if (room.length > 0) {
      lines.push("## 🏆 Permainan Kompetitif & Kooperatif");
      lines.push("");
      lines.push(
        "| Permainan | Mode | Siswa | Skor | Peringkat | Benar | Total | Waktu |",
      );
      lines.push(
        "|-----------|------|-------|------|-----------|-------|-------|-------|",
      );
      for (const r of room) {
        lines.push(
          `| ${r.game_name} | ${MODE_AR[r.game_mode] ?? r.game_mode} | ${r.student_name} | ${r.final_score ?? "—"} | ${r.rank_position ?? "—"} | ${r.correct_count} | ${r.total_questions} | ${toWibTime(r.recorded_at)} |`,
        );
      }
      lines.push("");
    }

    if (practice.length > 0) {
      lines.push("## 📖 Latihan Mandiri");
      lines.push("");
      lines.push("| Siswa | Permainan | Mode | Benar | Total | Persen | Waktu |");
      lines.push("|-------|-----------|------|-------|-------|--------|-------|");
      for (const r of practice) {
        const pct =
          r.total_questions > 0
            ? Math.round((r.correct_count / r.total_questions) * 100)
            : 0;
        lines.push(
          `| ${r.student_name} | ${r.game_name} | ${MODE_AR[r.game_mode] ?? r.game_mode} | ${r.correct_count} | ${r.total_questions} | ${pct}% | ${toWibTime(r.recorded_at)} |`,
        );
      }
      lines.push("");
    }

    if (room.length === 0 && practice.length === 0) {
      lines.push("_Tidak ada data untuk hari ini._");
      lines.push("");
    }

    lines.push("---");
    lines.push("_Laporan otomatis dari Magguru_");
    return lines.join("\n");
  }

  const mdText = buildMarkdown(date, roomRows, practiceRows);

  async function copyMd() {
    try {
      await navigator.clipboard.writeText(mdText);
      setCopiedMd(true);
      window.setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyAi() {
    try {
      const full = `${AI_PROMPT}\n${mdText}`;
      await navigator.clipboard.writeText(full);
      setCopiedAi(true);
      window.setTimeout(() => setCopiedAi(false), 2000);
    } catch {
      // ignore
    }
  }

  async function cleanup() {
    if (cleaning) return;
    if (!window.confirm("Hapus semua catatan yang lebih lama dari 7 hari?")) {
      return;
    }

    setCleaning(true);
    setCleanMsg(null);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("cleanup_old_history");
      if (error) {
        setCleanMsg(`Kesalahan: ${error.message}`);
      } else {
        setCleanMsg(`✓ ${data ?? 0} catatan lama dihapus.`);
      }
    } catch {
      setCleanMsg("Gagal terhubung ke server.");
    } finally {
      setCleaning(false);
    }
  }

  function applyQuickDate(newDate: string) {
    setSelectedDate(newDate);
    window.location.href = `/dashboard/reports?date=${newDate}`;
  }

  const today = todayWib();
  const yesterday = yesterdayWib();

  return (
    <div className="space-y-5" dir="ltr">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyQuickDate(today)}
          className={`rounded-xl border-2 px-4 py-2 text-xs font-black transition ${
            date === today
              ? "border-violet-600 bg-violet-600 text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          📅 Hari Ini
        </button>
        <button
          type="button"
          onClick={() => applyQuickDate(yesterday)}
          className={`rounded-xl border-2 px-4 py-2 text-xs font-black transition ${
            date === yesterday
              ? "border-violet-600 bg-violet-600 text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          ⏪ Kemarin
        </button>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
      >
        <div>
          <label
            htmlFor="date"
            className="block text-xs font-bold text-neutral-700"
          >
            Tanggal
          </label>
          <input
            id="date"
            type="date"
            name="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white transition hover:bg-violet-700"
        >
          Tampilkan
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void copyMd()}
          className="rounded-2xl bg-gradient-to-l from-slate-700 to-slate-900 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedMd ? "✓ Tersalin" : "📋 Copy MD"}
        </button>
        <button
          type="button"
          onClick={() => void copyAi()}
          className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedAi ? "✓ Tersalin" : "🤖 Copy MD + Prompt AI"}
        </button>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900">
        <p className="font-black">💡 Cara pakai laporan</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>Copy MD</b> — kalau mau simpan laporan di dokumen (Notion /
            Obsidian / Word).
          </li>
          <li>
            <b>Copy MD + Prompt AI</b> — paste ke ChatGPT / Meta AI, dan
            otomatis menganalisis performa siswa + memberi rekomendasi.
          </li>
        </ul>
      </section>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-neutral-900">
            🏆 Permainan dengan Timer
          </h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {roomRows.length} sesi
          </span>
        </div>

        {roomRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            Tidak ada hasil untuk hari ini.
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Permainan
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Mode
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Siswa
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Skor
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Rank
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Waktu
                  </th>
                </tr>
              </thead>
              <tbody>
                {roomRows.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-bold text-neutral-800">
                      {r.game_name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        {MODE_AR[r.game_mode] ?? r.game_mode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2 font-mono font-black text-emerald-700">
                      {r.final_score ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      #{r.rank_position ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {toWibTime(r.recorded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-neutral-900">
            📖 Latihan Mandiri
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {practiceRows.length} catatan
          </span>
        </div>

        {practiceRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            Tidak ada hasil untuk hari ini.
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Siswa
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Permainan
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Mode
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Benar
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    Persen
                  </th>
                </tr>
              </thead>
              <tbody>
                {practiceRows.map((r, i) => {
                  const pct =
                    r.total_questions > 0
                      ? Math.round(
                          (r.correct_count / r.total_questions) * 100,
                        )
                      : 0;
                  return (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-bold text-neutral-800">
                        {r.student_name}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {r.game_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {MODE_AR[r.game_mode] ?? r.game_mode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-black text-emerald-700">
                        {r.correct_count}/{r.total_questions}
                      </td>
                      <td className="px-3 py-2 font-black text-violet-700">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-red-800">
              🗑️ Hapus Catatan Lama
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              Hapus semua catatan yang lebih lama dari 7 hari (otomatis juga
              setiap hari).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cleanup()}
            disabled={cleaning}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {cleaning ? "..." : "🗑️ Hapus Sekarang"}
          </button>
        </div>
        {cleanMsg ? (
          <p className="mt-2 text-xs font-bold text-red-800">{cleanMsg}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="mb-2 text-xs font-black text-neutral-700">
          Pratinjau Laporan (Markdown)
        </p>
        <pre
          className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-800"
          dir="ltr"
        >
          {mdText}
        </pre>
      </section>
    </div>
  );
}