import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import RescueDashboard from "@/components/rescue/RescueDashboard";

// Authenticated recovery dashboard (personalized reward timeline) → noindex.
export const metadata: Metadata = {
  title: "Reward Rescue",
  description: "Cash out rewards before they expire — a timeline of what to rescue first.",
  robots: { index: false, follow: true },
};

/**
 * /rescue — the rewards-recovery dashboard. Surfaces expiring rewards and the
 * best way to use each one before it lapses, inside the shared AppShell.
 *
 * (Replaced the Bryntum Scheduler timeline, whose enterprise CSS was clobbered by
 * the global Tailwind reset and rendered as a vertical label stack. The custom,
 * dependency-free RewardTimeline is the fit-for-purpose fix — see
 * components/rescue/RewardTimeline.tsx.)
 */
export const dynamic = "force-dynamic";

export default function RescuePage() {
  return (
    <AppShell active="rescue">
      <RescueDashboard />
    </AppShell>
  );
}
