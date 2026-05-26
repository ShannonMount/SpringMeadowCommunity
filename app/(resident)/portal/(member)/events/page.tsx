import {
  formatEventDate,
  formatEventTimeRange,
  getEventStatusLabel,
  getEventTypeLabel,
} from "@/lib/public/events";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";
import { listEvents, type EventRecord } from "@/server/services/events/event-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const RESIDENT_EVENT_PAGE_SIZE = 50;

function mergeEventRecords(groups: EventRecord[][]) {
  const recordsById = new Map<string, EventRecord>();

  for (const records of groups) {
    for (const record of records) {
      recordsById.set(record.id, record);
    }
  }

  return Array.from(recordsById.values()).sort(
    (first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  );
}

function EventList({ records }: { records: EventRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
        No resident events are available right now.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 lg:grid-cols-2">
      {records.map((record) => {
        const isCancelled = record.status === "cancelled";

        return (
          <li key={record.id}>
            <article
              className={`h-full rounded-sm border p-5 ${
                isCancelled
                  ? "border-[#c97d57] bg-[#fff7f1]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  {getEventTypeLabel(record.type)}
                </span>
                <span
                  className={`rounded-sm border px-2 py-1 text-xs font-semibold ${
                    isCancelled
                      ? "border-[#c97d57] bg-white text-[#8c3f1f]"
                      : "border-[var(--border)] bg-white text-[#4f5f5a]"
                  }`}
                >
                  {getEventStatusLabel(record.status)}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-[var(--foreground)]">{record.title}</h2>
              <dl className="mt-4 grid gap-3 text-sm text-[#4f5f5a] sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Date</dt>
                  <dd className="mt-1">
                    <time dateTime={record.startsAt}>{formatEventDate(record.startsAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Time</dt>
                  <dd className="mt-1">{formatEventTimeRange(record)}</dd>
                </div>
                {record.location ? (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-[var(--foreground)]">Location</dt>
                    <dd className="mt-1">{record.location}</dd>
                  </div>
                ) : null}
              </dl>
              {record.description ? (
                <p className="mt-4 text-sm leading-6 text-[#4f5f5a]">{record.description}</p>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ResidentEventsPage() {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return null;
  }

  const [publicEvents, residentEvents] = await Promise.all([
    listEvents({
      communitySlug: DEFAULT_COMMUNITY_SLUG,
      visibility: "public",
      includeArchived: false,
      upcomingOnly: true,
      pageSize: RESIDENT_EVENT_PAGE_SIZE,
      pageOffset: 0,
    }),
    listEvents({
      communitySlug: DEFAULT_COMMUNITY_SLUG,
      visibility: "resident",
      includeArchived: false,
      upcomingOnly: true,
      pageSize: RESIDENT_EVENT_PAGE_SIZE,
      pageOffset: 0,
    }),
  ]);
  const unavailable = publicEvents.kind !== "records" || residentEvents.kind !== "records";
  const records = mergeEventRecords([
    publicEvents.kind === "records" ? publicEvents.records : [],
    residentEvents.kind === "records" ? residentEvents.records : [],
  ]);

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Events</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Resident events</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Review upcoming community calendar items available to your active linked properties.
      </p>

      {unavailable ? (
        <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
          Events are temporarily unavailable.
        </p>
      ) : (
        <EventList records={records} />
      )}
    </section>
  );
}
