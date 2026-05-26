import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import {
  hasPermission,
  PERMISSION_DENIED_MESSAGE,
} from "@/server/services/auth/permissions";
import { writeAuditLog } from "@/server/services/audit/write-audit-log";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const SETTINGS_ACCESS_PERMISSION = "admin.settings.manage";

export type AdminCommunitySettingsResult =
  | { kind: "settings"; communityId: string; communitySlug: string; settings: any }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: string }
  | { kind: "settings-unavailable"; message: string };

async function resolveCommunity(input: { communitySlug?: string | null }) {
  const communitySlug = (input.communitySlug || DEFAULT_COMMUNITY_SLUG).trim();

  if (!communitySlug) {
    return { kind: "invalid-input", message: "Community is required." } as const;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle();

  if (error || !data?.id) {
    return { kind: "settings-unavailable", message: "Settings unavailable." } as const;
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug } as const;
}

export async function getAdminCommunitySettings(input: { communitySlug?: string | null } = {}): Promise<AdminCommunitySettingsResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return { kind: "invalid-input", message: community.message };
  }

  if (community.kind !== "resolved") {
    return { kind: "settings-unavailable", message: "Settings could not be resolved." };
  }

  const permission = await hasPermission({ communityId: community.communityId, permissionKey: SETTINGS_ACCESS_PERMISSION });

  if (permission.kind !== "authorized") {
    if (permission.kind === "unauthenticated") return { kind: "unauthenticated" };
    if (permission.kind === "profile-unavailable") return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_community_settings", { target_community_slug: community.communitySlug });
  const result = data as any | null;

  if (error || !result) {
    return { kind: "settings-unavailable", message: "Failed to load settings." };
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status !== "ok") {
    return { kind: "settings-unavailable", message: "Settings unavailable." };
  }

  // enrich settings with community fiscal year fields
  const communityResp = await supabase
    .from("communities")
    .select("fiscal_year_start_month, fiscal_year_start_day, fiscal_year_end_month, fiscal_year_end_day")
    .eq("id", result.community_id)
    .maybeSingle();

  const communityRow = communityResp.data || null;

  const settings = { ...result.settings };

  if (communityRow) {
    settings.fiscal_year = {
      start_month: communityRow.fiscal_year_start_month,
      start_day: communityRow.fiscal_year_start_day,
      end_month: communityRow.fiscal_year_end_month,
      end_day: communityRow.fiscal_year_end_day,
    };
  }

  return {
    kind: "settings",
    communityId: result.community_id,
    communitySlug: result.community_slug || community.communitySlug,
    settings,
  };
}

export async function updateAdminCommunitySettings(input: {
  communitySlug?: string | null;
  payment?: Record<string, unknown> | null;
  compliance?: Record<string, unknown> | null;
  branding?: Record<string, unknown> | null;
  featureFlags?: Record<string, boolean> | null;
}) {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" } as const;
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE } as const;
  }

  const community = await resolveCommunity({ communitySlug: input.communitySlug });

  if (community.kind !== "resolved") {
    return { kind: "settings-unavailable", message: "Community not found." } as const;
  }

  const permission = await hasPermission({ communityId: community.communityId, permissionKey: SETTINGS_ACCESS_PERMISSION });

  if (permission.kind !== "authorized") {
    if (permission.kind === "unauthenticated") return { kind: "unauthenticated" } as const;
    if (permission.kind === "profile-unavailable") return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE } as const;
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE } as const;
  }

  const supabase = await createClient();
  // load a before snapshot for audit intent
  const { data: beforeRow } = await supabase
    .from("community_settings")
    .select(
      "community_id, fee_policy, allow_card, allow_ach, guest_payments_enabled, manual_payments_enabled, feature_flags, updated_at",
    )
    .eq("community_id", community.communityId)
    .maybeSingle();

  const { data, error } = await supabase.rpc("update_admin_community_settings", {
    target_community_slug: community.communitySlug,
    payment_settings: input.payment ?? null,
    compliance_settings: input.compliance ?? null,
    branding_settings: input.branding ?? null,
    feature_flags: input.featureFlags ?? null,
  });

  const result = data as any | null;

  if (error || !result) {
    return { kind: "settings-unavailable", message: "Failed to update settings." } as const;
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE } as const;
  }

  if (result.status !== "ok") {
    return { kind: "invalid-input", message: "Invalid input." } as const;
  }

  // record audit intent (best-effort)
  try {
    await writeAuditLog({
      action: "community.settings.update",
      actorProfileId: profileResult.profile.id,
      communityId: community.communityId,
      targetType: "community_settings",
      targetId: community.communityId,
      before: beforeRow ?? null,
      after: result.settings ?? null,
      reason: null,
    });
  } catch {
    // intentionally ignore audit failures
  }

  return {
    kind: "settings",
    communityId: result.community_id,
    communitySlug: result.community_slug || community.communitySlug,
    settings: result.settings,
  } as const;
}
