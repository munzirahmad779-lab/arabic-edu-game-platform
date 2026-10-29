import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClass, updateClass } from "./actions";
import { DeleteClassButton } from "./delete-class-button";
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

  const editingClass = searchParams.edit
    ? classes?.find((cls) => cls.id === searchParams.edit) ?? null
    : null;

  const errorMsg = (() => {
    switch (searchParams.error) {
      case "invalid_name":
        return "Nama kelas tidak valid (1-100 karakter).";
      case "invalid_subject":
        return "Mata pelajaran tidak valid (maks 100 karakter).";
      case "duplicate":
        return "Kelas dengan nama ini sudah ada.";
      case "create_failed":
        return "Gagal membuat kelas. Coba lagi.";
      case "invalid_update":
        return "Data perubahan kelas tidak valid.";
      case "update_failed":
        return "Gagal menyimpan perubahan kelas. Coba lagi.";
      case "invalid_delete":
        return "Permintaan hapus kelas tidak valid.";
      case "delete_failed":
        return "Gagal menghapus kelas. Coba lagi.";
      case "not_found":
        return "Kelas tidak ditemukan atau bukan milik Anda.";
      default:
        return searchParams.error ? `Error: ${searchParams.error}` : null;
    }
  })();

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-terracotta-500">
            {c.brand_top}
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-tight text-teal-700">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-softslate/80">{t.subtitle}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
        >
          {t.back_dashboard}
        </Link>
      </header>

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
        >
          ⚠️ {errorMsg}
        </div>
      ) : null}

      <section className="aesthetic-card">
        <div>
          <h2 className="font-display text-lg font-black text-teal-700">
            {editingClass ? t.edit_title : t.create_title}
          </h2>
          <p className="mt-1 text-sm text-softslate/70">{t.create_desc}</p>
        </div>

        <form
          action={editingClass ? updateClass : createClass}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          {editingClass ? (
            <input type="hidden" name="id" value={editingClass.id} />
          ) : null}
          <div>
            <label
              htmlFor="class-name"
              className="block text-sm font-bold text-teal-700"
            >
              {t.label_name}
            </label>
            <input
              id="class-name"
              name="name"
              type="text"
              required
              maxLength={100}
              defaultValue={editingClass?.name ?? ""}
              placeholder={t.label_name_placeholder}
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <div>
            <label
              htmlFor="class-subject"
              className="block text-sm font-bold text-teal-700"
            >
              {t.label_subject}
            </label>
            <input
              id="class-subject"
              name="subject"
              type="text"
              maxLength={100}
              defaultValue={editingClass?.subject ?? ""}
              placeholder={t.label_subject_placeholder}
              className="mt-2 w-full rounded-xl border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-terracotta-500 focus:ring-4 focus:ring-terracotta-500/15"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary flex-1">
              {editingClass ? t.btn_save : t.btn_create}
            </button>
            {editingClass ? (
              <Link
                href="/dashboard/classes"
                className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
              >
                {t.cancel_edit}
              </Link>
            ) : null}
          </div>
        </form>

        {editingClass ? (
          <div className="mt-5 border-t border-rose-100 pt-4">
            <DeleteClassButton
              classId={editingClass.id}
              label={c.delete}
              confirmText={t.delete_confirm}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-teal-700">
            {t.my_classes}
          </h2>
          <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-600">
            {classes?.length ?? 0} {t.my_classes_count}
          </span>
        </div>

        {!classes || classes.length === 0 ? (
          <div className="aesthetic-card text-center">
            <div className="text-4xl">🏫</div>
            <p className="mt-3 font-bold text-teal-700">{t.empty_title}</p>
            <p className="mt-1 text-sm text-softslate/70">{t.empty_desc}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <article key={cls.id} className="aesthetic-card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display truncate text-lg font-black text-teal-700">
                      {cls.name}
                    </h3>
                    <p className="mt-1 truncate text-sm text-softslate/70">
                      {cls.subject ?? dict.class_detail.no_subject}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-terracotta-50 px-2.5 py-1 text-xs text-terracotta-600">
                    🏫
                  </span>
                </div>

                <p className="mt-3 text-xs text-softslate/60">
                  {t.created_at}:{" "}
                  {new Date(cls.created_at).toLocaleDateString(
                    locale === "ar" ? "ar-EG" : locale,
                  )}
                </p>

                <div className="mt-4 flex gap-2 pt-2">
                  <Link
                    href={`/dashboard/classes/${cls.id}`}
                    className="flex-1 rounded-full bg-terracotta-500 px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-terracotta-600"
                  >
                    {t.open_class}
                  </Link>
                  <Link
                    href={`/dashboard/classes?edit=${cls.id}`}
                    className="rounded-full border border-sage-200 bg-white px-4 py-2.5 text-center text-sm font-black text-teal-700 transition hover:bg-sage-50"
                  >
                    {t.edit_title}
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