function getYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export function hasYouTube(url: string | null | undefined): boolean {
  if (!url) return false;
  return getYouTubeId(url) !== null;
}

export function MaterialYouTube({ url }: { url: string }) {
  const id = getYouTubeId(url);
  if (!id) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-md">
      <div className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}