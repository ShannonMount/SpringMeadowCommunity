"use server";

import { redirect } from "next/navigation";
import {
  createResidentMessageThread,
  type ResidentMessageThreadResult,
} from "@/server/services/messages/resident-message-threads";
import {
  replyToResidentMessageThread,
  type ResidentMessageHistoryResult,
} from "@/server/services/messages/resident-message-history";

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function attachmentFiles(formData: FormData) {
  return formData.getAll("attachments").filter((entry): entry is File => {
    return entry instanceof File && entry.size > 0;
  });
}

function firstInvalidField(fieldErrors: Record<string, string[]>) {
  const [field] = Object.keys(fieldErrors);

  return field || "form";
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  }
}

function splitIdentifiers(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function redirectToContactBoard(input: {
  message: string;
  field?: string | null;
}): never {
  const params = new URLSearchParams({ message: input.message });

  if (input.field) {
    params.set("messageField", input.field);
  }

  redirect(`/portal/contact-board?${params.toString()}`);
}

function messageKeyForResult(
  result: Exclude<ResidentMessageThreadResult, { kind: "created" | "invalid-input" }>,
) {
  switch (result.kind) {
    case "unauthenticated":
      return "signin";
    case "permission-denied":
    case "profile-unavailable":
    case "no-active-membership":
      return "denied";
    case "messages-unavailable":
      return "unavailable";
  }
}

function messageKeyForHistoryResult(result: ResidentMessageHistoryResult) {
  switch (result.kind) {
    case "unauthenticated":
      return "signin";
    case "permission-denied":
    case "profile-unavailable":
    case "no-active-membership":
      return "denied";
    case "messages-unavailable":
      return "unavailable";
    case "records":
    case "thread":
    case "replied":
    case "invalid-input":
      return "unavailable";
  }
}

function residentMessagesParams(formData: FormData) {
  const params = new URLSearchParams();

  setOptionalParam(params, "propertyId", stringValue(formData.get("currentPropertyId")));
  setOptionalParam(params, "status", stringValue(formData.get("currentStatus")));
  setOptionalParam(params, "category", stringValue(formData.get("currentCategory")));
  setOptionalParam(params, "query", stringValue(formData.get("currentQuery")));
  setOptionalParam(params, "pageOffset", stringValue(formData.get("currentPageOffset")));
  setOptionalParam(params, "threadId", stringValue(formData.get("threadId")));

  return params;
}

function redirectToResidentMessages(
  formData: FormData,
  input: { message: string; field?: string | null },
): never {
  const params = residentMessagesParams(formData);

  params.set("message", input.message);

  if (input.field) {
    params.set("messageField", input.field);
  }

  redirect(`/portal/messages?${params.toString()}`);
}

export async function createResidentMessageThreadAction(formData: FormData) {
  const result = await createResidentMessageThread({
    propertyId: stringValue(formData.get("propertyId")),
    subject: stringValue(formData.get("subject")),
    category: stringValue(formData.get("category")),
    body: stringValue(formData.get("body")),
    attachmentFiles: attachmentFiles(formData),
  });

  if (result.kind === "created") {
    redirectToContactBoard({ message: "created" });
  }

  if (result.kind === "invalid-input") {
    redirectToContactBoard({
      message: "invalid",
      field: firstInvalidField(result.fieldErrors),
    });
  }

  redirectToContactBoard({ message: messageKeyForResult(result) });
}

export async function replyToResidentMessageThreadAction(formData: FormData) {
  const result = await replyToResidentMessageThread({
    threadId: stringValue(formData.get("threadId")),
    body: stringValue(formData.get("body")),
    attachmentDocumentIds: splitIdentifiers(stringValue(formData.get("attachmentDocumentIds"))),
  });

  if (result.kind === "replied") {
    redirectToResidentMessages(formData, { message: "replied" });
  }

  if (result.kind === "invalid-input") {
    redirectToResidentMessages(formData, {
      message: "invalid",
      field: firstInvalidField(result.fieldErrors),
    });
  }

  redirectToResidentMessages(formData, { message: messageKeyForHistoryResult(result) });
}
