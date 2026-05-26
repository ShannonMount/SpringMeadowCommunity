import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import { PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const ANNOUNCEMENTS_UNAVAILABLE_MESSAGE =
  "Announcements are temporarily unavailable. Please try again later.";
const INVALID_ANNOUNCEMENT_INPUT_MESSAGE = "Please check the announcement details and try again.";
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_QUERY_LENGTH = 200;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ANNOUNCEMENT_VISIBILITIES = [
  "public",
  "resident",
  "board",
  "property_specific",
  "admin",
] as const;
const ANNOUNCEMENT_STATUSES = ["draft", "published", "expired", "archived"] as const;

type FieldErrors = Record<string, string[]>;

export type AnnouncementVisibility = (typeof ANNOUNCEMENT_VISIBILITIES)[number];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export type AnnouncementAttachment = {
  documentId: string;
  title: string;
  category: string;
  contentType: string;
  sizeBytes: number;
};

export type AnnouncementRecord = {
  id: string;
  communityId: string;
  title: string;
  body: string;
  visibility: AnnouncementVisibility;
  propertyIds: string[];
  status: AnnouncementStatus;
  pinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  attachments: AnnouncementAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type ListAnnouncementsInput = {
  communitySlug?: string | null;
  visibility?: string | null;
  status?: string | null;
  query?: string | null;
  propertyId?: string | null;
  currentOnly?: boolean | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type AnnouncementMutationInput = {
  communitySlug?: string | null;
  announcementId?: string | null;
  title: string;
  body: string;
  visibility: string;
  propertyIds?: string[] | null;
  status?: string | null;
  pinned?: boolean | null;
  publishAt?: string | null;
  expiresAt?: string | null;
  attachmentDocumentIds?: string[] | null;
};

export type AnnouncementLifecycleInput = {
  announcementId: string;
};

type AnnouncementRpcAttachment = {
  document_id?: string | null;
  title?: string | null;
  category?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
};

type AnnouncementRpcRow = {
  id?: string | null;
  community_id?: string | null;
  title?: string | null;
  body?: string | null;
  visibility?: string | null;
  property_ids?: string[] | null;
  status?: string | null;
  pinned?: boolean | null;
  publish_at?: string | null;
  expires_at?: string | null;
  attachments?: AnnouncementRpcAttachment[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AnnouncementRpcResult = {
  status?:
    | "ok"
    | "created"
    | "updated"
    | "published"
    | "expired"
    | "archived"
    | "permission_denied"
    | "invalid"
    | "unavailable";
  record?: AnnouncementRpcRow | null;
  before_record?: AnnouncementRpcRow | null;
  records?: AnnouncementRpcRow[] | null;
};

export type AnnouncementResult =
  | { kind: "records"; records: AnnouncementRecord[] }
  | { kind: "record"; record: AnnouncementRecord }
  | { kind: "created" | "updated" | "published" | "expired" | "archived"; record: AnnouncementRecord }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_ANNOUNCEMENT_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "announcements-unavailable"; message: typeof ANNOUNCEMENTS_UNAVAILABLE_MESSAGE };

type ValidatedListInput =
  | {
      kind: "valid";
      communitySlug: string;
      visibility: AnnouncementVisibility | null;
      status: AnnouncementStatus | null;
      query: string | null;
      propertyId: string | null;
      currentOnly: boolean;
      pageSize: number;
      pageOffset: number;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedMutationInput =
  | {
      kind: "valid";
      communitySlug: string;
      announcementId: string | null;
      title: string;
      body: string;
      visibility: AnnouncementVisibility;
      propertyIds: string[];
      status: AnnouncementStatus;
      pinned: boolean;
      publishAt: string;
      expiresAt: string | null;
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

function isVisibility(value: string): value is AnnouncementVisibility {
  return ANNOUNCEMENT_VISIBILITIES.includes(value as AnnouncementVisibility);
}

function isStatus(value: string): value is AnnouncementStatus {
  return ANNOUNCEMENT_STATUSES.includes(value as AnnouncementStatus);
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

function invalid(fieldErrors: FieldErrors): Extract<AnnouncementResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_ANNOUNCEMENT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<AnnouncementResult, { kind: "announcements-unavailable" }> {
  return { kind: "announcements-unavailable", message: ANNOUNCEMENTS_UNAVAILABLE_MESSAGE };
}

function addUuidArrayErrors(fieldErrors: FieldErrors, fieldName: string, values: string[] | null | undefined) {
  for (const value of values ?? []) {
    if (!isUuid(value)) {
      fieldErrors[fieldName] = ["Use valid identifiers."];
      return;
    }
  }
}

function normalizeIdentifierArray(values: string[] | null | undefined) {
  return Array.from(new Set((values ?? []).map((value) => safeString(value)).filter(Boolean)));
}

function normalizeTimestamp(value: string | null | undefined, fallback?: Date) {
  const trimmed = safeString(value);

  if (!trimmed) {
    return fallback ? fallback.toISOString() : null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function asVisibility(value: string | null | undefined): AnnouncementVisibility {
  return isVisibility(value ?? "") ? (value as AnnouncementVisibility) : "admin";
}

function asStatus(value: string | null | undefined): AnnouncementStatus {
  return isStatus(value ?? "") ? (value as AnnouncementStatus) : "draft";
}

function asAttachment(row: AnnouncementRpcAttachment): AnnouncementAttachment {
  return {
    documentId: row.document_id ?? "",
    title: row.title ?? "",
    category: row.category ?? "",
    contentType: row.content_type ?? "",
    sizeBytes: row.size_bytes ?? 0,
  };
}

function asRecord(row: AnnouncementRpcRow): AnnouncementRecord {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    title: row.title ?? "",
    body: row.body ?? "",
    visibility: asVisibility(row.visibility),
    propertyIds: row.property_ids ?? [],
    status: asStatus(row.status),
    pinned: row.pinned === true,
    publishAt: row.publish_at ?? "",
    expiresAt: row.expires_at ?? null,
    attachments: (row.attachments ?? []).map(asAttachment).filter((attachment) => attachment.documentId),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function validateListInput(input: ListAnnouncementsInput = {}): ValidatedListInput {
  const fieldErrors: FieldErrors = {};
  const visibility = optionalString(input.visibility);
  const status = optionalString(input.status);
  const propertyId = optionalString(input.propertyId);
  const query = safeString(input.query);

  if (visibility && !isVisibility(visibility)) {
    fieldErrors.visibility = ["Choose a valid visibility."];
  }

  if (status && !isStatus(status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (propertyId && !isUuid(propertyId)) {
    fieldErrors.propertyId = ["Property is invalid."];
  }

  if (query.length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search is too long."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug: optionalString(input.communitySlug) ?? DEFAULT_COMMUNITY_SLUG,
    visibility: visibility as AnnouncementVisibility | null,
    status: status as AnnouncementStatus | null,
    query: query || null,
    propertyId,
    currentOnly: input.currentOnly !== false,
    pageSize: boundedPageSize(input.pageSize),
    pageOffset: boundedPageOffset(input.pageOffset),
  };
}

function validateMutationInput(input: AnnouncementMutationInput, requireId = false): ValidatedMutationInput {
  const fieldErrors: FieldErrors = {};
  const title = safeString(input.title);
  const body = safeString(input.body);
  const visibility = safeString(input.visibility);
  const status = optionalString(input.status) ?? "draft";
  const propertyIds = normalizeIdentifierArray(input.propertyIds);
  const attachmentDocumentIds = normalizeIdentifierArray(input.attachmentDocumentIds);
  const announcementId = optionalString(input.announcementId);
  const publishAt = normalizeTimestamp(input.publishAt, new Date());
  const expiresAt = normalizeTimestamp(input.expiresAt);

  if (requireId && !isUuid(announcementId)) {
    fieldErrors.announcementId = ["Announcement is invalid."];
  }

  if (!title || title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = ["Enter a title of 200 characters or fewer."];
  }

  if (!body || body.length > MAX_BODY_LENGTH) {
    fieldErrors.body = ["Enter body text of 5000 characters or fewer."];
  }

  if (!isVisibility(visibility)) {
    fieldErrors.visibility = ["Choose a valid visibility."];
  }

  if (!isStatus(status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (visibility === "property_specific" && propertyIds.length === 0) {
    fieldErrors.propertyIds = ["Enter at least one property ID."];
  }

  addUuidArrayErrors(fieldErrors, "propertyIds", propertyIds);
  addUuidArrayErrors(fieldErrors, "attachmentDocumentIds", attachmentDocumentIds);

  if (!publishAt) {
    fieldErrors.publishAt = ["Enter a valid publish date."];
  }

  if (safeString(input.expiresAt) && !expiresAt) {
    fieldErrors.expiresAt = ["Enter a valid expiration date."];
  }

  if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
    fieldErrors.expiresAt = ["Expiration must be after publish date."];
  }

  if (Object.keys(fieldErrors).length > 0 || !publishAt || !isVisibility(visibility) || !isStatus(status)) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug: optionalString(input.communitySlug) ?? DEFAULT_COMMUNITY_SLUG,
    announcementId: announcementId ?? null,
    title,
    body,
    visibility,
    propertyIds,
    status,
    pinned: input.pinned === true,
    publishAt,
    expiresAt,
    attachmentDocumentIds,
  };
}

async function requireActiveProfile(): Promise<AnnouncementResult | null> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  return null;
}

function rpcDenied(): AnnouncementResult {
  return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
}

function rpcResultToMutation(
  result: AnnouncementRpcResult | null,
  expectedStatus: "created" | "updated" | "published" | "expired" | "archived",
): AnnouncementResult {
  if (!result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return rpcDenied();
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Announcement details are invalid."] });
  }

  if (result.status !== expectedStatus || !result.record) {
    return unavailable();
  }

  const record = asRecord(result.record);

  return { kind: expectedStatus, record };
}

export async function listAnnouncements(input: ListAnnouncementsInput = {}): Promise<AnnouncementResult> {
  const validated = validateListInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_announcements", {
    target_community_slug: validated.communitySlug,
    filter_visibility: validated.visibility,
    filter_status: validated.status,
    filter_query: validated.query,
    filter_property_id: validated.propertyId,
    current_only: validated.currentOnly,
    page_limit: validated.pageSize,
    page_offset: validated.pageOffset,
  });
  const result = data as AnnouncementRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Announcement filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "records",
    records: (result.records ?? []).map(asRecord),
  };
}

export async function createAnnouncement(input: AnnouncementMutationInput): Promise<AnnouncementResult> {
  const validated = validateMutationInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_announcement", {
    target_community_slug: validated.communitySlug,
    announcement_title: validated.title,
    announcement_body: validated.body,
    announcement_visibility_value: validated.visibility,
    announcement_property_ids: validated.propertyIds,
    announcement_status_value: validated.status,
    announcement_pinned: validated.pinned,
    announcement_publish_at: validated.publishAt,
    announcement_expires_at: validated.expiresAt,
    announcement_attachment_document_ids: validated.attachmentDocumentIds,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as AnnouncementRpcResult | null, "created");
}

export async function updateAnnouncement(input: AnnouncementMutationInput): Promise<AnnouncementResult> {
  const validated = validateMutationInput(input, true);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_announcement", {
    target_announcement_id: validated.announcementId,
    announcement_title: validated.title,
    announcement_body: validated.body,
    announcement_visibility_value: validated.visibility,
    announcement_property_ids: validated.propertyIds,
    announcement_status_value: validated.status,
    announcement_pinned: validated.pinned,
    announcement_publish_at: validated.publishAt,
    announcement_expires_at: validated.expiresAt,
    announcement_attachment_document_ids: validated.attachmentDocumentIds,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as AnnouncementRpcResult | null, "updated");
}

async function lifecycleAnnouncement(
  input: AnnouncementLifecycleInput,
  rpcName: "publish_announcement" | "expire_announcement" | "archive_announcement",
  expectedStatus: "published" | "expired" | "archived",
): Promise<AnnouncementResult> {
  if (!isUuid(input.announcementId)) {
    return invalid({ announcementId: ["Announcement is invalid."] });
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, {
    target_announcement_id: input.announcementId,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as AnnouncementRpcResult | null, expectedStatus);
}

export async function publishAnnouncement(input: AnnouncementLifecycleInput): Promise<AnnouncementResult> {
  return lifecycleAnnouncement(input, "publish_announcement", "published");
}

export async function expireAnnouncement(input: AnnouncementLifecycleInput): Promise<AnnouncementResult> {
  return lifecycleAnnouncement(input, "expire_announcement", "expired");
}

export async function archiveAnnouncement(input: AnnouncementLifecycleInput): Promise<AnnouncementResult> {
  return lifecycleAnnouncement(input, "archive_announcement", "archived");
}
