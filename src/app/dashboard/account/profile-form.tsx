"use client";

import { useState } from "react";
import { updateProfile } from "./actions";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

export function ProfileForm({
  initialName,
  email,
  dict,
}: {
  initialName: string;
  email: string;
  dict: Dict;
}) {
  const t = dict.account;
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl text-white shadow-md">
          👤
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-violet-600">
            {t.profile_label}
          </p>
          <h2 className="mt-1 truncate text-xl font-black text-neutral-900">
            {initialName || t.no_name}
          </h2>
          <p className="mt-0.5 truncate text-sm text-neutral-500" dir="ltr">
            {email}
          </p>
        </div>
      </div>

      {editing ? (
        <form
          action={async (fd) => {
            setSubmitting(true);
            await updateProfile(fd);
            setSubmitting(false);
          }}
          className="mt-5 space-y-3"
        >
          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-bold text-neutral-700"
            >
              {t.full_name}
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              maxLength={100}
              defaultValue={initialName}
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {submitting ? "..." : t.btn_save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
            >
              {t.btn_cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-5 w-full rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100"
        >
          {t.btn_edit_name}
        </button>
      )}

      <form action="/auth/logout" method="post" className="mt-3">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
        >
          {t.btn_logout}
        </button>
      </form>
    </div>
  );
}