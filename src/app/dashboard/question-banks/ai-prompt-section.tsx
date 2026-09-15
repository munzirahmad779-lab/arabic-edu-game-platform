"use client";

import { useState } from "react";

const AI_PROMPT = `أريد مساعدتك في إكمال عمود "Alasan" في قالب أسئلة عربي.
القالب مخصص لمنصة تعليمية لاختبار TOAFL.

تنسيق القالب (14 عمودًا):
No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan | Ada Media? | Jenis Media | Nama Media | Maks. Pemutaran | Alasan

القواعد:
1. عمود "Alasan" يشرح لماذا الإجابة الصحيحة صحيحة (لا يعيد السؤال).
2. الحد الأقصى 5000 حرف.
3. استخدم اللغة العربية الفصحى المبسطة المناسبة لطلاب الثانوية.
4. إذا لم تكن متأكدًا من الإجابة، اكتب "لا يوجد شرح" — لا تخترع.
5. أعد النتيجة في جدول Markdown يمكن نسخه مباشرة إلى Excel.

المهمة:
سألصق أدناه أسئلتي (الأعمدة من No إلى Maks. Pemutaran مملوءة).
املأ عمود Alasan لكل سؤال.

[الصق أسئلتك هنا]`;

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
            🤖 مساعدة الذكاء الاصطناعي لعمود «Alasan»
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            يمكنك كتابة عمود «Alasan» يدويًا، أو استخدام هذا الطلب (Prompt)
            مع ChatGPT / Meta AI / أي مساعد آخر ليكمل العمود نيابة عنك.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          {copied ? "✓ تم النسخ" : "📋 نسخ الطلب"}
        </button>
      </div>

      <details className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold text-emerald-900">
          عرض الطلب كاملاً قبل النسخ
        </summary>
        <pre
          className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-800"
          dir="rtl"
        >
{AI_PROMPT}
        </pre>
      </details>

      <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-sm text-emerald-900">
        <li>انقر «📋 نسخ الطلب» أعلاه.</li>
        <li>
          افتح ChatGPT / Meta AI / أي مساعد، والصق الطلب في المحادثة.
        </li>
        <li>
          الصق أسئلتك (من No حتى Maks. Pemutaran) أسفل الطلب، ثم اطلب من
          المساعد إكمال عمود Alasan.
        </li>
        <li>
          انسخ الجدول الناتج والصقه في ملف Excel في عمود «Alasan»، ثم ارفع
          الملف من قسم الاستيراد أعلاه.
        </li>
      </ol>

      <p className="mt-3 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
        ملاحظة: عمود «Alasan» اختياري. إذا تُرك فارغًا، سيعرض النظام للطالب
        «لا يوجد شرح» عند مراجعة الإجابة.
      </p>
    </section>
  );
}