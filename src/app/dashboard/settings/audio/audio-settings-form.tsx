"use client";

import { useState } from "react";
import { saveAudioSettings } from "./actions";

type Settings = {
  enabled: boolean;
  audio_path: string | null;
  audio_url: string | null;
  volume: number;
  play_on_dashboard: boolean;
  play_on_login: boolean;
  play_on_student: boolean;
  play_on_game: boolean;
  play_on_final: boolean;
};

export function AudioSettingsForm({ initial }: { initial: Settings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [volume, setVolume] = useState(initial.volume);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasExisting = Boolean(initial.audio_url) && !removeAudio;

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        if (removeAudio) fd.set("remove_audio", "on");
        await saveAudioSettings(fd);
        setSubmitting(false);
      }}
      className="space-y-6"
    >
      <input type="hidden" name="volume" value={volume} />

      {/* Enabled */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 cursor-pointer accent-violet-600"
          />
          <span className="font-black text-neutral-900">
            تفعيل الموسيقى الخلفية
          </span>
        </label>
        <p className="mt-2 pr-8 text-xs text-neutral-500">
          عند التفعيل، سيتم تشغيل الموسيقى في الصفحات المحددة أدناه.
        </p>
      </div>

      {/* Audio file */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-black text-neutral-800">
          🎵 ملف الموسيقى (MP3، الحد الأقصى 3 ميجابايت)
        </label>

        {hasExisting ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            <span>✓ يوجد ملف محمّل حالياً</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-emerald-700 hover:bg-emerald-100"
              >
                {preview ? "إيقاف" : "استماع"}
              </button>
              <button
                type="button"
                onClick={() => setRemoveAudio(true)}
                className="rounded-lg border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50"
              >
                حذف
              </button>
            </div>
          </div>
        ) : null}

        {preview && initial.audio_url ? (
          <audio
            src={initial.audio_url}
            controls
            autoPlay
            className="mt-3 w-full"
          />
        ) : null}

        {removeAudio ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
            سيتم حذف الملف عند الحفظ.
          </div>
        ) : null}

        <input
          type="file"
          name="audio_file"
          accept="audio/mpeg,audio/mp3,audio/*"
          className="mt-3 block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-violet-700"
        />
      </div>

      {/* Volume */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-black text-neutral-800">
          🔊 مستوى الصوت: {volume}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="mt-3 w-full accent-violet-600"
        />
      </div>

      {/* Pages */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-black text-neutral-800">
          📍 الصفحات التي تعمل فيها الموسيقى
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["play_on_dashboard", "لوحة المعلم", initial.play_on_dashboard],
              ["play_on_login", "صفحة تسجيل الدخول", initial.play_on_login],
              ["play_on_student", "بوابة الطالب", initial.play_on_student],
              ["play_on_game", "صفحة اللعبة (الطالب)", initial.play_on_game],
              ["play_on_final", "صفحة النتيجة النهائية", initial.play_on_final],
            ] as const
          ).map(([name, label, checked]) => (
            <label
              key={name}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
            >
              <input
                type="checkbox"
                name={name}
                defaultChecked={checked}
                className="h-4 w-4 cursor-pointer accent-violet-600"
              />
              <span className="text-sm font-bold text-neutral-700">
                {label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          ملاحظة: صفحة «بنك الأسئلة» و«قراءة المواد» لا تعمل فيها الموسيقى
          دائمًا لضمان التركيز.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "جاري الحفظ..." : "💾 حفظ الإعدادات"}
      </button>
    </form>
  );
}