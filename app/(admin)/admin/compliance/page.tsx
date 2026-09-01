import { listComplianceCalendar } from "@/server/services/admin/compliance-calendar";

function formatTimestamp(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(date);
}

function parseStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--foreground)]">
      {parseStatusLabel(value)}
    </span>
  );
}

export default async function AdminCompliancePage() {
  const result = await listComplianceCalendar();

  if (result.kind !== "calendar") {
    return (
      <section className="space-y-4 p-4">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Compliance calendar</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Compliance calendar</h1>
        <p className="text-sm leading-6 text-[#4f5f5a]">
          {result.kind === "unauthenticated"
            ? "Please sign in to view compliance records."
            : result.kind === "profile-unavailable"
              ? result.message
              : result.kind === "permission-denied"
                ? result.message
                : result.message}
        </p>
      </section>
    );
  }

  const calendar = result.calendar;

  return (
    <section className="space-y-6 p-4">
      <div>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Compliance calendar</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Compliance calendar</h1>
        <p className="mt-2 text-sm text-[#4f5f5a]">Last updated {formatTimestamp(calendar.generatedAt)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[#4f5f5a]">Upcoming</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{calendar.upcomingCount}</p>
        </div>
        <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[#4f5f5a]">Overdue</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{calendar.overdueCount}</p>
        </div>
        <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[#4f5f5a]">Legal review</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{calendar.reviewRequiredCount}</p>
        </div>
        <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[#4f5f5a]">Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{calendar.tasks.length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-sm border border-[var(--border)] bg-white p-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Events</h2>
          <div className="mt-4 space-y-3">
            {calendar.events.length === 0 ? (
              <p className="text-sm text-[#4f5f5a]">No compliance events are currently scheduled.</p>
            ) : (
              calendar.events.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#4f5f5a]">{event.type}</p>
                    </div>
                    <StatusPill value={event.status} />
                  </div>
                  <p className="mt-2 text-sm text-[#4f5f5a]">{event.description ?? "No additional description."}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#4f5f5a]">
                    <span>Due {formatTimestamp(event.dueAt)}</span>
                    <span>Priority {event.priority}</span>
                    {event.legalSensitive ? <span>Legal sensitive</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-sm border border-[var(--border)] bg-white p-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Tasks</h2>
          <div className="mt-4 space-y-3">
            {calendar.tasks.length === 0 ? (
              <p className="text-sm text-[#4f5f5a]">No compliance tasks are currently assigned.</p>
            ) : (
              calendar.tasks.slice(0, 10).map((task) => (
                <div key={task.id} className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                    <StatusPill value={task.status} />
                  </div>
                  <p className="mt-2 text-sm text-[#4f5f5a]">{task.description ?? "No task description."}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#4f5f5a]">
                    <span>{task.type}</span>
                    <span>Due {formatTimestamp(task.dueAt)}</span>
                    {task.assignedTo ? <span>Assigned</span> : <span>Unassigned</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
