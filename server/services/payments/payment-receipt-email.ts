import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/server/services/email/send-email";

const MISSING_RECIPIENT_EMAIL = "missing-recipient@spring-meadow.invalid";
const RECEIPT_SUBJECT = "Spring Meadow HOA dues receipt";
const QUEUED_EMAIL_RETRY_AFTER_MS = 10 * 60 * 1000;

type ReceiptType = "payment_receipt" | "guest_payment_receipt";
type EmailLogStatus = "queued" | "sent" | "delivered" | "bounced" | "failed" | "suppressed";

type PaymentReceiptRow = {
  id: string;
  community_id: string;
  property_id: string;
  payer_type: "resident" | "guest" | "admin_recorded";
  profile_id: string | null;
  guest_email: string | null;
  property_address_snapshot: string;
  amount_cents: number;
  currency: "USD";
  method: "card" | "ach" | "check" | "cash" | "manual" | "other";
  status: "succeeded";
  stripe_receipt_url: string | null;
  receipt_number: string | null;
  paid_at: string | null;
};

type ProfileEmailRow = {
  email: string | null;
};

type EmailLogRow = {
  id: string;
  status: EmailLogStatus;
  provider_message_id: string | null;
  attempt_count: number;
  updated_at: string;
};

type TrustedClient = ReturnType<typeof createServiceRoleClient>;

export type PaymentReceiptEmailResult =
  | { kind: "sent"; paymentId: string }
  | { kind: "already-sent"; paymentId: string }
  | { kind: "not-eligible"; paymentId?: string }
  | { kind: "missing-recipient"; paymentId: string }
  | { kind: "failed"; paymentId: string; retryable: boolean };

export type PaymentReceiptEmailInput = {
  paymentId: string;
  stripeEventId?: string | null;
};

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function isUsableEmail(value: string | null | undefined): value is string {
  return Boolean(value && value.includes("@") && !/\s/.test(value));
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(amountCents / 100);
}

function formatReceiptDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function methodLabel(method: PaymentReceiptRow["method"]) {
  if (method === "ach") {
    return "ACH";
  }

  if (method === "card") {
    return "Card";
  }

  return "Payment";
}

function receiptTypeForPayment(payment: PaymentReceiptRow): ReceiptType | null {
  if (payment.payer_type === "resident") {
    return "payment_receipt";
  }

  if (payment.payer_type === "guest") {
    return "guest_payment_receipt";
  }

  return null;
}

function idempotencyKeyForPayment(payment: PaymentReceiptRow, receiptType: ReceiptType) {
  return receiptType === "guest_payment_receipt"
    ? `guest-payment-receipt/${payment.id}`
    : `payment-receipt/${payment.id}`;
}

async function resolveRecipient(input: {
  payment: PaymentReceiptRow;
  receiptType: ReceiptType;
  supabase: TrustedClient;
}) {
  const { payment, receiptType, supabase } = input;

  if (receiptType === "guest_payment_receipt") {
    return isUsableEmail(payment.guest_email)
      ? { email: payment.guest_email, profileId: null }
      : null;
  }

  if (!payment.profile_id) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", payment.profile_id)
    .maybeSingle<ProfileEmailRow>();

  const email = profile?.email;

  if (error || !isUsableEmail(email)) {
    return null;
  }

  return {
    email,
    profileId: payment.profile_id,
  };
}

function receiptText(input: {
  payment: PaymentReceiptRow;
  receiptType: ReceiptType;
}) {
  const { payment, receiptType } = input;
  const lines = [
    "Spring Meadow HOA dues payment receipt",
    `Receipt: ${payment.receipt_number ?? "Unavailable"}`,
    `Paid: ${formatReceiptDate(payment.paid_at)}`,
    `Amount: ${formatMoney(payment.amount_cents, payment.currency)}`,
    `Method: ${methodLabel(payment.method)}`,
  ];

  if (receiptType === "payment_receipt" && payment.property_address_snapshot) {
    lines.push(`Property: ${payment.property_address_snapshot}`);
  }

  if (payment.stripe_receipt_url) {
    lines.push(`Processor receipt: ${payment.stripe_receipt_url}`);
  }

  return lines.join("\n");
}

function receiptHtml(input: {
  payment: PaymentReceiptRow;
  receiptType: ReceiptType;
}) {
  const { payment, receiptType } = input;
  const propertyLine =
    receiptType === "payment_receipt" && payment.property_address_snapshot
      ? `<p><strong>Property:</strong> ${escapeHtml(payment.property_address_snapshot)}</p>`
      : "";
  const processorLine = payment.stripe_receipt_url
    ? `<p><a href="${escapeHtml(payment.stripe_receipt_url)}">View processor receipt</a></p>`
    : "";

  return [
    "<h1>Spring Meadow HOA dues receipt</h1>",
    `<p><strong>Receipt:</strong> ${escapeHtml(payment.receipt_number ?? "Unavailable")}</p>`,
    `<p><strong>Paid:</strong> ${escapeHtml(formatReceiptDate(payment.paid_at))}</p>`,
    `<p><strong>Amount:</strong> ${escapeHtml(
      formatMoney(payment.amount_cents, payment.currency),
    )}</p>`,
    `<p><strong>Method:</strong> ${escapeHtml(methodLabel(payment.method))}</p>`,
    propertyLine,
    processorLine,
  ].join("");
}

async function existingEmailLog(supabase: TrustedClient, idempotencyKey: string) {
  const { data } = await supabase
    .from("email_logs")
    .select("id, status, provider_message_id, attempt_count, updated_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<EmailLogRow>();

  return data ?? null;
}

function isActiveQueuedEmailLog(emailLog: EmailLogRow | null) {
  if (emailLog?.status !== "queued") {
    return false;
  }

  const updatedAtMs = Date.parse(emailLog.updated_at);

  if (!Number.isFinite(updatedAtMs)) {
    return false;
  }

  return Date.now() - updatedAtMs < QUEUED_EMAIL_RETRY_AFTER_MS;
}

function isNonRetryableEmailLog(emailLog: EmailLogRow | null) {
  return Boolean(
    emailLog &&
      (["sent", "delivered", "bounced"].includes(emailLog.status) ||
        isActiveQueuedEmailLog(emailLog)),
  );
}

async function claimEmailLog(input: {
  existingLog: EmailLogRow | null;
  idempotencyKey: string;
  payment: PaymentReceiptRow;
  receiptType: ReceiptType;
  recipientEmail: string;
  recipientProfileId: string | null;
  supabase: TrustedClient;
}) {
  const existing = input.existingLog;

  if (existing && isNonRetryableEmailLog(existing)) {
    return { kind: "already-sent" as const, emailLogId: existing.id };
  }

  if (existing) {
    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        attempt_count: existing.attempt_count + 1,
        error: null,
        provider_message_id: null,
        recipient_email: input.recipientEmail,
        recipient_profile_id: input.recipientProfileId,
        sent_at: null,
        status: "queued",
      })
      .eq("id", existing.id)
      .select("id, status, provider_message_id, attempt_count, updated_at")
      .maybeSingle<EmailLogRow>();

    return updated
      ? { kind: "claimed" as const, emailLogId: updated.id }
      : { kind: "failed" as const };
  }

  const { data: inserted } = await input.supabase
    .from("email_logs")
    .insert({
      community_id: input.payment.community_id,
      idempotency_key: input.idempotencyKey,
      recipient_email: input.recipientEmail,
      recipient_profile_id: input.recipientProfileId,
      related_payment_id: input.payment.id,
      related_property_id: input.payment.property_id,
      subject: RECEIPT_SUBJECT,
      type: input.receiptType,
      status: "queued",
      provider: "resend",
      attempt_count: 1,
    })
    .select("id, status, provider_message_id, attempt_count, updated_at")
    .maybeSingle<EmailLogRow>();

  if (inserted) {
    return { kind: "claimed" as const, emailLogId: inserted.id };
  }

  const conflicted = await existingEmailLog(input.supabase, input.idempotencyKey);

  if (conflicted) {
    if (isNonRetryableEmailLog(conflicted)) {
      return { kind: "already-sent" as const, emailLogId: conflicted.id };
    }

    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        attempt_count: conflicted.attempt_count + 1,
        error: null,
        provider_message_id: null,
        recipient_email: input.recipientEmail,
        recipient_profile_id: input.recipientProfileId,
        sent_at: null,
        status: "queued",
      })
      .eq("id", conflicted.id)
      .select("id, status, provider_message_id, attempt_count, updated_at")
      .maybeSingle<EmailLogRow>();

    return updated
      ? { kind: "claimed" as const, emailLogId: updated.id }
      : { kind: "failed" as const };
  }

  return { kind: "failed" as const };
}

async function writeSuppressedEmailLog(input: {
  existingLog: EmailLogRow | null;
  idempotencyKey: string;
  payment: PaymentReceiptRow;
  receiptType: ReceiptType;
  supabase: TrustedClient;
}) {
  if (input.existingLog && isNonRetryableEmailLog(input.existingLog)) {
    return { kind: "already-sent" as const };
  }

  const values = {
    community_id: input.payment.community_id,
    error: "missing-recipient",
    idempotency_key: input.idempotencyKey,
    provider: "resend",
    recipient_email: MISSING_RECIPIENT_EMAIL,
    recipient_profile_id: input.payment.profile_id,
    related_payment_id: input.payment.id,
    related_property_id: input.payment.property_id,
    status: "suppressed",
    subject: RECEIPT_SUBJECT,
    type: input.receiptType,
  };

  if (input.existingLog) {
    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        ...values,
        attempt_count: input.existingLog.attempt_count + 1,
        provider_message_id: null,
        sent_at: null,
      })
      .eq("id", input.existingLog.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    return updated ? { kind: "suppressed" as const } : { kind: "failed" as const };
  }

  const { error } = await input.supabase.from("email_logs").insert({
    ...values,
    attempt_count: 1,
  });

  if (!error) {
    return { kind: "suppressed" as const };
  }

  const conflicted = await existingEmailLog(input.supabase, input.idempotencyKey);

  if (conflicted && isNonRetryableEmailLog(conflicted)) {
    return { kind: "already-sent" as const };
  }

  if (conflicted) {
    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        ...values,
        attempt_count: conflicted.attempt_count + 1,
        provider_message_id: null,
        sent_at: null,
      })
      .eq("id", conflicted.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    return updated ? { kind: "suppressed" as const } : { kind: "failed" as const };
  }

  return { kind: "failed" as const };
}

async function updateEmailLogAfterSend(input: {
  emailLogId: string;
  error?: string;
  providerMessageId?: string;
  status: Extract<EmailLogStatus, "sent" | "failed">;
  supabase: TrustedClient;
}) {
  await input.supabase
    .from("email_logs")
    .update({
      error: input.error ?? null,
      provider_message_id: input.providerMessageId ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
      status: input.status,
    })
    .eq("id", input.emailLogId);
}

export async function sendPaymentReceiptEmailForPayment(
  input: PaymentReceiptEmailInput,
): Promise<PaymentReceiptEmailResult> {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return { kind: "failed", paymentId: input.paymentId, retryable: true };
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select(
      "id, community_id, property_id, payer_type, profile_id, guest_email, property_address_snapshot, amount_cents, currency, method, status, stripe_receipt_url, receipt_number, paid_at",
    )
    .eq("id", input.paymentId)
    .eq("status", "succeeded")
    .maybeSingle<PaymentReceiptRow>();

  if (paymentError || !payment) {
    return { kind: "not-eligible", paymentId: input.paymentId };
  }

  const receiptType = receiptTypeForPayment(payment);

  if (!receiptType) {
    return { kind: "not-eligible", paymentId: payment.id };
  }

  const idempotencyKey = idempotencyKeyForPayment(payment, receiptType);
  const existingLog = await existingEmailLog(supabase, idempotencyKey);

  if (existingLog && isNonRetryableEmailLog(existingLog)) {
    return { kind: "already-sent", paymentId: payment.id };
  }

  const recipient = await resolveRecipient({ payment, receiptType, supabase });

  if (!recipient) {
    const suppressedLog = await writeSuppressedEmailLog({
      existingLog,
      idempotencyKey,
      payment,
      receiptType,
      supabase,
    });

    if (suppressedLog.kind === "already-sent") {
      return { kind: "already-sent", paymentId: payment.id };
    }

    if (suppressedLog.kind === "failed") {
      return { kind: "failed", paymentId: payment.id, retryable: true };
    }

    return { kind: "missing-recipient", paymentId: payment.id };
  }

  const claimedLog = await claimEmailLog({
    existingLog,
    idempotencyKey,
    payment,
    receiptType,
    recipientEmail: recipient.email,
    recipientProfileId: recipient.profileId,
    supabase,
  });

  if (claimedLog.kind === "already-sent") {
    return { kind: "already-sent", paymentId: payment.id };
  }

  if (claimedLog.kind !== "claimed") {
    return { kind: "failed", paymentId: payment.id, retryable: true };
  }

  const sendResult = await sendEmail({
    html: receiptHtml({ payment, receiptType }),
    idempotencyKey,
    subject: RECEIPT_SUBJECT,
    text: receiptText({ payment, receiptType }),
    to: recipient.email,
  });

  if (sendResult.kind === "sent") {
    await updateEmailLogAfterSend({
      emailLogId: claimedLog.emailLogId,
      providerMessageId: sendResult.providerMessageId,
      status: "sent",
      supabase,
    });

    return { kind: "sent", paymentId: payment.id };
  }

  await updateEmailLogAfterSend({
    emailLogId: claimedLog.emailLogId,
    error: sendResult.error,
    status: "failed",
    supabase,
  });

  return {
    kind: "failed",
    paymentId: payment.id,
    retryable: sendResult.retryable,
  };
}
