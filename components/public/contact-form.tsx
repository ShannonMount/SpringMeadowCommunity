"use client";

import { FormEvent, useMemo, useState } from "react";
import Script from "next/script";
import {
  contactFormErrorMessage,
  contactSuccessMessage,
  type PublicContactErrors,
} from "@/lib/public/contact";

type ContactFormProps = {
  turnstileSiteKey?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const fieldIds = {
  name: "contact-name",
  email: "contact-email",
  phone: "contact-phone",
  message: "contact-message",
};

function describedBy(field: keyof typeof fieldIds, errors: PublicContactErrors) {
  return errors[field] ? `${fieldIds[field]}-error` : undefined;
}

export function ContactForm({ turnstileSiteKey }: ContactFormProps) {
  const [errors, setErrors] = useState<PublicContactErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const statusMessage = useMemo(() => {
    if (submitState === "success") {
      return contactSuccessMessage;
    }

    if (submitState === "error") {
      return errors.form ?? contactFormErrorMessage;
    }

    return "";
  }, [errors.form, submitState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const turnstileToken = String(formData.get("cf-turnstile-response") ?? "");

    const response = await fetch("/api/public/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        communitySlug: "spring-meadow",
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        message: String(formData.get("message") ?? ""),
        turnstileToken,
      }),
    });

    const result = (await response.json()) as { ok: boolean; errors?: PublicContactErrors };

    if (result.ok) {
      event.currentTarget.reset();
      setSubmitState("success");
      return;
    }

    setErrors(result.errors ?? { form: contactFormErrorMessage });
    setSubmitState("error");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[var(--border)] bg-white p-5 sm:p-6"
      noValidate
    >
      <div className="grid gap-5">
        <div>
          <label htmlFor={fieldIds.name} className="text-sm font-semibold text-[#17211d]">
            Name
          </label>
          <input
            id={fieldIds.name}
            name="name"
            type="text"
            autoComplete="name"
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-2 text-base text-[#17211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name", errors)}
          />
          {errors.name ? (
            <p id={`${fieldIds.name}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.email} className="text-sm font-semibold text-[#17211d]">
            Email
          </label>
          <input
            id={fieldIds.email}
            name="email"
            type="email"
            autoComplete="email"
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-2 text-base text-[#17211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email", errors)}
          />
          {errors.email ? (
            <p id={`${fieldIds.email}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.phone} className="text-sm font-semibold text-[#17211d]">
            Phone <span className="font-normal text-[#5b6a64]">(optional)</span>
          </label>
          <input
            id={fieldIds.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            className="mt-2 w-full border border-[var(--border)] bg-white px-3 py-2 text-base text-[#17211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy("phone", errors)}
          />
          {errors.phone ? (
            <p id={`${fieldIds.phone}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldIds.message} className="text-sm font-semibold text-[#17211d]">
            Message
          </label>
          <textarea
            id={fieldIds.message}
            name="message"
            rows={7}
            className="mt-2 w-full resize-y border border-[var(--border)] bg-white px-3 py-2 text-base text-[#17211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describedBy("message", errors)}
          />
          {errors.message ? (
            <p id={`${fieldIds.message}-error`} className="mt-2 text-sm font-medium text-[#8c3f1f]">
              {errors.message}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-[#17211d]">Bot protection</p>
          {turnstileSiteKey ? (
            <>
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="afterInteractive"
              />
              <div
                className="cf-turnstile mt-2 min-h-16 border border-[var(--border)] bg-[#f7f8f5] p-3"
                data-sitekey={turnstileSiteKey}
              />
            </>
          ) : (
            <div className="mt-2 border border-[var(--border)] bg-[#f7f8f5] p-3 text-sm text-[#41504a]">
              Bot protection will appear here when the public site key is configured.
              <input
                type="hidden"
                name="cf-turnstile-response"
                value="development-turnstile-token"
              />
            </div>
          )}
          {errors.turnstileToken ? (
            <p className="mt-2 text-sm font-medium text-[#8c3f1f]">{errors.turnstileToken}</p>
          ) : null}
        </div>

        <div aria-live="polite" className="min-h-6 text-sm font-medium text-[#244f44]">
          {statusMessage}
        </div>

        <button
          type="submit"
          disabled={submitState === "submitting"}
          className="w-fit border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitState === "submitting" ? "Sending..." : "Send message"}
        </button>
      </div>
    </form>
  );
}
