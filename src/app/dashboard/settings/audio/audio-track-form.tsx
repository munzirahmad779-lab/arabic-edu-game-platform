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

export function AudioTrackForm({ mode, track, onCancel }: Props) {
  const isEdit = mode === "edit" && track;
  const [volume, setVolume] = useState(isEdit ? track.volume : 50);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (fd) => {
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
          🎵 ملف MP3 (الحد الأقصى 5 ميجابايت)
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
          required={!isEdit}
          className="mt-2 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
        />
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
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
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