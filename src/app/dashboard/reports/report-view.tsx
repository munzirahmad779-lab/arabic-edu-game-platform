"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayWib, yesterdayWib, toWibTime } from "@/lib/format-wib";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

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
  dict,
}: {
  date: string;
  roomRows: Row[];
  practiceRows: Row[];
  dict: Dict;
}) {
  const t = dict.reports;

  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(date);

  const MODE_LABEL: Record<string, string> = {
    competitive: t.mode_competitive,
    cooperative: t.mode_cooperative,
    endless: t.mode_endless,
    practice: t.mode_practice,
    learning: t.mode_learning,
  };

  function buildMarkdown(
    dateStr: string,
    room: Row[],
    practice: Row[],
  ): string {
    const lines: string[] = [];
    lines.push(`${t.md_title} ${dateStr}`);
    lines.push("");
    lines.push(`${t.md_total_sessions} ${room.length + practice.length}`);
    lines.push(`${t.md_timer_games} ${room.length}`);
    lines.push(`${t.md_self_practice} ${practice.length}`);
    lines.push("");

    if (room.length > 0) {
      lines.push(t.md_section_room);
      lines.push("");
      lines.push(
        `| ${t.th_game} | ${t.th_mode} | ${t.th_student} | ${t.th_score} | ${t.th_rank} | ${t.th_correct} | ${t.th_total} | ${t.th_time} |`,
      );
      lines.push("|---|---|---|---|---|---|---|---|");
      for (const r of room) {
        lines.push(
          `| ${r.game_name} | ${MODE_LABEL[r.game_mode] ?? r.game_mode} | ${r.student_name} | ${r.final_score ?? "—"} | ${r.rank_position ?? "—"} | ${r.correct_count} | ${r.total_questions} | ${toWibTime(r.recorded_at)} |`,
        );
      }
      lines.push("");
    }

    if (practice.length > 0) {
      lines.push(t.md_section_practice);
      lines.push("");
      lines.push(
        `| ${t.th_student} | ${t.th_game} | ${t.th_mode} | ${t.th_correct} | ${t.th_total} | ${t.th_percent} | ${t.th_time} |`,
      );
      lines.push("|---|---|---|---|---|---|---|");
      for (const r of practice) {
        const pct =
          r.total_questions > 0
            ? Math.round((r.correct_count / r.total_questions) * 100)
            : 0;
        lines.push(
          `| ${r.student_name} | ${r.game_name} | ${MODE_LABEL[r.game_mode] ?? r.game_mode} | ${r.correct_count} | ${r.total_questions} | ${pct}% | ${toWibTime(r.recorded_at)} |`,
        );
      }
      lines.push("");
    }

    if (room.length === 0 && practice.length === 0) {
      lines.push(t.md_no_data);
      lines.push("");
    }

    lines.push("---");
    lines.push(t.md_footer);
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
    if (!window.confirm(t.cleanup_confirm)) {
      return;
    }

    setCleaning(true);
    setCleanMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("cleanup_old_history");
      if (error) {
        setCleanMsg(`${t.cleanup_error_prefix} ${error.message}`);
      } else {
        setCleanMsg(
          `${t.cleanup_success_prefix} ${data ?? 0} ${t.cleanup_success_suffix}`,
        );
      }
    } catch {
      setCleanMsg(t.cleanup_connect_error);
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
    <div className="space-y-5">
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
          {t.btn_today}
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
          {t.btn_yesterday}
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
            {t.label_date}
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
          {t.btn_show}
        </button>
      </form>

      {/* DIAGNOSTIC KPI CARDS */}
      {(() => {
        const allRows = [...roomRows, ...practiceRows];
        const scores = allRows
          .filter((r) => r.total_questions > 0)
          .map((r) => Math.round((r.correct_count / r.total_questions) * 100));
        const avgAcc = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const struggling = allRows.filter((r) => r.total_questions > 0 && Math.round((r.correct_count / r.total_questions) * 100) < 60);

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-neutral-500">Total Sesi Hari Ini</span>
                <p className="mt-1 font-mono text-3xl font-black text-violet-700">{allRows.length}</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-neutral-500">Rata-rata Akurasi Kelas</span>
                <p className="mt-1 font-mono text-3xl font-black text-emerald-700">{avgAcc}%</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm text-center">
                <span className="text-xs font-bold text-neutral-500">Perlu Bimbingan (&lt;60%)</span>
                <p className="mt-1 font-mono text-3xl font-black text-amber-600">{struggling.length}</p>
              </div>
            </div>

            {struggling.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-black text-sm text-amber-950">Rekomendasi Tindak Lanjut Guru (Intervensi)</p>
                  <p className="mt-0.5 leading-relaxed">
                    Terdapat <strong>{struggling.length} sesi siswa</strong> yang memerlukan penguatan materi. Guru disarankan menugaskan latihan mandiri santai atau mengulang pembahasan sebelum penilaian berikutnya.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from(new Set(struggling.map((s) => s.student_name))).map((name) => (
                      <span key={name} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-bold text-amber-800">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void copyMd()}
          className="rounded-2xl bg-gradient-to-l from-slate-700 to-slate-900 px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedMd ? t.btn_copied : t.btn_copy_md}
        </button>

        <button
          type="button"
          onClick={() => void copyAi()}
          className="rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          {copiedAi ? t.btn_copied : t.btn_copy_ai}
        </button>

        <button
          type="button"
          onClick={() => {
            const allRows = [
              ...roomRows.map((r) => ({
                Tipe: "Room",
                Permainan: r.game_name,
                Siswa: r.student_name,
                Skor: r.final_score ?? 0,
                Peringkat: r.rank_position ?? "-",
                Benar: r.correct_count,
                Total: r.total_questions,
                Akurasi: r.total_questions > 0 ? Math.round((r.correct_count / r.total_questions) * 100) + "%" : "0%",
                Waktu: toWibTime(r.recorded_at),
              })),
              ...practiceRows.map((r) => ({
                Tipe: "Latihan",
                Permainan: r.game_name,
                Siswa: r.student_name,
                Skor: "-",
                Peringkat: "-",
                Benar: r.correct_count,
                Total: r.total_questions,
                Akurasi: r.total_questions > 0 ? Math.round((r.correct_count / r.total_questions) * 100) + "%" : "0%",
                Waktu: toWibTime(r.recorded_at),
              })),
            ];

            if (allRows.length === 0) {
              alert("Tidak ada data untuk diunduh pada tanggal ini.");
              return;
            }

            const headers = Object.keys(allRows[0]!);
            const csvContent =
              "\uFEFF" +
              [
                headers.join(","),
                ...allRows.map((row) =>
                  headers.map((h) => `"${String((row as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`).join(","),
                ),
              ].join("\r\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `magguru-rekap-nilai-${date}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-700 px-4 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
        >
          📥 Unduh Rapor Excel (CSV)
        </button>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900">
        <p className="font-black">{t.help_title}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.help_copy_md}</li>
          <li>{t.help_copy_ai}</li>
          <li>Unduh Rapor Excel — Ekspor rekapan nilai siswa berformat CSV untuk diimpor ke e-Rapor madrasah/sekolah.</li>
        </ul>
      </section>

      <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-neutral-900">
            {t.section_room}
          </h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
            {roomRows.length} {t.count_sessions}
          </span>
        </div>

        {roomRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            {t.empty}
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_game}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_mode}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_student}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_score}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_rank}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_time}
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
                        {MODE_LABEL[r.game_mode] ?? r.game_mode}
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
            {t.section_practice}
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            {practiceRows.length} {t.count_records}
          </span>
        </div>

        {practiceRows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            {t.empty}
          </div>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_student}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_game}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_mode}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_correct}
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-neutral-600">
                    {t.th_percent}
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
                          {MODE_LABEL[r.game_mode] ?? r.game_mode}
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
              {t.cleanup_title}
            </p>
            <p className="mt-0.5 text-xs text-red-700">{t.cleanup_desc}</p>
          </div>
          <button
            type="button"
            onClick={() => void cleanup()}
            disabled={cleaning}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {cleaning ? t.cleanup_btn_loading : t.cleanup_btn}
          </button>
        </div>
        {cleanMsg ? (
          <p className="mt-2 text-xs font-bold text-red-800">{cleanMsg}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="mb-2 text-xs font-black text-neutral-700">
          {t.preview_title}
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