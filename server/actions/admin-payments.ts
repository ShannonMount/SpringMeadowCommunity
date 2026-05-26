"use server";

import { redirect } from "next/navigation";
import {
  recordManualPayment,
  type ManualPaymentAllocationInput,
  type RecordManualPaymentResult,
} from "@/server/services/payments/admin-payment-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DECIMAL_DOLLAR_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
const GROUPED_DECIMAL_DOLLAR_PATTERN = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const ALLOCATION_LINE_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})[\s,:]+(\d{1,9}(?:\.\d{1,2})?)$/i;

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDollarAmountCents(value: string) {
  const pattern = value.includes(",") ? GROUPED_DECIMAL_DOLLAR_PATTERN : DECIMAL_DOLLAR_PATTERN;

  if (!pattern.test(value)) {
    return null;
  }

  const amount = value.replaceAll(",", "");
  const [dollars, cents = ""] = amount.split(".");
  const parsed = Number(`${dollars}${cents.padEnd(2, "0")}`);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseAmountCents(formData: FormData) {
  const amount = stringValue(formData.get("amount"));

  return amount ? parseDollarAmountCents(amount) : null;
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

function dateTimeLocalToTimeZoneIso(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

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

function parsePaidAt(formData: FormData) {
  const paidAt = stringValue(formData.get("paidAt"));

  if (!paidAt) {
    return { kind: "empty" } as const;
  }

  const value = dateTimeLocalToTimeZoneIso(paidAt);

  return value ? ({ kind: "value", value } as const) : ({ kind: "invalid" } as const);
}

function parseManualMethod(value: string) {
  return value === "check" || value === "cash" || value === "manual" || value === "other"
    ? value
    : "";
}

function parseAllocationObject(value: unknown): ManualPaymentAllocationInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const allocation = value as { assessmentId?: unknown; amountCents?: unknown };
  const assessmentId = typeof allocation.assessmentId === "string" ? allocation.assessmentId : "";
  const amountCents =
    typeof allocation.amountCents === "number" && Number.isSafeInteger(allocation.amountCents)
      ? allocation.amountCents
      : null;

  if (!assessmentId || !amountCents || amountCents <= 0) {
    return null;
  }

  return { assessmentId, amountCents };
}

function parseAllocations(formData: FormData): ManualPaymentAllocationInput[] | null {
  const allocations = stringValue(formData.get("allocations"));

  if (!allocations) {
    return [];
  }

  if (allocations.startsWith("[")) {
    try {
      const parsed = JSON.parse(allocations) as unknown;

      if (!Array.isArray(parsed)) {
        return null;
      }

      const mapped = parsed.map(parseAllocationObject);

      return mapped.every(Boolean) ? (mapped as ManualPaymentAllocationInput[]) : null;
    } catch {
      return null;
    }
  }

  const parsedLines: ManualPaymentAllocationInput[] = [];

  for (const line of allocations.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const match = ALLOCATION_LINE_PATTERN.exec(trimmed);

    if (!match) {
      return null;
    }

    const amountCents = parseDollarAmountCents(match[2]);

    if (!amountCents) {
      return null;
    }

    parsedLines.push({ assessmentId: match[1], amountCents });
  }

  return parsedLines;
}

function redirectToAdminPayments(input: {
  communitySlug: string;
  status: string;
  field?: string | null;
}): never {
  const params = new URLSearchParams({
    manualPayment: input.status,
    communitySlug: input.communitySlug,
  });

  if (input.field) {
    params.set("manualPaymentField", input.field);
  }

  redirect(`/admin/payments?${params.toString()}`);
}

function invalidFieldFromErrors(fieldErrors: Record<string, string[]>) {
  const [firstField] = Object.keys(fieldErrors);

  if (!firstField) {
    return "form";
  }

  if (firstField.startsWith("allocations")) {
    return "allocations";
  }

  if (firstField === "amountCents") {
    return "amount";
  }

  if (firstField === "method") {
    return "manualMethod";
  }

  return firstField;
}

function manualPaymentStatusKey(result: Exclude<RecordManualPaymentResult, { kind: "recorded" | "invalid-input" }>) {
  switch (result.kind) {
    case "configuration-disabled":
      return "disabled";
    case "permission-denied":
      return "denied";
    case "unauthenticated":
      return "signin";
    case "profile-unavailable":
    case "payment-unavailable":
      return "unavailable";
  }
}

export async function recordAdminManualPayment(formData: FormData) {
  const amountCents = parseAmountCents(formData);
  const method = parseManualMethod(
    stringValue(formData.get("manualMethod")) || stringValue(formData.get("method")),
  );
  const allocations = parseAllocations(formData);
  const communitySlug = stringValue(formData.get("communitySlug")) || DEFAULT_COMMUNITY_SLUG;
  const paidAt = parsePaidAt(formData);

  if (!amountCents) {
    redirectToAdminPayments({ communitySlug, status: "invalid", field: "amount" });
  }

  if (!method) {
    redirectToAdminPayments({ communitySlug, status: "invalid", field: "manualMethod" });
  }

  if (allocations === null) {
    redirectToAdminPayments({ communitySlug, status: "invalid", field: "allocations" });
  }

  if (paidAt.kind === "invalid") {
    redirectToAdminPayments({ communitySlug, status: "invalid", field: "paidAt" });
  }

  const result = await recordManualPayment({
    communitySlug,
    propertyId: stringValue(formData.get("propertyId")),
    requestId: stringValue(formData.get("requestId")),
    amountCents,
    method,
    paidAt: paidAt.kind === "value" ? paidAt.value : null,
    reason: stringValue(formData.get("reason")) || null,
    allocations,
  });

  if (result.kind === "recorded") {
    redirectToAdminPayments({ communitySlug, status: "recorded" });
  }

  if (result.kind === "invalid-input") {
    redirectToAdminPayments({
      communitySlug,
      status: "invalid",
      field: invalidFieldFromErrors(result.fieldErrors),
    });
  }

  redirectToAdminPayments({ communitySlug, status: manualPaymentStatusKey(result) });
}
