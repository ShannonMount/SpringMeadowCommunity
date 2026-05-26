import "server-only";

import { getAppBaseUrl, getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { type CurrentProfile } from "@/server/services/auth/current-profile";
import { type PropertyMembership } from "@/server/services/auth/property-memberships";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_ASSESSMENT_STATUSES = ["open", "partially_paid", "overdue", "disputed"] as const;
const MAX_PAYMENT_AMOUNT_CENTS = 1000000;

const INVALID_PAYMENT_MESSAGE = "We could not start that payment. Check the amount and try again.";
const UNAUTHORIZED_PAYMENT_MESSAGE =
  "Payment is unavailable for this membership. Contact the HOA for help.";
const PAYMENT_CONFIGURATION_MESSAGE =
  "Online payments are temporarily unavailable. Please try again later.";
const PAYMENT_UNAVAILABLE_MESSAGE =
  "Online payments are temporarily unavailable. Please try again later.";

type PaymentMethodPreference = "card" | "ach";
type StripePaymentMethodType = "card" | "us_bank_account";
type FeePolicy = "payer_pays" | "hoa_pays";

type CommunityPaymentSettingsRow = {
  community_id: string;
  stripe_account_mode: "platform" | "direct";
  stripe_connected_account_id: string | null;
  fee_policy: FeePolicy | "configurable";
  allow_card: boolean;
  allow_ach: boolean;
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

type AssessmentBalanceRow = {
  id: string;
  balance_cents: number;
};

type PendingPaymentRow = {
  id: string;
};

export type ResidentPaymentSessionInput = {
  communityId: string;
  propertyId: string;
  amountCents: number;
  methodPreference?: PaymentMethodPreference;
};

export type ResidentPaymentSessionResult =
  | { kind: "session-created"; checkoutUrl: string }
  | { kind: "invalid-request"; message: typeof INVALID_PAYMENT_MESSAGE }
  | { kind: "unauthorized"; message: typeof UNAUTHORIZED_PAYMENT_MESSAGE }
  | { kind: "configuration-unavailable"; message: typeof PAYMENT_CONFIGURATION_MESSAGE }
  | { kind: "payment-unavailable"; message: typeof PAYMENT_UNAVAILABLE_MESSAGE };

export type ResidentPaymentSetting = {
  communityId: string;
  allowCard: boolean;
  allowAch: boolean;
  onlinePaymentsAvailable: boolean;
};

export type ResidentPaymentSettingsResult =
  | { kind: "payment-settings"; settings: ResidentPaymentSetting[] }
  | { kind: "payment-settings-unavailable"; message: typeof PAYMENT_CONFIGURATION_MESSAGE };

function invalidRequest(): ResidentPaymentSessionResult {
  return { kind: "invalid-request", message: INVALID_PAYMENT_MESSAGE };
}

function unauthorized(): ResidentPaymentSessionResult {
  return { kind: "unauthorized", message: UNAUTHORIZED_PAYMENT_MESSAGE };
}

function configurationUnavailable(): ResidentPaymentSessionResult {
  return { kind: "configuration-unavailable", message: PAYMENT_CONFIGURATION_MESSAGE };
}

function paymentUnavailable(): ResidentPaymentSessionResult {
  return { kind: "payment-unavailable", message: PAYMENT_UNAVAILABLE_MESSAGE };
}

function settingsUnavailable(): ResidentPaymentSettingsResult {
  return { kind: "payment-settings-unavailable", message: PAYMENT_CONFIGURATION_MESSAGE };
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isValidPaymentAmount(amountCents: number) {
  return (
    Number.isInteger(amountCents) &&
    amountCents > 0 &&
    amountCents <= MAX_PAYMENT_AMOUNT_CENTS
  );
}

function findAuthorizedMembership(input: {
  memberships: PropertyMembership[];
  communityId: string;
  propertyId: string;
}) {
  return input.memberships.find(
    (membership) =>
      membership.property.communityId === input.communityId &&
      membership.property.id === input.propertyId,
  );
}

function resolvePaymentMethod(
  settings: CommunityPaymentSettingsRow,
  methodPreference: PaymentMethodPreference | undefined,
): { databaseMethod: PaymentMethodPreference; stripeMethod: StripePaymentMethodType } | null {
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

async function loadPaymentSettings(communityId: string) {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("community_settings")
    .select(
      "community_id, stripe_account_mode, stripe_connected_account_id, fee_policy, allow_card, allow_ach",
    )
    .eq("community_id", communityId)
    .maybeSingle<CommunityPaymentSettingsRow>();

  if (error || !data) {
    return null;
  }

  return { supabase, settings: data };
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

export async function getResidentPaymentSettings(): Promise<ResidentPaymentSettingsResult> {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return settingsUnavailable();
  }

  const communityIds = Array.from(
    new Set(membershipResult.memberships.map((membership) => membership.property.communityId)),
  );
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return settingsUnavailable();
  }

  const { data, error } = await supabase
    .from("community_settings")
    .select("community_id, allow_card, allow_ach")
    .in("community_id", communityIds)
    .returns<Pick<CommunityPaymentSettingsRow, "community_id" | "allow_card" | "allow_ach">[]>();

  if (error) {
    return settingsUnavailable();
  }

  return {
    kind: "payment-settings",
    settings: (data ?? []).map((setting) => ({
      communityId: setting.community_id,
      allowCard: setting.allow_card,
      allowAch: setting.allow_ach,
      onlinePaymentsAvailable: setting.allow_card || setting.allow_ach,
    })),
  };
}

export async function createResidentPaymentSession(
  input: ResidentPaymentSessionInput,
): Promise<ResidentPaymentSessionResult> {
  if (
    !isUuid(input.communityId) ||
    !isUuid(input.propertyId) ||
    !isValidPaymentAmount(input.amountCents) ||
    (input.methodPreference !== undefined &&
      input.methodPreference !== "card" &&
      input.methodPreference !== "ach")
  ) {
    return invalidRequest();
  }

  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind !== "active-memberships") {
    return unauthorized();
  }

  const { profile, memberships } = membershipResult;
  const membership = findAuthorizedMembership({
    memberships,
    communityId: input.communityId,
    propertyId: input.propertyId,
  });
  const canPayDues = membership?.membershipPermissions.canPayDues === true;

  if (!membership || !canPayDues) {
    return unauthorized();
  }

  const canViewBalance = membership.membershipPermissions.canViewBalance;
  const settingsResult = await loadPaymentSettings(input.communityId);

  if (!settingsResult) {
    return configurationUnavailable();
  }

  const { supabase, settings } = settingsResult;
  const selectedMethod = resolvePaymentMethod(settings, input.methodPreference);

  if (!selectedMethod) {
    return paymentUnavailable();
  }

  if (settings.stripe_account_mode === "direct" && !settings.stripe_connected_account_id) {
    return configurationUnavailable();
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, community_id, account_number, address_line1, address_line2, city, state, postal_code")
    .eq("id", input.propertyId)
    .eq("community_id", input.communityId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle<PropertySnapshotRow>();

  if (propertyError || !property) {
    return unauthorized();
  }

  const { data: assessments, error: assessmentsError } = await supabase
    .from("assessments")
    .select("id, balance_cents")
    .eq("community_id", input.communityId)
    .eq("property_id", input.propertyId)
    .in("status", OPEN_ASSESSMENT_STATUSES)
    .gt("balance_cents", 0)
    .returns<AssessmentBalanceRow[]>();

  if (assessmentsError) {
    return paymentUnavailable();
  }

  const payableBalanceCents = (assessments ?? []).reduce(
    (total, assessment) => total + assessment.balance_cents,
    0,
  );

  if (payableBalanceCents <= 0) {
    return paymentUnavailable();
  }

  if (input.amountCents > payableBalanceCents) {
    return canViewBalance ? invalidRequest() : invalidRequest();
  }

  const stripeContext = getStripeContextOrNull();

  if (!stripeContext) {
    return configurationUnavailable();
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      community_id: input.communityId,
      property_id: input.propertyId,
      payer_type: "resident",
      profile_id: profile.id,
      property_account_snapshot: property.account_number,
      property_address_snapshot: propertyAddressSnapshot(property),
      amount_cents: input.amountCents,
      currency: "USD",
      fee_policy: resolveFeePolicy(settings.fee_policy),
      method: selectedMethod.databaseMethod,
      status: "created",
      created_by: profile.id,
    })
    .select("id")
    .single<PendingPaymentRow>();

  if (paymentError || !payment) {
    return paymentUnavailable();
  }

  const successUrl = `${stripeContext.appBaseUrl}/portal/payments?payment=returned`;
  const cancelUrl = `${stripeContext.appBaseUrl}/portal/payments?payment=cancelled`;

  try {
    const session = await stripeContext.stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: [selectedMethod.stripeMethod],
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
          communityId: input.communityId,
          propertyId: input.propertyId,
          profileId: profile.id,
          method: selectedMethod.databaseMethod,
        },
      },
      settings.stripe_account_mode === "direct" && settings.stripe_connected_account_id
        ? { stripeAccount: settings.stripe_connected_account_id }
        : undefined,
    );

    if (!session.url) {
      await voidPendingPayment({ paymentId: payment.id, communityId: input.communityId, supabase });
      return configurationUnavailable();
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: "pending", stripe_checkout_session_id: session.id })
      .eq("id", payment.id)
      .eq("community_id", input.communityId)
      .eq("status", "created");

    if (updateError) {
      await voidPendingPayment({ paymentId: payment.id, communityId: input.communityId, supabase });
      return paymentUnavailable();
    }

    return { kind: "session-created", checkoutUrl: session.url };
  } catch {
    await voidPendingPayment({ paymentId: payment.id, communityId: input.communityId, supabase });
    return configurationUnavailable();
  }
}
