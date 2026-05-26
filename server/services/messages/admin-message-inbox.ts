import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import { PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";
import { sendMessageNotificationForMessage } from "@/server/services/messages/message-notifications";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const MESSAGES_UNAVAILABLE_MESSAGE = "Messages are temporarily unavailable. Please try again later.";
const INVALID_MESSAGE_INPUT_MESSAGE = "Please check the message details and try again.";
const MAX_BODY_LENGTH = 5000;
const MAX_QUERY_LENGTH = 200;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MESSAGE_CATEGORIES = [
  "dues",
  "documents",
  "maintenance",
  "architectural",
  "complaint",
  "general",
] as const;
const MESSAGE_STATUSES = [
  "open",
  "pending_board",
  "pending_resident",
  "closed",
  "archived",
] as const;
const MESSAGE_SENDER_ROLES = ["resident", "board_member", "admin"] as const;
const MESSAGE_VISIBILITIES = ["thread_participants", "board_admin_only"] as const;

type FieldErrors = Record<string, string[]>;

export type AdminMessageCategory = (typeof MESSAGE_CATEGORIES)[number];
export type AdminMessageThreadStatus = (typeof MESSAGE_STATUSES)[number];
export type AdminMessageSenderRole = (typeof MESSAGE_SENDER_ROLES)[number];
export type AdminMessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export type AdminMessageProfileSummary = {
  profileId: string;
  displayName: string;
};

export type AdminMessageThreadSummary = {
  threadId: string;
  communityId: string;
  propertyId: string;
  propertyLabel: string;
  subject: string;
  category: AdminMessageCategory;
  status: AdminMessageThreadStatus;
  assignedTo: AdminMessageProfileSummary | null;
  createdBy: AdminMessageProfileSummary | null;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  attachmentCount: number;
};

export type AdminMessage = {
  messageId: string;
  threadId: string;
  senderId: string;
  senderRole: AdminMessageSenderRole;
  senderDisplayName: string;
  body: string;
  attachmentCount: number;
  visibility: AdminMessageVisibility;
  createdAt: string;
};

export type ListMessageThreadsInput = {
  communitySlug?: string | null;
  status?: string | null;
  category?: string | null;
  propertyId?: string | null;
  assignedTo?: string | null;
  query?: string | null;
  lastMessageFrom?: string | null;
  lastMessageTo?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type ThreadInput = {
  threadId: string;
};

export type ReplyToMessageThreadInput = {
  threadId: string;
  body: string;
  attachmentDocumentIds?: string[] | null;
};

export type AddInternalNoteInput = {
  threadId: string;
  noteBody: string;
};

export type AssignMessageThreadInput = {
  threadId: string;
  assignedTo?: string | null;
};

export type SetMessageThreadStatusInput = {
  threadId: string;
  status: string;
};

type ProfileSummaryRpcRow = {
  profile_id?: string | null;
  display_name?: string | null;
};

type ThreadRpcRow = {
  thread_id?: string | null;
  community_id?: string | null;
  property_id?: string | null;
  property_label?: string | null;
  subject?: string | null;
  category?: string | null;
  status?: string | null;
  assigned_to?: ProfileSummaryRpcRow | null;
  created_by?: ProfileSummaryRpcRow | null;
  last_message_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count?: number | null;
  attachment_count?: number | null;
};

type MessageRpcRow = {
  message_id?: string | null;
  thread_id?: string | null;
  sender_id?: string | null;
  sender_role?: string | null;
  sender_display_name?: string | null;
  body?: string | null;
  attachment_count?: number | null;
  visibility?: string | null;
  created_at?: string | null;
};

type MessageRpcResult = {
  status?:
    | "ok"
    | "replied"
    | "assigned"
    | "noted"
    | "status_updated"
    | "permission_denied"
    | "invalid"
    | "not_found"
    | "unavailable";
  record?: ThreadRpcRow | null;
  records?: ThreadRpcRow[] | null;
  thread?: ThreadRpcRow | null;
  messages?: MessageRpcRow[] | null;
  message_id?: string | null;
};

export type AdminMessageResult =
  | { kind: "records"; records: AdminMessageThreadSummary[] }
  | { kind: "thread"; thread: AdminMessageThreadSummary; messages: AdminMessage[] }
  | {
      kind: "replied" | "assigned" | "status-updated" | "noted";
      thread: AdminMessageThreadSummary;
      messageId?: string;
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: typeof INVALID_MESSAGE_INPUT_MESSAGE; fieldErrors: FieldErrors }
  | { kind: "messages-unavailable"; message: typeof MESSAGES_UNAVAILABLE_MESSAGE };

type ValidatedListInput =
  | {
      kind: "valid";
      communitySlug: string;
      status: AdminMessageThreadStatus | null;
      category: AdminMessageCategory | null;
      propertyId: string | null;
      assignedTo: string | null;
      query: string | null;
      lastMessageFrom: string | null;
      lastMessageTo: string | null;
      pageSize: number;
      pageOffset: number;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedThreadInput = { kind: "valid"; threadId: string } | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedReplyInput =
  | {
      kind: "valid";
      threadId: string;
      body: string;
      attachmentDocumentIds: string[];
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedInternalNoteInput =
  | {
      kind: "valid";
      threadId: string;
      noteBody: string;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedAssignInput =
  | {
      kind: "valid";
      threadId: string;
      assignedTo: string | null;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedStatusInput =
  | {
      kind: "valid";
      threadId: string;
      status: AdminMessageThreadStatus;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

function safeString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: string | null | undefined) {
  const trimmed = safeString(value);

  return trimmed || null;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isIncluded<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function boundedPageSize(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Number(value), 1), MAX_PAGE_SIZE);
}

function boundedPageOffset(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value), 0), MAX_PAGE_OFFSET);
}

function normalizeTimestamp(value: string | null | undefined) {
  const trimmed = safeString(value);

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function addOptionalUuidError(fieldErrors: FieldErrors, fieldName: string, value: string | null) {
  if (value && !isUuid(value)) {
    fieldErrors[fieldName] = ["Use a valid identifier."];
  }
}

function addUuidArrayErrors(fieldErrors: FieldErrors, fieldName: string, values: string[]) {
  for (const value of values) {
    if (!isUuid(value)) {
      fieldErrors[fieldName] = ["Use valid identifiers."];
      return;
    }
  }
}

function invalid(fieldErrors: FieldErrors): Extract<AdminMessageResult, { kind: "invalid-input" }> {
  return { kind: "invalid-input", message: INVALID_MESSAGE_INPUT_MESSAGE, fieldErrors };
}

function unavailable(): Extract<AdminMessageResult, { kind: "messages-unavailable" }> {
  return { kind: "messages-unavailable", message: MESSAGES_UNAVAILABLE_MESSAGE };
}

function asCategory(value: string | null | undefined): AdminMessageCategory {
  return isIncluded(MESSAGE_CATEGORIES, value ?? "") ? (value as AdminMessageCategory) : "general";
}

function asStatus(value: string | null | undefined): AdminMessageThreadStatus {
  return isIncluded(MESSAGE_STATUSES, value ?? "") ? (value as AdminMessageThreadStatus) : "open";
}

function asSenderRole(value: string | null | undefined): AdminMessageSenderRole {
  return isIncluded(MESSAGE_SENDER_ROLES, value ?? "") ? (value as AdminMessageSenderRole) : "board_member";
}

function asVisibility(value: string | null | undefined): AdminMessageVisibility {
  return isIncluded(MESSAGE_VISIBILITIES, value ?? "")
    ? (value as AdminMessageVisibility)
    : "thread_participants";
}

function asProfileSummary(row: ProfileSummaryRpcRow | null | undefined): AdminMessageProfileSummary | null {
  if (!row?.profile_id) {
    return null;
  }

  return {
    profileId: row.profile_id,
    displayName: row.display_name ?? "Unknown user",
  };
}

function asThreadSummary(row: ThreadRpcRow): AdminMessageThreadSummary {
  return {
    threadId: row.thread_id ?? "",
    communityId: row.community_id ?? "",
    propertyId: row.property_id ?? "",
    propertyLabel: row.property_label ?? "Unknown property",
    subject: row.subject ?? "",
    category: asCategory(row.category),
    status: asStatus(row.status),
    assignedTo: asProfileSummary(row.assigned_to),
    createdBy: asProfileSummary(row.created_by),
    lastMessageAt: row.last_message_at ?? "",
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    messageCount: row.message_count ?? 0,
    attachmentCount: row.attachment_count ?? 0,
  };
}

function asMessage(row: MessageRpcRow): AdminMessage {
  return {
    messageId: row.message_id ?? "",
    threadId: row.thread_id ?? "",
    senderId: row.sender_id ?? "",
    senderRole: asSenderRole(row.sender_role),
    senderDisplayName: row.sender_display_name ?? "Unknown user",
    body: row.body ?? "",
    attachmentCount: row.attachment_count ?? 0,
    visibility: asVisibility(row.visibility),
    createdAt: row.created_at ?? "",
  };
}

function validateListInput(input: ListMessageThreadsInput): ValidatedListInput {
  const fieldErrors: FieldErrors = {};
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;
  const status = optionalString(input.status);
  const category = optionalString(input.category);
  const propertyId = optionalString(input.propertyId);
  const assignedTo = optionalString(input.assignedTo);
  const query = optionalString(input.query);
  const lastMessageFrom = normalizeTimestamp(input.lastMessageFrom);
  const lastMessageTo = normalizeTimestamp(input.lastMessageTo);

  if (status && !isIncluded(MESSAGE_STATUSES, status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (category && !isIncluded(MESSAGE_CATEGORIES, category)) {
    fieldErrors.category = ["Choose a valid category."];
  }

  addOptionalUuidError(fieldErrors, "propertyId", propertyId);
  addOptionalUuidError(fieldErrors, "assignedTo", assignedTo);

  if (query && query.length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search text is too long."];
  }

  if (input.lastMessageFrom && !lastMessageFrom) {
    fieldErrors.lastMessageFrom = ["Enter a valid start date."];
  }

  if (input.lastMessageTo && !lastMessageTo) {
    fieldErrors.lastMessageTo = ["Enter a valid end date."];
  }

  if (lastMessageFrom && lastMessageTo && lastMessageTo < lastMessageFrom) {
    fieldErrors.lastMessageTo = ["End date must be after start date."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug,
    status: status as AdminMessageThreadStatus | null,
    category: category as AdminMessageCategory | null,
    propertyId,
    assignedTo,
    query,
    lastMessageFrom,
    lastMessageTo,
    pageSize: boundedPageSize(input.pageSize),
    pageOffset: boundedPageOffset(input.pageOffset),
  };
}

function validateThreadInput(input: ThreadInput): ValidatedThreadInput {
  if (!isUuid(input.threadId)) {
    return { kind: "invalid", fieldErrors: { threadId: ["Choose a valid thread."] } };
  }

  return { kind: "valid", threadId: input.threadId };
}

function validateReplyInput(input: ReplyToMessageThreadInput): ValidatedReplyInput {
  const fieldErrors: FieldErrors = {};
  const body = safeString(input.body);
  const attachmentDocumentIds = Array.from(
    new Set((input.attachmentDocumentIds ?? []).map((value) => safeString(value)).filter(Boolean)),
  );

  if (!isUuid(input.threadId)) {
    fieldErrors.threadId = ["Choose a valid thread."];
  }

  if (!body || body.length > MAX_BODY_LENGTH) {
    fieldErrors.body = ["Enter a reply of 5000 characters or fewer."];
  }

  if (attachmentDocumentIds.length > 3) {
    fieldErrors.attachmentDocumentIds = ["Attach no more than 3 documents."];
  }

  addUuidArrayErrors(fieldErrors, "attachmentDocumentIds", attachmentDocumentIds);

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    threadId: input.threadId,
    body,
    attachmentDocumentIds,
  };
}

function validateInternalNoteInput(input: AddInternalNoteInput): ValidatedInternalNoteInput {
  const fieldErrors: FieldErrors = {};
  const noteBody = safeString(input.noteBody);

  if (!isUuid(input.threadId)) {
    fieldErrors.threadId = ["Choose a valid thread."];
  }

  if (!noteBody || noteBody.length > MAX_BODY_LENGTH) {
    fieldErrors.noteBody = ["Enter an internal note of 5000 characters or fewer."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    noteBody,
    threadId: input.threadId,
  };
}

function validateAssignInput(input: AssignMessageThreadInput): ValidatedAssignInput {
  const fieldErrors: FieldErrors = {};
  const assignedTo = optionalString(input.assignedTo);

  if (!isUuid(input.threadId)) {
    fieldErrors.threadId = ["Choose a valid thread."];
  }

  addOptionalUuidError(fieldErrors, "assignedTo", assignedTo);

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return { kind: "valid", threadId: input.threadId, assignedTo };
}

function validateStatusInput(input: SetMessageThreadStatusInput): ValidatedStatusInput {
  const fieldErrors: FieldErrors = {};
  const status = safeString(input.status);

  if (!isUuid(input.threadId)) {
    fieldErrors.threadId = ["Choose a valid thread."];
  }

  if (!isIncluded(MESSAGE_STATUSES, status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return { kind: "valid", threadId: input.threadId, status: status as AdminMessageThreadStatus };
}

async function requireActiveProfile(): Promise<AdminMessageResult | null> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  return null;
}

function rpcResultToRecords(result: MessageRpcResult | null): AdminMessageResult {
  if (result?.status === "ok") {
    return { kind: "records", records: (result.records ?? []).map(asThreadSummary) };
  }

  if (result?.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result?.status === "invalid") {
    return invalid({ form: ["Message filters are invalid."] });
  }

  return unavailable();
}

function rpcResultToThread(result: MessageRpcResult | null): AdminMessageResult {
  if (result?.status === "ok" && result.thread) {
    return {
      kind: "thread",
      thread: asThreadSummary(result.thread),
      messages: (result.messages ?? []).map(asMessage),
    };
  }

  if (result?.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result?.status === "invalid" || result?.status === "not_found") {
    return invalid({ threadId: ["Choose a valid thread."] });
  }

  return unavailable();
}

function rpcResultToMutation(
  result: MessageRpcResult | null,
  expectedStatus: "replied" | "assigned" | "status_updated" | "noted",
): AdminMessageResult {
  if (result?.status === expectedStatus && result.thread) {
    return {
      kind: expectedStatus === "status_updated" ? "status-updated" : expectedStatus,
      messageId: result.message_id ?? undefined,
      thread: asThreadSummary(result.thread),
    };
  }

  if (result?.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result?.status === "invalid") {
    return invalid({ form: ["Message action is invalid."] });
  }

  return unavailable();
}

export async function listMessageThreads(input: ListMessageThreadsInput = {}): Promise<AdminMessageResult> {
  const validated = validateListInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_message_threads", {
    target_community_slug: validated.communitySlug,
    filter_status: validated.status,
    filter_category: validated.category,
    filter_property_id: validated.propertyId,
    filter_assigned_to: validated.assignedTo,
    filter_query: validated.query,
    filter_last_message_from: validated.lastMessageFrom,
    filter_last_message_to: validated.lastMessageTo,
    page_limit: validated.pageSize,
    page_offset: validated.pageOffset,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToRecords(data as MessageRpcResult | null);
}

export async function getMessageThreadDetail(input: ThreadInput): Promise<AdminMessageResult> {
  const validated = validateThreadInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_message_thread_detail", {
    target_thread_id: validated.threadId,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToThread(data as MessageRpcResult | null);
}

export async function replyToMessageThread(
  input: ReplyToMessageThreadInput,
): Promise<AdminMessageResult> {
  const validated = validateReplyInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reply_to_message_thread", {
    target_thread_id: validated.threadId,
    message_body: validated.body,
    message_attachment_document_ids: validated.attachmentDocumentIds,
  });

  if (error) {
    return unavailable();
  }

  const mutation = rpcResultToMutation(data as MessageRpcResult | null, "replied");

  if (mutation.kind === "replied" && mutation.messageId) {
    await sendMessageNotificationForMessage({
      messageId: mutation.messageId,
      type: "board_admin_reply",
    });
  }

  return mutation;
}

export async function addInternalNoteToMessageThread(
  input: AddInternalNoteInput,
): Promise<AdminMessageResult> {
  const validated = validateInternalNoteInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_message_internal_note", {
    target_thread_id: validated.threadId,
    note_body: validated.noteBody,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as MessageRpcResult | null, "noted");
}

export async function assignMessageThread(
  input: AssignMessageThreadInput,
): Promise<AdminMessageResult> {
  const validated = validateAssignInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_message_thread", {
    target_thread_id: validated.threadId,
    target_assigned_to: validated.assignedTo,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as MessageRpcResult | null, "assigned");
}

export async function setMessageThreadStatus(
  input: SetMessageThreadStatusInput,
): Promise<AdminMessageResult> {
  const validated = validateStatusInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_message_thread_status", {
    target_thread_id: validated.threadId,
    target_status: validated.status,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as MessageRpcResult | null, "status_updated");
}
