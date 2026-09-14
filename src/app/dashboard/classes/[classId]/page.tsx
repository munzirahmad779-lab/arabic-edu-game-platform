import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createMaterial,
  deleteMaterial,
  moveMaterial,
  togglePublish,
  updateMaterial,
} from "./actions";
import MaterialForm from "./material-form";

type SearchParams = {
  material_error?: string;
  material_created?: string;
  material_updated?: string;
  material_deleted?: string;
  edit_material?: string;
  add_material?: string;
};

function getMaterialMessage(searchParams: SearchParams) {
  if (searchParams.material_created === "1") {
    return { type: "success", text: "تمت إضافة المادة." };
  }
  if (searchParams.material_updated === "1") {
    return { type: "success", text: "تم تحديث المادة." };
  }
  if (searchParams.material_deleted === "1") {
    return { type: "success", text: "تم حذف المادة." };
  }
  if (searchParams.material_error === "invalid_title") {
    return { type: "error", text: "عنوان المادة مطلوب (1-200 حرف)." };
  }
  if (searchParams.material_error === "image_invalid_type") {
    return { type: "error", text: "صيغة الصورة غير مدعومة." };
  }
  if (searchParams.material_error === "image_too_large") {
    return { type: "error", text: "حجم الصورة يجب أن يكون أقل من 1MB." };
  }
  if (searchParams.material_error === "pdf_invalid_type") {
    return { type: "error", text: "الملف يجب أن يكون PDF." };
  }
  if (searchParams.material_error === "pdf_too_large") {
    return { type: "error", text: "حجم الملف يجب أن يكون أقل من 1MB." };
  }
  if (searchParams.material_error) {
    return { type: "error", text: `خطأ: ${searchParams.material_error}` };
  }
  return null;
}

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

  if (!user) {
    return null;
  }

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
    { data: students, error: studentsError },
    { data: games, error: gamesError },
    { data: materials, error: materialsError },
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

  if (studentsError) throw new Error("تعذر تحميل الطلاب.");
  if (gamesError) throw new Error("تعذر تحميل الألعاب.");
  if (materialsError) throw new Error("تعذر تحميل المواد.");

  const materialMessage = getMaterialMessage(searchParams);
  const showForm =
    searchParams.add_material === "1" ||
    Boolean(searchParams.edit_material);

  return (
    <main className="space-y-8" dir="rtl">
      <div>
        <Link
          href="/dashboard/classes"
          className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
        >
          ← العودة إلى الفصول
        </Link>
      </div>

      <header className="rounded-2xl bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/75">الفصل الدراسي</p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">
              {classRow.name}
            </h1>
            <p className="mt-2 text-sm text-white/85">
              المادة:{" "}
              <span className="font-bold">
                {classRow.subject ?? "بدون مادة"}
              </span>
            </p>
            <p className="mt-1 text-xs text-white/70">
              تم الإنشاء:{" "}
              {new Date(classRow.created_at).toLocaleDateString("ar-EG")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              إدارة الطلاب
            </Link>
            <Link
              href={`/dashboard/classes?edit=${classRow.id}`}
              className="rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              تعديل الفصل
            </Link>
          </div>
        </div>
      </header>

      {materialMessage ? (
        <div
          role="alert"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            materialMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {materialMessage.text}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-center">
          <div className="text-xs font-bold text-sky-700">الطلاب</div>
          <div className="mt-2 text-3xl font-black text-sky-950">
            {students?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 text-center">
          <div className="text-xs font-bold text-violet-700">الألعاب</div>
          <div className="mt-2 text-3xl font-black text-violet-950">
            {games?.length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-center">
          <div className="text-xs font-bold text-amber-700">المواد الدراسية</div>
          <div className="mt-2 text-3xl font-black text-amber-950">
            {materials?.length ?? 0}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">المواد الدراسية</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {materials?.length ?? 0} مادة.
            </p>
          </div>
          {!showForm ? (
            <Link
              href={`/dashboard/classes/${classRow.id}?add_material=1`}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
            >
              + إضافة مادة
            </Link>
          ) : null}
        </div>

        {showForm ? (
          <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
            <h3 className="mb-4 text-base font-bold text-violet-900">
              {searchParams.edit_material ? "تعديل المادة" : "إضافة مادة جديدة"}
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
                className="text-sm text-neutral-600 underline"
              >
                إلغاء والعودة
              </Link>
            </div>
          </div>
        ) : null}

        {!materials || materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">📖</div>
            <p className="mt-3 font-bold text-neutral-700">
              لا توجد مواد دراسية بعد
            </p>
            <Link
              href={`/dashboard/classes/${classRow.id}?add_material=1`}
              className="mt-4 inline-flex rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
            >
              إضافة أول مادة
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((material, index) => (
              <div
                key={material.id}
                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-bold text-neutral-900">
                        {material.title}
                      </div>
                      {material.is_published ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          منشورة
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          مسودة
                        </span>
                      )}
                      {material.youtube_url ? (
                        <span
                          className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700"
                          title="يحتوي فيديو يوتيوب"
                        >
                          🎬
                        </span>
                      ) : null}
                      {material.image_path ? (
                        <span
                          className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700"
                          title="يحتوي صورة"
                        >
                          🖼️
                        </span>
                      ) : null}
                      {material.pdf_path ? (
                        <span
                          className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700"
                          title="يحتوي ملف PDF"
                        >
                          📄
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {new Date(material.created_at).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action={moveMaterial}>
                    <input
                      type="hidden"
                      name="material_id"
                      value={material.id}
                    />
                    <input type="hidden" name="class_id" value={classRow.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-40"
                      title="أعلى"
                    >
                      ▲
                    </button>
                  </form>
                  <form action={moveMaterial}>
                    <input
                      type="hidden"
                      name="material_id"
                      value={material.id}
                    />
                    <input type="hidden" name="class_id" value={classRow.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === materials.length - 1}
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-40"
                      title="أسفل"
                    >
                      ▼
                    </button>
                  </form>

                  <form action={togglePublish}>
                    <input
                      type="hidden"
                      name="material_id"
                      value={material.id}
                    />
                    <input type="hidden" name="class_id" value={classRow.id} />
                    <input
                      type="hidden"
                      name="current_published"
                      value={material.is_published ? "true" : "false"}
                    />
                    <button
                      type="submit"
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        material.is_published
                          ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {material.is_published ? "إلغاء النشر" : "نشر"}
                    </button>
                  </form>

                  <Link
                    href={`/dashboard/classes/${classRow.id}?edit_material=${material.id}`}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-bold hover:bg-neutral-50"
                  >
                    تعديل
                  </Link>

                  <form action={deleteMaterial}>
                    <input
                      type="hidden"
                      name="material_id"
                      value={material.id}
                    />
                    <input type="hidden" name="class_id" value={classRow.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">الطلاب في هذا الفصل</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {students?.length ?? 0} طالب مسجل.
            </p>
          </div>
          <Link
            href={`/dashboard/students?classId=${classRow.id}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            إدارة الطلاب
          </Link>
        </div>

        {!students || students.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-3 font-bold text-neutral-700">
              لا يوجد طلاب في هذا الفصل بعد
            </p>
            <Link
              href={`/dashboard/students?classId=${classRow.id}`}
              className="mt-4 inline-flex rounded-2xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
            >
              إضافة طلاب
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student, index) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-neutral-900">
                    {student.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(student.created_at).toLocaleDateString("ar-EG")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              الألعاب المرتبطة بهذا الفصل
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {games?.length ?? 0} لعبة.
            </p>
          </div>
          <Link
            href="/dashboard/games"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            إدارة الألعاب
          </Link>
        </div>

        {!games || games.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-4xl">🎮</div>
            <p className="mt-3 font-bold text-neutral-700">
              لا توجد ألعاب لهذا الفصل بعد
            </p>
            <Link
              href="/dashboard/games"
              className="mt-4 inline-flex rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
            >
              إنشاء لعبة
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-bold text-neutral-900">{game.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {game.mode === "competitive" ? "تنافسي" : "تعليمي"} ·{" "}
                    {game.duration_seconds} ثانية
                  </div>
                </div>
                <Link
                  href="/dashboard/games"
                  className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100"
                >
                  فتح في الألعاب
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}