import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  error?: string;
  edit?: string;
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.classes;
  const c = dict.common;
  const isRtl = locale === "ar";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const editing = searchParams.edit
    ? classes?.find((cls) => cls.id === searchParams.edit)
    : null;

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {c.brand_top}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t.subtitle}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          {t.back_dashboard}
        </Link>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">
            {editing ? t.edit_title : t.create_title}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{t.create_desc}</p>
        </div>

        <form
          action={
            editing
              ? `/dashboard/classes/${editing.id}?edit=1`
              : "/dashboard/classes"
          }
          method="post"
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          {editing ? (
            <input type="hidden" name="id" value={editing.id} />
          ) : null}

          <div>
            <label
              htmlFor="class-name"
              className="block text-sm font-medium"
            >
              {t.label_name}
            </label>
            <input
              id="class-name"
              name="name"
              type="text"
              required
              maxLength={120}
              defaultValue={editing?.name ?? ""}
              placeholder={t.label_name_placeholder}
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <div>
            <label
              htmlFor="class-subject"
              className="block text-sm font-medium"
            >
              {t.label_subject}
            </label>
            <input
              id="class-subject"
              name="subject"
              type="text"
              maxLength={120}
              defaultValue={editing?.subject ?? ""}
              placeholder={t.label_subject_placeholder}
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
            >
              {editing ? t.btn_save : t.btn_create}
            </button>
            {editing ? (
              <Link
                href="/dashboard/classes"
                className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                {t.cancel_edit}
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t.my_classes}</h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
            {classes?.length ?? 0} {t.my_classes_count}
          </span>
        </div>

        {!classes || classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <div className="text-4xl">🏫</div>
            <p className="mt-3 font-bold text-neutral-700">{t.empty_title}</p>
            <p className="mt-1 text-sm text-neutral-500">{t.empty_desc}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <article
                key={cls.id}
                className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">
                      {cls.name}
                    </h3>
                    <p className="mt-1 truncate text-sm text-neutral-500">
                      {cls.subject ?? dict.class_detail.no_subject}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                    🏫
                  </span>
                </div>

                <p className="mt-3 text-xs text-neutral-400">
                  {t.created_at}:{" "}
                  {new Date(cls.created_at).toLocaleDateString(
                    locale === "ar" ? "ar-EG" : locale,
                  )}
                </p>

                <div className="mt-4 flex gap-2 pt-2">
                  <Link
                    href={`/dashboard/classes/${cls.id}`}
                    className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-violet-700"
                  >
                    {t.open_class}
                  </Link>
                  <Link
                    href={`/dashboard/classes?edit=${cls.id}`}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    ✏️
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}