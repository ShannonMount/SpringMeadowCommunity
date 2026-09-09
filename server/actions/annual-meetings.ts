"use server";

import { redirect } from "next/navigation";
import { createAnnualMeeting, markAnnualNoticeSent } from "@/server/services/admin/annual-meetings";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createAnnualMeetingAction(formData: FormData) {
  const result = await createAnnualMeeting({
    meetingAt: text(formData, "meetingAt"),
    location: text(formData, "location"),
    agenda: text(formData, "agenda"),
    status: text(formData, "status") || "draft",
  });
  redirect(`/admin/meetings?meeting=${result.kind === "created" ? "created" : result.kind === "permission-denied" ? "denied" : "invalid"}`);
}

export async function markAnnualNoticeSentAction(formData: FormData) {
  const result = await markAnnualNoticeSent({
    meetingId: text(formData, "meetingId"),
    noticeAt: text(formData, "noticeAt"),
    overrideReason: text(formData, "overrideReason"),
  });
  redirect(`/admin/meetings?meeting=${result.kind === "updated" ? "notice-sent" : result.kind === "notice-out-of-window" ? "notice-out-of-window" : "invalid"}`);
}
