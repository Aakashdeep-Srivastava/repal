import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How RePal protects your money and credentials: delegated PayPal authority, deterministic money logic, and signed verifiable receipts.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security"
      intro="RePal moves money on your behalf, so its design starts from a simple rule: the AI never computes or authorizes a payment. Amounts, eligibility, and spending authority are decided by deterministic code and enforced by an explicit policy guard — and every action leaves a tamper-evident, independently verifiable receipt."
    >
      <section>
        <h2>Delegated, revocable payment authority</h2>
        <p>
          RePal never sees or stores your PayPal password or card numbers. When
          you authorize the agent, PayPal issues a scoped Vault token that lets
          RePal pay within the limits you set (your mandate). You can change those
          limits or revoke the authority at any time, and payments outside the
          mandate are refused before they reach PayPal.
        </p>
      </section>

      <section>
        <h2>Deterministic money logic</h2>
        <p>
          The language model reads reward terms and proposes intent in natural
          language. It does not decide what anything costs or whether a payment is
          allowed. Those decisions run in deterministic, unit-tested code, so the
          same inputs always produce the same, auditable result — no model
          guesswork touches a dollar amount.
        </p>
      </section>

      <section>
        <h2>Policy guard: allow, ask, deny</h2>
        <p>
          Every proposed action passes through a policy guard that either allows
          it, pauses to ask for your confirmation, or denies it outright — based
          on your mandate, the reward&apos;s real terms, and spending limits. This
          keeps a human in control of anything consequential.
        </p>
      </section>

      <section>
        <h2>Signed, verifiable receipts</h2>
        <p>
          Each transaction produces a receipt signed with an Ed25519 key over a
          canonical representation of the facts. Anyone can verify a receipt
          hasn&apos;t been altered without trusting RePal — the signature and the
          numbers it covers are checkable independently. This is how &quot;the
          agent paid X, saved Y&quot; stays provable rather than merely asserted.
        </p>
      </section>

      <section>
        <h2>Transport &amp; data handling</h2>
        <p>
          The site is served only over HTTPS with HSTS, a strict Content Security
          Policy, and standard hardening headers. What data we collect, why, and
          who processes it is described in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>Reporting a vulnerability</h2>
        <p>
          If you believe you&apos;ve found a security issue, please{" "}
          <ContactLine /> so we can investigate. The prototype&apos;s source is
          public on{" "}
          <a href="https://github.com/Aakashdeep-Srivastava/repal">GitHub</a>.
        </p>
      </section>
    </LegalPage>
  );
}
