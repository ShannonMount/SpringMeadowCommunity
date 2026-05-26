import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import * as permissionService from "@/server/services/auth/permissions";
import type { PermissionResult } from "@/server/services/auth/permissions";

const DELINQUENCY_REPORT_PERMISSION = "board.delinquency.view";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const REPORT_UNAVAILABLE_MESSAGE =
  "Delinquency report is unavailable. Please contact the HOA for help.";
const INVALID_REPORT_INPUT_MESSAGE = "Please check the report filters and try again.";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const MAX_QUERY_LENGTH = 200;
const MAX_RPC_INTEGER_CENTS = 2147483647;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELINQUENCY_STAGES = [
  "current",
  "due_soon",
  "overdue",
  "delinquent",
  "lien_review",
  "disputed",
] as const;

type FieldErrors = Record<string, string[]>;

export type DelinquencyStage = (typeof DELINQUENCY_STAGES)[number];

export type DelinquencyReportRecord = {
  propertyId: string;
  communityId: string;
  propertyLabel: string;
  stage: DelinquencyStage;
  currentBalanceCents: number;
  openAssessmentCount: number;
  openAssessmentBalanceCents: number;
  oldestUnpaidDueDate: string | null;
  daysPastDue: number;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  hasDisputedAssessment: boolean;
  lienReviewCandidate: boolean;
  delinquentDaysPastDue: number;
  lienReadinessDaysPastDue: number;
};

export type DelinquencyReportFilters = {
  communityId?: string | null;
  communitySlug?: string | null;
  stage?: string | null;
  from?: string | null;
  to?: string | null;
  query?: string | null;
  minimumBalanceCents?: number | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "report-unavailable"; message: typeof REPORT_UNAVAILABLE_MESSAGE };

type DelinquencyReportRpcResult = {
  status?: "ok" | "permission_denied" | "invalid";
  records?: DelinquencyReportRpcRow[];
};

type DelinquencyReportRpcRow = {
  property_id?: string | null;
  community_id?: string | null;
  property_label?: string | null;
  stage?: string | null;
  current_balance_cents?: number | null;
  open_assessment_count?: number | null;
  open_assessment_balance_cents?: number | null;
  oldest_unpaid_due_date?: string | null;
  days_past_due?: number | null;
  next_due_date?: string | null;
  last_payment_at?: string | null;
  has_disputed_assessment?: boolean | null;
  lien_review_candidate?: boolean | null;
  delinquent_days_past_due?: number | null;
  lien_readiness_days_past_due?: number | null;
};

export type DelinquencyReportResult =
  | {
      kind: "records";
      communityId: string;
      communitySlug: string;
      records: DelinquencyReportRecord[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_REPORT_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "report-unavailable"; message: typeof REPORT_UNAVAILABLE_MESSAGE };

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

function isValidDateOnly(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  return isValidDateParts(year, month, day);
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
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

function invalid(fieldErrors: FieldErrors): Extract<DelinquencyReportResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_REPORT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<DelinquencyReportResult, { kind: "report-unavailable" }> {
  return { kind: "report-unavailable", message: REPORT_UNAVAILABLE_MESSAGE };
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
    return { kind: "report-unavailable", message: REPORT_UNAVAILABLE_MESSAGE };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

const hasPermission = permissionService.hasPermission;
const PERMISSION_DENIED_MESSAGE = permissionService.PERMISSION_DENIED_MESSAGE;

function permissionResultToReport(result: PermissionResult): DelinquencyReportResult | null {
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

function validateReportFilters(input: DelinquencyReportFilters): FieldErrors {
  const fieldErrors: FieldErrors = {};

  if (input.stage && !isIncluded(DELINQUENCY_STAGES, input.stage)) {
    fieldErrors.stage = ["Delinquency stage is not supported."];
  }

  if (input.from && !isValidDateOnly(input.from)) {
    fieldErrors.from = ["From date is invalid."];
  }

  if (input.to && !isValidDateOnly(input.to)) {
    fieldErrors.to = ["To date is invalid."];
  }

  if (input.from && input.to && isValidDateOnly(input.from) && isValidDateOnly(input.to)) {
    if (input.to < input.from) {
      fieldErrors.to = ["To date must be after from date."];
    }
  }

  if (input.query && safeString(input.query).length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search text is too long."];
  }

  if (
    input.minimumBalanceCents !== null &&
    input.minimumBalanceCents !== undefined &&
    (!isNonNegativeInteger(input.minimumBalanceCents) ||
      input.minimumBalanceCents > MAX_RPC_INTEGER_CENTS)
  ) {
    fieldErrors.minimumBalanceCents = ["Minimum balance must be integer cents."];
  }

  if (input.pageSize !== null && input.pageSize !== undefined && !isPositiveInteger(input.pageSize)) {
    fieldErrors.pageSize = ["Page size must be positive."];
  }

  return fieldErrors;
}

function asRecord(row: DelinquencyReportRpcRow): DelinquencyReportRecord {
  const stage = row.stage ?? "";

  return {
    propertyId: row.property_id ?? "",
    communityId: row.community_id ?? "",
    propertyLabel: row.property_label ?? "Unknown property",
    stage: isIncluded(DELINQUENCY_STAGES, stage) ? stage : "current",
    currentBalanceCents: row.current_balance_cents ?? 0,
    openAssessmentCount: row.open_assessment_count ?? 0,
    openAssessmentBalanceCents: row.open_assessment_balance_cents ?? 0,
    oldestUnpaidDueDate: row.oldest_unpaid_due_date ?? null,
    daysPastDue: row.days_past_due ?? 0,
    nextDueDate: row.next_due_date ?? null,
    lastPaymentAt: row.last_payment_at ?? null,
    hasDisputedAssessment: row.has_disputed_assessment === true,
    lienReviewCandidate: row.lien_review_candidate === true,
    delinquentDaysPastDue: row.delinquent_days_past_due ?? 15,
    lienReadinessDaysPastDue: row.lien_readiness_days_past_due ?? 30,
  };
}

export async function listDelinquencyReport(
  input: DelinquencyReportFilters = {},
): Promise<DelinquencyReportResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateReportFilters(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: DELINQUENCY_REPORT_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToReport(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_delinquency_report", {
    target_community_id: community.communityId,
    filter_stage: optionalString(input.stage),
    filter_from: optionalString(input.from),
    filter_to: optionalString(input.to),
    filter_query: optionalString(input.query),
    filter_minimum_balance_cents: input.minimumBalanceCents ?? null,
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as DelinquencyReportRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Report filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "records",
    communityId: community.communityId,
    communitySlug: community.communitySlug,
    records: (result.records ?? []).map(asRecord),
  };
}
