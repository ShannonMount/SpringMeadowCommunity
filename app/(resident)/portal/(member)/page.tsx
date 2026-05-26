import Link from "next/link";
import {
  getResidentDashboardSummary,
  type DashboardPropertySummary,
} from "@/server/services/auth/resident-dashboard";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function formatDashboardDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = parseDashboardDate(value);

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

function parseDashboardDate(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatStatus(value: DashboardPropertySummary["duesStatus"]) {
  const labels: Record<DashboardPropertySummary["duesStatus"], string> = {
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

function propertyLocation(property: DashboardPropertySummary) {
  return [property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");
}

function PayAction({ property }: { property: DashboardPropertySummary }) {
  if (!property.canPayDues) {
    return (
      <p className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[#4f5f5a]">
        Pay dues is unavailable for this property.
      </p>
    );
  }

  return (
    <Link
      href="/portal/payments"
      className="mt-4 inline-flex min-h-10 items-center rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
    >
      Pay dues
    </Link>
  );
}

function HistoryLink({ property }: { property: DashboardPropertySummary }) {
  if (!property.canViewBalance) {
    return null;
  }

  return (
    <Link
      href="/portal/payments"
      className="mt-4 inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
    >
      View payment history
    </Link>
  );
}

function PropertySummaryCard({ property }: { property: DashboardPropertySummary }) {
  return (
    <article className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{property.addressLine1}</h2>
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

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Current balance</dt>
          <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
            {property.canViewBalance ? formatCurrency(property.currentBalanceCents) : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Next due date</dt>
          <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
            {property.canViewBalance ? formatDashboardDate(property.nextDueDate) : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Last payment</dt>
          <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
            {property.canViewBalance ? formatDashboardDate(property.lastPaymentAt) : "Unavailable"}
          </dd>
        </div>
      </dl>

      {!property.canViewBalance ? (
        <p className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[#4f5f5a]">
          Balance and payment history are unavailable for this membership. Contact the HOA for
          payment help.
        </p>
      ) : null}
      <PayAction property={property} />
      <HistoryLink property={property} />
    </article>
  );
}

function UnavailableDashboard() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Dashboard</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Resident dashboard</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Dashboard information is temporarily unavailable. Please try again later.
      </p>
    </section>
  );
}

export default async function ResidentPortalPage() {
  const dashboardResult = await getResidentDashboardSummary();

  if (dashboardResult.kind !== "dashboard") {
    return <UnavailableDashboard />;
  }

  const hasMultipleProperties = dashboardResult.properties.length > 1;

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Dashboard</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">Resident dashboard</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Welcome, {dashboardResult.profile.displayName}. Review your property status and recent community
        updates.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <section>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--accent)]">
                {hasMultipleProperties ? "Authorized properties" : "Linked property"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Dues status</h2>
            </div>
            <Link
              href="/portal/my-property"
              className="text-sm font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              My Property
            </Link>
          </div>

          <div className="mt-4 grid gap-4">
            {dashboardResult.properties.map((property) => (
              <PropertySummaryCard key={property.membershipId} property={property} />
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Announcements</h2>
              <Link
                href="/portal/announcements"
                className="text-sm font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                View all
              </Link>
            </div>
            {dashboardResult.announcements.length > 0 ? (
              <ul className="mt-4 grid gap-3">
                {dashboardResult.announcements.map((announcement) => (
                  <li key={announcement.id}>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {announcement.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">{announcement.summary}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[#4f5f5a]">
                No resident announcements are available right now.
              </p>
            )}
          </section>

          <section className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Upcoming events</h2>
              <Link
                href="/portal/events"
                className="text-sm font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                View all
              </Link>
            </div>
            {dashboardResult.upcomingEvents.length > 0 ? (
              <ul className="mt-4 grid gap-3">
                {dashboardResult.upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">
                      {formatDashboardDate(event.startsAt)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#4f5f5a]">{event.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[#4f5f5a]">
                No upcoming resident events are available right now.
              </p>
            )}
          </section>

          <section className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Quick actions</h2>
            <div className="mt-4 grid gap-3">
              {[
                ["Payments", "/portal/payments"],
                ["Documents", "/portal/documents"],
                ["Contact Board", "/portal/contact-board"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-sm border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
