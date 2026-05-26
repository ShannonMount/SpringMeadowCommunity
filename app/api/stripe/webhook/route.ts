import { NextRequest, NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";
import { processStripeWebhookEvent } from "@/server/services/payments/stripe-webhook-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function webhookResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return webhookResponse(400, { ok: false, code: "missing-signature" });
  }

  let event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch {
    return webhookResponse(400, { ok: false, code: "signature-verification-failed" });
  }

  const result = await processStripeWebhookEvent(event);

  if (result.kind === "processed") {
    return webhookResponse(200, { ok: true, status: "processed" });
  }

  if (result.kind === "duplicate") {
    return webhookResponse(200, { ok: true, status: "duplicate" });
  }

  if (result.kind === "ignored") {
    return webhookResponse(200, { ok: true, status: "ignored" });
  }

  return webhookResponse(result.retryable ? 500 : 200, {
    ok: false,
    status: "failed",
    retryable: result.retryable,
  });
}
