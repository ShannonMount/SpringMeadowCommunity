"use server";

import { redirect } from "next/navigation";
import {
  assignAdminProfileRole,
  removeAdminProfileRole,
  suspendAdminProfileRole,
  type AdminRoleMutationInput,
  type AdminRoleMutationResult,
} from "@/server/services/admin/role-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const ROLE_KEY_PATTERN = /^[a-z0-9._-]{1,100}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ROLE_SCOPES = ["community", "property"] as const;
const ROLE_ACTION_FIELDS = [
  "form",
  "profileRoleId",
  "targetProfileId",
  "roleKey",
  "scope",
  "scopeId",
  "reason",
  "communitySlug",
] as const;

type RoleActionStatus = "assigned" | "suspended" | "removed" | "invalid" | "denied" | "unavailable";

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptional(value: string) {
  const normalized = normalizeSpaces(value);

  return normalized || null;
}

function hasControlCharacters(value: string | null | undefined) {
  return typeof value === "string" && CONTROL_CHARACTER_PATTERN.test(value);
}

function isUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isAllowed<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function safeActionField(field: string | null | undefined) {
  return field && isAllowed(ROLE_ACTION_FIELDS, field) ? field : null;
}

function formText(formData: FormData, name: string) {
  return normalizeSpaces(stringValue(formData.get(name)));
}

function formOptionalText(formData: FormData, name: string) {
  return normalizeOptional(stringValue(formData.get(name)));
}

function redirectToRoles(status: RoleActionStatus, field?: string | null): never {
  const params = new URLSearchParams({ roleAction: status });
  const safeField = safeActionField(field);

  if (safeField) {
    params.set("roleActionField", safeField);
  }

  redirect(`/admin/roles?${params.toString()}`);
}

function firstInvalidField(fieldErrors: Record<string, string[]>) {
  const [field] = Object.keys(fieldErrors);

  return field || "form";
}

function roleInputFromForm(formData: FormData): AdminRoleMutationInput {
  if (formData.has("communityId")) {
    formData.get("communityId");
  }

  return {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    profileRoleId: formOptionalText(formData, "profileRoleId"),
    targetProfileId: formOptionalText(formData, "targetProfileId"),
    roleKey: formText(formData, "roleKey"),
    scope: formText(formData, "scope") || "community",
    scopeId: formOptionalText(formData, "scopeId"),
    reason: formOptionalText(formData, "reason"),
  };
}

function hasRejectedFields(formData: FormData) {
  return (
    formData.has("permissions") ||
    formData.has("roleJson") ||
    formData.has("actorProfileId") ||
    formData.has("assignedBy") ||
    formData.has("assigned_by")
  );
}

function localFieldError(input: AdminRoleMutationInput, requireAssignmentId: boolean) {
  const scope = input.scope || "community";

  if (requireAssignmentId && !isUuid(input.profileRoleId)) {
    return "profileRoleId";
  }

  if (!requireAssignmentId && !isUuid(input.targetProfileId)) {
    return "targetProfileId";
  }

  if (!requireAssignmentId && (!input.roleKey || !ROLE_KEY_PATTERN.test(input.roleKey))) {
    return "roleKey";
  }

  if (!isAllowed(ROLE_SCOPES, scope)) {
    return "scope";
  }

  if (!requireAssignmentId && scope === "property" && !isUuid(input.scopeId)) {
    return "scopeId";
  }

  if (!requireAssignmentId && scope === "community" && input.scopeId && !isUuid(input.scopeId)) {
    return "scopeId";
  }

  if (hasControlCharacters(input.roleKey) || hasControlCharacters(input.reason)) {
    return hasControlCharacters(input.roleKey) ? "roleKey" : "reason";
  }

  if (input.reason && input.reason.length > 500) {
    return "reason";
  }

  return null;
}

function mutationStatus(result: AdminRoleMutationResult): RoleActionStatus {
  switch (result.kind) {
    case "assigned":
    case "suspended":
    case "removed":
      return result.kind;
    case "permission-denied":
      return "denied";
    case "invalid-input":
      return "invalid";
    case "unauthenticated":
    case "profile-unavailable":
    case "role-unavailable":
      return "unavailable";
  }
}

function handleMutationResult(
  result: AdminRoleMutationResult,
  success: Extract<RoleActionStatus, "assigned" | "suspended" | "removed">,
): never {
  if (result.kind === success) {
    redirectToRoles(success);
  }

  if (result.kind === "invalid-input") {
    redirectToRoles("invalid", firstInvalidField(result.fieldErrors));
  }

  redirectToRoles(mutationStatus(result));
}

export async function assignAdminProfileRoleAction(formData: FormData) {
  if (hasRejectedFields(formData)) {
    redirectToRoles("invalid", "form");
  }

  const input = roleInputFromForm(formData);
  const field = localFieldError(input, false);

  if (field) {
    redirectToRoles("invalid", field);
  }

  const result = await assignAdminProfileRole(input);

  handleMutationResult(result, "assigned");
}

export async function suspendAdminProfileRoleAction(formData: FormData) {
  if (hasRejectedFields(formData)) {
    redirectToRoles("invalid", "form");
  }

  const input = roleInputFromForm(formData);
  const field = localFieldError(input, true);

  if (field) {
    redirectToRoles("invalid", field);
  }

  const result = await suspendAdminProfileRole(input);

  handleMutationResult(result, "suspended");
}

export async function removeAdminProfileRoleAction(formData: FormData) {
  if (hasRejectedFields(formData)) {
    redirectToRoles("invalid", "form");
  }

  const input = roleInputFromForm(formData);
  const field = localFieldError(input, true);

  if (field) {
    redirectToRoles("invalid", field);
  }

  const result = await removeAdminProfileRole(input);

  handleMutationResult(result, "removed");
}
