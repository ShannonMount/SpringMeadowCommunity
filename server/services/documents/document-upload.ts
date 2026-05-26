import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import * as permissionService from "@/server/services/auth/permissions";
import type { PermissionResult } from "@/server/services/auth/permissions";
import { writeAuditLog } from "@/server/services/audit/write-audit-log";
import {
  createDocumentMetadata,
  type DocumentMetadataRecord,
  type DocumentMetadataResult,
} from "@/server/services/documents/document-metadata";

const DOCUMENT_UPLOAD_PERMISSION = "admin.documents.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DOCUMENTS_UNAVAILABLE_MESSAGE =
  "Document upload is unavailable. Please contact the HOA for help.";
const INVALID_DOCUMENT_UPLOAD_MESSAGE = "Please check the document upload details and try again.";

export const PUBLIC_DOCUMENT_BUCKET = "public-documents";
export const PRIVATE_DOCUMENT_BUCKET = "private-documents";
export const TEMP_DOCUMENT_BUCKET = "uploads-temp";
export const MAX_DOCUMENT_UPLOAD_BYTES = 6 * 1024 * 1024;

const MAX_TITLE_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SAFE_FILENAME_LENGTH = 180;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DOCUMENT_VISIBILITIES = [
  "public",
  "resident",
  "board",
  "vendor",
  "property_specific",
  "admin",
] as const;

export const SUPPORTED_DOCUMENT_MIME_TYPES = [
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

type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
type FieldErrors = Record<string, string[]>;

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "documents-unavailable"; message: typeof DOCUMENTS_UNAVAILABLE_MESSAGE };

type ValidatedUploadInput = {
  title: string;
  description: string | null;
  category: string;
  visibility: DocumentVisibility;
  relatedPropertyId: string | null;
  relatedVendorId: string | null;
  relatedMeetingId: string | null;
  relatedComplianceTaskId: string | null;
  relatedAssessmentId: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  file: File;
  safeFilename: string;
};

export type DocumentUploadInput = {
  communityId?: string | null;
  communitySlug?: string | null;
  title: string;
  description?: string | null;
  category: string;
  visibility: string;
  relatedPropertyId?: string | null;
  relatedVendorId?: string | null;
  relatedMeetingId?: string | null;
  relatedComplianceTaskId?: string | null;
  relatedAssessmentId?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  file?: File | null;
};

export type DocumentUploadResult =
  | { kind: "uploaded"; record: DocumentMetadataRecord }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_DOCUMENT_UPLOAD_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "documents-unavailable"; message: typeof DOCUMENTS_UNAVAILABLE_MESSAGE };

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

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateOnly(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  return isValidDateParts(year, month, day);
}

function isDocumentVisibility(value: string): value is DocumentVisibility {
  return DOCUMENT_VISIBILITIES.includes(value as DocumentVisibility);
}

function isSupportedMimeType(value: string) {
  return SUPPORTED_DOCUMENT_MIME_TYPES.includes(
    value as (typeof SUPPORTED_DOCUMENT_MIME_TYPES)[number],
  );
}

function addOptionalUuidError(
  fieldErrors: FieldErrors,
  fieldName: string,
  value: string | null | undefined,
) {
  const trimmed = safeString(value);

  if (trimmed && !isUuid(trimmed)) {
    fieldErrors[fieldName] = ["Identifier is invalid."];
  }
}

function addOptionalDateError(
  fieldErrors: FieldErrors,
  fieldName: string,
  value: string | null | undefined,
) {
  const trimmed = safeString(value);

  if (trimmed && !isValidDateOnly(trimmed)) {
    fieldErrors[fieldName] = ["Date must use YYYY-MM-DD."];
  }
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

function buildDocumentStoragePath(input: {
  communityId: string;
  visibility: DocumentVisibility;
  uploadId: string;
  safeFilename: string;
}) {
  return [
    "communities",
    input.communityId,
    "documents",
    input.visibility,
    input.uploadId,
    input.safeFilename,
  ].join("/");
}

function invalid(fieldErrors: FieldErrors): Extract<DocumentUploadResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_DOCUMENT_UPLOAD_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<DocumentUploadResult, { kind: "documents-unavailable" }> {
  return { kind: "documents-unavailable", message: DOCUMENTS_UNAVAILABLE_MESSAGE };
}

function permissionResultToUpload(result: PermissionResult): DocumentUploadResult | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: permissionService.PERMISSION_DENIED_MESSAGE };
  }

  return null;
}

function metadataResultToUpload(result: DocumentMetadataResult): DocumentUploadResult {
  if (result.kind === "record") {
    return { kind: "uploaded", record: result.record };
  }

  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: permissionService.PERMISSION_DENIED_MESSAGE };
  }

  if (result.kind === "invalid-input") {
    return invalid(result.fieldErrors);
  }

  return unavailable();
}

async function resolveCommunity(input: {
  communityId?: string | null;
  communitySlug?: string | null;
}): Promise<CommunityResolution> {
  const fieldErrors: FieldErrors = {};
  const communityId = safeString(input.communityId);
  const communitySlug = safeString(input.communitySlug) || DEFAULT_COMMUNITY_SLUG;

  if (communityId) {
    if (!isUuid(communityId)) {
      fieldErrors.communityId = ["Community is required."];

      return { kind: "invalid-input", fieldErrors };
    }

    return { kind: "resolved", communityId, communitySlug };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("slug", communitySlug)
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data?.id) {
    return { kind: "documents-unavailable", message: DOCUMENTS_UNAVAILABLE_MESSAGE };
  }

  return { kind: "resolved", communityId: data.id, communitySlug: data.slug };
}

function validateUploadInput(input: DocumentUploadInput):
  | { kind: "valid"; value: ValidatedUploadInput }
  | { kind: "invalid"; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const title = safeString(input.title);
  const description = optionalString(input.description);
  const category = safeString(input.category);
  const visibility = safeString(input.visibility);
  const effectiveDate = optionalString(input.effectiveDate);
  const expirationDate = optionalString(input.expirationDate);
  const file = input.file;
  const safeFilename = sanitizeFileName(file?.name);

  if (!title || title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = ["Title is required."];
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = ["Description is too long."];
  }

  if (!category || category.length > MAX_CATEGORY_LENGTH) {
    fieldErrors.category = ["Category is required."];
  }

  if (!isDocumentVisibility(visibility)) {
    fieldErrors.visibility = ["Visibility is not supported."];
  }

  if (!file) {
    fieldErrors.file = ["Choose a document to upload."];
  } else {
    if (!safeFilename) {
      fieldErrors.file = ["Document filename is invalid."];
    }

    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      fieldErrors.file = ["Document file is empty."];
    }

    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      fieldErrors.file = ["Document file is too large."];
    }

    if (!isSupportedMimeType(file.type)) {
      fieldErrors.file = ["Document file type is not supported."];
    }
  }

  if (visibility === "property_specific" && !isUuid(safeString(input.relatedPropertyId))) {
    fieldErrors.relatedPropertyId = ["Property-specific documents require a related property."];
  }

  for (const [fieldName, value] of [
    ["relatedPropertyId", input.relatedPropertyId],
    ["relatedVendorId", input.relatedVendorId],
    ["relatedMeetingId", input.relatedMeetingId],
    ["relatedComplianceTaskId", input.relatedComplianceTaskId],
    ["relatedAssessmentId", input.relatedAssessmentId],
  ] as const) {
    addOptionalUuidError(fieldErrors, fieldName, value);
  }

  addOptionalDateError(fieldErrors, "effectiveDate", effectiveDate);
  addOptionalDateError(fieldErrors, "expirationDate", expirationDate);

  if (
    effectiveDate &&
    expirationDate &&
    isValidDateOnly(effectiveDate) &&
    isValidDateOnly(expirationDate) &&
    expirationDate < effectiveDate
  ) {
    fieldErrors.expirationDate = ["Expiration date must be after effective date."];
  }

  if (Object.keys(fieldErrors).length > 0 || !isDocumentVisibility(visibility) || !file || !safeFilename) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    value: {
      title,
      description,
      category,
      visibility,
      relatedPropertyId: optionalString(input.relatedPropertyId),
      relatedVendorId: optionalString(input.relatedVendorId),
      relatedMeetingId: optionalString(input.relatedMeetingId),
      relatedComplianceTaskId: optionalString(input.relatedComplianceTaskId),
      relatedAssessmentId: optionalString(input.relatedAssessmentId),
      effectiveDate,
      expirationDate,
      file,
      safeFilename,
    },
  };
}

const hasPermission = permissionService.hasPermission;

async function requireDocumentUploadPermission(communityId: string) {
  return hasPermission({
    communityId,
    permissionKey: DOCUMENT_UPLOAD_PERMISSION,
  });
}

function bucketForVisibility(visibility: DocumentVisibility) {
  return visibility === "public" ? PUBLIC_DOCUMENT_BUCKET : PRIVATE_DOCUMENT_BUCKET;
}

function checksumForBuffer(buffer: Buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

async function auditSuccessfulUpload(input: {
  actorProfileId: string;
  communityId: string;
  documentId: string;
  record: DocumentMetadataRecord;
}) {
  await writeAuditLog({
    action: "document.storage.upload",
    actorProfileId: input.actorProfileId,
    communityId: input.communityId,
    targetType: "document",
    targetId: input.documentId,
    after: {
      documentId: input.documentId,
      visibility: input.record.visibility,
      category: input.record.category,
      contentType: input.record.contentType,
      sizeBytes: input.record.sizeBytes,
    },
  });
}

export async function uploadDocument(input: DocumentUploadInput): Promise<DocumentUploadResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const validation = validateUploadInput(input);

  if (validation.kind === "invalid") {
    return invalid(validation.fieldErrors);
  }

  const permission = await requireDocumentUploadPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToUpload(permission) ?? unavailable();
  }

  let storageClient: ReturnType<typeof createServiceRoleClient>;

  try {
    storageClient = createServiceRoleClient();
  } catch {
    return unavailable();
  }

  const { value } = validation;
  const bucket = bucketForVisibility(value.visibility);
  const uploadId = randomUUID();
  const storagePath = buildDocumentStoragePath({
    communityId: community.communityId,
    visibility: value.visibility,
    uploadId,
    safeFilename: value.safeFilename,
  });
  const file = value.file;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await storageClient.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return unavailable();
  }

  const metadataResult = await createDocumentMetadata({
    communityId: community.communityId,
    communitySlug: community.communitySlug,
    title: value.title,
    description: value.description,
    category: value.category,
    visibility: value.visibility,
    relatedPropertyId: value.relatedPropertyId,
    relatedVendorId: value.relatedVendorId,
    relatedMeetingId: value.relatedMeetingId,
    relatedComplianceTaskId: value.relatedComplianceTaskId,
    relatedAssessmentId: value.relatedAssessmentId,
    storageProvider: "supabase_storage",
    storageBucket: bucket,
    storagePath,
    contentType: file.type,
    sizeBytes: file.size,
    checksum: checksumForBuffer(buffer),
    effectiveDate: value.effectiveDate,
    expirationDate: value.expirationDate,
    status: "active",
  });

  if (metadataResult.kind !== "record") {
    await storageClient.storage.from(bucket).remove([storagePath]);

    return metadataResultToUpload(metadataResult);
  }

  await auditSuccessfulUpload({
    actorProfileId: permission.profile.id,
    communityId: community.communityId,
    documentId: metadataResult.record.id,
    record: metadataResult.record,
  });

  return { kind: "uploaded", record: metadataResult.record };
}
