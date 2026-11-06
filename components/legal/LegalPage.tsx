import Link from "next/link";

/**
 * Shared shell for the static legal pages (/privacy, /terms). Server component,
 * no data fetching. These URLs are also what the PayPal developer app's
 * "Log in with PayPal" settings point at (privacy policy + user agreement).
 */
export const LEGAL_EFFECTIVE_DATE = "November 6, 2026";
/** Public contact for privacy/terms requests — set NEXT_PUBLIC_CONTACT_EMAIL. */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** "email us at x" when a contact is configured, else a neutral fallback. */
export function ContactLine() {
  return CONTACT_EMAIL ? (
    <>
      email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </>
  ) : (
    <>contact the RePal team</>
  );
}

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <nav className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Re<span className="text-[var(--color-brand)]">Pal</span>
        </Link>
        <div className="flex gap-4 text-sm text-[var(--color-muted)]">
          <Link href="/privacy" className="hover:text-[var(--color-fg)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--color-fg)]">
            Terms
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Effective {LEGAL_EFFECTIVE_DATE}</p>

        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          RePal is a hackathon prototype running on PayPal&apos;s <strong>sandbox</strong>. No
          real money moves, and the reward sources shown are sample data.
        </p>

        <p className="mt-6 leading-relaxed">{intro}</p>

        <div className="legal mt-8 space-y-8 leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[var(--color-brand)] [&_a]:underline">
          {children}
        </div>
      </article>
    </main>
  );
}
