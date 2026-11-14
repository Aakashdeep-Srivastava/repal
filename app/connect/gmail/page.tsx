"use client";

/**
 * Gmail connect — explicit consent screen (shown BEFORE the Google OAuth
 * redirect). RePal requests read-only access to Gmail; this page states plainly
 * what is accessed, what is done, what is stored, and the user's controls, and
 * requires an explicit checkbox before proceeding. No dark patterns: the button
 * is disabled until consent is given, and "Not now" is an equal option.
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RepalLogo } from "@/components/brand/RepalLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchGmailStatus, fetchMe } from "@/lib/client";

function Row({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

export default function GmailConsentPage() {
  const [agreed, setAgreed] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { data: status } = useQuery({ queryKey: ["gmail-status"], queryFn: fetchGmailStatus });

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;
  const signedIn = Boolean(me);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/connect/gmail", { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["gmail-status"] });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <main className="hero-aura min-h-dvh">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="RePal home"><RepalLogo size="sm" /></Link>
        <ThemeToggle />
      </nav>

      <div className="mx-auto max-w-3xl px-6 pb-24">
        <header className="pt-8">
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Connect Gmail
          </h1>
          <p className="mt-3 text-[var(--color-muted)]">
            RePal&apos;s agent reads your email to find rewards you&apos;re missing — gift cards,
            cashback, coupons, points — and surface them before they expire. Here&apos;s exactly what
            that means, so you can decide.
          </p>
        </header>

        <section className="mt-6 grid gap-3">
          <Row
            title="What RePal accesses"
            body="Read-only access to your Gmail (Google's gmail.readonly permission). RePal can read your messages; it can never send, delete, or modify anything."
          />
          <Row
            title="What the agent does"
            body="It scans your mail for reward offers and reads the fine print (caps, exclusions, expiry). It does not act on anything else it sees."
          />
          <Row
            title="What RePal stores"
            body="Only the reward details it extracts — the offer text, value, type, and expiry, plus the source message id. It never stores your email bodies, contacts, or non-reward messages."
          />
          <Row
            title="Your controls"
            body="You can disconnect anytime from your wallet — that deletes RePal's access token immediately. You can also revoke access in your Google Account at myaccount.google.com/permissions."
          />
        </section>

        {connected ? (
          /* Connected — show the done state instead of the consent flow. */
          <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-fg)]">Gmail connected</p>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  RePal is scanning{status?.email ? ` ${status.email}` : " your inbox"} for rewards (read-only).
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href="/wallet" className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white">
                Go to your wallet →
              </Link>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-60"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {!configured && (
              <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Gmail connection isn&apos;t enabled on this deployment yet. (No Google OAuth credentials
                configured.)
              </p>
            )}
            {configured && !signedIn && (
              <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Please sign in first, then connect Gmail.
              </p>
            )}

            <label className="mt-6 flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-[var(--color-fg)]">
                I understand RePal will have <strong>read-only</strong> access to my Gmail to find
                rewards, that it stores only the reward details it extracts, and that I can disconnect at
                any time.
              </span>
            </label>

            <div className="mt-5 flex items-center gap-3">
              <a
                href={agreed && configured && signedIn ? "/api/connect/gmail/start" : undefined}
                aria-disabled={!(agreed && configured && signedIn)}
                className={`rounded-xl px-5 py-3 text-sm font-medium text-white ${
                  agreed && configured && signedIn
                    ? "bg-[var(--color-brand)]"
                    : "pointer-events-none bg-[var(--color-brand)]/40"
                }`}
              >
                Consent &amp; connect Gmail
              </a>
              <Link
                href="/wallet"
                className="rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                Not now
              </Link>
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-[var(--color-muted)]">
          On the next screen Google asks you to grant the read-only permission. RePal&apos;s use of
          information received from Google APIs adheres to the Google API Services User Data Policy,
          including the Limited Use requirements.
        </p>
      </div>
    </main>
  );
}
