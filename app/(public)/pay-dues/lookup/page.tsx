import type { Metadata } from "next";
import Link from "next/link";
import { GuestPaymentLookupForm } from "@/components/public/guest-payment-lookup-form";
import { paymentEntryRoutes, publicPaymentSettings } from "@/lib/public/payments";

export const metadata: Metadata = {
  title: "Guest Payment Lookup | Spring Meadow Community",
  description: "Public guest payment lookup entry point for Spring Meadow Community.",
};

export default function GuestPaymentLookupPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public payment entry</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Guest payment lookup
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Enter the details from your dues notice or HOA correspondence. The public lookup keeps
          account details protected and only confirms whether you can continue.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="guest-payment-lookup-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <h2 id="guest-payment-lookup-heading" className="text-2xl font-semibold text-[#17211d]">
              Lookup details
            </h2>
            <p className="mt-3 leading-7 text-[#41504a]">
              Use either a public payment code, or pair a ZIP code with a street address or account
              reference. The lookup response will not show account details.
            </p>
            <Link
              href={paymentEntryRoutes.contact}
              className="mt-6 inline-flex w-full items-center justify-center border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
            >
              Contact the HOA about dues
            </Link>
          </div>

          <GuestPaymentLookupForm
            communitySlug={publicPaymentSettings.communitySlug}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          />
        </div>
      </section>
    </>
  );
}
