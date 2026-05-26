import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AuditLogIntent = {
  action: string;
  actorProfileId?: string | null;
  actorType?: "user" | "system" | "webhook" | "job";
  communityId: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

export async function writeAuditLog(intent: AuditLogIntent) {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return { kind: "skipped" as const };
  }

  const afterData = intent.metadata
    ? { ...(intent.after ?? {}), metadata: intent.metadata }
    : intent.after ?? null;

  const { error: insertError } = await supabase.from("audit_logs").insert({
    community_id: intent.communityId,
    actor_profile_id: intent.actorProfileId ?? null,
    actor_type: intent.actorType ?? "user",
    action: intent.action,
    target_table: intent.targetType,
    target_id: intent.targetId ?? null,
    before_data: intent.before ?? null,
    after_data: afterData,
    request_id: intent.requestId ?? null,
    reason: intent.reason ?? null,
  });

  if (insertError) {
    return { kind: "skipped" as const };
  }

  return { kind: "recorded" as const };
}
