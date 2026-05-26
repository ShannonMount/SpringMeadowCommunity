"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  guestLookupInvalidMessage,
  type GuestPaymentLookupApiResponse,
  type GuestPaymentLookupErrors,
} from "@/lib/public/guest-payment-lookup";
import { paymentEntryRoutes } from "@/lib/public/payments";

type GuestPaymentLookupFormProps = {
  communitySlug: string;
  turnstileSiteKey?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const fieldIds = {
  addressLine1: "guest-payment-address",
  postalCode: "guest-payment-postal-code",
  accountNumber: "guest-payment-account-number",
  publicPaymentCode: "guest-payment-public-code",
  turnstileToken: "guest-payment-turnstile",
};

function describedBy(field: keyof typeof fieldIds, errors: GuestPaymentLookupErrors) {
  return errors[field] ? `${fieldIds[field]}-error` : `${fieldIds[field]}-helper`;
}

export function GuestPaymentLookupForm({
  communitySlug,
  turnstileSiteKey,
}: GuestPaymentLookupFormProps) {
  const [errors, setErrors] = useState<GuestPaymentLookupErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successMessage, setSuccessMessage] = useState("");
  const useDevelopmentToken = !turnstileSiteKey && process.env.NODE_ENV !== "production";

  const statusMessage = useMemo(() => {
    if (submitState === "success") {
      return successMessage;
    }

    if (submitState === "error") {
      return errors.form ?? guestLookupInvalidMessage;
    }

    return "";
  }, [errors.form, submitState, successMessage]);

  function resetTurnstile() {
    (window as { turnstile?: { reset?: () => void } }).turnstile?.reset?.();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setSubmitState("submitting");
    setErrors({});
    setSuccessMessage("");

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/guest-payments/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communitySlug,
          addressLine1: String(formData.get("addressLine1") ?? ""),
          postalCode: String(formData.get("postalCode") ?? ""),
          accountNumber: String(formData.get("accountNumber") ?? ""),
          publicPaymentCode: String(formData.get("publicPaymentCode") ?? ""),
          turnstileToken: String(formData.get("cf-turnstile-response") ?? ""),
        }),
      });
      const result = (await response.json()) as GuestPaymentLookupApiResponse;

      if (result.ok && result.canProceed) {
        form.reset();
        setSuccessMessage(result.message);
        setSubmitState("success");
        return;
      }

      setErrors(result.errors ?? { form: result.message });
      setSubmitState("error");
      resetTurnstile();
    } catch {
      setErrors({ form: guestLookupInvalidMessage });
      setSubmitState("error");
      resetTurnstile();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[var(--border)] bg-white p-5 sm:p-6" noValidate>
      <div className="grid gap-5">
        <div>
          <label htmlFor={fieldIds.addressLine1} className="block text-sm font-semibold text-[#17211d]">
            Street address
          </label>
          <input
            id={fieldIds.addressLine1}
            name="addressLine1"
            type="text"
            autoComplete="street-address"
            aria-invalid={Boolean(errors.addressLine1)}
            aria-describedby={describedBy("addressLine1", errors)}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.addressLine1 ? (
            <p id={`${fieldIds.addressLine1}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.addressLine1}
            </p>
          ) : (
            <p id={`${fieldIds.addressLine1}-helper`} className="mt-2 text-sm leading-6 text-[#5b6a64]">
              Use the street line from the dues notice or HOA correspondence.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldIds.postalCode} className="block text-sm font-semibold text-[#17211d]">
            ZIP code
          </label>
          <input
            id={fieldIds.postalCode}
            name="postalCode"
            type="text"
            inputMode="text"
            autoComplete="postal-code"
            aria-invalid={Boolean(errors.postalCode)}
            aria-describedby={describedBy("postalCode", errors)}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.postalCode ? (
            <p id={`${fieldIds.postalCode}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.postalCode}
            </p>
          ) : (
            <p id={`${fieldIds.postalCode}-helper`} className="mt-2 text-sm leading-6 text-[#5b6a64]">
              Pair this with a street address or account reference.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldIds.accountNumber} className="block text-sm font-semibold text-[#17211d]">
            Account reference
          </label>
          <input
            id={fieldIds.accountNumber}
            name="accountNumber"
            type="text"
            aria-invalid={Boolean(errors.accountNumber)}
            aria-describedby={describedBy("accountNumber", errors)}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.accountNumber ? (
            <p id={`${fieldIds.accountNumber}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.accountNumber}
            </p>
          ) : (
            <p id={`${fieldIds.accountNumber}-helper`} className="mt-2 text-sm leading-6 text-[#5b6a64]">
              Use this only if the HOA provided one.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldIds.publicPaymentCode} className="block text-sm font-semibold text-[#17211d]">
            Public payment code
          </label>
          <input
            id={fieldIds.publicPaymentCode}
            name="publicPaymentCode"
            type="text"
            aria-invalid={Boolean(errors.publicPaymentCode)}
            aria-describedby={describedBy("publicPaymentCode", errors)}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.publicPaymentCode ? (
            <p id={`${fieldIds.publicPaymentCode}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.publicPaymentCode}
            </p>
          ) : (
            <p id={`${fieldIds.publicPaymentCode}-helper`} className="mt-2 text-sm leading-6 text-[#5b6a64]">
              Use this only if your notice includes one.
            </p>
          )}
        </div>

        <div>
          <p id={fieldIds.turnstileToken} className="text-sm font-semibold text-[#17211d]">
            Bot protection
          </p>
          {turnstileSiteKey ? (
            <>
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="afterInteractive"
              />
              <div
                className="cf-turnstile mt-2 min-h-16 border border-[var(--border)] bg-[#f7f8f5] p-3"
                data-sitekey={turnstileSiteKey}
                aria-labelledby={fieldIds.turnstileToken}
                aria-invalid={Boolean(errors.turnstileToken)}
                aria-describedby={
                  errors.turnstileToken ? `${fieldIds.turnstileToken}-error` : undefined
                }
              />
            </>
          ) : useDevelopmentToken ? (
            <div className="mt-2 border border-[var(--border)] bg-[#f7f8f5] p-3 text-sm text-[#41504a]">
              Bot protection will appear here when the public site key is configured.
              <input type="hidden" name="cf-turnstile-response" value="development-turnstile-token" />
            </div>
          ) : (
            <div className="mt-2 border border-[var(--border)] bg-[#f7f8f5] p-3 text-sm text-[#41504a]">
              Bot protection is temporarily unavailable.
            </div>
          )}
          {errors.turnstileToken ? (
            <p id={`${fieldIds.turnstileToken}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.turnstileToken}
            </p>
          ) : null}
        </div>

        <div aria-live="polite" className="min-h-6 text-sm font-medium text-[#244f44]">
          {statusMessage}
        </div>

        {errors.form ? (
          <Link
            href={paymentEntryRoutes.contact}
            className="w-fit text-sm font-semibold text-[var(--accent-strong)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Contact the HOA about dues
          </Link>
        ) : null}

        {submitState === "success" ? (
          <Link
            href={paymentEntryRoutes.payment}
            className="w-fit border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Continue to payment details
          </Link>
        ) : null}

        <button
          type="submit"
          disabled={submitState === "submitting" || submitState === "success"}
          className="w-fit border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitState === "submitting" ? "Checking..." : "Start guest payment lookup"}
        </button>
      </div>
    </form>
  );
}
