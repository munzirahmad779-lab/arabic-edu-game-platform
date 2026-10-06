"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteEssay, toggleEssayPublish } from "./essay-actions";

type Essay = {
  id: string;
  title: string;
  duration_minutes: number;
  is_published: boolean;
  submission_count: number;
  avg_score: number | null;
  created_at: string;
};

type EssayListDict = {
  empty_title: string;
  empty_desc: string;
  published: string;
  draft: string;
  duration_suffix: string;
  submission_suffix: string;
  avg_prefix: string;
  close: string;
  view_answers: string;
  unpublish: string;
  publish: string;
  delete_confirm: string;
  view_hint: string;
  open_review: string;
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

export function EssayList({
  essays,
  classId,
  el,
}: {
  essays: Essay[];
  classId: string;
  el: EssayListDict;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (essays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <div className="text-4xl">✍️</div>
        <p className="mt-3 text-sm font-bold text-neutral-700">
          {el.empty_title}
        </p>
        <p className="mt-1 text-xs text-neutral-500">{el.empty_desc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {essays.map((e) => {
        const isOpen = expanded === e.id;

        return (
          <div
            key={e.id}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold text-neutral-900">
                    {e.title}
                  </h3>
                  {e.is_published ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      {el.published}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {el.draft}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
                  <span>
                    ⏱ {e.duration_minutes} {el.duration_suffix}
                  </span>
                  <span>
                    📥 {e.submission_count} {el.submission_suffix}
                  </span>
                  {e.avg_score !== null ? (
                    <span>
                      ⭐ {el.avg_prefix} {e.avg_score}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                >
                  {isOpen ? el.close : el.view_answers}
                </button>

                <form action={toggleEssayPublish}>
                  <input type="hidden" name="essay_id" value={e.id} />
                  <input type="hidden" name="class_id" value={classId} />
                  <input
                    type="hidden"
                    name="current_published"
                    value={e.is_published ? "true" : "false"}
                  />
                  <button
                    type="submit"
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                      e.is_published
                        ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {e.is_published ? el.unpublish : el.publish}
                  </button>
                </form>

                <form action={deleteEssay}>
                  <input type="hidden" name="essay_id" value={e.id} />
                  <input type="hidden" name="class_id" value={classId} />
                  <button
                    type="submit"
                    onClick={(ev) => {
                      if (
                        !window.confirm(
                          fmt(el.delete_confirm, { title: e.title }),
                        )
                      ) {
                        ev.preventDefault();
                      }
                    }}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                  >
                    🗑
                  </button>
                </form>
              </div>
            </div>

            {isOpen ? (
              <div className="border-t border-neutral-100 bg-neutral-50/50 p-4">
                <p className="text-center text-sm text-neutral-500">
                  {el.view_hint}
                </p>
                <Link
                  href={`/dashboard/classes/${classId}/essays/${e.id}`}
                  className="mt-3 inline-flex w-full justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
                >
                  {el.open_review}
                </Link>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}