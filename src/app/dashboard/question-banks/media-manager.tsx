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

const LIMITS: Record<MediaType, number> = {
  audio: 10 * 1024 * 1024,
  image: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

const MIME_TYPES: Record<MediaType, string[]> = {
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
};

function formatBytes(value: number | null) {
  if (!value) return "";
  return `${(value / 1024 / 1024).toFixed(value < 1024 * 1024 ? 2 : 1)} MB`;
}

export function QuestionMediaManager({ questionId, media }: { questionId: string; media: Media[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});

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
      ).then((entries) => {
        if (cancelled) return;
        const nextUrls: Record<string, string> = {};
        const nextErrors: Record<string, string> = {};
        for (const [id, result] of entries) {
          if (result.startsWith("http")) nextUrls[id] = result;
          else nextErrors[id] = `Pratinjau privat tidak tersedia: ${result}`;
        }
        setUrls(nextUrls);
        setPreviewErrors(nextErrors);
      }).catch(() => {
        if (!cancelled) setPreviewErrors(Object.fromEntries(attached.map((item) => [item.id, "Pratinjau privat tidak dapat dimuat."])));
      });
    } catch {
      setPreviewErrors(Object.fromEntries(attached.map((item) => [item.id, "Konfigurasi media tidak tersedia di browser ini."])));
    }
    return () => {
      cancelled = true;
    };
  }, [media]);

  function markPreviewError(mediaId: string) {
    setPreviewErrors((current) => ({
      ...current,
      [mediaId]: "File media tidak dapat diputar atau ditampilkan. Periksa format file lalu unggah ulang.",
    }));
  }

  async function upload(item: Media, file: File | undefined) {
    if (!file || busyId) return;
    setMessage(null);
    if (file.name !== item.expected_filename) {
      setMessage(`Nama file harus persis «${item.expected_filename}».`);
      return;
    }
    if (!MIME_TYPES[item.media_type].includes(file.type)) {
      setMessage("Jenis file tidak didukung untuk media ini.");
      return;
    }
    if (file.size < 1 || file.size > LIMITS[item.media_type]) {
      setMessage(`Ukuran file tidak valid (maksimum ${formatBytes(LIMITS[item.media_type])}).`);
      return;
    }

    setBusyId(item.id);
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setBusyId(null);
      setMessage("Konfigurasi media tidak tersedia. Muat ulang halaman atau hubungi administrator.");
      return;
    }
    const storagePath = `${questionId}/${item.id}/${item.expected_filename}`;
    const { error: uploadError } = await supabase.storage.from("question-media").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });
    if (uploadError) {
      setBusyId(null);
      setMessage(`Upload gagal: ${uploadError.message}`);
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
      // The object remains private and inaccessible until its metadata is attached.
      setMessage(`File tersimpan tetapi metadata gagal diperbarui: ${metadataError.message}`);
      return;
    }
    setMessage("Media berhasil diunggah dan dihubungkan ke soal.");
    window.location.reload();
  }

  async function remove(item: Media) {
    if (busyId || !window.confirm(`Hapus media «${item.expected_filename}»?`)) return;
    setBusyId(item.id);
    setMessage(null);
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setBusyId(null);
      setMessage("Konfigurasi media tidak tersedia. Muat ulang halaman atau hubungi administrator.");
      return;
    }
    if (item.storage_path) {
      const { error } = await supabase.storage.from("question-media").remove([item.storage_path]);
      if (error) {
        setBusyId(null);
        setMessage(`File tidak dapat dihapus: ${error.message}`);
        return;
      }
    }
    const { error } = await supabase.from("question_media").delete().eq("id", item.id).eq("question_id", questionId);
    setBusyId(null);
    if (error) {
      setMessage(`Metadata media tidak dapat dihapus: ${error.message}`);
      return;
    }
    setMessage("Media berhasil dihapus.");
    window.location.reload();
  }

  return (
    <section className="mt-4 border-t border-neutral-200 pt-4">
      <h5 className="font-medium">الوسائط</h5>
      {media.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">لا توجد وسائط معلنة لهذا السؤال.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-neutral-600">
            اختر ملفًا بالاسم المطابق تمامًا للاسم المعلن في Excel. يبقى السؤال صالحًا قبل الرفع؛
            حالة «بانتظار الرفع» ليست خطأ في الاستيراد.
          </p>
          {media.map((item) => (
            <div key={item.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <p className="font-medium">{item.media_type}: <span dir="ltr">{item.expected_filename}</span></p>
              {item.max_play_count ? <p className="mt-1 text-neutral-600">حد التشغيل المحفوظ: {item.max_play_count}. لا يُطبّق إلا عند توفر تشغيل الطلاب في نظام اللعبة.</p> : null}
              {item.storage_path ? (
                <div className="mt-3 space-y-2">
                  <p className="text-green-700">تم الإرفاق {item.size_bytes ? `(${formatBytes(item.size_bytes)})` : ""}</p>
                  {item.media_type === "audio" && urls[item.id] ? <audio controls preload="metadata" src={urls[item.id]} onError={() => markPreviewError(item.id)} className="w-full" /> : null}
                  {item.media_type === "image" && urls[item.id] ? (
                    // Signed private URLs cannot be optimized by Next.js without remote image configuration.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[item.id]} alt={item.expected_filename} onError={() => markPreviewError(item.id)} className="max-h-56 rounded border" />
                  ) : null}
                  {item.media_type === "video" && urls[item.id] ? <video controls preload="metadata" src={urls[item.id]} onError={() => markPreviewError(item.id)} className="max-h-56 w-full rounded" /> : null}
                  {previewErrors[item.id] ? <p role="alert" className="text-red-700">{previewErrors[item.id]}</p> : null}
                </div>
              ) : <p className="mt-1 text-amber-700">بانتظار رفع الملف المطابق.</p>}
              <label className="mt-3 block">
                <span className="sr-only">رفع {item.expected_filename}</span>
                <input type="file" accept={MIME_TYPES[item.media_type].join(",")} disabled={busyId !== null} onChange={(event) => upload(item, event.target.files?.[0])} className="block w-full text-sm" />
              </label>
              <button type="button" disabled={busyId !== null} onClick={() => remove(item)} className="mt-3 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
                حذف الوسائط
              </button>
            </div>
          ))}
        </div>
      )}
      {message ? <p role="status" className="mt-3 text-sm text-neutral-700">{message}</p> : null}
    </section>
  );
}
