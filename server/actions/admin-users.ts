"use server";

import { redirect } from "next/navigation";
import {
  activateAdminPropertyMembership,
  inviteAdminPropertyMember,
  removeAdminPropertyMembership,
  suspendAdminPropertyMembership,
  updateAdminPropertyMembership,
  type AdminMembershipMutationInput,
  type AdminMembershipMutationResult,
} from "@/server/services/admin/user-membership-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MEMBERSHIP_RELATIONSHIPS = [
  "owner",
  "co_owner",
  "resident",
  "renter",
  "manager",
  "family",
  "other",
] as const;
const USER_ACTION_FIELDS = [
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

type UserActionStatus =
  | "invited"
  | "updated"
  | "activated"
  | "suspended"
  | "removed"
  | "invalid"
  | "denied"
  | "unavailable"
  | "conflict";

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

function normalizeEmail(value: string) {
  return normalizeSpaces(value).toLowerCase();
}

function hasControlCharacters(value: string) {
  return CONTROL_CHARACTER_PATTERN.test(value);
}

function isUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isAllowed<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function safeActionField(field: string | null | undefined) {
  return field && isAllowed(USER_ACTION_FIELDS, field) ? field : null;
}

function checkboxValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return value === "on" || value === "true";
}

function formText(formData: FormData, name: string) {
  return normalizeSpaces(stringValue(formData.get(name)));
}

function formOptionalText(formData: FormData, name: string) {
  return normalizeOptional(stringValue(formData.get(name)));
}

function redirectToUsers(status: UserActionStatus, field?: string | null): never {
  const params = new URLSearchParams({ userAction: status });
  const safeField = safeActionField(field);

  if (safeField) {
    params.set("userActionField", safeField);
  }

  redirect(`/admin/users?${params.toString()}`);
}

function firstInvalidField(fieldErrors: Record<string, string[]>) {
  const [field] = Object.keys(fieldErrors);

  return field || "form";
}

function mutationStatus(result: AdminMembershipMutationResult): UserActionStatus {
  switch (result.kind) {
    case "permission-denied":
      return "denied";
    case "unauthenticated":
    case "profile-unavailable":
    case "membership-unavailable":
      return "unavailable";
    case "invited":
    case "updated":
    case "activated":
    case "suspended":
    case "removed":
    case "invalid-input":
    case "conflict":
      return "unavailable";
  }
}

function membershipInputFromForm(formData: FormData): AdminMembershipMutationInput {
  return {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    membershipId: formOptionalText(formData, "membershipId"),
    propertyId: formOptionalText(formData, "propertyId"),
    profileId: formOptionalText(formData, "profileId"),
    email: normalizeEmail(stringValue(formData.get("email"))),
    displayName: formOptionalText(formData, "displayName"),
    relationship: formText(formData, "relationship") || "resident",
    canViewBalance: checkboxValue(formData, "canViewBalance"),
    canPayDues: checkboxValue(formData, "canPayDues"),
    canViewDocuments: checkboxValue(formData, "canViewDocuments"),
    canInviteMembers: checkboxValue(formData, "canInviteMembers"),
    reason: formOptionalText(formData, "reason"),
  };
}

function localFieldError(input: AdminMembershipMutationInput, requireMembershipId: boolean) {
  const relationship = input.relationship ?? "resident";
  const email = input.email ?? "";

  if (requireMembershipId && !isUuid(input.membershipId)) {
    return "membershipId";
  }

  if (!requireMembershipId && !isUuid(input.propertyId)) {
    return "propertyId";
  }

  if (!requireMembershipId && input.profileId && !isUuid(input.profileId)) {
    return "profileId";
  }

  if (!requireMembershipId && !input.profileId && !EMAIL_PATTERN.test(email)) {
    return "email";
  }

  if (!isAllowed(MEMBERSHIP_RELATIONSHIPS, relationship)) {
    return "relationship";
  }

  for (const [field, value] of [
    ["email", input.email],
    ["displayName", input.displayName],
    ["reason", input.reason],
  ] as const) {
    if (hasControlCharacters(value ?? "")) {
      return field;
    }
  }

  return null;
}

function handleMutationResult(
  result: AdminMembershipMutationResult,
  success: Extract<UserActionStatus, "invited" | "updated" | "activated" | "suspended" | "removed">,
): never {
  if (result.kind === success) {
    redirectToUsers(success);
  }

  if (result.kind === "invalid-input") {
    redirectToUsers("invalid", firstInvalidField(result.fieldErrors));
  }

  if (result.kind === "conflict") {
    redirectToUsers("conflict", result.field);
  }

  redirectToUsers(mutationStatus(result));
}

export async function inviteAdminPropertyMemberAction(formData: FormData) {
  const input = membershipInputFromForm(formData);
  const field = localFieldError(input, false);

  if (field) {
    redirectToUsers("invalid", field);
  }

  const result = await inviteAdminPropertyMember(input);

  handleMutationResult(result, "invited");
}

export async function updateAdminPropertyMembershipAction(formData: FormData) {
  const input = membershipInputFromForm(formData);
  const field = localFieldError(input, true);

  if (field) {
    redirectToUsers("invalid", field);
  }

  const result = await updateAdminPropertyMembership(input);

  handleMutationResult(result, "updated");
}

export async function activateAdminPropertyMembershipAction(formData: FormData) {
  const input = membershipInputFromForm(formData);

  if (!isUuid(input.membershipId)) {
    redirectToUsers("invalid", "membershipId");
  }

  const result = await activateAdminPropertyMembership(input);

  handleMutationResult(result, "activated");
}

export async function suspendAdminPropertyMembershipAction(formData: FormData) {
  const input = membershipInputFromForm(formData);

  if (!isUuid(input.membershipId)) {
    redirectToUsers("invalid", "membershipId");
  }

  const result = await suspendAdminPropertyMembership(input);

  handleMutationResult(result, "suspended");
}

export async function removeAdminPropertyMembershipAction(formData: FormData) {
  const input = membershipInputFromForm(formData);

  if (!isUuid(input.membershipId)) {
    redirectToUsers("invalid", "membershipId");
  }

  const result = await removeAdminPropertyMembership(input);

  handleMutationResult(result, "removed");
}
