"use client";

import { useState } from "react";
import {
  parseStudentWorkbook,
  type StudentImportPreview,
} from "@/lib/student/excel";
import { importStudents } from "./actions";

export function StudentImportForm({ classId }: { classId: string }) {
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<
    { type: "ok" | "err"; text: string } | null
  >(null);

  async function handleFile(file: File) {
    setMessage(null);
    setFileName(file.name);
    const result = await parseStudentWorkbook(file);
    setPreview(result);
  }

  async function handleImport() {
    if (!preview) return;
    if (preview.errors.length > 0) return;
    if (preview.rows.length === 0) return;

    setImporting(true);
    const res = await importStudents(classId, preview.rows);
    setImporting(false);

    if (res.ok) {
      setMessage({
        type: "ok",
        text: `تم استيراد ${res.imported} طالبًا بنجاح.`,
      });
      setPreview(null);
      setFileName("");
      // Refresh data
      window.location.reload();
    } else {
      setMessage({ type: "err", text: res.message });
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-5 text-center">
        <div className="text-4xl">📥</div>
        <p className="mt-2 text-sm font-bold text-neutral-700">
          ارفع ملف Excel (.xlsx)
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          الأعمدة المطلوبة بالترتيب: <span dir="ltr">No | Nama | PIN</span>
        </p>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="mt-4 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
        />
        {fileName ? (
          <p className="mt-2 text-xs text-neutral-500">
            الملف: <span className="font-bold">{fileName}</span>
          </p>
        ) : null}
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

      {preview ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          {preview.errors.length > 0 ? (
            <>
              <p className="mb-3 text-sm font-bold text-red-700">
                ❌ وجدنا {preview.errors.length} خطأ. لم يتم حفظ أي شيء.
              </p>
              <ul className="max-h-64 space-y-1.5 overflow-auto rounded-lg bg-red-50 p-3 text-xs">
                {preview.errors.map((err, i) => (
                  <li key={i} className="text-red-800">
                    <span className="font-bold">صف {err.row}</span> —{" "}
                    <span className="font-bold">{err.field}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm font-bold text-emerald-700">
                ✓ {preview.rows.length} طالبًا جاهزًا للاستيراد
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-100">
                    <tr>
                      <th className="px-3 py-2 text-right font-bold">No</th>
                      <th className="px-3 py-2 text-right font-bold">الاسم</th>
                      <th className="px-3 py-2 text-right font-bold">PIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.no} className="border-t border-neutral-100">
                        <td className="px-3 py-2 text-neutral-500">{r.no}</td>
                        <td className="px-3 py-2 font-bold text-neutral-800">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 tracking-[0.2em] text-neutral-600" dir="ltr">
                          {r.pin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="mt-4 w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing
                  ? "جاري الاستيراد..."
                  : `استيراد ${preview.rows.length} طالبًا`}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}