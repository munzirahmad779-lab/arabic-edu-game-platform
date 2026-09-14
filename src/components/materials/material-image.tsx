export function MaterialImage({
  url,
  alt,
}: {
  url: string;
  alt: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="max-h-[600px] w-full object-contain"
        loading="lazy"
      />
    </figure>
  );
}