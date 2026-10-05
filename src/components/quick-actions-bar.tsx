"use client";

import Link from "next/link";
import { useState } from "react";

type Tone = "coral" | "sage" | "blue" | "purple";

type Action = {
  href: string;
  label: string;
  tone: Tone;
};

const TONE_CLASS: Record<Tone, string> = {
  coral: "bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-200",
  sage: "bg-sage-100 text-sage-700 hover:bg-sage-200",
  blue: "bg-sky-100 text-sky-700 hover:bg-sky-200",
  purple: "bg-violet-100 text-violet-700 hover:bg-violet-200",
};

export function QuickActionsBar({
  title,
  actions,
}: {
  title: string;
  actions: Action[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-sage-200/60 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <h2 className="font-display text-base font-black text-teal-800">
          {title}
        </h2>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-sage-200 bg-sage-50 text-sm font-black text-teal-700 transition ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions.map((a, i) => (
            <span key={`${a.href}-${i}`} className="inline-flex items-center">
              <Link
                href={a.href}
                className={`inline-flex items-center rounded-full px-3.5 py-2 text-xs font-black transition ${TONE_CLASS[a.tone]}`}
              >
                {a.label}
              </Link>
              {i < actions.length - 1 ? (
                <span className="mx-1 text-xs text-softslate/40">·</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}