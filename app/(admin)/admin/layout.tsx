import { redirect } from "next/navigation";
import { AdminWorkspaceNav } from "@/components/admin/admin-workspace-nav";
import { signOutCommunityUser } from "@/server/actions/auth";
import { getAdminWorkspaceContext } from "@/server/services/auth/admin-workspace";

type AdminWorkspaceLayoutProps = {
  children: React.ReactNode;
};

function unavailableState(title: string, message: string) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin workspace</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">{message}</p>
        <form action={signOutCommunityUser} className="mt-8">
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

export default async function AdminWorkspaceLayout({
  children,
}: Readonly<AdminWorkspaceLayoutProps>) {
  const workspaceResult = await getAdminWorkspaceContext();

  if (workspaceResult.kind === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }

  if (workspaceResult.kind === "profile-unavailable") {
    return unavailableState("Access unavailable", "Your profile is not available right now.");
  }

  if (workspaceResult.kind === "permission-denied") {
    return unavailableState("Access denied", "You do not have access to the admin workspace.");
  }

  if (workspaceResult.kind !== "workspace") {
    return unavailableState("Access unavailable", "The admin workspace is temporarily unavailable.");
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin workspace</p>
            <p className="mt-1 truncate text-xl font-semibold text-[var(--foreground)]">
              Spring Meadow Community
            </p>
          </div>
          <form action={signOutCommunityUser}>
            <button
              type="submit"
              className="min-h-10 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AdminWorkspaceNav items={workspaceResult.workspace.navigationItems} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
