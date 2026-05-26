import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptPropertyInvitation,
  PROPERTY_INVITATION_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/property-invitations";

export const metadata: Metadata = {
  title: "Accept Invitation | Spring Meadow Community",
};

type AcceptInvitationPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

function getSingleToken(token: string | string[] | undefined) {
  return Array.isArray(token) ? token[0] : token;
}

function buildLoginRedirect(token: string | undefined) {
  const nextPath = token
    ? `/portal/invitations/accept?token=${encodeURIComponent(token)}`
    : "/portal/invitations/accept";

  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const params = await searchParams;
  const token = getSingleToken(params?.token);
  const result = await acceptPropertyInvitation(token);

  if (result.kind === "unauthenticated") {
    redirect(buildLoginRedirect(token));
  }

  const isAccepted = result.kind === "accepted";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Resident portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
          {isAccepted ? "Invitation accepted" : "Invitation unavailable"}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
          {isAccepted
            ? "Your resident account has been linked. You can continue to the resident portal."
            : result.message || PROPERTY_INVITATION_UNAVAILABLE_MESSAGE}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/portal"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Go to resident portal
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Contact the HOA
          </Link>
        </div>
      </section>
    </main>
  );
}
