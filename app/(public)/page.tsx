import Image from "next/image";
import Link from "next/link";
import { CommunityContentEmptyState } from "@/components/public/community-content-empty-state";
import {
  communityContent,
  communityContentEmptyState,
  hasCommunityOverviewContent,
} from "@/lib/public/community-content";
import entranceSign from "@/images/FrontCommunitySign.png";
import poolImage from "@/images/SpringMeadowPool.png";
import trailImage from "@/images/Trail.png";

export default function HomePage() {
  if (!hasCommunityOverviewContent()) {
    return (
      <CommunityContentEmptyState
        title={communityContentEmptyState.title}
        description={communityContentEmptyState.description}
      />
    );
  }

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#17211d]">
        <Image
          src={entranceSign}
          alt="Spring Meadow Community entrance sign"
          fill
          preload
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[#17211d]/55" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-white">
            <p className="text-sm font-semibold">{communityContent.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{communityContent.name}</h1>
            <p className="mt-5 text-lg leading-8 text-[#eef5ed]">{communityContent.overview}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/about"
                className="border border-white bg-white px-4 py-2 text-sm font-semibold text-[#17211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                Community Info
              </Link>
              <Link
                href="/contact"
                className="border border-white/80 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-16">
        <div>
          <p className="text-sm font-semibold text-[var(--accent)]">Official HOA overview</p>
          <h2 className="mt-3 text-3xl font-semibold text-[#17211d]">Public information, clearly separated from private records</h2>
          <ul className="mt-6 grid gap-4">
            {communityContent.homeHighlights.map((highlight) => (
              <li key={highlight} className="border-l-4 border-[var(--gold)] bg-[var(--surface)] px-5 py-4 leading-7 text-[#41504a]">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <figure className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            <Image
              src={poolImage}
              alt="Spring Meadow Community pool and gathering area"
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="h-64 w-full object-cover"
            />
          </figure>
          <figure className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            <Image
              src={trailImage}
              alt="Tree-lined trail in Spring Meadow Community"
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="h-64 w-full object-cover"
            />
          </figure>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold text-[#17211d]">Public resources</h2>
            <div className="mt-5 grid gap-4">
              {communityContent.resourceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border border-[var(--border)] p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                >
                  <span className="block font-semibold text-[var(--accent-strong)]">{item.label}</span>
                  <span className="mt-2 block leading-7 text-[#41504a]">{item.description}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-[#17211d]">Resident and visitor entry points</h2>
            <div className="mt-5 grid gap-4">
              {communityContent.entryPoints.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border border-[var(--border)] p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                >
                  <span className="block font-semibold text-[var(--accent-strong)]">{item.label}</span>
                  <span className="mt-2 block leading-7 text-[#41504a]">{item.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
