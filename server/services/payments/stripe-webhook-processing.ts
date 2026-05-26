import "server-only";

import { createHash } from "node:crypto";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendPaymentReceiptEmailForPayment } from "@/server/services/payments/payment-receipt-email";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProcessingStatus = "processed" | "ignored" | "failed";
type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "ignored";

type ExistingPaymentEventRow = {
  processing_status: "received" | ProcessingStatus;
  payment_id: string | null;
};

type StripePaymentEventRpcResult = {
  status?: "processed" | "duplicate" | "ignored" | "failed";
  payment_id?: string | null;
  retryable?: boolean;
};

type RpcInput = {
  stripe_event_id: string;
  stripe_event_type: string;
  event_stripe_account_id: string | null;
  target_payment_id: string | null;
  target_community_id: string | null;
  target_property_id: string | null;
  target_checkout_session_id: string | null;
  target_payment_intent_id: string | null;
  target_charge_id: string | null;
  target_customer_id: string | null;
  target_receipt_url: string | null;
  target_receipt_number: string | null;
  event_payment_status: PaymentStatus;
  event_paid_at: string | null;
  event_processor_fee_cents: number | null;
  event_net_amount_cents: number | null;
  event_payload_hash: string;
  event_error: string | null;
};

export type StripeWebhookProcessingResult =
  | { kind: "processed"; eventId: string; paymentId?: string }
  | { kind: "duplicate"; eventId: string }
  | { kind: "ignored"; eventId: string; eventType: string }
  | { kind: "failed"; eventId: string; retryable: boolean };

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function sanitizeWebhookError() {
  return "Webhook processing failed.";
}

function normalizeUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function expandedId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

function stripeObjectMetadata(object: { metadata?: Stripe.Metadata | null }, key: string) {
  const value = object.metadata?.[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function eventCreatedAt(event: Stripe.Event) {
  return new Date(event.created * 1000).toISOString();
}

function eventPayloadHash(event: Stripe.Event) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: event.id,
      type: event.type,
      created: event.created,
      objectId: "id" in event.data.object ? event.data.object.id : null,
    }))
    .digest("hex");
}

function stripeAccountIdForEvent(event: Stripe.Event) {
  return typeof event.account === "string" && event.account.trim() ? event.account : null;
}

function stripeRequestOptionsForEvent(event: Stripe.Event): Stripe.RequestOptions | undefined {
  const stripeAccount = stripeAccountIdForEvent(event);

  return stripeAccount ? { stripeAccount } : undefined;
}

async function retrieveCheckoutSessionForPaymentIntent(
  paymentIntentId: string,
  requestOptions: Stripe.RequestOptions | undefined,
) {
  try {
    const sessions = await getStripe().checkout.sessions.list(
      {
        payment_intent: paymentIntentId,
        limit: 1,
      },
      requestOptions,
    );

    return sessions.data[0] ?? null;
  } catch {
    return null;
  }
}

async function retrieveBalanceTransaction(
  chargeId: string | null,
  requestOptions: Stripe.RequestOptions | undefined,
) {
  if (!chargeId) {
    return {
      processorFeeCents: null,
      netAmountCents: null,
      receiptUrl: null,
    };
  }

  try {
    const charge = await getStripe().charges.retrieve(chargeId, {}, requestOptions);
    const balanceTransactionId = expandedId(charge.balance_transaction);

    if (!balanceTransactionId) {
      return {
        processorFeeCents: null,
        netAmountCents: null,
        receiptUrl: charge.receipt_url ?? null,
      };
    }

    const balanceTransaction = await getStripe().balanceTransactions.retrieve(
      balanceTransactionId,
      {},
      requestOptions,
    );

    return {
      processorFeeCents: balanceTransaction.fee,
      netAmountCents: balanceTransaction.net,
      receiptUrl: charge.receipt_url ?? null,
    };
  } catch {
    return {
      processorFeeCents: null,
      netAmountCents: null,
      receiptUrl: null,
    };
  }
}

function sessionPaymentStatus(
  session: Stripe.Checkout.Session,
  fallback: PaymentStatus,
): PaymentStatus {
  if (fallback === "failed") {
    return "failed";
  }

  return session.payment_status === "paid" ? "succeeded" : "pending";
}

async function referencesFromPaymentIntent(
  paymentIntentId: string | null,
  requestOptions: Stripe.RequestOptions | undefined,
) {
  if (!paymentIntentId) {
    return {
      chargeId: null,
      customerId: null,
      receiptUrl: null,
      processorFeeCents: null,
      netAmountCents: null,
    };
  }

  try {
    const paymentIntent = await getStripe().paymentIntents.retrieve(
      paymentIntentId,
      {},
      requestOptions,
    );
    const chargeId = expandedId(paymentIntent.latest_charge);
    const balanceTransaction = await retrieveBalanceTransaction(chargeId, requestOptions);

    return {
      chargeId,
      customerId: expandedId(paymentIntent.customer),
      receiptUrl: balanceTransaction.receiptUrl,
      processorFeeCents: balanceTransaction.processorFeeCents,
      netAmountCents: balanceTransaction.netAmountCents,
    };
  } catch {
    return {
      chargeId: null,
      customerId: null,
      receiptUrl: null,
      processorFeeCents: null,
      netAmountCents: null,
    };
  }
}

async function rpcInputFromCheckoutSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  fallbackStatus: PaymentStatus,
): Promise<RpcInput> {
  const paymentIntentId = expandedId(session.payment_intent);
  const requestOptions = stripeRequestOptionsForEvent(event);
  const references = await referencesFromPaymentIntent(paymentIntentId, requestOptions);

  return {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    event_stripe_account_id: stripeAccountIdForEvent(event),
    target_payment_id: normalizeUuid(stripeObjectMetadata(session, "paymentId")),
    target_community_id: normalizeUuid(stripeObjectMetadata(session, "communityId")),
    target_property_id: normalizeUuid(stripeObjectMetadata(session, "propertyId")),
    target_checkout_session_id: session.id,
    target_payment_intent_id: paymentIntentId,
    target_charge_id: references.chargeId,
    target_customer_id: expandedId(session.customer) ?? references.customerId,
    target_receipt_url: references.receiptUrl,
    target_receipt_number: null,
    event_payment_status: sessionPaymentStatus(session, fallbackStatus),
    event_paid_at: session.payment_status === "paid" || fallbackStatus === "succeeded" ? eventCreatedAt(event) : null,
    event_processor_fee_cents: references.processorFeeCents,
    event_net_amount_cents: references.netAmountCents,
    event_payload_hash: eventPayloadHash(event),
    event_error: fallbackStatus === "failed" ? "Stripe payment failed." : null,
  };
}

async function rpcInputFromPaymentIntent(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
  status: PaymentStatus,
): Promise<RpcInput> {
  const requestOptions = stripeRequestOptionsForEvent(event);
  const checkoutSession = await retrieveCheckoutSessionForPaymentIntent(
    paymentIntent.id,
    requestOptions,
  );
  const references = await referencesFromPaymentIntent(paymentIntent.id, requestOptions);
  const metadataSource = checkoutSession ?? paymentIntent;

  return {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    event_stripe_account_id: stripeAccountIdForEvent(event),
    target_payment_id: normalizeUuid(stripeObjectMetadata(metadataSource, "paymentId")),
    target_community_id: normalizeUuid(stripeObjectMetadata(metadataSource, "communityId")),
    target_property_id: normalizeUuid(stripeObjectMetadata(metadataSource, "propertyId")),
    target_checkout_session_id: checkoutSession?.id ?? null,
    target_payment_intent_id: paymentIntent.id,
    target_charge_id: references.chargeId,
    target_customer_id: expandedId(paymentIntent.customer) ?? expandedId(checkoutSession?.customer),
    target_receipt_url: references.receiptUrl,
    target_receipt_number: null,
    event_payment_status: status,
    event_paid_at: status === "succeeded" ? eventCreatedAt(event) : null,
    event_processor_fee_cents: references.processorFeeCents,
    event_net_amount_cents: references.netAmountCents,
    event_payload_hash: eventPayloadHash(event),
    event_error: status === "failed" ? "Stripe payment failed." : null,
  };
}

async function rpcInputFromCharge(
  event: Stripe.Event,
  charge: Stripe.Charge,
): Promise<RpcInput> {
  const paymentIntentId = expandedId(charge.payment_intent);
  const requestOptions = stripeRequestOptionsForEvent(event);
  const checkoutSession = paymentIntentId
    ? await retrieveCheckoutSessionForPaymentIntent(paymentIntentId, requestOptions)
    : null;
  const balanceTransaction = await retrieveBalanceTransaction(charge.id, requestOptions);
  const status: PaymentStatus =
    charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded";
  const metadataSource = checkoutSession ?? charge;

  return {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    event_stripe_account_id: stripeAccountIdForEvent(event),
    target_payment_id: normalizeUuid(stripeObjectMetadata(metadataSource, "paymentId")),
    target_community_id: normalizeUuid(stripeObjectMetadata(metadataSource, "communityId")),
    target_property_id: normalizeUuid(stripeObjectMetadata(metadataSource, "propertyId")),
    target_checkout_session_id: checkoutSession?.id ?? null,
    target_payment_intent_id: paymentIntentId,
    target_charge_id: charge.id,
    target_customer_id: expandedId(charge.customer) ?? expandedId(checkoutSession?.customer),
    target_receipt_url: charge.receipt_url ?? balanceTransaction.receiptUrl,
    target_receipt_number: null,
    event_payment_status: status,
    event_paid_at: null,
    event_processor_fee_cents: balanceTransaction.processorFeeCents,
    event_net_amount_cents: balanceTransaction.netAmountCents,
    event_payload_hash: eventPayloadHash(event),
    event_error: null,
  };
}

function ignoredRpcInput(event: Stripe.Event): RpcInput {
  return {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    event_stripe_account_id: stripeAccountIdForEvent(event),
    target_payment_id: null,
    target_community_id: null,
    target_property_id: null,
    target_checkout_session_id: null,
    target_payment_intent_id: null,
    target_charge_id: null,
    target_customer_id: null,
    target_receipt_url: null,
    target_receipt_number: null,
    event_payment_status: "ignored",
    event_paid_at: null,
    event_processor_fee_cents: null,
    event_net_amount_cents: null,
    event_payload_hash: eventPayloadHash(event),
    event_error: null,
  };
}

async function rpcInputForEvent(event: Stripe.Event): Promise<RpcInput> {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return rpcInputFromCheckoutSession(
      event,
      event.data.object as Stripe.Checkout.Session,
      event.type === "checkout.session.async_payment_succeeded" ? "succeeded" : "pending",
    );
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return rpcInputFromCheckoutSession(
      event,
      event.data.object as Stripe.Checkout.Session,
      "failed",
    );
  }

  if (event.type === "payment_intent.succeeded") {
    return rpcInputFromPaymentIntent(
      event,
      event.data.object as Stripe.PaymentIntent,
      "succeeded",
    );
  }

  if (event.type === "payment_intent.payment_failed") {
    return rpcInputFromPaymentIntent(
      event,
      event.data.object as Stripe.PaymentIntent,
      "failed",
    );
  }

  if (event.type === "charge.refunded") {
    return rpcInputFromCharge(event, event.data.object as Stripe.Charge);
  }

  return ignoredRpcInput(event);
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookProcessingResult> {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return { kind: "failed", eventId: event.id, retryable: true };
  }

  const { data: existingEvent } = await supabase
    .from("payment_events")
    .select("processing_status, payment_id")
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id)
    .maybeSingle<ExistingPaymentEventRow>();

  if (existingEvent?.processing_status === "processed") {
    return { kind: "duplicate", eventId: event.id };
  }

  if (existingEvent?.processing_status === "ignored") {
    return { kind: "ignored", eventId: event.id, eventType: event.type };
  }

  let rpcInput: RpcInput;

  try {
    rpcInput = await rpcInputForEvent(event);
  } catch {
    rpcInput = {
      ...ignoredRpcInput(event),
      event_payment_status: "failed",
      event_error: sanitizeWebhookError(),
    };
  }

  const { data, error: rpcError } = await supabase.rpc("process_stripe_payment_event", rpcInput);

  if (rpcError) {
    return { kind: "failed", eventId: event.id, retryable: true };
  }

  const result = data as StripePaymentEventRpcResult | null;

  if (result?.status === "processed") {
    if (result.payment_id && rpcInput.event_payment_status === "succeeded") {
      const receiptResult = await sendPaymentReceiptEmailForPayment({
        paymentId: result.payment_id,
        stripeEventId: event.id,
      });

      void receiptResult;
    }

    return {
      kind: "processed",
      eventId: event.id,
      paymentId: result.payment_id ?? undefined,
    };
  }

  if (result?.status === "duplicate") {
    return { kind: "duplicate", eventId: event.id };
  }

  if (result?.status === "ignored") {
    return { kind: "ignored", eventId: event.id, eventType: event.type };
  }

  return {
    kind: "failed",
    eventId: event.id,
    retryable: result?.retryable ?? true,
  };
}
