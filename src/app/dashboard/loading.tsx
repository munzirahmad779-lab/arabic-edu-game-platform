export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="h-16 animate-pulse rounded-2xl bg-sage-100" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-[2rem] bg-white shadow-sm" />
        <div className="h-48 animate-pulse rounded-[2rem] bg-white shadow-sm" />
      </div>
      <div className="h-64 animate-pulse rounded-[2rem] bg-white shadow-sm" />
    </div>
  );
}
