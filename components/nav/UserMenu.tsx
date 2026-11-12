"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, logout } from "@/lib/client";

/**
 * UserMenu — the signed-in person in the navbar: a gradient initial-avatar
 * (PayPal gives us no photo, only name/email), their name on wider screens, and
 * a dropdown with account details + quick links + Log out. Renders nothing when
 * logged out (the parent shows the login affordances). Self-contained: shares
 * the cached ["me"] query, so dropping it into any nav costs no extra fetch.
 */

/** Deterministic gradient avatar with the user's initial. */
function Avatar({ label, size = 32 }: { label: string; size?: number }) {
  const initial = label.trim().charAt(0).toUpperCase() || "U";
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        fontSize: size * 0.44,
        background: "linear-gradient(135deg, var(--color-brand), var(--color-cyan))",
      }}
    >
      {initial}
    </span>
  );
}

export function UserMenu() {
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setOpen(false);
    },
  });

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!me) return null;

  const label = me.name ?? me.email ?? me.userId;
  const sub =
    me.name && me.email ? me.email : me.userId === "demo-user" ? "Demo account" : me.email ?? me.userId;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] py-1 pl-1 pr-1.5 shadow-sm transition-colors hover:border-[var(--color-brand)]/40 sm:pr-2.5"
      >
        <Avatar label={label} />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-[var(--color-fg)] sm:inline">
          {label}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`hidden h-4 w-4 text-[var(--color-muted)] transition-transform sm:block ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-[0_12px_40px_-12px_rgba(7,50,130,.3)]"
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar label={label} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-fg)]">{label}</p>
                <p className="truncate text-xs text-[var(--color-muted)]">{sub}</p>
              </div>
            </div>

            <div className="my-1 h-px bg-[var(--color-border)]" />

            {[
              { href: "/wallet", label: "Wallet" },
              { href: "/mandate", label: "Mandate" },
              { href: "/insights", label: "Insights" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-2 text-sm text-[var(--color-fg)] transition-colors hover:bg-[var(--color-brand)]/5"
              >
                {item.label}
              </Link>
            ))}

            <div className="my-1 h-px bg-[var(--color-border)]" />

            <button
              type="button"
              role="menuitem"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
            >
              {signOut.isPending ? "Logging out…" : "Log out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
