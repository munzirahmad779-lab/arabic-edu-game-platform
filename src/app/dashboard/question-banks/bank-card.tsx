"use client";

import { useState, type ReactNode } from "react";

export function BankCard({
  bankId,
  header,
  children,
  defaultOpen = false,
}: {
  bankId: string;
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-5 text-right transition hover:bg-neutral-50"
        aria-expanded={open}
        aria-controls={`bank-body-${bankId}`}
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
          id={`bank-body-${bankId}`}
          className="space-y-5 border-t border-neutral-200 p-5"
        >
          {children}
        </div>
      ) : null}
    </article>
  );
}