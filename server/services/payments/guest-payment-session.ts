import "server-only";

import { getAppBaseUrl, getStripe } from "@/lib/stripe/server";
import {
  guestPaymentLookupExpiredMessage,
  guestPaymentSessionInvalidMessage,
  guestPaymentSessionUnavailableMessage,
  MAX_GUEST_PAYMENT_AMOUNT_CENTS,
  type GuestPaymentMethodPreference,
  type GuestPaymentSessionRequest,
} from "@/lib/public/guest-payment-session";
import { defaultGuestPaymentCommunitySlug } from "@/lib/public/guest-payment-lookup";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type StripePaymentMethodType = "card" | "us_bank_account";
type FeePolicy = "payer_pays" | "hoa_pays";

type LookupSessionRow = {
  id: string;
  community_id: string;
  property_id: string;
};

type CommunityRow = {
  id: string;
};

type CommunityPaymentSettingsRow = {
  community_id: string;
  stripe_account_mode: "platform" | "direct";
  stripe_connected_account_id: string | null;
  fee_policy: FeePolicy | "configurable";
  allow_card: boolean;
  allow_ach: boolean;
  guest_payments_enabled: boolean;
};

type PropertySnapshotRow = {
  id: string;
  community_id: string;
  account_number: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
};

type PendingPaymentRow = {
  id: string;
};

export type GuestPaymentPublicSettings =
  | {
      kind: "settings";
      allowCard: boolean;
      allowAch: boolean;
      onlinePaymentsAvailable: boolean;
    }
  | {
      kind: "unavailable";
      allowCard: false;
      allowAch: false;
      onlinePaymentsAvailable: false;
    };

export type GuestPaymentSessionInput = GuestPaymentSessionRequest & {
  lookupSessionTokenHash: string;
};

export type GuestPaymentSessionResult =
  | { kind: "session-created"; checkoutUrl: string }
  | { kind: "invalid-request"; message: typeof guestPaymentSessionInvalidMessage }
  | { kind: "lookup-expired"; message: typeof guestPaymentLookupExpiredMessage }
  | { kind: "payment-unavailable"; message: typeof guestPaymentSessionUnavailableMessage };

function invalidRequest(): GuestPaymentSessionResult {
  return { kind: "invalid-request", message: guestPaymentSessionInvalidMessage };
}

function lookupExpired(): GuestPaymentSessionResult {
  return { kind: "lookup-expired", message: guestPaymentLookupExpiredMessage };
}

function paymentUnavailable(): GuestPaymentSessionResult {
  return { kind: "payment-unavailable", message: guestPaymentSessionUnavailableMessage };
}

function isValidPaymentAmount(amountCents: number) {
  return (
    Number.isInteger(amountCents) &&
    amountCents > 0 &&
    amountCents <= MAX_GUEST_PAYMENT_AMOUNT_CENTS
  );
}

function resolvePaymentMethod(
  settings: CommunityPaymentSettingsRow,
  methodPreference: GuestPaymentMethodPreference | undefined,
): { databaseMethod: GuestPaymentMethodPreference; stripeMethod: StripePaymentMethodType } | null {
  const databaseMethod = methodPreference ?? (settings.allow_card ? "card" : "ach");

  if (databaseMethod === "card" && !settings.allow_card) {
    return null;
  }

  if (databaseMethod === "ach" && !settings.allow_ach) {
    return null;
  }

  if (databaseMethod === "ach") {
    return { databaseMethod, stripeMethod: "us_bank_account" };
  }

  return { databaseMethod, stripeMethod: "card" };
}

function resolveFeePolicy(feePolicy: CommunityPaymentSettingsRow["fee_policy"]): FeePolicy {
  return feePolicy === "hoa_pays" ? "hoa_pays" : "payer_pays";
}

function propertyAddressSnapshot(property: PropertySnapshotRow) {
  return [property.address_line1, property.address_line2, property.city, property.state, property.postal_code]
    .filter(Boolean)
    .join(", ");
}

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function getStripeContextOrNull() {
  try {
    return {
      stripe: getStripe(),
      appBaseUrl: getAppBaseUrl(),
    };
  } catch {
    return null;
  }
}

function unavailablePublicSettings(): GuestPaymentPublicSettings {
  return {
    kind: "unavailable",
    allowCard: false,
    allowAch: false,
    onlinePaymentsAvailable: false,
  };
}

function stripeRequestOptions(settings: CommunityPaymentSettingsRow) {
  return settings.stripe_account_mode === "direct" && settings.stripe_connected_account_id
    ? { stripeAccount: settings.stripe_connected_account_id }
    : undefined;
}

async function voidPendingPayment(input: {
  paymentId: string;
  communityId: string;
  supabase: NonNullable<ReturnType<typeof getTrustedClientOrNull>>;
}) {
  await input.supabase
    .from("payments")
    .update({ status: "void" })
    .eq("id", input.paymentId)
    .eq("community_id", input.communityId);
}

async function expireCheckoutSession(input: {
  sessionId: string;
  stripe: NonNullable<ReturnType<typeof getStripeContextOrNull>>["stripe"];
  requestOptions: ReturnType<typeof stripeRequestOptions>;
}) {
  try {
    await input.stripe.checkout.sessions.expire(input.sessionId, {}, input.requestOptions);
  } catch {
    // Best-effort cleanup: the local payment is still neutralized when this fails.
  }
}

export async function getGuestPaymentPublicSettings(
  communitySlug = defaultGuestPaymentCommunitySlug,
): Promise<GuestPaymentPublicSettings> {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return unavailablePublicSettings();
  }

  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", communitySlug)
    .eq("status", "active")
    .maybeSingle<CommunityRow>();

  if (communityError || !community) {
    return unavailablePublicSettings();
  }

  const { data: settings, error: settingsError } = await supabase
    .from("community_settings")
    .select("allow_card, allow_ach, guest_payments_enabled")
    .eq("community_id", community.id)
    .maybeSingle<
      Pick<CommunityPaymentSettingsRow, "allow_card" | "allow_ach" | "guest_payments_enabled">
    >();

  if (settingsError || !settings?.guest_payments_enabled) {
    return unavailablePublicSettings();
  }

  return {
    kind: "settings",
    allowCard: settings.allow_card,
    allowAch: settings.allow_ach,
    onlinePaymentsAvailable: settings.allow_card || settings.allow_ach,
  };
}

export async function createGuestPaymentSession(
  input: GuestPaymentSessionInput,
): Promise<GuestPaymentSessionResult> {
  if (
    !input.lookupSessionTokenHash ||
    !isValidPaymentAmount(input.amountCents) ||
    (input.methodPreference !== undefined &&
      input.methodPreference !== "card" &&
      input.methodPreference !== "ach")
  ) {
    return invalidRequest();
  }

  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return paymentUnavailable();
  }

  const claimedAt = new Date().toISOString();
  const { data: lookupSession, error: claimError } = await supabase
    .from("guest_payment_lookup_sessions")
    .update({ used_at: claimedAt })
    .eq("token_hash", input.lookupSessionTokenHash)
    .is("used_at", null)
    .gt("expires_at", claimedAt)
    .select("id, community_id, property_id")
    .maybeSingle<LookupSessionRow>();

  if (claimError || !lookupSession) {
    return lookupExpired();
  }

  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select("id")
    .eq("id", lookupSession.community_id)
    .eq("status", "active")
    .maybeSingle<CommunityRow>();

  if (communityError || !community) {
    return paymentUnavailable();
  }

  const { data: settings, error: settingsError } = await supabase
    .from("community_settings")
    .select(
      "community_id, stripe_account_mode, stripe_connected_account_id, fee_policy, allow_card, allow_ach, guest_payments_enabled",
    )
    .eq("community_id", lookupSession.community_id)
    .maybeSingle<CommunityPaymentSettingsRow>();

  if (settingsError || !settings?.guest_payments_enabled) {
    return paymentUnavailable();
  }

  const selectedMethod = resolvePaymentMethod(settings, input.methodPreference);

  if (!selectedMethod) {
    return paymentUnavailable();
  }

  if (settings.stripe_account_mode === "direct" && !settings.stripe_connected_account_id) {
    return paymentUnavailable();
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, community_id, account_number, address_line1, address_line2, city, state, postal_code")
    .eq("id", lookupSession.property_id)
    .eq("community_id", lookupSession.community_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle<PropertySnapshotRow>();

  if (propertyError || !property) {
    return paymentUnavailable();
  }

  const stripeContext = getStripeContextOrNull();

  if (!stripeContext) {
    return paymentUnavailable();
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      community_id: lookupSession.community_id,
      property_id: lookupSession.property_id,
      payer_type: "guest",
      profile_id: null,
      guest_name: input.payerName,
      guest_email: input.payerEmail,
      guest_phone: input.payerPhone ?? null,
      property_account_snapshot: property.account_number,
      property_address_snapshot: propertyAddressSnapshot(property),
      amount_cents: input.amountCents,
      currency: "USD",
      fee_policy: resolveFeePolicy(settings.fee_policy),
      method: selectedMethod.databaseMethod,
      status: "created",
      created_by: null,
    })
    .select("id")
    .single<PendingPaymentRow>();

  if (paymentError || !payment) {
    return paymentUnavailable();
  }

  const successUrl = `${stripeContext.appBaseUrl}/pay-dues/return?status=submitted`;
  const cancelUrl = `${stripeContext.appBaseUrl}/pay-dues/return?status=cancelled`;
  const requestOptions = stripeRequestOptions(settings);

  try {
    const session = await stripeContext.stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: [selectedMethod.stripeMethod],
        customer_email: input.payerEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Spring Meadow HOA dues",
              },
              unit_amount: input.amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          paymentId: payment.id,
          communityId: lookupSession.community_id,
          propertyId: lookupSession.property_id,
          payerType: "guest",
          method: selectedMethod.databaseMethod,
          lookupSessionId: lookupSession.id,
        },
      },
      requestOptions,
    );

    if (!session.url) {
      await expireCheckoutSession({
        sessionId: session.id,
        stripe: stripeContext.stripe,
        requestOptions,
      });
      await voidPendingPayment({
        paymentId: payment.id,
        communityId: lookupSession.community_id,
        supabase,
      });
      return paymentUnavailable();
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({ status: "pending", stripe_checkout_session_id: session.id })
      .eq("id", payment.id)
      .eq("community_id", lookupSession.community_id)
      .eq("status", "created")
      .select("id")
      .maybeSingle<PendingPaymentRow>();

    if (updateError || !updatedPayment) {
      await expireCheckoutSession({
        sessionId: session.id,
        stripe: stripeContext.stripe,
        requestOptions,
      });
      await voidPendingPayment({
        paymentId: payment.id,
        communityId: lookupSession.community_id,
        supabase,
      });
      return paymentUnavailable();
    }

    return { kind: "session-created", checkoutUrl: session.url };
  } catch {
    await voidPendingPayment({
      paymentId: payment.id,
      communityId: lookupSession.community_id,
      supabase,
    });
    return paymentUnavailable();
  }
}
