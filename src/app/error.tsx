"use client";

export default function Error({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-sm text-neutral-600">
        حدث خطأ أثناء معالجة الطلب. حاول مرة أخرى.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        المحاولة مرة أخرى
      </button>
    </div>
  );
}
