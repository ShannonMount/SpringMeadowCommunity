import {
  archiveAdminEvent,
  cancelAdminEvent,
  createAdminEvent,
  updateAdminEvent,
} from "@/server/actions/events";
import {
  listEvents,
  type EventRecord,
  type EventStatus,
  type EventType,
  type EventVisibility,
} from "@/server/services/events/event-management";
import { getEventStatusLabel, getEventTypeLabel } from "@/lib/public/events";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 25;
const MAX_PAGE_OFFSET = 10000;
const MAX_FILTER_LENGTH = 120;
const MAX_QUERY_LENGTH = 200;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type AdminEventsPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    visibility?: string | string[];
    status?: string | string[];
    type?: string | string[];
    query?: string | string[];
    startsFrom?: string | string[];
    startsTo?: string | string[];
    pageOffset?: string | string[];
    event?: string | string[];
    eventField?: string | string[];
  }>;
};

const fieldErrorIds: Record<string, string> = {
  title: "event-error-title",
  description: "event-error-description",
  type: "event-error-type",
  visibility: "event-error-visibility",
  startsAt: "event-error-startsAt",
  endsAt: "event-error-endsAt",
  location: "event-error-location",
  status: "event-error-status",
  relatedMeetingId: "event-error-relatedMeetingId",
  relatedComplianceEventId: "event-error-relatedComplianceEventId",
  eventId: "event-error-eventId",
  form: "event-error-form",
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boundedText(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length <= maxLength ? trimmed : "";
}

function parsePageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
}

function getNewYorkOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
  );
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateTimeLocalMatch(match: RegExpExecArray) {
  const [, year, month, day, hour, minute, second = "0"] = match;
  const yearValue = Number(year);
  const monthValue = Number(month);
  const dayValue = Number(day);
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);

  return (
    isValidDateParts(yearValue, monthValue, dayValue) &&
    hourValue >= 0 &&
    hourValue <= 23 &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    secondValue >= 0 &&
    secondValue <= 59
  );
}

function dateTimeLocalToNewYorkIso(inputValue: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(inputValue);

  if (!match || !isValidDateTimeLocalMatch(match)) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let instant = localAsUtc - getNewYorkOffsetMs(new Date(localAsUtc));
  instant = localAsUtc - getNewYorkOffsetMs(new Date(instant));

  return new Date(instant).toISOString();
}

function eventFilterDateTimeValue(value: string) {
  if (!value) {
    return null;
  }

  return dateTimeLocalToNewYorkIso(value) ?? value;
}

function eventNotice(value: string | undefined) {
  const notices: Record<string, string> = {
    created: "Event created.",
    updated: "Event updated.",
    cancelled: "Event cancelled.",
    archived: "Event archived.",
    invalid: "Check the event details and try again.",
    denied: "You do not have permission to manage events.",
    signin: "Sign in before managing events.",
    unavailable: "Event management is temporarily unavailable.",
  };

  return value ? notices[value] : null;
}

function fieldErrorId(field: string | undefined) {
  if (!field) {
    return undefined;
  }

  return fieldErrorIds[field] ?? fieldErrorIds.form;
}

function fieldErrorMessage(field: string) {
  const messages: Record<string, string> = {
    title: "Enter an event title.",
    description: "Enter a shorter description.",
    type: "Choose an event type.",
    visibility: "Choose a visibility.",
    startsAt: "Enter a valid start date and time.",
    endsAt: "Enter an end date after the start date.",
    location: "Enter a shorter location.",
    status: "Choose a status.",
    relatedMeetingId: "Enter a valid meeting ID.",
    relatedComplianceEventId: "Enter a valid compliance event ID.",
    eventId: "Choose a valid event.",
    form: "Check the event details.",
  };

  return messages[field] ?? messages.form;
}

function isFieldInvalid(eventStatus: string | undefined, eventField: string | undefined, field: string) {
  return eventStatus === "invalid" && eventField === field;
}

function formatVisibility(value: EventVisibility) {
  const labels: Record<EventVisibility, string> = {
    public: "Public",
    resident: "Resident",
    board: "Board",
    admin: "Admin",
  };

  return labels[value];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
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

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function eventsHref(input: {
  communitySlug: string;
  visibility?: string;
  status?: string;
  type?: string;
  query?: string;
  startsFrom?: string;
  startsTo?: string;
  pageOffset: number;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "visibility", input.visibility);
  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "type", input.type);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "startsFrom", input.startsFrom);
  setOptionalParam(params, "startsTo", input.startsTo);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/events?${params.toString()}`;
}

function FieldError({
  field,
  eventStatus,
  eventField,
}: {
  field: string;
  eventStatus: string | undefined;
  eventField: string | undefined;
}) {
  const invalid = isFieldInvalid(eventStatus, eventField, field);

  return (
    <p id={fieldErrorIds[field]} className="min-h-5 text-xs text-[#8a3d2b]">
      {invalid ? fieldErrorMessage(field) : null}
    </p>
  );
}

function EventFields({
  communitySlug,
  record,
  eventStatus,
  eventField,
}: {
  communitySlug: string;
  record?: EventRecord;
  eventStatus?: string;
  eventField?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <>
      <input type="hidden" name="communitySlug" value={communitySlug} />
      {record ? <input type="hidden" name="eventId" value={record.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={record ? `title-${record.id}` : "title"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Title
          </label>
          <input
            id={record ? `title-${record.id}` : "title"}
            name="title"
            type="text"
            defaultValue={record?.title ?? ""}
            className={inputClass}
            aria-describedby={fieldErrorId("title")}
          />
          <FieldError field="title" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `location-${record.id}` : "location"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Location
          </label>
          <input
            id={record ? `location-${record.id}` : "location"}
            name="location"
            type="text"
            defaultValue={record?.location ?? ""}
            className={inputClass}
            aria-describedby={fieldErrorId("location")}
          />
          <FieldError field="location" eventStatus={eventStatus} eventField={eventField} />
        </div>
      </div>
      <div className="grid gap-1">
        <label htmlFor={record ? `description-${record.id}` : "description"} className="text-xs font-semibold uppercase text-[var(--accent)]">
          Description
        </label>
        <textarea
          id={record ? `description-${record.id}` : "description"}
          name="description"
          rows={record ? 4 : 5}
          defaultValue={record?.description ?? ""}
          className={inputClass}
          aria-describedby={fieldErrorId("description")}
        />
        <FieldError field="description" eventStatus={eventStatus} eventField={eventField} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-1">
          <label htmlFor={record ? `type-${record.id}` : "type"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Type
          </label>
          <select
            id={record ? `type-${record.id}` : "type"}
            name="type"
            defaultValue={record?.type ?? "community_event"}
            className={inputClass}
            aria-describedby={fieldErrorId("type")}
          >
            <option value="hoa_meeting">HOA meeting</option>
            <option value="board_meeting">Board meeting</option>
            <option value="community_event">Community event</option>
            <option value="pool">Pool</option>
            <option value="maintenance_window">Maintenance</option>
            <option value="dues_deadline">Dues deadline</option>
            <option value="other">Other</option>
          </select>
          <FieldError field="type" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `visibility-${record.id}` : "visibility"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Visibility
          </label>
          <select
            id={record ? `visibility-${record.id}` : "visibility"}
            name="visibility"
            defaultValue={record?.visibility ?? "resident"}
            className={inputClass}
            aria-describedby={fieldErrorId("visibility")}
          >
            <option value="public">Public</option>
            <option value="resident">Resident</option>
            <option value="board">Board</option>
            <option value="admin">Admin</option>
          </select>
          <FieldError field="visibility" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `status-${record.id}` : "status"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Status
          </label>
          <select
            id={record ? `status-${record.id}` : "status"}
            name="status"
            defaultValue={record?.status ?? "scheduled"}
            className={inputClass}
            aria-describedby={fieldErrorId("status")}
          >
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <FieldError field="status" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <label className="flex min-h-10 items-center gap-2 pt-5 text-sm font-semibold text-[var(--foreground)]">
          <input name="allDay" type="checkbox" defaultChecked={record?.allDay ?? false} />
          All day
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={record ? `startsAt-${record.id}` : "startsAt"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Start date and time
          </label>
          <input
            id={record ? `startsAt-${record.id}` : "startsAt"}
            name="startsAt"
            type="datetime-local"
            defaultValue={record ? toDateTimeLocal(record.startsAt) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("startsAt")}
          />
          <FieldError field="startsAt" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `endsAt-${record.id}` : "endsAt"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            End date and time
          </label>
          <input
            id={record ? `endsAt-${record.id}` : "endsAt"}
            name="endsAt"
            type="datetime-local"
            defaultValue={record ? toDateTimeLocal(record.endsAt) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("endsAt")}
          />
          <FieldError field="endsAt" eventStatus={eventStatus} eventField={eventField} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={record ? `relatedMeetingId-${record.id}` : "relatedMeetingId"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Related meeting ID
          </label>
          <input
            id={record ? `relatedMeetingId-${record.id}` : "relatedMeetingId"}
            name="relatedMeetingId"
            type="text"
            defaultValue={record?.relatedMeetingId ?? ""}
            className={inputClass}
            aria-describedby={fieldErrorId("relatedMeetingId")}
          />
          <FieldError field="relatedMeetingId" eventStatus={eventStatus} eventField={eventField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `relatedComplianceEventId-${record.id}` : "relatedComplianceEventId"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Related compliance event ID
          </label>
          <input
            id={record ? `relatedComplianceEventId-${record.id}` : "relatedComplianceEventId"}
            name="relatedComplianceEventId"
            type="text"
            defaultValue={record?.relatedComplianceEventId ?? ""}
            className={inputClass}
            aria-describedby={fieldErrorId("relatedComplianceEventId")}
          />
          <FieldError field="relatedComplianceEventId" eventStatus={eventStatus} eventField={eventField} />
        </div>
      </div>
    </>
  );
}

function CreateEventForm({
  communitySlug,
  eventStatus,
  eventField,
}: {
  communitySlug: string;
  eventStatus?: string;
  eventField?: string;
}) {
  return (
    <form action={createAdminEvent} className="mt-6 grid gap-4 border-y border-[var(--border)] py-5">
      <EventFields communitySlug={communitySlug} eventStatus={eventStatus} eventField={eventField} />
      <div>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Create event
        </button>
      </div>
    </form>
  );
}

function EventFilters({
  communitySlug,
  visibility,
  status,
  type,
  query,
  startsFrom,
  startsTo,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  type: string;
  query: string;
  startsFrom: string;
  startsTo: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr_auto]">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="visibility-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Visibility
        </label>
        <select id="visibility-filter" name="visibility" defaultValue={visibility} className={inputClass}>
          <option value="">All</option>
          <option value="public">Public</option>
          <option value="resident">Resident</option>
          <option value="board">Board</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="status-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status-filter" name="status" defaultValue={status} className={inputClass}>
          <option value="">All</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="type-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Type
        </label>
        <select id="type-filter" name="type" defaultValue={type} className={inputClass}>
          <option value="">All</option>
          <option value="hoa_meeting">HOA meeting</option>
          <option value="board_meeting">Board meeting</option>
          <option value="community_event">Community event</option>
          <option value="pool">Pool</option>
          <option value="maintenance_window">Maintenance</option>
          <option value="dues_deadline">Dues deadline</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Search
        </label>
        <input id="query" name="query" type="search" defaultValue={query} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="startsFrom" className="text-xs font-semibold uppercase text-[var(--accent)]">
          From
        </label>
        <input id="startsFrom" name="startsFrom" type="datetime-local" defaultValue={startsFrom} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="startsTo" className="text-xs font-semibold uppercase text-[var(--accent)]">
          To
        </label>
        <input id="startsTo" name="startsTo" type="datetime-local" defaultValue={startsTo} className={inputClass} />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}

function LifecycleButton({
  record,
  communitySlug,
  action,
  label,
}: {
  record: EventRecord;
  communitySlug: string;
  action: typeof cancelAdminEvent | typeof archiveAdminEvent;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <input type="hidden" name="eventId" value={record.id} />
      <button
        type="submit"
        className="inline-flex min-h-9 items-center rounded-sm border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
      >
        {label}
      </button>
    </form>
  );
}

function EventsResult({
  communitySlug,
  records,
  resultKind,
  eventStatus,
  eventField,
}: {
  communitySlug: string;
  records: EventRecord[];
  resultKind: string;
  eventStatus?: string;
  eventField?: string;
}) {
  if (resultKind === "invalid-input") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Check the event filters and try again.
      </p>
    );
  }

  if (resultKind !== "records") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Event list is temporarily unavailable.
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        No events match this view.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-5">
      {records.map((record) => (
        <article key={record.id} className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-[var(--accent-strong)]">
                  {formatVisibility(record.visibility)}
                </span>
                <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-[#4f5f5a]">
                  {getEventStatusLabel(record.status)}
                </span>
                <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-[#4f5f5a]">
                  {getEventTypeLabel(record.type)}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{record.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#4f5f5a]">
                Starts {formatDateTime(record.startsAt)}
                {record.endsAt ? ` / Ends ${formatDateTime(record.endsAt)}` : ""}
              </p>
              {record.location ? (
                <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">Location: {record.location}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <LifecycleButton record={record} communitySlug={communitySlug} action={cancelAdminEvent} label="Cancel" />
              <LifecycleButton record={record} communitySlug={communitySlug} action={archiveAdminEvent} label="Archive" />
            </div>
          </div>
          <form action={updateAdminEvent} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5">
            <EventFields
              communitySlug={communitySlug}
              record={record}
              eventStatus={eventStatus}
              eventField={eventField}
            />
            <div>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                Save changes
              </button>
            </div>
          </form>
        </article>
      ))}
    </div>
  );
}

function Pagination({
  communitySlug,
  visibility,
  status,
  type,
  query,
  startsFrom,
  startsTo,
  pageOffset,
  hasNextPage,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  type: string;
  query: string;
  startsFrom: string;
  startsTo: string;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const previousOffset = Math.max(pageOffset - PAGE_SIZE, 0);
  const nextOffset = Math.min(pageOffset + PAGE_SIZE, MAX_PAGE_OFFSET);
  const baseFilters = { communitySlug, visibility, status, type, query, startsFrom, startsTo };

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {pageOffset > 0 ? (
        <a
          href={eventsHref({ ...baseFilters, pageOffset: previousOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Previous
        </a>
      ) : null}
      {hasNextPage ? (
        <a
          href={eventsHref({ ...baseFilters, pageOffset: nextOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Next
        </a>
      ) : null}
    </div>
  );
}

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  const params = (await searchParams) ?? {};
  const communitySlug = getSingleSearchParam(params.communitySlug) ?? DEFAULT_COMMUNITY_SLUG;
  const eventStatus = getSingleSearchParam(params.event);
  const eventField = getSingleSearchParam(params.eventField);
  const visibility = boundedText(getSingleSearchParam(params.visibility), MAX_FILTER_LENGTH);
  const status = boundedText(getSingleSearchParam(params.status), MAX_FILTER_LENGTH);
  const type = boundedText(getSingleSearchParam(params.type), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params.query), MAX_QUERY_LENGTH);
  const startsFrom = boundedText(getSingleSearchParam(params.startsFrom), MAX_FILTER_LENGTH);
  const startsTo = boundedText(getSingleSearchParam(params.startsTo), MAX_FILTER_LENGTH);
  const startsFromFilter = eventFilterDateTimeValue(startsFrom);
  const startsToFilter = eventFilterDateTimeValue(startsTo);
  const pageOffset = parsePageOffset(getSingleSearchParam(params.pageOffset));
  const eventsResult = await listEvents({
    communitySlug,
    visibility: visibility || null,
    status: status || null,
    type: type || null,
    query: query || null,
    startsFrom: startsFromFilter,
    startsTo: startsToFilter,
    includeArchived: true,
    pageSize: PAGE_SIZE,
    pageOffset,
  });
  const records = eventsResult.kind === "records" ? eventsResult.records : [];

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Events</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Event management</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Create community calendar records and manage their lifecycle.
      </p>
      <p id="event-status" aria-live="polite" className="mt-4 min-h-6 text-sm leading-6 text-[#4f5f5a]">
        {eventNotice(eventStatus)}
      </p>

      <CreateEventForm communitySlug={communitySlug} eventStatus={eventStatus} eventField={eventField} />

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Event listing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Filters narrow the records returned by the authorized event list.
        </p>
        <EventFilters
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          type={type}
          query={query}
          startsFrom={startsFrom}
          startsTo={startsTo}
        />
        <EventsResult
          communitySlug={communitySlug}
          records={records}
          resultKind={eventsResult.kind}
          eventStatus={eventStatus}
          eventField={eventField}
        />
        <Pagination
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          type={type}
          query={query}
          startsFrom={startsFrom}
          startsTo={startsTo}
          pageOffset={pageOffset}
          hasNextPage={eventsResult.kind === "records" && records.length === PAGE_SIZE}
        />
      </div>
    </section>
  );
}
