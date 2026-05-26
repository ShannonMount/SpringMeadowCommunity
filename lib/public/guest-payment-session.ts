export type GuestPaymentMethodPreference = "card" | "ach";

export type GuestPaymentSessionRequest = {
  payerName: string;
  payerEmail: string;
  payerPhone?: string;
  amountCents: number;
  methodPreference?: GuestPaymentMethodPreference;
  turnstileToken: string;
};

export type GuestPaymentSessionErrors = {
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  amount?: string;
  amountCents?: string;
  methodPreference?: string;
  turnstileToken?: string;
  form?: string;
};

export type GuestPaymentSessionApiResponse =
  | {
      ok: true;
      checkoutUrl: string;
    }
  | {
      ok: false;
      code:
        | "invalid-request"
        | "lookup-expired"
        | "payment-unavailable"
        | "rate-limited"
        | "bot-protection-failed";
      message: string;
      errors?: GuestPaymentSessionErrors;
    };

export type GuestPaymentSessionValidationResult =
  | {
      ok: true;
      value: GuestPaymentSessionRequest;
    }
  | {
      ok: false;
      errors: GuestPaymentSessionErrors;
    };

export type GuestPaymentReturnStatus = "submitted" | "cancelled" | "unknown";

export const guestPaymentSessionInvalidMessage = "Check the payment details and try again.";
export const guestPaymentLookupExpiredMessage = "Start with the guest payment lookup again.";
export const guestPaymentSessionUnavailableMessage =
  "Online guest payments are temporarily unavailable. Contact the HOA for help.";
export const guestPaymentSessionTurnstileMessage = "Complete bot protection and try again.";
export const guestPaymentSessionRateLimitedMessage =
  "Too many payment attempts. Please wait before trying again.";
export const guestPaymentReturnSubmittedMessage =
  "Your online payment was submitted for processing. A receipt will be available after confirmation.";
export const guestPaymentReturnCancelledMessage =
  "The online payment was cancelled. You can start again when ready.";
export const guestPaymentReturnUnknownMessage =
  "Payment status is not available from this page. Start again or contact the HOA for help.";

export const MAX_GUEST_PAYMENT_AMOUNT_CENTS = 1000000;

const CONTROL_CHARACTER_PATTERN = /[\x00-\x1f\x7f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9()+. -]{7,30}$/;
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,6})(?:\.([0-9]{1,2}))?$/;

function normalizePublicText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function hasControlCharacters(value: unknown) {
  return typeof value === "string" && CONTROL_CHARACTER_PATTERN.test(value);
}

function parseUsdCents(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value !== "string" || hasControlCharacters(value)) {
    return null;
  }

  const normalized = value.trim().replace(/^\$/, "");
  const match = AMOUNT_PATTERN.exec(normalized);

  if (!match) {
    return null;
  }

  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));

  return dollars * 100 + cents;
}

function isValidAmountCents(amountCents: number) {
  return (
    Number.isInteger(amountCents) &&
    amountCents > 0 &&
    amountCents <= MAX_GUEST_PAYMENT_AMOUNT_CENTS
  );
}

export function validateGuestPaymentSessionRequest(
  input: unknown,
): GuestPaymentSessionValidationResult {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const payerName = normalizePublicText(record.payerName);
  const payerEmail = normalizePublicText(record.payerEmail).toLowerCase();
  const payerPhone = normalizePublicText(record.payerPhone);
  const turnstileToken = normalizePublicText(record.turnstileToken);
  const amountCents = parseUsdCents(record.amountCents ?? record.amount);
  const methodPreference = normalizePublicText(record.methodPreference);

  const errors: GuestPaymentSessionErrors = {};

  if (
    payerName.length < 2 ||
    payerName.length > 120 ||
    hasControlCharacters(record.payerName)
  ) {
    errors.payerName = "Enter the payer name.";
  }

  if (
    payerEmail.length > 254 ||
    !EMAIL_PATTERN.test(payerEmail) ||
    hasControlCharacters(record.payerEmail)
  ) {
    errors.payerEmail = "Enter a valid email address.";
  }

  if (
    payerPhone &&
    (payerPhone.length > 30 ||
      !PHONE_PATTERN.test(payerPhone) ||
      hasControlCharacters(record.payerPhone))
  ) {
    errors.payerPhone = "Enter a valid phone number or leave it blank.";
  }

  if (amountCents === null || !isValidAmountCents(amountCents)) {
    errors.amount = "Enter a valid payment amount.";
  }

  if (
    methodPreference &&
    methodPreference !== "card" &&
    methodPreference !== "ach"
  ) {
    errors.methodPreference = guestPaymentSessionInvalidMessage;
  }

  if (!turnstileToken) {
    errors.turnstileToken = guestPaymentSessionTurnstileMessage;
  } else if (
    turnstileToken.length > 4096 ||
    hasControlCharacters(record.turnstileToken)
  ) {
    errors.turnstileToken = guestPaymentSessionTurnstileMessage;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      payerName,
      payerEmail,
      payerPhone: payerPhone || undefined,
      amountCents: amountCents as number,
      methodPreference: methodPreference
        ? (methodPreference as GuestPaymentMethodPreference)
        : undefined,
      turnstileToken,
    },
  };
}

export function normalizeGuestPaymentReturnStatus(value: unknown): GuestPaymentReturnStatus {
  return value === "submitted" || value === "cancelled" ? value : "unknown";
}

export function getGuestPaymentReturnContent(status: GuestPaymentReturnStatus) {
  if (status === "cancelled") {
    return {
      heading: "Payment cancelled",
      message: guestPaymentReturnCancelledMessage,
    };
  }

  if (status === "submitted") {
    return {
      heading: "Payment submitted",
      message: guestPaymentReturnSubmittedMessage,
    };
  }

  return {
    heading: "Payment status unavailable",
    message: guestPaymentReturnUnknownMessage,
  };
}
