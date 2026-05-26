export default function ResidentDashboardLoading() {
  return (
    <section aria-busy="true">
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Dashboard</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Resident dashboard</h1>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="min-h-48 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Loading dashboard summary</p>
          <p className="mt-2 text-sm leading-6 text-[#4f5f5a]">
            Your property summary will appear here shortly.
          </p>
        </div>
        <div className="min-h-48 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Loading community updates</p>
          <p className="mt-2 text-sm leading-6 text-[#4f5f5a]">
            Announcements and upcoming events will appear here shortly.
          </p>
        </div>
      </div>
    </section>
  );
}
