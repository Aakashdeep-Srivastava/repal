import type { Metadata } from "next";
import { StackEngine } from "@/components/stack/StackEngine";

// Interactive demo surface, not marketing content → noindex.
export const metadata: Metadata = {
  title: "The Stack",
  description: "One tap stacks every eligible reward into a single PayPal payment.",
  robots: { index: false, follow: true },
};

/** /stack — "The Stack": the cinematic stacking engine, in RePal's own brand
 *  theme (light by default, dark via the app toggle). Type uses the app's
 *  bundled fonts (Fraunces display + Geist mono via next/font) — no external
 *  stylesheet — so it renders with no FOUT and builds offline in CI.
 *  The money math is the real deterministic optimizer (lib/stack/compute). */
export default function StackPage() {
  return <StackEngine />;
}
