export default function RoomLoading() {
  return (
    <div className="space-y-6" aria-label="Loading game room">
      <div className="h-40 animate-pulse rounded-[2rem] bg-indigo-100" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="h-80 animate-pulse rounded-[2rem] bg-white shadow-sm" />
        <div className="h-80 animate-pulse rounded-[2rem] bg-white shadow-sm" />
      </div>
    </div>
  );
}
