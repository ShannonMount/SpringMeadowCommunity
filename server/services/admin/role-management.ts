import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
  type CurrentProfile,
} from "@/server/services/auth/current-profile";
import {
  assignProfileRole,
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
  removeProfileRole,
  suspendProfileRole,
  type PermissionResult,
  type RoleMutationResult,
} from "@/server/services/auth/permissions";

const ROLE_MANAGEMENT_PERMISSION = "admin.roles.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const ROLE_UNAVAILABLE_MESSAGE = "Role management is temporarily unavailable.";
const INVALID_ROLE_INPUT_MESSAGE = "Please check the role details and try again.";
const MAX_QUERY_LENGTH = 200;
const MAX_REASON_LENGTH = 500;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const ROLE_ASSIGNMENT_STATUSES = ["active", "suspended", "removed"] as const;
const ROLE_PROFILE_STATUSES = ["invited", "active", "suspended", "disabled"] as const;
export type AdminRoleScope = "community" | "property";

const ROLE_SCOPES: readonly AdminRoleScope[] = ["community", "property"] as const;

export const ADMIN_ROLE_AUDIT_ACTIONS = ["role.assign", "role.suspend", "role.remove"] as const;

type FieldErrors = Record<string, string[]>;

export type AdminRoleAssignmentStatus = (typeof ROLE_ASSIGNMENT_STATUSES)[number];
type AdminRoleProfileStatus = (typeof ROLE_PROFILE_STATUSES)[number];

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "role-unavailable"; message: typeof ROLE_UNAVAILABLE_MESSAGE };

type PermissionGateResult =
  | { kind: "authorized"; profile: CurrentProfile }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE };

type AdminAccessError = Exclude<PermissionGateResult, { kind: "authorized" }>;

export type AdminRoleDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  systemRole: boolean;
  activeAssignmentCount: number;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminRoleProfileSummary = {
  id: string;
  displayName: string;
  email: string;
  status: AdminRoleProfileStatus;
};

export type AdminRoleAssignmentSummary = {
  id: string;
  communityId: string;
  profile: AdminRoleProfileSummary;
  role: AdminRoleDefinition;
  scope: "community" | "property";
  scopeId: string | null;
  scopeLabel: string;
  status: AdminRoleAssignmentStatus;
  assignedBy: string | null;
  assignedByLabel: string | null;
  assignedAt: string;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminRoleTargetProfile = AdminRoleProfileSummary;

export type AdminRolePropertyScopeOption = {
  id: string;
  label: string;
  accountNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

export type AdminRoleFilters = {
  communitySlug?: string | null;
  query?: string | null;
  status?: string | null;
  profileId?: string | null;
  includeRemoved?: boolean | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type AdminRoleMutationInput = {
  communitySlug?: string | null;
  profileRoleId?: string | null;
  targetProfileId?: string | null;
  roleKey?: string | null;
  scope?: string | null;
  scopeId?: string | null;
  reason?: string | null;
};

export type AdminRolesResult =
  | {
      kind: "roles";
      communityId: string;
      communitySlug: string;
      roles: AdminRoleDefinition[];
    }
  | AdminAccessError
  | {
      kind: "invalid-input";
      message: typeof INVALID_ROLE_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "role-unavailable"; message: typeof ROLE_UNAVAILABLE_MESSAGE };

export type AdminRoleAssignmentsResult =
  | {
      kind: "assignments";
      communityId: string;
      communitySlug: string;
      assignments: AdminRoleAssignmentSummary[];
    }
  | Exclude<AdminRolesResult, { kind: "roles" }>;

export type AdminRoleTargetsResult =
  | {
      kind: "targets";
      communityId: string;
      communitySlug: string;
      profiles: AdminRoleTargetProfile[];
      properties: AdminRolePropertyScopeOption[];
    }
  | Exclude<AdminRolesResult, { kind: "roles" }>;

export type AdminRoleMutationResult =
  | { kind: "assigned"; profileRoleId?: string }
  | { kind: "suspended"; profileRoleId?: string }
  | { kind: "removed"; profileRoleId?: string }
  | AdminAccessError
  | {
      kind: "invalid-input";
      message: typeof INVALID_ROLE_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "role-unavailable"; message: typeof ROLE_UNAVAILABLE_MESSAGE };

type AdminRoleRpcRow = {
  id?: string | null;
  key?: string | null;
  name?: string | null;
  description?: string | null;
  permissions?: string[] | null;
  system_role?: boolean | null;
  active_assignment_count?: number | null;
  assignment_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminRoleAssignmentRpcRow = {
  id?: string | null;
  community_id?: string | null;
  profile?: {
    id?: string | null;
    display_name?: string | null;
    email?: string | null;
    status?: string | null;
  } | null;
  role?: AdminRoleRpcRow | null;
  scope?: string | null;
  scope_id?: string | null;
  scope_label?: string | null;
  status?: string | null;
  assigned_by?: string | null;
  assigned_by_label?: string | null;
  assigned_at?: string | null;
  removed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminRoleTargetProfileRpcRow = {
  id?: string | null;
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
};

type AdminRolePropertyScopeRpcRow = {
  id?: string | null;
  label?: string | null;
  account_number?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

type ListRolesRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  roles?: AdminRoleRpcRow[];
};

type ListAssignmentsRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  assignments?: AdminRoleAssignmentRpcRow[];
};

type ListTargetsRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  profiles?: AdminRoleTargetProfileRpcRow[];
  properties?: AdminRolePropertyScopeRpcRow[];
};

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isIncluded<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function safeString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: string | null | undefined) {
  const trimmed = safeString(value);

  return trimmed || null;
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasControlCharacters(value: string | null | undefined) {
  return typeof value === "string" && CONTROL_CHARACTER_PATTERN.test(value);
}

function boundedPageSize(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return 100;
  }

  return Math.min(Math.max(Number(value), 1), 200);
}

function boundedPageOffset(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value), 0), 10000);
}

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function invalid(fieldErrors: FieldErrors): Extract<AdminRolesResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_ROLE_INPUT_MESSAGE,
    fieldErrors,
  };
}

function invalidMutation(
  fieldErrors: FieldErrors,
): Extract<AdminRoleMutationResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_ROLE_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AdminRolesResult, { kind: "role-unavailable" }> {
  return { kind: "role-unavailable", message: ROLE_UNAVAILABLE_MESSAGE };
}

function unavailableMutation(): Extract<AdminRoleMutationResult, { kind: "role-unavailable" }> {
  return { kind: "role-unavailable", message: ROLE_UNAVAILABLE_MESSAGE };
}

function permissionResultToAccess(result: PermissionResult): AdminAccessError | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return null;
}

function permissionGateToMutation(result: PermissionGateResult): AdminRoleMutationResult | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return null;
}

function roleHelperResultToMutation(result: RoleMutationResult): AdminRoleMutationResult | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.kind === "invalid-input") {
    return invalidMutation({ form: ["Role assignment is invalid."] });
  }

  if (result.kind === "role-unavailable") {
    return unavailableMutation();
  }

  return null;
}

async function resolveCommunity(input: {
  communitySlug?: string | null;
}): Promise<CommunityResolution> {
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;

  if (hasControlCharacters(communitySlug)) {
    return { kind: "invalid-input", fieldErrors: { communitySlug: ["Community is invalid."] } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .eq("status", "active")
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return unavailable();
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

async function requireRoleManagementPermission(
  communityId: string,
): Promise<PermissionGateResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const permission = await hasPermission({
    communityId,
    permissionKey: ROLE_MANAGEMENT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToAccess(permission) ?? {
      kind: "permission-denied",
      message: PERMISSION_DENIED_MESSAGE,
    };
  }

  return { kind: "authorized", profile: profileResult.profile };
}

function validateFilters(input: AdminRoleFilters) {
  const fieldErrors: FieldErrors = {};
  const query = optionalString(input.query);
  const status = optionalString(input.status);

  if (query && (query.length > MAX_QUERY_LENGTH || hasControlCharacters(query))) {
    fieldErrors.query = ["Search text is invalid."];
  }

  if (status && !isIncluded(ROLE_ASSIGNMENT_STATUSES, status)) {
    fieldErrors.status = ["Status is not supported."];
  }

  if (input.profileId && !isUuid(input.profileId)) {
    fieldErrors.profileId = ["Profile is invalid."];
  }

  return fieldErrors;
}

function validateMutationInput(input: AdminRoleMutationInput, requireAssignmentId: boolean) {
  const fieldErrors: FieldErrors = {};
  const roleKey = optionalString(input.roleKey);
  const scope = optionalString(input.scope) || "community";
  const reason = optionalString(input.reason);

  if (requireAssignmentId && !isUuid(input.profileRoleId)) {
    fieldErrors.profileRoleId = ["Role assignment is required."];
  }

  if (!requireAssignmentId && !isUuid(input.targetProfileId)) {
    fieldErrors.targetProfileId = ["Profile is required."];
  }

  if (!requireAssignmentId && !roleKey) {
    fieldErrors.roleKey = ["Role is required."];
  }

  if (!isIncluded(ROLE_SCOPES, scope)) {
    fieldErrors.scope = ["Scope is not supported."];
  }

  if (!requireAssignmentId && scope === "property" && !isUuid(input.scopeId)) {
    fieldErrors.scopeId = ["Property scope is required."];
  }

  if (!requireAssignmentId && scope === "community" && input.scopeId && !isUuid(input.scopeId)) {
    fieldErrors.scopeId = ["Scope is invalid."];
  }

  for (const [field, value] of [
    ["roleKey", input.roleKey],
    ["reason", input.reason],
  ] as const) {
    if (hasControlCharacters(value)) {
      fieldErrors[field] = ["Field is invalid."];
    }
  }

  if (reason && reason.length > MAX_REASON_LENGTH) {
    fieldErrors.reason = ["Reason is too long."];
  }

  return fieldErrors;
}

function asProfileStatus(value: string | null | undefined): AdminRoleProfileStatus {
  return value && isIncluded(ROLE_PROFILE_STATUSES, value) ? value : "active";
}

function asAssignmentStatus(value: string | null | undefined): AdminRoleAssignmentStatus {
  return value && isIncluded(ROLE_ASSIGNMENT_STATUSES, value) ? value : "active";
}

function asScope(value: string | null | undefined): AdminRoleScope {
  return value && isIncluded(ROLE_SCOPES, value) ? value : "community";
}

function toRoleDefinition(row: AdminRoleRpcRow): AdminRoleDefinition {
  return {
    id: row.id ?? "",
    key: row.key ?? "",
    name: row.name ?? row.key ?? "Role",
    description: row.description ?? null,
    permissions: Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : [],
    systemRole: row.system_role === true,
    activeAssignmentCount: asNumber(row.active_assignment_count),
    assignmentCount: asNumber(row.assignment_count),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function toProfile(row: AdminRoleTargetProfileRpcRow): AdminRoleProfileSummary {
  const email = row.email ?? "";

  return {
    id: row.id ?? "",
    displayName: row.display_name || email,
    email,
    status: asProfileStatus(row.status),
  };
}

function toAssignment(row: AdminRoleAssignmentRpcRow): AdminRoleAssignmentSummary {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    profile: toProfile(row.profile ?? {}),
    role: toRoleDefinition(row.role ?? {}),
    scope: asScope(row.scope),
    scopeId: row.scope_id ?? null,
    scopeLabel: row.scope_label ?? "Community",
    status: asAssignmentStatus(row.status),
    assignedBy: row.assigned_by ?? null,
    assignedByLabel: row.assigned_by_label ?? null,
    assignedAt: row.assigned_at ?? "",
    removedAt: row.removed_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function toPropertyScope(row: AdminRolePropertyScopeRpcRow): AdminRolePropertyScopeOption {
  return {
    id: row.id ?? "",
    label: row.label ?? row.account_number ?? "Property",
    accountNumber: row.account_number ?? "",
    addressLine1: row.address_line1 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
  };
}

function normalizeReason(value: string | null | undefined) {
  const reason = optionalString(value);

  return reason ? normalizeSpaces(reason) : null;
}

async function roleKeysForMutation(input: {
  communitySlug: string;
}): Promise<Set<string> | null> {
  const rolesResult = await listAdminRoles({ communitySlug: input.communitySlug });

  if (rolesResult.kind !== "roles") {
    return null;
  }

  return new Set(rolesResult.roles.map((role) => role.key));
}

export async function listAdminRoles(input: AdminRoleFilters = {}): Promise<AdminRolesResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requireRoleManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionResultToAccess(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_roles", {
    target_community_slug: community.communitySlug,
    filter_query: optionalString(input.query),
    include_inactive: input.includeRemoved === true,
  });
  const result = error ? null : (data as ListRolesRpcResult | null);

  if (!result?.status) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ query: ["Search text is invalid."] });
  }

  return {
    kind: "roles",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    roles: (result.roles ?? []).map(toRoleDefinition),
  };
}

export async function listAdminProfileRoles(
  input: AdminRoleFilters = {},
): Promise<AdminRoleAssignmentsResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requireRoleManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionResultToAccess(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const assignmentStatus = optionalString(input.status);
  const { data, error } = await supabase.rpc("list_admin_profile_roles", {
    target_community_slug: community.communitySlug,
    filter_query: optionalString(input.query),
    filter_status: assignmentStatus,
    target_profile_id: input.profileId ?? null,
    include_removed: input.includeRemoved === true || assignmentStatus === "removed",
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = error ? null : (data as ListAssignmentsRpcResult | null);

  if (!result?.status) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ query: ["Search or filter is invalid."] });
  }

  return {
    kind: "assignments",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    assignments: (result.assignments ?? []).map(toAssignment),
  };
}

export async function listAdminRoleTargets(
  input: AdminRoleFilters = {},
): Promise<AdminRoleTargetsResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateFilters({ ...input, status: null, profileId: null });

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requireRoleManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionResultToAccess(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_role_targets", {
    target_community_slug: community.communitySlug,
    filter_query: optionalString(input.query),
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = error ? null : (data as ListTargetsRpcResult | null);

  if (!result?.status) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ query: ["Search text is invalid."] });
  }

  return {
    kind: "targets",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    profiles: (result.profiles ?? []).map(toProfile),
    properties: (result.properties ?? []).map(toPropertyScope),
  };
}

export async function assignAdminProfileRole(
  input: AdminRoleMutationInput,
): Promise<AdminRoleMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  const fieldErrors = validateMutationInput(input, false);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidMutation(fieldErrors);
  }

  const permission = await requireRoleManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionGateToMutation(permission) ?? unavailableMutation();
  }

  const roleKeys = await roleKeysForMutation({ communitySlug: community.communitySlug });

  if (!roleKeys || !input.roleKey || !roleKeys.has(input.roleKey)) {
    return { kind: "role-unavailable", message: ROLE_UNAVAILABLE_MESSAGE };
  }

  const scope = asScope(input.scope);
  const result = await assignProfileRole({
    communityId: community.communityId,
    targetProfileId: input.targetProfileId ?? "",
    roleKey: input.roleKey,
    scope,
    scopeId: scope === "property" ? input.scopeId : null,
    reason: normalizeReason(input.reason),
  });

  if (result.kind === "assigned") {
    return { kind: "assigned", profileRoleId: result.profileRoleId };
  }

  return roleHelperResultToMutation(result) ?? unavailableMutation();
}

async function assignmentStatusMutation(
  input: AdminRoleMutationInput,
  action: "suspend" | "remove",
): Promise<AdminRoleMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  const fieldErrors = validateMutationInput(input, true);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidMutation(fieldErrors);
  }

  const permission = await requireRoleManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionGateToMutation(permission) ?? unavailableMutation();
  }

  const result =
    action === "suspend"
      ? await suspendProfileRole({
          communityId: community.communityId,
          profileRoleId: input.profileRoleId ?? "",
          reason: normalizeReason(input.reason),
        })
      : await removeProfileRole({
          communityId: community.communityId,
          profileRoleId: input.profileRoleId ?? "",
          reason: normalizeReason(input.reason),
        });

  if (action === "suspend" && result.kind === "suspended") {
    return { kind: "suspended", profileRoleId: result.profileRoleId };
  }

  if (action === "remove" && result.kind === "removed") {
    return { kind: "removed", profileRoleId: result.profileRoleId };
  }

  return roleHelperResultToMutation(result) ?? unavailableMutation();
}

export async function suspendAdminProfileRole(
  input: AdminRoleMutationInput,
): Promise<AdminRoleMutationResult> {
  return assignmentStatusMutation(input, "suspend");
}

export async function removeAdminProfileRole(
  input: AdminRoleMutationInput,
): Promise<AdminRoleMutationResult> {
  return assignmentStatusMutation(input, "remove");
}
