import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createStudent, deleteStudent, resetStudentPin } from "./actions";
import { StudentImportForm } from "./import-form";
import { ClassCard } from "./class-card";
import { PortalLinkBox } from "./portal-link-box";

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
      type: "success" as const,
      text: "✓ تمت إضافة الطالب.",
    };
  }
  if (searchParams.updated === "1") {
    return { type: "success" as const, text: "✓ تم تحديث PIN الطالب." };
  }
  if (searchParams.deleted === "1") {
    return { type: "success" as const, text: "✓ تم حذف الطالب." };
  }
  switch (searchParams.error) {
    case "invalid":
      return {
        type: "error" as const,
        text: "أدخل اسم الطالب وPIN صحيحًا من 4 إلى 6 أرقام.",
      };
    case "invalid_name":
      return { type: "error" as const, text: "اسم الطالب غير صحيح." };
    case "invalid_pin":
      return {
        type: "error" as const,
        text: "يجب أن يكون PIN من 4 إلى 6 أرقام.",
      };
    case "duplicate":
      return {
        type: "error" as const,
        text: "يوجد طالب بهذا الاسم في هذا الفصل.",
      };
    case "invalid_class":
      return {
        type: "error" as const,
        text: "الفصل غير موجود أو لا تملك صلاحية الوصول إليه.",
      };
    case "student_not_found":
      return { type: "error" as const, text: "الطالب غير موجود." };
    default:
      return null;
  }
}

type StudentRow = {
  id: string;
  name: string;
  pin_plain: string | null;
  class_id: string;
  created_at: string;
};

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
    .select("id, name, subject")
    .eq("teacher_id", user.id)
    .order("name");

  if (classesError) {
    throw new Error("تعذر تحميل الفصول.");
  }

  const classList = classes ?? [];
  const classIds = classList.map((c) => c.id);

  let allStudents: StudentRow[] = [];
  if (classIds.length > 0) {
    const { data: sData, error: sError } = await supabase
      .from("students")
      .select("id, name, pin_plain, class_id, created_at")
      .in("class_id", classIds)
      .order("name");

    if (sError) {
      throw new Error("تعذر تحميل الطلاب.");
    }
    allStudents = (sData ?? []) as StudentRow[];
  }

  const studentsByClass = new Map<string, StudentRow[]>();
  for (const s of allStudents) {
    if (!studentsByClass.has(s.class_id)) {
      studentsByClass.set(s.class_id, []);
    }
    studentsByClass.get(s.class_id)!.push(s);
  }

  // Build portal URL
  const envPublicUrl = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  let portalUrl: string;

  if (envPublicUrl) {
    portalUrl = `${envPublicUrl}/student/login`;
  } else {
    const headersList = await headers();
    const host = headersList.get("host")?.trim() ?? "";
    const xfp = headersList.get("x-forwarded-proto")?.trim();
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.") ||
      /^\d+\.\d+\.\d+\.\d+/.test(host);
    const proto = xfp ?? (isLocal ? "http" : "https");
    portalUrl = host
      ? `${proto}://${host}/student/login`
      : "http://localhost:3000/student/login";
  }

  const message = getMessage(searchParams);
  const activeClassId = searchParams.classId ?? null;
  const refreshKey = `${searchParams.created ?? ""}${searchParams.updated ?? ""}${searchParams.deleted ?? ""}`;

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 sm:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[2rem] bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/75">
                إدارة الطلاب
              </div>
              <h1 className="mt-1 text-3xl font-black">طلاب الفصول</h1>
              <p className="mt-2 text-sm text-white/80">
                أنشئ هوية الطالب داخل الفصل، وشارك بوابة الطالب معه.
              </p>
            </div>
            <Link
              href="/dashboard/classes"
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
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

        {classList.length === 0 ? (
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
            {/* Portal Link Banner */}
            <section className="rounded-[2rem] border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-5 shadow-lg sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-700">
                    بوابة الطالب
                  </p>
                  <h2 className="mt-1 text-xl font-black text-emerald-950">
                    👥 رابط دخول الطلاب
                  </h2>
                  <p className="mt-1 text-sm text-emerald-800">
                    شارك هذا الرابط مع طلابك — يدخلون بأسمائهم وأرقام PIN
                    الخاصة بهم.
                  </p>
                  <code
                    dir="ltr"
                    className="mt-3 block truncate rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900"
                  >
                    {portalUrl}
                  </code>
                </div>
                <PortalLinkBox url={portalUrl} />
              </div>
            </section>

            {/* Classes list */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">الفصول</h2>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  {classList.length} فصل
                </span>
              </div>

              {classList.map((c) => {
                const students = studentsByClass.get(c.id) ?? [];

                const header = (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl text-white shadow-md">
                      🏫
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-black text-neutral-900">
                        {c.name}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span>{students.length} طالب</span>
                        {c.subject ? (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span>{c.subject}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <ClassCard
                    key={`${c.id}-${refreshKey}`}
                    classId={c.id}
                    header={header}
                    defaultOpen={activeClassId === c.id}
                  >
                    {/* Add student */}
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
                      <h4 className="text-sm font-bold text-violet-700">
                        ➕ إضافة طالب
                      </h4>
                      <p className="mt-1 text-xs text-violet-600">
                        اختر PIN من 4 إلى 6 أرقام، ثم أعطه للطالب.
                      </p>
                      <form
                        action={createStudent}
                        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <input type="hidden" name="class_id" value={c.id} />
                        <div>
                          <label
                            htmlFor={`name-${c.id}`}
                            className="block text-xs font-bold text-neutral-700"
                          >
                            اسم الطالب
                          </label>
                          <input
                            id={`name-${c.id}`}
                            name="name"
                            type="text"
                            maxLength={100}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`pin-${c.id}`}
                            className="block text-xs font-bold text-neutral-700"
                          >
                            PIN
                          </label>
                          <input
                            id={`pin-${c.id}`}
                            name="pin"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{4,6}"
                            minLength={4}
                            maxLength={6}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <button
                          type="submit"
                          className="h-fit self-end rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5"
                        >
                          إضافة
                        </button>
                      </form>
                    </div>

                    {/* Students list */}
                    <div className="rounded-2xl border border-fuchsia-100 bg-white p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-fuchsia-700">
                          قائمة الطلاب
                        </h4>
                        <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700">
                          {students.length} طالب
                        </span>
                      </div>

                      {students.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                          <div className="text-4xl">👤</div>
                          <p className="mt-2 text-sm font-bold text-slate-700">
                            لا يوجد طلاب بعد
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {students.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-black text-slate-950">
                                    {s.name}
                                  </p>
                                  {s.pin_plain ? (
                                    <p className="mt-1 text-xs">
                                      <span className="text-slate-500">
                                        PIN:
                                      </span>{" "}
                                      <span
                                        dir="ltr"
                                        className="rounded bg-emerald-100 px-2 py-0.5 font-mono font-black tracking-[0.2em] text-emerald-800"
                                      >
                                        {s.pin_plain}
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-[10px] text-slate-400">
                                      PIN مخزن بشكل آمن
                                    </p>
                                  )}
                                </div>
                                <form action={deleteStudent}>
                                  <input
                                    type="hidden"
                                    name="student_id"
                                    value={s.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="class_id"
                                    value={c.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg bg-red-100 px-3 py-1.5 text-[10px] font-black text-red-700 transition hover:bg-red-200"
                                  >
                                    حذف
                                  </button>
                                </form>
                              </div>

                              <form
                                action={resetStudentPin}
                                className="mt-2 flex gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="student_id"
                                  value={s.id}
                                />
                                <input
                                  type="hidden"
                                  name="class_id"
                                  value={c.id}
                                />
                                <input
                                  name="pin"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]{4,6}"
                                  minLength={4}
                                  maxLength={6}
                                  required
                                  placeholder="PIN baru"
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-xs tracking-[0.2em]"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-cyan-600"
                                >
                                  تغيير PIN
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Import massal */}
                    <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                      <h4 className="text-sm font-bold text-emerald-700">
                        📥 إضافة جماعية (Import)
                      </h4>
                      <p className="mt-1 text-xs text-emerald-600">
                        الصق أسماء الطلاب (اسم واحد لكل سطر)، وسيُنشئ النظام
                        PIN تلقائيًا لكل طالب.
                      </p>
                      <StudentImportForm classId={c.id} />
                    </div>
                  </ClassCard>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}