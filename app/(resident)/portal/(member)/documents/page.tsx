import {
  listDocumentMetadata,
  type DocumentMetadataRecord,
  type DocumentVisibility,
} from "@/server/services/documents/document-metadata";
import type { PropertyMembership } from "@/server/services/auth/property-memberships";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const RESIDENT_DOCUMENT_PAGE_SIZE = 50;
const MAX_FILTER_LENGTH = 120;
const MAX_QUERY_LENGTH = 200;

type ResidentDocumentsPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    query?: string | string[];
    propertyId?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boundedText(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length <= maxLength ? trimmed : "";
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

function formatVisibility(value: DocumentVisibility) {
  const labels: Partial<Record<DocumentVisibility, string>> = {
    resident: "Resident",
    property_specific: "Property",
  };

  return labels[value] ?? "Document";
}

function authorizedCategories(records: DocumentMetadataRecord[]) {
  return Array.from(new Set(records.map((record) => record.category))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function documentDownloadHref(record: DocumentMetadataRecord) {
  return `/api/documents/${record.id}/signed-url?redirect=1`;
}

function mergeDocumentRecords(groups: DocumentMetadataRecord[][]) {
  const recordsById = new Map<string, DocumentMetadataRecord>();

  for (const records of groups) {
    for (const record of records) {
      recordsById.set(record.id, record);
    }
  }

  return Array.from(recordsById.values()).sort((a, b) => {
    const createdComparison = b.createdAt.localeCompare(a.createdAt);

    return createdComparison || a.title.localeCompare(b.title);
  });
}

function propertyLabel(
  record: DocumentMetadataRecord,
  membershipsByPropertyId: Map<string, PropertyMembership>,
) {
  if (record.visibility !== "property_specific" || !record.relatedPropertyId) {
    return "Community-wide";
  }

  const membership = membershipsByPropertyId.get(record.relatedPropertyId);

  if (!membership) {
    return "Linked property";
  }

  return `${membership.property.addressLine1} (${membership.property.maskedAccountNumber})`;
}

function ResidentDocumentFilters({
  category,
  query,
  selectedPropertyId,
  memberships,
  categories,
}: {
  category: string;
  query: string;
  selectedPropertyId: string;
  memberships: PropertyMembership[];
  categories: string[];
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="grid gap-1">
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
        <label htmlFor="category" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Category
        </label>
        <input
          id="category"
          name="category"
          type="text"
          defaultValue={category}
          list={categories.length > 0 ? "resident-document-categories" : undefined}
          className={inputClass}
        />
        {categories.length > 0 ? (
          <datalist id="resident-document-categories">
            {categories.map((documentCategory) => (
              <option key={documentCategory} value={documentCategory} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div className="grid gap-1">
        <label htmlFor="propertyId" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Property
        </label>
        <select
          id="propertyId"
          name="propertyId"
          defaultValue={selectedPropertyId}
          className={inputClass}
        >
          <option value="">All linked properties</option>
          {memberships.map((membership) => (
            <option key={membership.property.id} value={membership.property.id}>
              {membership.property.addressLine1}
            </option>
          ))}
        </select>
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

function ResidentDocumentList({
  records,
  membershipsByPropertyId,
}: {
  records: DocumentMetadataRecord[];
  membershipsByPropertyId: Map<string, PropertyMembership>;
}) {
  if (records.length === 0) {
    return (
      <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
        No documents are available for this view.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 lg:grid-cols-2">
      {records.map((record) => (
        <li key={record.id}>
          <article className="h-full rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {formatVisibility(record.visibility)}
              </span>
              <span className="rounded-sm border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[#4f5f5a]">
                {record.category}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--foreground)]">{record.title}</h2>
            {record.description ? (
              <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">{record.description}</p>
            ) : null}
            <dl className="mt-5 grid gap-3 text-sm text-[#4f5f5a] sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Property</dt>
                <dd className="mt-1">{propertyLabel(record, membershipsByPropertyId)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Type</dt>
                <dd className="mt-1">{record.contentType}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Size</dt>
                <dd className="mt-1">{formatBytes(record.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Expires</dt>
                <dd className="mt-1">{formatDateOnly(record.expirationDate)}</dd>
              </div>
            </dl>
            <a
              href={documentDownloadHref(record)}
              className="mt-5 inline-flex min-h-10 items-center rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Download
            </a>
          </article>
        </li>
      ))}
    </ul>
  );
}

export default async function ResidentDocumentsPage({
  searchParams,
}: ResidentDocumentsPageProps) {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return null;
  }

  const params = (await searchParams) ?? {};
  const { memberships } = membershipResult;
  const documentMemberships = memberships.filter(
    (membership) => membership.membershipPermissions.canViewDocuments,
  );
  const canViewDocuments = memberships.some(
    (membership) => membership.membershipPermissions.canViewDocuments,
  );

  if (!canViewDocuments) {
    return (
      <section>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Documents</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
          Document access unavailable
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Document access is not available for your active linked properties. Contact the HOA for help.
        </p>
      </section>
    );
  }

  const authorizedPropertyIds = new Set(
    documentMemberships.map((membership) => membership.property.id),
  );
  const requestedPropertyId = boundedText(getSingleSearchParam(params.propertyId), MAX_FILTER_LENGTH);
  const selectedPropertyId = authorizedPropertyIds.has(requestedPropertyId)
    ? requestedPropertyId
    : "";
  const category = boundedText(getSingleSearchParam(params.category), MAX_FILTER_LENGTH);
  const query = boundedText(getSingleSearchParam(params.query), MAX_QUERY_LENGTH);
  const sharedFilters = {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    status: "active",
    category: category || null,
    query: query || null,
    pageSize: RESIDENT_DOCUMENT_PAGE_SIZE,
    pageOffset: 0,
  } as const;
  const [residentDocumentsResult, propertyDocumentsResult] = await Promise.all([
    listDocumentMetadata({
      ...sharedFilters,
      visibility: "resident",
    }),
    listDocumentMetadata({
      ...sharedFilters,
      visibility: "property_specific",
      relatedPropertyId: selectedPropertyId || null,
    }),
  ]);
  const residentRecords =
    residentDocumentsResult.kind === "records" ? residentDocumentsResult.records : [];
  const propertyRecords =
    propertyDocumentsResult.kind === "records" ? propertyDocumentsResult.records : [];
  const records = mergeDocumentRecords([residentRecords, propertyRecords]);
  const categories = authorizedCategories(records);
  const unavailable =
    residentDocumentsResult.kind !== "records" || propertyDocumentsResult.kind !== "records";
  const membershipsByPropertyId = new Map(
    documentMemberships.map((membership) => [membership.property.id, membership]),
  );

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Documents</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Resident documents
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Browse HOA records available to your active linked properties.
      </p>

      <ResidentDocumentFilters
        category={category}
        query={query}
        selectedPropertyId={selectedPropertyId}
        memberships={documentMemberships}
        categories={categories}
      />

      {unavailable ? (
        <p className="mt-6 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#4f5f5a]">
          Document library is temporarily unavailable.
        </p>
      ) : (
        <ResidentDocumentList records={records} membershipsByPropertyId={membershipsByPropertyId} />
      )}
    </section>
  );
}
