import Link from "next/link";
import {
  getAdminDashboardSummary,
  type AdminDashboardSection,
} from "@/server/services/admin/dashboard-summary";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
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

function DashboardUnavailable() {
  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Dashboard</p>
      <h1 className="text-3xl font-semibold text-[var(--foreground)]">Operations dashboard</h1>
      <p className="max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        Dashboard summary is temporarily unavailable. Please try again later.
      </p>
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-28 min-w-0 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="min-w-0 break-words text-sm font-medium text-[#4f5f5a]">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 break-words text-xs leading-5 text-[#62716c]">{detail}</p> : null}
    </div>
  );
}

function SectionPanel({
  title,
  href,
  section,
  emptyMessage,
  children,
}: {
  title: string;
  href?: string;
  section: AdminDashboardSection;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  if (section.state === "permission_denied") {
    return (
      <section className="space-y-3 border-t border-[var(--border)] pt-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="text-sm leading-6 text-[#4f5f5a]">Not available for your role.</p>
      </section>
    );
  }

  if (section.state === "not_configured") {
    return (
      <section className="space-y-3 border-t border-[var(--border)] pt-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="text-sm leading-6 text-[#4f5f5a]">
          Compliance tracking has not been configured yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border-t border-[var(--border)] pt-6">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="min-w-0 break-words text-xl font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-10 items-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Open section
          </Link>
        ) : null}
      </div>
      {section.state === "empty" ? (
        <p className="text-sm leading-6 text-[#4f5f5a]">{emptyMessage}</p>
      ) : null}
      {children}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const dashboardResult = await getAdminDashboardSummary();

  if (dashboardResult.kind !== "dashboard") {
    return <DashboardUnavailable />;
  }

  const { sections, generatedAt } = dashboardResult.dashboard;

  return (
    <section className="space-y-8">
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Dashboard</p>
        <h1 className="mt-3 break-words text-3xl font-semibold text-[var(--foreground)]">
          Operations dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          Updated {formatGeneratedAt(generatedAt)}
        </p>
      </div>

      <SectionPanel
        title="Properties and overdue work"
        href="/admin/delinquency"
        section={sections.properties}
        emptyMessage="No active properties."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Active properties" value={formatCount(sections.properties.activeCount)} />
          <MetricTile label="Due soon" value={formatCount(sections.properties.dueSoonCount)} />
          <MetricTile
            label="Overdue properties"
            value={formatCount(sections.properties.overdueCount)}
            detail="Includes delinquency summary status"
          />
          <MetricTile
            label="Lien review"
            value={formatCount(sections.properties.lienReviewCount)}
            detail={`${formatCount(sections.properties.overdueAssessmentCount)} overdue assessments`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Payments"
        href="/admin/payments"
        section={sections.payments}
        emptyMessage="No payment activity needs attention."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Pending payments" value={formatCount(sections.payments.pendingCount)} />
          <MetricTile
            label="Failed payments"
            value={formatCount(sections.payments.failedCount)}
            detail={sections.payments.failedCount === 0 ? "No failed payments" : "Needs review"}
          />
          <MetricTile
            label="Succeeded last 30 days"
            value={formatCount(sections.payments.succeededLast30DaysCount)}
          />
          <MetricTile
            label="Collected last 30 days"
            value={formatCurrency(sections.payments.succeededLast30DaysAmountCents)}
            detail={`${formatCount(sections.payments.offlinePendingCount)} offline pending`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Documents"
        href="/admin/documents"
        section={sections.documents}
        emptyMessage="No active documents."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Active documents" value={formatCount(sections.documents.activeCount)} />
          <MetricTile
            label="Expiring soon"
            value={formatCount(sections.documents.expiringSoonCount)}
            detail={
              sections.documents.expiringSoonCount === 0
                ? "No documents expiring soon"
                : "Expires within 30 days"
            }
          />
          <MetricTile
            label="Restricted visibility"
            value={formatCount(sections.documents.restrictedCount)}
          />
          <MetricTile
            label="Recent uploads"
            value={formatCount(sections.documents.recentUploadCount)}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Messages"
        href="/admin/messages"
        section={sections.messages}
        emptyMessage="No active messages."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Open messages"
            value={formatCount(sections.messages.openCount)}
            detail={sections.messages.openCount === 0 ? "No active messages" : undefined}
          />
          <MetricTile
            label="Pending board"
            value={formatCount(sections.messages.pendingBoardCount)}
          />
          <MetricTile
            label="Pending resident"
            value={formatCount(sections.messages.pendingResidentCount)}
          />
          <MetricTile
            label="Unassigned"
            value={formatCount(sections.messages.unassignedCount)}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Compliance"
        href="/admin/compliance"
        section={sections.compliance}
        emptyMessage="Compliance tracking has not been configured yet."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Upcoming deadlines" value={formatCount(sections.compliance.upcomingCount)} />
          <MetricTile label="Overdue items" value={formatCount(sections.compliance.overdueCount)} />
        </div>
      </SectionPanel>
    </section>
  );
}
