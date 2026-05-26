import type { Metadata } from "next";
import Link from "next/link";
import { GuestPaymentSessionForm } from "@/components/public/guest-payment-session-form";
import { paymentEntryRoutes, publicPaymentSettings } from "@/lib/public/payments";
import { getGuestPaymentPublicSettings } from "@/server/services/payments/guest-payment-session";

export const metadata: Metadata = {
  title: "Guest Payment Details | Spring Meadow Community",
  description: "Guest payment details for Spring Meadow Community dues.",
};

export const dynamic = "force-dynamic";

export default async function GuestPaymentDetailsPage() {
  const paymentSettings = await getGuestPaymentPublicSettings(publicPaymentSettings.communitySlug);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public payment entry</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Payment details
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Enter payer and amount details for a guest dues payment. Checkout is completed on the
          secure payment page.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="guest-payment-details-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <h2 id="guest-payment-details-heading" className="text-2xl font-semibold text-[#17211d]">
              Guest payment
            </h2>
            <p className="mt-3 leading-7 text-[#41504a]">
              Use the payer email where payment communications should be sent.
            </p>
            <Link
              href={paymentEntryRoutes.lookup}
              className="mt-6 inline-flex w-full items-center justify-center border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
            >
              Start lookup again
            </Link>
          </div>

          {paymentSettings.onlinePaymentsAvailable ? (
            <GuestPaymentSessionForm
              allowCard={paymentSettings.allowCard}
              allowAch={paymentSettings.allowAch}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            />
          ) : (
            <div className="border border-[var(--border)] bg-white p-5 sm:p-6" role="status">
              <h3 className="text-xl font-semibold text-[#17211d]">
                Online guest payments are temporarily unavailable
              </h3>
              <p className="mt-3 leading-7 text-[#41504a]">
                Contact the HOA for help with dues questions.
              </p>
              <Link
                href={paymentEntryRoutes.contact}
                className="mt-6 inline-flex w-full items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-4 py-3 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
              >
                Contact the HOA
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
