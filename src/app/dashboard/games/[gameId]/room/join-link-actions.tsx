"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type JoinLinkActionsProps = {
  joinUrl: string;
};

export default function JoinLinkActions({ joinUrl }: JoinLinkActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "رابط الانضمام",
          text: "انضم إلى غرفة اللعب",
          url: joinUrl,
        });
        return;
      } catch {
        return;
      }
    }

    await copyLink();
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[200px_1fr] lg:items-center">
      <div className="mx-auto rounded-3xl bg-white p-4 shadow-xl">
        <QRCodeSVG value={joinUrl} size={180} level="M" includeMargin />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black break-all text-cyan-200">
          {joinUrl}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5"
          >
            {copied ? "✓ تم نسخ الرابط" : "نسخ الرابط"}
          </button>

          <button
            type="button"
            onClick={shareLink}
            className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5"
          >
            مشاركة
          </button>
        </div>
      </div>
    </div>
  );
}