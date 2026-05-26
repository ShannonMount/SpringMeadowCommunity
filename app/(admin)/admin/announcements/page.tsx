import {
  archiveAdminAnnouncement,
  createAdminAnnouncement,
  expireAdminAnnouncement,
  publishAdminAnnouncement,
  updateAdminAnnouncement,
} from "@/server/actions/announcements";
import {
  listAnnouncements,
  type AnnouncementRecord,
  type AnnouncementStatus,
  type AnnouncementVisibility,
} from "@/server/services/announcements/announcement-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 25;
const MAX_PAGE_OFFSET = 10000;
const MAX_FILTER_LENGTH = 120;
const MAX_QUERY_LENGTH = 200;

type AdminAnnouncementsPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    visibility?: string | string[];
    status?: string | string[];
    query?: string | string[];
    pageOffset?: string | string[];
    announcement?: string | string[];
    announcementField?: string | string[];
  }>;
};

const fieldErrorIds: Record<string, string> = {
  title: "announcement-error-title",
  body: "announcement-error-body",
  visibility: "announcement-error-visibility",
  propertyIds: "announcement-error-propertyIds",
  publishAt: "announcement-error-publishAt",
  expiresAt: "announcement-error-expiresAt",
  attachmentDocumentIds: "announcement-error-attachmentDocumentIds",
  form: "announcement-error-form",
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

function announcementNotice(value: string | undefined) {
  const notices: Record<string, string> = {
    created: "Announcement created.",
    updated: "Announcement updated.",
    published: "Announcement published.",
    expired: "Announcement expired.",
    archived: "Announcement archived.",
    invalid: "Check the announcement details and try again.",
    denied: "You do not have permission to manage announcements.",
    signin: "Sign in before managing announcements.",
    unavailable: "Announcement management is temporarily unavailable.",
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
    title: "Enter a title.",
    body: "Enter announcement body text.",
    visibility: "Choose a visibility.",
    propertyIds: "Enter valid property IDs for property-specific announcements.",
    publishAt: "Enter a valid publish date.",
    expiresAt: "Enter an expiration date after the publish date.",
    attachmentDocumentIds: "Enter valid document IDs.",
    form: "Check the announcement details.",
  };

  return messages[field] ?? messages.form;
}

function isFieldInvalid(status: string | undefined, field: string | undefined, current: string) {
  return status === "invalid" && field === current;
}

function formatVisibility(value: AnnouncementVisibility) {
  const labels: Record<AnnouncementVisibility, string> = {
    public: "Public",
    resident: "Resident",
    board: "Board",
    property_specific: "Property specific",
    admin: "Admin",
  };

  return labels[value];
}

function formatStatus(value: AnnouncementStatus) {
  const labels: Record<AnnouncementStatus, string> = {
    draft: "Draft",
    published: "Published",
    expired: "Expired",
    archived: "Archived",
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

function listValue(values: string[]) {
  return values.join("\n");
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function announcementsHref(input: {
  communitySlug: string;
  visibility?: string;
  status?: string;
  query?: string;
  pageOffset: number;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "visibility", input.visibility);
  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "query", input.query);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/announcements?${params.toString()}`;
}

function FieldError({
  field,
  announcementStatus,
  announcementField,
}: {
  field: string;
  announcementStatus: string | undefined;
  announcementField: string | undefined;
}) {
  const invalid = isFieldInvalid(announcementStatus, announcementField, field);

  return (
    <p id={fieldErrorIds[field]} className="min-h-5 text-xs text-[#8a3d2b]">
      {invalid ? fieldErrorMessage(field) : null}
    </p>
  );
}

function AnnouncementFields({
  communitySlug,
  record,
  announcementStatus,
  announcementField,
}: {
  communitySlug: string;
  record?: AnnouncementRecord;
  announcementStatus?: string;
  announcementField?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <>
      <input type="hidden" name="communitySlug" value={communitySlug} />
      {record ? <input type="hidden" name="announcementId" value={record.id} /> : null}
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
          <FieldError field="title" announcementStatus={announcementStatus} announcementField={announcementField} />
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
            <option value="property_specific">Property specific</option>
            <option value="admin">Admin</option>
          </select>
          <FieldError field="visibility" announcementStatus={announcementStatus} announcementField={announcementField} />
        </div>
      </div>
      <div className="grid gap-1">
        <label htmlFor={record ? `body-${record.id}` : "body"} className="text-xs font-semibold uppercase text-[var(--accent)]">
          Body
        </label>
        <textarea
          id={record ? `body-${record.id}` : "body"}
          name="body"
          rows={record ? 4 : 6}
          defaultValue={record?.body ?? ""}
          className={inputClass}
          aria-describedby={fieldErrorId("body")}
        />
        <FieldError field="body" announcementStatus={announcementStatus} announcementField={announcementField} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-1">
          <label htmlFor={record ? `status-${record.id}` : "status"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Status
          </label>
          <select
            id={record ? `status-${record.id}` : "status"}
            name="status"
            defaultValue={record?.status ?? "draft"}
            className={inputClass}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `publishAt-${record.id}` : "publishAt"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Publish date
          </label>
          <input
            id={record ? `publishAt-${record.id}` : "publishAt"}
            name="publishAt"
            type="datetime-local"
            defaultValue={record ? toDateTimeLocal(record.publishAt) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("publishAt")}
          />
          <FieldError field="publishAt" announcementStatus={announcementStatus} announcementField={announcementField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `expiresAt-${record.id}` : "expiresAt"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Expiration date
          </label>
          <input
            id={record ? `expiresAt-${record.id}` : "expiresAt"}
            name="expiresAt"
            type="datetime-local"
            defaultValue={record ? toDateTimeLocal(record.expiresAt) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("expiresAt")}
          />
          <FieldError field="expiresAt" announcementStatus={announcementStatus} announcementField={announcementField} />
        </div>
        <label className="flex min-h-10 items-center gap-2 pt-5 text-sm font-semibold text-[var(--foreground)]">
          <input name="pinned" type="checkbox" defaultChecked={record?.pinned ?? false} />
          Pinned
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={record ? `propertyIds-${record.id}` : "propertyIds"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Property IDs
          </label>
          <textarea
            id={record ? `propertyIds-${record.id}` : "propertyIds"}
            name="propertyIds"
            rows={3}
            defaultValue={record ? listValue(record.propertyIds) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("propertyIds")}
          />
          <FieldError field="propertyIds" announcementStatus={announcementStatus} announcementField={announcementField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={record ? `attachmentDocumentIds-${record.id}` : "attachmentDocumentIds"} className="text-xs font-semibold uppercase text-[var(--accent)]">
            Attachment document IDs
          </label>
          <textarea
            id={record ? `attachmentDocumentIds-${record.id}` : "attachmentDocumentIds"}
            name="attachmentDocumentIds"
            rows={3}
            defaultValue={record ? listValue(record.attachments.map((attachment) => attachment.documentId)) : ""}
            className={inputClass}
            aria-describedby={fieldErrorId("attachmentDocumentIds")}
          />
          <FieldError
            field="attachmentDocumentIds"
            announcementStatus={announcementStatus}
            announcementField={announcementField}
          />
        </div>
      </div>
    </>
  );
}

function CreateAnnouncementForm({
  communitySlug,
  announcementStatus,
  announcementField,
}: {
  communitySlug: string;
  announcementStatus?: string;
  announcementField?: string;
}) {
  return (
    <form action={createAdminAnnouncement} className="mt-6 grid gap-4 border-y border-[var(--border)] py-5">
      <AnnouncementFields
        communitySlug={communitySlug}
        announcementStatus={announcementStatus}
        announcementField={announcementField}
      />
      <div>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Create announcement
        </button>
      </div>
    </form>
  );
}

function AnnouncementFilters({
  communitySlug,
  visibility,
  status,
  query,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  query: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 md:grid-cols-[1fr_1fr_2fr_auto]">
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
          <option value="property_specific">Property specific</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="status-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status-filter" name="status" defaultValue={status} className={inputClass}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Search
        </label>
        <input id="query" name="query" type="search" defaultValue={query} className={inputClass} />
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
  record: AnnouncementRecord;
  communitySlug: string;
  action: typeof publishAdminAnnouncement | typeof expireAdminAnnouncement | typeof archiveAdminAnnouncement;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <input type="hidden" name="announcementId" value={record.id} />
      <button
        type="submit"
        className="inline-flex min-h-9 items-center rounded-sm border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
      >
        {label}
      </button>
    </form>
  );
}

function AnnouncementsResult({
  communitySlug,
  records,
  resultKind,
  announcementStatus,
  announcementField,
}: {
  communitySlug: string;
  records: AnnouncementRecord[];
  resultKind: string;
  announcementStatus?: string;
  announcementField?: string;
}) {
  if (resultKind === "invalid-input") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Check the announcement filters and try again.
      </p>
    );
  }

  if (resultKind !== "records") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Announcement list is temporarily unavailable.
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        No announcements match this view.
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
                  {formatStatus(record.status)}
                </span>
                {record.pinned ? (
                  <span className="rounded-sm border border-[var(--gold)] bg-[#fff8e8] px-2 py-1 text-[#6a4a05]">
                    Pinned
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{record.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#4f5f5a]">
                Publishes {formatDateTime(record.publishAt)}
                {record.expiresAt ? ` / Expires ${formatDateTime(record.expiresAt)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LifecycleButton record={record} communitySlug={communitySlug} action={publishAdminAnnouncement} label="Publish" />
              <LifecycleButton record={record} communitySlug={communitySlug} action={expireAdminAnnouncement} label="Expire" />
              <LifecycleButton record={record} communitySlug={communitySlug} action={archiveAdminAnnouncement} label="Archive" />
            </div>
          </div>
          <form action={updateAdminAnnouncement} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5">
            <AnnouncementFields
              communitySlug={communitySlug}
              record={record}
              announcementStatus={announcementStatus}
              announcementField={announcementField}
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
  query,
  pageOffset,
  hasNextPage,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  query: string;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const previousOffset = Math.max(pageOffset - PAGE_SIZE, 0);
  const nextOffset = Math.min(pageOffset + PAGE_SIZE, MAX_PAGE_OFFSET);
  const baseFilters = { communitySlug, visibility, status, query };

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {pageOffset > 0 ? (
        <a
          href={announcementsHref({ ...baseFilters, pageOffset: previousOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Previous
        </a>
      ) : null}
      {hasNextPage ? (
        <a
          href={announcementsHref({ ...baseFilters, pageOffset: nextOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Next
        </a>
      ) : null}
    </div>
  );
}

export default async function AdminAnnouncementsPage({ searchParams }: AdminAnnouncementsPageProps) {
  const params = (await searchParams) ?? {};
  const communitySlug = getSingleSearchParam(params.communitySlug) ?? DEFAULT_COMMUNITY_SLUG;
  const announcementStatus = getSingleSearchParam(params.announcement);
  const announcementField = getSingleSearchParam(params.announcementField);
  const visibility = boundedText(getSingleSearchParam(params.visibility), MAX_FILTER_LENGTH);
  const status = boundedText(getSingleSearchParam(params.status), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params.query), MAX_QUERY_LENGTH);
  const pageOffset = parsePageOffset(getSingleSearchParam(params.pageOffset));
  const announcementsResult = await listAnnouncements({
    communitySlug,
    visibility: visibility || null,
    status: status || null,
    query: query || null,
    currentOnly: false,
    pageSize: PAGE_SIZE,
    pageOffset,
  });
  const records = announcementsResult.kind === "records" ? announcementsResult.records : [];

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Announcements</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Announcement management</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Create official HOA notices and manage their publication lifecycle.
      </p>
      <p id="announcement-status" aria-live="polite" className="mt-4 min-h-6 text-sm leading-6 text-[#4f5f5a]">
        {announcementNotice(announcementStatus)}
      </p>

      <CreateAnnouncementForm
        communitySlug={communitySlug}
        announcementStatus={announcementStatus}
        announcementField={announcementField}
      />

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Announcement listing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Filters narrow the records returned by the authorized announcement list.
        </p>
        <AnnouncementFilters
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          query={query}
        />
        <AnnouncementsResult
          communitySlug={communitySlug}
          records={records}
          resultKind={announcementsResult.kind}
          announcementStatus={announcementStatus}
          announcementField={announcementField}
        />
        <Pagination
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          query={query}
          pageOffset={pageOffset}
          hasNextPage={announcementsResult.kind === "records" && records.length === PAGE_SIZE}
        />
      </div>
    </section>
  );
}
