export function MaterialPdf({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">📄</span>
          <span className="truncate text-sm font-bold text-neutral-800">
            {title}
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
        >
          تحميل PDF
        </a>
      </div>
      <div className="relative aspect-[4/5] w-full bg-neutral-100 sm:aspect-[4/3]">
        <iframe
          src={url}
          title={title}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}