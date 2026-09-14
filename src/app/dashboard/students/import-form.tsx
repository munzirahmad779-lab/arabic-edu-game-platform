"use client";

import { useState } from "react";
import { importStudents } from "./actions";

type ImportResult = { student_name: string; student_pin: string };

export function StudentImportForm({ classId }: { classId: string }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult[] | null>(null);
  const [message, setMessage] = useState<
    { type: "ok" | "err"; text: string } | null
  >(null);

  const names = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  async function handleImport() {
    if (names.length === 0) return;
    setImporting(true);
    setMessage(null);
    setResult(null);

    const res = await importStudents(classId, names);
    setImporting(false);

    if (res.ok) {
      setResult(res.students);
      setMessage({
        type: "ok",
        text: `✓ Berhasil menambahkan ${res.students.length} siswa.`,
      });
      setText("");
    } else {
      setMessage({ type: "err", text: res.message });
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <label
          htmlFor="student-names"
          className="block text-sm font-bold text-neutral-800"
        >
          Tempel daftar nama siswa (satu nama per baris)
        </label>
        <textarea
          id="student-names"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"Ahmad Fauzi\nSiti Aminah\nBudi Santoso\nMuhammad Yusuf"}
          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 font-mono text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          dir="ltr"
        />
        <p className="mt-2 text-xs text-neutral-500">
          <span className="font-bold">{names.length} nama terdeteksi.</span>{" "}
          PIN akan dibuat otomatis dengan format 4 digit berurutan, dimulai dari
          angka setelah siswa terakhir di kelas ini.
        </p>
      </div>

      {message ? (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-3 text-sm font-bold text-emerald-800">
            📋 Daftar nama + PIN siswa yang baru ditambahkan:
          </p>
          <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-emerald-100">
                <tr>
                  <th className="px-3 py-2 text-right font-bold">No</th>
                  <th className="px-3 py-2 text-right font-bold">Nama</th>
                  <th className="px-3 py-2 text-right font-bold">PIN</th>
                </tr>
              </thead>
              <tbody>
                {result.map((r, i) => (
                  <tr key={i} className="border-t border-emerald-100">
                    <td className="px-3 py-2 text-neutral-500">{i + 1}</td>
                    <td className="px-3 py-2 font-bold text-neutral-800">
                      {r.student_name}
                    </td>
                    <td
                      className="px-3 py-2 font-mono font-bold tracking-[0.2em] text-emerald-700"
                      dir="ltr"
                    >
                      {r.student_pin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-emerald-700">
            PIN juga tersimpan di daftar siswa di sebelah kiri, jadi Anda bisa
            melihatnya lagi kapan saja.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleImport}
        disabled={importing || names.length === 0}
        className="w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {importing
          ? "Sedang mengimpor..."
          : `Tambahkan ${names.length} siswa`}
      </button>
    </div>
  );
}