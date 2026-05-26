import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import {
  getResidentPortalMemberships,
} from "@/server/services/auth/resident-portal";
import { PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE } from "@/server/services/auth/property-memberships";
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
const RESIDENT_MESSAGE_STATUSES = ["open", "pending_board", "pending_resident", "closed"] as const;
const MESSAGE_SENDER_ROLES = ["resident", "board_member", "admin"] as const;

type FieldErrors = Record<string, string[]>;

export type ResidentHistoryCategory = (typeof MESSAGE_CATEGORIES)[number];
export type ResidentHistoryStatus = (typeof RESIDENT_MESSAGE_STATUSES)[number];
export type ResidentHistorySenderRole = (typeof MESSAGE_SENDER_ROLES)[number];

export type ResidentMessageProfileSummary = {
  displayName: string;
};

export type ResidentMessageThreadSummary = {
  threadId: string;
  communityId: string;
  propertyId: string;
  propertyLabel: string;
  subject: string;
  category: ResidentHistoryCategory;
  status: ResidentHistoryStatus;
  createdBy: ResidentMessageProfileSummary | null;
  lastMessageAt: string;
  closedAt: string | null;
  createdAt: string;
  messageCount: number;
  attachmentCount: number;
};

export type ResidentMessage = {
  messageId: string;
  threadId: string;
  propertyId: string;
  senderRole: ResidentHistorySenderRole;
  senderDisplayName: string;
  body: string;
  attachmentCount: number;
  createdAt: string;
};

export type ListResidentMessageThreadsInput = {
  communitySlug?: string | null;
  propertyId?: string | null;
  status?: string | null;
  category?: string | null;
  query?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type ResidentThreadInput = {
  threadId: string;
};

export type ReplyToResidentMessageThreadInput = {
  threadId: string;
  body: string;
  attachmentDocumentIds?: string[] | null;
};

type ProfileSummaryRpcRow = {
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
  created_by?: ProfileSummaryRpcRow | null;
  last_message_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  message_count?: number | null;
  attachment_count?: number | null;
};

type MessageRpcRow = {
  message_id?: string | null;
  thread_id?: string | null;
  property_id?: string | null;
  sender_role?: string | null;
  sender_display_name?: string | null;
  body?: string | null;
  attachment_count?: number | null;
  created_at?: string | null;
};

type MessageRpcResult = {
  status?:
    | "ok"
    | "replied"
    | "permission_denied"
    | "invalid"
    | "not_found"
    | "unavailable";
  records?: ThreadRpcRow[] | null;
  thread?: ThreadRpcRow | null;
  messages?: MessageRpcRow[] | null;
  message_id?: string | null;
};

export type ResidentMessageHistoryResult =
  | { kind: "records"; records: ResidentMessageThreadSummary[] }
  | { kind: "thread"; thread: ResidentMessageThreadSummary; messages: ResidentMessage[] }
  | { kind: "replied"; thread: ResidentMessageThreadSummary; messageId: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "no-active-membership"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_MESSAGE_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "messages-unavailable"; message: typeof MESSAGES_UNAVAILABLE_MESSAGE };

type ValidatedListInput =
  | {
      kind: "valid";
      communitySlug: string;
      propertyId: string | null;
      status: ResidentHistoryStatus | null;
      category: ResidentHistoryCategory | null;
      query: string | null;
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

function addUuidArrayErrors(fieldErrors: FieldErrors, fieldName: string, values: string[]) {
  for (const value of values) {
    if (!isUuid(value)) {
      fieldErrors[fieldName] = ["Use valid identifiers."];
      return;
    }
  }
}

function invalid(
  fieldErrors: FieldErrors,
): Extract<ResidentMessageHistoryResult, { kind: "invalid-input" }> {
  return { kind: "invalid-input", message: INVALID_MESSAGE_INPUT_MESSAGE, fieldErrors };
}

function unavailable(): Extract<ResidentMessageHistoryResult, { kind: "messages-unavailable" }> {
  return { kind: "messages-unavailable", message: MESSAGES_UNAVAILABLE_MESSAGE };
}

function asCategory(value: string | null | undefined): ResidentHistoryCategory {
  return isIncluded(MESSAGE_CATEGORIES, value ?? "") ? (value as ResidentHistoryCategory) : "general";
}

function asStatus(value: string | null | undefined): ResidentHistoryStatus {
  return isIncluded(RESIDENT_MESSAGE_STATUSES, value ?? "")
    ? (value as ResidentHistoryStatus)
    : "open";
}

function asSenderRole(value: string | null | undefined): ResidentHistorySenderRole {
  return isIncluded(MESSAGE_SENDER_ROLES, value ?? "") ? (value as ResidentHistorySenderRole) : "resident";
}

function asProfileSummary(row: ProfileSummaryRpcRow | null | undefined): ResidentMessageProfileSummary | null {
  if (!row?.display_name) {
    return null;
  }

  return {
    displayName: row.display_name,
  };
}

function asThreadSummary(row: ThreadRpcRow): ResidentMessageThreadSummary {
  return {
    threadId: row.thread_id ?? "",
    communityId: row.community_id ?? "",
    propertyId: row.property_id ?? "",
    propertyLabel: row.property_label ?? "Unknown property",
    subject: row.subject ?? "",
    category: asCategory(row.category),
    status: asStatus(row.status),
    createdBy: asProfileSummary(row.created_by),
    lastMessageAt: row.last_message_at ?? "",
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at ?? "",
    messageCount: row.message_count ?? 0,
    attachmentCount: row.attachment_count ?? 0,
  };
}

function asMessage(row: MessageRpcRow): ResidentMessage {
  return {
    messageId: row.message_id ?? "",
    threadId: row.thread_id ?? "",
    propertyId: row.property_id ?? "",
    senderRole: asSenderRole(row.sender_role),
    senderDisplayName: row.sender_display_name ?? "Unknown user",
    body: row.body ?? "",
    attachmentCount: row.attachment_count ?? 0,
    createdAt: row.created_at ?? "",
  };
}

function validateListInput(input: ListResidentMessageThreadsInput): ValidatedListInput {
  const fieldErrors: FieldErrors = {};
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;
  const propertyId = optionalString(input.propertyId);
  const status = optionalString(input.status);
  const category = optionalString(input.category);
  const query = optionalString(input.query);

  if (propertyId && !isUuid(propertyId)) {
    fieldErrors.propertyId = ["Choose a linked property."];
  }

  if (status && !isIncluded(RESIDENT_MESSAGE_STATUSES, status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (category && !isIncluded(MESSAGE_CATEGORIES, category)) {
    fieldErrors.category = ["Choose a valid category."];
  }

  if (query && query.length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search text is too long."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    category: category as ResidentHistoryCategory | null,
    communitySlug,
    pageOffset: boundedPageOffset(input.pageOffset),
    pageSize: boundedPageSize(input.pageSize),
    propertyId,
    query,
    status: status as ResidentHistoryStatus | null,
  };
}

function validateThreadInput(input: ResidentThreadInput): ValidatedThreadInput {
  if (!isUuid(input.threadId)) {
    return { kind: "invalid", fieldErrors: { threadId: ["Choose a valid thread."] } };
  }

  return { kind: "valid", threadId: input.threadId };
}

function validateReplyInput(input: ReplyToResidentMessageThreadInput): ValidatedReplyInput {
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
    attachmentDocumentIds,
    body,
    threadId: input.threadId,
  };
}

async function requireResidentAccess(): Promise<ResidentMessageHistoryResult | null> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const memberships = await getResidentPortalMemberships();

  if (memberships.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (memberships.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (memberships.kind !== "active-memberships") {
    return { kind: "no-active-membership", message: PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };
  }

  return null;
}

function rpcResultToRecords(result: MessageRpcResult | null): ResidentMessageHistoryResult {
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

function rpcResultToThread(result: MessageRpcResult | null): ResidentMessageHistoryResult {
  if (result?.status === "ok" && result.thread) {
    return {
      kind: "thread",
      messages: (result.messages ?? []).map(asMessage),
      thread: asThreadSummary(result.thread),
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

export async function listResidentMessageThreads(
  input: ListResidentMessageThreadsInput = {},
): Promise<ResidentMessageHistoryResult> {
  const validated = validateListInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const accessBlocker = await requireResidentAccess();

  if (accessBlocker) {
    return accessBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_resident_message_threads", {
    target_community_slug: validated.communitySlug,
    filter_property_id: validated.propertyId,
    filter_status: validated.status,
    filter_category: validated.category,
    filter_query: validated.query,
    page_limit: validated.pageSize,
    page_offset: validated.pageOffset,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToRecords(data as MessageRpcResult | null);
}

export async function getResidentMessageThreadDetail(
  input: ResidentThreadInput,
): Promise<ResidentMessageHistoryResult> {
  const validated = validateThreadInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const accessBlocker = await requireResidentAccess();

  if (accessBlocker) {
    return accessBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_resident_message_thread_detail", {
    target_thread_id: validated.threadId,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToThread(data as MessageRpcResult | null);
}

export async function replyToResidentMessageThread(
  input: ReplyToResidentMessageThreadInput,
): Promise<ResidentMessageHistoryResult> {
  const validated = validateReplyInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const accessBlocker = await requireResidentAccess();

  if (accessBlocker) {
    return accessBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reply_to_resident_message_thread", {
    target_thread_id: validated.threadId,
    message_body: validated.body,
    message_attachment_document_ids: validated.attachmentDocumentIds,
  });

  if (error) {
    return unavailable();
  }

  const result = data as MessageRpcResult | null;

  if (result?.status === "replied" && result.thread && result.message_id) {
    const record = {
      messageId: result.message_id,
      thread: asThreadSummary(result.thread),
    };

    await sendMessageNotificationForMessage({
      messageId: record.messageId,
      type: "resident_reply",
    });

    return { kind: "replied", messageId: record.messageId, thread: record.thread };
  }

  if (result?.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result?.status === "invalid") {
    return invalid({ form: ["Message reply is invalid."] });
  }

  return unavailable();
}
