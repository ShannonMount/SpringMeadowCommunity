import type { Metadata } from "next";
import Link from "next/link";
import {
  getDisabledPaymentGuidance,
  getPublicPaymentEntryState,
  paymentEntryRoutes,
  publicPaymentSettings,
} from "@/lib/public/payments";

export const metadata: Metadata = {
  title: "Pay Dues | Spring Meadow Community",
  description: "Public dues payment entry point for Spring Meadow Community.",
};

export default function PayDuesPage() {
  const entryState = getPublicPaymentEntryState(publicPaymentSettings);
  const disabledGuidance = getDisabledPaymentGuidance(publicPaymentSettings);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public payment entry</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">Pay Dues</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Start from this public dues entry point when paying on behalf of a Spring Meadow
          Community home. Public payment screens keep account details protected.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="payment-entry-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <article className="border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 id="payment-entry-heading" className="text-2xl font-semibold text-[#17211d]">
              {entryState.heading}
            </h2>
            <p className="mt-3 leading-7 text-[#41504a]">{entryState.description}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={entryState.primaryHref}
                aria-label={entryState.primaryLabel}
                className="inline-flex w-full items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-4 py-3 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
              >
                {entryState.primaryLabel}
              </Link>
              <Link
                href={paymentEntryRoutes.contact}
                className="inline-flex w-full items-center justify-center border border-[var(--border)] px-4 py-3 text-center text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
              >
                Contact the HOA about dues
              </Link>
            </div>
          </article>

          <aside className="border border-[var(--border)] bg-[#f7f8f5] p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-[#17211d]">When online guest pay is unavailable</h2>
            <p className="mt-3 leading-7 text-[#41504a]">{disabledGuidance.description}</p>
            <Link
              href={disabledGuidance.contactHref}
              className="mt-5 inline-flex w-full items-center justify-center border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
            >
              {disabledGuidance.contactLabel}
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
