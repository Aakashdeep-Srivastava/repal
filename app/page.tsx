export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="space-y-3">
        <p className="text-sm font-mono text-[var(--color-brand)]">
          Re·wards + Pay·Pal
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">RePal</h1>
        <p className="text-lg text-[var(--color-muted)]">
          An agentic rewards-to-money layer. State a goal in plain language; the
          AI reads your rewards&apos; fine print, a deterministic optimizer finds
          the cheapest SKU <em>after</em> your rewards, and PayPal moves the
          money across the whole lifecycle.
        </p>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        🚧 Foundation scaffolded. See <code>docs/TEAM.md</code> for who owns what
        and <code>CONTRIBUTING.md</code> for the ground rules.
      </p>
    </main>
  );
}
