export default function HomePage() {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Official community website
        </p>
        <h1 className="text-4xl font-semibold tracking-normal text-[#17211d] sm:text-5xl">
          Spring Meadow Community
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#41504a]">
          Find official HOA information, community updates, upcoming events,
          public resources, and entry points for dues payment and resident access.
        </p>
      </div>
      <aside className="rounded-sm border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[#17211d]">Public access</h2>
        <p className="mt-3 leading-7 text-[#41504a]">
          This public shell is intentionally privacy-safe. Resident accounts,
          property records, payments, board records, and private documents are
          not loaded on public pages.
        </p>
      </aside>
    </section>
  );
}
