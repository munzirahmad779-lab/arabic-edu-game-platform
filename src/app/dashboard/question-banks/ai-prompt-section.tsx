"use client";

import { useState } from "react";

const AI_PROMPT = `أنت مساعد لإعداد أسئلة اختبار TOAFL بصيغة Excel جاهزة للاستيراد.

التنسيق الرسمي للقالب: 14 عمودًا بالترتيب الآتي (يجب أن تكون العناوين مطابقة تمامًا، حرفًا بحرف):
No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan | Ada Media? | Jenis Media | Nama Media | Maks. Pemutaran | Alasan

القواعد الصارمة:
1. الإخراج: جدول Markdown أو TSV (مفصول بـ Tab) — حتى يمكن نسخه مباشرة إلى Excel.
2. عمود "No": رقم متسلسل يبدأ من 1 بدون فراغات.
3. عمود "Pertanyaan": نص السؤال بالعربية.
4. أعمدة Pilihan A/B/C/D: أربعة خيارات، خيار واحد فقط صحيح.
5. عمود "Jawaban Benar": حرف واحد فقط (A أو B أو C أو D).
6. عمود "Topik": موضوع السؤال بالعربية (مثل: النحو، الصرف، البلاغة، المفردات، القراءة).
7. عمود "Tingkat Kesulitan": أحد هذه القيم بالضبط: Mudah / Sedang / Sulit.
8. عمود "Ada Media?": Ya / Tidak.
9. عمود "Jenis Media": إذا Ada Media? = Ya، اكتب: Audio / Gambar / Video. إذا Tidak، اتركه فارغًا.
10. عمود "Nama Media": إذا Ada Media? = Ya، اكتب اسم الملف فقط (مثل: listening_01.mp3). بدون مسار. إذا Tidak، اتركه فارغًا.
11. عمود "Maks. Pemutaran": للـ Audio/Video رقم بين 1 و20. للـ Gambar فارغ. إذا Tidak، فارغ.
12. عمود "Alasan": اشرح بالعربية الفصحى المبسطة لماذا الإجابة الصحيحة صحيحة (2-4 أسطر). إذا لم تكن متأكدًا، اكتب: لا يوجد شرح

مثال صف واحد (TSV):
1	ما وزن كلمة كاتب؟	فاعل	مفعول	فعيل	فعّال	A	الصرف	Mudah	Tidak			الوزن "فاعل" يدل على من قام بالفعل، وكلمة "كاتب" تعني من يكتب.

المهمة:
- سأكتب أدناه عدد الأسئلة والموضوع المطلوب.
- املأ جميع الأعمدة الـ 14 لكل سؤال.
- حافظ على الترقيم المتسلسل.
- أعد النتيجة في جدول واحد فقط، بدون شرح إضافي قبله أو بعده.
- إذا طلبت أسئلة جديدة، اتبع التنسيق أعلاه دائمًا.

[اكتب طلبك هنا: عدد الأسئلة + الموضوع + مستوى الصعوبة المطلوب]`;

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
            🤖 مساعدة الذكاء الاصطناعي لإنشاء الأسئلة
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            انسخ الطلب أدناه والصقه في ChatGPT أو Meta AI أو أي مساعد آخر.
            سيولّد لك جدولًا جاهزًا للاستيراد بعمود «Alasan» مملوء تلقائيًا.
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

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-black">⚠️ قبل استخدام الطلب</p>
        <ul className="mt-1.5 list-disc space-y-1 pr-5">
          <li>
            عمود «Alasan» <b>اختياري</b>. إذا تركه الذكاء الاصطناعي فارغًا
            أو كتب «لا يوجد شرح»، سيظهر للطالب &quot;لا يوجد شرح&quot;
            عند مراجعته.
          </li>
          <li>
            إذا أردت إدخال الأسئلة <b>يدويًا</b>، تخطَّ هذا القسم واملأ القالب
            مباشرة. كل شيء يعمل بدون AI.
          </li>
          <li>
            تأكد من أن الذكاء الاصطناعي استخدم القيم:
            <code className="mx-1 rounded bg-amber-100 px-1">Mudah/Sedang/Sulit</code>
            للصعوبة، و
            <code className="mx-1 rounded bg-amber-100 px-1">Ya/Tidak</code>
            للميديا.
          </li>
        </ul>
      </div>

      <details className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold text-emerald-900">
          عرض الطلب كاملاً قبل النسخ
        </summary>
        <pre
          className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-800"
          dir="rtl"
        >
{AI_PROMPT}
        </pre>
      </details>

      <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-sm text-emerald-900">
        <li>انقر «📋 نسخ الطلب» أعلاه.</li>
        <li>افتح ChatGPT / Meta AI / أي مساعد آخر، والصق الطلب.</li>
        <li>
          في نهاية الطلب، اكتب: عدد الأسئلة + الموضوع + مستوى الصعوبة.
        </li>
        <li>
          انسخ الجدول الناتج، والصقه في Excel في الأعمدة الـ 14.
        </li>
        <li>ارفع الملف من قسم الاستيراد داخل البنك.</li>
      </ol>
    </section>
  );
}