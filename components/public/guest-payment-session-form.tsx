"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  guestPaymentSessionInvalidMessage,
  type GuestPaymentMethodPreference,
  type GuestPaymentSessionApiResponse,
  type GuestPaymentSessionErrors,
} from "@/lib/public/guest-payment-session";
import { paymentEntryRoutes } from "@/lib/public/payments";

type GuestPaymentSessionFormProps = {
  allowCard: boolean;
  allowAch: boolean;
  turnstileSiteKey?: string;
};

type SubmitState = "idle" | "submitting" | "error";

const fieldIds = {
  payerName: "guest-payment-payer-name",
  payerEmail: "guest-payment-payer-email",
  payerPhone: "guest-payment-payer-phone",
  amount: "guest-payment-amount",
  methodPreference: "guest-payment-method",
  turnstileToken: "guest-payment-session-turnstile",
};

function fieldErrorId(field: keyof GuestPaymentSessionErrors) {
  return `guest-payment-session-${field}-error`;
}

function methodOptions(allowCard: boolean, allowAch: boolean) {
  const options: { value: GuestPaymentMethodPreference; label: string }[] = [];

  if (allowCard) {
    options.push({ value: "card", label: "Card" });
  }

  if (allowAch) {
    options.push({ value: "ach", label: "Bank account" });
  }

  return options;
}

export function GuestPaymentSessionForm({
  allowCard,
  allowAch,
  turnstileSiteKey,
}: GuestPaymentSessionFormProps) {
  const [errors, setErrors] = useState<GuestPaymentSessionErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const useDevelopmentToken = !turnstileSiteKey && process.env.NODE_ENV !== "production";
  const availableMethods = methodOptions(allowCard, allowAch);

  const statusMessage = useMemo(() => {
    if (submitState === "error") {
      return errors.form ?? guestPaymentSessionInvalidMessage;
    }

    return "";
  }, [errors.form, submitState]);

  function resetTurnstile() {
    (window as { turnstile?: { reset?: () => void } }).turnstile?.reset?.();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setSubmitState("submitting");
    setErrors({});

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/guest-payments/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payerName: String(formData.get("payerName") ?? ""),
          payerEmail: String(formData.get("payerEmail") ?? ""),
          payerPhone: String(formData.get("payerPhone") ?? ""),
          amount: String(formData.get("amount") ?? ""),
          methodPreference: String(formData.get("methodPreference") ?? ""),
          turnstileToken: String(formData.get("cf-turnstile-response") ?? ""),
        }),
      });
      const result = (await response.json()) as GuestPaymentSessionApiResponse;

      if (result.ok) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      setErrors(result.errors ?? { form: result.message });
      setSubmitState("error");
      resetTurnstile();
    } catch {
      setErrors({ form: guestPaymentSessionInvalidMessage });
      setSubmitState("error");
      resetTurnstile();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[var(--border)] bg-white p-5 sm:p-6" noValidate>
      <div className="grid gap-5">
        <div>
          <label htmlFor={fieldIds.payerName} className="block text-sm font-semibold text-[#17211d]">
            Payer name
          </label>
          <input
            id={fieldIds.payerName}
            name="payerName"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.payerName)}
            aria-describedby={errors.payerName ? fieldErrorId("payerName") : undefined}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.payerName ? (
            <p id={fieldErrorId("payerName")} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.payerName}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.payerEmail} className="block text-sm font-semibold text-[#17211d]">
            Email
          </label>
          <input
            id={fieldIds.payerEmail}
            name="payerEmail"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.payerEmail)}
            aria-describedby={errors.payerEmail ? fieldErrorId("payerEmail") : undefined}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.payerEmail ? (
            <p id={fieldErrorId("payerEmail")} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.payerEmail}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.payerPhone} className="block text-sm font-semibold text-[#17211d]">
            Phone <span className="font-normal text-[#5b6a64]">(optional)</span>
          </label>
          <input
            id={fieldIds.payerPhone}
            name="payerPhone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.payerPhone)}
            aria-describedby={errors.payerPhone ? fieldErrorId("payerPhone") : undefined}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.payerPhone ? (
            <p id={fieldErrorId("payerPhone")} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.payerPhone}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.amount} className="block text-sm font-semibold text-[#17211d]">
            Amount
          </label>
          <input
            id={fieldIds.amount}
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="125.00"
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? fieldErrorId("amount") : undefined}
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-[#17211d] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          />
          {errors.amount ? (
            <p id={fieldErrorId("amount")} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.amount}
            </p>
          ) : null}
        </div>

        <fieldset
          aria-invalid={Boolean(errors.methodPreference)}
          aria-describedby={errors.methodPreference ? fieldErrorId("methodPreference") : undefined}
          className="grid gap-3"
        >
          <legend id={fieldIds.methodPreference} className="text-sm font-semibold text-[#17211d]">
            Payment method
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableMethods.map((option, index) => (
              <label
                key={option.value}
                className="flex min-h-12 items-center gap-3 border border-[var(--border)] bg-[#f7f8f5] px-3 py-3 text-sm font-semibold text-[#17211d]"
              >
                <input
                  name="methodPreference"
                  type="radio"
                  value={option.value}
                  defaultChecked={index === 0}
                  className="size-4 accent-[var(--accent-strong)]"
                />
                {option.label}
              </label>
            ))}
          </div>
          {errors.methodPreference ? (
            <p id={fieldErrorId("methodPreference")} className="text-sm font-medium text-[#8c3f1f]">
              {errors.methodPreference}
            </p>
          ) : null}
        </fieldset>

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
                  errors.turnstileToken ? fieldErrorId("turnstileToken") : undefined
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
            <p id={fieldErrorId("turnstileToken")} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.turnstileToken}
            </p>
          ) : null}
        </div>

        <div aria-live="polite" className="min-h-6 text-sm font-medium text-[#244f44]">
          {statusMessage}
        </div>

        {errors.form ? (
          <Link
            href={paymentEntryRoutes.lookup}
            className="w-fit text-sm font-semibold text-[var(--accent-strong)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Start with the guest payment lookup again
          </Link>
        ) : null}

        <button
          type="submit"
          disabled={submitState === "submitting" || availableMethods.length === 0}
          className="w-fit border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitState === "submitting" ? "Opening checkout..." : "Continue to secure checkout"}
        </button>
      </div>
    </form>
  );
}
