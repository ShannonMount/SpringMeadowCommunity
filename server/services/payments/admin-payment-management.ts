import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import * as permissionService from "@/server/services/auth/permissions";
import type { PermissionResult } from "@/server/services/auth/permissions";

const ADMIN_PAYMENT_PERMISSION = "admin.payments.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const ADMIN_PAYMENT_UNAVAILABLE_MESSAGE =
  "Payment records are unavailable. Please contact the HOA for help.";
const INVALID_ADMIN_PAYMENT_INPUT_MESSAGE = "Please check the payment details and try again.";
const MANUAL_PAYMENTS_DISABLED_MESSAGE = "Manual payment recording is disabled.";
const ADMIN_PAYMENT_TIME_ZONE = "America/New_York";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const MAX_PAYMENT_AMOUNT_CENTS = 100000000;
const MAX_QUERY_LENGTH = 200;
const MAX_REASON_LENGTH = 500;
const MAX_MANUAL_ALLOCATIONS = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const SENSITIVE_PAYMENT_REASON_PATTERN =
  /\b(card number|credit card|debit card|cvv|cvc|routing number|bank account|account number|aba routing|iban|swift|micr)\b|(\d[ -]?){9,}/i;

const PAYMENT_STATUSES = [
  "created",
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
  "void",
] as const;
const PAYER_TYPES = ["resident", "guest", "admin_recorded"] as const;
const PAYMENT_METHODS = ["card", "ach", "check", "cash", "manual", "other"] as const;
export const OFFLINE_PAYMENT_METHODS = ["check", "cash", "manual", "other"] as const;

type FieldErrors = Record<string, string[]>;

export type AdminPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type AdminPaymentPayerType = (typeof PAYER_TYPES)[number];
export type AdminPaymentMethod = (typeof PAYMENT_METHODS)[number];
export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

export type AdminPaymentRecord = {
  id: string;
  communityId: string;
  propertyId: string;
  propertyLabel: string;
  status: AdminPaymentStatus;
  payerType: AdminPaymentPayerType;
  amountCents: number;
  currency: "USD";
  feePolicy: "payer_pays" | "hoa_pays";
  method: AdminPaymentMethod;
  receiptNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  processorFeeCents: number | null;
  netAmountCents: number | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  allocatedCents: number;
  unappliedCents: number;
};

export type AdminPaymentRecordFilters = {
  communityId?: string | null;
  communitySlug?: string | null;
  status?: string | null;
  payerType?: string | null;
  method?: string | null;
  propertyId?: string | null;
  from?: string | null;
  to?: string | null;
  query?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type ManualPaymentAllocationInput = {
  assessmentId: string;
  amountCents: number;
};

export type RecordManualPaymentInput = {
  communityId?: string | null;
  communitySlug?: string | null;
  propertyId: string;
  requestId: string;
  amountCents: number;
  method: string;
  paidAt?: string | null;
  allocations?: ManualPaymentAllocationInput[];
  reason?: string | null;
};

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };

type AdminPaymentRecordsRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  manual_payments_enabled?: boolean;
  records?: AdminPaymentRpcRow[];
};

type ManualPaymentRpcResult = {
  status?: "recorded" | "permission_denied" | "configuration_disabled" | "invalid" | "unavailable";
  payment_id?: string | null;
  allocated_cents?: number | null;
  unapplied_cents?: number | null;
};

type AdminPaymentRpcRow = {
  id?: string | null;
  community_id?: string | null;
  property_id?: string | null;
  property_label?: string | null;
  status?: string | null;
  payer_type?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  fee_policy?: string | null;
  method?: string | null;
  receipt_number?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  processor_fee_cents?: number | null;
  net_amount_cents?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  allocated_cents?: number | null;
  unapplied_cents?: number | null;
};

export type AdminPaymentRecordsResult =
  | {
      kind: "records";
      communityId: string;
      communitySlug: string;
      manualPaymentsEnabled: boolean;
      records: AdminPaymentRecord[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_ADMIN_PAYMENT_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };

export type RecordManualPaymentResult =
  | { kind: "recorded"; paymentId: string; allocatedCents: number; unappliedCents: number }
  | { kind: "configuration-disabled"; message: typeof MANUAL_PAYMENTS_DISABLED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_ADMIN_PAYMENT_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "payment-unavailable"; message: typeof ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return isValidDateParts(year, month, day);
}

function isValidDateTimeLocal(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const yearValue = Number(year);
  const monthValue = Number(month);
  const dayValue = Number(day);
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);

  return (
    isValidDateParts(yearValue, monthValue, dayValue) &&
    hourValue >= 0 &&
    hourValue <= 23 &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    secondValue >= 0 &&
    secondValue <= 59
  );
}

function isDateTime(value: string | null | undefined): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  const trimmed = value.trim();

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return isValidDateOnly(trimmed);
  }

  if (DATE_TIME_LOCAL_PATTERN.test(trimmed)) {
    return isValidDateTimeLocal(trimmed);
  }

  return !Number.isNaN(Date.parse(trimmed));
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
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

function boundedPageSize(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Number(value), 1), MAX_PAGE_SIZE);
}

function boundedPageOffset(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value), 0), MAX_PAGE_OFFSET);
}

function getTimeZoneOffsetMs(date: Date, timeZone = ADMIN_PAYMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
  );
}

function dateTimeLocalToTimeZoneIso(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute, second = "0", millisecond = "0"] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, "0").slice(0, 3)),
  );
  let instant = localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc));
  instant = localAsUtc - getTimeZoneOffsetMs(new Date(instant));

  return new Date(instant).toISOString();
}

function normalizeDateTime(value: string | null | undefined, dateOnlyTime: string) {
  const trimmed = safeString(value);

  if (!trimmed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return dateTimeLocalToTimeZoneIso(`${trimmed}${dateOnlyTime}`);
  }

  if (DATE_TIME_LOCAL_PATTERN.test(trimmed)) {
    return dateTimeLocalToTimeZoneIso(trimmed);
  }

  return new Date(trimmed).toISOString();
}

function normalizeFromDateTime(value: string | null | undefined) {
  return normalizeDateTime(value, "T00:00:00.000");
}

function normalizeToDateTime(value: string | null | undefined) {
  return normalizeDateTime(value, "T23:59:59.999");
}

function invalid(fieldErrors: FieldErrors): Extract<AdminPaymentRecordsResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_ADMIN_PAYMENT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function invalidManual(
  fieldErrors: FieldErrors,
): Extract<RecordManualPaymentResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_ADMIN_PAYMENT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AdminPaymentRecordsResult, { kind: "payment-unavailable" }> {
  return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
}

function manualUnavailable(): Extract<RecordManualPaymentResult, { kind: "payment-unavailable" }> {
  return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
}

async function resolveCommunity(input: {
  communityId?: string | null;
  communitySlug?: string | null;
}): Promise<CommunityResolution> {
  const fieldErrors: FieldErrors = {};
  const communityId = safeString(input.communityId);
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;

  if (communityId) {
    if (!isUuid(communityId)) {
      fieldErrors.communityId = ["Community is required."];

      return { kind: "invalid-input", fieldErrors };
    }

    return { kind: "resolved", communityId, communitySlug };
  }

  if (!communitySlug) {
    fieldErrors.communitySlug = ["Community is required."];

    return { kind: "invalid-input", fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return { kind: "payment-unavailable", message: ADMIN_PAYMENT_UNAVAILABLE_MESSAGE };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

const hasPermission = permissionService.hasPermission;
const PERMISSION_DENIED_MESSAGE = permissionService.PERMISSION_DENIED_MESSAGE;

function permissionResultToRecords(result: PermissionResult): AdminPaymentRecordsResult | null {
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

function permissionResultToManual(result: PermissionResult): RecordManualPaymentResult | null {
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

function validateRecordFilters(input: AdminPaymentRecordFilters): FieldErrors {
  const fieldErrors: FieldErrors = {};

  if (input.status && !isIncluded(PAYMENT_STATUSES, input.status)) {
    fieldErrors.status = ["Payment status is not supported."];
  }

  if (input.payerType && !isIncluded(PAYER_TYPES, input.payerType)) {
    fieldErrors.payerType = ["Payer type is not supported."];
  }

  if (input.method && !isIncluded(PAYMENT_METHODS, input.method)) {
    fieldErrors.method = ["Payment method is not supported."];
  }

  if (input.propertyId && !isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is invalid."];
  }

  if (input.from && !isDateTime(input.from)) {
    fieldErrors.from = ["From date is invalid."];
  }

  if (input.to && !isDateTime(input.to)) {
    fieldErrors.to = ["To date is invalid."];
  }

  if (input.query && safeString(input.query).length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search text is too long."];
  }

  if (input.from && input.to && isDateTime(input.from) && isDateTime(input.to)) {
    if (Date.parse(input.to) < Date.parse(input.from)) {
      fieldErrors.to = ["To date must be after from date."];
    }
  }

  return fieldErrors;
}

function validateManualPayment(input: RecordManualPaymentInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  if (!isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is required."];
  }

  if (!isUuid(input.requestId)) {
    fieldErrors.requestId = ["Request ID is required."];
  }

  if (!isPositiveInteger(input.amountCents) || input.amountCents > MAX_PAYMENT_AMOUNT_CENTS) {
    fieldErrors.amountCents = ["Amount must be positive integer cents."];
  }

  if (!isIncluded(OFFLINE_PAYMENT_METHODS, input.method)) {
    fieldErrors.method = ["Payment method is not supported."];
  }

  if (input.paidAt && !isDateTime(input.paidAt)) {
    fieldErrors.paidAt = ["Paid date is invalid."];
  }

  const reason = optionalString(input.reason);

  if (reason && reason.length > MAX_REASON_LENGTH) {
    fieldErrors.reason = ["Reason is too long."];
  } else if (reason && SENSITIVE_PAYMENT_REASON_PATTERN.test(reason)) {
    fieldErrors.reason = ["Reason cannot include payment instrument details."];
  }

  let allocationTotal = 0;
  const allocations = input.allocations ?? [];

  if (allocations.length > MAX_MANUAL_ALLOCATIONS) {
    fieldErrors.allocations = ["Too many allocations."];
  }

  for (const [index, allocation] of allocations.entries()) {
    if (!isUuid(allocation.assessmentId)) {
      fieldErrors[`allocations.${index}.assessmentId`] = ["Assessment is invalid."];
    }

    if (!isPositiveInteger(allocation.amountCents)) {
      fieldErrors[`allocations.${index}.amountCents`] = ["Allocation amount must be positive."];
    } else {
      allocationTotal += allocation.amountCents;
    }
  }

  if (allocationTotal > input.amountCents) {
    fieldErrors.allocations = ["Allocations cannot exceed the payment amount."];
  }

  return fieldErrors;
}

function asRecord(row: AdminPaymentRpcRow): AdminPaymentRecord {
  const status = row.status ?? "";
  const payerType = row.payer_type ?? "";
  const method = row.method ?? "";

  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    propertyId: row.property_id ?? "",
    propertyLabel: row.property_label ?? "Unknown property",
    status: isIncluded(PAYMENT_STATUSES, status) ? status : "created",
    payerType: isIncluded(PAYER_TYPES, payerType) ? payerType : "resident",
    amountCents: row.amount_cents ?? 0,
    currency: row.currency === "USD" ? "USD" : "USD",
    feePolicy: row.fee_policy === "hoa_pays" ? "hoa_pays" : "payer_pays",
    method: isIncluded(PAYMENT_METHODS, method) ? method : "other",
    receiptNumber: row.receipt_number ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeChargeId: row.stripe_charge_id ?? null,
    processorFeeCents: row.processor_fee_cents ?? null,
    netAmountCents: row.net_amount_cents ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    allocatedCents: row.allocated_cents ?? 0,
    unappliedCents: row.unapplied_cents ?? 0,
  };
}

export async function listAdminPaymentRecords(
  input: AdminPaymentRecordFilters = {},
): Promise<AdminPaymentRecordsResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateRecordFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: ADMIN_PAYMENT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToRecords(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_payment_records", {
    target_community_id: community.communityId,
    filter_status: optionalString(input.status),
    filter_payer_type: optionalString(input.payerType),
    filter_method: optionalString(input.method),
    filter_property_id: optionalString(input.propertyId),
    filter_from: normalizeFromDateTime(input.from),
    filter_to: normalizeToDateTime(input.to),
    filter_query: optionalString(input.query),
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as AdminPaymentRecordsRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Payment filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "records",
    communityId: community.communityId,
    communitySlug: community.communitySlug,
    manualPaymentsEnabled: result.manual_payments_enabled === true,
    records: (result.records ?? []).map(asRecord),
  };
}

export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<RecordManualPaymentResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalidManual(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return manualUnavailable();
  }

  const fieldErrors = validateManualPayment(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalidManual(fieldErrors);
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: ADMIN_PAYMENT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToManual(permission) ?? manualUnavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_manual_payment", {
    target_community_id: community.communityId,
    target_property_id: input.propertyId,
    request_id: input.requestId,
    payment_amount_cents: input.amountCents,
    payment_method: input.method,
    payment_paid_at: normalizeFromDateTime(input.paidAt),
    allocation_input: input.allocations ?? [],
    payment_reason: optionalString(input.reason),
  });
  const result = data as ManualPaymentRpcResult | null;

  if (error || !result) {
    return manualUnavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "configuration_disabled") {
    return { kind: "configuration-disabled", message: MANUAL_PAYMENTS_DISABLED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalidManual({ form: ["Manual payment details are invalid."] });
  }

  if (result.status !== "recorded" || !result.payment_id) {
    return manualUnavailable();
  }

  return {
    kind: "recorded",
    paymentId: result.payment_id,
    allocatedCents: result.allocated_cents ?? 0,
    unappliedCents: result.unapplied_cents ?? 0,
  };
}
