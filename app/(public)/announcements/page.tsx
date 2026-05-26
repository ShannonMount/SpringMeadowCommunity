import type { Metadata } from "next";
import Link from "next/link";
import {
  listAnnouncements,
  type AnnouncementRecord,
} from "@/server/services/announcements/announcement-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PUBLIC_ANNOUNCEMENT_PAGE_SIZE = 50;

export const metadata: Metadata = {
  title: "Announcements | Spring Meadow Community",
  description: "Official public announcements from Spring Meadow Community.",
};

const announcementEmptyState = {
  title: "No public announcements right now",
  description:
    "Official community announcements will appear here when they are published for public viewing.",
};

function formatAnnouncementDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function documentHref(attachment: AnnouncementRecord["attachments"][number]) {
  return `/api/documents/${attachment.documentId}/signed-url?redirect=1`;
}

function PublicAnnouncementList({ announcements }: { announcements: AnnouncementRecord[] }) {
  if (announcements.length === 0) {
    return (
      <div className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6">
        <h2 className="text-2xl font-semibold text-[#17211d]">{announcementEmptyState.title}</h2>
        <p className="mt-3 leading-7 text-[#41504a]">{announcementEmptyState.description}</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-5">
      {announcements.map((announcement) => (
        <li key={announcement.id}>
          <article className="border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.pinned ? (
                    <span className="border border-[var(--gold)] bg-[#fff8e8] px-2 py-1 text-xs font-semibold text-[#6a4a05]">
                      Pinned
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-[var(--accent)]">
                    Published {formatAnnouncementDate(announcement.publishAt)}
                  </p>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-[#17211d]">{announcement.title}</h3>
              </div>
              {announcement.expiresAt ? (
                <p className="text-sm text-[#5b6a64]">
                  Available through {formatAnnouncementDate(announcement.expiresAt)}
                </p>
              ) : null}
            </div>

            <p className="mt-4 leading-7 text-[#41504a]">{announcement.body}</p>

            {announcement.attachments.length > 0 ? (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-[#17211d]">Public resources</h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {announcement.attachments.map((attachment) => (
                    <li key={attachment.documentId}>
                      <Link
                        href={documentHref(attachment)}
                        className="inline-flex border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
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

export default async function AnnouncementsPage() {
  const announcementsResult = await listAnnouncements({
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    visibility: "public",
    status: "published",
    currentOnly: true,
    pageSize: PUBLIC_ANNOUNCEMENT_PAGE_SIZE,
    pageOffset: 0,
  });
  const announcements = announcementsResult.kind === "records" ? announcementsResult.records : [];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public notices</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Official announcements
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Read public announcements published for Spring Meadow Community. This page only shows
          notices approved for public viewing.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="public-announcements-heading"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="public-announcements-heading" className="text-2xl font-semibold text-[#17211d]">
                Current public announcements
              </h2>
              <p className="mt-2 leading-7 text-[#41504a]">
                Pinned notices appear first, followed by the newest public notices.
              </p>
            </div>
            <Link
              href="/contact"
              className="w-fit border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Contact the HOA
            </Link>
          </div>

          {announcementsResult.kind !== "records" ? (
            <div className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6">
              <h2 className="text-2xl font-semibold text-[#17211d]">
                Announcements are temporarily unavailable.
              </h2>
              <p className="mt-3 leading-7 text-[#41504a]">
                Please try again later or contact the HOA for help.
              </p>
            </div>
          ) : (
            <PublicAnnouncementList announcements={announcements} />
          )}
        </div>
      </section>
    </>
  );
}
