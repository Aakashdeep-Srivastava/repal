"use client";

/**
 * Consent-first Gmail connect control. Dormant (renders nothing) unless Gmail
 * OAuth is configured server-side, so the wallet is unchanged until Google creds
 * exist. When connected, shows the account + a disconnect (revoke) button.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGmailStatus, disconnectGmail } from "@/lib/client";

export function ConnectGmail() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["gmail-status"], queryFn: fetchGmailStatus });
  const disconnect = useMutation({
    mutationFn: disconnectGmail,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail-status"] }),
  });

  if (!data?.configured) return null; // dormant until GOOGLE_CLIENT_ID is set

  if (data.connected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm">
        <span className="min-w-0 truncate text-[var(--color-muted)]">
          Gmail connected · <span className="text-[var(--color-fg)]">{data.email}</span>
          <span className="ml-2 rounded-full bg-[var(--color-brand)]/10 px-2 py-0.5 text-xs text-[var(--color-brand)]">
            read-only, reward emails only
          </span>
        </span>
        <button
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:text-[var(--color-fg)] disabled:opacity-60"
        >
          {disconnect.isPending ? "…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/connect/gmail/start"
      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 px-4 py-3 text-sm hover:bg-[var(--color-brand)]/10"
    >
      <span className="text-[var(--color-fg)]">
        Connect Gmail to import real rewards
        <span className="ml-2 text-xs text-[var(--color-muted)]">read-only · only reward emails · revocable</span>
      </span>
      <span className="shrink-0 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 font-medium text-white">Connect</span>
    </a>
  );
}
