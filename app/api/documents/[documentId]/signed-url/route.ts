import { NextResponse } from "next/server";
import { createDocumentDownloadUrl } from "@/server/services/documents/document-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentSignedUrlRouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

type FailureCode = "invalid-request" | "not-found" | "documents-unavailable";

function withNoStore<T extends NextResponse>(response: T) {
  response.headers.set("Cache-Control", "no-store, max-age=0");

  return response;
}

function failure(code: FailureCode, message: string, status: number) {
  return withNoStore(
    NextResponse.json(
      {
        ok: false,
        code,
        message,
      },
      { status },
    ),
  );
}

export async function GET(request: Request, { params }: DocumentSignedUrlRouteContext) {
  const { documentId } = await params;
  const result = await createDocumentDownloadUrl({ documentId });

  if (result.kind === "download-url") {
    const shouldRedirect = new URL(request.url).searchParams.get("redirect") === "1";

    if (shouldRedirect) {
      return withNoStore(NextResponse.redirect(result.url, { status: 302 }));
    }

    return withNoStore(
      NextResponse.json({
        ok: true,
        url: result.url,
        expiresInSeconds: result.expiresInSeconds,
      }),
    );
  }

  if (result.kind === "invalid-input") {
    return failure("invalid-request", result.message, 400);
  }

  if (
    result.kind === "unauthenticated" ||
    result.kind === "profile-unavailable" ||
    result.kind === "permission-denied" ||
    result.kind === "not-found"
  ) {
    return failure("not-found", "Document is unavailable.", 404);
  }

  return failure("documents-unavailable", result.message, 503);
}
