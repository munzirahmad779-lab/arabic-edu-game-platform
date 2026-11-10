"use client";

import { useRef, useState } from "react";
import { deleteAudioTrack, toggleAudioTrack } from "./actions";
import { AudioTrackForm } from "./audio-track-form";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

type Track = {
  id: string;
  name: string;
  audio_path: string;
  audio_url: string;
  volume: number;
  enabled: boolean;
  pages: string[];
};

export function AudioTrackList({
  tracks,
  dict,
}: {
  tracks: Track[];
  dict: Dict;
}) {
  const t = dict.audio_settings;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Konfirmasi hapus memakai modal di dalam halaman, BUKAN window.confirm:
  // dialog bawaan browser bisa tidak pernah sampai ke pengguna (webview/
  // otomasi menelannya diam-diam), sehingga klik berhenti di
  // e.preventDefault() sebelum form terkirim dan tombol tampak mati.
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState(false);

  const PAGE_LABEL: Record<string, string> = {
    dashboard: t.page_dashboard,
    login: t.page_login,
    student: t.page_student,
    game: t.page_game,
    final: t.page_final,
  };

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <div className="text-4xl">🎵</div>
        <p className="mt-3 font-bold text-neutral-700">
          {t.list_empty_title}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {t.list_empty_desc}
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
                dict={dict as never}
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
                          {t.list_status_enabled}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          {t.list_status_disabled}
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
                      {previewUrl === track.audio_url
                        ? t.list_btn_stop
                        : t.list_btn_listen}
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
                        {track.enabled
                          ? t.list_btn_disable
                          : t.list_btn_enable}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setEditingId(track.id)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      {t.list_btn_edit}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingDelete(track)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      {t.list_btn_delete}
                    </button>
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

      <form ref={deleteFormRef} action={deleteAudioTrack} className="hidden">
        <input
          type="hidden"
          name="track_id"
          value={pendingDelete?.id ?? ""}
        />
      </form>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-neutral-800">
              {`${t.list_confirm_delete_prefix} "${pendingDelete.name}"${t.list_confirm_delete_suffix}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(true);
                  deleteFormRef.current?.requestSubmit();
                }}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {t.list_btn_delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}