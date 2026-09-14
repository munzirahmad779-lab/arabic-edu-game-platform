"use client";

import { deleteQuestionBank } from "./actions";

export function DeleteBankForm({
  bankId,
  bankName,
  questionCount,
}: {
  bankId: string;
  bankName: string;
  questionCount: number;
}) {
  return (
    <form action={deleteQuestionBank}>
      <input type="hidden" name="bank_id" value={bankId} />
      <button
        type="submit"
        onClick={(e) => {
          const message =
            questionCount > 0
              ? `هل أنت متأكد من حذف "${bankName}"؟\nسيتم حذف ${questionCount} سؤالًا مع كل بياناتها (الخيارات، الوسائط، والإجابات المرتبطة بها).\nلا يمكن التراجع.`
              : `هل أنت متأكد من حذف "${bankName}"؟`;
          if (!window.confirm(message)) {
            e.preventDefault();
          }
        }}
        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
        title="حذف بنك الأسئلة"
      >
        🗑️ حذف البنك
      </button>
    </form>
  );
}