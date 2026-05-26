"use server";

import { redirect } from "next/navigation";
import {
  archiveEvent,
  cancelEvent,
  createEvent,
  updateEvent,
  type EventMutationInput,
  type EventResult,
} from "@/server/services/events/event-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function value(formData: FormData, key: string) {
  const raw = formData.get(key);

  return typeof raw === "string" ? raw.trim() : "";
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getNewYorkOffsetMs(date: Date) {
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

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateTimeLocalMatch(match: RegExpExecArray) {
  const [, year, month, day, hour, minute, second = "0"] = match;
  const yearValue = Number(year);
  const monthValue = Number(month);
  const dayValue = Number(day);
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);

  return (
    isValidDateParts(yearValue, monthValue, dayValue) &&
    hourValue >= 0 &&
    hourValue <= 23 &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    secondValue >= 0 &&
    secondValue <= 59
  );
}

function dateTimeLocalToNewYorkIso(inputValue: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(inputValue);

  if (!match || !isValidDateTimeLocalMatch(match)) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let instant = localAsUtc - getNewYorkOffsetMs(new Date(localAsUtc));
  instant = localAsUtc - getNewYorkOffsetMs(new Date(instant));

  return new Date(instant).toISOString();
}

function dateTimeLocalValue(formData: FormData, key: string) {
  const rawValue = value(formData, key);

  if (!rawValue) {
    return "";
  }

  return dateTimeLocalToNewYorkIso(rawValue) ?? "invalid";
}

function optionalId(formData: FormData, key: string) {
  return value(formData, key) || null;
}

function eventInput(formData: FormData, requireId = false): EventMutationInput {
  return {
    communitySlug: value(formData, "communitySlug") || DEFAULT_COMMUNITY_SLUG,
    eventId: requireId ? value(formData, "eventId") : null,
    title: value(formData, "title"),
    description: value(formData, "description") || null,
    type: value(formData, "type"),
    visibility: value(formData, "visibility"),
    startsAt: dateTimeLocalValue(formData, "startsAt"),
    endsAt: dateTimeLocalValue(formData, "endsAt"),
    allDay: checked(formData, "allDay"),
    location: value(formData, "location") || null,
    relatedMeetingId: optionalId(formData, "relatedMeetingId"),
    relatedComplianceEventId: optionalId(formData, "relatedComplianceEventId"),
    status: value(formData, "status") || "scheduled",
  };
}

function adminEventsRedirect(input: {
  communitySlug?: string | null;
  event?: string;
  eventField?: string;
}) {
  const params = new URLSearchParams({
    communitySlug: input.communitySlug || DEFAULT_COMMUNITY_SLUG,
  });

  if (input.event) {
    params.set("event", input.event);
  }

  if (input.eventField) {
    params.set("eventField", input.eventField);
  }

  redirect(`/admin/events?${params.toString()}`);
}

function statusFromResult(result: EventResult, success: string) {
  if (
    result.kind === "created" ||
    result.kind === "updated" ||
    result.kind === "cancelled" ||
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

function redirectForResult(formData: FormData, result: EventResult, success: string) {
  const status = statusFromResult(result, success);
  const [event, eventField] = status.split(":");

  adminEventsRedirect({
    communitySlug: value(formData, "communitySlug"),
    event,
    eventField,
  });
}

export async function createAdminEvent(formData: FormData) {
  const result = await createEvent(eventInput(formData));

  redirectForResult(formData, result, "created");
}

export async function updateAdminEvent(formData: FormData) {
  const result = await updateEvent(eventInput(formData, true));

  redirectForResult(formData, result, "updated");
}

async function lifecycleAction(
  formData: FormData,
  action: typeof cancelEvent | typeof archiveEvent,
  success: string,
) {
  const result = await action({ eventId: value(formData, "eventId") });

  redirectForResult(formData, result, success);
}

export async function cancelAdminEvent(formData: FormData) {
  await lifecycleAction(formData, cancelEvent, "cancelled");
}

export async function archiveAdminEvent(formData: FormData) {
  await lifecycleAction(formData, archiveEvent, "archived");
}
