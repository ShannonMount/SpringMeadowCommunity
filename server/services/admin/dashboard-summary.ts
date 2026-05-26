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
const DASHBOARD_ACCESS_PERMISSION = "board.workspace.access";
const DASHBOARD_UNAVAILABLE_MESSAGE =
  "Dashboard summary is temporarily unavailable. Please try again later.";

type FieldErrors = Record<string, string[]>;

export type DashboardSectionState =
  | "available"
  | "empty"
  | "not_configured"
  | "permission_denied";

export type AdminDashboardSection = {
  state: DashboardSectionState;
};

export type AdminDashboardPropertySection = AdminDashboardSection & {
  activeCount: number;
  inactiveCount: number;
  dueSoonCount: number;
  overdueCount: number;
  delinquentCount: number;
  lienReviewCount: number;
  nextDueCount: number;
  overdueAssessmentCount: number;
};

export type AdminDashboardPaymentSection = AdminDashboardSection & {
  pendingCount: number;
  failedCount: number;
  succeededLast30DaysCount: number;
  succeededLast30DaysAmountCents: number;
  offlinePendingCount: number;
};

export type AdminDashboardDocumentSection = AdminDashboardSection & {
  activeCount: number;
  expiringSoonCount: number;
  restrictedCount: number;
  recentUploadCount: number;
};

export type AdminDashboardMessageSection = AdminDashboardSection & {
  openCount: number;
  pendingBoardCount: number;
  pendingResidentCount: number;
  unassignedCount: number;
  oldestOpenAt: string | null;
};

export type AdminDashboardComplianceSection = AdminDashboardSection & {
  upcomingCount: number;
  overdueCount: number;
};

export type AdminDashboardSummary = {
  communityId: string;
  communitySlug: string;
  generatedAt: string;
  sections: {
    properties: AdminDashboardPropertySection;
    payments: AdminDashboardPaymentSection;
    documents: AdminDashboardDocumentSection;
    messages: AdminDashboardMessageSection;
    compliance: AdminDashboardComplianceSection;
  };
};

export type AdminDashboardSummaryResult =
  | { kind: "dashboard"; dashboard: AdminDashboardSummary }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof DASHBOARD_UNAVAILABLE_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "dashboard-unavailable"; message: typeof DASHBOARD_UNAVAILABLE_MESSAGE };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "dashboard-unavailable"; message: typeof DASHBOARD_UNAVAILABLE_MESSAGE };

type RpcSection = {
  state?: string | null;
  [key: string]: unknown;
};

type DashboardRpcResult = {
  status?: "ok" | "permission_denied" | "unavailable" | "invalid";
  community_id?: string | null;
  community_slug?: string | null;
  generated_at?: string | null;
  sections?: {
    properties?: RpcSection | null;
    payments?: RpcSection | null;
    documents?: RpcSection | null;
    messages?: RpcSection | null;
    compliance?: RpcSection | null;
  } | null;
};

function safeString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function invalid(fieldErrors: FieldErrors): AdminDashboardSummaryResult {
  return {
    kind: "invalid-input",
    message: DASHBOARD_UNAVAILABLE_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AdminDashboardSummaryResult, { kind: "dashboard-unavailable" }> {
  return { kind: "dashboard-unavailable", message: DASHBOARD_UNAVAILABLE_MESSAGE };
}

function permissionResultToDashboard(
  result: PermissionResult,
): AdminDashboardSummaryResult | null {
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

async function resolveCommunity(input: {
  communitySlug?: string | null;
}): Promise<CommunityResolution> {
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;

  if (!communitySlug) {
    return { kind: "invalid-input", fieldErrors: { communitySlug: ["Community is required."] } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return unavailable();
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

function asState(value: unknown): DashboardSectionState {
  if (
    value === "available" ||
    value === "empty" ||
    value === "not_configured" ||
    value === "permission_denied"
  ) {
    return value;
  }

  return "empty";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asPropertySection(section: RpcSection | null | undefined): AdminDashboardPropertySection {
  return {
    state: asState(section?.state),
    activeCount: asNumber(section?.active_count),
    inactiveCount: asNumber(section?.inactive_count),
    dueSoonCount: asNumber(section?.due_soon_count),
    overdueCount: asNumber(section?.overdue_count),
    delinquentCount: asNumber(section?.delinquent_count),
    lienReviewCount: asNumber(section?.lien_review_count),
    nextDueCount: asNumber(section?.next_due_count),
    overdueAssessmentCount: asNumber(section?.overdue_assessment_count),
  };
}

function asPaymentSection(section: RpcSection | null | undefined): AdminDashboardPaymentSection {
  return {
    state: asState(section?.state),
    pendingCount: asNumber(section?.pending_count),
    failedCount: asNumber(section?.failed_count),
    succeededLast30DaysCount: asNumber(section?.succeeded_last_30_days_count),
    succeededLast30DaysAmountCents: asNumber(section?.succeeded_last_30_days_amount_cents),
    offlinePendingCount: asNumber(section?.offline_pending_count),
  };
}

function asDocumentSection(section: RpcSection | null | undefined): AdminDashboardDocumentSection {
  return {
    state: asState(section?.state),
    activeCount: asNumber(section?.active_count),
    expiringSoonCount: asNumber(section?.expiring_soon_count),
    restrictedCount: asNumber(section?.restricted_count),
    recentUploadCount: asNumber(section?.recent_upload_count),
  };
}

function asMessageSection(section: RpcSection | null | undefined): AdminDashboardMessageSection {
  return {
    state: asState(section?.state),
    openCount: asNumber(section?.open_count),
    pendingBoardCount: asNumber(section?.pending_board_count),
    pendingResidentCount: asNumber(section?.pending_resident_count),
    unassignedCount: asNumber(section?.unassigned_count),
    oldestOpenAt: asNullableString(section?.oldest_open_at),
  };
}

function asComplianceSection(
  section: RpcSection | null | undefined,
): AdminDashboardComplianceSection {
  return {
    state: asState(section?.state ?? "not_configured"),
    upcomingCount: asNumber(section?.upcoming_count),
    overdueCount: asNumber(section?.overdue_count),
  };
}

function asDashboardSummary(result: DashboardRpcResult): AdminDashboardSummary | null {
  if (!result.community_id || !result.community_slug || !result.generated_at) {
    return null;
  }

  return {
    communityId: result.community_id,
    communitySlug: result.community_slug,
    generatedAt: result.generated_at,
    sections: {
      properties: asPropertySection(result.sections?.properties),
      payments: asPaymentSection(result.sections?.payments),
      documents: asDocumentSection(result.sections?.documents),
      messages: asMessageSection(result.sections?.messages),
      compliance: asComplianceSection(result.sections?.compliance),
    },
  };
}

export async function getAdminDashboardSummary(input: {
  communitySlug?: string | null;
} = {}): Promise<AdminDashboardSummaryResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const permission = await hasPermission({
    communityId: community.communityId,
    permissionKey: DASHBOARD_ACCESS_PERMISSION,
  });

  if (permission.kind !== "authorized") {
    return permissionResultToDashboard(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_dashboard_summary", {
    target_community_slug: community.communitySlug,
  });
  const result = data as DashboardRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Dashboard request is invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  const dashboard = asDashboardSummary(result);

  if (!dashboard) {
    return unavailable();
  }

  return { kind: "dashboard", dashboard };
}
