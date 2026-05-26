import "server-only";

import { getResend, getResendFromEmail, isRetryableEmailError, sanitizeEmailError } from "./resend";

export type SendEmailInput = {
  html: string;
  idempotencyKey: string;
  subject: string;
  text?: string;
  to: string;
};

export type SendEmailResult =
  | { kind: "sent"; providerMessageId: string }
  | { kind: "failed"; error: string; retryable: boolean };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const response = await getResend().emails.send(
      {
        from: getResendFromEmail(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
      {
        idempotencyKey: input.idempotencyKey,
      },
    );

    if (response.error) {
      const safeError = sanitizeEmailError(response.error);

      return {
        kind: "failed",
        error: safeError,
        retryable: isRetryableEmailError(safeError),
      };
    }

    if (!response.data?.id) {
      return {
        kind: "failed",
        error: "resend-send-failed",
        retryable: true,
      };
    }

    return {
      kind: "sent",
      providerMessageId: response.data.id,
    };
  } catch (error) {
    const safeError = sanitizeEmailError(error);

    return {
      kind: "failed",
      error: safeError,
      retryable: isRetryableEmailError(safeError),
    };
  }
}
