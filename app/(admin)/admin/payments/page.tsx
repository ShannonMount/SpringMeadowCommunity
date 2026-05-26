import { recordAdminManualPayment } from "@/server/actions/admin-payments";
import {
  listAdminPaymentRecords,
  type AdminPaymentMethod,
  type AdminPaymentPayerType,
  type AdminPaymentRecord,
  type AdminPaymentStatus,
} from "@/server/services/payments/admin-payment-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;

type AdminPaymentsPageProps = {
  searchParams?: Promise<{
    communitySlug?: string | string[];
    status?: string | string[];
    payerType?: string | string[];
    method?: string | string[];
    query?: string | string[];
    from?: string | string[];
    to?: string | string[];
    pageOffset?: string | string[];
    manualPayment?: string | string[];
    manualPaymentField?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
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

function formatStatus(value: AdminPaymentStatus) {
  const labels: Record<AdminPaymentStatus, string> = {
    created: "Created",
    pending: "Pending",
    succeeded: "Succeeded",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    void: "Void",
  };

  return labels[value];
}

function formatPayerType(value: AdminPaymentPayerType) {
  const labels: Record<AdminPaymentPayerType, string> = {
    resident: "Resident",
    guest: "Guest",
    admin_recorded: "HOA recorded",
  };

  return labels[value];
}

function formatMethod(value: AdminPaymentMethod) {
  const labels: Record<AdminPaymentMethod, string> = {
    card: "Card",
    ach: "ACH",
    check: "Check",
    cash: "Cash",
    manual: "Manual",
    other: "Other",
  };

  return labels[value];
}

function formatFeePolicy(value: AdminPaymentRecord["feePolicy"]) {
  return value === "hoa_pays" ? "HOA pays" : "Payer pays";
}

function shortToken(value: string) {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function stripeSummary(payment: AdminPaymentRecord) {
  const entries = [
    payment.stripeCheckoutSessionId ? `Session ${shortToken(payment.stripeCheckoutSessionId)}` : null,
    payment.stripePaymentIntentId ? `Intent ${shortToken(payment.stripePaymentIntentId)}` : null,
    payment.stripeChargeId ? `Charge ${shortToken(payment.stripeChargeId)}` : null,
  ].filter(Boolean);

  return entries.length > 0 ? entries.join(" / ") : "None";
}

function selected(current: string | undefined, value: string) {
  return current === value;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function paymentRecordsHref(input: {
  communitySlug: string;
  status?: string;
  payerType?: string;
  method?: string;
  query?: string;
  from?: string;
  to?: string;
  pageOffset: number;
}) {
  const params = new URLSearchParams({ communitySlug: input.communitySlug });

  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "payerType", input.payerType);
  setOptionalParam(params, "method", input.method);
  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "from", input.from);
  setOptionalParam(params, "to", input.to);

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  return `/admin/payments?${params.toString()}`;
}

function ManualPaymentNotice({ value }: { value: string | undefined }) {
  const notices: Record<string, string> = {
    recorded: "Manual payment recorded.",
    invalid: "Check the manual payment details and try again.",
    disabled: "Manual payment recording is disabled.",
    denied: "You do not have permission to record payments.",
    signin: "Sign in before recording payments.",
    unavailable: "Manual payment recording is temporarily unavailable.",
  };
  const message = value ? notices[value] : null;

  return (
    <p
      id="manual-payment-status"
      aria-live="polite"
      className="min-h-6 text-sm leading-6 text-[#4f5f5a]"
    >
      {message}
    </p>
  );
}

const manualPaymentErrorIds: Record<string, string> = {
  propertyId: "manual-payment-error-propertyId",
  amount: "manual-payment-error-amount",
  manualMethod: "manual-payment-error-manualMethod",
  paidAt: "manual-payment-error-paidAt",
  allocations: "manual-payment-error-allocations",
  reason: "manual-payment-error-reason",
  form: "manual-payment-error-form",
};

function manualPaymentErrorId(field: string) {
  return manualPaymentErrorIds[field] ?? manualPaymentErrorIds.form;
}

function manualPaymentErrorMessage(field: string) {
  const messages: Record<string, string> = {
    propertyId: "Enter a valid property ID.",
    amount: "Enter a valid payment amount.",
    manualMethod: "Choose an offline payment method.",
    paidAt: "Enter a valid paid date and time.",
    allocations: "Check the allocation lines.",
    reason: "Remove payment instrument details from the reason.",
    form: "Check the manual payment details.",
  };

  return messages[field] ?? messages.form;
}

function isManualPaymentFieldInvalid(
  manualPayment: string | undefined,
  manualPaymentField: string | undefined,
  field: string,
) {
  return manualPayment === "invalid" && manualPaymentField === field;
}

function manualPaymentDescribedBy(
  manualPayment: string | undefined,
  manualPaymentField: string | undefined,
  field: string,
) {
  return isManualPaymentFieldInvalid(manualPayment, manualPaymentField, field)
    ? `manual-payment-status ${manualPaymentErrorId(field)}`
    : "manual-payment-status";
}

function ManualPaymentFieldError({
  field,
  active,
}: {
  field: string;
  active: boolean;
}) {
  if (!active) {
    return null;
  }

  return (
    <p id={manualPaymentErrorId(field)} className="text-sm leading-6 text-[#8a3f2d]">
      {manualPaymentErrorMessage(field)}
    </p>
  );
}

function Filters({
  communitySlug,
  status,
  payerType,
  method,
  query,
  from,
  to,
}: {
  communitySlug: string;
  status?: string;
  payerType?: string;
  method?: string;
  query?: string;
  from?: string;
  to?: string;
}) {
  const inputClass =
    "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 lg:grid-cols-6">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <div className="grid gap-1">
        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">All</option>
          {["created", "pending", "succeeded", "failed", "refunded", "partially_refunded", "void"].map(
            (option) => (
              <option key={option} value={option}>
                {formatStatus(option as AdminPaymentStatus)}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="payerType" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Payer
        </label>
        <select id="payerType" name="payerType" defaultValue={payerType ?? ""} className={inputClass}>
          <option value="">All</option>
          <option value="resident">Resident</option>
          <option value="guest">Guest</option>
          <option value="admin_recorded">HOA recorded</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="method" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Method
        </label>
        <select id="method" name="method" defaultValue={method ?? ""} className={inputClass}>
          <option value="">All</option>
          <option value="card">Card</option>
          <option value="ach">ACH</option>
          <option value="check">Check</option>
          <option value="cash">Cash</option>
          <option value="manual">Manual</option>
          <option value="other">Other</option>
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
      <div className="lg:col-span-6">
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

function PaymentTable({ records }: { records: AdminPaymentRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
        No payment records match the current filters.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-[1040px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--accent)]">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Paid
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Created
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Updated
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Property
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Status
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Payer
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Amount
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Method
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Fee policy
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Receipt
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Stripe
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Allocated
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Unapplied
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((payment) => (
            <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
              <td className="py-3 pr-4 text-[var(--foreground)]">
                {formatDateTime(payment.paidAt)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {formatDateTime(payment.createdAt)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">
                {formatDateTime(payment.updatedAt)}
              </td>
              <td className="max-w-[240px] py-3 pr-4 text-[var(--foreground)]">
                {payment.propertyLabel}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatStatus(payment.status)}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatPayerType(payment.payerType)}</td>
              <td className="py-3 pr-4 font-semibold text-[var(--foreground)]">
                {formatCurrency(payment.amountCents)}
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatMethod(payment.method)}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatFeePolicy(payment.feePolicy)}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{payment.receiptNumber ?? "None"}</td>
              <td className="max-w-[220px] py-3 pr-4 text-[#4f5f5a]">
                <span
                  title={[
                    payment.stripeCheckoutSessionId,
                    payment.stripePaymentIntentId,
                    payment.stripeChargeId,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                >
                  {stripeSummary(payment)}
                </span>
              </td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatCurrency(payment.allocatedCents)}</td>
              <td className="py-3 pr-4 text-[#4f5f5a]">{formatCurrency(payment.unappliedCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginationControls({
  communitySlug,
  status,
  payerType,
  method,
  query,
  from,
  to,
  pageOffset,
  hasNextPage,
}: {
  communitySlug: string;
  status?: string;
  payerType?: string;
  method?: string;
  query?: string;
  from?: string;
  to?: string;
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
    <nav aria-label="Payment records pages" className="mt-4 flex items-center gap-3">
      {hasPreviousPage ? (
        <a
          href={paymentRecordsHref({
            communitySlug,
            status,
            payerType,
            method,
            query,
            from,
            to,
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
          href={paymentRecordsHref({
            communitySlug,
            status,
            payerType,
            method,
            query,
            from,
            to,
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

function ManualPaymentForm({
  communitySlug,
  manualPayment,
  manualPaymentField,
}: {
  communitySlug: string;
  manualPayment?: string;
  manualPaymentField?: string;
}) {
  const inputClass =
    "min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
  const fieldInvalid = (field: string) =>
    isManualPaymentFieldInvalid(manualPayment, manualPaymentField, field);
  const fieldDescribedBy = (field: string) =>
    manualPaymentDescribedBy(manualPayment, manualPaymentField, field);

  return (
    <form action={recordAdminManualPayment} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5">
      <input type="hidden" name="communitySlug" value={communitySlug} />
      <input type="hidden" name="requestId" value={crypto.randomUUID()} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="propertyId" className="text-sm font-semibold text-[var(--foreground)]">
            Property ID
          </label>
          <input
            id="propertyId"
            name="propertyId"
            type="text"
            required
            aria-invalid={fieldInvalid("propertyId")}
            aria-describedby={fieldDescribedBy("propertyId")}
            className={inputClass}
          />
          <ManualPaymentFieldError field="propertyId" active={fieldInvalid("propertyId")} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="amount" className="text-sm font-semibold text-[var(--foreground)]">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            pattern="^[0-9]+(\\.[0-9]{1,2})?$"
            aria-invalid={fieldInvalid("amount")}
            aria-describedby={fieldDescribedBy("amount")}
            className={inputClass}
          />
          <ManualPaymentFieldError field="amount" active={fieldInvalid("amount")} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="manualMethod" className="text-sm font-semibold text-[var(--foreground)]">
            Method
          </label>
          <select
            id="manualMethod"
            name="manualMethod"
            required
            aria-invalid={fieldInvalid("manualMethod")}
            aria-describedby={fieldDescribedBy("manualMethod")}
            className={inputClass}
          >
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </select>
          <ManualPaymentFieldError field="manualMethod" active={fieldInvalid("manualMethod")} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="paidAt" className="text-sm font-semibold text-[var(--foreground)]">
            Paid at
          </label>
          <input
            id="paidAt"
            name="paidAt"
            type="datetime-local"
            aria-invalid={fieldInvalid("paidAt")}
            aria-describedby={fieldDescribedBy("paidAt")}
            className={inputClass}
          />
          <ManualPaymentFieldError field="paidAt" active={fieldInvalid("paidAt")} />
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="allocations" className="text-sm font-semibold text-[var(--foreground)]">
          Allocations
        </label>
        <textarea
          id="allocations"
          name="allocations"
          rows={4}
          aria-invalid={fieldInvalid("allocations")}
          aria-describedby={fieldDescribedBy("allocations")}
          className={`${inputClass} resize-y`}
        />
        <ManualPaymentFieldError field="allocations" active={fieldInvalid("allocations")} />
      </div>
      <div className="grid gap-2">
        <label htmlFor="reason" className="text-sm font-semibold text-[var(--foreground)]">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          aria-invalid={fieldInvalid("reason")}
          aria-describedby={fieldDescribedBy("reason")}
          className={`${inputClass} resize-y`}
        />
        <ManualPaymentFieldError field="reason" active={fieldInvalid("reason")} />
      </div>
      <div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Record offline payment
        </button>
      </div>
    </form>
  );
}

function ManualPaymentPanel({
  communitySlug,
  manualPaymentsEnabled,
  manualPayment,
  manualPaymentField,
}: {
  communitySlug: string;
  manualPaymentsEnabled: boolean;
  manualPayment?: string;
  manualPaymentField?: string;
}) {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">Offline payments</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Record manual payment</h2>
        </div>
        <ManualPaymentNotice value={manualPayment} />
      </div>
      {manualPaymentsEnabled ? (
        <ManualPaymentForm
          communitySlug={communitySlug}
          manualPayment={manualPayment}
          manualPaymentField={manualPaymentField}
        />
      ) : (
        <p className="mt-5 border-t border-[var(--border)] pt-5 text-sm leading-6 text-[#4f5f5a]">
          Manual payment recording is disabled for this community.
        </p>
      )}
    </section>
  );
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const params = await searchParams;
  const communitySlug = getSingleSearchParam(params?.communitySlug) || DEFAULT_COMMUNITY_SLUG;
  const status = getSingleSearchParam(params?.status);
  const payerType = getSingleSearchParam(params?.payerType);
  const method = getSingleSearchParam(params?.method);
  const query = getSingleSearchParam(params?.query);
  const from = getSingleSearchParam(params?.from);
  const to = getSingleSearchParam(params?.to);
  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
  const manualPayment = getSingleSearchParam(params?.manualPayment);
  const manualPaymentField = getSingleSearchParam(params?.manualPaymentField);
  const result = await listAdminPaymentRecords({
    communitySlug,
    status,
    payerType,
    method,
    query,
    from,
    to,
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  });

  if (result.kind !== "records") {
    return (
      <section>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Payment records</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Payment records are unavailable.
        </p>
      </section>
    );
  }

  const visibleRecords = result.records.slice(0, PAGE_SIZE);
  const hasNextPage = result.records.length > PAGE_SIZE;

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Payment records</h1>
      <Filters
        communitySlug={result.communitySlug}
        status={status}
        payerType={payerType}
        method={method}
        query={query}
        from={from}
        to={to}
      />
      <PaymentTable records={visibleRecords} />
      <PaginationControls
        communitySlug={result.communitySlug}
        status={status}
        payerType={payerType}
        method={method}
        query={query}
        from={from}
        to={to}
        pageOffset={pageOffset}
        hasNextPage={hasNextPage}
      />
      <ManualPaymentPanel
        communitySlug={result.communitySlug}
        manualPaymentsEnabled={result.manualPaymentsEnabled}
        manualPayment={manualPayment}
        manualPaymentField={manualPaymentField}
      />
    </section>
  );
}
