"use server";

import { redirect } from "next/navigation";
import {
  uploadDocument,
  type DocumentUploadResult,
} from "@/server/services/documents/document-upload";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function fileValue(formData: FormData) {
  const file = formData.get("file");

  return file instanceof File && file.size > 0 ? file : null;
}

function redirectToAdminDocuments(input: {
  communitySlug: string;
  status: string;
  field?: string | null;
}): never {
  const params = new URLSearchParams({
    documentUpload: input.status,
    communitySlug: input.communitySlug,
  });

  if (input.field) {
    params.set("documentUploadField", input.field);
  }

  redirect(`/admin/documents?${params.toString()}`);
}

function invalidFieldFromErrors(fieldErrors: Record<string, string[]>) {
  const [firstField] = Object.keys(fieldErrors);

  return firstField || "form";
}

function documentUploadStatusKey(
  result: Exclude<DocumentUploadResult, { kind: "uploaded" | "invalid-input" }>,
) {
  switch (result.kind) {
    case "permission-denied":
      return "denied";
    case "unauthenticated":
      return "signin";
    case "profile-unavailable":
    case "documents-unavailable":
      return "unavailable";
  }
}

export async function uploadAdminDocument(formData: FormData) {
  const communitySlug = stringValue(formData.get("communitySlug")) || DEFAULT_COMMUNITY_SLUG;
  const result = await uploadDocument({
    communitySlug,
    title: stringValue(formData.get("title")),
    description: stringValue(formData.get("description")) || null,
    category: stringValue(formData.get("category")),
    visibility: stringValue(formData.get("visibility")),
    relatedPropertyId: stringValue(formData.get("relatedPropertyId")) || null,
    relatedVendorId: stringValue(formData.get("relatedVendorId")) || null,
    relatedMeetingId: stringValue(formData.get("relatedMeetingId")) || null,
    relatedComplianceTaskId: stringValue(formData.get("relatedComplianceTaskId")) || null,
    relatedAssessmentId: stringValue(formData.get("relatedAssessmentId")) || null,
    effectiveDate: stringValue(formData.get("effectiveDate")) || null,
    expirationDate: stringValue(formData.get("expirationDate")) || null,
    file: fileValue(formData),
  });

  if (result.kind === "uploaded") {
    redirectToAdminDocuments({ communitySlug, status: "uploaded" });
  }

  if (result.kind === "invalid-input") {
    redirectToAdminDocuments({
      communitySlug,
      status: "invalid",
      field: invalidFieldFromErrors(result.fieldErrors),
    });
  }

  redirectToAdminDocuments({ communitySlug, status: documentUploadStatusKey(result) });
}
