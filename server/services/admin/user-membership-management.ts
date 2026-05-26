import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
  type CurrentProfile,
} from "@/server/services/auth/current-profile";
import {
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
  type PermissionResult,
} from "@/server/services/auth/permissions";
import { writeAuditLog } from "@/server/services/audit/write-audit-log";

const USER_MANAGEMENT_PERMISSION = "admin.users.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const USER_MEMBERSHIP_UNAVAILABLE_MESSAGE =
  "User memberships are unavailable. Please contact the HOA for help.";
const INVALID_USER_MEMBERSHIP_INPUT_MESSAGE = "Please check the membership details and try again.";
const CONFLICT_USER_MEMBERSHIP_MESSAGE = "That user is already linked to this property.";
const MAX_QUERY_LENGTH = 200;
const INVITATION_EXPIRES_DAYS = 14;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const PROFILE_STATUSES = ["invited", "active", "suspended", "disabled"] as const;
const MEMBERSHIP_STATUSES = ["invited", "active", "suspended", "removed"] as const;
const MEMBERSHIP_RELATIONSHIPS = [
  "owner",
  "co_owner",
  "resident",
  "renter",
  "manager",
  "family",
  "other",
] as const;

type FieldErrors = Record<string, string[]>;
type ProfileStatus = (typeof PROFILE_STATUSES)[number];
export type AdminMembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type AdminMembershipRelationship = (typeof MEMBERSHIP_RELATIONSHIPS)[number];

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "membership-unavailable"; message: typeof USER_MEMBERSHIP_UNAVAILABLE_MESSAGE };

type PermissionGateResult =
  | { kind: "authorized"; profile: CurrentProfile }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE };

type AdminAccessError = Exclude<PermissionGateResult, { kind: "authorized" }>;

export type AdminUserSummary = {
  id: string;
  displayName: string;
  email: string;
  status: ProfileStatus;
  membershipCount: number;
  activeMembershipCount: number;
  invitedMembershipCount: number;
  suspendedMembershipCount: number;
  removedMembershipCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminMembershipSummary = {
  id: string;
  communityId: string;
  property: {
    id: string;
    accountNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  profile: {
    id: string;
    displayName: string;
    email: string;
    status: ProfileStatus;
  };
  relationship: AdminMembershipRelationship;
  status: AdminMembershipStatus;
  capabilities: {
    canViewBalance: boolean;
    canPayDues: boolean;
    canViewDocuments: boolean;
    canInviteMembers: boolean;
  };
  invitedBy: string | null;
  invitedByLabel: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserFilters = {
  communitySlug?: string | null;
  query?: string | null;
  status?: string | null;
  includeRemoved?: boolean | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type AdminMembershipFilters = AdminUserFilters & {
  propertyId?: string | null;
  profileId?: string | null;
};

export type AdminMembershipMutationInput = {
  communitySlug?: string | null;
  membershipId?: string | null;
  propertyId?: string | null;
  profileId?: string | null;
  email?: string | null;
  displayName?: string | null;
  relationship?: string | null;
  canViewBalance?: boolean | null;
  canPayDues?: boolean | null;
  canViewDocuments?: boolean | null;
  canInviteMembers?: boolean | null;
  reason?: string | null;
};

export type AdminUsersResult =
  | {
      kind: "users";
      communityId: string;
      communitySlug: string;
      users: AdminUserSummary[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_USER_MEMBERSHIP_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "membership-unavailable"; message: typeof USER_MEMBERSHIP_UNAVAILABLE_MESSAGE };

export type AdminMembershipsResult =
  | {
      kind: "memberships";
      communityId: string;
      communitySlug: string;
      memberships: AdminMembershipSummary[];
    }
  | Exclude<AdminUsersResult, { kind: "users" }>;

export type AdminMembershipMutationResult =
  | { kind: "invited"; membershipId: string }
  | { kind: "updated"; membershipId: string }
  | { kind: "activated"; membershipId: string }
  | { kind: "suspended"; membershipId: string }
  | { kind: "removed"; membershipId: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_USER_MEMBERSHIP_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "conflict"; message: typeof CONFLICT_USER_MEMBERSHIP_MESSAGE; field: "profileId" | "email" }
  | { kind: "membership-unavailable"; message: typeof USER_MEMBERSHIP_UNAVAILABLE_MESSAGE };

type AdminUserRpcRow = {
  id?: string | null;
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
  membership_count?: number | null;
  active_membership_count?: number | null;
  invited_membership_count?: number | null;
  suspended_membership_count?: number | null;
  removed_membership_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminMembershipRpcRow = {
  id?: string | null;
  community_id?: string | null;
  relationship?: string | null;
  status?: string | null;
  can_view_balance?: boolean | null;
  can_pay_dues?: boolean | null;
  can_view_documents?: boolean | null;
  can_invite_members?: boolean | null;
  invited_by?: string | null;
  invited_by_display_name?: string | null;
  invited_by_email?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  removed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  profile?: {
    id?: string | null;
    display_name?: string | null;
    email?: string | null;
    status?: string | null;
  } | null;
  property?: {
    id?: string | null;
    account_number?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  } | null;
};

type ListUsersRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  users?: AdminUserRpcRow[];
};

type ListMembershipsRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  memberships?: AdminMembershipRpcRow[];
};

type MembershipMutationRpcResult = {
  status?:
    | "invited"
    | "updated"
    | "activated"
    | "suspended"
    | "removed"
    | "permission_denied"
    | "invalid"
    | "membership_conflict"
    | "profile_unavailable"
    | "property_unavailable"
    | "membership_unavailable";
  membership_id?: string | null;
  community_id?: string | null;
  property_id?: string | null;
  target_profile_id?: string | null;
  target_profile_email?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type InvitedProfile = {
  id: string;
  email: string;
  displayName: string;
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

function normalizeEmail(value: string | null | undefined) {
  return normalizeSpaces(value ?? "").toLowerCase();
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

function invalid(fieldErrors: FieldErrors): Extract<AdminUsersResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_USER_MEMBERSHIP_INPUT_MESSAGE,
    fieldErrors,
  };
}

function invalidMutation(
  fieldErrors: FieldErrors,
): Extract<AdminMembershipMutationResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_USER_MEMBERSHIP_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AdminUsersResult, { kind: "membership-unavailable" }> {
  return { kind: "membership-unavailable", message: USER_MEMBERSHIP_UNAVAILABLE_MESSAGE };
}

function unavailableMutation(): Extract<AdminMembershipMutationResult, { kind: "membership-unavailable" }> {
  return { kind: "membership-unavailable", message: USER_MEMBERSHIP_UNAVAILABLE_MESSAGE };
}

function permissionResultToUsers(result: PermissionResult): AdminAccessError | null {
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

function permissionGateToMutation(
  result: PermissionGateResult,
): AdminMembershipMutationResult | null {
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

async function requireUserManagementPermission(
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
    permissionKey: USER_MANAGEMENT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToUsers(permission) ?? {
      kind: "permission-denied",
      message: PERMISSION_DENIED_MESSAGE,
    };
  }

  return { kind: "authorized", profile: profileResult.profile };
}

function validateUserFilters(input: AdminUserFilters, statuses: readonly string[] = PROFILE_STATUSES) {
  const fieldErrors: FieldErrors = {};
  const status = optionalString(input.status);
  const query = optionalString(input.query);

  if (status && !isIncluded(statuses, status)) {
    fieldErrors.status = ["Status is not supported."];
  }

  if (query && (query.length > MAX_QUERY_LENGTH || hasControlCharacters(query))) {
    fieldErrors.query = ["Search text is invalid."];
  }

  return fieldErrors;
}

function validateMembershipFilters(input: AdminMembershipFilters) {
  const fieldErrors = validateUserFilters(input, MEMBERSHIP_STATUSES);

  if (input.propertyId && !isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is invalid."];
  }

  if (input.profileId && !isUuid(input.profileId)) {
    fieldErrors.profileId = ["User is invalid."];
  }

  return fieldErrors;
}

function validateMembershipInput(input: AdminMembershipMutationInput, requireMembershipId: boolean) {
  const fieldErrors: FieldErrors = {};
  const email = normalizeEmail(input.email);
  const relationship = safeString(input.relationship) || "resident";

  if (requireMembershipId && !isUuid(input.membershipId)) {
    fieldErrors.membershipId = ["Membership is required."];
  }

  if (!requireMembershipId && !isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is required."];
  }

  if (!requireMembershipId && input.profileId && !isUuid(input.profileId)) {
    fieldErrors.profileId = ["User is invalid."];
  }

  if (!requireMembershipId && !input.profileId && !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = ["Email is required."];
  }

  if (!isIncluded(MEMBERSHIP_RELATIONSHIPS, relationship)) {
    fieldErrors.relationship = ["Relationship is not supported."];
  }

  for (const [field, value] of [
    ["email", input.email],
    ["displayName", input.displayName],
    ["reason", input.reason],
  ] as const) {
    if (hasControlCharacters(value)) {
      fieldErrors[field] = ["Field is invalid."];
    }
  }

  return fieldErrors;
}

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asProfileStatus(value: string | null | undefined): ProfileStatus {
  return value && isIncluded(PROFILE_STATUSES, value) ? value : "active";
}

function asMembershipStatus(value: string | null | undefined): AdminMembershipStatus {
  return value && isIncluded(MEMBERSHIP_STATUSES, value) ? value : "invited";
}

function asRelationship(value: string | null | undefined): AdminMembershipRelationship {
  return value && isIncluded(MEMBERSHIP_RELATIONSHIPS, value) ? value : "resident";
}

function toAdminUser(row: AdminUserRpcRow): AdminUserSummary {
  const email = row.email ?? "";

  return {
    id: row.id ?? "",
    displayName: row.display_name || email,
    email,
    status: asProfileStatus(row.status),
    membershipCount: asNumber(row.membership_count),
    activeMembershipCount: asNumber(row.active_membership_count),
    invitedMembershipCount: asNumber(row.invited_membership_count),
    suspendedMembershipCount: asNumber(row.suspended_membership_count),
    removedMembershipCount: asNumber(row.removed_membership_count),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function toAdminMembership(row: AdminMembershipRpcRow): AdminMembershipSummary {
  const profile = row.profile ?? {};
  const property = row.property ?? {};
  const profileEmail = profile.email ?? "";
  const invitedByLabel = row.invited_by_display_name || row.invited_by_email || null;

  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    property: {
      id: property.id ?? "",
      accountNumber: property.account_number ?? "",
      addressLine1: property.address_line1 ?? "",
      addressLine2: property.address_line2 ?? null,
      city: property.city ?? "",
      state: property.state ?? "",
      postalCode: property.postal_code ?? "",
    },
    profile: {
      id: profile.id ?? "",
      displayName: profile.display_name || profileEmail,
      email: profileEmail,
      status: asProfileStatus(profile.status),
    },
    relationship: asRelationship(row.relationship),
    status: asMembershipStatus(row.status),
    capabilities: {
      canViewBalance: row.can_view_balance === true,
      canPayDues: row.can_pay_dues === true,
      canViewDocuments: row.can_view_documents === true,
      canInviteMembers: row.can_invite_members === true,
    },
    invitedBy: row.invited_by ?? null,
    invitedByLabel,
    invitedAt: row.invited_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    removedAt: row.removed_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function invitationExpiration() {
  return new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function buildInvitationRedirect(token: string) {
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!baseUrl) {
    return undefined;
  }

  try {
    const redirectUrl = new URL("/portal/invitations/accept", baseUrl);
    redirectUrl.searchParams.set("token", token);

    return redirectUrl.toString();
  } catch {
    return undefined;
  }
}

async function ensureInvitedProfile(input: {
  email: string;
  displayName: string | null;
  invitationToken: string;
}): Promise<InvitedProfile | null> {
  const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
  const trustedClient = createServiceRoleClient();
  const displayName = input.displayName || input.email;
  const { data: invitedUser, error: inviteError } =
    await trustedClient.auth.admin.inviteUserByEmail(input.email, {
      data: { display_name: displayName },
      redirectTo: buildInvitationRedirect(input.invitationToken),
    });

  const authUserId = invitedUser.user?.id;

  if (inviteError || !authUserId) {
    return null;
  }

  const { data: profile, error: profileError } = await trustedClient
    .from("profiles")
    .upsert(
      {
        auth_user_id: authUserId,
        email: input.email,
        display_name: displayName,
        status: "active",
        notification_preferences: {},
      },
      { onConflict: "auth_user_id" },
    )
    .select("id, email, display_name")
    .maybeSingle<{ id: string; email: string; display_name: string | null }>();

  if (profileError || !profile?.id) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name || profile.email,
  };
}

function membershipAuditAfter(input: AdminMembershipMutationInput) {
  return {
    propertyId: input.propertyId ?? null,
    targetProfileId: input.profileId ?? null,
    targetProfileEmail: normalizeEmail(input.email),
    relationship: safeString(input.relationship) || "resident",
    canViewBalance: input.canViewBalance === true,
    canPayDues: input.canPayDues === true,
    canViewDocuments: input.canViewDocuments === true,
    canInviteMembers: input.canInviteMembers === true,
  };
}

async function auditMembershipMutation(input: {
  action:
    | "membership.invite"
    | "membership.update"
    | "membership.activate"
    | "membership.suspend"
    | "membership.remove";
  actorProfileId: string;
  communityId: string;
  membershipId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  await writeAuditLog({
    action: input.action,
    actorProfileId: input.actorProfileId,
    communityId: input.communityId,
    targetType: "property_memberships",
    targetId: input.membershipId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
}

function mutationConflict(
  status: MembershipMutationRpcResult["status"],
  field: "profileId" | "email",
): Extract<AdminMembershipMutationResult, { kind: "conflict" }> | null {
  if (status === "membership_conflict") {
    return { kind: "conflict", message: CONFLICT_USER_MEMBERSHIP_MESSAGE, field };
  }

  return null;
}

function mutationStatus(
  result: MembershipMutationRpcResult | null,
  expected: "updated" | "activated" | "suspended" | "removed",
): AdminMembershipMutationResult | null {
  if (!result?.status) {
    return unavailableMutation();
  }

  if (result.status === expected && result.membership_id) {
    return { kind: expected, membershipId: result.membership_id };
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalidMutation({ membershipId: ["Membership is invalid."] });
  }

  return unavailableMutation();
}

async function callInviteRpc(input: {
  communitySlug: string;
  propertyId: string;
  profileId: string | null;
  email: string;
  displayName: string | null;
  relationship: AdminMembershipRelationship;
  canViewBalance: boolean;
  canPayDues: boolean;
  canViewDocuments: boolean;
  canInviteMembers: boolean;
  invitationTokenHash: string;
  invitationExpiresAt: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_admin_property_member", {
    target_community_slug: input.communitySlug,
    target_property_id: input.propertyId,
    target_profile_id: input.profileId,
    target_email: input.email,
    target_display_name: input.displayName,
    target_relationship: input.relationship,
    allow_view_balance: input.canViewBalance,
    allow_pay_dues: input.canPayDues,
    allow_view_documents: input.canViewDocuments,
    allow_invite_members: input.canInviteMembers,
    invitation_token_hash: input.invitationTokenHash,
    invitation_expires_at: input.invitationExpiresAt,
  });

  if (error) {
    return null;
  }

  return data as MembershipMutationRpcResult | null;
}

export async function listAdminUsers(input: AdminUserFilters = {}): Promise<AdminUsersResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateUserFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: USER_MANAGEMENT_PERMISSION,
  });
  const permissionResult = permissionResultToUsers(permission);

  if (permissionResult) {
    return permissionResult;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_users", {
    target_community_slug: community.communitySlug,
    filter_query: optionalString(input.query),
    filter_status: optionalString(input.status),
    include_removed: input.includeRemoved === true,
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as ListUsersRpcResult | null;

  if (error || !result?.status) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ query: ["Search or filter is invalid."] });
  }

  return {
    kind: "users",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    users: (result.users ?? []).map(toAdminUser),
  };
}

export async function listAdminMemberships(
  input: AdminMembershipFilters = {},
): Promise<AdminMembershipsResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateMembershipFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: USER_MANAGEMENT_PERMISSION,
  });
  const permissionResult = permissionResultToUsers(permission);

  if (permissionResult) {
    return permissionResult;
  }

  const supabase = await createClient();
  const membershipStatus = optionalString(input.status);
  const { data, error } = await supabase.rpc("list_admin_memberships", {
    target_community_slug: community.communitySlug,
    filter_query: optionalString(input.query),
    filter_status: membershipStatus,
    target_property_id: input.propertyId ?? null,
    target_profile_id: input.profileId ?? null,
    include_removed: input.includeRemoved === true || membershipStatus === "removed",
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as ListMembershipsRpcResult | null;

  if (error || !result?.status) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ query: ["Search or filter is invalid."] });
  }

  return {
    kind: "memberships",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    memberships: (result.memberships ?? []).map(toAdminMembership),
  };
}

export async function inviteAdminPropertyMember(
  input: AdminMembershipMutationInput,
): Promise<AdminMembershipMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  const fieldErrors = validateMembershipInput(input, false);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidMutation(fieldErrors);
  }

  const permission = await requireUserManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionGateToMutation(permission) ?? unavailableMutation();
  }

  const invitationToken = generateInvitationToken();
  const email = normalizeEmail(input.email);
  const displayName = optionalString(input.displayName);
  const relationship = asRelationship(safeString(input.relationship) || "resident");
  const rpcInput = {
    communitySlug: community.communitySlug,
    propertyId: input.propertyId ?? "",
    profileId: input.profileId ?? null,
    email,
    displayName,
    relationship,
    canViewBalance: input.canViewBalance === true,
    canPayDues: input.canPayDues === true,
    canViewDocuments: input.canViewDocuments === true,
    canInviteMembers: input.canInviteMembers === true,
    invitationTokenHash: hashInvitationToken(invitationToken),
    invitationExpiresAt: invitationExpiration(),
  };
  let result = await callInviteRpc(rpcInput);

  if (result?.status === "profile_unavailable" && !input.profileId) {
    const invitedProfile = await ensureInvitedProfile({
      email,
      displayName,
      invitationToken,
    });

    if (!invitedProfile) {
      return unavailableMutation();
    }

    result = await callInviteRpc({
      ...rpcInput,
      profileId: invitedProfile.id,
      email: invitedProfile.email,
      displayName: invitedProfile.displayName,
    });
  }

  const conflict = mutationConflict(result?.status, input.profileId ? "profileId" : "email");

  if (conflict) {
    return conflict;
  }

  if (result?.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result?.status === "invalid") {
    return invalidMutation({ email: ["Membership invitation is invalid."] });
  }

  if (result?.status !== "invited" || !result.membership_id) {
    return unavailableMutation();
  }

  await auditMembershipMutation({
    action: "membership.invite",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? community.communityId,
    membershipId: result.membership_id,
    before: result.before ?? null,
    after: {
      ...membershipAuditAfter(input),
      status: "invited",
      targetProfileId: result.target_profile_id ?? input.profileId ?? null,
      targetProfileEmail: result.target_profile_email ?? email,
      invitedAt: "database_timestamp",
      invitationTokenStored: true,
    },
    reason: input.reason,
  });

  return { kind: "invited", membershipId: result.membership_id };
}

export async function updateAdminPropertyMembership(
  input: AdminMembershipMutationInput,
): Promise<AdminMembershipMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  const fieldErrors = validateMembershipInput(input, true);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidMutation(fieldErrors);
  }

  const permission = await requireUserManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionGateToMutation(permission) ?? unavailableMutation();
  }

  const supabase = await createClient();
  const relationship = asRelationship(safeString(input.relationship) || "resident");
  const { data, error } = await supabase.rpc("update_admin_property_membership", {
    target_membership_id: input.membershipId,
    target_community_slug: community.communitySlug,
    target_relationship: relationship,
    allow_view_balance: input.canViewBalance === true,
    allow_pay_dues: input.canPayDues === true,
    allow_view_documents: input.canViewDocuments === true,
    allow_invite_members: input.canInviteMembers === true,
  });
  const rpcResult = error ? null : (data as MembershipMutationRpcResult | null);
  const result = mutationStatus(rpcResult, "updated");

  if (result?.kind !== "updated") {
    return result ?? unavailableMutation();
  }

  await auditMembershipMutation({
    action: "membership.update",
    actorProfileId: permission.profile.id,
    communityId: rpcResult?.community_id ?? community.communityId,
    membershipId: result.membershipId,
    before: rpcResult?.before ?? null,
    after: {
      ...membershipAuditAfter(input),
      ...(rpcResult?.after ?? {}),
      membershipId: result.membershipId,
      propertyId: rpcResult?.property_id ?? input.propertyId ?? null,
      targetProfileId: rpcResult?.target_profile_id ?? input.profileId ?? null,
      targetProfileEmail: rpcResult?.target_profile_email ?? normalizeEmail(input.email),
      status: "unchanged",
    },
    reason: input.reason,
  });

  return result;
}

async function membershipStatusMutation(
  input: AdminMembershipMutationInput,
  action: "activate" | "suspend" | "remove",
): Promise<AdminMembershipMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  if (!isUuid(input.membershipId)) {
    return invalidMutation({ membershipId: ["Membership is required."] });
  }

  const permission = await requireUserManagementPermission(community.communityId);
  if (permission.kind !== "authorized") {
    return permissionGateToMutation(permission) ?? unavailableMutation();
  }

  const supabase = await createClient();
  const rpcInput = {
    target_membership_id: input.membershipId,
    target_community_slug: community.communitySlug,
  };
  const { data, error } =
    action === "activate"
      ? await supabase.rpc("activate_admin_property_membership", rpcInput)
      : action === "suspend"
        ? await supabase.rpc("suspend_admin_property_membership", rpcInput)
        : await supabase.rpc("remove_admin_property_membership", rpcInput);
  const rpcResult = error ? null : (data as MembershipMutationRpcResult | null);
  const expected =
    action === "activate" ? "activated" : action === "suspend" ? "suspended" : "removed";
  const result = mutationStatus(rpcResult, expected);

  if (result?.kind !== expected) {
    return result ?? unavailableMutation();
  }

  await auditMembershipMutation({
    action:
      action === "activate"
        ? "membership.activate"
        : action === "suspend"
          ? "membership.suspend"
          : "membership.remove",
    actorProfileId: permission.profile.id,
    communityId: rpcResult?.community_id ?? community.communityId,
    membershipId: result.membershipId,
    before: rpcResult?.before ?? null,
    after: {
      ...(rpcResult?.after ?? {}),
      membershipId: result.membershipId,
      propertyId: rpcResult?.property_id ?? null,
      targetProfileId: rpcResult?.target_profile_id ?? null,
      targetProfileEmail: rpcResult?.target_profile_email ?? null,
      status:
        action === "activate" ? "active" : action === "suspend" ? "suspended" : "removed",
    },
    reason: input.reason,
  });

  return result;
}

export async function activateAdminPropertyMembership(
  input: AdminMembershipMutationInput,
): Promise<AdminMembershipMutationResult> {
  return membershipStatusMutation(input, "activate");
}

export async function suspendAdminPropertyMembership(
  input: AdminMembershipMutationInput,
): Promise<AdminMembershipMutationResult> {
  return membershipStatusMutation(input, "suspend");
}

export async function removeAdminPropertyMembership(
  input: AdminMembershipMutationInput,
): Promise<AdminMembershipMutationResult> {
  return membershipStatusMutation(input, "remove");
}
