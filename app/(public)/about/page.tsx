import Image from "next/image";
import Link from "next/link";
import { CommunityContentEmptyState } from "@/components/public/community-content-empty-state";
import {
  communityContent,
  communityContentEmptyState,
  hasCommunityOverviewContent,
} from "@/lib/public/community-content";
import communityImage from "@/images/Community.png";
import poolImage from "@/images/SpringMeadowPool.png";

export default function AboutPage() {
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
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
        <div>
          <p className="text-sm font-semibold text-[var(--accent)]">Community information</p>
          <h1 className="mt-3 text-4xl font-semibold text-[#17211d] sm:text-5xl">
            About Spring Meadow Community
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#41504a]">
            {communityContent.name} uses this public website to share official HOA information,
            public resources, and clear entry points for visitors and residents.
          </p>
          <p className="mt-4 leading-7 text-[#41504a]">
            Public pages are intentionally limited to general community information. Private
            resident, property, board, payment, and document records belong in future authenticated
            workflows.
          </p>
        </div>
        <figure className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
          <Image
            src={communityImage}
            alt="Homes and streetscape in Spring Meadow Community"
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="h-full min-h-80 w-full object-cover"
          />
        </figure>
      </section>

      <section className="bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold text-[#17211d]">Community amenities</h2>
            <div className="mt-6 grid gap-4">
              {communityContent.amenities.map((amenity) => (
                <article key={amenity.name} className="border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--accent-strong)]">
                    {amenity.name}
                  </h3>
                  <p className="mt-2 leading-7 text-[#41504a]">{amenity.description}</p>
                </article>
              ))}
            </div>
          </div>
          <figure className="overflow-hidden border border-[var(--border)]">
            <Image
              src={poolImage}
              alt="Spring Meadow Community pool and gathering area"
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="h-full min-h-80 w-full object-cover"
            />
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-semibold text-[#17211d]">Official updates</h2>
            <p className="mt-4 leading-7 text-[#41504a]">
              Use the public navigation to find official announcements, events, resources, and
              contact paths as each feature becomes available.
            </p>
          </div>
          <ul className="grid gap-4">
            {communityContent.officialInfo.map((item) => (
              <li key={item} className="border-l-4 border-[var(--gold)] bg-[var(--surface)] px-5 py-4 leading-7 text-[#41504a]">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/announcements"
            className="border border-[var(--accent-strong)] bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Announcements
          </Link>
          <Link
            href="/events"
            className="border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            Events
          </Link>
        </div>
      </section>
    </>
  );
}
