import type { Metadata } from "next";
import Link from "next/link";
import {
  getVendorProposalPlaceholderState,
  vendorProposalSettings,
} from "@/lib/public/vendor-proposals";

export const metadata: Metadata = {
  title: "Vendor Proposal Intake | Spring Meadow Community",
  description: "Public vendor proposal availability and contact guidance for Spring Meadow Community.",
};

export default function VendorsPage() {
  const placeholderState = getVendorProposalPlaceholderState(vendorProposalSettings);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public vendor services</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Vendor proposal intake
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Spring Meadow Community is not accepting online vendor proposals through a dedicated
          intake module yet. Current vendor and service questions should use the public contact
          path.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="vendor-placeholder-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <article className="border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 id="vendor-placeholder-heading" className="text-2xl font-semibold text-[#17211d]">
              {placeholderState.heading}
            </h2>
            <p className="mt-3 leading-7 text-[#41504a]">{placeholderState.description}</p>
            <p className="mt-3 leading-7 text-[#41504a]">
              Use the public contact page to Contact the HOA about vendor services.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={placeholderState.primaryHref}
                aria-label={placeholderState.primaryLabel}
                className="inline-flex w-full items-center justify-center border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-4 py-3 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:w-auto"
              >
                {placeholderState.primaryLabel}
              </Link>
            </div>
          </article>

          <aside className="border border-[var(--border)] bg-[#f7f8f5] p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-[#17211d]">What happens now</h2>
            <p className="mt-3 leading-7 text-[#41504a]">
              Messages sent through the public contact form are general public contact requests.
              They do not create vendor accounts or private access.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
