import Link from "next/link";
import {
  addInternalNoteToMessageThreadAction,
  assignMessageThreadAction,
  replyToMessageThreadAction,
  setMessageThreadStatusAction,
} from "@/server/actions/admin-messages";
import {
  getMessageThreadDetail,
  listMessageThreads,
  type AdminMessage,
  type AdminMessageThreadStatus,
  type AdminMessageThreadSummary,
} from "@/server/services/messages/admin-message-inbox";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 25;
const MAX_PAGE_OFFSET = 10000;
const MAX_FILTER_LENGTH = 200;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type AdminMessagesPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    status?: string | string[];
    category?: string | string[];
    propertyId?: string | string[];
    assignedTo?: string | string[];
    query?: string | string[];
    lastMessageFrom?: string | string[];
    lastMessageTo?: string | string[];
    pageOffset?: string | string[];
    threadId?: string | string[];
    message?: string | string[];
    messageField?: string | string[];
  }>;
};

const fieldErrorIds: Record<string, string> = {
  threadId: "message-error-threadId",
  body: "message-error-body",
  noteBody: "message-error-noteBody",
  attachmentDocumentIds: "message-error-attachmentDocumentIds",
  assignedTo: "message-error-assignedTo",
  status: "message-error-status",
  form: "message-error-form",
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

function messageFilterDateTimeValue(value: string) {
  if (!value) {
    return null;
  }

  return dateTimeLocalToNewYorkIso(value) ?? value;
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

function formatStatus(value: AdminMessageThreadStatus) {
  const labels: Record<AdminMessageThreadStatus, string> = {
    open: "Open",
    pending_board: "Pending board",
    pending_resident: "Pending resident",
    closed: "Closed",
    archived: "Archived",
  };

  return labels[value];
}

function formatCategory(value: string) {
  const labels: Record<string, string> = {
    dues: "Dues",
    documents: "Documents",
    maintenance: "Maintenance",
    architectural: "Architectural",
    complaint: "Complaint",
    general: "General",
  };

  return labels[value] ?? "General";
}

function messageNotice(value: string | undefined) {
  const notices: Record<string, string> = {
    replied: "Reply sent.",
    noted: "Internal note saved.",
    assigned: "Thread assignment updated.",
    closed: "Thread closed.",
    archived: "Thread archived.",
    reopened: "Thread reopened.",
    invalid: "Check the message details and try again.",
    denied: "You do not have permission to manage messages.",
    signin: "Sign in before managing messages.",
    unavailable: "Message management is temporarily unavailable.",
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
    threadId: "Choose a valid thread.",
    body: "Enter a reply of 5000 characters or fewer.",
    noteBody: "Enter an internal note of 5000 characters or fewer.",
    attachmentDocumentIds: "Enter valid attachment document IDs.",
    assignedTo: "Enter a valid board/admin profile ID or leave blank.",
    status: "Choose a valid status.",
    form: "Check the message details.",
  };

  return messages[field] ?? messages.form;
}

function isFieldInvalid(messageStatus: string | undefined, messageField: string | undefined, field: string) {
  return messageStatus === "invalid" && messageField === field;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function messagesHref(input: {
  communitySlug: string;
  status?: string;
  category?: string;
  propertyId?: string;
  assignedTo?: string;
  query?: string;
  lastMessageFrom?: string;
  lastMessageTo?: string;
  pageOffset: number;
  threadId?: string;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "category", input.category);
  setOptionalParam(params, "propertyId", input.propertyId);
  setOptionalParam(params, "assignedTo", input.assignedTo);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "lastMessageFrom", input.lastMessageFrom);
  setOptionalParam(params, "lastMessageTo", input.lastMessageTo);
  setOptionalParam(params, "threadId", input.threadId);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/messages?${params.toString()}`;
}

function MessageFieldError({
  field,
  messageStatus,
  messageField,
}: {
  field: string;
  messageStatus: string | undefined;
  messageField: string | undefined;
}) {
  const invalid = isFieldInvalid(messageStatus, messageField, field);

  return (
    <p id={fieldErrorIds[field]} className="min-h-5 text-xs text-[#8a3d2b]">
      {invalid ? fieldErrorMessage(field) : null}
    </p>
  );
}

function CurrentFilterFields({
  communitySlug,
  status,
  category,
  propertyId,
  assignedTo,
  query,
  lastMessageFrom,
  lastMessageTo,
  pageOffset,
}: {
  communitySlug: string;
  status?: string;
  category?: string;
  propertyId?: string;
  assignedTo?: string;
  query?: string;
  lastMessageFrom?: string;
  lastMessageTo?: string;
  pageOffset: number;
}) {
  return (
    <>
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <input type="hidden" name="currentStatus" value={status ?? ""} />
      <input type="hidden" name="currentCategory" value={category ?? ""} />
      <input type="hidden" name="currentPropertyId" value={propertyId ?? ""} />
      <input type="hidden" name="currentAssignedTo" value={assignedTo ?? ""} />
      <input type="hidden" name="currentQuery" value={query ?? ""} />
      <input type="hidden" name="currentLastMessageFrom" value={lastMessageFrom ?? ""} />
      <input type="hidden" name="currentLastMessageTo" value={lastMessageTo ?? ""} />
      <input type="hidden" name="currentPageOffset" value={pageOffset} />
    </>
  );
}

function Filters({
  communitySlug,
  status,
  category,
  propertyId,
  assignedTo,
  query,
  lastMessageFrom,
  lastMessageTo,
}: {
  communitySlug: string;
  status?: string;
  category?: string;
  propertyId?: string;
  assignedTo?: string;
  query?: string;
  lastMessageFrom?: string;
  lastMessageTo?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-4">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="pending_board">Pending board</option>
          <option value="pending_resident">Pending resident</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="category" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Category
        </label>
        <select id="category" name="category" defaultValue={category ?? ""} className={inputClass}>
          <option value="">All</option>
          <option value="dues">Dues</option>
          <option value="documents">Documents</option>
          <option value="maintenance">Maintenance</option>
          <option value="architectural">Architectural</option>
          <option value="complaint">Complaint</option>
          <option value="general">General</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="propertyId" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Property ID
        </label>
        <input id="propertyId" name="propertyId" type="text" defaultValue={propertyId ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="assignedTo" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Assigned user ID
        </label>
        <input id="assignedTo" name="assignedTo" type="text" defaultValue={assignedTo ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Search
        </label>
        <input id="query" name="query" type="search" defaultValue={query ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="lastMessageFrom" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Last message from
        </label>
        <input
          id="lastMessageFrom"
          name="lastMessageFrom"
          type="datetime-local"
          defaultValue={toDateTimeLocal(messageFilterDateTimeValue(lastMessageFrom ?? ""))}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="lastMessageTo" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Last message to
        </label>
        <input
          id="lastMessageTo"
          name="lastMessageTo"
          type="datetime-local"
          defaultValue={toDateTimeLocal(messageFilterDateTimeValue(lastMessageTo ?? ""))}
          className={inputClass}
        />
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

function ThreadTable({
  records,
  selectedThreadId,
  hrefForThread,
}: {
  records: AdminMessageThreadSummary[];
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
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-[1120px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--accent)]">
            <th scope="col" className="py-2 pr-4 font-semibold">Subject</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Category</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Property</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Assigned</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Last message</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Messages</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Attachment count</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.threadId}
              className={`border-b border-[var(--border)] align-top ${
                selectedThreadId === record.threadId ? "bg-[var(--surface-muted)]" : ""
              }`}
            >
              <td className="py-3 pr-4">
                <Link
                  href={hrefForThread(record.threadId)}
                  className="font-semibold text-[var(--foreground)] underline decoration-[var(--gold)] underline-offset-4"
                >
                  {record.subject}
                </Link>
                <p className="mt-1 text-xs text-[#4f5f5a]">
                  From {record.createdBy?.displayName ?? "Unknown resident"}
                </p>
              </td>
              <td className="py-3 pr-4">{formatCategory(record.category)}</td>
              <td className="py-3 pr-4">{record.propertyLabel}</td>
              <td className="py-3 pr-4">{formatStatus(record.status)}</td>
              <td className="py-3 pr-4">{record.assignedTo?.displayName ?? "Unassigned"}</td>
              <td className="py-3 pr-4">{formatDateTime(record.lastMessageAt)}</td>
              <td className="py-3 pr-4">{record.messageCount}</td>
              <td className="py-3 pr-4">{record.attachmentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageList({ messages }: { messages: AdminMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm leading-6 text-[#4f5f5a]">No visible messages are stored for this thread.</p>;
  }

  return (
    <div className="grid gap-4">
      {messages.map((message) => (
        <article key={message.messageId} className="border-y border-[var(--border)] py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase text-[var(--accent)]">
            <span>{message.senderDisplayName}</span>
            <span>{message.senderRole === "resident" ? "Resident" : message.senderRole === "admin" ? "Admin" : "Board member"}</span>
            {message.visibility === "board_admin_only" ? <span>Board/admin note</span> : null}
            <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
            <span>Attachment count: {message.attachmentCount}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{message.body}</p>
        </article>
      ))}
    </div>
  );
}

function ThreadActions({
  thread,
  messageStatus,
  messageField,
  currentFilters,
}: {
  thread: AdminMessageThreadSummary;
  messageStatus?: string;
  messageField?: string;
  currentFilters: {
    communitySlug: string;
    status?: string;
    category?: string;
    propertyId?: string;
    assignedTo?: string;
    query?: string;
    lastMessageFrom?: string;
    lastMessageTo?: string;
    pageOffset: number;
  };
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
  const assignedToInputId = `assignedTo-${thread.threadId}`;
  const noteBodyInputId = `noteBody-${thread.threadId}`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-4">
        <form action={replyToMessageThreadAction} className="grid gap-3 border-y border-[var(--border)] py-4">
          <CurrentFilterFields {...currentFilters} />
          <input type="hidden" name="threadId" value={thread.threadId} />
          <div className="grid gap-1">
            <label htmlFor="body" className="text-xs font-semibold uppercase text-[var(--accent)]">
              Reply
            </label>
            <textarea
              id="body"
              name="body"
              rows={6}
              maxLength={5000}
              className={`${inputClass} resize-y`}
              aria-describedby={fieldErrorId("body")}
            />
            <MessageFieldError field="body" messageStatus={messageStatus} messageField={messageField} />
          </div>
          <div className="grid gap-1">
            <label
              htmlFor="attachmentDocumentIds"
              className="text-xs font-semibold uppercase text-[var(--accent)]"
            >
              Attachment document IDs
            </label>
            <textarea
              id="attachmentDocumentIds"
              name="attachmentDocumentIds"
              rows={2}
              className={`${inputClass} resize-y`}
              aria-describedby={fieldErrorId("attachmentDocumentIds")}
            />
            <MessageFieldError
              field="attachmentDocumentIds"
              messageStatus={messageStatus}
              messageField={messageField}
            />
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

        <form action={addInternalNoteToMessageThreadAction} className="grid gap-3 border-y border-[var(--border)] py-4">
          <CurrentFilterFields {...currentFilters} />
          <input type="hidden" name="threadId" value={thread.threadId} />
          <div className="grid gap-1">
            <label htmlFor={noteBodyInputId} className="text-xs font-semibold uppercase text-[var(--accent)]">
              Internal note
            </label>
            <textarea
              id={noteBodyInputId}
              name="noteBody"
              rows={4}
              maxLength={5000}
              className={`${inputClass} resize-y`}
              aria-describedby={fieldErrorId("noteBody")}
            />
            <MessageFieldError field="noteBody" messageStatus={messageStatus} messageField={messageField} />
          </div>
          <div>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Save internal note
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        <form action={assignMessageThreadAction} className="grid gap-3 border-y border-[var(--border)] py-4">
          <CurrentFilterFields {...currentFilters} />
          <input type="hidden" name="threadId" value={thread.threadId} />
          <div className="grid gap-1">
            <label htmlFor={assignedToInputId} className="text-xs font-semibold uppercase text-[var(--accent)]">
              Assigned user ID
            </label>
            <input
              id={assignedToInputId}
              name="assignedTo"
              type="text"
              defaultValue={thread.assignedTo?.profileId ?? ""}
              className={inputClass}
              aria-describedby={fieldErrorId("assignedTo")}
            />
            <MessageFieldError field="assignedTo" messageStatus={messageStatus} messageField={messageField} />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Save assignment
          </button>
        </form>

        <form action={setMessageThreadStatusAction} className="grid gap-3 border-y border-[var(--border)] py-4">
          <CurrentFilterFields {...currentFilters} />
          <input type="hidden" name="threadId" value={thread.threadId} />
          <div className="grid gap-1">
            <label htmlFor="status-action" className="text-xs font-semibold uppercase text-[var(--accent)]">
              Status action
            </label>
            <select
              id="status-action"
              name="status"
              defaultValue={thread.status === "archived" ? "open" : thread.status}
              className={inputClass}
              aria-describedby={fieldErrorId("status")}
            >
              <option value="open">Reopen</option>
              <option value="pending_board">Pending board</option>
              <option value="pending_resident">Pending resident</option>
              <option value="closed">Close</option>
              <option value="archived">Archive</option>
            </select>
            <MessageFieldError field="status" messageStatus={messageStatus} messageField={messageField} />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Update status
          </button>
        </form>
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  messages,
  messageStatus,
  messageField,
  currentFilters,
}: {
  thread: AdminMessageThreadSummary;
  messages: AdminMessage[];
  messageStatus?: string;
  messageField?: string;
  currentFilters: {
    communitySlug: string;
    status?: string;
    category?: string;
    propertyId?: string;
    assignedTo?: string;
    query?: string;
    lastMessageFrom?: string;
    lastMessageTo?: string;
    pageOffset: number;
  };
}) {
  return (
    <section className="mt-8">
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Selected thread</p>
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
      <ThreadActions
        thread={thread}
        messageStatus={messageStatus}
        messageField={messageField}
        currentFilters={currentFilters}
      />
    </section>
  );
}

export default async function AdminMessagesPage({ searchParams }: AdminMessagesPageProps) {
  const params = await searchParams;
  const communitySlug =
    boundedText(getSingleSearchParam(params?.communitySlug), MAX_FILTER_LENGTH) ||
    DEFAULT_COMMUNITY_SLUG;
  const status = boundedText(getSingleSearchParam(params?.status), MAX_FILTER_LENGTH);
  const category = boundedText(getSingleSearchParam(params?.category), MAX_FILTER_LENGTH);
  const propertyId = boundedText(getSingleSearchParam(params?.propertyId), MAX_FILTER_LENGTH);
  const assignedTo = boundedText(getSingleSearchParam(params?.assignedTo), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params?.query), MAX_FILTER_LENGTH);
  const lastMessageFrom = boundedText(getSingleSearchParam(params?.lastMessageFrom), MAX_FILTER_LENGTH);
  const lastMessageTo = boundedText(getSingleSearchParam(params?.lastMessageTo), MAX_FILTER_LENGTH);
  const selectedThreadId = boundedText(getSingleSearchParam(params?.threadId), MAX_FILTER_LENGTH);
  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
  const messageStatus = boundedText(getSingleSearchParam(params?.message), MAX_FILTER_LENGTH);
  const messageField = boundedText(getSingleSearchParam(params?.messageField), MAX_FILTER_LENGTH);
  const lastMessageFromFilter = messageFilterDateTimeValue(lastMessageFrom);
  const lastMessageToFilter = messageFilterDateTimeValue(lastMessageTo);

  const threadResults = await listMessageThreads({
    communitySlug,
    status,
    category,
    propertyId,
    assignedTo,
    query,
    lastMessageFrom: lastMessageFromFilter,
    lastMessageTo: lastMessageToFilter,
    pageSize: PAGE_SIZE,
    pageOffset,
  });
  const selectedThreadResult = selectedThreadId
    ? await getMessageThreadDetail({ threadId: selectedThreadId })
    : null;
  const notice = messageNotice(messageStatus);
  const records = threadResults.kind === "records" ? threadResults.records : [];
  const currentFilters = {
    communitySlug,
    status,
    category,
    propertyId,
    assignedTo,
    query,
    lastMessageFrom,
    lastMessageTo,
    pageOffset,
  };

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Messages</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Message inbox</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Review resident contact threads, assign board follow-up, reply, and manage thread status.
      </p>

      <div aria-live="polite" className="mt-6 min-h-6 text-sm leading-6 text-[#4f5f5a]">
        {notice ? <p>{notice}</p> : null}
      </div>

      <Filters
        communitySlug={communitySlug}
        status={status}
        category={category}
        propertyId={propertyId}
        assignedTo={assignedTo}
        query={query}
        lastMessageFrom={lastMessageFrom}
        lastMessageTo={lastMessageTo}
      />

      {threadResults.kind === "permission-denied" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          You do not have permission to manage messages.
        </p>
      ) : null}
      {threadResults.kind === "unauthenticated" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          Sign in before managing messages.
        </p>
      ) : null}
      {threadResults.kind === "invalid-input" || threadResults.kind === "messages-unavailable" ? (
        <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
          Message threads are temporarily unavailable.
        </p>
      ) : null}

      {threadResults.kind === "records" ? (
        <>
          <ThreadTable
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
          thread={selectedThreadResult.thread}
          messages={selectedThreadResult.messages}
          messageStatus={messageStatus}
          messageField={messageField}
          currentFilters={currentFilters}
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
