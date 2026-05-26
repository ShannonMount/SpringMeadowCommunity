"use server";

import { redirect } from "next/navigation";
import {
  archiveAdminProperty,
  createAdminProperty,
  updateAdminProperty,
  type AdminPropertyMailingAddress,
  type AdminPropertyMutationInput,
  type AdminPropertyMutationResult,
} from "@/server/services/admin/property-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const PUBLIC_PAYMENT_CODE_PATTERN = /^[a-z0-9 ._-]+$/i;
const PROPERTY_STATUSES = ["active", "inactive", "archived"] as const;
const DELINQUENCY_STATUSES = [
  "current",
  "due_soon",
  "overdue",
  "delinquent",
  "lien_review",
  "disputed",
] as const;

type PropertyActionStatus =
  | "created"
  | "updated"
  | "archived"
  | "invalid"
  | "denied"
  | "unavailable"
  | "conflict";

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptional(value: string) {
  const normalized = normalizeSpaces(value);

  return normalized || null;
}

function hasControlCharacters(value: string) {
  return CONTROL_CHARACTER_PATTERN.test(value);
}

function isDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isAllowed<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function redirectToProperties(status: PropertyActionStatus, field?: string | null): never {
  const params = new URLSearchParams({ propertyAction: status });

  if (field) {
    params.set("propertyActionField", field);
  }

  redirect(`/admin/properties?${params.toString()}`);
}

function firstInvalidField(fieldErrors: Record<string, string[]>) {
  const [field] = Object.keys(fieldErrors);

  if (!field) {
    return "form";
  }

  if (field.startsWith("mailingAddress.")) {
    return field.replace("mailingAddress.", "mailingAddress");
  }

  if (field === "nextDueDate") {
    return "nextDueDate";
  }

  return field;
}

function mutationStatus(result: AdminPropertyMutationResult): PropertyActionStatus {
  switch (result.kind) {
    case "permission-denied":
      return "denied";
    case "unauthenticated":
    case "profile-unavailable":
    case "property-unavailable":
      return "unavailable";
    case "created":
    case "updated":
    case "archived":
    case "invalid-input":
    case "conflict":
      return "unavailable";
  }
}

function formText(formData: FormData, name: string) {
  return normalizeSpaces(stringValue(formData.get(name)));
}

function formOptionalText(formData: FormData, name: string) {
  return normalizeOptional(stringValue(formData.get(name)));
}

function buildMailingAddress(formData: FormData): AdminPropertyMailingAddress | null {
  const mailingAddressLine1 = formOptionalText(formData, "mailingAddressLine1");
  const mailingAddressLine2 = formOptionalText(formData, "mailingAddressLine2");
  const mailingAddressCity = formOptionalText(formData, "mailingAddressCity");
  const mailingAddressState = formOptionalText(formData, "mailingAddressState");
  const mailingAddressPostalCode = formOptionalText(formData, "mailingAddressPostalCode");
  const mailingAddressCounty = formOptionalText(formData, "mailingAddressCounty");
  const mailingAddress: AdminPropertyMailingAddress = {};

  if (mailingAddressLine1) {
    mailingAddress.line1 = mailingAddressLine1;
  }

  if (mailingAddressLine2) {
    mailingAddress.line2 = mailingAddressLine2;
  }

  if (mailingAddressCity) {
    mailingAddress.city = mailingAddressCity;
  }

  if (mailingAddressState) {
    mailingAddress.state = mailingAddressState.toUpperCase();
  }

  if (mailingAddressPostalCode) {
    mailingAddress.postalCode = mailingAddressPostalCode;
  }

  if (mailingAddressCounty) {
    mailingAddress.county = mailingAddressCounty;
  }

  return Object.keys(mailingAddress).length > 0 ? mailingAddress : null;
}

function localFieldError(input: AdminPropertyMutationInput) {
  const publicPaymentCode = input.publicPaymentCode ?? "";
  const nextDueDate = input.nextDueDate ?? "";
  const delinquencyStatus = input.delinquencyStatus ?? "current";

  if (!input.accountNumber || hasControlCharacters(input.accountNumber)) {
    return "accountNumber";
  }

  if (publicPaymentCode && !PUBLIC_PAYMENT_CODE_PATTERN.test(publicPaymentCode)) {
    return "publicPaymentCode";
  }

  if (!isAllowed(PROPERTY_STATUSES, input.status)) {
    return "status";
  }

  if (!input.addressLine1 || hasControlCharacters(input.addressLine1)) {
    return "addressLine1";
  }

  if (!input.city || hasControlCharacters(input.city)) {
    return "city";
  }

  if (!input.state || hasControlCharacters(input.state)) {
    return "state";
  }

  if (!input.postalCode || hasControlCharacters(input.postalCode)) {
    return "postalCode";
  }

  if (nextDueDate && !isDateOnly(nextDueDate)) {
    return "nextDueDate";
  }

  if (!isAllowed(DELINQUENCY_STATUSES, delinquencyStatus)) {
    return "delinquencyStatus";
  }

  for (const value of Object.values(input.mailingAddress ?? {})) {
    if (hasControlCharacters(value ?? "")) {
      return "mailingAddressLine1";
    }
  }

  return null;
}

function propertyInputFromForm(formData: FormData): AdminPropertyMutationInput {
  const status = formText(formData, "status") || "active";
  const nextDueDate = formOptionalText(formData, "nextDueDate");
  const delinquencyStatus = formText(formData, "delinquencyStatus") || "current";

  return {
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    propertyId: formOptionalText(formData, "propertyId"),
    accountNumber: formText(formData, "accountNumber").toUpperCase(),
    publicPaymentCode: formOptionalText(formData, "publicPaymentCode")?.toUpperCase() ?? null,
    status,
    addressLine1: formText(formData, "addressLine1"),
    addressLine2: formOptionalText(formData, "addressLine2"),
    city: formText(formData, "city"),
    state: formText(formData, "state").toUpperCase(),
    postalCode: formText(formData, "postalCode"),
    county: formOptionalText(formData, "county"),
    mailingAddress: buildMailingAddress(formData),
    ownerDisplayName: formOptionalText(formData, "ownerDisplayName"),
    lotNumber: formOptionalText(formData, "lotNumber"),
    parcelNumber: formOptionalText(formData, "parcelNumber"),
    platReference: formOptionalText(formData, "platReference"),
    nextDueDate,
    delinquencyStatus,
  };
}

function handleMutationResult(
  result: AdminPropertyMutationResult,
  success: Extract<PropertyActionStatus, "created" | "updated" | "archived">,
): never {
  if (result.kind === success) {
    redirectToProperties(success);
  }

  if (result.kind === "invalid-input") {
    redirectToProperties("invalid", firstInvalidField(result.fieldErrors));
  }

  if (result.kind === "conflict") {
    redirectToProperties("conflict", result.field);
  }

  redirectToProperties(mutationStatus(result));
}

export async function createAdminPropertyAction(formData: FormData) {
  const input = propertyInputFromForm(formData);
  const field = localFieldError(input);

  if (field) {
    redirectToProperties("invalid", field);
  }

  const result = await createAdminProperty(input);

  handleMutationResult(result, "created");
}

export async function updateAdminPropertyAction(formData: FormData) {
  const input = propertyInputFromForm(formData);
  const field = localFieldError(input);

  if (!input.propertyId) {
    redirectToProperties("invalid", "propertyId");
  }

  if (field) {
    redirectToProperties("invalid", field);
  }

  const result = await updateAdminProperty(input);

  handleMutationResult(result, "updated");
}

export async function archiveAdminPropertyAction(formData: FormData) {
  const propertyId = formOptionalText(formData, "propertyId");

  if (!propertyId) {
    redirectToProperties("invalid", "propertyId");
  }

  const result = await archiveAdminProperty({
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    propertyId,
  });

  handleMutationResult(result, "archived");
}
