export type GuestPaymentLookupRequest = {
  communitySlug: string;
  addressLine1?: string;
  postalCode?: string;
  accountNumber?: string;
  publicPaymentCode?: string;
  turnstileToken: string;
};

export type GuestPaymentLookupErrors = {
  communitySlug?: string;
  addressLine1?: string;
  postalCode?: string;
  accountNumber?: string;
  publicPaymentCode?: string;
  turnstileToken?: string;
  form?: string;
};

export type GuestPaymentLookupApiResponse =
  | {
      ok: true;
      canProceed: true;
      message: string;
    }
  | {
      ok: false;
      canProceed: false;
      code:
        | "invalid-request"
        | "not-confirmed"
        | "payment-unavailable"
        | "rate-limited"
        | "bot-protection-failed";
      message: string;
      errors?: GuestPaymentLookupErrors;
    };

export type GuestPaymentLookupValidationResult =
  | {
      ok: true;
      value: GuestPaymentLookupRequest;
    }
  | {
      ok: false;
      errors: GuestPaymentLookupErrors;
    };

export const defaultGuestPaymentCommunitySlug = "spring-meadow-community";

export const guestLookupSuccessMessage =
  "Thanks. Your lookup was successful.";

export const guestLookupInvalidMessage = "Check the lookup details and try again.";

export const guestLookupNotConfirmedMessage =
  "We could not confirm an eligible payment record with those details. Check the information or contact the HOA.";

export const guestLookupUnavailableMessage =
  "Online guest payments are temporarily unavailable. Contact the HOA for help.";

export const guestLookupTurnstileMessage = "Complete bot protection and try again.";

export const guestLookupRateLimitedMessage =
  "Too many lookup attempts. Please wait before trying again.";

const CONTROL_CHARACTER_PATTERN = /[\x00-\x1f\x7f]/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POSTAL_CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z -]{2,18}[0-9A-Za-z]$/;
const ACCOUNT_PATTERN = /^[0-9A-Za-z][0-9A-Za-z ._-]{1,78}[0-9A-Za-z]$/;
const PAYMENT_CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z ._-]{3,78}[0-9A-Za-z]$/;

export function normalizeLookupText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function hasControlCharacters(value: unknown) {
  return typeof value === "string" && CONTROL_CHARACTER_PATTERN.test(value);
}

function normalizeCode(value: string) {
  return value.toUpperCase();
}

export function validateGuestPaymentLookupRequest(
  input: unknown,
): GuestPaymentLookupValidationResult {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const communitySlug =
    normalizeLookupText(record.communitySlug) || defaultGuestPaymentCommunitySlug;
  const addressLine1 = normalizeLookupText(record.addressLine1);
  const postalCode = normalizeLookupText(record.postalCode);
  const accountNumber = normalizeLookupText(record.accountNumber);
  const publicPaymentCode = normalizeLookupText(record.publicPaymentCode);
  const turnstileToken = normalizeLookupText(record.turnstileToken);

  const errors: GuestPaymentLookupErrors = {};

  if (!SLUG_PATTERN.test(communitySlug) || communitySlug.length > 80) {
    errors.communitySlug = guestLookupInvalidMessage;
  }

  if (
    addressLine1 &&
    (addressLine1.length > 120 || hasControlCharacters(record.addressLine1))
  ) {
    errors.addressLine1 = "Use 120 characters or fewer.";
  }

  if (
    postalCode &&
    (!POSTAL_CODE_PATTERN.test(postalCode) || hasControlCharacters(record.postalCode))
  ) {
    errors.postalCode = "Enter a valid ZIP code.";
  }

  if (
    accountNumber &&
    (!ACCOUNT_PATTERN.test(accountNumber) || hasControlCharacters(record.accountNumber))
  ) {
    errors.accountNumber = "Enter a valid account reference.";
  }

  if (
    publicPaymentCode &&
    (!PAYMENT_CODE_PATTERN.test(publicPaymentCode) ||
      hasControlCharacters(record.publicPaymentCode))
  ) {
    errors.publicPaymentCode = "Enter a valid public payment code.";
  }

  if (!turnstileToken) {
    errors.turnstileToken = guestLookupTurnstileMessage;
  } else if (turnstileToken.length > 4096 || hasControlCharacters(record.turnstileToken)) {
    errors.turnstileToken = guestLookupTurnstileMessage;
  }

  const hasPublicCode = Boolean(publicPaymentCode);
  const hasPostalPair = Boolean(postalCode && (addressLine1 || accountNumber));

  if (!hasPublicCode && !hasPostalPair) {
    errors.form = "Enter a public payment code or ZIP code with a street address or account reference.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      communitySlug,
      addressLine1,
      postalCode: normalizeCode(postalCode),
      accountNumber: normalizeCode(accountNumber),
      publicPaymentCode: normalizeCode(publicPaymentCode),
      turnstileToken,
    },
  };
}
