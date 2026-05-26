import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import * as permissionService from "@/server/services/auth/permissions";
import type { PermissionResult } from "@/server/services/auth/permissions";

const DOCUMENT_MANAGE_PERMISSION = "admin.documents.manage";
const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const DOCUMENTS_UNAVAILABLE_MESSAGE =
  "Document metadata is unavailable. Please contact the HOA for help.";
const INVALID_DOCUMENT_INPUT_MESSAGE = "Please check the document details and try again.";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const MAX_QUERY_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 120;
const MAX_STORAGE_BUCKET_LENGTH = 120;
const MAX_STORAGE_PATH_LENGTH = 1024;
const MAX_CONTENT_TYPE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CHECKSUM_LENGTH = 128;
const MAX_SIZE_BYTES = Number.MAX_SAFE_INTEGER;
const MESSAGE_ATTACHMENT_CATEGORY = "message_attachment";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHECKSUM_PATTERN = /^[A-Za-z0-9:_=+./-]+$/;

const DOCUMENT_VISIBILITIES = [
  "public",
  "resident",
  "board",
  "vendor",
  "property_specific",
  "admin",
] as const;
const DOCUMENT_STATUSES = ["active", "archived", "deleted"] as const;
const STORAGE_PROVIDERS = ["supabase_storage", "cloudflare_r2", "s3"] as const;

type FieldErrors = Record<string, string[]>;

export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentStorageProvider = (typeof STORAGE_PROVIDERS)[number];

export type DocumentMetadataRecord = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  category: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  relatedPropertyId: string | null;
  relatedVendorId: string | null;
  relatedMeetingId: string | null;
  relatedComplianceTaskId: string | null;
  relatedAssessmentId: string | null;
  storageProvider: DocumentStorageProvider;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  checksum: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  uploadedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDocumentMetadataInput = {
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
  storageProvider?: string | null;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
};

export type UpdateDocumentMetadataInput = {
  communityId?: string | null;
  communitySlug?: string | null;
  documentId: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  visibility?: string | null;
  relatedPropertyId?: string | null;
  relatedVendorId?: string | null;
  relatedMeetingId?: string | null;
  relatedComplianceTaskId?: string | null;
  relatedAssessmentId?: string | null;
  storageProvider?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
  clearDescription?: boolean | null;
  clearRelatedPropertyId?: boolean | null;
  clearRelatedVendorId?: boolean | null;
  clearRelatedMeetingId?: boolean | null;
  clearRelatedComplianceTaskId?: boolean | null;
  clearRelatedAssessmentId?: boolean | null;
  clearChecksum?: boolean | null;
  clearEffectiveDate?: boolean | null;
  clearExpirationDate?: boolean | null;
};

export type ListDocumentMetadataInput = {
  communityId?: string | null;
  communitySlug?: string | null;
  visibility?: string | null;
  category?: string | null;
  status?: string | null;
  relatedPropertyId?: string | null;
  query?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  expirationFrom?: string | null;
  expirationTo?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

type CommunityResolution =
  | { kind: "resolved"; communityId: string; communitySlug: string }
  | { kind: "invalid-input"; fieldErrors: FieldErrors }
  | { kind: "documents-unavailable"; message: typeof DOCUMENTS_UNAVAILABLE_MESSAGE };

type DocumentMetadataRpcResult = {
  status?: "created" | "updated" | "ok" | "permission_denied" | "invalid" | "unavailable";
  record?: DocumentMetadataRpcRow | null;
  records?: DocumentMetadataRpcRow[] | null;
};

type DocumentMetadataRpcRow = {
  id?: string | null;
  community_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  visibility?: string | null;
  status?: string | null;
  related_property_id?: string | null;
  related_vendor_id?: string | null;
  related_meeting_id?: string | null;
  related_compliance_task_id?: string | null;
  related_assessment_id?: string | null;
  storage_provider?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  uploaded_by?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DocumentMetadataResult =
  | { kind: "record"; record: DocumentMetadataRecord }
  | { kind: "records"; communityId: string; communitySlug: string; records: DocumentMetadataRecord[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof permissionService.PERMISSION_DENIED_MESSAGE }
  | {
      kind: "invalid-input";
      message: typeof INVALID_DOCUMENT_INPUT_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "documents-unavailable"; message: typeof DOCUMENTS_UNAVAILABLE_MESSAGE };

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

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isIncluded<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function safeString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: string | null | undefined) {
  const trimmed = safeString(value);

  return trimmed || null;
}

function shouldClearOptionalString(
  value: string | null | undefined,
  clearFlag: boolean | null | undefined,
) {
  return (
    clearFlag === true ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
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

function hasUnsafeStoragePathSegment(value: string) {
  return (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment === "..")
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

function validateOptionalDate(
  fieldErrors: FieldErrors,
  fieldName: string,
  value: string | null | undefined,
) {
  const trimmed = safeString(value);

  if (trimmed && !isValidDateOnly(trimmed)) {
    fieldErrors[fieldName] = ["Date must use YYYY-MM-DD."];
  }
}

function invalid(fieldErrors: FieldErrors): Extract<DocumentMetadataResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_DOCUMENT_INPUT_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<DocumentMetadataResult, { kind: "documents-unavailable" }> {
  return { kind: "documents-unavailable", message: DOCUMENTS_UNAVAILABLE_MESSAGE };
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

  if (!communitySlug) {
    fieldErrors.communitySlug = ["Community is required."];

    return { kind: "invalid-input", fieldErrors };
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

const hasPermission = permissionService.hasPermission;
const PERMISSION_DENIED_MESSAGE = permissionService.PERMISSION_DENIED_MESSAGE;

function permissionResultToDocument(result: PermissionResult): DocumentMetadataResult | null {
  if (result.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (result.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (result.kind === "permission-denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  return null;
}

function validateDocumentDates(input: {
  effectiveDate?: string | null;
  expirationDate?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  expirationFrom?: string | null;
  expirationTo?: string | null;
}) {
  const fieldErrors: FieldErrors = {};

  validateOptionalDate(fieldErrors, "effectiveDate", input.effectiveDate);
  validateOptionalDate(fieldErrors, "expirationDate", input.expirationDate);
  validateOptionalDate(fieldErrors, "effectiveFrom", input.effectiveFrom);
  validateOptionalDate(fieldErrors, "effectiveTo", input.effectiveTo);
  validateOptionalDate(fieldErrors, "expirationFrom", input.expirationFrom);
  validateOptionalDate(fieldErrors, "expirationTo", input.expirationTo);

  if (
    input.effectiveDate &&
    input.expirationDate &&
    isValidDateOnly(input.effectiveDate) &&
    isValidDateOnly(input.expirationDate) &&
    input.expirationDate < input.effectiveDate
  ) {
    fieldErrors.expirationDate = ["Expiration date must be after effective date."];
  }

  if (
    input.effectiveFrom &&
    input.effectiveTo &&
    isValidDateOnly(input.effectiveFrom) &&
    isValidDateOnly(input.effectiveTo) &&
    input.effectiveTo < input.effectiveFrom
  ) {
    fieldErrors.effectiveTo = ["Effective end date must be after effective start date."];
  }

  if (
    input.expirationFrom &&
    input.expirationTo &&
    isValidDateOnly(input.expirationFrom) &&
    isValidDateOnly(input.expirationTo) &&
    input.expirationTo < input.expirationFrom
  ) {
    fieldErrors.expirationTo = ["Expiration end date must be after expiration start date."];
  }

  return fieldErrors;
}

function validateStorageFields(input: {
  storageProvider?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
}) {
  const fieldErrors: FieldErrors = {};
  const storageProvider = safeString(input.storageProvider) || STORAGE_PROVIDERS[0];
  const storageBucket = safeString(input.storageBucket);
  const storagePath = safeString(input.storagePath);
  const contentType = safeString(input.contentType);
  const checksum = optionalString(input.checksum);

  if (!isIncluded(STORAGE_PROVIDERS, storageProvider)) {
    fieldErrors.storageProvider = ["Storage provider is not supported."];
  }

  if (!storageBucket || storageBucket.length > MAX_STORAGE_BUCKET_LENGTH) {
    fieldErrors.storageBucket = ["Storage bucket is required."];
  }

  if (
    !storagePath ||
    storagePath.length > MAX_STORAGE_PATH_LENGTH ||
    hasUnsafeStoragePathSegment(storagePath)
  ) {
    fieldErrors.storagePath = ["Storage path is invalid."];
  }

  if (
    !contentType ||
    contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    !contentType.includes("/")
  ) {
    fieldErrors.contentType = ["Content type is invalid."];
  }

  if (!isPositiveInteger(input.sizeBytes) || Number(input.sizeBytes) > MAX_SIZE_BYTES) {
    fieldErrors.sizeBytes = ["Size must be a positive integer byte count."];
  }

  if (checksum && (checksum.length > MAX_CHECKSUM_LENGTH || !CHECKSUM_PATTERN.test(checksum))) {
    fieldErrors.checksum = ["Checksum is invalid."];
  }

  return fieldErrors;
}

function validateCreateInput(input: CreateDocumentMetadataInput): FieldErrors {
  const fieldErrors: FieldErrors = {};
  const title = safeString(input.title);
  const category = safeString(input.category);
  const visibility = safeString(input.visibility);
  const status = safeString(input.status) || "active";
  const description = optionalString(input.description);

  if (!title || title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = ["Title is required."];
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = ["Description is too long."];
  }

  if (!category || category.length > MAX_CATEGORY_LENGTH) {
    fieldErrors.category = ["Category is required."];
  }

  if (!isIncluded(DOCUMENT_VISIBILITIES, visibility)) {
    fieldErrors.visibility = ["Visibility is not supported."];
  }

  if (!isIncluded(DOCUMENT_STATUSES, status)) {
    fieldErrors.status = ["Status is not supported."];
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

  return {
    ...fieldErrors,
    ...validateStorageFields(input),
    ...validateDocumentDates(input),
  };
}

function validateUpdateInput(input: UpdateDocumentMetadataInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  if (!isUuid(input.documentId)) {
    fieldErrors.documentId = ["Document is required."];
  }

  if (input.title !== null && input.title !== undefined) {
    const title = safeString(input.title);

    if (!title || title.length > MAX_TITLE_LENGTH) {
      fieldErrors.title = ["Title is required."];
    }
  }

  if (input.description !== null && input.description !== undefined) {
    const description = optionalString(input.description);

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      fieldErrors.description = ["Description is too long."];
    }
  }

  if (input.category !== null && input.category !== undefined) {
    const category = safeString(input.category);

    if (!category || category.length > MAX_CATEGORY_LENGTH) {
      fieldErrors.category = ["Category is required."];
    }
  }

  if (input.visibility && !isIncluded(DOCUMENT_VISIBILITIES, input.visibility)) {
    fieldErrors.visibility = ["Visibility is not supported."];
  }

  if (input.visibility === "property_specific" && !isUuid(safeString(input.relatedPropertyId))) {
    fieldErrors.relatedPropertyId = ["Property-specific documents require a related property."];
  }

  if (input.status && !isIncluded(DOCUMENT_STATUSES, input.status)) {
    fieldErrors.status = ["Status is not supported."];
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

  const storageFieldErrors: FieldErrors = {};
  const storageProvider = optionalString(input.storageProvider);
  const storageBucket = optionalString(input.storageBucket);
  const storagePath = optionalString(input.storagePath);
  const contentType = optionalString(input.contentType);
  const checksum = optionalString(input.checksum);

  if (storageProvider && !isIncluded(STORAGE_PROVIDERS, storageProvider)) {
    storageFieldErrors.storageProvider = ["Storage provider is not supported."];
  }

  if (input.storageBucket !== null && input.storageBucket !== undefined) {
    if (!storageBucket || storageBucket.length > MAX_STORAGE_BUCKET_LENGTH) {
      storageFieldErrors.storageBucket = ["Storage bucket is required."];
    }
  }

  if (input.storagePath !== null && input.storagePath !== undefined) {
    if (
      !storagePath ||
      storagePath.length > MAX_STORAGE_PATH_LENGTH ||
      hasUnsafeStoragePathSegment(storagePath)
    ) {
      storageFieldErrors.storagePath = ["Storage path is invalid."];
    }
  }

  if (input.contentType !== null && input.contentType !== undefined) {
    if (
      !contentType ||
      contentType.length > MAX_CONTENT_TYPE_LENGTH ||
      !contentType.includes("/")
    ) {
      storageFieldErrors.contentType = ["Content type is invalid."];
    }
  }

  if (input.sizeBytes !== null && input.sizeBytes !== undefined) {
    if (!isPositiveInteger(input.sizeBytes) || Number(input.sizeBytes) > MAX_SIZE_BYTES) {
      storageFieldErrors.sizeBytes = ["Size must be a positive integer byte count."];
    }
  }

  if (checksum && (checksum.length > MAX_CHECKSUM_LENGTH || !CHECKSUM_PATTERN.test(checksum))) {
    storageFieldErrors.checksum = ["Checksum is invalid."];
  }

  return {
    ...fieldErrors,
    ...storageFieldErrors,
    ...validateDocumentDates(input),
  };
}

function validateListInput(input: ListDocumentMetadataInput): FieldErrors {
  const fieldErrors: FieldErrors = {};

  if (input.visibility && !isIncluded(DOCUMENT_VISIBILITIES, input.visibility)) {
    fieldErrors.visibility = ["Visibility is not supported."];
  }

  if (input.status && !isIncluded(DOCUMENT_STATUSES, input.status)) {
    fieldErrors.status = ["Status is not supported."];
  }

  if (input.category && safeString(input.category).length > MAX_CATEGORY_LENGTH) {
    fieldErrors.category = ["Category is too long."];
  }

  if (input.relatedPropertyId && !isUuid(input.relatedPropertyId)) {
    fieldErrors.relatedPropertyId = ["Property is invalid."];
  }

  if (input.query && safeString(input.query).length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search text is too long."];
  }

  if (input.pageSize !== null && input.pageSize !== undefined && !isPositiveInteger(input.pageSize)) {
    fieldErrors.pageSize = ["Page size must be positive."];
  }

  if (
    input.pageOffset !== null &&
    input.pageOffset !== undefined &&
    !isNonNegativeInteger(input.pageOffset)
  ) {
    fieldErrors.pageOffset = ["Page offset cannot be negative."];
  }

  return {
    ...fieldErrors,
    ...validateDocumentDates(input),
  };
}

function asDocumentVisibility(value: string | null | undefined): DocumentVisibility {
  const normalized = value ?? "";

  return isIncluded(DOCUMENT_VISIBILITIES, normalized) ? normalized : "admin";
}

function asDocumentStatus(value: string | null | undefined): DocumentStatus {
  const normalized = value ?? "";

  return isIncluded(DOCUMENT_STATUSES, normalized) ? normalized : "active";
}

function asStorageProvider(value: string | null | undefined): DocumentStorageProvider {
  const normalized = value ?? "";

  return isIncluded(STORAGE_PROVIDERS, normalized) ? normalized : "supabase_storage";
}

function asRecord(row: DocumentMetadataRpcRow): DocumentMetadataRecord {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    title: row.title ?? "",
    description: row.description ?? null,
    category: row.category ?? "",
    visibility: asDocumentVisibility(row.visibility),
    status: asDocumentStatus(row.status),
    relatedPropertyId: row.related_property_id ?? null,
    relatedVendorId: row.related_vendor_id ?? null,
    relatedMeetingId: row.related_meeting_id ?? null,
    relatedComplianceTaskId: row.related_compliance_task_id ?? null,
    relatedAssessmentId: row.related_assessment_id ?? null,
    storageProvider: asStorageProvider(row.storage_provider),
    storageBucket: row.storage_bucket ?? "",
    storagePath: row.storage_path ?? "",
    contentType: row.content_type ?? "",
    sizeBytes: row.size_bytes ?? 0,
    checksum: row.checksum ?? null,
    effectiveDate: row.effective_date ?? null,
    expirationDate: row.expiration_date ?? null,
    uploadedBy: row.uploaded_by ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

async function requireDocumentManagementPermission(communityId: string): Promise<PermissionResult> {
  return hasPermission({
    communityId,
    permissionKey: DOCUMENT_MANAGE_PERMISSION,
  });
}

export async function createDocumentMetadata(
  input: CreateDocumentMetadataInput,
): Promise<DocumentMetadataResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateCreateInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requireDocumentManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToDocument(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_document_metadata", {
    target_community_id: community.communityId,
    document_title: safeString(input.title),
    document_description: optionalString(input.description),
    document_category: safeString(input.category),
    document_visibility_value: safeString(input.visibility),
    target_related_property_id: optionalString(input.relatedPropertyId),
    target_related_vendor_id: optionalString(input.relatedVendorId),
    target_related_meeting_id: optionalString(input.relatedMeetingId),
    target_related_compliance_task_id: optionalString(input.relatedComplianceTaskId),
    target_related_assessment_id: optionalString(input.relatedAssessmentId),
    document_storage_provider: safeString(input.storageProvider) || STORAGE_PROVIDERS[0],
    document_storage_bucket: safeString(input.storageBucket),
    document_storage_path: safeString(input.storagePath),
    document_content_type: safeString(input.contentType),
    document_size_bytes: input.sizeBytes,
    document_checksum: optionalString(input.checksum),
    document_effective_date: optionalString(input.effectiveDate),
    document_expiration_date: optionalString(input.expirationDate),
    document_status: safeString(input.status) || "active",
  });
  const result = data as DocumentMetadataRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Document metadata is invalid."] });
  }

  if (result.status !== "created" || !result.record) {
    return unavailable();
  }

  return { kind: "record", record: asRecord(result.record) };
}

export async function updateDocumentMetadata(
  input: UpdateDocumentMetadataInput,
): Promise<DocumentMetadataResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateUpdateInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const permission = await requireDocumentManagementPermission(community.communityId);

  if (permission.kind !== "authorized") {
    return permissionResultToDocument(permission) ?? unavailable();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_document_metadata", {
    target_community_id: community.communityId,
    target_document_id: input.documentId,
    document_title: optionalString(input.title),
    document_description: optionalString(input.description),
    document_category: optionalString(input.category),
    document_visibility_value: optionalString(input.visibility),
    target_related_property_id: optionalString(input.relatedPropertyId),
    target_related_vendor_id: optionalString(input.relatedVendorId),
    target_related_meeting_id: optionalString(input.relatedMeetingId),
    target_related_compliance_task_id: optionalString(input.relatedComplianceTaskId),
    target_related_assessment_id: optionalString(input.relatedAssessmentId),
    document_storage_provider: optionalString(input.storageProvider),
    document_storage_bucket: optionalString(input.storageBucket),
    document_storage_path: optionalString(input.storagePath),
    document_content_type: optionalString(input.contentType),
    document_size_bytes: input.sizeBytes ?? null,
    document_checksum: optionalString(input.checksum),
    document_effective_date: optionalString(input.effectiveDate),
    document_expiration_date: optionalString(input.expirationDate),
    document_status: optionalString(input.status),
    clear_description: shouldClearOptionalString(input.description, input.clearDescription),
    clear_related_property_id: shouldClearOptionalString(
      input.relatedPropertyId,
      input.clearRelatedPropertyId,
    ),
    clear_related_vendor_id: shouldClearOptionalString(
      input.relatedVendorId,
      input.clearRelatedVendorId,
    ),
    clear_related_meeting_id: shouldClearOptionalString(
      input.relatedMeetingId,
      input.clearRelatedMeetingId,
    ),
    clear_related_compliance_task_id: shouldClearOptionalString(
      input.relatedComplianceTaskId,
      input.clearRelatedComplianceTaskId,
    ),
    clear_related_assessment_id: shouldClearOptionalString(
      input.relatedAssessmentId,
      input.clearRelatedAssessmentId,
    ),
    clear_checksum: shouldClearOptionalString(input.checksum, input.clearChecksum),
    clear_effective_date: shouldClearOptionalString(input.effectiveDate, input.clearEffectiveDate),
    clear_expiration_date: shouldClearOptionalString(
      input.expirationDate,
      input.clearExpirationDate,
    ),
  });
  const result = data as DocumentMetadataRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Document metadata is invalid."] });
  }

  if (result.status !== "updated" || !result.record) {
    return unavailable();
  }

  return { kind: "record", record: asRecord(result.record) };
}

export async function listDocumentMetadata(
  input: ListDocumentMetadataInput = {},
): Promise<DocumentMetadataResult> {
  const community = await resolveCommunity(input);

  if (community.kind === "invalid-input") {
    return invalid(community.fieldErrors);
  }

  if (community.kind !== "resolved") {
    return unavailable();
  }

  const fieldErrors = validateListInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_document_metadata", {
    target_community_id: community.communityId,
    filter_visibility: optionalString(input.visibility),
    filter_category: optionalString(input.category),
    filter_status: optionalString(input.status),
    filter_related_property_id: optionalString(input.relatedPropertyId),
    filter_query: optionalString(input.query),
    filter_effective_from: optionalString(input.effectiveFrom),
    filter_effective_to: optionalString(input.effectiveTo),
    filter_expiration_from: optionalString(input.expirationFrom),
    filter_expiration_to: optionalString(input.expirationTo),
    page_limit: boundedPageSize(input.pageSize),
    page_offset: boundedPageOffset(input.pageOffset),
  });
  const result = data as DocumentMetadataRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Document filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "records",
    communityId: community.communityId,
    communitySlug: community.communitySlug,
    records: (result.records ?? [])
      .map(asRecord)
      .filter((record) => record.category !== MESSAGE_ATTACHMENT_CATEGORY),
  };
}
