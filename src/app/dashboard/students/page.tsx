import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createStudent, deleteStudent, resetStudentPin } from "./actions";
import { StudentImportForm } from "./import-form";
import { ClassCard } from "./class-card";
import { ClassTabs } from "./class-tabs";
import { ClassHistoryTab } from "./class-history-tab";
import { PortalLinkBox } from "./portal-link-box";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SearchParams = {
  classId?: string;
  error?: string;
  created?: string;
  updated?: string;
  deleted?: string;
};

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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const isRtl = locale === "ar";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject")
    .eq("teacher_id", user.id)
    .order("name");

  const classList = classes ?? [];
  const classIds = classList.map((cls) => cls.id);

  let allStudents: StudentRow[] = [];
  if (classIds.length > 0) {
    const { data: sData } = await supabase
      .from("students")
      .select("id, name, pin_plain, class_id, created_at")
      .in("class_id", classIds)
      .order("name");
    allStudents = (sData ?? []) as StudentRow[];
  }

  const studentsByClass = new Map<string, StudentRow[]>();
  for (const s of allStudents) {
    if (!studentsByClass.has(s.class_id)) {
      studentsByClass.set(s.class_id, []);
    }
    studentsByClass.get(s.class_id)!.push(s);
  }

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

  const activeClassId = searchParams.classId ?? null;
  const refreshKey = `${searchParams.created ?? ""}${searchParams.updated ?? ""}${searchParams.deleted ?? ""}`;

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[2rem] bg-gradient-to-l from-indigo-700 via-violet-700 to-fuchsia-600 p-6 text-white shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/75">
                {dict.dashboard.students_mgmt}
              </div>
              <h1 className="mt-1 text-3xl font-black">
                {dict.dashboard.stat_students}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                {dict.dashboard.students_mgmt_desc}
              </p>
            </div>
            <Link
              href="/dashboard/classes"
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              {dict.class_detail.back_classes}
            </Link>
          </div>
        </header>

        {classList.length === 0 ? (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center">
            <h2 className="text-xl font-black text-amber-950">
              {dict.classes.empty_title}
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              {dict.classes.empty_desc}
            </p>
            <Link
              href="/dashboard/classes"
              className="mt-5 inline-flex rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white"
            >
              {dict.classes.create_title}
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-700">
                    👥 {dict.login_student.portal_title}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    {dict.login_student.hero_desc}
                  </p>
                  <code
                    dir="ltr"
                    className="mt-2 block truncate rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900"
                  >
                    {portalUrl}
                  </code>
                </div>
                <PortalLinkBox url={portalUrl} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {dict.classes.title}
                </h2>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  {classList.length} {dict.classes.my_classes_count}
                </span>
              </div>

              {classList.map((cls) => {
                const students = studentsByClass.get(cls.id) ?? [];

                const header = (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl text-white shadow-md">
                      🏫
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-black text-neutral-900">
                        {cls.name}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span>
                          {students.length} {dict.dashboard.stat_students}
                        </span>
                        {cls.subject ? (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span>{cls.subject}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                const studentsTab = (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                      <h4 className="text-sm font-bold text-violet-700">
                        + {dict.dashboard.stat_students}
                      </h4>
                      <form
                        action={createStudent}
                        className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <input type="hidden" name="class_id" value={cls.id} />
                        <div>
                          <label
                            htmlFor={`name-${cls.id}`}
                            className="block text-xs font-bold text-neutral-700"
                          >
                            {dict.login_student.label_name}
                          </label>
                          <input
                            id={`name-${cls.id}`}
                            name="name"
                            type="text"
                            maxLength={100}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`pin-${cls.id}`}
                            className="block text-xs font-bold text-neutral-700"
                          >
                            {dict.login_student.label_pin}
                          </label>
                          <input
                            id={`pin-${cls.id}`}
                            name="pin"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{4,6}"
                            minLength={4}
                            maxLength={6}
                            required
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm tracking-[0.3em] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <button
                          type="submit"
                          className="h-fit self-end rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-black text-white shadow transition hover:-translate-y-0.5"
                        >
                          {dict.common.save}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-neutral-800">
                          {dict.dashboard.stat_students}
                        </h4>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                          {students.length}
                        </span>
                      </div>

                      {students.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                          <div className="text-4xl">👤</div>
                          <p className="mt-2 text-sm font-bold text-neutral-700">
                            {dict.common.no_data}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {students.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-black text-slate-950">
                                    {s.name}
                                  </p>
                                  {s.pin_plain ? (
                                    <p className="mt-1 text-xs">
                                      <span className="text-slate-500">
                                        {dict.login_student.label_pin}:
                                      </span>{" "}
                                      <span
                                        dir="ltr"
                                        className="rounded bg-emerald-100 px-2 py-0.5 font-mono font-black tracking-[0.2em] text-emerald-800"
                                      >
                                        {s.pin_plain}
                                      </span>
                                    </p>
                                  ) : null}
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
                                    value={cls.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg bg-red-100 px-3 py-1.5 text-[10px] font-black text-red-700 transition hover:bg-red-200"
                                  >
                                    {dict.common.delete}
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
                                  value={cls.id}
                                />
                                <input
                                  name="pin"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]{4,6}"
                                  minLength={4}
                                  maxLength={6}
                                  required
                                  placeholder={dict.login_student.label_pin}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-xs tracking-[0.2em]"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-cyan-600"
                                >
                                  {dict.common.save}
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const importTab = (
                  <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                    <h4 className="text-sm font-bold text-emerald-700">
                      📥 Import
                    </h4>
                    <StudentImportForm classId={cls.id} />
                  </div>
                );

                const historyTab = <ClassHistoryTab classId={cls.id} />;

                return (
                  <ClassCard
                    key={`${cls.id}-${refreshKey}`}
                    classId={cls.id}
                    header={header}
                    defaultOpen={activeClassId === cls.id}
                  >
                    <ClassTabs
                      tabs={[
                        {
                          key: "students",
                          label: dict.dashboard.stat_students,
                          icon: "👥",
                          content: studentsTab,
                        },
                        {
                          key: "import",
                          label: "Import",
                          icon: "📥",
                          content: importTab,
                        },
                        {
                          key: "history",
                          label: dict.dashboard.stat_games,
                          icon: "📊",
                          content: historyTab,
                        },
                      ]}
                    />
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