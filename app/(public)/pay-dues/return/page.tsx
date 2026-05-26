import type { Metadata } from "next";
import Link from "next/link";
import {
  getGuestPaymentReturnContent,
  normalizeGuestPaymentReturnStatus,
} from "@/lib/public/guest-payment-session";
import { paymentEntryRoutes } from "@/lib/public/payments";

type GuestPaymentReturnPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Guest Payment Status | Spring Meadow Community",
  description: "Guest payment return status for Spring Meadow Community dues.",
};

export default async function GuestPaymentReturnPage({ searchParams }: GuestPaymentReturnPageProps) {
  const params = await searchParams;
  const status = normalizeGuestPaymentReturnStatus(params?.status);
  const content = getGuestPaymentReturnContent(status);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public payment entry</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          {content.heading}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">{content.message}</p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="guest-payment-return-heading"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 id="guest-payment-return-heading" className="text-2xl font-semibold text-[#17211d]">
            Next step
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#41504a]">
            For payment questions, use the public contact path with the receipt information sent by
            the payment processor.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={paymentEntryRoutes.entry}
              className="inline-flex w-full items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-4 py-3 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
            >
              Return to pay dues
            </Link>
            <Link
              href={paymentEntryRoutes.contact}
              className="inline-flex w-full items-center justify-center border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
            >
              Contact the HOA
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
