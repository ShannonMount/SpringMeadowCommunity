type AdminPlaceholderSectionProps = {
  eyebrow: string;
  title: string;
};

export function AdminPlaceholderSection({ eyebrow, title }: AdminPlaceholderSectionProps) {
  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">
        This workspace section is not available yet.
      </p>
    </section>
  );
}
