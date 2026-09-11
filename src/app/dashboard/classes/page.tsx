import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";

type SearchParams = {
  error?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_name":
      return "أدخل اسمًا للفصل لا يتجاوز 100 حرف.";
    case "duplicate":
      return "يوجد فصل بهذا الاسم لديك بالفعل.";
    case "create_failed":
      return "تعذر إنشاء الفصل. حاول مرة أخرى.";
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

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, created_at, updated_at")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("تعذر تحميل الفصول الدراسية.");
  }

  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الفصول الدراسية</h1>
          <p className="mt-1 text-sm text-neutral-600">
            أنشئ فصولك الدراسية وأدرها من هنا.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          لوحة التحكم
        </Link>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">إنشاء فصل جديد</h2>
        <form action={createClass} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="class-name" className="sr-only">
            اسم الفصل
          </label>
          <input
            id="class-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="مثال: النحو الأساسي"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            إنشاء الفصل
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">فصولي</h2>
          <span className="text-sm text-neutral-500">{classes.length} فصل</span>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            لا توجد فصول بعد. أنشئ أول فصل للبدء.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold">{item.name}</h3>
                <p className="mt-2 text-xs text-neutral-500" dir="ltr">
                  {item.id}
                </p>
                <p className="mt-3 text-xs text-neutral-500">
                  تم الإنشاء: {new Date(item.created_at).toLocaleDateString("ar-EG")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
