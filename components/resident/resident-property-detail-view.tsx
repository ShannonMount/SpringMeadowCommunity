import Link from "next/link";
import { type ResidentPropertyDetailResult } from "@/server/services/auth/resident-property-detail";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PropertyDetails = Extract<
  ResidentPropertyDetailResult,
  { kind: "property-details" }
>;

type ResidentPropertyDetailsViewProps = {
  result: PropertyDetails;
};

function formatRelationship(value: string) {
  return value.replaceAll("_", " ");
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function parsePropertyDate(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatPropertyDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = parsePropertyDate(value);

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

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    current: "Current",
    due_soon: "Due soon",
    overdue: "Overdue",
    delinquent: "Delinquent",
    lien_review: "Review needed",
    disputed: "Disputed",
    unavailable: "Unavailable",
  };

  return labels[value] ?? "Unavailable";
}

function propertyLocation(property: PropertyDetails["properties"][number]) {
  return [property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--accent)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function PropertyActions({ property }: { property: PropertyDetails["properties"][number] }) {
  return (
    <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
      {property.canPayDues ? (
        <Link
          href="/portal/payments"
          className="inline-flex min-h-10 items-center rounded-sm bg-[var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          Pay dues
        </Link>
      ) : (
        <p className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[#4f5f5a]">
          Pay dues is unavailable for this membership.
        </p>
      )}
      {property.canViewDocuments ? (
        <Link
          href="/portal/documents"
          className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          View documents
        </Link>
      ) : (
        <p className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[#4f5f5a]">
          Document access is unavailable for this membership.
        </p>
      )}
      {property.canInviteMembers ? (
        <p className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[#4f5f5a]">
          Member updates are available through HOA support.
        </p>
      ) : (
        <p className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[#4f5f5a]">
          Member management is unavailable for this membership.
        </p>
      )}
    </div>
  );
}

function PropertyDetailCard({ property }: { property: PropertyDetails["properties"][number] }) {
  return (
    <article className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{property.addressLine1}</h2>
          <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">{propertyLocation(property)}</p>
          <p className="mt-2 text-sm text-[#4f5f5a]">
            Relationship: {formatRelationship(property.relationship)}
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

      <section className="mt-6">
        <h3 className="text-base font-semibold text-[var(--foreground)]">Property details</h3>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailValue label="County" value={property.county ?? "Not on file"} />
          <DetailValue label="Lot" value={property.lotNumber ?? "Not on file"} />
          <DetailValue label="Parcel" value={property.parcelNumber ?? "Not on file"} />
          <DetailValue label="Plat" value={property.platReference ?? "Not on file"} />
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-base font-semibold text-[var(--foreground)]">Account summary</h3>
        {property.canViewBalance ? (
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            <DetailValue label="Current balance" value={formatCurrency(property.currentBalanceCents)} />
            <DetailValue label="Next due date" value={formatPropertyDate(property.nextDueDate)} />
            <DetailValue label="Last payment" value={formatPropertyDate(property.lastPaymentAt)} />
          </dl>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">
            Balance details are unavailable for this membership.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-base font-semibold text-[var(--foreground)]">Linked member summary</h3>
        <ul className="mt-3 grid gap-2">
          {property.linkedMemberSummary.displayMembers.map((member) => (
            <li key={`${property.membershipId}-${member.relationship}`} className="text-sm text-[#4f5f5a]">
              <span className="font-semibold text-[var(--foreground)]">{member.displayName}</span>
              {" - "}
              {formatRelationship(member.relationship)}
            </li>
          ))}
        </ul>
        {!property.linkedMemberSummary.memberManagementAvailable ? (
          <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">
            Additional linked member details are not available for this membership.
          </p>
        ) : null}
      </section>

      <PropertyActions property={property} />
    </article>
  );
}

export function ResidentPropertyUnavailable() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">My Property</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Property details unavailable
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Property details are unavailable. Please contact the HOA for help.
      </p>
    </section>
  );
}

export function ResidentPropertyDetailsView({ result }: ResidentPropertyDetailsViewProps) {
  const hasMultipleProperties = result.properties.length > 1;

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">My Property</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">My Property</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Review the property and membership information currently available for your account.
      </p>
      <div className="mt-8">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">
          {hasMultipleProperties ? "Authorized properties" : "Authorized property"}
        </p>
        <div className="mt-4 grid gap-4">
          {result.properties.map((property) => (
            <PropertyDetailCard key={property.membershipId} property={property} />
          ))}
        </div>
      </div>
    </section>
  );
}
