import {
  contactDeliveryErrorMessage,
  contactFormErrorMessage,
  validatePublicContactRequest,
  type PublicContactErrors,
} from "@/lib/public/contact";
import { routePublicContactRequest } from "@/server/public/contact-routing";
import { verifyTurnstile } from "@/server/public/turnstile";

function failure(errors: PublicContactErrors, status = 400) {
  return Response.json({ ok: false, errors }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return failure({ form: contactFormErrorMessage });
  }

  const validation = validatePublicContactRequest(payload);

  if (!validation.ok) {
    return failure(validation.errors);
  }

  const isHuman = await verifyTurnstile(validation.value.turnstileToken);

  if (!isHuman) {
    return failure({ turnstileToken: "Complete bot protection." });
  }

  const routed = await routePublicContactRequest(validation.value);

  if (!routed.ok) {
    return failure({ form: contactDeliveryErrorMessage }, 503);
  }

  return Response.json({ ok: true });
}
