"use client";

import { useState, type ReactNode } from "react";

export function ClassCard({
  classId,
  header,
  children,
  defaultOpen = false,
}: {
  classId: string;
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-right transition hover:bg-violet-50/40"
        aria-expanded={open}
        aria-controls={`class-body-${classId}`}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <span
          className={`shrink-0 text-2xl text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={`class-body-${classId}`}
          className="space-y-4 border-t border-violet-100 p-5"
        >
          {children}
        </div>
      ) : null}
    </article>
  );
}