import { redirect } from "next/navigation";
import { ResidentPortalNav } from "@/components/resident/resident-portal-nav";
import { signOutResident } from "@/server/actions/auth";
import { PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE } from "@/server/services/auth/property-memberships";
import { PROFILE_UNAVAILABLE_MESSAGE } from "@/server/services/auth/current-profile";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";

type ResidentPortalMemberLayoutProps = {
  children: React.ReactNode;
};

function unavailableState(title: string, message: string) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Resident portal</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">{message}</p>
        <form action={signOutResident} className="mt-8">
          <button
            type="submit"
            className="min-h-11 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function ResidentPortalMemberLayout({
  children,
}: Readonly<ResidentPortalMemberLayoutProps>) {
  const membershipResult = await getResidentPortalMemberships();
  const nextPath = "/portal";

  if (membershipResult.kind === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (membershipResult.kind === "profile-unavailable") {
    return unavailableState("Profile unavailable", PROFILE_UNAVAILABLE_MESSAGE);
  }

  if (membershipResult.kind !== "active-memberships") {
    return unavailableState("No property access available", PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE);
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-[var(--accent)]">Resident portal</p>
            <p className="mt-1 truncate text-xl font-semibold text-[var(--foreground)]">
              Spring Meadow Community
            </p>
          </div>
          <form action={signOutResident}>
            <button
              type="submit"
              className="min-h-10 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <ResidentPortalNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
