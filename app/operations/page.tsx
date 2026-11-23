"use client";

import dynamic from "next/dynamic";
import { DashboardShell, I } from "@/components/dashboard/shell";

// RePal's OWN PayPal seller/platform account activity (Transaction Search +
// Balances API). This is operator/platform data — deliberately separated from
// the customer "Your RePal impact" dashboard, which is personal financial data.
const PayPalActivity = dynamic(
  () => import("@/components/insights/PayPalActivity").then((m) => m.PayPalActivity),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 animate-pulse rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]" />
    ),
  },
);

export default function OperationsPage() {
  return (
    <DashboardShell
      title="Operator reporting"
      subtitle="RePal's own PayPal account — platform data, not a customer's personal financial activity."
    >
      <div className="mt-6 space-y-5">
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/10 p-4 text-[13.5px]">
          <I.shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[var(--color-fg)]">
            <span className="font-semibold">Operator-only.</span> This is RePal&apos;s merchant/platform PayPal account
            (Transaction Search &amp; Balances). It is intentionally kept out of the customer{" "}
            <a href="/insights" className="font-medium text-[var(--color-brand)] hover:underline">
              Insights
            </a>{" "}
            dashboard, which shows each customer only their own signed receipts, payouts and refunds.
          </p>
        </div>
        <PayPalActivity />
      </div>
    </DashboardShell>
  );
}
