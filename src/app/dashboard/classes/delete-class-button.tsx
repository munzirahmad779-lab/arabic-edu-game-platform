"use client";

import { deleteClass } from "./actions";

export function DeleteClassButton({
  classId,
  label,
  confirmText,
}: {
  classId: string;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={deleteClass}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={classId} />
      <button
        type="submit"
        className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
      >
        {label}
      </button>
    </form>
  );
}
