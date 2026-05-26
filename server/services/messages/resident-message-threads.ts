import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import {
  getCurrentPropertyMemberships,
  PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE,
  type PropertyMembership,
} from "@/server/services/auth/property-memberships";
import { PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";
import { sendMessageNotificationForMessage } from "@/server/services/messages/message-notifications";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const INVALID_MESSAGE_INPUT_MESSAGE = "Please check the message details and try again.";
const MESSAGES_UNAVAILABLE_MESSAGE = "Messages are temporarily unavailable. Please try again later.";
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_SAFE_FILENAME_LENGTH = 180;
const MAX_MESSAGE_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const PRIVATE_DOCUMENT_BUCKET = "private-documents";
const MESSAGE_ATTACHMENT_CATEGORY = "message_attachment";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const MESSAGE_CATEGORIES = [
  "dues",
  "documents",
  "maintenance",
  "architectural",
  "complaint",
  "general",
] as const;

const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

type FieldErrors = Record<string, string[]>;

export type ResidentMessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export type ResidentMessageThreadInput = {
  communitySlug?: string | null;
  propertyId: string;
  subject: string;
  category: string;
  body: string;
  attachmentFiles?: File[] | null;
};

export type ResidentMessageThreadRecord = {
  threadId: string;
  communityId: string;
  propertyId: string;
  subject: string;
  category: ResidentMessageCategory;
  status: "open" | "pending_board" | "pending_resident" | "closed" | "archived";
  firstMessageId: string;
  attachmentCount: number;
  createdAt: string;
};

export type ResidentMessageThreadResult =
  | { kind: "created"; record: ResidentMessageThreadRecord }
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

type ValidatedThreadInput =
  | {
      kind: "valid";
      communitySlug: string;
      propertyId: string;
      subject: string;
      category: ResidentMessageCategory;
      body: string;
      attachmentFiles: File[];
      safeFilenames: string[];
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "permission-denied" }
  | { kind: "messages-unavailable" };

type MessageAttachment = {
  documentId: string;
  storagePath: string;
};

type MessageThreadRpcRow = {
  thread_id?: string | null;
  community_id?: string | null;
  property_id?: string | null;
  subject?: string | null;
  category?: string | null;
  status?: string | null;
  first_message_id?: string | null;
  attachment_count?: number | null;
  created_at?: string | null;
};

type MessageThreadRpcResult = {
  status?: "created" | "permission_denied" | "invalid" | "unavailable";
  record?: MessageThreadRpcRow | null;
};

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

function isMessageCategory(value: string): value is ResidentMessageCategory {
  return MESSAGE_CATEGORIES.includes(value as ResidentMessageCategory);
}

function isSupportedAttachmentMimeType(value: string) {
  return SUPPORTED_ATTACHMENT_MIME_TYPES.includes(
    value as (typeof SUPPORTED_ATTACHMENT_MIME_TYPES)[number],
  );
}

function sanitizeFileName(value: string | null | undefined) {
  const rawName = safeString(value).split(/[/\\]/).pop() ?? "";
  const normalized = rawName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, MAX_SAFE_FILENAME_LENGTH)
    .toLowerCase();

  return normalized || null;
}

function buildMessageAttachmentStoragePath(input: {
  communityId: string;
  uploadId: string;
  safeFilename: string;
}) {
  return ["communities", input.communityId, "messages", input.uploadId, input.safeFilename].join(
    "/",
  );
}

function checksumForBuffer(buffer: Buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function invalid(
  fieldErrors: FieldErrors,
): Extract<ResidentMessageThreadResult, { kind: "invalid-input" }> {
  return { kind: "invalid-input", message: INVALID_MESSAGE_INPUT_MESSAGE, fieldErrors };
}

function unavailable(): Extract<ResidentMessageThreadResult, { kind: "messages-unavailable" }> {
  return { kind: "messages-unavailable", message: MESSAGES_UNAVAILABLE_MESSAGE };
}

function validateThreadInput(input: ResidentMessageThreadInput): ValidatedThreadInput {
  const fieldErrors: FieldErrors = {};
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;
  const propertyId = safeString(input.propertyId);
  const subject = safeString(input.subject);
  const category = safeString(input.category);
  const body = safeString(input.body);
  const attachmentFiles = input.attachmentFiles ?? [];
  const safeFilenames: string[] = [];

  if (!isUuid(propertyId)) {
    fieldErrors.propertyId = ["Choose a linked property."];
  }

  if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
    fieldErrors.subject = ["Enter a subject of 200 characters or fewer."];
  }

  if (!isMessageCategory(category)) {
    fieldErrors.category = ["Choose a valid message category."];
  }

  if (!body || body.length > MAX_BODY_LENGTH) {
    fieldErrors.body = ["Enter a message of 5000 characters or fewer."];
  }

  if (attachmentFiles.length > MAX_MESSAGE_ATTACHMENTS) {
    fieldErrors.attachments = ["Attach no more than 3 files."];
  }

  for (const file of attachmentFiles) {
    const safeFilename = sanitizeFileName(file.name);

    if (!safeFilename) {
      fieldErrors.attachments = ["Attachment filename is invalid."];
      continue;
    }

    safeFilenames.push(safeFilename);

    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      fieldErrors.attachments = ["Attachment files cannot be empty."];
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      fieldErrors.attachments = ["Attachment file is too large."];
    }

    if (!isSupportedAttachmentMimeType(file.type)) {
      fieldErrors.attachments = ["Attachment file type is not supported."];
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !isUuid(propertyId) ||
    !isMessageCategory(category)
  ) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug,
    propertyId,
    subject,
    category,
    body,
    attachmentFiles,
    safeFilenames,
  };
}

function selectedMembership(
  memberships: PropertyMembership[],
  propertyId: string,
): PropertyMembership | null {
  return memberships.find((membership) => membership.property.id === propertyId) ?? null;
}

async function resolveCommunity(
  input: {
    communitySlug: string;
    membership: PropertyMembership;
  },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommunityResolution> {
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", input.communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return { kind: "messages-unavailable" };
  }

  if (data.id !== input.membership.communityId) {
    return { kind: "permission-denied" };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

async function createAttachmentMetadata(input: {
  actorProfileId: string;
  communityId: string;
  propertyId: string;
  storagePath: string;
  file: File;
  checksum: string;
  title: string;
  storageClient: ReturnType<typeof createServiceRoleClient>;
}) {
  const { data, error } = await input.storageClient
    .from("documents")
    .insert({
      community_id: input.communityId,
      title: input.title,
      description: null,
      category: MESSAGE_ATTACHMENT_CATEGORY,
      visibility: "property_specific",
      related_property_id: input.propertyId,
      storage_provider: "supabase_storage",
      storage_bucket: PRIVATE_DOCUMENT_BUCKET,
      storage_path: input.storagePath,
      content_type: input.file.type,
      size_bytes: input.file.size,
      checksum: input.checksum,
      status: "active",
      uploaded_by: input.actorProfileId,
      created_by: input.actorProfileId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    return null;
  }

  return data.id;
}

async function cleanupMessageAttachments(
  storageClient: ReturnType<typeof createServiceRoleClient>,
  actorProfileId: string,
  attachments: MessageAttachment[],
) {
  for (const attachment of attachments) {
    try {
      await storageClient.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([attachment.storagePath]);
    } catch {
      // Cleanup is best-effort; the resident still gets a generic failure.
    }

    try {
      await storageClient
        .from("documents")
        .update({
          status: "deleted",
          deleted_at: new Date().toISOString(),
          deleted_by: actorProfileId,
        })
        .eq("id", attachment.documentId);
    } catch {
      // Cleanup is best-effort; the resident still gets a generic failure.
    }
  }
}

async function uploadMessageAttachments(input: {
  actorProfileId: string;
  communityId: string;
  propertyId: string;
  files: File[];
  safeFilenames: string[];
}) {
  let storageClient: ReturnType<typeof createServiceRoleClient>;

  try {
    storageClient = createServiceRoleClient();
  } catch {
    return { kind: "unavailable" as const, attachments: [] as MessageAttachment[] };
  }

  const attachments: MessageAttachment[] = [];

  for (const [index, file] of input.files.entries()) {
    const uploadId = randomUUID();
    const safeFilename = input.safeFilenames[index] ?? "attachment";
    const storagePath = buildMessageAttachmentStoragePath({
      communityId: input.communityId,
      uploadId,
      safeFilename,
    });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await storageClient.storage
      .from(PRIVATE_DOCUMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      await cleanupMessageAttachments(storageClient, input.actorProfileId, attachments);

      return { kind: "unavailable" as const, attachments };
    }

    const documentId = await createAttachmentMetadata({
      actorProfileId: input.actorProfileId,
      communityId: input.communityId,
      propertyId: input.propertyId,
      storagePath,
      file,
      checksum: checksumForBuffer(buffer),
      title: safeFilename,
      storageClient,
    });

    if (!documentId) {
      try {
        await storageClient.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([storagePath]);
      } catch {
        // Cleanup is best-effort; the resident still gets a generic failure.
      }
      await cleanupMessageAttachments(storageClient, input.actorProfileId, attachments);

      return { kind: "unavailable" as const, attachments };
    }

    attachments.push({ documentId, storagePath });
  }

  return { kind: "uploaded" as const, storageClient, attachments };
}

function asCategory(value: string | null | undefined): ResidentMessageCategory {
  return isMessageCategory(value ?? "") ? (value as ResidentMessageCategory) : "general";
}

function asStatus(value: string | null | undefined): ResidentMessageThreadRecord["status"] {
  const allowed = ["open", "pending_board", "pending_resident", "closed", "archived"];

  return allowed.includes(value ?? "") ? (value as ResidentMessageThreadRecord["status"]) : "open";
}

function asRecord(row: MessageThreadRpcRow): ResidentMessageThreadRecord {
  return {
    threadId: row.thread_id ?? "",
    communityId: row.community_id ?? "",
    propertyId: row.property_id ?? "",
    subject: row.subject ?? "",
    category: asCategory(row.category),
    status: asStatus(row.status),
    firstMessageId: row.first_message_id ?? "",
    attachmentCount: row.attachment_count ?? 0,
    createdAt: row.created_at ?? "",
  };
}

export async function createResidentMessageThread(
  input: ResidentMessageThreadInput,
): Promise<ResidentMessageThreadResult> {
  const validation = validateThreadInput(input);

  if (validation.kind === "invalid") {
    return invalid(validation.fieldErrors);
  }

  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const membershipResult = await getCurrentPropertyMemberships();

  if (membershipResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (membershipResult.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (membershipResult.kind !== "active-memberships") {
    return { kind: "no-active-membership", message: PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };
  }

  const membership = selectedMembership(membershipResult.memberships, validation.propertyId);

  if (!membership) {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  const supabase = await createClient();
  const community = await resolveCommunity(
    { communitySlug: validation.communitySlug, membership },
    supabase,
  );

  if (community.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const attachmentUpload =
    validation.attachmentFiles.length > 0
      ? await uploadMessageAttachments({
          actorProfileId: profileResult.profile.id,
          communityId: community.communityId,
          propertyId: validation.propertyId,
          files: validation.attachmentFiles,
          safeFilenames: validation.safeFilenames,
        })
      : {
          kind: "uploaded" as const,
          storageClient: null,
          attachments: [] as MessageAttachment[],
        };

  if (attachmentUpload.kind !== "uploaded") {
    return unavailable();
  }

  const attachmentDocumentIds = attachmentUpload.attachments.map(
    (attachment) => attachment.documentId,
  );
  const { data, error } = await supabase.rpc("create_message_thread", {
    target_community_slug: community.communitySlug,
    target_property_id: validation.propertyId,
    message_subject: validation.subject,
    message_category: validation.category,
    message_body: validation.body,
    message_attachment_document_ids: attachmentDocumentIds,
  });
  const result = data as MessageThreadRpcResult | null;

  if (error || !result) {
    if (attachmentUpload.storageClient) {
      await cleanupMessageAttachments(
        attachmentUpload.storageClient,
        profileResult.profile.id,
        attachmentUpload.attachments,
      );
    }

    return unavailable();
  }

  if (result.status !== "created" || !result.record) {
    if (attachmentUpload.storageClient) {
      await cleanupMessageAttachments(
        attachmentUpload.storageClient,
        profileResult.profile.id,
        attachmentUpload.attachments,
      );
    }

    if (result.status === "invalid") {
      return invalid({ form: ["Message details are invalid."] });
    }

    if (result.status === "permission_denied") {
      return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
    }

    return unavailable();
  }

  const record = asRecord(result.record);

  await sendMessageNotificationForMessage({
    messageId: record.firstMessageId,
    type: "resident_thread_created",
  });

  return { kind: "created", record };
}
