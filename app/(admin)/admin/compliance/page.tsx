import {
  listComplianceCalendar,
  type ComplianceCalendarFilters,
  type ComplianceEvent,
  type ComplianceStatus,
} from "@/server/services/admin/compliance-calendar";

const statuses: ComplianceStatus[] = [
  "upcoming",
  "in_progress",
  "ready_for_review",
  "completed",
  "blocked",
  "deferred",
  "overdue",
  "legal_review_required",
];

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
    <span
      aria-label={`Status: ${parseStatusLabel(value)}`}
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--foreground)]"
    >
      {parseStatusLabel(value)}
    </span>
  );
}

function effectiveStatus(event: ComplianceEvent): ComplianceStatus {
  if (event.status !== "completed" && event.dueAt && Date.parse(event.dueAt) < Date.now()) {
    return "overdue";
  }

  return event.status;
}

function EventRow({ event }: { event: ComplianceEvent }) {
  const status = effectiveStatus(event);

  return (
    <article className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#4f5f5a]">{event.type}</p>
        </div>
        <StatusPill value={status} />
      </div>
      <p className="mt-2 text-sm text-[#4f5f5a]">{event.description ?? "No additional description."}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#4f5f5a]">
        <span>Due {formatTimestamp(event.dueAt)}</span>
        <span>Priority {event.priority}</span>
        <span>{event.assignedProfileIds.length} assignee{event.assignedProfileIds.length === 1 ? "" : "s"}</span>
        {event.legalSensitive ? <span>Legal sensitive</span> : null}
      </div>
    </article>
  );
}

function MonthView({ events, month }: { events: ComplianceEvent[]; month: string }) {
  const monthStart = new Date(`${month}-01T00:00:00`);
  const firstDay = new Date(monthStart);
  firstDay.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return day;
  });
  const eventsByDay = new Map<string, ComplianceEvent[]>();

  for (const event of events.filter((event) => event.dueAt?.startsWith(month))) {
    if (!event.dueAt) continue;
    const key = event.dueAt.slice(0, 10);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-sm border border-[var(--border)]" aria-label="Monthly compliance calendar">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="border-b border-[var(--border)] bg-[var(--surface)] p-2 text-xs font-semibold uppercase text-[#4f5f5a]">{day}</div>
      ))}
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayEvents = eventsByDay.get(key) ?? [];
        return (
          <div key={key} className="min-h-28 border-b border-r border-[var(--border)] bg-white p-2">
            <time dateTime={key} className="text-xs font-semibold text-[var(--foreground)]">{day.getDate()}</time>
            <div className="mt-2 space-y-1">
              {dayEvents.map((event) => (
                <div key={event.id} className="truncate text-xs text-[var(--foreground)]" title={`${event.title}: ${parseStatusLabel(effectiveStatus(event))}`}>
                  <span className="sr-only">{parseStatusLabel(effectiveStatus(event))}: </span>{event.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
}

function monthHref(month: string, offset: number, getValue: (key: string) => string | undefined) {
  const query = new URLSearchParams({ view: "month", month: shiftMonth(month, offset) });

  for (const key of ["from", "to", "status", "type", "assignedProfileId"]) {
    const currentValue = getValue(key);
    if (currentValue) query.set(key, currentValue);
  }

  return `?${query.toString()}`;
}

type CompliancePageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCompliancePage({ searchParams }: CompliancePageProps) {
  const params = (await searchParams) ?? {};
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const view = value("view") === "month" ? "month" : "list";
  const requestedMonth = value("month");
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const filters: ComplianceCalendarFilters = {
    view,
    from: value("from"),
    to: value("to"),
    status: statuses.includes(value("status") as ComplianceStatus) ? value("status") as ComplianceStatus : null,
    type: value("type") || null,
    assignedProfileId: value("assignedProfileId") || null,
  };
  const result = await listComplianceCalendar({ filters });

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

      <form method="get" className="grid gap-3 rounded-sm border border-[var(--border)] bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-sm text-[var(--foreground)]">View<select name="view" defaultValue={view} className="mt-1 block w-full rounded-sm border border-[var(--border)] bg-white p-2"><option value="list">List</option><option value="month">Month</option></select></label>
        <label className="text-sm text-[var(--foreground)]">From<input name="from" type="date" defaultValue={value("from")} className="mt-1 block w-full rounded-sm border border-[var(--border)] p-2" /></label>
        <label className="text-sm text-[var(--foreground)]">To<input name="to" type="date" defaultValue={value("to")} className="mt-1 block w-full rounded-sm border border-[var(--border)] p-2" /></label>
        <label className="text-sm text-[var(--foreground)]">Status<select name="status" defaultValue={value("status") ?? ""} className="mt-1 block w-full rounded-sm border border-[var(--border)] bg-white p-2"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{parseStatusLabel(status)}</option>)}</select></label>
        <label className="text-sm text-[var(--foreground)]">Type<input name="type" defaultValue={value("type")} className="mt-1 block w-full rounded-sm border border-[var(--border)] p-2" aria-label="Filter by event type" /></label>
        <label className="text-sm text-[var(--foreground)]">Assignee<input name="assignedProfileId" defaultValue={value("assignedProfileId")} className="mt-1 block w-full rounded-sm border border-[var(--border)] p-2" aria-label="Filter by assignee profile ID" /></label>
        <button type="submit" className="rounded-sm bg-[var(--foreground)] px-3 py-2 text-sm font-semibold text-white md:col-span-3 xl:col-span-6 xl:justify-self-start">Apply filters</button>
      </form>

      {view === "month" ? <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{monthLabel(month)}</h2>
          <nav aria-label="Change calendar month" className="flex gap-2">
            <a href={monthHref(month, -1, value)} className="rounded-sm border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">Previous month</a>
            <a href={monthHref(month, 1, value)} className="rounded-sm border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">Next month</a>
          </nav>
        </div>
        <MonthView events={calendar.events} month={month} />
      </div> : <div className="rounded-sm border border-[var(--border)] bg-white p-4">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Events</h2>
        <div className="mt-4 space-y-3">{calendar.events.length === 0 ? <p className="text-sm text-[#4f5f5a]">No compliance events match these filters.</p> : calendar.events.map((event) => <EventRow key={event.id} event={event} />)}</div>
      </div>}

      <div className="rounded-sm border border-[var(--border)] bg-white p-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Tasks</h2>
          <div className="mt-4 space-y-3">
            {calendar.tasks.length === 0 ? (
              <p className="text-sm text-[#4f5f5a]">No compliance tasks are currently assigned.</p>
            ) : (
              calendar.tasks.map((task) => (
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
    </section>
  );
}
