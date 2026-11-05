import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifyReceipt, type VerifiableReceipt } from "@/lib/receipts/verify";

/**
 * Public receipt verifier — /verify/:id. Fetches the signed decision receipt
 * and re-checks its SHA-256 + Ed25519 signature server-side (deterministic,
 * lib/receipts). Anyone can confirm RePal's decision wasn't tampered with.
 */

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5">
      <span className="text-sm text-[var(--color-muted)]">{label}</span>
      <span className={`text-sm ${mono ? "font-mono text-xs" : ""} max-w-[60%] break-all text-right`}>
        {value}
      </span>
    </div>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id } });

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh">
      <nav className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          Re<span className="text-[var(--color-brand)]">Pal</span>
        </Link>
        <span className="text-sm text-[var(--color-muted)]">Public receipt verifier</span>
      </nav>
      <div className="mx-auto max-w-2xl px-6 pb-24">{children}</div>
    </main>
  );

  if (!receipt) {
    return shell(
      <div className="mt-10 rounded-2xl border border-white/10 p-8 text-center">
        <h1 className="text-xl font-semibold">Receipt not found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          No signed decision receipt exists for id <span className="font-mono">{id}</span>.
        </p>
      </div>,
    );
  }

  let verdict: "verified" | "tampered" | "unavailable" = "unavailable";
  try {
    verdict = verifyReceipt(receipt as unknown as VerifiableReceipt) ? "verified" : "tampered";
  } catch {
    verdict = "unavailable"; // signing key not configured in this environment
  }

  const banner = {
    verified: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", txt: "✓ Signature verified — this receipt is authentic and untampered." },
    tampered: { cls: "border-red-500/40 bg-red-500/10 text-red-300", txt: "✕ Signature INVALID — this receipt has been tampered with." },
    unavailable: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-300", txt: "⚠ Cannot verify here — the signing key isn't configured in this environment." },
  }[verdict];

  return shell(
    <div className="mt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Decision receipt</h1>
      <div className={`mt-4 rounded-xl border p-4 text-sm font-medium ${banner.cls}`}>{banner.txt}</div>

      <div className="mt-6 rounded-2xl border border-white/10 p-6">
        <Row label="Item" value={receipt.item} />
        <Row label="Merchant" value={receipt.merchant} />
        <Row label="Category" value={receipt.category} />
        <Row label="List price" value={`$${receipt.priceUsd.toFixed(2)}`} />
        <Row label="Saved via rewards" value={`$${receipt.savedUsd.toFixed(2)}`} />
        <Row label="Cash moved (PayPal)" value={`$${receipt.cashUsd.toFixed(2)}`} />
        <Row label="PayPal order" value={receipt.paypalOrderId} mono />
        <Row label="PayPal capture" value={receipt.paypalCaptureId} mono />
        {receipt.payoutBatchId && <Row label="Payout batch" value={receipt.payoutBatchId} mono />}
        <Row label="SHA-256" value={receipt.sha256} mono />
        <Row label="Ed25519 signature" value={receipt.signature} mono />
        <Row label="Issued" value={new Date(receipt.createdAt).toUTCString()} />
      </div>

      <p className="mt-4 text-xs text-[var(--color-muted)]">
        Verification recomputes the canonical SHA-256 of the receipt and checks the Ed25519 signature
        against RePal&apos;s public key — the same deterministic code path, auditable by anyone.
      </p>
    </div>,
  );
}
