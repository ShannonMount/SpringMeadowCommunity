import {
  assignAdminProfileRoleAction,
  removeAdminProfileRoleAction,
  suspendAdminProfileRoleAction,
} from "@/server/actions/admin-roles";
import {
  listAdminProfileRoles,
  listAdminRoleTargets,
  listAdminRoles,
  type AdminRoleAssignmentStatus,
  type AdminRoleAssignmentSummary,
  type AdminRoleDefinition,
  type AdminRolePropertyScopeOption,
  type AdminRoleTargetProfile,
} from "@/server/services/admin/role-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 100;
const TARGET_LIST_SIZE = 200;
const MAX_PAGE_OFFSET = 10000;
const ROLE_STATUSES: AdminRoleAssignmentStatus[] = ["active", "suspended", "removed"];
const ROLE_SCOPES = ["community", "property"] as const;
const ACTION_NOTICE_FIELDS = [
  "form",
  "profileRoleId",
  "targetProfileId",
  "roleKey",
  "scope",
  "scopeId",
  "reason",
  "communitySlug",
] as const;

type AdminRolesPageProps = {
  searchParams?: Promise<{
    query?: string | string[];
    roleStatus?: string | string[];
    status?: string | string[];
    includeRemoved?: string | string[];
    roleAction?: string | string[];
    roleActionField?: string | string[];
    pageOffset?: string | string[];
  }>;
};

type FieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "text" | "search";
};

const inputClass =
  "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-sm border border-[#b42318] px-3 py-2 text-sm font-semibold text-[#8a1f14] transition hover:bg-[#fff4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function adminRolesHref(input: {
  query?: string;
  roleStatus?: string;
  includeRemoved: boolean;
  pageOffset: number;
}) {
  const params = new URLSearchParams();

  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "roleStatus", input.roleStatus);

  if (input.includeRemoved) {
    params.set("includeRemoved", "1");
  }

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  const queryString = params.toString();

  return queryString ? `/admin/roles?${queryString}` : "/admin/roles";
}

function humanize(value: string) {
  if (!value) {
    return "Any";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeNoticeField(field: string | undefined) {
  return ACTION_NOTICE_FIELDS.includes(field as (typeof ACTION_NOTICE_FIELDS)[number])
    ? field
    : undefined;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function actionNotice(value: string | undefined, field: string | undefined) {
  const notices: Record<string, string> = {
    assigned: "Role assigned.",
    suspended: "Role suspended.",
    removed: "Role removed.",
    invalid: "Check the role details and try again.",
    denied: "You do not have permission to manage roles.",
    unavailable: "Role management is temporarily unavailable.",
  };
  const message = value ? notices[value] : "";

  if (!message) {
    return "";
  }

  const safeField = safeNoticeField(field);

  return safeField ? `${message} Field: ${humanize(safeField)}.` : message;
}

function TextField({
  id,
  name,
  label,
  defaultValue,
  required,
  type = "text",
}: FieldProps) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="break-words text-sm font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
  defaultValue,
  required,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="break-words text-sm font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} required={required} className={inputClass}>
        {options.map((option) => (
          <option key={option || "any"} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function AccessState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-sm border border-[var(--border)] bg-white p-5">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">{message}</p>
    </section>
  );
}

function RoleFilters({
  query,
  roleStatus,
  includeRemoved,
}: {
  query: string | undefined;
  roleStatus: string | undefined;
  includeRemoved: boolean;
}) {
  return (
    <form action="/admin/roles" className="grid gap-3 rounded-sm border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
      <TextField
        id="roles-query"
        name="query"
        label="Search roles"
        type="search"
        defaultValue={query}
      />
      <SelectField
        id="roles-status"
        name="roleStatus"
        label="Role status"
        options={["", ...ROLE_STATUSES]}
        defaultValue={roleStatus ?? ""}
      />
      <label
        htmlFor="roles-include-removed"
        className="flex min-h-10 items-center gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
      >
        <input
          id="roles-include-removed"
          name="includeRemoved"
          type="checkbox"
          value="1"
          defaultChecked={includeRemoved}
          className="h-4 w-4 rounded-sm border-[var(--border)]"
        />
        Removed
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-3">
        <button type="submit" className={buttonClass}>
          Apply filters
        </button>
        <a href="/admin/roles" className={secondaryButtonClass}>
          Clear
        </a>
      </div>
    </form>
  );
}

function PermissionSummary({ role }: { role: AdminRoleDefinition }) {
  const visiblePermissions = role.permissions.slice(0, 6);
  const remaining = Math.max(role.permissions.length - visiblePermissions.length, 0);

  if (role.permissions.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No permission keys.</p>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {visiblePermissions.map((permission) => (
        <span
          key={permission}
          className="max-w-full break-words rounded-sm border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)]"
        >
          {permission}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded-sm border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

function RoleDefinitions({ roles }: { roles: AdminRoleDefinition[] }) {
  if (roles.length === 0) {
    return <AccessState title="No roles found" message="No role definitions match the current filters." />;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Permission summary</h2>
        <a href="/admin/users" className={secondaryButtonClass}>
          View users
        </a>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {roles.map((role) => (
          <article
            key={role.id}
            className="grid min-w-0 gap-3 rounded-sm border border-[var(--border)] bg-white p-4"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                {role.name}
              </p>
              <p className="break-words text-sm text-[var(--muted-foreground)]">{role.key}</p>
              {role.description ? (
                <p className="mt-2 break-words text-sm text-[var(--muted-foreground)]">
                  {role.description}
                </p>
              ) : null}
            </div>
            <PermissionSummary role={role} />
            <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)]">
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Active</dt>
                <dd>{role.activeAssignmentCount}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Total</dt>
                <dd>{role.assignmentCount}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function AssignRoleForm({
  roles,
  profiles,
  properties,
}: {
  roles: AdminRoleDefinition[];
  profiles: AdminRoleTargetProfile[];
  properties: AdminRolePropertyScopeOption[];
}) {
  if (profiles.length === 0) {
    return <AccessState title="No target profiles found" message="No active or invited profiles are available for role assignment." />;
  }

  return (
    <section className="rounded-sm border border-[var(--border)] bg-white p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Assign role</h2>
      <form action={assignAdminProfileRoleAction} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="grid min-w-0 gap-1">
            <label
              htmlFor="assign-target-profile"
              className="break-words text-sm font-semibold text-[var(--foreground)]"
            >
              Target profile
            </label>
            <select
              id="assign-target-profile"
              name="targetProfileId"
              required
              className={inputClass}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} ({profile.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 gap-1">
            <label
              htmlFor="assign-role-key"
              className="break-words text-sm font-semibold text-[var(--foreground)]"
            >
              Role
            </label>
            <select id="assign-role-key" name="roleKey" required className={inputClass}>
              {roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <SelectField
            id="assign-scope"
            name="scope"
            label="Scope"
            options={ROLE_SCOPES}
            defaultValue="community"
            required
          />
          <div className="grid min-w-0 gap-1">
            <label
              htmlFor="assign-scope-id"
              className="break-words text-sm font-semibold text-[var(--foreground)]"
            >
              Property scope
            </label>
            <select id="assign-scope-id" name="scopeId" className={inputClass}>
              <option value="">Community scope</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TextField id="assign-reason" name="reason" label="Reason" />
        <div>
          <button type="submit" className={buttonClass}>
            Assign role
          </button>
        </div>
      </form>
    </section>
  );
}

function AssignmentActions({ assignment }: { assignment: AdminRoleAssignmentSummary }) {
  const canSuspend = assignment.status === "active";
  const canRemove = assignment.status !== "removed";
  const prefix = `assignment-${assignment.id}`;

  if (!canSuspend && !canRemove) {
    return (
      <p className="text-sm font-semibold text-[var(--muted-foreground)]">
        No status actions available.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {canSuspend ? (
        <form action={suspendAdminProfileRoleAction} className="grid gap-2">
          <input type="hidden" name="profileRoleId" value={assignment.id} />
          <TextField id={`${prefix}-suspend-reason`} name="reason" label="Reason" />
          <button type="submit" className={secondaryButtonClass}>
            Suspend
          </button>
        </form>
      ) : null}
      {canRemove ? (
        <form action={removeAdminProfileRoleAction} className="grid gap-2">
          <input type="hidden" name="profileRoleId" value={assignment.id} />
          <TextField id={`${prefix}-remove-reason`} name="reason" label="Reason" />
          <button type="submit" className={dangerButtonClass}>
            Remove
          </button>
        </form>
      ) : null}
    </div>
  );
}

function AssignmentList({ assignments }: { assignments: AdminRoleAssignmentSummary[] }) {
  if (assignments.length === 0) {
    return (
      <AccessState title="No assignments found" message="No role assignments match the current filters." />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Assignments</h2>
      <div className="grid gap-3">
        {assignments.map((assignment) => (
          <article
            key={assignment.id}
            className="grid min-w-0 gap-4 rounded-sm border border-[var(--border)] bg-white p-4"
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                  {assignment.profile.displayName}
                </p>
                <p className="break-words text-sm text-[var(--muted-foreground)]">
                  {assignment.profile.email}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  {humanize(assignment.status)}
                </p>
              </div>
              <div className="min-w-0 text-sm text-[var(--muted-foreground)]">
                <p className="break-words font-semibold text-[var(--foreground)]">
                  {assignment.role.name}
                </p>
                <p className="break-words">{assignment.role.key}</p>
                <p className="mt-1 break-words">
                  {humanize(assignment.scope)} · {assignment.scopeLabel}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)]">
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Assigned by</dt>
                  <dd className="break-words">{assignment.assignedByLabel ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Assigned</dt>
                  <dd>{formatDate(assignment.assignedAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Removed</dt>
                  <dd>{formatDate(assignment.removedAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--foreground)]">Updated</dt>
                  <dd>{formatDate(assignment.updatedAt)}</dd>
                </div>
              </dl>
            </div>
            <AssignmentActions assignment={assignment} />
          </article>
        ))}
      </div>
    </section>
  );
}

function PaginationControls({
  query,
  roleStatus,
  includeRemoved,
  pageOffset,
  hasNextPage,
}: {
  query?: string;
  roleStatus?: string;
  includeRemoved: boolean;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const hasPreviousPage = pageOffset > 0;
  const disabledClass =
    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#8a9792]";

  if (!hasPreviousPage && !hasNextPage) {
    return null;
  }

  return (
    <nav aria-label="Role assignment pages" className="flex flex-wrap items-center gap-3">
      {hasPreviousPage ? (
        <a
          href={adminRolesHref({
            query,
            roleStatus,
            includeRemoved,
            pageOffset: Math.max(pageOffset - PAGE_SIZE, 0),
          })}
          className={secondaryButtonClass}
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
          href={adminRolesHref({
            query,
            roleStatus,
            includeRemoved,
            pageOffset: pageOffset + PAGE_SIZE,
          })}
          className={secondaryButtonClass}
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

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSingleSearchParam(resolvedSearchParams.query);
  const legacyStatus = getSingleSearchParam(resolvedSearchParams.status);
  const roleStatus = getSingleSearchParam(resolvedSearchParams.roleStatus) ?? legacyStatus;
  const includeRemoved =
    getSingleSearchParam(resolvedSearchParams.includeRemoved) === "1" ||
    roleStatus === "removed";
  const pageOffset = parsePageOffset(getSingleSearchParam(resolvedSearchParams.pageOffset));
  const action = getSingleSearchParam(resolvedSearchParams.roleAction);
  const actionField = getSingleSearchParam(resolvedSearchParams.roleActionField);
  const notice = actionNotice(action, actionField);
  const filterInput = {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    query,
    status: roleStatus,
    includeRemoved,
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  };
  const [rolesResult, assignmentsResult, targetsResult] = await Promise.all([
    listAdminRoles(filterInput),
    listAdminProfileRoles(filterInput),
    listAdminRoleTargets({
      communitySlug: DEFAULT_COMMUNITY_SLUG,
      query,
      pageSize: TARGET_LIST_SIZE,
      pageOffset: 0,
    }),
  ]);

  if (
    rolesResult.kind === "permission-denied" ||
    assignmentsResult.kind === "permission-denied" ||
    targetsResult.kind === "permission-denied"
  ) {
    return (
      <AccessState
        title="Not available for your role"
        message="You do not have permission to manage roles."
      />
    );
  }

  if (
    rolesResult.kind !== "roles" ||
    assignmentsResult.kind !== "assignments" ||
    targetsResult.kind !== "targets"
  ) {
    return (
      <AccessState
        title="Role management unavailable"
        message="Role management is temporarily unavailable."
      />
    );
  }

  const visibleAssignments = assignmentsResult.assignments.slice(0, PAGE_SIZE);
  const visibleProfiles = targetsResult.profiles;
  const hasNextPage = assignmentsResult.assignments.length > PAGE_SIZE;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            Role management
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold text-[var(--foreground)]">
            Roles and assignments
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
            {rolesResult.roles.length} roles and {visibleAssignments.length} assignments shown.
          </p>
        </div>
        <a
          href={adminRolesHref({
            query,
            roleStatus,
            includeRemoved,
            pageOffset,
          })}
          className={secondaryButtonClass}
        >
          Refresh
        </a>
      </div>
      {notice ? (
        <p
          className="rounded-sm border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite" />
      )}
      <RoleFilters query={query} roleStatus={roleStatus} includeRemoved={includeRemoved} />
      <AssignRoleForm
        roles={rolesResult.roles}
        profiles={visibleProfiles}
        properties={targetsResult.properties}
      />
      <RoleDefinitions roles={rolesResult.roles} />
      <AssignmentList assignments={visibleAssignments} />
      <PaginationControls
        query={query}
        roleStatus={roleStatus}
        includeRemoved={includeRemoved}
        pageOffset={pageOffset}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}
