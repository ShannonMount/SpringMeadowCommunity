import { startResidentPaymentSession } from "@/server/actions/resident-payments";
import {
  getResidentDuesStatus,
  type ResidentAssessmentSummary,
  type ResidentDuesProperty,
  type ResidentPaymentSummary,
} from "@/server/services/payments/resident-dues";
import {
  getResidentPaymentSettings,
  type ResidentPaymentSetting,
} from "@/server/services/payments/resident-payment-session";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ResidentPaymentsPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
  }>;
};

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function parsePaymentDate(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatPaymentDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = parsePaymentDate(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function formatStatus(value: ResidentDuesProperty["duesStatus"]) {
  const labels: Record<ResidentDuesProperty["duesStatus"], string> = {
    current: "Current",
    due_soon: "Due soon",
    overdue: "Overdue",
    delinquent: "Delinquent",
    lien_review: "Review needed",
    disputed: "Disputed",
    unavailable: "Unavailable",
  };

  return labels[value];
}

function formatToken(value: string) {
  return value.replaceAll("_", " ");
}

function formatPaymentMethod(value: ResidentPaymentSummary["method"]) {
  const labels: Record<ResidentPaymentSummary["method"], string> = {
    card: "Card",
    ach: "ACH",
    check: "Check",
    cash: "Cash",
    manual: "Manual",
    other: "Other",
  };

  return labels[value];
}

function formatPaymentStatus(value: ResidentPaymentSummary["status"]) {
  const labels: Record<ResidentPaymentSummary["status"], string> = {
    succeeded: "Paid",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
  };

  return labels[value];
}

function formatPayerType(value: ResidentPaymentSummary["payerType"]) {
  const labels: Record<ResidentPaymentSummary["payerType"], string> = {
    resident: "Resident",
    guest: "Guest payer",
    admin_recorded: "HOA recorded",
  };

  return labels[value];
}

function propertyLocation(property: ResidentDuesProperty) {
  return [property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function paymentNoticeKey(value: string | undefined) {
  if (!value) {
    return null;
  }

  return `payment=${value}`;
}

function PaymentNotice({ payment }: { payment: string | undefined }) {
  const notices: Record<string, string> = {
    "payment=cancelled": "The online payment was cancelled. You can start again when ready.",
    "payment=invalid": "We could not start that payment. Check the amount and try again.",
    "payment=unauthorized": "Payment is unavailable for that membership. Contact the HOA for help.",
    "payment=unavailable": "Online payments are temporarily unavailable. Please try again later.",
    "payment=returned":
      "Your online payment was submitted for processing. Payment history updates after confirmation.",
  };
  const key = paymentNoticeKey(payment);
  const message = key ? notices[key] : null;

  if (!message) {
    return null;
  }

  return (
    <p
      role="status"
      className="mt-5 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[#4f5f5a]"
    >
      {message}
    </p>
  );
}

function formatCentsForInput(value: number | null) {
  if (!value || value <= 0) {
    return "";
  }

  const dollars = Math.floor(value / 100);
  const cents = String(value % 100).padStart(2, "0");

  return `${dollars}.${cents}`;
}

function PaymentUnavailable() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Payments</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Payment access unavailable
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Payment information is temporarily unavailable. Please try again later.
      </p>
    </section>
  );
}

function DuesSummary({ property }: { property: ResidentDuesProperty }) {
  return (
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
      <div>
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Current balance</dt>
        <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
          {formatCurrency(property.currentBalanceCents)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Next due date</dt>
        <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
          {formatPaymentDate(property.nextDueDate)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Last payment</dt>
        <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
          {formatPaymentDate(property.lastPaymentAt)}
        </dd>
      </div>
    </dl>
  );
}

function OpenAssessments({
  assessments,
  hasOpenAssessments,
}: {
  assessments: ResidentAssessmentSummary[];
  hasOpenAssessments: boolean;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-[var(--foreground)]">Open dues</h3>
      {hasOpenAssessments ? (
        <ul className="mt-3 grid gap-3">
          {assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {assessment.description}
                  </p>
                  <p className="mt-1 text-sm capitalize text-[#4f5f5a]">
                    {formatToken(assessment.type)} - {formatToken(assessment.status)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatCurrency(assessment.balanceCents)}
                </p>
              </div>
              <p className="mt-2 text-sm text-[#4f5f5a]">
                Due {formatPaymentDate(assessment.dueDate)}. Original amount{" "}
                {formatCurrency(assessment.amountCents)}, paid {formatCurrency(assessment.paidCents)}.
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">
          No open dues are available for this property.
        </p>
      )}
    </section>
  );
}

function PaymentHistory({
  payments,
  hasPaymentHistory,
}: {
  payments: ResidentPaymentSummary[];
  hasPaymentHistory: boolean;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-[var(--foreground)]">Payment history</h3>
      {hasPaymentHistory ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--accent)]">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Amount
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Method
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 text-[var(--foreground)]">
                    {formatPaymentDate(payment.paidAt)}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-[var(--foreground)]">
                    {formatCurrency(payment.amountCents)}
                  </td>
                  <td className="py-3 pr-4 text-[#4f5f5a]">
                    {formatPaymentMethod(payment.method)} - {formatPayerType(payment.payerType)}
                  </td>
                  <td className="py-3 pr-4 text-[#4f5f5a]">
                    {formatPaymentStatus(payment.status)}
                  </td>
                  <td className="py-3 pr-4 text-[#4f5f5a]">
                    {payment.receiptNumber ?? "Not available"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">
          No payment history is available for this property yet.
        </p>
      )}
    </section>
  );
}

function PaymentAction({
  property,
  paymentSetting,
}: {
  property: ResidentDuesProperty;
  paymentSetting: ResidentPaymentSetting | undefined;
}) {
  if (!property.canPayDues) {
    return (
      <p className="mt-5 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[#4f5f5a]">
        Payment actions are unavailable for this membership.
      </p>
    );
  }

  if (!paymentSetting?.onlinePaymentsAvailable) {
    return (
      <p className="mt-5 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[#4f5f5a]">
        Online payments are temporarily unavailable for this property. Contact the HOA for help.
      </p>
    );
  }

  const amountInputId = `payment-amount-${property.membershipId}`;
  const methodHelpId = `payment-method-help-${property.membershipId}`;
  const defaultMethod = paymentSetting.allowCard ? "card" : "ach";

  return (
    <form
      action={startResidentPaymentSession}
      className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5"
    >
      <input type="hidden" name="communityId" value={property.communityId} />
      <input type="hidden" name="propertyId" value={property.propertyId} />

      <div className="grid gap-2 sm:max-w-xs">
        <label htmlFor={amountInputId} className="text-sm font-semibold text-[var(--foreground)]">
          Payment amount
        </label>
        <input
          id={amountInputId}
          name="amount"
          type="text"
          inputMode="decimal"
          required
          pattern="^[0-9]+(\\.[0-9]{1,2})?$"
          defaultValue={formatCentsForInput(property.currentBalanceCents)}
          className="min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        />
        <p className="text-xs leading-5 text-[#4f5f5a]">
          Enter the amount you want to pay in dollars.
        </p>
      </div>

      <fieldset className="grid gap-2" aria-describedby={methodHelpId}>
        <legend className="text-sm font-semibold text-[var(--foreground)]">Payment method</legend>
        <p id={methodHelpId} className="text-xs leading-5 text-[#4f5f5a]">
          Available methods depend on community payment settings.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {paymentSetting.allowCard ? (
            <label className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">
              <input
                type="radio"
                name="methodPreference"
                value="card"
                defaultChecked={defaultMethod === "card"}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Card
            </label>
          ) : null}
          {paymentSetting.allowAch ? (
            <label className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">
              <input
                type="radio"
                name="methodPreference"
                value="ach"
                defaultChecked={defaultMethod === "ach"}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              ACH
            </label>
          ) : null}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Start online payment
        </button>
      </div>
    </form>
  );
}

function ResidentPaymentPropertyCard({
  property,
  paymentSetting,
}: {
  property: ResidentDuesProperty;
  paymentSetting: ResidentPaymentSetting | undefined;
}) {
  const hasOpenAssessments = property.openAssessments.length > 0;
  const hasPaymentHistory = property.paymentHistory.length > 0;

  return (
    <article className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{property.addressLine1}</h2>
          <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">{propertyLocation(property)}</p>
          <p className="mt-2 text-sm text-[#4f5f5a]">
            Relationship: {formatToken(property.relationship)}
          </p>
          <p className="mt-1 text-sm text-[#4f5f5a]">
            Account: {property.maskedAccountNumber}
          </p>
        </div>
        <div className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">Dues status</p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {formatStatus(property.duesStatus)}
          </p>
        </div>
      </div>

      {property.canViewBalance ? (
        <>
          <DuesSummary property={property} />
          <OpenAssessments
            assessments={property.openAssessments}
            hasOpenAssessments={hasOpenAssessments}
          />
          <PaymentHistory
            payments={property.paymentHistory}
            hasPaymentHistory={hasPaymentHistory}
          />
        </>
      ) : (
        <p className="mt-5 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[#4f5f5a]">
          Balance and payment history are unavailable for this membership. Contact the HOA for
          payment help.
        </p>
      )}
      <PaymentAction property={property} paymentSetting={paymentSetting} />
    </article>
  );
}

export default async function ResidentPaymentsPage({ searchParams }: ResidentPaymentsPageProps) {
  const params = await searchParams;
  const duesResult = await getResidentDuesStatus();
  const paymentSettingsResult = await getResidentPaymentSettings();

  if (duesResult.kind !== "resident-dues") {
    return <PaymentUnavailable />;
  }

  const settingsByCommunity = new Map(
    paymentSettingsResult.kind === "payment-settings"
      ? paymentSettingsResult.settings.map((setting) => [setting.communityId, setting] as const)
      : [],
  );

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Payments</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Payments</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Review dues status and payment history for your authorized linked properties.
      </p>
      <PaymentNotice payment={getSingleSearchParam(params?.payment)} />
      <div className="mt-6 grid gap-4">
        {duesResult.properties.map((property) => (
          <ResidentPaymentPropertyCard
            key={property.membershipId}
            property={property}
            paymentSetting={settingsByCommunity.get(property.communityId)}
          />
        ))}
      </div>
    </section>
  );
}
