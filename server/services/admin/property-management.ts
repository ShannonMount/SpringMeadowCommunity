import "server-only";

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

const PROPERTY_MANAGEMENT_PERMISSION = "admin.properties.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PROPERTY_UNAVAILABLE_MESSAGE =
  "Property records are unavailable. Please contact the HOA for help.";
const INVALID_PROPERTY_INPUT_MESSAGE = "Please check the property details and try again.";
const CONFLICT_PROPERTY_MESSAGE = "A property already uses that value.";
const MAX_QUERY_LENGTH = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_PAYMENT_CODE_PATTERN = /^[a-z0-9 ._-]+$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const PROPERTY_STATUSES = ["active", "inactive", "archived"] as const;
const DELINQUENCY_STATUSES = [
  "current",
  "due_soon",
  "overdue",
  "delinquent",
  "lien_review",
  "disputed",
] as const;
const MAILING_ADDRESS_KEYS = [
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "county",
] as const satisfies readonly (keyof AdminPropertyMailingAddress)[];

type FieldErrors = Record<string, string[]>;

export type AdminPropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type AdminPropertyDelinquencyStatus = (typeof DELINQUENCY_STATUSES)[number];

export type AdminPropertyMailingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  county?: string;
};

export type AdminPropertySummary = {
  id: string;
  communityId: string;
  accountNumber: string;
  publicPaymentCode: string | null;
  status: AdminPropertyStatus;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  county: string | null;
  mailingAddress: AdminPropertyMailingAddress | null;
  ownerDisplayName: string | null;
  lotNumber: string | null;
  parcelNumber: string | null;
  platReference: string | null;
  currentBalanceCents: number;
  lastPaymentAt: string | null;
  nextDueDate: string | null;
  delinquencyStatus: AdminPropertyDelinquencyStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminPropertyFilters = {
  communitySlug?: string | null;
  status?: string | null;
  query?: string | null;
  includeArchived?: boolean | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type AdminPropertyMutationInput = {
  communitySlug?: string | null;
  propertyId?: string | null;
  accountNumber: string;
  publicPaymentCode?: string | null;
  status: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  county?: string | null;
  mailingAddress?: AdminPropertyMailingAddress | null;
  ownerDisplayName?: string | null;
  lotNumber?: string | null;
  parcelNumber?: string | null;
  platReference?: string | null;
  nextDueDate?: string | null;
  delinquencyStatus?: string | null;
};

export type AdminPropertyListResult =
  | {
      kind: "properties";
      communityId: string;
      communitySlug: string;
      properties: AdminPropertySummary[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_PROPERTY_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "property-unavailable"; message: typeof PROPERTY_UNAVAILABLE_MESSAGE };

export type AdminPropertyMutationResult =
  | { kind: "created"; id: string }
  | { kind: "updated"; id: string }
  | { kind: "archived"; id: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_PROPERTY_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "conflict"; message: typeof CONFLICT_PROPERTY_MESSAGE; field: "accountNumber" | "publicPaymentCode" }
  | { kind: "property-unavailable"; message: typeof PROPERTY_UNAVAILABLE_MESSAGE };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "property-unavailable"; message: typeof PROPERTY_UNAVAILABLE_MESSAGE };

type PermissionGateResult =
  | { kind: "authorized"; profile: CurrentProfile }
  | Exclude<AdminPropertyMutationResult, { kind: "created" | "updated" | "archived" | "invalid-input" | "conflict" | "property-unavailable" }>;

type PropertyRpcRow = {
  id?: string | null;
  community_id?: string | null;
  account_number?: string | null;
  public_payment_code?: string | null;
  status?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  county?: string | null;
  mailing_address?: AdminPropertyMailingAddress | null;
  owner_display_name?: string | null;
  lot_number?: string | null;
  parcel_number?: string | null;
  plat_reference?: string | null;
  current_balance_cents?: number | null;
  last_payment_at?: string | null;
  next_due_date?: string | null;
  delinquency_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ListPropertiesRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  community_id?: string | null;
  properties?: PropertyRpcRow[];
};

type PropertyMutationRpcResult = {
  status?:
    | "created"
    | "updated"
    | "archived"
    | "permission_denied"
    | "invalid"
    | "account_conflict"
    | "payment_code_conflict"
    | "property_unavailable";
  property_id?: string | null;
  community_id?: string | null;
  before?: Record<string, unknown> | null;
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

function normalizeAccountNumber(value: string) {
  return normalizeSpaces(value).toUpperCase();
}

function normalizePaymentCode(value: string | null | undefined) {
  const code = normalizeSpaces(value ?? "");

  return code ? code.toUpperCase() : null;
}

function isDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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

function invalid(fieldErrors: FieldErrors): Extract<AdminPropertyListResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_PROPERTY_INPUT_MESSAGE,
    fieldErrors,
  };
}

function invalidMutation(
  fieldErrors: FieldErrors,
): Extract<AdminPropertyMutationResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_PROPERTY_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AdminPropertyListResult, { kind: "property-unavailable" }> {
  return { kind: "property-unavailable", message: PROPERTY_UNAVAILABLE_MESSAGE };
}

function unavailableMutation(): Extract<AdminPropertyMutationResult, { kind: "property-unavailable" }> {
  return { kind: "property-unavailable", message: PROPERTY_UNAVAILABLE_MESSAGE };
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

function permissionResultToList(result: PermissionResult): AdminPropertyListResult | null {
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

function permissionResultToMutation(result: PermissionResult): AdminPropertyMutationResult | null {
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

async function requirePropertyManagementPermission(
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
    permissionKey: PROPERTY_MANAGEMENT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    if (permission.kind === "unauthenticated") {
      return { kind: "unauthenticated" };
    }

    if (permission.kind === "profile-unavailable") {
      return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
    }

    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return { kind: "authorized", profile: profileResult.profile };
}

function validateListFilters(input: AdminPropertyFilters): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const status = optionalString(input.status);
  const query = optionalString(input.query);

  if (status && !isIncluded(PROPERTY_STATUSES, status)) {
    fieldErrors.status = ["Property status is not supported."];
  }

  if (query) {
    if (query.length > MAX_QUERY_LENGTH || hasControlCharacters(query)) {
      fieldErrors.query = ["Search text is invalid."];
    }
  }

  return fieldErrors;
}

function validateMailingAddress(
  mailingAddress: AdminPropertyMailingAddress | null | undefined,
  fieldErrors: FieldErrors,
) {
  if (!mailingAddress) {
    return;
  }

  for (const [key, value] of Object.entries(mailingAddress)) {
    if (
      !isIncluded(MAILING_ADDRESS_KEYS, key) ||
      typeof value !== "string" ||
      hasControlCharacters(value) ||
      value.length > 200
    ) {
      fieldErrors[`mailingAddress.${key}`] = ["Mailing address is invalid."];
    }
  }
}

function validateMutationInput(input: AdminPropertyMutationInput, requirePropertyId: boolean) {
  const fieldErrors: FieldErrors = {};
  const accountNumber = normalizeAccountNumber(input.accountNumber);
  const publicPaymentCode = normalizePaymentCode(input.publicPaymentCode);
  const status = safeString(input.status) || "active";
  const delinquencyStatus = safeString(input.delinquencyStatus) || "current";

  if (requirePropertyId && !isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is required."];
  }

  if (!accountNumber || accountNumber.length > 80 || hasControlCharacters(accountNumber)) {
    fieldErrors.accountNumber = ["Account number is required."];
  }

  if (publicPaymentCode) {
    if (
      publicPaymentCode.length > 80 ||
      !SAFE_PAYMENT_CODE_PATTERN.test(publicPaymentCode) ||
      hasControlCharacters(publicPaymentCode)
    ) {
      fieldErrors.publicPaymentCode = ["Public payment code is invalid."];
    }
  }

  if (!isIncluded(PROPERTY_STATUSES, status)) {
    fieldErrors.status = ["Property status is not supported."];
  }

  if (!normalizeSpaces(input.addressLine1) || hasControlCharacters(input.addressLine1)) {
    fieldErrors.addressLine1 = ["Address line 1 is required."];
  }

  if (hasControlCharacters(input.addressLine2)) {
    fieldErrors.addressLine2 = ["Address line 2 is invalid."];
  }

  if (!normalizeSpaces(input.city) || hasControlCharacters(input.city)) {
    fieldErrors.city = ["City is required."];
  }

  if (!normalizeSpaces(input.state) || hasControlCharacters(input.state)) {
    fieldErrors.state = ["State is required."];
  }

  if (!normalizeSpaces(input.postalCode) || hasControlCharacters(input.postalCode)) {
    fieldErrors.postalCode = ["Postal code is required."];
  }

  for (const [field, value] of [
    ["county", input.county],
    ["ownerDisplayName", input.ownerDisplayName],
    ["lotNumber", input.lotNumber],
    ["parcelNumber", input.parcelNumber],
    ["platReference", input.platReference],
  ] as const) {
    if (hasControlCharacters(value)) {
      fieldErrors[field] = ["Field is invalid."];
    }
  }

  if (input.nextDueDate && !isDateOnly(input.nextDueDate)) {
    fieldErrors.nextDueDate = ["Next due date must be a date."];
  }

  if (!isIncluded(DELINQUENCY_STATUSES, delinquencyStatus)) {
    fieldErrors.delinquencyStatus = ["Delinquency status is not supported."];
  }

  validateMailingAddress(input.mailingAddress, fieldErrors);

  return fieldErrors;
}

function normalizeMailingAddress(
  value: AdminPropertyMailingAddress | null | undefined,
): AdminPropertyMailingAddress | null {
  if (!value) {
    return null;
  }

  const mailingAddress: AdminPropertyMailingAddress = {};

  for (const key of MAILING_ADDRESS_KEYS) {
    const fieldValue = value[key];
    const normalized = normalizeSpaces(fieldValue ?? "");

    if (normalized) {
      mailingAddress[key] = key === "state" ? normalized.toUpperCase() : normalized;
    }
  }

  return Object.keys(mailingAddress).length > 0 ? mailingAddress : null;
}

function asProperty(row: PropertyRpcRow): AdminPropertySummary {
  const status = row.status ?? "";
  const delinquencyStatus = row.delinquency_status ?? "";

  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    accountNumber: row.account_number ?? "",
    publicPaymentCode: row.public_payment_code ?? null,
    status: isIncluded(PROPERTY_STATUSES, status) ? status : "active",
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? null,
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    county: row.county ?? null,
    mailingAddress: row.mailing_address ?? null,
    ownerDisplayName: row.owner_display_name ?? null,
    lotNumber: row.lot_number ?? null,
    parcelNumber: row.parcel_number ?? null,
    platReference: row.plat_reference ?? null,
    currentBalanceCents: row.current_balance_cents ?? 0,
    lastPaymentAt: row.last_payment_at ?? null,
    nextDueDate: row.next_due_date ?? null,
    delinquencyStatus: isIncluded(DELINQUENCY_STATUSES, delinquencyStatus)
      ? delinquencyStatus
      : "current",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function rpcConflict(
  status: PropertyMutationRpcResult["status"],
): Extract<AdminPropertyMutationResult, { kind: "conflict" }> | null {
  if (status === "account_conflict") {
    return { kind: "conflict", message: CONFLICT_PROPERTY_MESSAGE, field: "accountNumber" };
  }

  if (status === "payment_code_conflict") {
    return { kind: "conflict", message: CONFLICT_PROPERTY_MESSAGE, field: "publicPaymentCode" };
  }

  return null;
}

function mutationAuditAfter(input: AdminPropertyMutationInput) {
  return {
    accountNumber: normalizeAccountNumber(input.accountNumber),
    publicPaymentCode: normalizePaymentCode(input.publicPaymentCode),
    status: safeString(input.status) || "active",
    addressLine1: normalizeSpaces(input.addressLine1),
    addressLine2: optionalString(input.addressLine2),
    city: normalizeSpaces(input.city),
    state: normalizeSpaces(input.state).toUpperCase(),
    postalCode: normalizeSpaces(input.postalCode),
    county: optionalString(input.county),
    ownerDisplayName: optionalString(input.ownerDisplayName),
    lotNumber: optionalString(input.lotNumber),
    parcelNumber: optionalString(input.parcelNumber),
    platReference: optionalString(input.platReference),
    mailingAddress: normalizeMailingAddress(input.mailingAddress),
    nextDueDate: optionalString(input.nextDueDate),
    delinquencyStatus: safeString(input.delinquencyStatus) || "current",
  };
}

async function auditPropertyMutation(input: {
  action: "property.create" | "property.update" | "property.archive";
  actorProfileId: string;
  communityId: string;
  propertyId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  await writeAuditLog({
    action: input.action,
    actorProfileId: input.actorProfileId,
    communityId: input.communityId,
    targetType: "properties",
    targetId: input.propertyId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export async function listAdminProperties(
  input: AdminPropertyFilters = {},
): Promise<AdminPropertyListResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateListFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requirePropertyManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToList(permission as PermissionResult) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_properties", {
    target_community_slug: community.communitySlug,
    include_archived: input.includeArchived === true,
    filter_status: optionalString(input.status),
    filter_query: optionalString(input.query),
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as ListPropertiesRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Property filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "properties",
    communityId: result.community_id ?? community.communityId,
    communitySlug: community.communitySlug,
    properties: (result.properties ?? []).map(asProperty),
  };
}

export async function createAdminProperty(
  input: AdminPropertyMutationInput,
): Promise<AdminPropertyMutationResult> {
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

  const permission = await requirePropertyManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission as PermissionResult) ?? unavailableMutation();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_admin_property", {
    target_community_slug: community.communitySlug,
    property_account_number: normalizeAccountNumber(input.accountNumber),
    property_public_payment_code: normalizePaymentCode(input.publicPaymentCode),
    property_status: safeString(input.status) || "active",
    property_address_line1: normalizeSpaces(input.addressLine1),
    property_address_line2: optionalString(input.addressLine2),
    property_city: normalizeSpaces(input.city),
    property_state: normalizeSpaces(input.state).toUpperCase(),
    property_postal_code: normalizeSpaces(input.postalCode),
    property_county: optionalString(input.county),
    property_mailing_address: normalizeMailingAddress(input.mailingAddress),
    property_owner_display_name: optionalString(input.ownerDisplayName),
    property_lot_number: optionalString(input.lotNumber),
    property_parcel_number: optionalString(input.parcelNumber),
    property_plat_reference: optionalString(input.platReference),
    property_next_due_date: optionalString(input.nextDueDate),
    property_delinquency_status: safeString(input.delinquencyStatus) || "current",
  });
  const result = data as PropertyMutationRpcResult | null;

  if (error || !result) {
    return unavailableMutation();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  const conflict = rpcConflict(result.status);

  if (conflict) {
    return conflict;
  }

  if (result.status === "invalid") {
    return invalidMutation({ form: ["Property details are invalid."] });
  }

  if (result.status !== "created" || !result.property_id) {
    return unavailableMutation();
  }

  await auditPropertyMutation({
    action: "property.create",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? community.communityId,
    propertyId: result.property_id,
    after: mutationAuditAfter(input),
  });

  return { kind: "created", id: result.property_id };
}

export async function updateAdminProperty(
  input: AdminPropertyMutationInput,
): Promise<AdminPropertyMutationResult> {
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

  const permission = await requirePropertyManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission as PermissionResult) ?? unavailableMutation();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_admin_property", {
    target_property_id: input.propertyId,
    target_community_slug: community.communitySlug,
    property_account_number: normalizeAccountNumber(input.accountNumber),
    property_public_payment_code: normalizePaymentCode(input.publicPaymentCode),
    property_status: safeString(input.status) || "active",
    property_address_line1: normalizeSpaces(input.addressLine1),
    property_address_line2: optionalString(input.addressLine2),
    property_city: normalizeSpaces(input.city),
    property_state: normalizeSpaces(input.state).toUpperCase(),
    property_postal_code: normalizeSpaces(input.postalCode),
    property_county: optionalString(input.county),
    property_mailing_address: normalizeMailingAddress(input.mailingAddress),
    property_owner_display_name: optionalString(input.ownerDisplayName),
    property_lot_number: optionalString(input.lotNumber),
    property_parcel_number: optionalString(input.parcelNumber),
    property_plat_reference: optionalString(input.platReference),
    property_next_due_date: optionalString(input.nextDueDate),
    property_delinquency_status: safeString(input.delinquencyStatus) || "current",
  });
  const result = data as PropertyMutationRpcResult | null;

  if (error || !result) {
    return unavailableMutation();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  const conflict = rpcConflict(result.status);

  if (conflict) {
    return conflict;
  }

  if (result.status === "invalid") {
    return invalidMutation({ form: ["Property details are invalid."] });
  }

  if (result.status === "property_unavailable") {
    return unavailableMutation();
  }

  if (result.status !== "updated" || !result.property_id) {
    return unavailableMutation();
  }

  await auditPropertyMutation({
    action: "property.update",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? community.communityId,
    propertyId: result.property_id,
    before: result.before ?? null,
    after: mutationAuditAfter(input),
  });

  return { kind: "updated", id: result.property_id };
}

export async function archiveAdminProperty(input: {
  communitySlug?: string | null;
  propertyId: string;
}): Promise<AdminPropertyMutationResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidMutation(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailableMutation();
  }

  if (!isUuid(input.propertyId)) {
    return invalidMutation({ propertyId: ["Property is required."] });
  }

  const permission = await requirePropertyManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission as PermissionResult) ?? unavailableMutation();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_admin_property", {
    target_property_id: input.propertyId,
    target_community_slug: community.communitySlug,
  });
  const result = data as PropertyMutationRpcResult | null;

  if (error || !result) {
    return unavailableMutation();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "property_unavailable") {
    return unavailableMutation();
  }

  if (result.status !== "archived" || !result.property_id) {
    return unavailableMutation();
  }

  await auditPropertyMutation({
    action: "property.archive",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? community.communityId,
    propertyId: result.property_id,
    before: result.before ?? null,
    after: {
      status: "archived",
      deletedAt: "set",
    },
  });

  return { kind: "archived", id: result.property_id };
}
