import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function parseAppBaseUrl(baseUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("Invalid application base URL.");
  }

  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Invalid application base URL.");
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");

  return parsed.toString().replace(/\/+$/, "");
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing Stripe server configuration.");
  }

  stripeClient ??= new Stripe(secretKey);

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new Error("Missing Stripe webhook configuration.");
  }

  return webhookSecret;
}

export function constructStripeWebhookEvent(rawBody: string, signature: string) {
  return getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
}

export function getAppBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("Missing application base URL.");
  }

  return parseAppBaseUrl(baseUrl);
}
