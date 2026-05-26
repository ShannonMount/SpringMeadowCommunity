import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  guestLookupNotConfirmedMessage,
  guestLookupSuccessMessage,
  guestLookupUnavailableMessage,
  type GuestPaymentLookupRequest,
} from "@/lib/public/guest-payment-lookup";

type CommunityRow = {
  id: string;
};

type CommunitySettingRow = {
  guest_payments_enabled: boolean;
};

type MatchedPropertyRow = {
  id: string;
  community_id: string;
};

export type GuestPropertyLookupResult =
  | {
      kind: "lookup-confirmed";
      message: string;
      continuationToken: string;
      maxAgeSeconds: number;
    }
  | { kind: "not-confirmed"; message: string }
  | { kind: "payment-unavailable"; message: string };

export const guestPaymentLookupCookieName = "smc_guest_payment_context";
export const guestPaymentLookupCookiePath = "/api/guest-payments";
export const guestPaymentLookupSessionMaxAgeSeconds = 10 * 60;

function notConfirmed(): GuestPropertyLookupResult {
  return { kind: "not-confirmed", message: guestLookupNotConfirmedMessage };
}

function paymentUnavailable(): GuestPropertyLookupResult {
  return { kind: "payment-unavailable", message: guestLookupUnavailableMessage };
}

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function escapeIlike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function generateGuestPaymentLookupToken() {
  return randomBytes(32).toString("base64url");
}

export function hashGuestPaymentLookupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function findCommunity(input: GuestPaymentLookupRequest) {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", input.communitySlug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { supabase, community: data as CommunityRow };
}

export async function createGuestPropertyLookup(
  input: GuestPaymentLookupRequest,
): Promise<GuestPropertyLookupResult> {
  const communityResult = await findCommunity(input);

  if (!communityResult) {
    return notConfirmed();
  }

  const { supabase, community } = communityResult;
  const { data: settings, error: settingsError } = await supabase
    .from("community_settings")
    .select("guest_payments_enabled")
    .eq("community_id", community.id)
    .maybeSingle();

  if (settingsError || !(settings as CommunitySettingRow | null)?.guest_payments_enabled) {
    return paymentUnavailable();
  }

  let query = supabase
    .from("properties")
    .select("id, community_id")
    .eq("community_id", community.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(2);

  if (input.publicPaymentCode) {
    query = query.ilike("public_payment_code", escapeIlike(input.publicPaymentCode));
  } else if (input.accountNumber && input.postalCode) {
    query = query
      .ilike("account_number", escapeIlike(input.accountNumber))
      .eq("postal_code", input.postalCode);
  } else if (input.addressLine1 && input.postalCode) {
    query = query
      .ilike("address_line1", escapeIlike(input.addressLine1))
      .eq("postal_code", input.postalCode);
  } else {
    return notConfirmed();
  }

  const { data: properties, error: propertiesError } = await query;
  const matches = (properties ?? []) as MatchedPropertyRow[];

  if (propertiesError || matches.length !== 1) {
    return notConfirmed();
  }

  const continuationToken = generateGuestPaymentLookupToken();
  const tokenHash = hashGuestPaymentLookupToken(continuationToken);
  const expiresAt = new Date(
    Date.now() + guestPaymentLookupSessionMaxAgeSeconds * 1000,
  ).toISOString();

  const { error: sessionError } = await supabase.from("guest_payment_lookup_sessions").insert({
    community_id: community.id,
    property_id: matches[0].id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (sessionError) {
    return notConfirmed();
  }

  return {
    kind: "lookup-confirmed",
    message: guestLookupSuccessMessage,
    continuationToken,
    maxAgeSeconds: guestPaymentLookupSessionMaxAgeSeconds,
  };
}
