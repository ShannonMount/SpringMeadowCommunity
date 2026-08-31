import StandardTable from "@/components/admin/data-table/StandardTable";
import {
  AUDIT_LOGS_ACCESS_PERMISSION,
  listAuditLogs,
} from "@/server/services/admin/audit-log-viewer";

function formatTimestamp(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
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

function summarizeAuditField(value: unknown) {
  if (value == null) return "—";

  if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;

  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    const json = JSON.stringify(value);
    return json.length > 80 ? `${json.slice(0, 77)}...` : json;
  } catch {
    return "—";
  }
}

export default async function AdminAuditPage() {
  const result = await listAuditLogs();

  if (result.kind !== "audit-logs") {
    return (
      <section className="space-y-4 p-4">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Audit logs</p>
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Audit log viewer</h1>
        <p className="text-sm leading-6 text-[#4f5f5a]">
          {result.kind === "unauthenticated"
            ? "Please sign in to view audit logs."
            : result.kind === "profile-unavailable"
              ? result.message
              : result.kind === "permission-denied"
                ? result.message
                : result.message}
        </p>
      </section>
    );
  }

  const columns = [
    { key: "createdAt", title: "Time", sortable: true, render: (row: typeof result.entries[number]) => formatTimestamp(row.createdAt) },
    { key: "action", title: "Action", sortable: true },
    { key: "actorType", title: "Actor", sortable: true },
    { key: "targetTable", title: "Target", sortable: true },
    { key: "targetId", title: "Target ID", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.targetId) },
    { key: "requestId", title: "Request", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.requestId) },
    { key: "reason", title: "Reason", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.reason) },
    { key: "beforeData", title: "Before", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.beforeData) },
    { key: "afterData", title: "After", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.afterData) },
    { key: "metadata", title: "Metadata", sortable: true, render: (row: typeof result.entries[number]) => summarizeAuditField(row.metadata) },
  ] as const;

  return (
    <section className="space-y-6 p-4">
      <div>
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Audit logs</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Audit log viewer</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#4f5f5a]">
          permission: {AUDIT_LOGS_ACCESS_PERMISSION}
        </p>
      </div>

      <StandardTable
        columns={columns as any}
        data={result.entries}
        rowKey="id"
        pageSize={25}
      />
    </section>
  );
}
