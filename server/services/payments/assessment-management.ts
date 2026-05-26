import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
  type PermissionResult,
} from "@/server/services/auth/permissions";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import { writeAuditLog } from "@/server/services/audit/write-audit-log";

const ASSESSMENT_MANAGEMENT_PERMISSION = "admin.assessments.manage";
const ASSESSMENT_UNAVAILABLE_MESSAGE =
  "Assessment records are unavailable. Please contact the HOA for help.";
const INVALID_ASSESSMENT_INPUT_MESSAGE = "Please check the assessment details and try again.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CYCLE_TYPES = ["annual", "quarterly", "monthly", "special"] as const;
const ASSESSMENT_TYPES = [
  "regular_dues",
  "special_assessment",
  "late_fee",
  "interest",
  "fine",
  "damage_assessment",
  "manual_adjustment",
] as const;
const ASSESSMENT_STATUSES = [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "overdue",
  "waived",
  "disputed",
  "void",
] as const;
const CREATE_ASSESSMENT_STATUSES = ["draft", "open"] as const;

export type AssessmentCycleType = (typeof CYCLE_TYPES)[number];
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

type FieldErrors = Record<string, string[]>;

type AssessmentRpcResult = {
  status?: "created" | "updated" | "generated" | "unavailable";
  assessment_id?: string;
  assessment_cycle_id?: string;
  generated_count?: number;
  community_id?: string | null;
  property_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  previous_amount_cents?: number | null;
  previous_paid_cents?: number | null;
  previous_balance_cents?: number | null;
  previous_status?: string | null;
};

export type AssessmentMutationResult =
  | { kind: "created"; id: string }
  | { kind: "updated"; id: string }
  | { kind: "generated"; count: number; cycleId: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: typeof INVALID_ASSESSMENT_INPUT_MESSAGE; fieldErrors: FieldErrors }
  | { kind: "assessment-unavailable"; message: typeof ASSESSMENT_UNAVAILABLE_MESSAGE };

export type CreateAssessmentCycleInput = {
  communityId: string;
  name: string;
  type: AssessmentCycleType;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  defaultAmountCents: number;
  currency?: "USD";
  lateFee?: Record<string, unknown> | null;
  interest?: Record<string, unknown> | null;
  reason?: string | null;
};

export type CreatePropertyAssessmentInput = {
  communityId: string;
  propertyId: string;
  assessmentCycleId?: string | null;
  type: AssessmentType;
  description: string;
  amountCents: number;
  dueDate: string;
  currency?: "USD";
  status?: "draft" | "open";
  reason?: string | null;
};

export type GeneratePropertyAssessmentsInput = {
  communityId: string;
  assessmentCycleId: string;
  reason?: string | null;
};

export type UpdateAssessmentInput = {
  communityId: string;
  assessmentId: string;
  description?: string | null;
  dueDate?: string | null;
  amountCents?: number | null;
  paidCents?: number | null;
  status?: AssessmentStatus | null;
  reason?: string | null;
};

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isDateOnly(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value);
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

function invalid(fieldErrors: FieldErrors): AssessmentMutationResult {
  return {
    kind: "invalid-input",
    message: INVALID_ASSESSMENT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): AssessmentMutationResult {
  return { kind: "assessment-unavailable", message: ASSESSMENT_UNAVAILABLE_MESSAGE };
}

function permissionResultToMutation(result: PermissionResult): AssessmentMutationResult | null {
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

async function requireAssessmentManagementPermission(communityId: string) {
  return hasPermission({
    communityId,
    permissionKey: ASSESSMENT_MANAGEMENT_PERMISSION,
  });
}

function validateCommunity(fieldErrors: FieldErrors, communityId: string) {
  if (!isUuid(communityId)) {
    fieldErrors.communityId = ["Community is required."];
  }
}

function validateCycleInput(input: CreateAssessmentCycleInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  validateCommunity(fieldErrors, input.communityId);

  if (!input.name.trim()) {
    fieldErrors.name = ["Name is required."];
  }

  if (!isIncluded(CYCLE_TYPES, input.type)) {
    fieldErrors.type = ["Assessment cycle type is not supported."];
  }

  if (!isDateOnly(input.periodStart)) {
    fieldErrors.periodStart = ["Period start must be a date."];
  }

  if (!isDateOnly(input.periodEnd)) {
    fieldErrors.periodEnd = ["Period end must be a date."];
  }

  if (isDateOnly(input.periodStart) && isDateOnly(input.periodEnd)) {
    if (input.periodEnd < input.periodStart) {
      fieldErrors.periodEnd = ["Period end must be on or after period start."];
    }
  }

  if (!isDateOnly(input.dueDate)) {
    fieldErrors.dueDate = ["Due date must be a date."];
  }

  if (!isPositiveInteger(input.defaultAmountCents)) {
    fieldErrors.defaultAmountCents = ["Default amount must be positive integer cents."];
  }

  if ((input.currency ?? "USD") !== "USD") {
    fieldErrors.currency = ["Currency must be USD."];
  }

  return fieldErrors;
}

function validatePropertyAssessmentInput(input: CreatePropertyAssessmentInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  validateCommunity(fieldErrors, input.communityId);

  if (!isUuid(input.propertyId)) {
    fieldErrors.propertyId = ["Property is required."];
  }

  if (input.assessmentCycleId && !isUuid(input.assessmentCycleId)) {
    fieldErrors.assessmentCycleId = ["Assessment cycle is invalid."];
  }

  if (!isIncluded(ASSESSMENT_TYPES, input.type)) {
    fieldErrors.type = ["Assessment type is not supported."];
  }

  if (!input.description.trim()) {
    fieldErrors.description = ["Description is required."];
  }

  if (!isNonNegativeInteger(input.amountCents)) {
    fieldErrors.amountCents = ["Amount must be integer cents."];
  }

  if (!isDateOnly(input.dueDate)) {
    fieldErrors.dueDate = ["Due date must be a date."];
  }

  if ((input.currency ?? "USD") !== "USD") {
    fieldErrors.currency = ["Currency must be USD."];
  }

  if (!isIncluded(CREATE_ASSESSMENT_STATUSES, input.status ?? "open")) {
    fieldErrors.status = ["Status is not supported for new assessments."];
  }

  return fieldErrors;
}

function validateGenerateInput(input: GeneratePropertyAssessmentsInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  validateCommunity(fieldErrors, input.communityId);

  if (!isUuid(input.assessmentCycleId)) {
    fieldErrors.assessmentCycleId = ["Assessment cycle is required."];
  }

  return fieldErrors;
}

function validateUpdateInput(input: UpdateAssessmentInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  validateCommunity(fieldErrors, input.communityId);

  if (!isUuid(input.assessmentId)) {
    fieldErrors.assessmentId = ["Assessment is required."];
  }

  if (input.description !== undefined && input.description !== null && !input.description.trim()) {
    fieldErrors.description = ["Description cannot be blank."];
  }

  if (input.dueDate !== undefined && input.dueDate !== null && !isDateOnly(input.dueDate)) {
    fieldErrors.dueDate = ["Due date must be a date."];
  }

  if (input.amountCents !== undefined && input.amountCents !== null) {
    if (!isNonNegativeInteger(input.amountCents)) {
      fieldErrors.amountCents = ["Amount must be integer cents."];
    }
  }

  if (input.paidCents !== undefined && input.paidCents !== null) {
    if (!isNonNegativeInteger(input.paidCents)) {
      fieldErrors.paidCents = ["Paid amount must be integer cents."];
    }
  }

  if (
    typeof input.amountCents === "number" &&
    typeof input.paidCents === "number" &&
    input.paidCents > input.amountCents
  ) {
    fieldErrors.paidCents = ["Paid amount cannot exceed amount."];
  }

  if (input.status !== undefined && input.status !== null) {
    if (!isIncluded(ASSESSMENT_STATUSES, input.status)) {
      fieldErrors.status = ["Status is not supported."];
    }
  }

  return fieldErrors;
}

async function auditAssessmentMutation(input: {
  action:
    | "assessment.cycle.create"
    | "assessment.create"
    | "assessment.generate"
    | "assessment.update";
  actorProfileId: string;
  communityId: string;
  targetType: "assessment_cycle" | "assessment";
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await writeAuditLog({
    action: input.action,
    actorProfileId: input.actorProfileId,
    communityId: input.communityId,
    targetType: input.targetType,
    targetId: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata,
  });
}

export async function createAssessmentCycle(
  input: CreateAssessmentCycleInput,
): Promise<AssessmentMutationResult> {
  const permission = await requireAssessmentManagementPermission(input.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission) ?? unavailable();
  }

  const fieldErrors = validateCycleInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_assessment_cycle", {
    target_community_id: input.communityId,
    cycle_name: input.name,
    cycle_type: input.type,
    cycle_period_start: input.periodStart,
    cycle_period_end: input.periodEnd,
    cycle_due_date: input.dueDate,
    cycle_default_amount_cents: input.defaultAmountCents,
    cycle_currency: input.currency ?? "USD",
    cycle_late_fee: input.lateFee ?? null,
    cycle_interest: input.interest ?? null,
  });
  const result = data as AssessmentRpcResult | null;

  if (error || result?.status !== "created" || !result.assessment_cycle_id) {
    return unavailable();
  }

  await auditAssessmentMutation({
    action: "assessment.cycle.create",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    targetType: "assessment_cycle",
    targetId: result.assessment_cycle_id,
    after: {
      name: input.name.trim(),
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueDate: input.dueDate,
      defaultAmountCents: input.defaultAmountCents,
      currency: input.currency ?? "USD",
    },
    reason: input.reason,
  });

  return { kind: "created", id: result.assessment_cycle_id };
}

export async function createPropertyAssessment(
  input: CreatePropertyAssessmentInput,
): Promise<AssessmentMutationResult> {
  const permission = await requireAssessmentManagementPermission(input.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission) ?? unavailable();
  }

  const fieldErrors = validatePropertyAssessmentInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_property_assessment", {
    target_community_id: input.communityId,
    target_property_id: input.propertyId,
    target_assessment_cycle_id: input.assessmentCycleId ?? null,
    assessment_type: input.type,
    assessment_description: input.description,
    assessment_amount_cents: input.amountCents,
    assessment_due_date: input.dueDate,
    assessment_currency: input.currency ?? "USD",
    assessment_status: input.status ?? "open",
  });
  const result = data as AssessmentRpcResult | null;

  if (error || result?.status !== "created" || !result.assessment_id) {
    return unavailable();
  }

  await auditAssessmentMutation({
    action: "assessment.create",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    targetType: "assessment",
    targetId: result.assessment_id,
    after: {
      propertyId: input.propertyId,
      assessmentCycleId: input.assessmentCycleId ?? null,
      type: input.type,
      description: input.description.trim(),
      amountCents: input.amountCents,
      paidCents: 0,
      balanceCents: input.amountCents,
      currency: input.currency ?? "USD",
      dueDate: input.dueDate,
      status: input.status ?? "open",
    },
    reason: input.reason,
  });

  return { kind: "created", id: result.assessment_id };
}

export async function generatePropertyAssessmentsForCycle(
  input: GeneratePropertyAssessmentsInput,
): Promise<AssessmentMutationResult> {
  const permission = await requireAssessmentManagementPermission(input.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission) ?? unavailable();
  }

  const fieldErrors = validateGenerateInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_property_assessments_for_cycle", {
    target_community_id: input.communityId,
    target_assessment_cycle_id: input.assessmentCycleId,
  });
  const result = data as AssessmentRpcResult | null;

  if (error || result?.status !== "generated") {
    return unavailable();
  }

  const count = result.generated_count ?? 0;

  await auditAssessmentMutation({
    action: "assessment.generate",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    targetType: "assessment_cycle",
    targetId: input.assessmentCycleId,
    after: {
      generatedCount: count,
    },
    reason: input.reason,
  });

  return { kind: "generated", count, cycleId: input.assessmentCycleId };
}

export async function updateAssessment(
  input: UpdateAssessmentInput,
): Promise<AssessmentMutationResult> {
  const permission = await requireAssessmentManagementPermission(input.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToMutation(permission) ?? unavailable();
  }

  const fieldErrors = validateUpdateInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_assessment", {
    target_community_id: input.communityId,
    target_assessment_id: input.assessmentId,
    assessment_description: input.description ?? null,
    assessment_due_date: input.dueDate ?? null,
    assessment_amount_cents: input.amountCents ?? null,
    assessment_paid_cents: input.paidCents ?? null,
    assessment_status: input.status ?? null,
  });
  const result = data as AssessmentRpcResult | null;

  if (error || result?.status !== "updated" || !result.assessment_id) {
    return unavailable();
  }

  await auditAssessmentMutation({
    action: "assessment.update",
    actorProfileId: permission.profile.id,
    communityId: result.community_id ?? input.communityId,
    targetType: "assessment",
    targetId: result.assessment_id,
    before: {
      amountCents: result.previous_amount_cents ?? null,
      paidCents: result.previous_paid_cents ?? null,
      balanceCents: result.previous_balance_cents ?? null,
      status: result.previous_status ?? null,
    },
    after: {
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      amountCents: input.amountCents ?? null,
      paidCents: input.paidCents ?? null,
      status: input.status ?? null,
    },
    reason: input.reason,
  });

  return { kind: "updated", id: result.assessment_id };
}
