import Link from "next/link";
import { redirect } from "next/navigation";
import { loginStudent } from "../actions";
import { getStudentSession } from "@/lib/student-auth";

type SearchParams = {
  error?: string;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid":
      return "الاسم أو رمز PIN غير صحيح. حاول مرة أخرى.";
    case "invalid_length":
      return "الاسم مطلوب، ورمز PIN يجب أن يكون بين 4 و6 أرقام.";
    case "too_many":
      return "محاولات دخول كثيرة. انتظر 5 دقائق ثم حاول مجددًا.";
    case "network":
      return "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.";
    default:
      return null;
  }
}

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getStudentSession();
  if (session) {
    redirect("/student");
  }

  const errorMessage = getErrorMessage(searchParams.error);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="text-5xl">📚</div>
          <h1 className="mt-3 text-3xl font-black">بوابة الطالب</h1>
          <p className="mt-2 text-sm text-white/80">
            أدخل اسمك ورمز PIN للوصول إلى موادك الدراسية.
          </p>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              {errorMessage}
            </div>
          ) : null}

          <form action={loginStudent} className="space-y-5">
            <div>
              <label
                htmlFor="student-name"
                className="block text-sm font-bold text-neutral-800"
              >
                الاسم
              </label>
              <input
                id="student-name"
                name="name"
                type="text"
                required
                maxLength={100}
                autoComplete="off"
                placeholder="مثال: أحمد"
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div>
              <label
                htmlFor="student-pin"
                className="block text-sm font-bold text-neutral-800"
              >
                رمز PIN
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
                autoComplete="off"
                placeholder="••••"
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              <p className="mt-2 text-xs text-neutral-500">
                اطلب رمز PIN من معلمك إذا لم تكن تعرفه.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-violet-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-700"
            >
              تسجيل الدخول
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-white/80 underline hover:text-white"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}