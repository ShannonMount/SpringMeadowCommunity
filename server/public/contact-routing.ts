import "server-only";
import type { PublicContactRequest } from "@/lib/public/contact";

export type ContactRoutingResult = {
  ok: boolean;
};

export async function routePublicContactRequest(
  request: PublicContactRequest,
): Promise<ContactRoutingResult> {
  const recipient = process.env.CONTACT_TO_EMAIL;

  if (process.env.NODE_ENV === "production") {
    return { ok: false };
  }

  console.info("Public contact request accepted", {
    communitySlug: request.communitySlug,
    name: request.name,
    email: request.email,
    hasPhone: Boolean(request.phone),
    messageLength: request.message.length,
    recipientConfigured: Boolean(recipient),
  });

  return { ok: true };
}
