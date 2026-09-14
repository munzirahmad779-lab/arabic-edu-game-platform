"use client";

import { useState } from "react";
import { createAudioTrack, updateAudioTrack } from "./actions";

type Track = {
  id: string;
  name: string;
  audio_path: string;
  audio_url: string;
  volume: number;
  enabled: boolean;
  pages: string[];
};

type Props = {
  mode: "create" | "edit";
  track?: Track;
  onCancel?: () => void;
};

const PAGE_OPTIONS = [
  { key: "dashboard", label: "لوحة المعلم" },
  { key: "login", label: "صفحة تسجيل الدخول" },
  { key: "student", label: "بوابة الطالب" },
  { key: "game", label: "صفحة اللعبة (الطالب)" },
  { key: "final", label: "صفحة النتيجة النهائية" },
] as const;

const MAX_FILE_MB = 3;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export function AudioTrackForm({ mode, track, onCancel }: Props) {
  const isEdit = mode === "edit" && track;
  const [volume, setVolume] = useState(isEdit ? track.volume : 50);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function checkFile(file: File | null): boolean {
    if (!file) {
      setFileError(isEdit ? null : "الرجاء اختيار ملف صوتي.");
      return false;
    }
    if (!file.type.startsWith("audio/")) {
      setFileError("الملف يجب أن يكون بصيغة صوتية (MP3).");
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setFileError(
        `حجم الملف ${mb} ميجابايت — يجب أن يكون أقل من ${MAX_FILE_MB} ميجابايت. الرجاء ضغط الملف أولاً.`,
      );
      return false;
    }
    setFileError(null);
    return true;
  }

  return (
    <form
      action={async (fd) => {
        const file = fd.get("audio_file");
        const isFileReal = file instanceof File && file.size > 0;
        if (isFileReal && !checkFile(file as File)) {
          return;
        }
        if (!isEdit && !isFileReal) {
          setFileError("الرجاء اختيار ملف صوتي.");
          return;
        }
        setSubmitting(true);
        fd.set("volume", String(volume));
        if (isEdit) {
          await updateAudioTrack(fd);
        } else {
          await createAudioTrack(fd);
        }
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      {isEdit ? <input type="hidden" name="track_id" value={track.id} /> : null}

      <div>
        <label className="block text-sm font-bold text-neutral-800">
          اسم المقطع
        </label>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={isEdit ? track.name : ""}
          placeholder="مثال: موسيقى لوحة المعلم"
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <label className="block text-sm font-bold text-neutral-800">
          🎵 ملف MP3 (الحد الأقصى {MAX_FILE_MB} ميجابايت)
        </label>
        {isEdit ? (
          <p className="mt-1 text-xs text-neutral-500">
            اتركه فارغًا لإبقاء الملف الحالي.
          </p>
        ) : null}
        <input
          type="file"
          name="audio_file"
          accept="audio/mpeg,audio/mp3,audio/*"
          onChange={(e) => checkFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
        />
        {fileError ? (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
            ⚠️ {fileError}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-neutral-500">
          💡 نصيحة: الملفات الكبيرة قد لا تعمل. استخدم موقع ضغط MP3 لتقليل
          الحجم مع الحفاظ على الجودة.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-bold text-neutral-800">
          🔊 مستوى الصوت: {volume}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="mt-2 w-full accent-violet-600"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-bold text-neutral-800">
          📍 أين تعمل هذه الموسيقى؟
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PAGE_OPTIONS.map((opt) => {
            const checked = isEdit ? track.pages.includes(opt.key) : false;
            return (
              <label
                key={opt.key}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
              >
                <input
                  type="checkbox"
                  name="pages"
                  value={opt.key}
                  defaultChecked={checked}
                  className="h-4 w-4 cursor-pointer accent-violet-600"
                />
                <span className="text-sm font-bold text-neutral-700">
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting || Boolean(fileError)}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "..."
            : isEdit
              ? "💾 حفظ التعديلات"
              : "➕ إضافة المقطع"}
        </button>
        {isEdit && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            إلغاء
          </button>
        ) : null}
      </div>
    </form>
  );
}