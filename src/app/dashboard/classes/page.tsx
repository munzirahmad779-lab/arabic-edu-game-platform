import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClass, deleteClass, updateClass } from "./actions";

type SearchParams = {
  error?: string;
  edit?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_name":
      return "يجب أن يكون اسم الفصل بين حرف واحد و100 حرف.";
    case "invalid_update":
      return "بيانات تعديل الفصل غير صحيحة.";
    case "invalid_delete":
      return "بيانات حذف الفصل غير صحيحة.";
    case "duplicate":
      return "يوجد فصل بهذا الاسم لديك بالفعل.";
    case "create_failed":
      return "تعذر إنشاء الفصل. حاول مرة أخرى.";
    case "update_failed":
      return "تعذر تعديل الفصل. حاول مرة أخرى.";
    case "delete_failed":
      return "تعذر حذف الفصل. ربما توجد بيانات مرتبطة به.";
    case "not_found":
      return "الفصل غير موجود أو لا تملك صلاحية الوصول إليه.";
    default:
      return null;
  }
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, created_at, updated_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("تعذر تحميل الفصول الدراسية.");
  }

  const errorMessage = getErrorMessage(searchParams.error);
  const editingClass = classes.find((item) => item.id === searchParams.edit);

  return (
    <main className="space-y-8" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            منصة التعليم العربية
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            الفصول الدراسية
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            أنشئ فصولك الدراسية وأدرها من مكان واحد.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          لوحة التحكم
        </Link>
      </header>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">إنشاء فصل جديد</h2>
          <p className="mt-1 text-sm text-neutral-500">
            أنشئ فصلًا لاستخدامه لاحقًا مع الطلاب والأنشطة والألعاب.
          </p>
        </div>

        <form action={createClass} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="class-name" className="sr-only">
            اسم الفصل
          </label>

          <input
            id="class-name"
            name="name"
            type="text"
            required
            minLength={1}
            maxLength={100}
            placeholder="مثال: الصف السابع - أ"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />

          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            إنشاء الفصل
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">فصولي</h2>
            <p className="mt-1 text-sm text-neutral-500">
              الفصول التي يملكها حسابك الحالي.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">
            {classes.length} فصل
          </span>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="font-medium text-neutral-700">
              لا توجد فصول دراسية بعد.
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              أنشئ أول فصل للبدء.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                {editingClass?.id === item.id ? (
                  <form action={updateClass} className="space-y-4">
                    <input type="hidden" name="id" value={item.id} />

                    <div>
                      <label
                        htmlFor={`edit-${item.id}`}
                        className="block text-sm font-medium"
                      >
                        اسم الفصل
                      </label>

                      <input
                        id={`edit-${item.id}`}
                        name="name"
                        type="text"
                        required
                        maxLength={100}
                        defaultValue={item.name}
                        className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                      >
                        حفظ
                      </button>

                      <Link
                        href="/dashboard/classes"
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                      >
                        إلغاء
                      </Link>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {item.name}
                        </h3>

                        <p className="mt-2 text-sm text-neutral-500">
                          تم الإنشاء{" "}
                          {new Date(item.created_at).toLocaleDateString("ar-EG")}
                        </p>
                      </div>

                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                        فصل
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/classes?classId=${item.id}`}
                        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                      >
                        فتح الفصل
                      </Link>

                      <Link
                        href={`/dashboard/classes?edit=${item.id}`}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                      >
                        تعديل
                      </Link>

                      <form action={deleteClass}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        >
                          حذف
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
