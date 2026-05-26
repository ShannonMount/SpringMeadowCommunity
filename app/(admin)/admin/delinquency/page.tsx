import {
  listDelinquencyReport,
  type DelinquencyReportRecord,
  type DelinquencyStage,
} from "@/server/services/payments/delinquency-reporting";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const DECIMAL_DOLLAR_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;

type DelinquencyPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    stage?: string | string[];
    query?: string | string[];
    from?: string | string[];
    to?: string | string[];
    minimumBalance?: string | string[];
    pageOffset?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
}

function parseDollarAmountCents(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!DECIMAL_DOLLAR_PATTERN.test(trimmed)) {
    return null;
  }

  const [dollars, cents = ""] = trimmed.split(".");
  const parsed = Number(`${dollars}${cents.padEnd(2, "0")}`);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
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

function formatStage(value: DelinquencyStage) {
  const labels: Record<DelinquencyStage, string> = {
    current: "Current",
    due_soon: "Due soon",
    overdue: "Overdue",
    delinquent: "Delinquent",
    lien_review: "Lien review",
    disputed: "Disputed",
  };

  return labels[value];
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function delinquencyHref(input: {
  communitySlug: string;
  stage?: string;
  query?: string;
  from?: string;
  to?: string;
  minimumBalance?: string;
  pageOffset: number;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "stage", input.stage);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "from", input.from);
  setOptionalParam(params, "to", input.to);
  setOptionalParam(params, "minimumBalance", input.minimumBalance);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/delinquency?${params.toString()}`;
}

function Filters({
  communitySlug,
  stage,
  query,
  from,
  to,
  minimumBalance,
}: {
  communitySlug: string;
  stage?: string;
  query?: string;
  from?: string;
  to?: string;
  minimumBalance?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-6">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="stage" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Stage
        </label>
        <select id="stage" name="stage" defaultValue={stage ?? ""} className={inputClass}>
          <option value="">All</option>
          <option value="due_soon">Due soon</option>
          <option value="overdue">Overdue</option>
          <option value="delinquent">Delinquent</option>
          <option value="lien_review">Lien review</option>
          <option value="disputed">Disputed</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="query" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Property
        </label>
        <input id="query" name="query" type="search" defaultValue={query ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="from" className="text-xs font-semibold uppercase text-[var(--accent)]">
          From
        </label>
        <input id="from" name="from" type="date" defaultValue={from ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="to" className="text-xs font-semibold uppercase text-[var(--accent)]">
          To
        </label>
        <input id="to" name="to" type="date" defaultValue={to ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-1">
        <label
          htmlFor="minimumBalance"
          className="text-xs font-semibold uppercase text-[var(--accent)]"
        >
          Minimum balance
        </label>
        <input
          id="minimumBalance"
          name="minimumBalance"
          type="text"
          inputMode="decimal"
          defaultValue={minimumBalance ?? ""}
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

function ReportTable({ records }: { records: DelinquencyReportRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
        No properties match the current filters.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-[1120px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--accent)]">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Property
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Stage
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Current balance
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Oldest due
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Days past due
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Disputed
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Review candidate
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Open assessments
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Last payment
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Next due
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.propertyId} className="border-b border-[var(--border)] last:border-0">
              <td className="max-w-[260px] py-3 pr-4 text-[var(--foreground)]">
                {record.propertyLabel}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatStage(record.stage)}</td>
              <td className="py-3 pr-4 font-semibold text-[var(--foreground)]">
                {formatCurrency(record.currentBalanceCents)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {formatDateOnly(record.oldestUnpaidDueDate)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{record.daysPastDue}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {record.hasDisputedAssessment ? "Yes" : "No"}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {record.lienReviewCandidate ? "Review candidate" : "No"}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {record.openAssessmentCount} / {formatCurrency(record.openAssessmentBalanceCents)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatDateTime(record.lastPaymentAt)}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatDateOnly(record.nextDueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginationControls({
  communitySlug,
  stage,
  query,
  from,
  to,
  minimumBalance,
  pageOffset,
  hasNextPage,
}: {
  communitySlug: string;
  stage?: string;
  query?: string;
  from?: string;
  to?: string;
  minimumBalance?: string;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const hasPreviousPage = pageOffset > 0;
  const linkClass =
    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
  const disabledClass =
    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#8a9792]";

  if (!hasPreviousPage && !hasNextPage) {
    return null;
  }

  return (
    <nav aria-label="Delinquency report pages" className="mt-4 flex items-center gap-3">
      {hasPreviousPage ? (
        <a
          href={delinquencyHref({
            communitySlug,
            stage,
            query,
            from,
            to,
            minimumBalance,
            pageOffset: Math.max(pageOffset - PAGE_SIZE, 0),
          })}
          className={linkClass}
        >
          Previous
        </a>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous
        </span>
      )}
      {hasNextPage ? (
        <a
          href={delinquencyHref({
            communitySlug,
            stage,
            query,
            from,
            to,
            minimumBalance,
            pageOffset: pageOffset + PAGE_SIZE,
          })}
          className={linkClass}
        >
          Next
        </a>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next
        </span>
      )}
    </nav>
  );
}

export default async function DelinquencyPage({ searchParams }: DelinquencyPageProps) {
  const params = await searchParams;
  const communitySlug = getSingleSearchParam(params?.communitySlug) || DEFAULT_COMMUNITY_SLUG;
  const stage = getSingleSearchParam(params?.stage);
  const query = getSingleSearchParam(params?.query);
  const from = getSingleSearchParam(params?.from);
  const to = getSingleSearchParam(params?.to);
  const minimumBalance = getSingleSearchParam(params?.minimumBalance);
  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
  const result = await listDelinquencyReport({
    communitySlug,
    stage,
    query,
    from,
    to,
    minimumBalanceCents: parseDollarAmountCents(minimumBalance),
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  });

  if (result.kind !== "records") {
    return (
      <section>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
          Delinquency report
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Delinquency report is unavailable.
        </p>
      </section>
    );
  }

  const visibleRecords = result.records.slice(0, PAGE_SIZE);
  const hasNextPage = result.records.length > PAGE_SIZE;

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Delinquency report
      </h1>
      <Filters
        communitySlug={result.communitySlug}
        stage={stage}
        query={query}
        from={from}
        to={to}
        minimumBalance={minimumBalance}
      />
      <ReportTable records={visibleRecords} />
      <PaginationControls
        communitySlug={result.communitySlug}
        stage={stage}
        query={query}
        from={from}
        to={to}
        minimumBalance={minimumBalance}
        pageOffset={pageOffset}
        hasNextPage={hasNextPage}
      />
    </section>
  );
}
