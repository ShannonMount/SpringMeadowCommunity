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

  const [eventsResult, tasksResult] = await Promise.all([
    supabase
      .from("compliance_calendar_events")
      .select(
        "id, community_id, type, title, description, due_at, starts_at, status, priority, legal_sensitive, assigned_profile_ids, created_at, updated_at, completed_at",
      )
      .eq("community_id", community.communityId)
      .order("due_at", { ascending: true })
      .limit(50),
    supabase
      .from("compliance_tasks")
      .select(
        "id, community_id, compliance_event_id, title, description, type, status, due_at, assigned_to, evidence, created_at, updated_at, completed_at",
      )
      .eq("community_id", community.communityId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
  ]);

  if (eventsResult.error || tasksResult.error) {
    return { kind: "unavailable", message: "Compliance calendar is temporarily unavailable." };
  }

  const events = (eventsResult.data ?? []).map((row) => normalizeEvent(row as ComplianceEventRow));
  const tasks = (tasksResult.data ?? []).map((row) => normalizeTask(row as ComplianceTaskRow));

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
