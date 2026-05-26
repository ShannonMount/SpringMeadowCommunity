import { createResidentMessageThreadAction } from "@/server/actions/resident-messages";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";
import type { PropertyMembership } from "@/server/services/auth/property-memberships";

type ResidentContactBoardPageProps = {
  searchParams?: Promise<{
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
  propertyId: "message-error-property",
  category: "message-error-category",
  subject: "message-error-subject",
  body: "message-error-body",
  attachments: "message-error-attachments",
  form: "message-error-form",
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function propertyLabel(membership: PropertyMembership) {
  const property = membership.property;
  const location = [property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");

  return `${property.addressLine1}${location ? `, ${location}` : ""} (${property.maskedAccountNumber})`;
}

function noticeForMessage(message: string, field: string) {
  if (message === "created") {
    return "Your message was sent to the board.";
  }

  if (message === "denied") {
    return "This message could not be sent for the selected property.";
  }

  if (message === "signin") {
    return "Please sign in again before sending a message.";
  }

  if (message === "unavailable") {
    return "Messages are temporarily unavailable. Please try again later.";
  }

  if (message === "invalid") {
    const messages: Record<string, string> = {
      propertyId: "Choose a linked property.",
      category: "Choose a valid category.",
      subject: "Enter a subject of 200 characters or fewer.",
      body: "Enter a message of 5000 characters or fewer.",
      attachments: "Check the selected attachment files.",
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

function PropertyControl({
  memberships,
  message,
  messageField,
}: {
  memberships: PropertyMembership[];
  message: string;
  messageField: string;
}) {
  const inputClass =
    "min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  if (memberships.length === 1) {
    const [membership] = memberships;

    return (
      <div className="grid gap-1">
        <label className="text-xs font-semibold uppercase text-[var(--accent)]">Property</label>
        <input name="propertyId" type="hidden" value={membership.property.id} />
        <p className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[var(--foreground)]">
          {propertyLabel(membership)}
        </p>
        <FieldError field="propertyId" message={message} messageField={messageField} />
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <label htmlFor="propertyId" className="text-xs font-semibold uppercase text-[var(--accent)]">
        Property
      </label>
      <select
        id="propertyId"
        name="propertyId"
        required
        className={inputClass}
        aria-describedby={fieldErrorId("propertyId")}
        aria-invalid={isFieldInvalid(message, messageField, "propertyId") || undefined}
      >
        <option value="">Choose a linked property</option>
        {memberships.map((membership) => (
          <option key={membership.property.id} value={membership.property.id}>
            {propertyLabel(membership)}
          </option>
        ))}
      </select>
      <FieldError field="propertyId" message={message} messageField={messageField} />
    </div>
  );
}

export default async function ResidentContactBoardPage({
  searchParams,
}: ResidentContactBoardPageProps) {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return null;
  }

  const params = await searchParams;
  const message = getSingleSearchParam(params?.message) ?? "";
  const messageField = getSingleSearchParam(params?.messageField) ?? "";
  const notice = noticeForMessage(message, messageField);
  const inputClass =
    "min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Contact Board</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Contact Board</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Send a property-linked question or issue to the HOA board.
      </p>

      <div aria-live="polite" className="mt-6">
        {notice ? (
          <p className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
            {notice}
          </p>
        ) : null}
      </div>

      <form
        action={createResidentMessageThreadAction}
        className="mt-6 grid max-w-3xl gap-5 border-y border-[var(--border)] py-6"
        encType="multipart/form-data"
      >
        <PropertyControl
          memberships={membershipResult.memberships}
          message={message}
          messageField={messageField}
        />

        <div className="grid gap-1">
          <label htmlFor="category" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Category
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue="general"
            className={inputClass}
            aria-describedby={fieldErrorId("category")}
            aria-invalid={isFieldInvalid(message, messageField, "category") || undefined}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <FieldError field="category" message={message} messageField={messageField} />
        </div>

        <div className="grid gap-1">
          <label htmlFor="subject" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            maxLength={200}
            required
            className={inputClass}
            aria-describedby={fieldErrorId("subject")}
            aria-invalid={isFieldInvalid(message, messageField, "subject") || undefined}
          />
          <FieldError field="subject" message={message} messageField={messageField} />
        </div>

        <div className="grid gap-1">
          <label htmlFor="body" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Message
          </label>
          <textarea
            id="body"
            name="body"
            required
            maxLength={5000}
            rows={8}
            className={`${inputClass} resize-y`}
            aria-describedby={fieldErrorId("body")}
            aria-invalid={isFieldInvalid(message, messageField, "body") || undefined}
          />
          <FieldError field="body" message={message} messageField={messageField} />
        </div>

        <div className="grid gap-1">
          <label
            htmlFor="attachments"
            className="text-xs font-semibold uppercase text-[var(--accent)]"
          >
            Attachments
          </label>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            className={inputClass}
            accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            aria-describedby={`${fieldErrorId("attachments")} message-attachment-help`}
            aria-invalid={isFieldInvalid(message, messageField, "attachments") || undefined}
          />
          <p id="message-attachment-help" className="text-xs leading-5 text-[#4f5f5a]">
            Up to 3 files, 6 MB each.
          </p>
          <FieldError field="attachments" message={message} messageField={messageField} />
        </div>

        <div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Send message
          </button>
        </div>
      </form>
    </section>
  );
}
