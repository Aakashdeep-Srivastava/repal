import { Fraunces, Space_Mono } from "next/font/google";
import { StackEngine } from "@/components/stack/StackEngine";

/** /stack — "The Stack": a cinematic obsidian stacking engine. The money math is
 *  the real deterministic optimizer (lib/stack/compute); only the wallet is sample. */
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-display-stack", display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono-stack", display: "swap" });

export default function StackPage() {
  return (
    <div className={`${fraunces.variable} ${spaceMono.variable}`}>
      <StackEngine />
    </div>
  );
}
