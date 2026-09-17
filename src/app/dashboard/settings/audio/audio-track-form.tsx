"use client";

import { useState } from "react";
import { createAudioTrack, updateAudioTrack } from "./actions";
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

type Props = {
  mode: "create" | "edit";
  track?: Track;
  onCancel?: () => void;
  dict: Dict;
};

const MAX_FILE_MB = 3;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export function AudioTrackForm({ mode, track, onCancel, dict }: Props) {
  const t = dict.audio_settings;
  const isEdit = mode === "edit" && track;

  const PAGE_OPTIONS = [
    { key: "dashboard", label: t.page_dashboard },
    { key: "login", label: t.page_login },
    { key: "student", label: t.page_student },
    { key: "game", label: t.page_game },
    { key: "final", label: t.page_final },
  ] as const;

  const [volume, setVolume] = useState(isEdit ? track.volume : 50);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function checkFile(file: File | null): boolean {
    if (!file) {
      setFileError(isEdit ? null : t.form_err_file_required);
      return false;
    }
    if (!file.type.startsWith("audio/")) {
      setFileError(t.form_err_file_type);
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setFileError(
        `${t.form_err_file_size_prefix} ${mb} ${t.form_err_file_size_mid} ${MAX_FILE_MB} ${t.form_err_file_size_suffix}`,
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
          setFileError(t.form_err_file_required);
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
          {t.form_label_name}
        </label>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={isEdit ? track.name : ""}
          placeholder={t.form_placeholder_name}
          className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <label className="block text-sm font-bold text-neutral-800">
          {t.form_label_file} {MAX_FILE_MB} {t.form_label_file_suffix}
        </label>
        {isEdit ? (
          <p className="mt-1 text-xs text-neutral-500">
            {t.form_hint_keep_file}
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
          {t.form_hint_compress}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm font-bold text-neutral-800">
          {t.form_label_volume} {volume}%
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
          {t.form_label_pages}
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
              ? t.form_btn_update
              : t.form_btn_create}
        </button>
        {isEdit && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            {t.form_btn_cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}