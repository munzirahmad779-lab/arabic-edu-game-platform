"use client";

import { deleteQuestionBank } from "./actions";

type DeleteDict = {
  button: string;
  title: string;
  confirm_with_questions: string;
  confirm_empty: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function DeleteBankForm({
  bankId,
  bankName,
  questionCount,
  qd,
}: {
  bankId: string;
  bankName: string;
  questionCount: number;
  qd: DeleteDict;
}) {
  return (
    <form action={deleteQuestionBank}>
      <input type="hidden" name="bank_id" value={bankId} />
      <button
        type="submit"
        onClick={(e) => {
          const message =
            questionCount > 0
              ? fmt(qd.confirm_with_questions, {
                  name: bankName,
                  n: questionCount,
                })
              : fmt(qd.confirm_empty, { name: bankName });
          if (!window.confirm(message)) {
            e.preventDefault();
          }
        }}
        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
        title={qd.title}
      >
        {qd.button}
      </button>
    </form>
  );
}