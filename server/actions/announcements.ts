"use server";

import { redirect } from "next/navigation";
import {
  archiveAnnouncement,
  createAnnouncement,
  expireAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
  type AnnouncementMutationInput,
  type AnnouncementResult,
} from "@/server/services/announcements/announcement-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);

  return typeof raw === "string" ? raw.trim() : "";
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function splitIdentifiers(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getNewYorkDateTimeParts(date: Date): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getNewYorkOffsetMs(date: Date) {
  const values = getNewYorkDateTimeParts(date);

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
  );
}

function dateTimeLocalParts(match: RegExpExecArray): DateTimeParts {
  const [, year, month, day, hour, minute, second = "0"] = match;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateTimeLocalMatch(match: RegExpExecArray) {
  const parts = dateTimeLocalParts(match);

  return (
    isValidDateParts(parts.year, parts.month, parts.day) &&
    parts.hour >= 0 &&
    parts.hour <= 23 &&
    parts.minute >= 0 &&
    parts.minute <= 59 &&
    parts.second >= 0 &&
    parts.second <= 59
  );
}

function dateTimePartsMatch(first: DateTimeParts, second: DateTimeParts) {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute &&
    first.second === second.second
  );
}

function dateTimeLocalToNewYorkIso(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match || !isValidDateTimeLocalMatch(match)) {
    return null;
  }

  const localParts = dateTimeLocalParts(match);
  const localAsUtc = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second,
  );
  let instant = localAsUtc - getNewYorkOffsetMs(new Date(localAsUtc));
  instant = localAsUtc - getNewYorkOffsetMs(new Date(instant));
  const instantDate = new Date(instant);

  if (!dateTimePartsMatch(getNewYorkDateTimeParts(instantDate), localParts)) {
    return null;
  }

  return instantDate.toISOString();
}

function dateTimeLocalValue(formData: FormData, key: string) {
  const rawValue = value(formData, key);

  if (!rawValue) {
    return "";
  }

  return dateTimeLocalToNewYorkIso(rawValue) ?? "invalid";
}

function announcementInput(formData: FormData, requireId = false): AnnouncementMutationInput {
  return {
    communitySlug: value(formData, "communitySlug") || DEFAULT_COMMUNITY_SLUG,
    announcementId: requireId ? value(formData, "announcementId") : null,
    title: value(formData, "title"),
    body: value(formData, "body"),
    visibility: value(formData, "visibility"),
    propertyIds: splitIdentifiers(value(formData, "propertyIds")),
    status: value(formData, "status"),
    pinned: checked(formData, "pinned"),
    publishAt: dateTimeLocalValue(formData, "publishAt"),
    expiresAt: dateTimeLocalValue(formData, "expiresAt"),
    attachmentDocumentIds: splitIdentifiers(value(formData, "attachmentDocumentIds")),
  };
}

function adminAnnouncementsRedirect(input: {
  communitySlug?: string | null;
  announcement?: string;
  announcementField?: string;
}) {
  const params = new URLSearchParams({
    communitySlug: input.communitySlug || DEFAULT_COMMUNITY_SLUG,
  });

  if (input.announcement) {
    params.set("announcement", input.announcement);
  }

  if (input.announcementField) {
    params.set("announcementField", input.announcementField);
  }

  redirect(`/admin/announcements?${params.toString()}`);
}

function statusFromResult(result: AnnouncementResult, success: string) {
  if (
    result.kind === "created" ||
    result.kind === "updated" ||
    result.kind === "published" ||
    result.kind === "expired" ||
    result.kind === "archived"
  ) {
    return success;
  }

  if (result.kind === "invalid-input") {
    const [field = "form"] = Object.keys(result.fieldErrors);

    return `invalid:${field}`;
  }

  if (result.kind === "unauthenticated") {
    return "signin";
  }

  if (result.kind === "permission-denied" || result.kind === "profile-unavailable") {
    return "denied";
  }

  return "unavailable";
}

function redirectForResult(formData: FormData, result: AnnouncementResult, success: string) {
  const status = statusFromResult(result, success);
  const [announcement, announcementField] = status.split(":");

  adminAnnouncementsRedirect({
    communitySlug: value(formData, "communitySlug"),
    announcement,
    announcementField,
  });
}

export async function createAdminAnnouncement(formData: FormData) {
  const result = await createAnnouncement(announcementInput(formData));

  redirectForResult(formData, result, "created");
}

export async function updateAdminAnnouncement(formData: FormData) {
  const result = await updateAnnouncement(announcementInput(formData, true));

  redirectForResult(formData, result, "updated");
}

async function lifecycleAction(
  formData: FormData,
  action: typeof publishAnnouncement | typeof expireAnnouncement | typeof archiveAnnouncement,
  success: string,
) {
  const result = await action({ announcementId: value(formData, "announcementId") });

  redirectForResult(formData, result, success);
}

export async function publishAdminAnnouncement(formData: FormData) {
  await lifecycleAction(formData, publishAnnouncement, "published");
}

export async function expireAdminAnnouncement(formData: FormData) {
  await lifecycleAction(formData, expireAnnouncement, "expired");
}

export async function archiveAdminAnnouncement(formData: FormData) {
  await lifecycleAction(formData, archiveAnnouncement, "archived");
}
