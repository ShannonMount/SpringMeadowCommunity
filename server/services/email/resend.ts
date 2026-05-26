import "server-only";

import { Resend } from "resend";

let resendClient: Resend | null = null;

function emailConfigurationError(message: string, name: string) {
  const error = new Error(message);
  error.name = name;

  return error;
}

function requireServerEmailValue(value: string | undefined, failure: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw emailConfigurationError(failure, "missing_api_key");
  }

  return trimmed;
}

export function getResend() {
  const apiKey = requireServerEmailValue(
    process.env.RESEND_API_KEY,
    "Missing email server configuration.",
  );

  resendClient ??= new Resend(apiKey);

  return resendClient;
}

export function getResendFromEmail() {
  const fromEmail = requireServerEmailValue(
    process.env.RESEND_FROM_EMAIL,
    "Missing email sender configuration.",
  );

  if (!fromEmail.includes("@") || /\s/.test(fromEmail)) {
    throw emailConfigurationError("Invalid email sender configuration.", "invalid_from_address");
  }

  return fromEmail;
}

export function sanitizeEmailError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error ? String(error.name) : "";

  if (/api_key|restricted_api_key|security_error|invalid_access/i.test(name)) {
    return "resend-configuration-error";
  }

  if (/invalid_from_address|validation_error|missing_required_field|invalid_parameter/i.test(name)) {
    return "resend-validation-error";
  }

  if (/rate_limit|quota|concurrent_idempotent_requests/i.test(name)) {
    return "resend-rate-limited";
  }

  if (/internal_server|application_error/i.test(name)) {
    return "resend-send-failed";
  }

  return "resend-send-failed";
}

export function isRetryableEmailError(error: string) {
  return error === "resend-rate-limited" || error === "resend-send-failed";
}
