"use server";

import { redirect } from "next/navigation";
import { updateAdminCommunitySettings } from "@/server/services/admin/community-settings";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const FEE_POLICY_VALUES = ["payer_pays", "hoa_pays", "configurable"] as const;
const FEATURE_FLAG_ALLOWLIST = new Set([
  "community_posts",
  "maintenance_requests",
  "architectural_requests",
  "vendor_proposals",
  "vendor_invoices",
  "pool_maintenance",
  "financial_approvals",
  "multi_hoa_mode",
]);

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBooleanCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export async function updateAdminSettings(formData: FormData) {
  const communitySlug = stringValue(formData.get("communitySlug")) || DEFAULT_COMMUNITY_SLUG;

  // Parse payment settings
  const feePolicy = stringValue(formData.get("feePolicy")) || undefined;
  const allowCard = parseBooleanCheckbox(formData.get("allowCard"));
  const allowAch = parseBooleanCheckbox(formData.get("allowAch"));
  const guestPaymentsEnabled = parseBooleanCheckbox(formData.get("guestPaymentsEnabled"));
  const manualPaymentsEnabled = parseBooleanCheckbox(formData.get("manualPaymentsEnabled"));

  // Parse branding
  const publicDisplayName = stringValue(formData.get("publicDisplayName")) || undefined;
  const logoUrl = stringValue(formData.get("logoUrl")) || undefined;
  const primaryColor = stringValue(formData.get("primaryColor")) || undefined;
  const secondaryColor = stringValue(formData.get("secondaryColor")) || undefined;

  // Parse feature flags - only allow-listed keys
  const featureFlags: Record<string, boolean> = {};

  for (const key of FEATURE_FLAG_ALLOWLIST) {
    featureFlags[key] = parseBooleanCheckbox(formData.get(`feature_${key}`));
  }

  // Basic validation
  if (feePolicy && !FEE_POLICY_VALUES.includes(feePolicy as any)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "feePolicy" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (publicDisplayName && publicDisplayName.length > 200) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "publicDisplayName" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (logoUrl && !/^https:\/\//.test(logoUrl) && logoUrl !== "") {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "logoUrl" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (primaryColor && !isHexColor(primaryColor)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "primaryColor" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (secondaryColor && !isHexColor(secondaryColor)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "secondaryColor" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  // Parse compliance defaults
  const delinquentDaysPastDueRaw = stringValue(formData.get("delinquentDaysPastDue"));
  const messageNotificationsEnabled = parseBooleanCheckbox(formData.get("messageNotificationsEnabled"));
  const messageRetentionDaysRaw = stringValue(formData.get("messageRetentionDays"));

  const meetingNoticeEarliestRaw = stringValue(formData.get("meetingNoticeEarliestDays"));
  const meetingNoticeLatestRaw = stringValue(formData.get("meetingNoticeLatestDays"));

  const delinquentDaysPastDue = delinquentDaysPastDueRaw ? Number(delinquentDaysPastDueRaw) : undefined;
  const messageRetentionDays = messageRetentionDaysRaw ? Number(messageRetentionDaysRaw) : undefined;
  const meetingNoticeEarliestDays = meetingNoticeEarliestRaw ? Number(meetingNoticeEarliestRaw) : undefined;
  const meetingNoticeLatestDays = meetingNoticeLatestRaw ? Number(meetingNoticeLatestRaw) : undefined;

  // Parse fiscal year fields
  const fiscalYearStartMonthRaw = stringValue(formData.get("fiscalYearStartMonth"));
  const fiscalYearStartDayRaw = stringValue(formData.get("fiscalYearStartDay"));
  const fiscalYearEndMonthRaw = stringValue(formData.get("fiscalYearEndMonth"));
  const fiscalYearEndDayRaw = stringValue(formData.get("fiscalYearEndDay"));

  const fiscalYearStartMonth = fiscalYearStartMonthRaw ? Number(fiscalYearStartMonthRaw) : undefined;
  const fiscalYearStartDay = fiscalYearStartDayRaw ? Number(fiscalYearStartDayRaw) : undefined;
  const fiscalYearEndMonth = fiscalYearEndMonthRaw ? Number(fiscalYearEndMonthRaw) : undefined;
  const fiscalYearEndDay = fiscalYearEndDayRaw ? Number(fiscalYearEndDayRaw) : undefined;

  // Compliance validations
  if (delinquentDaysPastDue !== undefined && (!Number.isInteger(delinquentDaysPastDue) || delinquentDaysPastDue < 1)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "delinquentDaysPastDue" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (messageRetentionDays !== undefined && (!Number.isInteger(messageRetentionDays) || messageRetentionDays < 0)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "messageRetentionDays" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (meetingNoticeEarliestDays !== undefined && (!Number.isInteger(meetingNoticeEarliestDays) || meetingNoticeEarliestDays < 0)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "meetingNoticeEarliestDays" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (meetingNoticeLatestDays !== undefined && (!Number.isInteger(meetingNoticeLatestDays) || meetingNoticeLatestDays < 0)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "meetingNoticeLatestDays" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  // Fiscal validations
  const monthValid = (m: number | undefined) => m === undefined || (Number.isInteger(m) && m >= 1 && m <= 12);
  const dayValid = (d: number | undefined) => d === undefined || (Number.isInteger(d) && d >= 1 && d <= 31);

  if (!monthValid(fiscalYearStartMonth)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "fiscalYearStartMonth" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (!dayValid(fiscalYearStartDay)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "fiscalYearStartDay" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (!monthValid(fiscalYearEndMonth)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "fiscalYearEndMonth" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  if (!dayValid(fiscalYearEndDay)) {
    const params = new URLSearchParams({ settingsAction: "invalid", settingsActionField: "fiscalYearEndDay" });
    redirect(`/admin/settings?${params.toString()}`);
  }

  // Call service
  const result = await updateAdminCommunitySettings({
    communitySlug,
    payment: {
      feePolicy: feePolicy || undefined,
      allowCard,
      allowAch,
      guestPaymentsEnabled,
      manualPaymentsEnabled,
    },
    compliance: {
      delinquentDaysPastDue: delinquentDaysPastDue ?? undefined,
      messageNotificationsEnabled,
      messageRetentionDays: messageRetentionDays ?? undefined,
      meetingNoticeEarliestDays: meetingNoticeEarliestDays ?? undefined,
      meetingNoticeLatestDays: meetingNoticeLatestDays ?? undefined,
      fiscalYearStartMonth: fiscalYearStartMonth ?? undefined,
      fiscalYearStartDay: fiscalYearStartDay ?? undefined,
      fiscalYearEndMonth: fiscalYearEndMonth ?? undefined,
      fiscalYearEndDay: fiscalYearEndDay ?? undefined,
    },
    branding: {
      publicDisplayName: publicDisplayName || undefined,
      logoUrl: logoUrl || undefined,
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
    },
    featureFlags,
  });

  if (result.kind === "unauthenticated") {
    redirect(`/admin/settings?settingsAction=signin`);
  }

  if (result.kind === "profile-unavailable" || result.kind === "settings-unavailable") {
    redirect(`/admin/settings?settingsAction=unavailable`);
  }

  if (result.kind === "permission-denied") {
    redirect(`/admin/settings?settingsAction=denied`);
  }

  if (result.kind === "invalid-input") {
    redirect(`/admin/settings?settingsAction=invalid`);
  }

  // success
  redirect(`/admin/settings?settingsAction=updated`);
}
