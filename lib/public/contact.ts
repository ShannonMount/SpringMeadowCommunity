export type PublicContactRequest = {
  communitySlug: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  turnstileToken: string;
};

export type PublicContactErrors = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  turnstileToken?: string;
  form?: string;
};

export type PublicContactValidationResult =
  | {
      ok: true;
      value: PublicContactRequest;
    }
  | {
      ok: false;
      errors: PublicContactErrors;
    };

export const contactSuccessMessage =
  "Thanks. Your message has been accepted for follow-up.";

export const contactFormErrorMessage =
  "We could not send your message. Please review the form and try again.";

export const contactDeliveryErrorMessage =
  "We could not send your message right now. Please try again later.";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9()+\-\s.]*$/;

export function validatePublicContactRequest(input: unknown): PublicContactValidationResult {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const turnstileToken =
    typeof record.turnstileToken === "string" ? record.turnstileToken.trim() : "";
  const communitySlug =
    typeof record.communitySlug === "string" ? record.communitySlug.trim() : "spring-meadow";

  const value: PublicContactRequest = {
    communitySlug: communitySlug || "spring-meadow",
    name,
    email,
    phone,
    message,
    turnstileToken,
  };

  const errors: PublicContactErrors = {};

  if (!value.name) {
    errors.name = "Enter your name.";
  } else if (value.name.length > 120) {
    errors.name = "Use 120 characters or fewer.";
  }

  if (!value.email) {
    errors.email = "Enter your email.";
  } else if (!emailPattern.test(value.email) || value.email.length > 254) {
    errors.email = "Enter a valid email.";
  }

  if (value.phone && (!phonePattern.test(value.phone) || value.phone.length > 40)) {
    errors.phone = "Enter a valid phone number or leave it blank.";
  }

  if (!value.message) {
    errors.message = "Enter a message.";
  } else if (value.message.length < 10) {
    errors.message = "Use at least 10 characters.";
  } else if (value.message.length > 3000) {
    errors.message = "Use 3000 characters or fewer.";
  }

  if (!value.turnstileToken) {
    errors.turnstileToken = "Complete bot protection.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}
