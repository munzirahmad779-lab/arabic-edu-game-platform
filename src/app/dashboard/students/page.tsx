import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createStudent, deleteStudent, resetStudentPin } from "./actions";
import { StudentImportForm } from "./import-form";

type SearchParams = {
  classId?: string;
  error?: string;
  created?: string;
  updated?: string;
  deleted?: string;
};

function getMessage(searchParams: SearchParams) {
  if (searchParams.created === "1") {
    return {
      type: "success",
      text: "تمت إضافة الطالب. استخدم PIN الذي أدخلته وأعطه للطالب.",
    };
  }

  if (searchParams.updated === "1") {
    return {
      type: "success",
      text: "تم تحديث PIN الطالب.",
    };
  }

  if (searchParams.deleted === "1") {
    return {
      type: "success",
      text: "تم حذف الطالب.",
    };
  }

  switch (searchParams.error) {
    case "invalid":
      return { type: "error", text: "أدخل اسم الطالب وPIN صحيحًا من 4 إلى 6 أرقام." };
    case "invalid_name":
      return { type: "error", text: "اسم الطالب غير صحيح." };
    case "invalid_pin":
      return { type: "error", text: "يجب أن يكون PIN من 4 إلى 6 أرقام." };
    case "duplicate":
      return { type: "error", text: "يوجد طالب بهذا الاسم في هذا الفصل." };
    case "invalid_class":
      return { type: "error", text: "الفصل غير موجود أو لا تملك صلاحية الوصول إليه." };
    case "student_not_found":
      return { type: "error", text: "الطالب غير موجود." };
    default:
      return null;
  }
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");

  if (classesError) {
    throw new Error("تعذر تحميل الفصول.");
  }

  const activeClassId =
    classes?.find((item) => item.id === searchParams.classId)?.id ??
    classes?.[0]?.id ??
    null;

  const activeClass = classes?.find((item) => item.id === activeClassId) ?? null;

  const { data: students, error: studentsError } = activeClassId
    ? await supabase
        .from("students")
        .select("id, name, created_at")
        .eq("class_id", activeClassId)
        .order("name")
    : { data: [], error: null };

  if (studentsError) {
    throw new Error("تعذر تحميل الطلاب.");
  }

  const message = getMessage(searchParams);

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbeafe,_transparent_35%),radial-gradient(circle_at_bottom_left,_#fce7f3,_transparent_35%)] p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/75">
                إدارة الطلاب
              </div>
              <h1 className="mt-1 text-3xl font-black">طلاب الفصول</h1>
              <p className="mt-2 text-sm text-white/80">
                أنشئ هوية الطالب داخل الفصل باستخدام الاسم وPIN.
              </p>
            </div>

            <Link
              href="/dashboard/classes"
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/20"
            >
              العودة إلى الفصول
            </Link>
          </div>
        </header>

        {message ? (
          <div
            className={
              message.type === "success"
                ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800"
                : "rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800"
            }
          >
            {message.text}
          </div>
        ) : null}

        {!classes?.length ? (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center">
            <h2 className="text-xl font-black text-amber-950">
              أنشئ فصلًا أولًا
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              يجب أن يكون لديك فصل دراسي قبل إضافة الطلاب.
            </p>
            <Link
              href="/dashboard/classes"
              className="mt-5 inline-flex rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white"
            >
              الذهاب إلى الفصول
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-xl">
              <form method="get" className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label
                    htmlFor="classId"
                    className="block text-sm font-bold text-slate-900"
                  >
                    الفصل الدراسي
                  </label>
                  <select
                    id="classId"
                    name="classId"
                    defaultValue={activeClassId ?? ""}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold"
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700"
                >
                  عرض الطلاب
                </button>
              </form>
            </section>

            {activeClass ? (
              <>
                <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl">
                    <div>
                      <p className="text-sm font-bold text-violet-600">
                        إضافة طالب
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">
                        {activeClass.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500">
                        اختر PIN من 4 إلى 6 أرقام، ثم أعطه للطالب.
                      </p>
                    </div>

                    <form action={createStudent} className="mt-6 space-y-4">
                      <input
                        type="hidden"
                        name="class_id"
                        value={activeClass.id}
                      />

                      <div>
                        <label
                          htmlFor="student-name"
                          className="block text-sm font-bold"
                        >
                          اسم الطالب
                        </label>
                        <input
                          id="student-name"
                          name="name"
                          type="text"
                          maxLength={100}
                          required
                          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="student-pin"
                          className="block text-sm font-bold"
                        >
                          PIN الطالب
                        </label>
                        <input
                          id="student-pin"
                          name="pin"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{4,6}"
                          minLength={4}
                          maxLength={6}
                          required
                          autoComplete="new-password"
                          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-center tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-3.5 font-black text-white shadow-lg hover:-translate-y-0.5"
                      >
                        إضافة الطالب
                      </button>
                    </form>
                  </div>

                  <div className="rounded-[2rem] border border-fuchsia-100 bg-white p-6 shadow-xl">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-fuchsia-600">
                          قائمة الطلاب
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">
                          {students?.length ?? 0} طالب
                        </h2>
                      </div>

                      <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-black text-fuchsia-700">
                        {activeClass.name}
                      </span>
                    </div>

                    {!students?.length ? (
                      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <div className="text-4xl">👤</div>
                        <p className="mt-3 font-bold text-slate-700">
                          لا يوجد طلاب بعد
                        </p>
                      </div>
                    ) : (
                      <div className="mt-6 space-y-3">
                        {students.map((student) => (
                          <div
                            key={student.id}
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="text-lg font-black text-slate-950">
                                  {student.name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  PIN مخزن بشكل آمن
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row">
                                <form
                                  action={resetStudentPin}
                                  className="flex gap-2"
                                >
                                  <input
                                    type="hidden"
                                    name="student_id"
                                    value={student.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="class_id"
                                    value={activeClass.id}
                                  />
                                  <input
                                    name="pin"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]{4,6}"
                                    minLength={4}
                                    maxLength={6}
                                    required
                                    placeholder="PIN جديد"
                                    autoComplete="new-password"
                                    className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm tracking-[0.2em]"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-white"
                                  >
                                    تغيير PIN
                                  </button>
                                </form>

                                <form action={deleteStudent}>
                                  <input
                                    type="hidden"
                                    name="student_id"
                                    value={student.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="class_id"
                                    value={activeClass.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-xl bg-red-100 px-4 py-2 text-xs font-black text-red-700"
                                  >
                                    حذف
                                  </button>
                                </form>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-xl">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">
                      استيراد جماعي
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      📥 استيراد طلاب من Excel
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      ارفع ملف Excel فيه 3 أعمدة بالترتيب:{" "}
                      <span dir="ltr" className="font-bold">
                        No | Nama | PIN
                      </span>
                      . سيتم إضافة جميع الطلاب إلى هذا الفصل ({" "}
                      <span className="font-bold">{activeClass.name}</span>).
                    </p>
                  </div>

                  <StudentImportForm classId={activeClass.id} />

                  <details className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <summary className="cursor-pointer font-bold text-neutral-800">
                      ℹ️ كيف أنشئ ملف Excel؟
                    </summary>
                    <ol className="mt-3 list-decimal space-y-1.5 pr-5 text-neutral-700">
                      <li>افتح Excel أو Google Sheets.</li>
                      <li>
                        اكتب في الصف الأول ثلاثة عناوين بالضبط:{" "}
                        <span dir="ltr" className="font-bold">
                          No, Nama, PIN
                        </span>
                      </li>
                      <li>
                        ابدأ من الصف الثاني: رقم متسلسل، اسم الطالب، PIN من 4-6
                        أرقام.
                      </li>
                      <li>احفظ الملف بصيغة .xlsx ثم ارفعه هنا.</li>
                    </ol>
                    <p className="mt-3 text-xs text-neutral-500">
                      ملاحظة: PIN يظهر كعمود عادي في Excel، لكنه يُحفظ بشكل
                      آمن (bcrypt) في قاعدة البيانات.
                    </p>
                  </details>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}