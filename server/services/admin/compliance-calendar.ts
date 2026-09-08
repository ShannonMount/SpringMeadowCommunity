import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import {
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
  type PermissionResult,
} from "@/server/services/auth/permissions";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
export const COMPLIANCE_CALENDAR_ACCESS_PERMISSION = "admin.compliance.manage";
export const LEGAL_WORKFLOW_REVIEW_PERMISSION = "legal.workflow.review";

export type ComplianceStatus =
  | "upcoming"
  | "in_progress"
  | "ready_for_review"
  | "completed"
  | "blocked"
  | "deferred"
  | "overdue"
  | "legal_review_required";

export type ComplianceTaskStatus = "todo" | "in_progress" | "done" | "blocked" | "deferred";

export type ComplianceEvent = {
  id: string;
  communityId: string;
  type: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  startsAt: string | null;
  status: ComplianceStatus;
  priority: "low" | "normal" | "high" | "critical";
  legalSensitive: boolean;
  assignedProfileIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ComplianceTask = {
  id: string;
  communityId: string;
  complianceEventId: string;
  title: string;
  description: string | null;
  type: string;
  status: ComplianceTaskStatus;
  dueAt: string | null;
  assignedTo: string | null;
  evidence: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ComplianceCalendarSummary = {
  communityId: string;
  communitySlug: string;
  generatedAt: string;
  upcomingCount: number;
  overdueCount: number;
  reviewRequiredCount: number;
  events: ComplianceEvent[];
  tasks: ComplianceTask[];
};

export type ComplianceCalendarResult =
  | { kind: "calendar"; calendar: ComplianceCalendarSummary }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: string }
  | { kind: "unavailable"; message: string };

export type ComplianceEventInput = {
  communitySlug?: string | null;
  eventId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  dueAt: string | null;
  startsAt?: string | null;
  relatedPropertyId?: string | null;
  relatedMeetingId?: string | null;
  relatedRecordsRequestId?: string | null;
  relatedAssessmentId?: string | null;
  relatedLienCaseId?: string | null;
  relatedFineCaseId?: string | null;
  priority?: string | null;
  legalSensitive?: boolean | null;
  assignedProfileIds?: string[] | null;
  status?: string | null;
};

export type ComplianceTaskInput = {
  taskId?: string | null;
  complianceEventId: string;
  title: string;
  description?: string | null;
  type: string;
  status?: string | null;
  dueAt?: string | null;
  assignedTo?: string | null;
  evidence?: Record<string, unknown>[] | null;
};

export type ComplianceMutationResult =
  | { kind: "created" | "updated" | "completed"; record: ComplianceEvent | ComplianceTask }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: string }
  | { kind: "unavailable"; message: string };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "unavailable"; message: string };

type ComplianceEventRow = {
  id?: string | null;
  community_id?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  due_at?: string | null;
  starts_at?: string | null;
  status?: string | null;
  priority?: string | null;
  legal_sensitive?: boolean | null;
  assigned_profile_ids?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

type ComplianceTaskRow = {
  id?: string | null;
  community_id?: string | null;
  compliance_event_id?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  due_at?: string | null;
  assigned_to?: string | null;
  evidence?: Record<string, unknown>[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

type ComplianceRpcResult = {
  status?: "ok" | "created" | "updated" | "completed" | "permission_denied" | "invalid" | "unavailable";
  community_id?: string | null;
  events?: ComplianceEventRow[] | null;
  tasks?: ComplianceTaskRow[] | null;
  record?: ComplianceEventRow | ComplianceTaskRow | null;
};

function normalizeEvent(row: ComplianceEventRow): ComplianceEvent {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    type: row.type ?? "custom",
    title: row.title ?? "Untitled compliance event",
    description: row.description ?? null,
    dueAt: row.due_at ?? null,
    startsAt: row.starts_at ?? null,
    status: (row.status as ComplianceStatus) ?? "upcoming",
    priority: (row.priority as ComplianceEvent["priority"]) ?? "normal",
    legalSensitive: row.legal_sensitive ?? false,
    assignedProfileIds: Array.isArray(row.assigned_profile_ids) ? row.assigned_profile_ids : [],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    completedAt: row.completed_at ?? null,
  };
}

function normalizeTask(row: ComplianceTaskRow): ComplianceTask {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    complianceEventId: row.compliance_event_id ?? "",
    title: row.title ?? "Untitled task",
    description: row.description ?? null,
    type: row.type ?? "custom",
    status: (row.status as ComplianceTaskStatus) ?? "todo",
    dueAt: row.due_at ?? null,
    assignedTo: row.assigned_to ?? null,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    completedAt: row.completed_at ?? null,
  };
}

async function resolveCommunity(input: { communitySlug?: string | null }): Promise<CommunityResolution> {
  const communitySlug = (input.communitySlug || DEFAULT_COMMUNITY_SLUG).trim();

  if (!communitySlug) {
    return { kind: "unavailable", message: "Community is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

function permissionResultToCalendar(result: PermissionResult): ComplianceCalendarResult | null {
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

async function hasComplianceAccess(communityId: string): Promise<PermissionResult> {
  const permissionChecks = [
    hasPermission({ communityId, permissionKey: COMPLIANCE_CALENDAR_ACCESS_PERMISSION }),
    hasPermission({ communityId, permissionKey: LEGAL_WORKFLOW_REVIEW_PERMISSION }),
  ];

  let denied: PermissionResult | null = null;

  for (const permission of await Promise.all(permissionChecks)) {
    if (permission.kind === "authorized") {
      return permission;
    }

    if (permission.kind === "unauthenticated") {
      return permission;
    }

    if (permission.kind === "profile-unavailable") {
      return permission;
    }

    if (!denied) {
      denied = permission;
    }
  }

  return denied ?? { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
}

export async function listComplianceCalendar(
  input: { communitySlug?: string | null } = {},
): Promise<ComplianceCalendarResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const community = await resolveCommunity(input);

  if (community.kind !== "resolved") {
    return { kind: "unavailable", message: community.message };
  }

  const permission = await hasComplianceAccess(community.communityId);
  const permissionResult = permissionResultToCalendar(permission);

  if (permissionResult) {
    return permissionResult;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_compliance_calendar", {
    target_community_slug: community.communitySlug,
  });
  const result = data as ComplianceRpcResult | null;

  if (error || !result) {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status !== "ok") {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  const events = (result.events ?? []).map(normalizeEvent);
  const tasks = (result.tasks ?? []).map(normalizeTask);

  const now = Date.now();
  const upcomingCount = events.filter((event) => event.status === "upcoming" || event.status === "in_progress").length;
  const overdueCount = events.filter((event) => {
    if (event.status === "overdue") return true;
    if (!event.dueAt) return false;
    return Date.parse(event.dueAt) < now;
  }).length;
  const reviewRequiredCount = events.filter((event) => event.status === "legal_review_required").length;

  return {
    kind: "calendar",
    calendar: {
      communityId: community.communityId,
      communitySlug: community.communitySlug,
      generatedAt: new Date().toISOString(),
      upcomingCount,
      overdueCount,
      reviewRequiredCount,
      events,
      tasks,
    },
  };
}

function mutationProfileResult(
  kind: "unauthenticated" | string,
): ComplianceMutationResult {
  return kind === "unauthenticated"
    ? { kind }
    : { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
}

function normalizeMutationRecord(record: ComplianceEventRow | ComplianceTaskRow | null | undefined) {
  if (!record) return null;
  return "compliance_event_id" in record ? normalizeTask(record as ComplianceTaskRow) : normalizeEvent(record as ComplianceEventRow);
}

function mutationRpcResult(
  data: unknown,
  error: unknown,
  expected: "created" | "updated" | "completed",
): ComplianceMutationResult {
  if (error || !data) {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  const result = data as ComplianceRpcResult;

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return { kind: "invalid-input", message: "Please check the compliance record details and try again." };
  }

  const record = normalizeMutationRecord(result.record);

  if (result.status !== expected || !record) {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  return { kind: expected, record };
}

export async function createComplianceEvent(input: ComplianceEventInput): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  if (!input.title.trim() || !input.dueAt) {
    return { kind: "invalid-input", message: "A title and due date are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_compliance_event", {
    target_community_slug: input.communitySlug || DEFAULT_COMMUNITY_SLUG,
    event_type: input.type,
    event_title: input.title,
    event_description: input.description || null,
    event_due_at: input.dueAt,
    event_starts_at: input.startsAt || null,
    event_related_property_id: input.relatedPropertyId || null,
    event_related_meeting_id: input.relatedMeetingId || null,
    event_related_records_request_id: input.relatedRecordsRequestId || null,
    event_related_assessment_id: input.relatedAssessmentId || null,
    event_related_lien_case_id: input.relatedLienCaseId || null,
    event_related_fine_case_id: input.relatedFineCaseId || null,
    event_priority: input.priority || "normal",
    event_legal_sensitive: input.legalSensitive ?? false,
    event_assigned_profile_ids: input.assignedProfileIds || [],
    event_status: input.status || "upcoming",
  });

  return mutationRpcResult(data, error, "created");
}

export async function updateComplianceEvent(input: ComplianceEventInput): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  if (!input.eventId || !input.title.trim() || !input.dueAt) {
    return { kind: "invalid-input", message: "An event, title, and due date are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_compliance_event", {
    target_event_id: input.eventId,
    event_type: input.type,
    event_title: input.title,
    event_description: input.description || null,
    event_due_at: input.dueAt,
    event_starts_at: input.startsAt || null,
    event_related_property_id: input.relatedPropertyId || null,
    event_related_meeting_id: input.relatedMeetingId || null,
    event_related_records_request_id: input.relatedRecordsRequestId || null,
    event_related_assessment_id: input.relatedAssessmentId || null,
    event_related_lien_case_id: input.relatedLienCaseId || null,
    event_related_fine_case_id: input.relatedFineCaseId || null,
    event_priority: input.priority || "normal",
    event_legal_sensitive: input.legalSensitive ?? false,
    event_assigned_profile_ids: input.assignedProfileIds || [],
    event_status: input.status || "upcoming",
  });

  return mutationRpcResult(data, error, "updated");
}

export async function completeComplianceEvent(eventId: string): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_compliance_event", { target_event_id: eventId });
  return mutationRpcResult(data, error, "completed");
}

export async function createComplianceTask(input: ComplianceTaskInput): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  if (!input.complianceEventId || !input.title.trim()) {
    return { kind: "invalid-input", message: "An event and task title are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_compliance_task", {
    target_event_id: input.complianceEventId,
    task_title: input.title,
    task_description: input.description || null,
    task_type: input.type,
    task_status: input.status || "todo",
    task_due_at: input.dueAt || null,
    task_assigned_to: input.assignedTo || null,
    task_evidence: input.evidence || [],
  });

  return mutationRpcResult(data, error, "created");
}

export async function updateComplianceTask(input: ComplianceTaskInput): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  if (!input.taskId || !input.title.trim()) {
    return { kind: "invalid-input", message: "A task and task title are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_compliance_task", {
    target_task_id: input.taskId,
    task_title: input.title,
    task_description: input.description || null,
    task_type: input.type,
    task_status: input.status || "todo",
    task_due_at: input.dueAt || null,
    task_assigned_to: input.assignedTo || null,
    task_evidence: input.evidence || [],
  });

  return mutationRpcResult(data, error, "updated");
}

export async function completeComplianceTask(taskId: string): Promise<ComplianceMutationResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return mutationProfileResult(profileResult.kind);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_compliance_task", { target_task_id: taskId });
  return mutationRpcResult(data, error, "completed");
}
