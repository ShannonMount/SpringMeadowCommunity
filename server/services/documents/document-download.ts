import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import { PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";
import type {
  DocumentStatus,
  DocumentStorageProvider,
  DocumentVisibility,
} from "@/server/services/documents/document-metadata";

export const PUBLIC_DOCUMENT_BUCKET = "public-documents";
export const PRIVATE_DOCUMENT_BUCKET = "private-documents";
export const SIGNED_DOCUMENT_URL_EXPIRES_SECONDS = 60;

const DOCUMENTS_UNAVAILABLE_MESSAGE =
  "Document download is unavailable. Please contact the HOA for help.";
const INVALID_DOCUMENT_DOWNLOAD_MESSAGE = "Please check the document request and try again.";
const DOCUMENT_NOT_FOUND_MESSAGE = "Document is unavailable.";
const MESSAGE_ATTACHMENT_CATEGORY = "message_attachment";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FieldErrors = Record<string, string[]>;

type DocumentDownloadRpcResult = {
  status?: "allowed" | "permission_denied" | "not_found" | "invalid" | "unavailable";
  record?: DocumentDownloadRpcRow | null;
};

type DocumentDownloadRpcRow = {
  id?: string | null;
  community_id?: string | null;
  title?: string | null;
  category?: string | null;
  visibility?: string | null;
  status?: string | null;
  storage_provider?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
};

type AuthorizedDownloadRecord = {
  id: string;
  communityId: string;
  title: string;
  category: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  storageProvider: DocumentStorageProvider;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
};

export type DocumentDownloadResult =
  | {
      kind: "download-url";
      url: string;
      expiresInSeconds: number;
      access: "signed" | "public";
    }
  | {
      kind: "invalid-input";
      message: typeof INVALID_DOCUMENT_DOWNLOAD_MESSAGE;
      fieldErrors: FieldErrors;
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "not-found"; message: typeof DOCUMENT_NOT_FOUND_MESSAGE }
  | { kind: "documents-unavailable"; message: typeof DOCUMENTS_UNAVAILABLE_MESSAGE };

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function invalid(fieldErrors: FieldErrors): Extract<DocumentDownloadResult, { kind: "invalid-input" }> {
  return {
    kind: "invalid-input",
    message: INVALID_DOCUMENT_DOWNLOAD_MESSAGE,
    fieldErrors,
  };
}

function unavailable(): Extract<DocumentDownloadResult, { kind: "documents-unavailable" }> {
  return { kind: "documents-unavailable", message: DOCUMENTS_UNAVAILABLE_MESSAGE };
}

function asVisibility(value: string | null | undefined): DocumentVisibility {
  const allowed = ["public", "resident", "board", "vendor", "property_specific", "admin"];

  return allowed.includes(value ?? "") ? (value as DocumentVisibility) : "admin";
}

function asStatus(value: string | null | undefined): DocumentStatus {
  return value === "archived" || value === "deleted" ? value : "active";
}

function asStorageProvider(value: string | null | undefined): DocumentStorageProvider {
  const allowed = ["supabase_storage", "cloudflare_r2", "s3"];

  return allowed.includes(value ?? "") ? (value as DocumentStorageProvider) : "supabase_storage";
}

function asRecord(row: DocumentDownloadRpcRow): AuthorizedDownloadRecord {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    title: row.title ?? "",
    category: row.category ?? "",
    visibility: asVisibility(row.visibility),
    status: asStatus(row.status),
    storageProvider: asStorageProvider(row.storage_provider),
    storageBucket: row.storage_bucket ?? "",
    storagePath: row.storage_path ?? "",
    contentType: row.content_type ?? "",
    sizeBytes: row.size_bytes ?? 0,
  };
}

function isPrivateVisibility(visibility: DocumentVisibility) {
  return visibility !== "public";
}

function isPublicBucketRecord(record: AuthorizedDownloadRecord) {
  return (
    record.visibility === "public" &&
    record.status === "active" &&
    record.storageBucket === PUBLIC_DOCUMENT_BUCKET
  );
}

function isPrivateBucketRecord(record: AuthorizedDownloadRecord) {
  return isPrivateVisibility(record.visibility) && record.storageBucket === PRIVATE_DOCUMENT_BUCKET;
}

function trustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

async function communityIdForDeniedDocument(documentId: string) {
  const trustedClient = trustedClientOrNull();

  if (!trustedClient) {
    return null;
  }

  const { data } = await trustedClient
    .from("documents")
    .select("community_id")
    .eq("id", documentId)
    .maybeSingle<{ community_id: string }>();

  return data?.community_id ?? null;
}

async function recordDocumentAccessLog(input: {
  documentId: string;
  communityId?: string | null;
  access_type: "view" | "signed_url_created";
  result: "allowed" | "denied";
  reason?: string | null;
}) {
  const communityId = input.communityId ?? (await communityIdForDeniedDocument(input.documentId));

  if (!communityId) {
    return;
  }

  const trustedClient = trustedClientOrNull();

  if (!trustedClient) {
    return;
  }

  await trustedClient.from("document_access_logs").insert({
    community_id: communityId,
    document_id: input.documentId,
    access_type: input.access_type,
    result: input.result,
    reason: input.reason ?? null,
  });
}

async function permissionDenied(documentId: string): Promise<DocumentDownloadResult> {
  await recordDocumentAccessLog({
    documentId,
    access_type: "signed_url_created",
    result: "denied",
    reason: "authorization_failed",
  });

  const profile = await getCurrentProfile();

  if (profile.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profile.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
}

async function createSignedPrivateUrl(record: AuthorizedDownloadRecord): Promise<DocumentDownloadResult> {
  if (!isPrivateBucketRecord(record)) {
    return unavailable();
  }

  const trustedClient = trustedClientOrNull();

  if (!trustedClient) {
    return unavailable();
  }

  const { data, error } = await trustedClient.storage
    .from(PRIVATE_DOCUMENT_BUCKET)
    .createSignedUrl(record.storagePath, SIGNED_DOCUMENT_URL_EXPIRES_SECONDS);

  if (error || !data?.signedUrl) {
    return unavailable();
  }

  await recordDocumentAccessLog({
    documentId: record.id,
    communityId: record.communityId,
    access_type: "signed_url_created",
    result: "allowed",
  });

  return {
    kind: "download-url",
    url: data.signedUrl,
    expiresInSeconds: SIGNED_DOCUMENT_URL_EXPIRES_SECONDS,
    access: "signed",
  };
}

async function createPublicUrl(record: AuthorizedDownloadRecord): Promise<DocumentDownloadResult> {
  if (!isPublicBucketRecord(record)) {
    return unavailable();
  }

  const trustedClient = trustedClientOrNull();

  if (!trustedClient) {
    return unavailable();
  }

  const { data } = trustedClient.storage.from(PUBLIC_DOCUMENT_BUCKET).getPublicUrl(record.storagePath);

  if (!data?.publicUrl) {
    return unavailable();
  }

  await recordDocumentAccessLog({
    documentId: record.id,
    communityId: record.communityId,
    access_type: "view",
    result: "allowed",
  });

  return {
    kind: "download-url",
    url: data.publicUrl,
    expiresInSeconds: 0,
    access: "public",
  };
}

export async function createDocumentDownloadUrl(input: {
  documentId: string;
}): Promise<DocumentDownloadResult> {
  if (!isUuid(input.documentId)) {
    return invalid({ documentId: ["Document is invalid."] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_authorized_document_download_metadata", {
    target_document_id: input.documentId,
  });
  const result = data as DocumentDownloadRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "not_found") {
    return { kind: "not-found", message: DOCUMENT_NOT_FOUND_MESSAGE };
  }

  if (result.status === "permission_denied") {
    return permissionDenied(input.documentId);
  }

  if (result.status !== "allowed" || !result.record) {
    return unavailable();
  }

  const record = asRecord(result.record);

  if (record.category === MESSAGE_ATTACHMENT_CATEGORY) {
    await recordDocumentAccessLog({
      documentId: record.id,
      communityId: record.communityId,
      access_type: "signed_url_created",
      result: "denied",
      reason: "message_attachment_not_available",
    });

    return { kind: "not-found", message: DOCUMENT_NOT_FOUND_MESSAGE };
  }

  if (record.visibility === "public") {
    return createPublicUrl(record);
  }

  return createSignedPrivateUrl(record);
}
