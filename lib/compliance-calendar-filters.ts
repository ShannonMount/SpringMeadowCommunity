export type CalendarFilterEvent = {
  dueAt: string | null;
  status: string;
  type: string;
  assignedProfileIds: string[];
};

export type CalendarFilterInput = {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  type?: string | null;
  assignedProfileId?: string | null;
};

export function inclusiveEnd(value: string | null | undefined) {
  return value ? Date.parse(`${value}T23:59:59.999Z`) : null;
}

export function filterComplianceEvents<T extends CalendarFilterEvent>(
  events: T[],
  filters: CalendarFilterInput = {},
  now = Date.now(),
) {
  const from = filters.from ? Date.parse(filters.from) : null;
  const to = inclusiveEnd(filters.to);

  return events.filter((event) => {
    const dueAt = event.dueAt ? Date.parse(event.dueAt) : null;
    const effectiveStatus = event.status !== "completed" && dueAt !== null && dueAt < now
      ? "overdue"
      : event.status;

    if (from !== null && (dueAt === null || dueAt < from)) return false;
    if (to !== null && (dueAt === null || dueAt > to)) return false;
    if (filters.status && effectiveStatus !== filters.status) return false;
    if (filters.type && event.type !== filters.type) return false;
    if (filters.assignedProfileId && !event.assignedProfileIds.includes(filters.assignedProfileId)) return false;
    return true;
  });
}
