type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
        Public section
      </p>
      <h1 className="text-3xl font-semibold tracking-normal text-[#17211d] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-5 leading-7 text-[#41504a]">
        This public page is ready for its dedicated feature story. It does not
        load private resident, property, payment, board, or document data.
      </p>
    </section>
  );
}
