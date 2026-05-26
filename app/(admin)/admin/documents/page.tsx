import Link from "next/link";
import { uploadAdminDocument } from "@/server/actions/document-upload";
import {
  listDocumentMetadata,
  type DocumentMetadataRecord,
  type DocumentStatus,
  type DocumentVisibility,
} from "@/server/services/documents/document-metadata";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 25;
const MAX_PAGE_OFFSET = 10000;
const MAX_FILTER_LENGTH = 120;
const MAX_QUERY_LENGTH = 200;

type AdminDocumentsPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    visibility?: string | string[];
    status?: string | string[];
    category?: string | string[];
    query?: string | string[];
    effectiveFrom?: string | string[];
    effectiveTo?: string | string[];
    expirationFrom?: string | string[];
    expirationTo?: string | string[];
    pageOffset?: string | string[];
    documentUpload?: string | string[];
    documentUploadField?: string | string[];
  }>;
};

const fieldErrorIds: Record<string, string> = {
  file: "document-upload-error-file",
  title: "document-upload-error-title",
  category: "document-upload-error-category",
  visibility: "document-upload-error-visibility",
  relatedPropertyId: "document-upload-error-relatedPropertyId",
  effectiveDate: "document-upload-error-effectiveDate",
  expirationDate: "document-upload-error-expirationDate",
  form: "document-upload-error-form",
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

function uploadNotice(value: string | undefined) {
  const notices: Record<string, string> = {
    uploaded: "Document uploaded.",
    invalid: "Check the document details and try again.",
    denied: "You do not have permission to upload documents.",
    signin: "Sign in before uploading documents.",
    unavailable: "Document upload is temporarily unavailable.",
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
    file: "Choose a supported document file.",
    title: "Enter a document title.",
    category: "Enter a category.",
    visibility: "Choose a visibility.",
    relatedPropertyId: "Enter a valid property ID for property-specific documents.",
    effectiveDate: "Enter a valid effective date.",
    expirationDate: "Enter a valid expiration date.",
    form: "Check the document upload details.",
  };

  return messages[field] ?? messages.form;
}

function isFieldInvalid(uploadStatus: string | undefined, uploadField: string | undefined, field: string) {
  return uploadStatus === "invalid" && uploadField === field;
}

function formatVisibility(value: DocumentVisibility) {
  const labels: Record<DocumentVisibility, string> = {
    public: "Public",
    resident: "Resident",
    board: "Board",
    vendor: "Vendor",
    property_specific: "Property specific",
    admin: "Admin",
  };

  return labels[value];
}

function formatStatus(value: DocumentStatus) {
  const labels: Record<DocumentStatus, string> = {
    active: "Active",
    archived: "Archived",
    deleted: "Deleted",
  };

  return labels[value];
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Not available";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value / 1024)} KB`;
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function documentsHref(input: {
  communitySlug: string;
  visibility?: string;
  status?: string;
  category?: string;
  query?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  expirationFrom?: string;
  expirationTo?: string;
  pageOffset: number;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "visibility", input.visibility);
  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "category", input.category);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "effectiveFrom", input.effectiveFrom);
  setOptionalParam(params, "effectiveTo", input.effectiveTo);
  setOptionalParam(params, "expirationFrom", input.expirationFrom);
  setOptionalParam(params, "expirationTo", input.expirationTo);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/documents?${params.toString()}`;
}

function documentDownloadHref(record: DocumentMetadataRecord) {
  return `/api/documents/${record.id}/signed-url?redirect=1`;
}

function FieldError({
  field,
  uploadStatus,
  uploadField,
}: {
  field: string;
  uploadStatus: string | undefined;
  uploadField: string | undefined;
}) {
  const invalid = isFieldInvalid(uploadStatus, uploadField, field);

  return (
    <p id={fieldErrorIds[field]} className="min-h-5 text-xs text-[#8a3d2b]">
      {invalid ? fieldErrorMessage(field) : null}
    </p>
  );
}

function UploadForm({
  communitySlug,
  uploadStatus,
  uploadField,
}: {
  communitySlug: string;
  uploadStatus: string | undefined;
  uploadField: string | undefined;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form action={uploadAdminDocument} className="mt-6 grid gap-4 border-y border-[var(--border)] py-5">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="file" className="text-xs font-semibold uppercase text-[var(--accent)]">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          className={inputClass}
          aria-describedby={fieldErrorId("file")}
        />
        <FieldError field="file" uploadStatus={uploadStatus} uploadField={uploadField} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="title" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            className={inputClass}
            aria-describedby={fieldErrorId("title")}
          />
          <FieldError field="title" uploadStatus={uploadStatus} uploadField={uploadField} />
        </div>
        <div className="grid gap-1">
          <label htmlFor="category" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Category
          </label>
          <input
            id="category"
            name="category"
            type="text"
            className={inputClass}
            aria-describedby={fieldErrorId("category")}
          />
          <FieldError field="category" uploadStatus={uploadStatus} uploadField={uploadField} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1">
          <label htmlFor="visibility" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="resident"
            className={inputClass}
            aria-describedby={fieldErrorId("visibility")}
          >
            <option value="public">Public</option>
            <option value="resident">Resident</option>
            <option value="board">Board</option>
            <option value="vendor">Vendor</option>
            <option value="property_specific">Property specific</option>
            <option value="admin">Admin</option>
          </select>
          <FieldError field="visibility" uploadStatus={uploadStatus} uploadField={uploadField} />
        </div>
        <div className="grid gap-1">
          <label
            htmlFor="relatedPropertyId"
            className="text-xs font-semibold uppercase text-[var(--accent)]"
          >
            Related property ID
          </label>
          <input
            id="relatedPropertyId"
            name="relatedPropertyId"
            type="text"
            className={inputClass}
            aria-describedby={fieldErrorId("relatedPropertyId")}
          />
          <FieldError
            field="relatedPropertyId"
            uploadStatus={uploadStatus}
            uploadField={uploadField}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="description" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Description
          </label>
          <input id="description" name="description" type="text" className={inputClass} />
          <p className="min-h-5 text-xs text-[#4f5f5a]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="effectiveDate" className="text-xs font-semibold uppercase text-[var(--accent)]">
            Effective date
          </label>
          <input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            className={inputClass}
            aria-describedby={fieldErrorId("effectiveDate")}
          />
          <FieldError field="effectiveDate" uploadStatus={uploadStatus} uploadField={uploadField} />
        </div>
        <div className="grid gap-1">
          <label
            htmlFor="expirationDate"
            className="text-xs font-semibold uppercase text-[var(--accent)]"
          >
            Expiration date
          </label>
          <input
            id="expirationDate"
            name="expirationDate"
            type="date"
            className={inputClass}
            aria-describedby={fieldErrorId("expirationDate")}
          />
          <FieldError field="expirationDate" uploadStatus={uploadStatus} uploadField={uploadField} />
        </div>
      </div>
      <details className="rounded-sm border border-[var(--border)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
          Optional related records
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label
              htmlFor="relatedVendorId"
              className="text-xs font-semibold uppercase text-[var(--accent)]"
            >
              Related vendor ID
            </label>
            <input id="relatedVendorId" name="relatedVendorId" type="text" className={inputClass} />
          </div>
          <div className="grid gap-1">
            <label
              htmlFor="relatedMeetingId"
              className="text-xs font-semibold uppercase text-[var(--accent)]"
            >
              Related meeting ID
            </label>
            <input id="relatedMeetingId" name="relatedMeetingId" type="text" className={inputClass} />
          </div>
          <div className="grid gap-1">
            <label
              htmlFor="relatedComplianceTaskId"
              className="text-xs font-semibold uppercase text-[var(--accent)]"
            >
              Related compliance task ID
            </label>
            <input
              id="relatedComplianceTaskId"
              name="relatedComplianceTaskId"
              type="text"
              className={inputClass}
            />
          </div>
          <div className="grid gap-1">
            <label
              htmlFor="relatedAssessmentId"
              className="text-xs font-semibold uppercase text-[var(--accent)]"
            >
              Related assessment ID
            </label>
            <input
              id="relatedAssessmentId"
              name="relatedAssessmentId"
              type="text"
              className={inputClass}
            />
          </div>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Upload document
        </button>
      </div>
    </form>
  );
}

function DocumentFilters({
  communitySlug,
  visibility,
  status,
  category,
  query,
  effectiveFrom,
  effectiveTo,
  expirationFrom,
  expirationTo,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  category: string;
  query: string;
  effectiveFrom: string;
  effectiveTo: string;
  expirationFrom: string;
  expirationTo: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-5">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="visibility-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Visibility
        </label>
        <select
          id="visibility-filter"
          name="visibility"
          defaultValue={visibility}
          className={inputClass}
        >
          <option value="">All</option>
          <option value="public">Public</option>
          <option value="resident">Resident</option>
          <option value="board">Board</option>
          <option value="vendor">Vendor</option>
          <option value="property_specific">Property specific</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status" name="status" defaultValue={status} className={inputClass}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="category-filter" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Category
        </label>
        <input
          id="category-filter"
          name="category"
          type="text"
          defaultValue={category}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1 lg:col-span-2">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Search
        </label>
        <input
          id="query"
          name="query"
          type="search"
          defaultValue={query}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="effectiveFrom" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Effective from
        </label>
        <input
          id="effectiveFrom"
          name="effectiveFrom"
          type="date"
          defaultValue={effectiveFrom}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="effectiveTo" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Effective to
        </label>
        <input
          id="effectiveTo"
          name="effectiveTo"
          type="date"
          defaultValue={effectiveTo}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="expirationFrom" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Expiration from
        </label>
        <input
          id="expirationFrom"
          name="expirationFrom"
          type="date"
          defaultValue={expirationFrom}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="expirationTo" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Expiration to
        </label>
        <input
          id="expirationTo"
          name="expirationTo"
          type="date"
          defaultValue={expirationTo}
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

function DocumentsResult({
  records,
  resultKind,
}: {
  records: DocumentMetadataRecord[];
  resultKind: string;
}) {
  if (resultKind === "invalid-input") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Check the document filters and try again.
      </p>
    );
  }

  if (resultKind !== "records") {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        Document library is temporarily unavailable.
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[#4f5f5a]">
        No documents match this view.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase text-[var(--accent)]">
          <tr>
            <th className="border-b border-[var(--border)] py-2 pr-4 font-semibold">Title</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Category</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Visibility</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Status</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Type</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Size</th>
            <th className="border-b border-[var(--border)] px-4 py-2 font-semibold">Effective</th>
            <th className="border-b border-[var(--border)] pl-4 py-2 font-semibold">Expires</th>
            <th className="border-b border-[var(--border)] pl-4 py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td className="border-b border-[var(--border)] py-3 pr-4 font-medium text-[var(--foreground)]">
                {record.title}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {record.category}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {formatVisibility(record.visibility)}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {formatStatus(record.status)}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {record.contentType}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {formatBytes(record.sizeBytes)}
              </td>
              <td className="border-b border-[var(--border)] px-4 py-3 text-[#4f5f5a]">
                {formatDateOnly(record.effectiveDate)}
              </td>
              <td className="border-b border-[var(--border)] pl-4 py-3 text-[#4f5f5a]">
                {formatDateOnly(record.expirationDate)}
              </td>
              <td className="border-b border-[var(--border)] pl-4 py-3">
                <a
                  href={documentDownloadHref(record)}
                  className="inline-flex min-h-9 items-center rounded-sm border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                >
                  Download
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  communitySlug,
  visibility,
  status,
  category,
  query,
  effectiveFrom,
  effectiveTo,
  expirationFrom,
  expirationTo,
  pageOffset,
  hasNextPage,
}: {
  communitySlug: string;
  visibility: string;
  status: string;
  category: string;
  query: string;
  effectiveFrom: string;
  effectiveTo: string;
  expirationFrom: string;
  expirationTo: string;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const previousOffset = Math.max(pageOffset - PAGE_SIZE, 0);
  const nextOffset = Math.min(pageOffset + PAGE_SIZE, MAX_PAGE_OFFSET);
  const baseFilters = {
    communitySlug,
    visibility,
    status,
    category,
    query,
    effectiveFrom,
    effectiveTo,
    expirationFrom,
    expirationTo,
  };

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {pageOffset > 0 ? (
        <Link
          href={documentsHref({ ...baseFilters, pageOffset: previousOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Previous
        </Link>
      ) : null}
      {hasNextPage ? (
        <Link
          href={documentsHref({ ...baseFilters, pageOffset: nextOffset })}
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Next
        </Link>
      ) : null}
    </div>
  );
}

export default async function AdminDocumentsPage({ searchParams }: AdminDocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const communitySlug = getSingleSearchParam(params.communitySlug) ?? DEFAULT_COMMUNITY_SLUG;
  const documentUpload = getSingleSearchParam(params.documentUpload);
  const documentUploadField = getSingleSearchParam(params.documentUploadField);
  const visibility = boundedText(getSingleSearchParam(params.visibility), MAX_FILTER_LENGTH);
  const status = boundedText(getSingleSearchParam(params.status), MAX_FILTER_LENGTH);
  const category = boundedText(getSingleSearchParam(params.category), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params.query), MAX_QUERY_LENGTH);
  const effectiveFrom = boundedText(getSingleSearchParam(params.effectiveFrom), 10);
  const effectiveTo = boundedText(getSingleSearchParam(params.effectiveTo), 10);
  const expirationFrom = boundedText(getSingleSearchParam(params.expirationFrom), 10);
  const expirationTo = boundedText(getSingleSearchParam(params.expirationTo), 10);
  const pageOffset = parsePageOffset(getSingleSearchParam(params.pageOffset));
  const documentsResult = await listDocumentMetadata({
    communitySlug,
    visibility: visibility || null,
    status: status || null,
    category: category || null,
    query: query || null,
    effectiveFrom: effectiveFrom || null,
    effectiveTo: effectiveTo || null,
    expirationFrom: expirationFrom || null,
    expirationTo: expirationTo || null,
    pageSize: PAGE_SIZE,
    pageOffset,
  });
  const records = documentsResult.kind === "records" ? documentsResult.records : [];

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Documents</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Document upload</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Upload official HOA documents and browse records according to your document permissions.
      </p>
      <p
        id="document-upload-status"
        aria-live="polite"
        className="mt-4 min-h-6 text-sm leading-6 text-[#4f5f5a]"
      >
        {uploadNotice(documentUpload)}
      </p>
      <UploadForm
        communitySlug={communitySlug}
        uploadStatus={documentUpload}
        uploadField={documentUploadField}
      />

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Document listing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Filters narrow the records returned by the authorized document list.
        </p>
        <DocumentFilters
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          category={category}
          query={query}
          effectiveFrom={effectiveFrom}
          effectiveTo={effectiveTo}
          expirationFrom={expirationFrom}
          expirationTo={expirationTo}
        />
        <DocumentsResult records={records} resultKind={documentsResult.kind} />
        <Pagination
          communitySlug={communitySlug}
          visibility={visibility}
          status={status}
          category={category}
          query={query}
          effectiveFrom={effectiveFrom}
          effectiveTo={effectiveTo}
          expirationFrom={expirationFrom}
          expirationTo={expirationTo}
          pageOffset={pageOffset}
          hasNextPage={documentsResult.kind === "records" && records.length === PAGE_SIZE}
        />
      </div>
    </section>
  );
}
