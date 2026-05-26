type CommunityContentEmptyStateProps = {
  title: string;
  description: string;
};

export function CommunityContentEmptyState({
  title,
  description,
}: CommunityContentEmptyStateProps) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm font-semibold text-[var(--accent)]">Public information</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#17211d] sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-[#41504a]">{description}</p>
      </div>
    </section>
  );
}
