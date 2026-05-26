"use server";

import { redirect } from "next/navigation";
import {
  createResidentPaymentSession,
  type ResidentPaymentSessionInput,
  type ResidentPaymentSessionResult,
} from "@/server/services/payments/resident-payment-session";

const DECIMAL_DOLLAR_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;
const INTEGER_CENTS_PATTERN = /^\d+$/;

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAmountCents(formData: FormData) {
  const amountCents = stringValue(formData.get("amountCents"));

  if (amountCents && INTEGER_CENTS_PATTERN.test(amountCents)) {
    const parsed = Number(amountCents);

    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  const amount = stringValue(formData.get("amount")).replaceAll(",", "");

  if (!DECIMAL_DOLLAR_PATTERN.test(amount)) {
    return null;
  }

  const [dollars, cents = ""] = amount.split(".");
  const normalizedCents = cents.padEnd(2, "0");
  const parsed = Number(`${dollars}${normalizedCents}`);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseMethodPreference(value: string) {
  return value === "card" || value === "ach" ? value : undefined;
}

function paymentStatusKey(result: Exclude<ResidentPaymentSessionResult, { kind: "session-created" }>) {
  const statusKeys: Record<typeof result.kind, string> = {
    "invalid-request": "invalid",
    unauthorized: "unauthorized",
    "configuration-unavailable": "unavailable",
    "payment-unavailable": "unavailable",
  };

  return statusKeys[result.kind];
}

export async function startResidentPaymentSession(formData: FormData) {
  const amountCents = parseAmountCents(formData);

  if (!amountCents) {
    redirect("/portal/payments?payment=invalid");
  }

  const input: ResidentPaymentSessionInput = {
    communityId: stringValue(formData.get("communityId")),
    propertyId: stringValue(formData.get("propertyId")),
    amountCents,
    methodPreference: parseMethodPreference(stringValue(formData.get("methodPreference"))),
  };

  const result = await createResidentPaymentSession(input);

  if (result.kind === "session-created") {
    redirect(result.checkoutUrl);
  }

  redirect(`/portal/payments?payment=${paymentStatusKey(result)}`);
}
