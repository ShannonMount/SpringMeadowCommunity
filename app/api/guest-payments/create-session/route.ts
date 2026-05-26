import { NextRequest, NextResponse } from "next/server";
import {
  guestPaymentLookupExpiredMessage,
  guestPaymentSessionInvalidMessage,
  guestPaymentSessionRateLimitedMessage,
  guestPaymentSessionTurnstileMessage,
  guestPaymentSessionUnavailableMessage,
  validateGuestPaymentSessionRequest,
  type GuestPaymentSessionApiResponse,
  type GuestPaymentSessionErrors,
} from "@/lib/public/guest-payment-session";
import {
  checkPublicRateLimit,
  createPublicRateLimitKey,
  derivePublicClientIp,
} from "@/server/public/rate-limit";
import { verifyTurnstile } from "@/server/public/turnstile";
import {
  guestPaymentLookupCookieName,
  guestPaymentLookupCookiePath,
  hashGuestPaymentLookupToken,
} from "@/server/services/payments/guest-property-lookup";
import { createGuestPaymentSession } from "@/server/services/payments/guest-payment-session";

const SESSION_RATE_LIMIT = 6;
const SESSION_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV !== "development",
  path: guestPaymentLookupCookiePath,
};

function jsonResponse(body: GuestPaymentSessionApiResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function clearLookupCookie(response: NextResponse<GuestPaymentSessionApiResponse>) {
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
  code: Exclude<GuestPaymentSessionApiResponse, { ok: true }>["code"],
  message: string,
  status = 400,
  errors?: GuestPaymentSessionErrors,
  options?: { clearLookupCookie?: boolean },
) {
  const response = jsonResponse(
    {
      ok: false,
      code,
      message,
      errors,
    },
    status,
  );

  return options?.clearLookupCookie ? clearLookupCookie(response) : response;
}

export function deriveRemoteIp(request: Request) {
  return derivePublicClientIp(request);
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return failure("invalid-request", guestPaymentSessionInvalidMessage, 400, {
      form: guestPaymentSessionInvalidMessage,
    });
  }

  const validation = validateGuestPaymentSessionRequest(payload);

  if (!validation.ok) {
    return failure("invalid-request", guestPaymentSessionInvalidMessage, 400, validation.errors);
  }

  const remoteIp = deriveRemoteIp(request);
  const rateLimit = checkPublicRateLimit({
    key: createPublicRateLimitKey("guest-payment-session", request),
    limit: SESSION_RATE_LIMIT,
    windowMs: SESSION_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return failure("rate-limited", guestPaymentSessionRateLimitedMessage, 429);
  }

  const isHuman = await verifyTurnstile(validation.value.turnstileToken, remoteIp);

  if (!isHuman) {
    return failure("bot-protection-failed", guestPaymentSessionTurnstileMessage, 400, {
      turnstileToken: guestPaymentSessionTurnstileMessage,
    });
  }

  const continuationToken = request.cookies.get(guestPaymentLookupCookieName)?.value;

  if (!continuationToken) {
    return failure("lookup-expired", guestPaymentLookupExpiredMessage, 400, {
      form: guestPaymentLookupExpiredMessage,
    }, { clearLookupCookie: true });
  }

  const session = await createGuestPaymentSession({
    ...validation.value,
    lookupSessionTokenHash: hashGuestPaymentLookupToken(continuationToken),
  });

  if (session.kind === "session-created") {
    return clearLookupCookie(jsonResponse({
      ok: true,
      checkoutUrl: session.checkoutUrl,
    }));
  }

  if (session.kind === "lookup-expired") {
    return failure("lookup-expired", session.message, 400, {
      form: session.message,
    }, { clearLookupCookie: true });
  }

  if (session.kind === "invalid-request") {
    return failure("invalid-request", session.message, 400, {
      form: session.message,
    });
  }

  return failure("payment-unavailable", guestPaymentSessionUnavailableMessage, 503, {
    form: guestPaymentSessionUnavailableMessage,
  }, { clearLookupCookie: true });
}
