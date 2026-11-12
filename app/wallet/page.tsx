"use client";

import { WalletDashboard } from "@/components/wallet/WalletDashboard";

/** /wallet — the Rewards Wallet dashboard (sidebar shell + gradient hero +
 *  reward cards + recent activity + the end-to-end RePal journey). */
export default function WalletPage() {
  return (
    <main className="hero-aura min-h-dvh">
      <WalletDashboard />
    </main>
  );
}
