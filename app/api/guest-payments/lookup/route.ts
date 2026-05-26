import { NextResponse } from "next/server";
import {
  guestLookupInvalidMessage,
  guestLookupRateLimitedMessage,
  guestLookupTurnstileMessage,
  validateGuestPaymentLookupRequest,
  type GuestPaymentLookupApiResponse,
  type GuestPaymentLookupErrors,
} from "@/lib/public/guest-payment-lookup";
import {
  checkPublicRateLimit,
  createPublicRateLimitKey,
  derivePublicClientIp,
} from "@/server/public/rate-limit";
import { verifyTurnstile } from "@/server/public/turnstile";
import {
  createGuestPropertyLookup,
  guestPaymentLookupCookieName,
  guestPaymentLookupCookiePath,
} from "@/server/services/payments/guest-property-lookup";

const LOOKUP_RATE_LIMIT = 8;
const LOOKUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV !== "development",
  path: guestPaymentLookupCookiePath,
};

function jsonResponse(body: GuestPaymentLookupApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function clearLookupCookie(response: NextResponse<GuestPaymentLookupApiResponse>) {
  response.cookies.set(guestPaymentLookupCookieName, "", {
    ...cookieOptions,
    maxAge: 0,
  });
  response.cookies.set(guestPaymentLookupCookieName, "", {
    ...cookieOptions,
    path: "/",
    maxAge: 0,
  });

  return response;
}

function failure(
  code: Exclude<GuestPaymentLookupApiResponse, { ok: true }>["code"],
  message: string,
  status = 400,
  errors?: GuestPaymentLookupErrors,
) {
  return clearLookupCookie(jsonResponse(
    {
      ok: false,
      canProceed: false,
      code,
      message,
      errors,
    },
    status,
  ));
}

export function deriveRemoteIp(request: Request) {
  return derivePublicClientIp(request);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return failure("invalid-request", guestLookupInvalidMessage, 400, {
      form: guestLookupInvalidMessage,
    });
  }

  const validation = validateGuestPaymentLookupRequest(payload);

  if (!validation.ok) {
    return failure("invalid-request", guestLookupInvalidMessage, 400, validation.errors);
  }

  const remoteIp = deriveRemoteIp(request);
  const rateLimit = checkPublicRateLimit({
    key: createPublicRateLimitKey("guest-payment-lookup", request),
    limit: LOOKUP_RATE_LIMIT,
    windowMs: LOOKUP_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return failure("rate-limited", guestLookupRateLimitedMessage, 429);
  }

  const isHuman = await verifyTurnstile(validation.value.turnstileToken, remoteIp);

  if (!isHuman) {
    return failure("bot-protection-failed", guestLookupTurnstileMessage, 400, {
      turnstileToken: guestLookupTurnstileMessage,
    });
  }

  const lookup = await createGuestPropertyLookup(validation.value);

  if (lookup.kind === "lookup-confirmed") {
    const response = jsonResponse({
      ok: true,
      canProceed: true,
      message: lookup.message,
    });

    response.cookies.set(guestPaymentLookupCookieName, lookup.continuationToken, {
      ...cookieOptions,
      maxAge: lookup.maxAgeSeconds,
    });

    return response;
  }

  if (lookup.kind === "payment-unavailable") {
    return failure("payment-unavailable", lookup.message, 503);
  }

  return failure("not-confirmed", lookup.message, 200);
}
