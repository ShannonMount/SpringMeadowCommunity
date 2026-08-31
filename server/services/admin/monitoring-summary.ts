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
const WORKSPACE_ACCESS_PERMISSION = "board.workspace.access";

export type MonitoringFailureItem = {
  kind: "webhook" | "email" | "job";
  status: string;
  occurredAt: string | null;
  summary: string | null;
};

export type AdminMonitoringSummary = {
  communityId: string;
  communitySlug: string;
  generatedAt: string;
  webhooks: {
    receivedCount: number;
    processedCount: number;
    failedCount: number;
    ignoredCount: number;
    lastFailureAt: string | null;
    lastFailureSummary: string | null;
  };
  emails: {
    queuedCount: number;
    sentCount: number;
    deliveredCount: number;
    bouncedCount: number;
    failedCount: number;
    suppressedCount: number;
    lastFailureAt: string | null;
    lastFailureSummary: string | null;
  };
  jobs: {
    failedCount: number;
    lastFailureAt: string | null;
    lastFailureSummary: string | null;
    recentFailures: MonitoringFailureItem[];
  };
};

export type AdminMonitoringSummaryResult =
  | { kind: "monitoring"; monitoring: AdminMonitoringSummary }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "unavailable"; message: string };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "unavailable"; message: string };

function normalizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function sanitizeFailureSummary(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/https?:\/\/[^\s]+/g, "[link]")
    .replace(/\b(?:sk|whsec)_[A-Za-z0-9]+/gi, "[redacted]")
    .replace(/\b(?:api[_ -]?key|token|credential|auth)\b[^\n\r]*/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
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
    return { kind: "unavailable", message: "Monitoring is temporarily unavailable." };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

function permissionResultToMonitoring(result: PermissionResult): AdminMonitoringSummaryResult | null {
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

export async function getAdminMonitoringSummary(
  input: { communitySlug?: string | null } = {},
): Promise<AdminMonitoringSummaryResult> {
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

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: WORKSPACE_ACCESS_PERMISSION,
  });

  const permissionResult = permissionResultToMonitoring(permission);

  if (permissionResult) {
    return permissionResult;
  }

  const supabase = await createClient();

  const [
    { data: webhookData, error: webhookError },
    { data: emailData, error: emailError },
    { data: recentWebhookFailuresData, error: recentWebhookFailuresError },
    { data: recentEmailFailuresData, error: recentEmailFailuresError },
  ] = await Promise.all([
    supabase
      .from("payment_events")
      .select("processing_status, received_at, error")
      .eq("community_id", community.communityId)
      .order("received_at", { ascending: false }),
    supabase
      .from("email_logs")
      .select("status, created_at, error")
      .eq("community_id", community.communityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_events")
      .select("processing_status, received_at, error")
      .eq("community_id", community.communityId)
      .in("processing_status", ["failed", "ignored"])
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("email_logs")
      .select("status, created_at, error")
      .eq("community_id", community.communityId)
      .in("status", ["failed", "bounced", "suppressed"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (webhookError || emailError || recentWebhookFailuresError || recentEmailFailuresError) {
    return { kind: "unavailable", message: "Monitoring summary is temporarily unavailable." };
  }

  const webhookSummary = (webhookData ?? []).reduce(
    (acc, row) => {
      const status = String(row?.processing_status ?? "received");
      if (status === "processed") acc.processedCount += 1;
      if (status === "failed") acc.failedCount += 1;
      if (status === "ignored") acc.ignoredCount += 1;
      if (status === "received") acc.receivedCount += 1;
      return acc;
    },
    { receivedCount: 0, processedCount: 0, failedCount: 0, ignoredCount: 0 },
  );

  const emailSummary = (emailData ?? []).reduce(
    (acc, row) => {
      const status = String(row?.status ?? "queued");
      if (status === "queued") acc.queuedCount += 1;
      if (status === "sent") acc.sentCount += 1;
      if (status === "delivered") acc.deliveredCount += 1;
      if (status === "bounced") acc.bouncedCount += 1;
      if (status === "failed") acc.failedCount += 1;
      if (status === "suppressed") acc.suppressedCount += 1;
      return acc;
    },
    { queuedCount: 0, sentCount: 0, deliveredCount: 0, bouncedCount: 0, failedCount: 0, suppressedCount: 0 },
  );

  const latestWebhookFailure = (recentWebhookFailuresData ?? []).find((row) => row?.processing_status === "failed") ?? (recentWebhookFailuresData ?? [])[0] ?? null;
  const latestEmailFailure = (recentEmailFailuresData ?? []).find((row) => row?.status === "failed") ?? (recentEmailFailuresData ?? [])[0] ?? null;

  const recentFailures: MonitoringFailureItem[] = [
    ...(recentWebhookFailuresData ?? []).map((row) => ({
      kind: "webhook" as const,
      status: String(row?.processing_status ?? "failed"),
      occurredAt: normalizeString(row?.received_at ?? null),
      summary: sanitizeFailureSummary(row?.error ?? null),
    })),
    ...(recentEmailFailuresData ?? []).map((row) => ({
      kind: "email" as const,
      status: String(row?.status ?? "failed"),
      occurredAt: normalizeString(row?.created_at ?? null),
      summary: sanitizeFailureSummary(row?.error ?? null),
    })),
  ]
    .sort((a, b) => {
      const aTime = a.occurredAt ? Date.parse(a.occurredAt) : 0;
      const bTime = b.occurredAt ? Date.parse(b.occurredAt) : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const jobFailureSummary = recentFailures.find((item) => item.kind === "email" || item.kind === "webhook") ?? null;

  return {
    kind: "monitoring",
    monitoring: {
      communityId: community.communityId,
      communitySlug: community.communitySlug,
      generatedAt: new Date().toISOString(),
      webhooks: {
        receivedCount: normalizeNumber(webhookSummary.receivedCount),
        processedCount: normalizeNumber(webhookSummary.processedCount),
        failedCount: normalizeNumber(webhookSummary.failedCount),
        ignoredCount: normalizeNumber(webhookSummary.ignoredCount),
        lastFailureAt: normalizeString(latestWebhookFailure?.received_at ?? null),
        lastFailureSummary: sanitizeFailureSummary(latestWebhookFailure?.error ?? null),
      },
      emails: {
        queuedCount: normalizeNumber(emailSummary.queuedCount),
        sentCount: normalizeNumber(emailSummary.sentCount),
        deliveredCount: normalizeNumber(emailSummary.deliveredCount),
        bouncedCount: normalizeNumber(emailSummary.bouncedCount),
        failedCount: normalizeNumber(emailSummary.failedCount),
        suppressedCount: normalizeNumber(emailSummary.suppressedCount),
        lastFailureAt: normalizeString(latestEmailFailure?.created_at ?? null),
        lastFailureSummary: sanitizeFailureSummary(latestEmailFailure?.error ?? null),
      },
      jobs: {
        failedCount: normalizeNumber(emailSummary.failedCount + webhookSummary.failedCount),
        lastFailureAt: normalizeString(jobFailureSummary?.occurredAt ?? null),
        lastFailureSummary: jobFailureSummary?.summary ?? null,
        recentFailures,
      },
    },
  };
}
