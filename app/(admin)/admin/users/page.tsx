import {
  activateAdminPropertyMembershipAction,
  inviteAdminPropertyMemberAction,
  removeAdminPropertyMembershipAction,
  suspendAdminPropertyMembershipAction,
  updateAdminPropertyMembershipAction,
} from "@/server/actions/admin-users";
import {
  listAdminMemberships,
  listAdminUsers,
  type AdminMembershipRelationship,
  type AdminMembershipStatus,
  type AdminMembershipSummary,
  type AdminUserSummary,
} from "@/server/services/admin/user-membership-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 100;
const MAX_PAGE_OFFSET = 10000;
const PROFILE_STATUSES = ["invited", "active", "suspended", "disabled"];
const MEMBERSHIP_STATUSES: AdminMembershipStatus[] = ["invited", "active", "suspended", "removed"];
const RELATIONSHIPS: AdminMembershipRelationship[] = [
  "owner",
  "co_owner",
  "resident",
  "renter",
  "manager",
  "family",
  "other",
];
const ACTION_NOTICE_FIELDS = [
  "form",
  "membershipId",
  "propertyId",
  "profileId",
  "email",
  "displayName",
  "relationship",
  "reason",
  "communitySlug",
] as const;

type AdminUsersPageProps = {
  searchParams?: Promise<{
    query?: string | string[];
    profileStatus?: string | string[];
    membershipStatus?: string | string[];
    status?: string | string[];
    includeRemoved?: string | string[];
    userAction?: string | string[];
    userActionField?: string | string[];
    pageOffset?: string | string[];
  }>;
};

type FieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "text" | "email" | "search";
  autoComplete?: string;
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

function adminUsersHref(input: {
  query?: string;
  profileStatus?: string;
  membershipStatus?: string;
  includeRemoved: boolean;
  pageOffset: number;
}) {
  const params = new URLSearchParams();

  setOptionalParam(params, "query", input.query);
  setOptionalParam(params, "profileStatus", input.profileStatus);
  setOptionalParam(params, "membershipStatus", input.membershipStatus);

  if (input.includeRemoved) {
    params.set("includeRemoved", "1");
  }

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  const queryString = params.toString();

  return queryString ? `/admin/users?${queryString}` : "/admin/users";
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
    invited: "Member invited.",
    updated: "Membership updated.",
    activated: "Membership activated.",
    suspended: "Membership suspended.",
    removed: "Membership removed.",
    invalid: "Check the membership details and try again.",
    denied: "You do not have permission to manage users.",
    unavailable: "User management is temporarily unavailable.",
    conflict: "That user is already linked to this property.",
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
  autoComplete,
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
        autoComplete={autoComplete}
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
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="break-words text-sm font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function CapabilityFields({
  prefix,
  membership,
}: {
  prefix: string;
  membership?: AdminMembershipSummary;
}) {
  const values = membership?.capabilities;
  const capabilities = [
    ["canViewBalance", "Can view balance", values?.canViewBalance ?? true],
    ["canPayDues", "Can pay dues", values?.canPayDues ?? true],
    ["canViewDocuments", "Can view documents", values?.canViewDocuments ?? true],
    ["canInviteMembers", "Can invite members", values?.canInviteMembers ?? false],
  ] as const;

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-[var(--foreground)]">Membership flags</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {capabilities.map(([name, label, defaultChecked]) => (
          <label
            key={name}
            htmlFor={`${prefix}-${name}`}
            className="flex min-w-0 items-start gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
          >
            <input
              id={`${prefix}-${name}`}
              name={name}
              type="checkbox"
              defaultChecked={defaultChecked}
              className="mt-1 h-4 w-4 rounded-sm border-[var(--border)]"
            />
            <span className="break-words">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
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

function UserFilters({
  query,
  profileStatus,
  membershipStatus,
  includeRemoved,
}: {
  query: string | undefined;
  profileStatus: string | undefined;
  membershipStatus: string | undefined;
  includeRemoved: boolean;
}) {
  return (
    <form action="/admin/users" className="grid gap-3 rounded-sm border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
      <TextField
        id="users-query"
        name="query"
        label="Search users"
        type="search"
        defaultValue={query}
      />
      <SelectField
        id="users-profile-status"
        name="profileStatus"
        label="Profile status"
        options={["", ...PROFILE_STATUSES]}
        defaultValue={profileStatus ?? ""}
      />
      <SelectField
        id="users-membership-status"
        name="membershipStatus"
        label="Membership status"
        options={["", ...MEMBERSHIP_STATUSES]}
        defaultValue={membershipStatus ?? ""}
      />
      <label
        htmlFor="users-include-removed"
        className="flex min-h-10 items-center gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
      >
        <input
          id="users-include-removed"
          name="includeRemoved"
          type="checkbox"
          value="1"
          defaultChecked={includeRemoved}
          className="h-4 w-4 rounded-sm border-[var(--border)]"
        />
        Removed
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-4">
        <button type="submit" className={buttonClass}>
          Apply filters
        </button>
        <a href="/admin/users" className={secondaryButtonClass}>
          Clear
        </a>
      </div>
    </form>
  );
}

function InviteMemberForm() {
  return (
    <section className="rounded-sm border border-[var(--border)] bg-white p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Invite member</h2>
      <form action={inviteAdminPropertyMemberAction} className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TextField id="invite-property-id" name="propertyId" label="Property ID" required />
          <TextField id="invite-profile-id" name="profileId" label="Profile ID" />
          <TextField
            id="invite-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
          />
          <TextField id="invite-display-name" name="displayName" label="Display name" />
          <SelectField
            id="invite-relationship"
            name="relationship"
            label="Relationship"
            options={RELATIONSHIPS}
            defaultValue="resident"
          />
        </div>
        <CapabilityFields prefix="invite" />
        <div>
          <button type="submit" className={buttonClass}>
            Invite member
          </button>
        </div>
      </form>
    </section>
  );
}

function UsersList({ users }: { users: AdminUserSummary[] }) {
  if (users.length === 0) {
    return <AccessState title="No users found" message="No user records match the current filters." />;
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Users</h2>
      <div className="grid gap-2">
        {users.map((user) => (
          <article
            key={user.id}
            className="grid gap-2 rounded-sm border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                {user.displayName}
              </p>
              <p className="break-words text-sm text-[var(--muted-foreground)]">{user.email}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-4">
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Active</dt>
                <dd>{user.activeMembershipCount}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Invited</dt>
                <dd>{user.invitedMembershipCount}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Suspended</dt>
                <dd>{user.suspendedMembershipCount}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Total</dt>
                <dd>{user.membershipCount}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function MembershipActions({ membership }: { membership: AdminMembershipSummary }) {
  const canActivate = membership.status === "invited" || membership.status === "suspended";
  const canSuspend = membership.status === "invited" || membership.status === "active";
  const canRemove = membership.status !== "removed";

  if (!canActivate && !canSuspend && !canRemove) {
    return (
      <p className="text-sm font-semibold text-[var(--muted-foreground)]">
        No status actions available.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canActivate ? (
        <form action={activateAdminPropertyMembershipAction}>
          <input type="hidden" name="membershipId" value={membership.id} />
          <button type="submit" className={secondaryButtonClass}>
            Activate
          </button>
        </form>
      ) : null}
      {canSuspend ? (
        <form action={suspendAdminPropertyMembershipAction}>
          <input type="hidden" name="membershipId" value={membership.id} />
          <button type="submit" className={secondaryButtonClass}>
            Suspend
          </button>
        </form>
      ) : null}
      {canRemove ? (
        <form action={removeAdminPropertyMembershipAction}>
          <input type="hidden" name="membershipId" value={membership.id} />
          <button type="submit" className={dangerButtonClass}>
            Remove
          </button>
        </form>
      ) : null}
    </div>
  );
}

function MembershipList({ memberships }: { memberships: AdminMembershipSummary[] }) {
  if (memberships.length === 0) {
    return (
      <AccessState title="No memberships found" message="No property memberships match the current filters." />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Property memberships</h2>
      <div className="grid gap-3">
        {memberships.map((membership) => {
          const prefix = `membership-${membership.id}`;

          return (
            <article
              key={membership.id}
              className="grid gap-4 rounded-sm border border-[var(--border)] bg-white p-4"
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-[var(--foreground)]">
                    {membership.profile.displayName}
                  </p>
                  <p className="break-words text-sm text-[var(--muted-foreground)]">
                    {membership.profile.email}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                    {humanize(membership.status)}
                  </p>
                </div>
                <div className="min-w-0 text-sm text-[var(--muted-foreground)]">
                  <p className="break-words font-semibold text-[var(--foreground)]">
                    {membership.property.accountNumber}
                  </p>
                  <p className="break-words">
                    {membership.property.addressLine1}
                    {membership.property.addressLine2 ? `, ${membership.property.addressLine2}` : ""}
                  </p>
                  <p className="break-words">
                    {membership.property.city}, {membership.property.state}{" "}
                    {membership.property.postalCode}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)]">
                  <div>
                    <dt className="font-semibold text-[var(--foreground)]">Invited by</dt>
                    <dd className="break-words">{membership.invitedByLabel ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--foreground)]">Invited</dt>
                    <dd>{formatDate(membership.invitedAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--foreground)]">Accepted</dt>
                    <dd>{formatDate(membership.acceptedAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--foreground)]">Removed</dt>
                    <dd>{formatDate(membership.removedAt)}</dd>
                  </div>
                </dl>
              </div>
              <form action={updateAdminPropertyMembershipAction} className="grid gap-3">
                <input type="hidden" name="membershipId" value={membership.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    id={`${prefix}-relationship`}
                    name="relationship"
                    label="Relationship"
                    options={RELATIONSHIPS}
                    defaultValue={membership.relationship}
                  />
                  <TextField id={`${prefix}-reason`} name="reason" label="Reason" />
                </div>
                <CapabilityFields prefix={prefix} membership={membership} />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={buttonClass}>
                    Update membership
                  </button>
                </div>
              </form>
              <MembershipActions membership={membership} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PaginationControls({
  query,
  profileStatus,
  membershipStatus,
  includeRemoved,
  pageOffset,
  hasNextPage,
}: {
  query?: string;
  profileStatus?: string;
  membershipStatus?: string;
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
    <nav aria-label="User and membership pages" className="flex flex-wrap items-center gap-3">
      {hasPreviousPage ? (
        <a
          href={adminUsersHref({
            query,
            profileStatus,
            membershipStatus,
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
          href={adminUsersHref({
            query,
            profileStatus,
            membershipStatus,
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

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSingleSearchParam(resolvedSearchParams.query);
  const legacyStatus = getSingleSearchParam(resolvedSearchParams.status);
  const profileStatus =
    getSingleSearchParam(resolvedSearchParams.profileStatus) ??
    (legacyStatus && legacyStatus !== "removed" ? legacyStatus : undefined);
  const membershipStatus =
    getSingleSearchParam(resolvedSearchParams.membershipStatus) ?? legacyStatus;
  const includeRemoved =
    getSingleSearchParam(resolvedSearchParams.includeRemoved) === "1" ||
    membershipStatus === "removed";
  const pageOffset = parsePageOffset(getSingleSearchParam(resolvedSearchParams.pageOffset));
  const action = getSingleSearchParam(resolvedSearchParams.userAction);
  const actionField = getSingleSearchParam(resolvedSearchParams.userActionField);
  const notice = actionNotice(action, actionField);
  const userFilterInput = {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    query,
    status: profileStatus,
    includeRemoved,
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  };
  const membershipFilterInput = {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    query,
    status: membershipStatus,
    includeRemoved,
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  };
  const usersResult = await listAdminUsers(userFilterInput);
  const membershipsResult = await listAdminMemberships(membershipFilterInput);

  if (usersResult.kind === "permission-denied" || membershipsResult.kind === "permission-denied") {
    return (
      <AccessState
        title="Not available for your role"
        message="You do not have permission to manage users."
      />
    );
  }

  if (usersResult.kind !== "users" || membershipsResult.kind !== "memberships") {
    return (
      <AccessState
        title="User management unavailable"
        message="User management is temporarily unavailable."
      />
    );
  }

  const visibleUsers = usersResult.users.slice(0, PAGE_SIZE);
  const visibleMemberships = membershipsResult.memberships.slice(0, PAGE_SIZE);
  const hasNextPage =
    usersResult.users.length > PAGE_SIZE || membershipsResult.memberships.length > PAGE_SIZE;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            User management
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold text-[var(--foreground)]">
            Users and memberships
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
            {visibleUsers.length} users and {visibleMemberships.length} memberships shown.
          </p>
        </div>
        <a
          href={adminUsersHref({
            query,
            profileStatus,
            membershipStatus,
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
      <UserFilters
        query={query}
        profileStatus={profileStatus}
        membershipStatus={membershipStatus}
        includeRemoved={includeRemoved}
      />
      <InviteMemberForm />
      <UsersList users={visibleUsers} />
      <MembershipList memberships={visibleMemberships} />
      <PaginationControls
        query={query}
        profileStatus={profileStatus}
        membershipStatus={membershipStatus}
        includeRemoved={includeRemoved}
        pageOffset={pageOffset}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}
