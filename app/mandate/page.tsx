"use client";

import { Suspense } from "react";
import { MandateStudio } from "@/components/mandate/MandateStudio";

/** /mandate — Mandate Studio: configure the agent's PayPal-Vault spending authority. */
export default function MandatePage() {
  // MandateStudio reads ?vault=1 via useSearchParams, which must sit under a
  // Suspense boundary so the route isn't forced into a CSR bailout at build.
  return (
    <Suspense fallback={null}>
      <MandateStudio />
    </Suspense>
  );
}
