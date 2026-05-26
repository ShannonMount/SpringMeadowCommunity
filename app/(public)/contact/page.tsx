import type { Metadata } from "next";
import { ContactForm } from "@/components/public/contact-form";

export const metadata: Metadata = {
  title: "Contact | Spring Meadow Community",
  description: "Contact Spring Meadow Community with general public HOA questions.",
};

export default function ContactPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[var(--accent)]">Public contact</p>
        <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
          Contact the HOA
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#41504a]">
          Send general community questions to Spring Meadow Community. This public form is for
          general HOA messages, including vendor services questions, and does not need portal
          access.
        </p>
      </section>

      <section
        className="border-t border-[var(--border)] bg-[var(--surface)]"
        aria-labelledby="contact-form-heading"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 id="contact-form-heading" className="text-2xl font-semibold text-[#17211d]">
              Send a message
            </h2>
            <p className="mt-3 leading-7 text-[#41504a]">
              Share your name, reply email, optional phone, and message. A community representative
              can follow up through the contact details you provide. Vendor services messages are
              handled as a general public contact request and submitting one does not create portal access.
            </p>
          </div>

          <ContactForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </div>
      </section>
    </>
  );
}
