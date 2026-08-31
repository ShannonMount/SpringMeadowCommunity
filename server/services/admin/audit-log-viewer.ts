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
export const AUDIT_LOGS_ACCESS_PERMISSION = "audit.logs.view";

export type AuditLogEntry = {
  id: string;
  actorProfileId: string | null;
  actorType: "user" | "system" | "webhook" | "job";
  action: string;
  targetTable: string;
  targetId: string | null;
  requestId: string | null;
  reason: string | null;
  createdAt: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type AuditLogViewerResult =
  | {
      kind: "audit-logs";
      communityId: string;
      communitySlug: string;
      entries: AuditLogEntry[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "audit-unavailable"; message: string };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "audit-unavailable"; message: string };

type AuditLogRow = {
  id?: string | null;
  community_id?: string | null;
  actor_profile_id?: string | null;
  actor_type?: string | null;
  action?: string | null;
  target_table?: string | null;
  target_id?: string | null;
  request_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeAuditLogRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id ?? "",
    actorProfileId: row.actor_profile_id ?? null,
    actorType: (row.actor_type as AuditLogEntry["actorType"]) ?? "user",
    action: row.action ?? "unknown",
    targetTable: row.target_table ?? "unknown",
    targetId: row.target_id ?? null,
    requestId: row.request_id ?? null,
    reason: row.reason ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    beforeData: row.before_data ?? null,
    afterData: row.after_data ?? null,
    metadata: row.metadata ?? null,
  };
}

async function resolveCommunity(input: { communitySlug?: string | null }): Promise<CommunityResolution> {
  const communitySlug = (input.communitySlug || DEFAULT_COMMUNITY_SLUG).trim();

  if (!communitySlug) {
    return { kind: "audit-unavailable", message: "Community is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return { kind: "audit-unavailable", message: "Audit logs are unavailable." };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

function permissionResultToAuditLogs(
  result: PermissionResult,
): AuditLogViewerResult | null {
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

export async function listAuditLogs(
  input: { communitySlug?: string | null } = {},
): Promise<AuditLogViewerResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const community = await resolveCommunity(input);

  if (community.kind !== "resolved") {
    return community;
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: AUDIT_LOGS_ACCESS_PERMISSION,
  });

  const permissionResult = permissionResultToAuditLogs(permission);

  if (permissionResult) {
    return permissionResult;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, community_id, actor_profile_id, actor_type, action, target_table, target_id, request_id, reason, created_at, before_data, after_data, metadata",
    )
    .eq("community_id", community.communityId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { kind: "audit-unavailable", message: "Audit logs could not be loaded." };
  }

  const entries = (data ?? []).map((row) => normalizeAuditLogRow(row as AuditLogRow));

  return {
    kind: "audit-logs",
    communityId: community.communityId,
    communitySlug: community.communitySlug,
    entries,
  };
}
