"use server";

import { redirect } from "next/navigation";
import {
  addInternalNoteToMessageThread,
  assignMessageThread,
  replyToMessageThread,
  setMessageThreadStatus,
  type AdminMessageResult,
} from "@/server/services/messages/admin-message-inbox";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);

  return typeof raw === "string" ? raw.trim() : "";
}

function threadIdValue(formData: FormData) {
  const raw = formData.get("threadId");

  return typeof raw === "string" ? raw.trim() : "";
}

function bodyValue(formData: FormData) {
  const raw = formData.get("body");

  return typeof raw === "string" ? raw.trim() : "";
}

function noteBodyValue(formData: FormData) {
  const raw = formData.get("noteBody");

  return typeof raw === "string" ? raw.trim() : "";
}

function assignedToValue(formData: FormData) {
  const raw = formData.get("assignedTo");

  return typeof raw === "string" ? raw.trim() : "";
}

function statusValue(formData: FormData) {
  const raw = formData.get("status");

  return typeof raw === "string" ? raw.trim() : "";
}

function splitIdentifiers(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function setOptionalParam(params: URLSearchParams, key: string, paramValue: string) {
  if (paramValue) {
    params.set(key, paramValue);
  }
}

function currentFilterParams(formData: FormData) {
  const params = new URLSearchParams({
    communitySlug: value(formData, "communitySlug") || DEFAULT_COMMUNITY_SLUG,
  });

  setOptionalParam(params, "status", value(formData, "currentStatus"));
  setOptionalParam(params, "category", value(formData, "currentCategory"));
  setOptionalParam(params, "propertyId", value(formData, "currentPropertyId"));
  setOptionalParam(params, "assignedTo", value(formData, "currentAssignedTo"));
  setOptionalParam(params, "query", value(formData, "currentQuery"));
  setOptionalParam(params, "lastMessageFrom", value(formData, "currentLastMessageFrom"));
  setOptionalParam(params, "lastMessageTo", value(formData, "currentLastMessageTo"));
  setOptionalParam(params, "pageOffset", value(formData, "currentPageOffset"));
  setOptionalParam(params, "threadId", threadIdValue(formData));

  return params;
}

function adminMessagesRedirect(formData: FormData, input: { message: string; messageField?: string }) {
  const params = currentFilterParams(formData);

  params.set("message", input.message);

  if (input.messageField) {
    params.set("messageField", input.messageField);
  }

  redirect(`/admin/messages?${params.toString()}`);
}

function messageStatusFromResult(result: AdminMessageResult, success: string) {
  if (
    result.kind === "replied" ||
    result.kind === "noted" ||
    result.kind === "assigned" ||
    result.kind === "status-updated"
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

function redirectForResult(formData: FormData, result: AdminMessageResult, success: string) {
  const status = messageStatusFromResult(result, success);
  const [message, messageField] = status.split(":");

  adminMessagesRedirect(formData, { message, messageField });
}

export async function replyToMessageThreadAction(formData: FormData) {
  const attachmentDocumentIds = splitIdentifiers(value(formData, "attachmentDocumentIds"));
  const result = await replyToMessageThread({
    threadId: threadIdValue(formData),
    body: bodyValue(formData),
    attachmentDocumentIds,
  });

  redirectForResult(formData, result, "replied");
}

export async function addInternalNoteToMessageThreadAction(formData: FormData) {
  const result = await addInternalNoteToMessageThread({
    threadId: threadIdValue(formData),
    noteBody: noteBodyValue(formData),
  });

  redirectForResult(formData, result, "noted");
}

export async function assignMessageThreadAction(formData: FormData) {
  const result = await assignMessageThread({
    threadId: threadIdValue(formData),
    assignedTo: assignedToValue(formData) || null,
  });

  redirectForResult(formData, result, "assigned");
}

export async function setMessageThreadStatusAction(formData: FormData) {
  const result = await setMessageThreadStatus({
    threadId: threadIdValue(formData),
    status: statusValue(formData),
  });

  const successByStatus: Record<string, string> = {
    closed: "closed",
    archived: "archived",
    open: "reopened",
    pending_board: "reopened",
    pending_resident: "reopened",
  };

  redirectForResult(formData, result, successByStatus[statusValue(formData)] ?? "reopened");
}
