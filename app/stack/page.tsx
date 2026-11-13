import { StackEngine } from "@/components/stack/StackEngine";

/** /stack — "The Stack": a cinematic obsidian stacking engine. Fonts are loaded
 *  at runtime via <link> (not next/font) so the sandboxed CI image builds offline.
 *  The money math is the real deterministic optimizer (lib/stack/compute). */
export default function StackPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Space+Mono:wght@400;700&display=swap"
      />
      <StackEngine />
    </>
  );
}
