"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MediaType = "audio" | "image" | "video";

type Media = {
  id: string;
  question_id: string;
  media_type: MediaType;
  expected_filename: string;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  max_play_count: number | null;
  attached_at: string | null;
};

type MediaDict = {
  title: string;
  empty: string;
  hint: string;
  play_limit: string;
  attached: string;
  waiting_upload: string;
  upload_aria: string;
  delete_media: string;
  remove_confirm: string;
  unsupported_type: string;
  invalid_size: string;
  no_config: string;
  upload_failed: string;
  meta_failed: string;
  upload_success: string;
  file_delete_failed: string;
  meta_delete_failed: string;
  delete_success: string;
  preview_private_na: string;
  preview_private_fail: string;
  preview_config_na: string;
  preview_playback_fail: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

const LIMITS: Record<MediaType, number> = {
  audio: 10 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

const MIME_TYPES: Record<MediaType, string[]> = {
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
  ],
  image: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ],
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
};

function formatBytes(value: number | null) {
  if (!value) return "";
  return `${(value / 1024 / 1024).toFixed(value < 1024 * 1024 ? 2 : 1)} MB`;
}

export function QuestionMediaManager({
  questionId,
  media,
  qm,
}: {
  questionId: string;
  media: Media[];
  qm: MediaDict;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    const attached = media.filter((item) => item.storage_path);

    if (!attached.length) return;

    try {
      const supabase = createClient();

      Promise.all(
        attached.map(async (item) => {
          const { data, error } = await supabase.storage
            .from("question-media")
            .createSignedUrl(item.storage_path!, 60 * 10);

          return [item.id, error ? error.message : data.signedUrl] as const;
        }),
      )
        .then((entries) => {
          if (cancelled) return;

          const nextUrls: Record<string, string> = {};
          const nextErrors: Record<string, string> = {};

          for (const [id, result] of entries) {
            if (result.startsWith("http")) {
              nextUrls[id] = result;
            } else {
              nextErrors[id] = fmt(qm.preview_private_na, { msg: result });
            }
          }

          setUrls(nextUrls);
          setPreviewErrors(nextErrors);
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewErrors(
              Object.fromEntries(
                attached.map((item) => [
                  item.id,
                  qm.preview_private_fail,
                ]),
              ),
            );
          }
        });
    } catch {
      setPreviewErrors(
        Object.fromEntries(
          attached.map((item) => [item.id, qm.preview_config_na]),
        ),
      );
    }

    return () => {
      cancelled = true;
    };
  }, [media, qm.preview_private_fail, qm.preview_private_na, qm.preview_config_na]);

  function markPreviewError(mediaId: string) {
    setPreviewErrors((current) => ({
      ...current,
      [mediaId]: qm.preview_playback_fail,
    }));
  }

  async function upload(item: Media, file: File | undefined) {
    if (!file || busyId) return;

    setMessage(null);

    if (!MIME_TYPES[item.media_type].includes(file.type)) {
      setMessage(qm.unsupported_type);
      return;
    }

    if (file.size < 1 || file.size > LIMITS[item.media_type]) {
      setMessage(
        fmt(qm.invalid_size, { max: formatBytes(LIMITS[item.media_type]) }),
      );
      return;
    }

    setBusyId(item.id);

    let supabase;

    try {
      supabase = createClient();
    } catch {
      setBusyId(null);
      setMessage(qm.no_config);
      return;
    }

    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : "";

    const storagePath = `${questionId}/${item.id}/media${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("question-media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      setBusyId(null);
      setMessage(fmt(qm.upload_failed, { msg: uploadError.message }));
      return;
    }

    const { error: metadataError } = await supabase
      .from("question_media")
      .update({
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        attached_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("question_id", questionId);

    setBusyId(null);

    if (metadataError) {
      setMessage(fmt(qm.meta_failed, { msg: metadataError.message }));
      return;
    }

    setMessage(qm.upload_success);
    window.location.reload();
  }

  async function remove(item: Media) {
    if (
      busyId ||
      !window.confirm(fmt(qm.remove_confirm, { name: item.expected_filename }))
    ) {
      return;
    }

    setBusyId(item.id);
    setMessage(null);

    let supabase;

    try {
      supabase = createClient();
    } catch {
      setBusyId(null);
      setMessage(qm.no_config);
      return;
    }

    if (item.storage_path) {
      const { error } = await supabase.storage
        .from("question-media")
        .remove([item.storage_path]);

      if (error) {
        setBusyId(null);
        setMessage(fmt(qm.file_delete_failed, { msg: error.message }));
        return;
      }
    }

    const { error } = await supabase
      .from("question_media")
      .delete()
      .eq("id", item.id)
      .eq("question_id", questionId);

    setBusyId(null);

    if (error) {
      setMessage(fmt(qm.meta_delete_failed, { msg: error.message }));
      return;
    }

    setMessage(qm.delete_success);
    window.location.reload();
  }

  return (
    <section className="mt-4 border-t border-neutral-200 pt-4">
      <h5 className="font-medium">{qm.title}</h5>

      {media.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{qm.empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-neutral-600">{qm.hint}</p>

          {media.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-neutral-200 p-3 text-sm"
            >
              <p className="font-medium">
                {item.media_type}:{" "}
                <span dir="ltr">{item.expected_filename}</span>
              </p>

              {item.max_play_count ? (
                <p className="mt-1 text-neutral-600">
                  {fmt(qm.play_limit, { n: item.max_play_count })}
                </p>
              ) : null}

              {item.storage_path ? (
                <div className="mt-3 space-y-2">
                  <p className="text-green-700">
                    {qm.attached}
                    {item.size_bytes
                      ? ` (${formatBytes(item.size_bytes)})`
                      : ""}
                  </p>

                  {item.media_type === "audio" && urls[item.id] ? (
                    <audio
                      controls
                      preload="metadata"
                      src={urls[item.id]}
                      onError={() => markPreviewError(item.id)}
                      className="w-full"
                    />
                  ) : null}

                  {item.media_type === "image" && urls[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[item.id]}
                      alt={item.expected_filename}
                      onError={() => markPreviewError(item.id)}
                      className="max-h-56 rounded border"
                    />
                  ) : null}

                  {item.media_type === "video" && urls[item.id] ? (
                    <video
                      controls
                      preload="metadata"
                      src={urls[item.id]}
                      onError={() => markPreviewError(item.id)}
                      className="max-h-56 w-full rounded"
                    />
                  ) : null}

                  {previewErrors[item.id] ? (
                    <p role="alert" className="text-red-700">
                      {previewErrors[item.id]}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-amber-700">{qm.waiting_upload}</p>
              )}

              <label className="mt-3 block">
                <span className="sr-only">{qm.upload_aria}</span>
                <input
                  type="file"
                  accept={MIME_TYPES[item.media_type].join(",")}
                  disabled={busyId !== null}
                  onChange={(event) => upload(item, event.target.files?.[0])}
                  className="block w-full text-sm"
                />
              </label>

              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => remove(item)}
                className="mt-3 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
              >
                {qm.delete_media}
              </button>
            </div>
          ))}
        </div>
      )}

      {message ? (
        <p role="status" className="mt-3 text-sm text-neutral-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}