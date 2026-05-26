import Link from "next/link";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";
import {
  listAnnouncements,
  type AnnouncementRecord,
} from "@/server/services/announcements/announcement-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const RESIDENT_ANNOUNCEMENT_PAGE_SIZE = 50;

function formatAnnouncementDate(value: string | null) {
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
    timeZone: "America/New_York",
  }).format(date);
}

function documentHref(attachment: AnnouncementRecord["attachments"][number]) {
  return `/api/documents/${attachment.documentId}/signed-url?redirect=1`;
}

function mergeAnnouncementRecords(groups: AnnouncementRecord[][]) {
  const recordsById = new Map<string, AnnouncementRecord>();

  for (const records of groups) {
    for (const record of records) {
      recordsById.set(record.id, record);
    }
  }

  return Array.from(recordsById.values()).sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    return new Date(second.publishAt).getTime() - new Date(first.publishAt).getTime();
  });
}

function AnnouncementList({ records }: { records: AnnouncementRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
        No resident announcements are available right now.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4">
      {records.map((record) => (
        <li key={record.id}>
          <article className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  {record.pinned ? (
                    <span className="rounded-sm border border-[var(--gold)] bg-[#fff8e8] px-2 py-1 text-xs font-semibold text-[#6a4a05]">
                      Pinned
                    </span>
                  ) : null}
                  <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    {record.visibility === "property_specific" ? "Property" : "Community"}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[var(--foreground)]">{record.title}</h2>
              </div>
              <p className="text-sm text-[#4f5f5a]">
                Published {formatAnnouncementDate(record.publishAt)}
              </p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#4f5f5a]">{record.body}</p>
            {record.attachments.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Attachments</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {record.attachments.map((attachment) => (
                    <li key={attachment.documentId}>
                      <Link
                        href={documentHref(attachment)}
                        className="inline-flex min-h-9 items-center rounded-sm border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                      >
                        {attachment.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

export default async function ResidentAnnouncementsPage() {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return null;
  }

  const propertyIds = membershipResult.memberships.map((membership) => membership.property.id);
  const [publicAnnouncements, residentAnnouncements, ...propertyAnnouncementResults] = await Promise.all([
    listAnnouncements({
      communitySlug: DEFAULT_COMMUNITY_SLUG,
      visibility: "public",
      status: "published",
      currentOnly: true,
      pageSize: RESIDENT_ANNOUNCEMENT_PAGE_SIZE,
      pageOffset: 0,
    }),
    listAnnouncements({
      communitySlug: DEFAULT_COMMUNITY_SLUG,
      visibility: "resident",
      status: "published",
      currentOnly: true,
      pageSize: RESIDENT_ANNOUNCEMENT_PAGE_SIZE,
      pageOffset: 0,
    }),
    ...propertyIds.map((propertyId) =>
      listAnnouncements({
        communitySlug: DEFAULT_COMMUNITY_SLUG,
        visibility: "property_specific",
        status: "published",
        propertyId,
        currentOnly: true,
        pageSize: RESIDENT_ANNOUNCEMENT_PAGE_SIZE,
        pageOffset: 0,
      }),
    ),
  ]);

  const propertyRecords = propertyAnnouncementResults.flatMap((result) =>
    result.kind === "records" ? result.records : [],
  );
  const records = mergeAnnouncementRecords([
    publicAnnouncements.kind === "records" ? publicAnnouncements.records : [],
    residentAnnouncements.kind === "records" ? residentAnnouncements.records : [],
    propertyRecords,
  ]);
  const unavailable =
    publicAnnouncements.kind !== "records" ||
    residentAnnouncements.kind !== "records" ||
    propertyAnnouncementResults.some((result) => result.kind !== "records");

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Announcements</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Resident announcements
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Read official HOA announcements available to your active linked properties.
      </p>

      {unavailable ? (
        <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
          Announcements are temporarily unavailable.
        </p>
      ) : (
        <AnnouncementList records={records} />
      )}
    </section>
  );
}
