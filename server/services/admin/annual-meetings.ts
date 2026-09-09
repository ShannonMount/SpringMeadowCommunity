import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import { hasPermission, PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";

const COMMUNITY_SLUG = "spring-meadow-community";
const MEETING_PERMISSION = "admin.meetings.manage";

type MeetingRow = {
  id?: string;
  meeting_at?: string;
  location?: string;
  agenda?: string;
  status?: string;
  timezone?: string;
  notice_earliest_at?: string;
  notice_latest_at?: string;
  notice_sent_at?: string | null;
  notice_override_reason?: string | null;
};

export type AnnualMeeting = {
  id: string;
  meetingAt: string;
  location: string;
  agenda: string;
  status: string;
  timezone: string;
  noticeEarliestAt: string;
  noticeLatestAt: string;
  noticeSentAt: string | null;
  noticeOverrideReason: string | null;
};

export type AnnualMeetingResult =
  | { kind: "meetings"; meetings: AnnualMeeting[] }
  | { kind: "created"; meeting: AnnualMeeting }
  | { kind: "updated"; meeting: AnnualMeeting }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "notice-out-of-window"; message: string }
  | { kind: "unavailable"; message: string };

function normalize(row: MeetingRow): AnnualMeeting {
  return {
    id: row.id ?? "",
    meetingAt: row.meeting_at ?? "",
    location: row.location ?? "",
    agenda: row.agenda ?? "",
    status: row.status ?? "draft",
    timezone: row.timezone ?? "America/New_York",
    noticeEarliestAt: row.notice_earliest_at ?? "",
    noticeLatestAt: row.notice_latest_at ?? "",
    noticeSentAt: row.notice_sent_at ?? null,
    noticeOverrideReason: row.notice_override_reason ?? null,
  };
}

async function authorize() {
  const profile = await getCurrentProfile();
  if (profile.kind === "unauthenticated") return { kind: "unauthenticated" } as const;
  if (profile.kind !== "active-profile") return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE } as const;
  const supabase = await createClient();
  const community = await supabase.from("communities").select("id").eq("slug", COMMUNITY_SLUG).maybeSingle<{ id: string }>();
  if (!community.data?.id || community.error) return { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." } as const;
  const permission = await hasPermission({ communityId: community.data.id, permissionKey: MEETING_PERMISSION });
  if (permission.kind === "authorized") return { kind: "authorized", supabase } as const;
  if (permission.kind === "unauthenticated") return { kind: "unauthenticated" } as const;
  if (permission.kind === "profile-unavailable") return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE } as const;
  return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE } as const;
}

export async function listAnnualMeetings(): Promise<AnnualMeetingResult> {
  const auth = await authorize();
  if (auth.kind !== "authorized") return auth;
  const { data, error } = await auth.supabase.rpc("list_annual_association_meetings", { target_community_slug: COMMUNITY_SLUG });
  const result = data as { status?: string; meetings?: MeetingRow[] } | null;
  if (error || !result) return { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
  if (result.status === "permission_denied") return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  return result.status === "ok" ? { kind: "meetings", meetings: (result.meetings ?? []).map(normalize) } : { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
}

export async function createAnnualMeeting(input: { meetingAt: string; location: string; agenda: string; status?: string }): Promise<AnnualMeetingResult> {
  const auth = await authorize();
  if (auth.kind !== "authorized") return auth;
  if (!input.meetingAt || !input.location.trim()) return { kind: "invalid", message: "Meeting date and location are required." };
  const { data, error } = await auth.supabase.rpc("create_annual_association_meeting", {
    target_community_slug: COMMUNITY_SLUG,
    meeting_at_value: input.meetingAt,
    location_value: input.location,
    agenda_value: input.agenda,
    status_value: input.status ?? "draft",
  });
  const result = data as { status?: string; record?: MeetingRow } | null;
  if (error || !result) return { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
  if (result.status === "permission_denied") return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  if (result.status === "invalid") return { kind: "invalid", message: "Check the meeting details and try again." };
  return result.status === "created" && result.record ? { kind: "created", meeting: normalize(result.record) } : { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
}

export async function markAnnualNoticeSent(input: { meetingId: string; noticeAt: string; overrideReason?: string }): Promise<AnnualMeetingResult> {
  const auth = await authorize();
  if (auth.kind !== "authorized") return auth;
  const { data, error } = await auth.supabase.rpc("mark_annual_association_notice_sent", {
    target_meeting_id: input.meetingId,
    notice_at_value: input.noticeAt,
    override_reason_value: input.overrideReason || null,
  });
  const result = data as { status?: string; record?: MeetingRow } | null;
  if (error || !result) return { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
  if (result.status === "permission_denied") return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  if (result.status === "notice_out_of_window") return { kind: "notice-out-of-window", message: "Notice is outside the allowed window. Provide an explicit override reason." };
  return result.status === "updated" && result.record ? { kind: "updated", meeting: normalize(result.record) } : { kind: "unavailable", message: "Meeting workflow is temporarily unavailable." };
}
