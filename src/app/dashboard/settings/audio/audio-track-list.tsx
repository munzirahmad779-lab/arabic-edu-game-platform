"use client";

import { useState } from "react";
import { deleteAudioTrack, toggleAudioTrack } from "./actions";
import { AudioTrackForm } from "./audio-track-form";

type Track = {
  id: string;
  name: string;
  audio_path: string;
  audio_url: string;
  volume: number;
  enabled: boolean;
  pages: string[];
};

const PAGE_LABEL: Record<string, string> = {
  dashboard: "لوحة المعلم",
  login: "تسجيل الدخول",
  student: "بوابة الطالب",
  game: "اللعبة",
  final: "النتيجة النهائية",
};

export function AudioTrackList({ tracks }: { tracks: Track[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <div className="text-4xl">🎵</div>
        <p className="mt-3 font-bold text-neutral-700">
          لم تضف أي مقطع بعد
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          استخدم النموذج أعلاه لإضافة أول مقطع موسيقى.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tracks.map((track) => {
        const editing = editingId === track.id;
        return (
          <div
            key={track.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4"
          >
            {editing ? (
              <AudioTrackForm
                mode="edit"
                track={track}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-neutral-900">
                        {track.name}
                      </span>
                      {track.enabled ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          مفعّل
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          معطّل
                        </span>
                      )}
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                        🔊 {track.volume}%
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {track.pages.map((p) => (
                        <span
                          key={p}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {PAGE_LABEL[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewUrl(
                          previewUrl === track.audio_url
                            ? null
                            : track.audio_url,
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {previewUrl === track.audio_url ? "إيقاف" : "استماع"}
                    </button>

                    <form action={toggleAudioTrack}>
                      <input type="hidden" name="track_id" value={track.id} />
                      <input
                        type="hidden"
                        name="current_enabled"
                        value={track.enabled ? "true" : "false"}
                      />
                      <button
                        type="submit"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                          track.enabled
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {track.enabled ? "إيقاف" : "تشغيل"}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setEditingId(track.id)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      تعديل
                    </button>

                    <form
                      action={deleteAudioTrack}
                      onSubmit={(e) => {
                        if (!window.confirm(`حذف "${track.name}"؟`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="track_id" value={track.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        حذف
                      </button>
                    </form>
                  </div>
                </div>

                {previewUrl === track.audio_url ? (
                  <audio
                    src={track.audio_url}
                    controls
                    autoPlay
                    className="w-full"
                  />
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}