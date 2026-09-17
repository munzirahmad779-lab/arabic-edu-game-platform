import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMaterial, updateMaterial } from "./actions";
import MaterialForm from "./material-form";
import { EssayForm } from "./essay-form";
import { EssayList } from "./essay-list";
import { MaterialSortableList } from "./material-sortable-list";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  material_error?: string;
  material_created?: string;
  material_updated?: string;
  material_deleted?: string;
  edit_material?: string;
  add_material?: string;
  add_essay?: string;
  essay_created?: string;
  essay_deleted?: string;
  essay_error?: string;
};

type EssayRow = {
  id: string;
  title: string;
  duration_minutes: number;
  is_published: boolean;
  submission_count: number;
  avg_score: number | null;
  created_at: string;
};

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: { classId: string };
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.class_detail;
  const c = dict.common;
  const isRtl = locale === "ar";

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, name, subject, created_at")
    .eq("id", params.classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    notFound();
  }

  const [
    { data: students },
    { data: games },
    { data: materials },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, created_at")
      .eq("class_id", classRow.id)
      .order("name"),
    supabase
      .from("games")
      .select("id, name, mode, duration_seconds, created_at")
      .eq("class_id", classRow.id)
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("class_materials")
      .select(
        "id, title, content_json, youtube_url, image_path, pdf_path, position, is_published, created_at",
      )
      .eq("class_id", classRow.id)
      .order("position", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: essaysData } = await (supabase as any).rpc(
    "teacher_list_essays",
    { p_class_id: classRow.id },
  );
  const essays = (essaysData ?? []) as EssayRow[];

  const getMaterialMessage = () => {
    if (searchParams.material_created === "1")
      return { type: "success" as const, text: t.success_material_created };
    if (searchParams.material_updated === "1")
      return { type: "success" as const, text: t.success_material_updated };
    if (searchParams.material_deleted === "1")
      return { type: "success" as const, text: t.success_material_deleted };
    if (searchParams.material_error === "invalid_title")
      return { type: "error" as const, text: t.error_material_invalid_title };
    if (searchParams.material_error === "image_invalid_type")
      return { type: "error" as const, text: t.error_material_image_type };
    if (searchParams.material_error === "image_too_large")
      return { type: "error" as const, text: t.error_material_image_size };
    if (searchParams.material_error === "pdf_invalid_type")
      return { type: "error" as const, text: t.error_material_pdf_type };
    if (searchParams.material_error === "pdf_too_large")
      return { type: "error" as const, text: t.error_material_pdf_size };
    if (searchParams.material_error)
      return {
        type: "error" as const,
        text: `${c.error}: ${searchParams.material_error}`,
      };
    return null;
  };

  const getEssayMessage = () => {
    if (searchParams.essay_created === "1")
      return { type: "success" as const, text: t.success_essay_created };
    if (searchParams.essay_deleted === "1")
      return { type: "success" as const, text: t.success_essay_deleted };
    if (searchParams.essay_error === "invalid_title")
      return { type: "error" as const, text: t.error_essay_title };
    if (searchParams.essay_error === "invalid_question")
      return { type: "error" as const, text: t.error_essay_question };
    if (searchParams.essay_error === "invalid_duration")
      return { type: "error" as const, text: t.error_essay_duration };
    if (searchParams.essay_error === "rubric_sum")
      return { type: "error" as const, text: t.error_essay_rubric };
    if (searchParams.essay_error)
      return {
        type: "error" as const,
        text: `${c.error}: ${searchParams.essay_error}`,
      };
    return null;
  };

  const materialMessage = getMaterialMessage();
  const essayMessage = getEssayMessage();
  const showForm =
    searchParams.add_material === "1" || Boolean(searchParams.edit_material);

  return (
    <main className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <Link
          href="/dashboard/classes"
          className="text-sm font-bold text-teal-700 underline-offset-4 hover:underline"
        >
          ← {t.back_classes}
        </Link>
      </div>

      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-terracotta-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/75">
              {t.header_label}
            </p>
            <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
              {classRow.name}
            </h1>
            <p className="mt-2 text-sm text-white/85">
              {t.subject_label}:{" "}
              <span className="font-bold">
                {classRow.subject ?? t.no_subject}
              </span>
            </p>
            <p className="mt-1 text-xs text-white/70">
              {t.created_at}:{" "}
              {new Date(classRow.created_at).toLocaleDateString(
                isRtl ? "ar-EG" : locale,
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              {t.btn_students}
            </Link>
            <Link
              href={`/dashboard/classes?edit=${classRow.id}`}
              className="rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              {t.btn_edit_class}
            </Link>
          </div>
        </div>
      </header>

      {materialMessage ? (
        <div
          role="alert"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            materialMessage.type === "success"
              ? "border-sage-200 bg-sage-50 text-sage-600"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {materialMessage.text}
        </div>
      ) : null}

      {essayMessage ? (
        <div
          role="alert"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            essayMessage.type === "success"
              ? "border-sage-200 bg-sage-50 text-sage-600"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {essayMessage.text}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-teal-500/20 bg-teal-50 p-5 text-center">
          <div className="text-xs font-bold text-teal-700">
            {t.stat_students}
          </div>
          <div className="mt-2 text-3xl font-black text-teal-700">
            {students?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-terracotta-500/25 bg-terracotta-50 p-5 text-center">
          <div className="text-xs font-bold text-terracotta-600">
            {t.stat_games}
          </div>
          <div className="mt-2 text-3xl font-black text-terracotta-600">
            {games?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-sage-500/30 bg-sage-50 p-5 text-center">
          <div className="text-xs font-bold text-sage-600">
            {t.stat_materials}
          </div>
          <div className="mt-2 text-3xl font-black text-sage-600">
            {materials?.length ?? 0}
          </div>
        </div>
      </section>

      {/* Essay */}
      <section className="aesthetic-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              ✍️ {t.essay_section_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {essays.length} {t.essay_section_desc}
            </p>
          </div>
          {searchParams.add_essay !== "1" ? (
            <Link
              href={`/dashboard/classes/${classRow.id}?add_essay=1`}
              className="btn-primary"
            >
              {t.btn_add_essay}
            </Link>
          ) : null}
        </div>

        {searchParams.add_essay === "1" ? (
          <div className="mb-6 rounded-2xl border border-terracotta-500/25 bg-terracotta-50/40 p-5">
            <h3 className="mb-4 text-base font-black text-terracotta-600">
              {t.essay_create_title}
            </h3>
            <EssayForm classId={classRow.id} />
            <div className="mt-3">
              <Link
                href={`/dashboard/classes/${classRow.id}`}
                className="text-sm text-teal-700 underline"
              >
                {t.essay_cancel}
              </Link>
            </div>
          </div>
        ) : null}

        <EssayList essays={essays} classId={classRow.id} />
      </section>

      {/* Materials */}
      <section className="aesthetic-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {t.materials_section_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {materials?.length ?? 0} {t.materials_count}
            </p>
          </div>
          {!showForm ? (
            <Link
              href={`/dashboard/classes/${classRow.id}?add_material=1`}
              className="btn-primary"
            >
              {t.btn_add_material}
            </Link>
          ) : null}
        </div>

        {showForm ? (
          <div className="mb-6 rounded-2xl border border-terracotta-500/25 bg-terracotta-50/40 p-5">
            <h3 className="mb-4 text-base font-black text-terracotta-600">
              {searchParams.edit_material
                ? t.material_edit_title
                : t.material_create_title}
            </h3>
            {searchParams.edit_material ? (
              (() => {
                const editing = materials?.find(
                  (m) => m.id === searchParams.edit_material,
                );
                if (!editing) return null;
                return (
                  <MaterialForm
                    mode="edit"
                    classId={classRow.id}
                    action={updateMaterial}
                    initialData={{
                      id: editing.id,
                      title: editing.title,
                      content_json: editing.content_json
                        ? JSON.stringify(editing.content_json)
                        : null,
                      youtube_url: editing.youtube_url,
                      image_path: editing.image_path,
                      pdf_path: editing.pdf_path,
                    }}
                  />
                );
              })()
            ) : (
              <MaterialForm
                mode="create"
                classId={classRow.id}
                action={createMaterial}
              />
            )}
            <div className="mt-3">
              <Link
                href={`/dashboard/classes/${classRow.id}`}
                className="text-sm text-teal-700 underline"
              >
                {t.material_cancel}
              </Link>
            </div>
          </div>
        ) : null}

        <MaterialSortableList
          materials={(materials ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            is_published: m.is_published,
            position: m.position,
            created_at: m.created_at,
            has_youtube: Boolean(m.youtube_url),
            has_image: Boolean(m.image_path),
            has_pdf: Boolean(m.pdf_path),
          }))}
          classId={classRow.id}
        />
      </section>

      {/* Students */}
      <section className="aesthetic-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {t.students_section_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {students?.length ?? 0} {t.students_count}
            </p>
          </div>
          <Link
            href={`/dashboard/students?classId=${classRow.id}`}
            className="rounded-full border border-sage-200 bg-white px-3 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
          >
            {t.students_manage}
          </Link>
        </div>

        {!students || students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-8 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-3 font-bold text-teal-700">
              {t.students_empty}
            </p>
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="mt-4 inline-flex rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
            >
              {t.students_add}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student, index) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-2xl border border-sage-200/60 bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 text-sm font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-teal-700">
                    {student.name}
                  </div>
                  <div className="text-xs text-softslate/70">
                    {new Date(student.created_at).toLocaleDateString(
                      isRtl ? "ar-EG" : locale,
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Games */}
      <section className="aesthetic-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-black text-teal-700">
              {t.games_section_title}
            </h2>
            <p className="mt-1 text-sm text-softslate/70">
              {games?.length ?? 0} {t.games_count}
            </p>
          </div>
          <Link
            href="/dashboard/games"
            className="rounded-full border border-sage-200 bg-white px-3 py-2 text-sm font-bold text-teal-700 transition hover:bg-sage-50"
          >
            {t.games_manage}
          </Link>
        </div>

        {!games || games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage-200 bg-sage-50/40 p-8 text-center">
            <div className="text-4xl">🎮</div>
            <p className="mt-3 font-bold text-teal-700">{t.games_empty}</p>
            <Link
              href="/dashboard/games"
              className="mt-4 inline-flex rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-terracotta-600"
            >
              {t.games_create}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-col gap-2 rounded-2xl border border-sage-200/60 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-bold text-teal-700">{game.name}</div>
                  <div className="mt-1 text-xs text-softslate/70">
                    {game.mode === "competitive"
                      ? isRtl
                        ? "تنافسي"
                        : locale === "en"
                          ? "Competitive"
                          : "Kompetitif"
                      : isRtl
                        ? "تعليمي"
                        : locale === "en"
                          ? "Learning"
                          : "Pembelajaran"}{" "}
                    · {game.duration_seconds}s
                  </div>
                </div>
                <Link
                  href="/dashboard/games"
                  className="rounded-full border border-sage-200 bg-sage-50 px-3 py-2 text-sm font-bold text-sage-600 transition hover:bg-sage-100"
                >
                  {t.games_open}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}