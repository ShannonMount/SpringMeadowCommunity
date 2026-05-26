import type { Metadata } from "next";
import { safeCommunityRedirectPath } from "@/lib/auth/safe-redirect";
import { signInResident } from "@/server/actions/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    authError?: string;
    message?: string;
    next?: string;
  }>;
};

const genericErrorMessage = "We could not sign you in with those details.";

export const metadata: Metadata = {
  title: "Resident Login | Spring Meadow Community",
  description: "Resident login for the Spring Meadow Community portal.",
};

function safeNextPath(value?: string) {
  return safeCommunityRedirectPath(value);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasAuthError = Boolean(params?.authError);
  const nextPath = safeNextPath(params?.next);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            Resident portal
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
            Sign in to your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4f5f5a]">
            Access private community features using the email and password configured for your
            resident account.
          </p>
        </div>

        <form
          action={signInResident}
          className="grid gap-5 rounded-sm border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
        >
          <input type="hidden" name="next" value={nextPath} />

          {hasAuthError ? (
            <p
              id="login-error"
              role="alert"
              className="rounded-sm border border-[#d7a49a] bg-[#fff2ef] px-3 py-2 text-sm leading-6 text-[#7a2e25]"
            >
              {genericErrorMessage}
            </p>
          ) : (
            <p id="login-help" className="text-sm leading-6 text-[#4f5f5a]">
              Enter your resident email and password to continue.
            </p>
          )}

          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-semibold text-[var(--foreground)]">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-describedby={hasAuthError ? "login-error" : "login-help"}
              className="min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-[var(--foreground)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={hasAuthError ? "login-error" : "login-help"}
              className="min-h-11 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            />
          </div>

          <button
            type="submit"
            className="min-h-11 rounded-sm bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Sign in
          </button>
        </form>
      </div>
    </section>
  );
}
