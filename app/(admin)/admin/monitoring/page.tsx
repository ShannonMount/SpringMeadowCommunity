import Link from "next/link";
import { getAdminMonitoringSummary } from "@/server/services/admin/monitoring-summary";

function formatTimestamp(value: string | null) {
  if (!value) return "Not available";

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

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-h-24 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-medium text-[#4f5f5a]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-2 text-xs text-[#62716c]">{detail}</p> : null}
    </div>
  );
}

function FailureList({ title, items }: { title: string; items: { kind: string; status: string; occurredAt: string | null; summary: string | null }[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-[var(--border)] bg-white p-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-2 text-sm text-[#4f5f5a]">No recent failures to report.</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[var(--border)] bg-white p-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.kind}-${item.occurredAt ?? "unknown"}-${index}`} className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#4f5f5a]">
              <span className="font-semibold capitalize text-[var(--foreground)]">{item.kind}</span>
              <span>•</span>
              <span>{item.status}</span>
              <span>•</span>
              <span>{formatTimestamp(item.occurredAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#4f5f5a]">
              {item.summary ?? "Operational error recorded without additional detail."}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminMonitoringPage() {
  const result = await getAdminMonitoringSummary();

  if (result.kind !== "monitoring") {
    return (
      <section className="space-y-4 p-4">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Monitoring</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Operational monitoring</h1>
        <p className="text-sm text-[#4f5f5a]">
          {result.kind === "unauthenticated"
            ? "Please sign in to view operational monitoring."
            : result.kind === "profile-unavailable"
              ? result.message
              : result.kind === "permission-denied"
                ? result.message
                : result.message}
        </p>
      </section>
    );
  }

  const { monitoring } = result;

  return (
    <section className="space-y-8 p-4">
      <div>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Monitoring</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Operational monitoring</h1>
        <p className="mt-2 text-sm text-[#4f5f5a]">Last refreshed {formatTimestamp(monitoring.generatedAt)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Webhook received" value={String(monitoring.webhooks.receivedCount)} detail="All received provider events" />
        <MetricTile label="Webhook processed" value={String(monitoring.webhooks.processedCount)} detail="Successfully processed event count" />
        <MetricTile label="Webhook failed" value={String(monitoring.webhooks.failedCount)} detail="Processing failures to review" />
        <MetricTile label="Webhook ignored" value={String(monitoring.webhooks.ignoredCount)} detail="Known duplicate or skipped results" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile label="Email queued" value={String(monitoring.emails.queuedCount)} />
        <MetricTile label="Email sent" value={String(monitoring.emails.sentCount)} />
        <MetricTile label="Email delivered" value={String(monitoring.emails.deliveredCount)} />
        <MetricTile label="Email bounced" value={String(monitoring.emails.bouncedCount)} />
        <MetricTile label="Email failed" value={String(monitoring.emails.failedCount)} />
        <MetricTile label="Email suppressed" value={String(monitoring.emails.suppressedCount)} />
      </div>

      <div className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Job and queue status</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricTile label="Failed jobs" value={String(monitoring.jobs.failedCount)} detail="Recent operational failures" />
          <MetricTile label="Last failure" value={formatTimestamp(monitoring.jobs.lastFailureAt)} detail={monitoring.jobs.lastFailureSummary ?? "Most recent failure timestamp"} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FailureList title="Recent webhook failures" items={monitoring.jobs.recentFailures.filter((item) => item.kind === "webhook")} />
        <FailureList title="Recent email failures" items={monitoring.jobs.recentFailures.filter((item) => item.kind === "email")} />
      </div>

      <div className="flex gap-3">
        <Link href="/admin" className="inline-flex h-10 items-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]">Back to dashboard</Link>
      </div>
    </section>
  );
}
