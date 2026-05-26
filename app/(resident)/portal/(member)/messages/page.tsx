import Link from "next/link";
import { replyToResidentMessageThreadAction } from "@/server/actions/resident-messages";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";
import type { PropertyMembership } from "@/server/services/auth/property-memberships";
import {
  getResidentMessageThreadDetail,
  listResidentMessageThreads,
  type ResidentHistoryStatus,
  type ResidentMessage,
  type ResidentMessageThreadSummary,
} from "@/server/services/messages/resident-message-history";

const PAGE_SIZE = 25;
const MAX_PAGE_OFFSET = 10000;
const MAX_FILTER_LENGTH = 200;

type ResidentMessagesPageProps = {
  searchParams?: Promise<{
    propertyId?: string | string[];
    status?: string | string[];
    category?: string | string[];
    query?: string | string[];
    pageOffset?: string | string[];
    threadId?: string | string[];
    message?: string | string[];
    messageField?: string | string[];
  }>;
};

const CATEGORY_OPTIONS = [
  { value: "dues", label: "Dues" },
  { value: "documents", label: "Documents" },
  { value: "maintenance", label: "Maintenance" },
  { value: "architectural", label: "Architectural" },
  { value: "complaint", label: "Complaint" },
  { value: "general", label: "General" },
] as const;

const fieldErrorIds: Record<string, string> = {
  threadId: "message-history-error-thread",
  body: "message-history-error-body",
  form: "message-history-error-form",
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

function propertyLabel(membership: PropertyMembership) {
  const property = membership.property;
  const location = [property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");

  return `${property.addressLine1}${location ? `, ${location}` : ""} (${property.maskedAccountNumber})`;
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

function formatStatus(value: ResidentHistoryStatus) {
  const labels: Record<ResidentHistoryStatus, string> = {
    open: "Open",
    pending_board: "Pending board",
    pending_resident: "Pending resident",
    closed: "Closed",
  };

  return labels[value];
}

function formatCategory(value: string) {
  const option = CATEGORY_OPTIONS.find((category) => category.value === value);

  return option?.label ?? "General";
}

function formatSenderRole(value: ResidentMessage["senderRole"]) {
  if (value === "resident") {
    return "Resident";
  }

  if (value === "admin") {
    return "Admin";
  }

  return "Board member";
}

function noticeForMessage(message: string, field: string) {
  if (message === "replied") {
    return "Reply sent.";
  }

  if (message === "denied") {
    return "This message thread is not available for your linked properties.";
  }

  if (message === "signin") {
    return "Please sign in again before viewing messages.";
  }

  if (message === "unavailable") {
    return "Messages are temporarily unavailable. Please try again later.";
  }

  if (message === "invalid") {
    const messages: Record<string, string> = {
      threadId: "Choose a valid message thread.",
      body: "Enter a reply of 5000 characters or fewer.",
      form: "Check the message details.",
    };

    return messages[field] ?? messages.form;
  }

  return "";
}

function fieldErrorId(field: string | undefined) {
  if (!field) {
    return undefined;
  }

  return fieldErrorIds[field] ?? fieldErrorIds.form;
}

function isFieldInvalid(message: string, messageField: string, field: string) {
  return message === "invalid" && messageField === field;
}

function FieldError({
  field,
  message,
  messageField,
}: {
  field: string;
  message: string;
  messageField: string;
}) {
  const invalid = isFieldInvalid(message, messageField, field);

  return (
    <p id={fieldErrorIds[field]} className="min-h-5 text-xs text-[#8a3d2b]">
      {invalid ? noticeForMessage("invalid", field) : null}
    </p>
  );
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function messagesHref(input: {
  propertyId?: string;
  status?: string;
  category?: string;
  query?: string;
  pageOffset: number;
  threadId?: string;
}) {
  const params = new URLSearchParams();

  setOptionalParam(params, "propertyId", input.propertyId);
  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "category", input.category);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "threadId", input.threadId);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  const query = params.toString();

  return query ? `/portal/messages?${query}` : "/portal/messages";
}

function CurrentFilterFields({
  propertyId,
  status,
  category,
  query,
  pageOffset,
}: {
  propertyId?: string;
  status?: string;
  category?: string;
  query?: string;
  pageOffset: number;
}) {
  return (
    <>
      <input type="hidden" name="currentPropertyId" value={propertyId ?? ""} />
      <input type="hidden" name="currentStatus" value={status ?? ""} />
      <input type="hidden" name="currentCategory" value={category ?? ""} />
      <input type="hidden" name="currentQuery" value={query ?? ""} />
      <input type="hidden" name="currentPageOffset" value={pageOffset} />
    </>
  );
}

function Filters({
  memberships,
  propertyId,
  status,
  category,
  query,
}: {
  memberships: PropertyMembership[];
  propertyId?: string;
  status?: string;
  category?: string;
  query?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-4">
      <div className="grid gap-1">
        <label htmlFor="propertyId" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Property
        </label>
        <select id="propertyId" name="propertyId" defaultValue={propertyId ?? ""} className={inputClass}>
          <option value="">All linked properties</option>
          {memberships.map((membership) => (
            <option key={membership.property.id} value={membership.property.id}>
              {propertyLabel(membership)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">All active history</option>
          <option value="open">Open</option>
          <option value="pending_board">Pending board</option>
          <option value="pending_resident">Pending resident</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="category" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Category
        </label>
        <select id="category" name="category" defaultValue={category ?? ""} className={inputClass}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Search
        </label>
        <input id="query" name="query" type="search" defaultValue={query ?? ""} className={inputClass} />
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

function ThreadList({
  records,
  selectedThreadId,
  hrefForThread,
}: {
  records: ResidentMessageThreadSummary[];
  selectedThreadId?: string;
  hrefForThread: (threadId: string) => string;
}) {
  if (records.length === 0) {
    return (
      <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
        No message threads match the current filters.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-0 border-y border-[var(--border)]">
      {records.map((record) => (
        <article
          key={record.threadId}
          className={`grid gap-2 border-b border-[var(--border)] py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] ${
            selectedThreadId === record.threadId ? "bg-[var(--surface-muted)] px-3" : ""
          }`}
        >
          <div className="min-w-0">
            <Link
              href={hrefForThread(record.threadId)}
              className="font-semibold text-[var(--foreground)] underline decoration-[var(--gold)] underline-offset-4"
            >
              {record.subject}
            </Link>
            <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">{record.propertyLabel}</p>
            <p className="mt-1 text-xs uppercase text-[var(--accent)]">
              {formatCategory(record.category)} - {formatStatus(record.status)}
            </p>
          </div>
          <dl className="grid gap-1 text-sm text-[#4f5f5a] sm:grid-cols-3 md:min-w-[320px]">
            <div>
              <dt className="text-xs uppercase text-[var(--accent)]">Last message</dt>
              <dd>{formatDateTime(record.lastMessageAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--accent)]">Messages</dt>
              <dd>{record.messageCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--accent)]">Attachment count</dt>
              <dd>{record.attachmentCount}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function MessageList({ messages }: { messages: ResidentMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm leading-6 text-[#4f5f5a]">No visible messages are stored for this thread.</p>;
  }

  return (
    <div className="grid gap-4">
      {messages.map((message) => (
        <article key={message.messageId} className="border-y border-[var(--border)] py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase text-[var(--accent)]">
            <span>{message.senderDisplayName}</span>
            <span>{formatSenderRole(message.senderRole)}</span>
            <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
            <span>Attachment count: {message.attachmentCount}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{message.body}</p>
        </article>
      ))}
    </div>
  );
}

function ThreadDetail({
  thread,
  messages,
  message,
  messageField,
  currentFilters,
}: {
  thread: ResidentMessageThreadSummary;
  messages: ResidentMessage[];
  message: string;
  messageField: string;
  currentFilters: {
    propertyId?: string;
    status?: string;
    category?: string;
    query?: string;
    pageOffset: number;
  };
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <section className="mt-8">
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Selected message</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{thread.subject}</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-xs uppercase text-[var(--accent)]">Property</dt>
          <dd className="mt-1 text-[var(--foreground)]">{thread.propertyLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[var(--accent)]">Status</dt>
          <dd className="mt-1 text-[var(--foreground)]">{formatStatus(thread.status)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[var(--accent)]">Attachment count</dt>
          <dd className="mt-1 text-[var(--foreground)]">{thread.attachmentCount}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <MessageList messages={messages} />
      </div>
      <form action={replyToResidentMessageThreadAction} className="mt-6 grid gap-3 border-y border-[var(--border)] py-4">
        <CurrentFilterFields {...currentFilters} />
        <input type="hidden" name="threadId" value={thread.threadId} />
        <div className="grid gap-1">
          <label htmlFor="body" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Reply
          </label>
          <textarea
            id="body"
            name="body"
            required
            maxLength={5000}
            rows={6}
            className={`${inputClass} resize-y`}
            aria-describedby={fieldErrorId("body")}
            aria-invalid={isFieldInvalid(message, messageField, "body") || undefined}
          />
          <FieldError field="body" message={message} messageField={messageField} />
        </div>
        <div>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Send reply
          </button>
        </div>
      </form>
    </section>
  );
}

export default async function ResidentMessagesPage({ searchParams }: ResidentMessagesPageProps) {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return null;
  }

  const params = await searchParams;
  const propertyId = boundedText(getSingleSearchParam(params?.propertyId), MAX_FILTER_LENGTH);
  const status = boundedText(getSingleSearchParam(params?.status), MAX_FILTER_LENGTH);
  const category = boundedText(getSingleSearchParam(params?.category), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params?.query), MAX_FILTER_LENGTH);
  const selectedThreadId = boundedText(getSingleSearchParam(params?.threadId), MAX_FILTER_LENGTH);
  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
  const message = boundedText(getSingleSearchParam(params?.message), MAX_FILTER_LENGTH);
  const messageField = boundedText(getSingleSearchParam(params?.messageField), MAX_FILTER_LENGTH);
  const notice = noticeForMessage(message, messageField);
  const currentFilters = {
    propertyId,
    status,
    category,
    query,
    pageOffset,
  };

  const threadResults = await listResidentMessageThreads({
    category,
    pageOffset,
    pageSize: PAGE_SIZE,
    propertyId,
    query,
    status,
  });
  const selectedThreadResult = selectedThreadId
    ? await getResidentMessageThreadDetail({ threadId: selectedThreadId })
    : null;
  const records = threadResults.kind === "records" ? threadResults.records : [];

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Messages</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Message history</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Review property-linked messages and continue existing conversations with the board.
      </p>

      <div className="mt-4">
        <Link
          href="/portal/contact-board"
          className="text-sm font-semibold text-[var(--foreground)] underline decoration-[var(--gold)] underline-offset-4"
        >
          Start a new message
        </Link>
      </div>

      <div aria-live="polite" className="mt-6 min-h-6 text-sm leading-6 text-[#4f5f5a]">
        {notice ? <p>{notice}</p> : null}
      </div>

      <Filters
        category={category}
        memberships={membershipResult.memberships}
        propertyId={propertyId}
        query={query}
        status={status}
      />

      {threadResults.kind === "permission-denied" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          Message history is not available for the selected property.
        </p>
      ) : null}
      {threadResults.kind === "invalid-input" || threadResults.kind === "messages-unavailable" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          Message history is temporarily unavailable.
        </p>
      ) : null}

      {threadResults.kind === "records" ? (
        <>
          <ThreadList
            records={records}
            selectedThreadId={selectedThreadId}
            hrefForThread={(threadId) =>
              messagesHref({
                ...currentFilters,
                threadId,
              })
            }
          />
          <div className="mt-4 flex gap-3">
            {pageOffset > 0 ? (
              <Link
                href={messagesHref({
                  ...currentFilters,
                  pageOffset: Math.max(pageOffset - PAGE_SIZE, 0),
                  threadId: selectedThreadId,
                })}
                className="inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Previous
              </Link>
            ) : null}
            {records.length === PAGE_SIZE ? (
              <Link
                href={messagesHref({
                  ...currentFilters,
                  pageOffset: pageOffset + PAGE_SIZE,
                  threadId: selectedThreadId,
                })}
                className="inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Next
              </Link>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedThreadResult?.kind === "thread" ? (
        <ThreadDetail
          currentFilters={currentFilters}
          message={message}
          messageField={messageField}
          messages={selectedThreadResult.messages}
          thread={selectedThreadResult.thread}
        />
      ) : null}
      {selectedThreadId && selectedThreadResult?.kind !== "thread" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          Select a valid message thread to view the conversation.
        </p>
      ) : null}
    </section>
  );
}
