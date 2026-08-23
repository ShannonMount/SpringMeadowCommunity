import "server-only";

import StandardTable from "@/components/admin/data-table/StandardTable";
import {
  listAdminProperties,
  type AdminPropertySummary,
} from "@/server/services/admin/property-management";
import { hasPermission } from "@/server/services/auth/permissions";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";

export default async function AdminDataTablesExamplePage() {
  const result = await listAdminProperties({ communitySlug: DEFAULT_COMMUNITY_SLUG, pageSize: 50 });

  let properties: AdminPropertySummary[] = [];
  let message: string | null = null;

  if (result.kind === "properties") {
    properties = result.properties;
  } else {
    // Surface a simple message when the list is not available (permission, unauthenticated, etc.)
    // Many list results include a `message` field for user-friendly errors.
    // Fall back to a generic message.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asAny = result as any;
    message = asAny?.message ?? "Property list unavailable.";
  }

  const columns = [
    { key: "accountNumber", title: "Account", sortable: true },
    { key: "addressLine1", title: "Address", sortable: true },
    { key: "city", title: "City", sortable: true },
    { key: "state", title: "State", sortable: true },
    { key: "postalCode", title: "Postal", sortable: true },
    { key: "status", title: "Status", sortable: true },
  ];

  // Build per-row action nodes based on a community-level permission.
  let rowActions: React.ReactNode[] | undefined = undefined;

  if (result.kind === "properties") {
    const perm = await hasPermission({ communityId: result.communityId, permissionKey: "admin.properties.manage" });
    const canManage = perm.kind === "authorized";

    rowActions = properties.map((p) => {
      if (!canManage) return null;

      return (
        <div key={p.id} className="flex gap-2">
          <a href={`/admin/properties/${p.id}/edit`} className="inline-flex rounded-sm border px-2 py-1 text-sm">
            Edit
          </a>
          <form action="/admin/properties/archive" method="post">
            <input type="hidden" name="propertyId" value={p.id} />
            <button type="submit" className="inline-flex rounded-sm bg-red-600 px-2 py-1 text-sm text-white">Archive</button>
          </form>
        </div>
      );
    });
  }

  return (
    <main className="smc-admin-example p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin Data Table — Example</h1>

      {message ? (
        <div className="mb-4 rounded-sm border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <StandardTable columns={columns} data={properties} pageSize={10} rowActions={rowActions} rowKey="id" />
    </main>
  );
}
