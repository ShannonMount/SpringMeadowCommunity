export type EventStatus = "scheduled" | "cancelled" | "completed" | "archived";

export type EventType =
  | "hoa_meeting"
  | "board_meeting"
  | "community_event"
  | "pool"
  | "maintenance_window"
  | "dues_deadline"
  | "other";

export type EventDisplayRecord = {
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  type: EventType;
  status: EventStatus;
};

export const eventEmptyState = {
  title: "No public events right now",
  description:
    "Upcoming public community events will appear here when official dates are published.",
};

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function formatEventTimeRange(event: EventDisplayRecord) {
  if (event.allDay) {
    return "All day";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  const start = formatter.format(new Date(event.startsAt));
  const end = event.endsAt ? formatter.format(new Date(event.endsAt)) : null;

  return end ? `${start} to ${end}` : start;
}

export function getEventTypeLabel(type: EventType) {
  const labels: Record<EventType, string> = {
    hoa_meeting: "HOA meeting",
    board_meeting: "Board meeting",
    community_event: "Community event",
    pool: "Pool",
    maintenance_window: "Maintenance",
    dues_deadline: "Dues deadline",
    other: "Other",
  };

  return labels[type];
}

export function getEventStatusLabel(status: EventStatus) {
  const labels: Record<EventStatus, string> = {
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    completed: "Completed",
    archived: "Archived",
  };

  return labels[status];
}
