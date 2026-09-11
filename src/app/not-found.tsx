import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold">الصفحة غير موجودة</h1>
      <Link href="/" className="text-sm text-neutral-600 underline">
        العودة إلى الصفحة الرئيسية
      </Link>
    </div>
  );
}
