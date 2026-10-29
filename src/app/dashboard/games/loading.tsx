export default function GamesLoading() {
  return (
    <div className="space-y-8" aria-label="Loading games">
      <div className="h-24 animate-pulse rounded-[2rem] bg-sage-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-56 animate-pulse rounded-3xl bg-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
