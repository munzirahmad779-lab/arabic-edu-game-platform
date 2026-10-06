"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importQuestionBankRows } from "./actions";
import {
  parseQuestionBankWorkbook,
  type QuestionImportPreview,
} from "@/lib/question-bank/excel";

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

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

function formatError(
  error: QuestionImportPreview["errors"][number],
  qi: ImportDict,
) {
  return `${qi.row_prefix} ${error.row} — ${error.field}: ${error.message}`;
}

export function QuestionBankImportForm({
  questionBankId,
  qi,
}: {
  questionBankId: string;
  qi: ImportDict;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setServerError(null);
    setSuccess(null);
    setPreview(null);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const result = await parseQuestionBankWorkbook(file);
      setPreview(result);
    } catch {
      setPreview({
        rows: [],
        errors: [
          {
            row: 1,
            field: "file",
            message: qi.read_fail,
          },
        ],
      });
    }
  }

  async function handleImport() {
    if (
      !preview ||
      preview.errors.length > 0 ||
      preview.rows.length === 0 ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setServerError(null);
    setSuccess(null);

    const result = await importQuestionBankRows(questionBankId, preview.rows);

    if (!result.ok) {
      setBusy(false);
      setServerError(result.message);
      return;
    }

    setSuccess(fmt(qi.success, { n: result.imported }));
    setPreview(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`question-bank-file-${questionBankId}`}
          className="block text-sm font-medium text-neutral-700"
        >
          {qi.file_label}
        </label>
        <input
          ref={inputRef}
          id={`question-bank-file-${questionBankId}`}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void handleFile(event.target.files?.[0])}
          disabled={busy}
          className="mt-2 block w-full text-sm"
        />
      </div>

      {fileName ? (
        <p className="text-sm text-neutral-600">
          {qi.file_selected} <span className="font-medium">{fileName}</span>
        </p>
      ) : null}

      {preview ? (
        <div className="rounded-md border border-neutral-200 p-4">
          {preview.errors.length > 0 ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <p className="font-semibold">{qi.rejected}</p>
              <ul className="mt-2 list-disc space-y-1 pr-5">
                {preview.errors.map((error, index) => (
                  <li key={`${error.row}-${error.field}-${index}`}>
                    {formatError(error, qi)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {fmt(qi.preview_title, { n: preview.rows.length })}
                </p>
                <span className="text-xs text-neutral-500">
                  {qi.preview_note}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="px-3 py-2">{qi.th_no}</th>
                      <th className="px-3 py-2">{qi.th_question}</th>
                      <th className="px-3 py-2">{qi.th_topic}</th>
                      <th className="px-3 py-2">{qi.th_difficulty}</th>
                      <th className="px-3 py-2">{qi.th_media}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.no} className="border-b border-neutral-100">
                        <td className="px-3 py-2">{row.no}</td>
                        <td className="px-3 py-2">{row.question}</td>
                        <td className="px-3 py-2">{row.topic}</td>
                        <td className="px-3 py-2">{row.difficulty}</td>
                        <td className="px-3 py-2">
                          {row.hasMedia ? row.mediaType : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={busy}
                className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? qi.importing : qi.confirm_import}
              </button>
            </>
          )}
        </div>
      ) : null}

      {serverError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {serverError}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}