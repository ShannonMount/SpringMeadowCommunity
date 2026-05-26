import type { Metadata } from "next";
import Link from "next/link";
import {
  eventEmptyState,
  formatEventDate,
  formatEventTimeRange,
  getEventStatusLabel,
  getEventTypeLabel,
} from "@/lib/public/events";
import { listEvents, type EventRecord } from "@/server/services/events/event-management";

const PUBLIC_EVENT_PAGE_SIZE = 50;
const RECENT_PUBLIC_EVENT_WINDOW_DAYS = 45;

export const metadata: Metadata = {
  title: "Events | Spring Meadow Community",
  description: "Public HOA meetings, community events, and deadlines for Spring Meadow Community.",
};

function recentWindowStart() {
  const start = new Date();
  start.setDate(start.getDate() - RECENT_PUBLIC_EVENT_WINDOW_DAYS);

  return start.toISOString();
}

function EventList({ events }: { events: EventRecord[] }) {
  if (events.length === 0) {
    return (
      <div className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6">
        <h2 className="text-2xl font-semibold text-[#17211d]">{eventEmptyState.title}</h2>
        <p className="mt-3 leading-7 text-[#41504a]">{eventEmptyState.description}</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-5 md:grid-cols-2">
      {events.map((event) => {
        const isCancelled = event.status === "cancelled";

        return (
          <li key={event.id}>
            <article
              className={`h-full border bg-white p-5 sm:p-6 ${
                isCancelled ? "border-[#c97d57] bg-[#fff7f1]" : "border-[var(--border)]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-[var(--border)] bg-[#f7f8f5] px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  {getEventTypeLabel(event.type)}
                </span>
                <span
                  className={`border px-2 py-1 text-xs font-semibold ${
                    isCancelled
                      ? "border-[#c97d57] bg-white text-[#8c3f1f]"
                      : "border-[var(--border)] bg-white text-[#41504a]"
                  }`}
                >
                  {getEventStatusLabel(event.status)}
                </span>
              </div>

              <h3 className="mt-4 text-2xl font-semibold text-[#17211d]">{event.title}</h3>

              <dl className="mt-5 grid gap-4 text-sm text-[#41504a] sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-[#17211d]">Date</dt>
                  <dd className="mt-1">
                    <time dateTime={event.startsAt}>{formatEventDate(event.startsAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#17211d]">Time</dt>
                  <dd className="mt-1">{formatEventTimeRange(event)}</dd>
                </div>
                {event.location ? (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-[#17211d]">Location</dt>
                    <dd className="mt-1">{event.location}</dd>
                  </div>
                ) : null}
              </dl>

              {event.description ? (
                <p className="mt-5 leading-7 text-[#41504a]">{event.description}</p>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export default async function EventsPage() {
  const eventsResult = await listEvents({
    visibility: "public",
    startsFrom: recentWindowStart(),
    includeArchived: false,
    pageSize: PUBLIC_EVENT_PAGE_SIZE,
    pageOffset: 0,
  });
  const events = eventsResult.kind === "records" ? eventsResult.records : [];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Community calendar</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Community events
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Browse public HOA meetings, community gatherings, and public deadlines for Spring Meadow
          Community. Private calendar details are not shown on this page.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="public-events-heading"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="public-events-heading" className="text-2xl font-semibold text-[#17211d]">
                Upcoming and recent public events
              </h2>
              <p className="mt-2 leading-7 text-[#41504a]">
                Upcoming and current public events appear first, followed by recent completed
                public events.
              </p>
            </div>
            <Link
              href="/contact"
              className="w-fit border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Ask about an event
            </Link>
          </div>

          {eventsResult.kind === "events-unavailable" ? (
            <p className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6 leading-7 text-[#41504a]">
              Public events are temporarily unavailable.
            </p>
          ) : (
            <EventList events={events} />
          )}
        </div>
      </section>
    </>
  );
}
