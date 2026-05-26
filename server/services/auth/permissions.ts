import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
  type CurrentProfile,
} from "@/server/services/auth/current-profile";
import { writeAuditLog } from "@/server/services/audit/write-audit-log";

export const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to complete this action.";

type Scope = "community" | "property" | "vendor" | "amenity";

type PermissionCheckInput = {
  communityId: string;
  permissionKey: string;
  scope?: Scope;
  scopeId?: string | null;
};

type RoleAssignmentInput = {
  communityId: string;
  targetProfileId: string;
  roleKey: string;
  scope?: Scope;
  scopeId?: string | null;
  reason?: string | null;
};

type ProfileRoleMutationInput = {
  communityId: string;
  profileRoleId: string;
  reason?: string | null;
};

type RoleMutationRpcResult = {
  status?: "assigned" | "suspended" | "removed" | "invalid" | "unavailable";
  profile_role_id?: string;
  previous_status?: string | null;
  previous_removed_at?: string | null;
  community_id?: string | null;
  target_profile_id?: string | null;
  role_id?: string | null;
  role_key?: string | null;
  scope?: Scope | string | null;
  scope_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  removed_at?: string | null;
};

export type PermissionResult =
  | { kind: "authorized"; profile: CurrentProfile }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE };

export type RoleMutationResult =
  | { kind: "assigned" | "suspended" | "removed"; profileRoleId?: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input" }
  | { kind: "role-unavailable" };

async function requireRoleManagementPermission(communityId: string): Promise<PermissionResult> {
  return hasPermission({
    communityId,
    permissionKey: "admin.roles.manage",
  });
}

function mutationDenied(): RoleMutationResult {
  return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
}

function mutationInvalid(): RoleMutationResult {
  return { kind: "invalid-input" };
}

function mutationUnavailable(): RoleMutationResult {
  return { kind: "role-unavailable" };
}

function roleMutationDetails(
  result: RoleMutationRpcResult,
  fallback: {
    targetProfileId?: string | null;
    roleKey?: string | null;
    scope?: Scope;
    scopeId?: string | null;
    removedAt?: string | null;
  } = {},
): Record<string, unknown> {
  const hasFallbackRemovedAt = Object.prototype.hasOwnProperty.call(fallback, "removedAt");

  return {
    targetProfileId: result.target_profile_id ?? fallback.targetProfileId ?? null,
    roleId: result.role_id ?? null,
    roleKey: result.role_key ?? fallback.roleKey ?? null,
    scope: result.scope ?? fallback.scope ?? "community",
    scopeId: result.scope_id ?? fallback.scopeId ?? null,
    assignedBy: result.assigned_by ?? null,
    assignedAt: result.assigned_at ?? null,
    removedAt: hasFallbackRemovedAt ? fallback.removedAt ?? null : result.removed_at ?? null,
  };
}

async function auditRoleMutation(input: {
  action: "role.assign" | "role.suspend" | "role.remove";
  actorProfileId: string;
  communityId: string;
  profileRoleId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  await writeAuditLog({
    action: input.action,
    actorProfileId: input.actorProfileId,
    communityId: input.communityId,
    targetType: "profile_role",
    targetId: input.profileRoleId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
}

export async function hasPermission(input: PermissionCheckInput): Promise<PermissionResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    target_community_id: input.communityId,
    permission_key: input.permissionKey,
    target_scope: input.scope ?? null,
    target_scope_id: input.scopeId ?? null,
  });

  if (error || data !== true) {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return { kind: "authorized", profile: profileResult.profile };
}

export async function assignProfileRole(input: RoleAssignmentInput): Promise<RoleMutationResult> {
  const permission = await requireRoleManagementPermission(input.communityId);

  if (permission.kind === "unauthenticated" || permission.kind === "profile-unavailable") {
    return permission;
  }

  if (permission.kind !== "authorized") {
    return mutationDenied();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_profile_role", {
    target_community_id: input.communityId,
    target_profile_id: input.targetProfileId,
    target_role_key: input.roleKey,
    target_scope: input.scope ?? "community",
    target_scope_id: input.scopeId ?? null,
  });
  const result = data as RoleMutationRpcResult | null;

  if (error || !result?.status) {
    return mutationUnavailable();
  }

  if (result.status === "invalid") {
    return mutationInvalid();
  }

  if (result.status === "unavailable" || result.status !== "assigned") {
    return mutationUnavailable();
  }

  const assignmentDetails = roleMutationDetails(result, {
    targetProfileId: input.targetProfileId,
    roleKey: input.roleKey,
    scope: input.scope ?? "community",
    scopeId: input.scopeId ?? null,
  });

  await auditRoleMutation({
    action: "role.assign",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    profileRoleId: result.profile_role_id,
    before: result.previous_status
      ? {
          ...assignmentDetails,
          status: result.previous_status,
          removedAt: result.previous_removed_at ?? null,
        }
      : null,
    after: {
      ...assignmentDetails,
      status: "active",
    },
    reason: input.reason,
  });

  return { kind: "assigned", profileRoleId: result.profile_role_id };
}

export async function suspendProfileRole(
  input: ProfileRoleMutationInput,
): Promise<RoleMutationResult> {
  const permission = await requireRoleManagementPermission(input.communityId);

  if (permission.kind === "unauthenticated" || permission.kind === "profile-unavailable") {
    return permission;
  }

  if (permission.kind !== "authorized") {
    return mutationDenied();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suspend_profile_role", {
    target_profile_role_id: input.profileRoleId,
  });
  const result = data as RoleMutationRpcResult | null;

  if (error || !result?.status) {
    return mutationUnavailable();
  }

  if (result.status === "invalid") {
    return mutationInvalid();
  }

  if (result.status === "unavailable" || result.status !== "suspended") {
    return mutationUnavailable();
  }

  const assignmentDetails = roleMutationDetails(result);
  const profileRoleId = result.profile_role_id ?? input.profileRoleId;

  await auditRoleMutation({
    action: "role.suspend",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    profileRoleId,
    before: {
      ...assignmentDetails,
      status: result.previous_status ?? "active",
    },
    after: {
      ...assignmentDetails,
      status: "suspended",
    },
    reason: input.reason,
  });

  return { kind: "suspended", profileRoleId };
}

export async function removeProfileRole(input: ProfileRoleMutationInput): Promise<RoleMutationResult> {
  const permission = await requireRoleManagementPermission(input.communityId);

  if (permission.kind === "unauthenticated" || permission.kind === "profile-unavailable") {
    return permission;
  }

  if (permission.kind !== "authorized") {
    return mutationDenied();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_profile_role", {
    target_profile_role_id: input.profileRoleId,
  });
  const result = data as RoleMutationRpcResult | null;

  if (error || !result?.status) {
    return mutationUnavailable();
  }

  if (result.status === "invalid") {
    return mutationInvalid();
  }

  if (result.status === "unavailable" || result.status !== "removed") {
    return mutationUnavailable();
  }

  const profileRoleId = result.profile_role_id ?? input.profileRoleId;
  const beforeDetails = roleMutationDetails(result, {
    removedAt: result.previous_removed_at ?? null,
  });
  const afterDetails = roleMutationDetails(result);

  await auditRoleMutation({
    action: "role.remove",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    profileRoleId,
    before: {
      ...beforeDetails,
      status: result.previous_status ?? "active",
    },
    after: {
      ...afterDetails,
      status: "removed",
    },
    reason: input.reason,
  });

  return { kind: "removed", profileRoleId };
}
