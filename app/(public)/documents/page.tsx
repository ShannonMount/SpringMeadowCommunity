import type { Metadata } from "next";
import {
  listDocumentMetadata,
  type DocumentMetadataRecord,
} from "@/server/services/documents/document-metadata";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PUBLIC_DOCUMENT_PAGE_SIZE = 50;
const MAX_FILTER_LENGTH = 120;
const MAX_QUERY_LENGTH = 200;

type PublicDocumentsPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    query?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Documents | Spring Meadow Community",
  description: "Public HOA documents and resources for Spring Meadow Community.",
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

function publicCategories(records: DocumentMetadataRecord[]) {
  return Array.from(new Set(records.map((record) => record.category))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function documentDownloadHref(record: DocumentMetadataRecord) {
  return `/api/documents/${record.id}/signed-url?redirect=1`;
}

function PublicDocumentFilters({
  category,
  query,
  categories,
}: {
  category: string;
  query: string;
  categories: string[];
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 md:grid-cols-[1fr_1fr_auto]">
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
          list={categories.length > 0 ? "public-document-categories" : undefined}
          className={inputClass}
        />
        {categories.length > 0 ? (
          <datalist id="public-document-categories">
            {categories.map((documentCategory) => (
              <option key={documentCategory} value={documentCategory} />
            ))}
          </datalist>
        ) : null}
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

function PublicDocumentList({ records }: { records: DocumentMetadataRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6">
        <h2 className="text-2xl font-semibold text-[#17211d]">
          No public documents are available right now.
        </h2>
        <p className="mt-3 leading-7 text-[#41504a]">
          Public resources will appear here after the HOA publishes them.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-5 md:grid-cols-2">
      {records.map((record) => (
        <li key={record.id}>
          <article className="h-full border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-[var(--border)] bg-[#f7f8f5] px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                {record.category}
              </span>
              <span className="border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-[#41504a]">
                {record.contentType}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-[#17211d]">{record.title}</h3>
            {record.description ? (
              <p className="mt-3 leading-7 text-[#41504a]">{record.description}</p>
            ) : null}
            <dl className="mt-5 grid gap-4 text-sm text-[#41504a] sm:grid-cols-3">
              <div>
                <dt className="font-semibold text-[#17211d]">Size</dt>
                <dd className="mt-1">{formatBytes(record.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#17211d]">Effective</dt>
                <dd className="mt-1">{formatDateOnly(record.effectiveDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#17211d]">Expires</dt>
                <dd className="mt-1">{formatDateOnly(record.expirationDate)}</dd>
              </div>
            </dl>
            <a
              href={documentDownloadHref(record)}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Download
            </a>
          </article>
        </li>
      ))}
    </ul>
  );
}

export default async function DocumentsPage({ searchParams }: PublicDocumentsPageProps) {
  const params = (await searchParams) ?? {};
  const query = boundedText(getSingleSearchParam(params.query), MAX_QUERY_LENGTH);
  const category = boundedText(getSingleSearchParam(params.category), MAX_FILTER_LENGTH);
  const documentsResult = await listDocumentMetadata({
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    visibility: "public",
    status: "active",
    category: category || null,
    query: query || null,
    pageSize: PUBLIC_DOCUMENT_PAGE_SIZE,
    pageOffset: 0,
  });
  const records = documentsResult.kind === "records" ? documentsResult.records : [];
  const categories = publicCategories(records);
  const unavailable = documentsResult.kind !== "records";

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public resources</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Document library
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Browse public HOA documents published for Spring Meadow Community. Private resident,
          property, board, payment, and administrative records are not shown on this page.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="document-library-heading"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div>
            <h2 id="document-library-heading" className="text-2xl font-semibold text-[#17211d]">
              Public documents
            </h2>
            <p className="mt-2 leading-7 text-[#41504a]">
              Filter public records by title, description, or category.
            </p>
          </div>

          <PublicDocumentFilters category={category} query={query} categories={categories} />

          {unavailable ? (
            <div className="mt-8 border border-[var(--border)] bg-[#f7f8f5] p-6">
              <h2 className="text-2xl font-semibold text-[#17211d]">
                Document library is temporarily unavailable.
              </h2>
              <p className="mt-3 leading-7 text-[#41504a]">
                Please try again later or contact the HOA for help.
              </p>
            </div>
          ) : (
            <PublicDocumentList records={records} />
          )}
        </div>
      </section>
    </>
  );
}
