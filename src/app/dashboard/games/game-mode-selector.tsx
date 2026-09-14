"use client";

import { useState } from "react";

type Track = {
  id: string;
  name: string;
};

type Props = {
  tracks: Track[];
};

export function GameModeSelector({ tracks }: Props) {
  const [mode, setMode] = useState("competitive");
  const isTimed =
    mode === "competitive" || mode === "cooperative" || mode === "learning";
  const isSelfPractice = mode === "endless" || mode === "practice";

  return (
    <>
      <div className="lg:col-span-2">
        <label htmlFor="mode" className="block text-sm font-medium">
          وضع اللعبة
        </label>
        <select
          id="mode"
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="competitive">تنافسي — مؤقت لكل سؤال</option>
          <option value="cooperative">
            تعاوني — مؤقت إجمالي (أكمل كل الأسئلة في الوقت المحدد)
          </option>
          <option value="endless">
            بلا نهاية — تدريب ذاتي في بوابة الطالب (بدون وقت)
          </option>
          <option value="practice">
            تمرين — تدريب حسب الموضوع في بوابة الطالب (بدون وقت)
          </option>
        </select>
      </div>

      {isTimed ? (
        <div>
          <label
            htmlFor="duration-minutes"
            className="block text-sm font-medium"
          >
            مدة اللعبة بالدقائق
          </label>
          <input
            id="duration-minutes"
            name="duration_minutes"
            type="number"
            min={1}
            max={60}
            step={1}
            defaultValue={5}
            required
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">
            في الوضع التعاوني: هذه هي المدة الكلية لإكمال كل الأسئلة. في
            الوضع التنافسي: مدة تقريبية للعبة.
          </p>
        </div>
      ) : (
        <>
          <input type="hidden" name="duration_minutes" value="5" />
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            📖 هذا الوضع بدون مؤقت — لا حاجة لتحديد مدة.
          </div>
        </>
      )}

      {isSelfPractice ? (
        <div className="lg:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          ملاحظة: هذا الوضع لا يحتاج غرفة — يتم الوصول إليه من بوابة الطالب
          مباشرة. سيتم إضافته إلى البوابة في التحديث القادم.
        </div>
      ) : null}

      <div className="lg:col-span-2">
        <label
          htmlFor="backsound-track-id"
          className="block text-sm font-medium"
        >
          🎵 موسيقى خلفية خاصة بهذه اللعبة (اختياري)
        </label>
        <select
          id="backsound-track-id"
          name="backsound_track_id"
          defaultValue=""
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">— بدون موسيقى خاصة —</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          {tracks.length === 0
            ? "لا توجد مقاطع محمّلة. اذهب إلى إعدادات الموسيقى لإضافة مقاطع."
            : "سيتم تشغيل هذه الموسيقى أثناء اللعب في هذه اللعبة تحديدًا."}
        </p>
      </div>
    </>
  );
}