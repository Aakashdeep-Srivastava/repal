import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "About",
  description:
    "What RePal is, how it turns forgotten rewards into real purchases, and who builds it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalPage
      title="About RePal"
      intro="RePal turns forgotten promotional rewards into actual, attributable purchases. You connect your rewards, an AI reads their fine print, a deterministic optimizer finds the cheapest price after those rewards, and PayPal executes the payment — all within limits you set and can revoke."
    >
      <section>
        <h2>What RePal does</h2>
        <p>
          Most people hold rewards they never use: coupons, cashback, gift-card
          balances, card points and statement credits scattered across email and
          apps, quietly expiring. RePal brings them into one place, understands
          what each one is actually worth and how it can be combined, and then
          puts them to work on a real purchase.
        </p>
        <ul>
          <li>
            <strong>Discovery:</strong> connect reward sources (including a
            read-only Gmail scan) so the agent can see what you have.
          </li>
          <li>
            <strong>Understanding:</strong> an AI reads each reward&apos;s terms —
            minimums, exclusions, expiry — so nothing invalid gets applied.
          </li>
          <li>
            <strong>Optimization:</strong> a deterministic optimizer (not the AI)
            computes the cheapest valid combination for what you want to buy.
          </li>
          <li>
            <strong>Execution &amp; proof:</strong> PayPal moves the money within
            your delegated authority, and every transaction produces a signed,
            independently verifiable receipt.
          </li>
        </ul>
      </section>

      <section>
        <h2>How the money logic stays trustworthy</h2>
        <p>
          The AI never computes or authorizes money. It reads terms and suggests
          intent; all amounts, eligibility and payment authority are decided by
          deterministic, tested code and a policy guard that can allow, ask, or
          deny. See our <a href="/security">security overview</a> for details.
        </p>
      </section>

      <section>
        <h2>Who builds it</h2>
        <p>
          RePal is an early-stage product built by the RePal team. The source for
          the prototype is public on{" "}
          <a href="https://github.com/Aakashdeep-Srivastava/repal">GitHub</a>. For
          questions, partnership, or press, please <ContactLine />.
        </p>
      </section>

      <section>
        <h2>Current status</h2>
        <p>
          The live experience runs on PayPal&apos;s sandbox — no real money moves
          yet, and the reward sources shown in the demo are sample data. We are
          working toward a production launch with real redemptions. How we handle
          your data is described in our <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>
    </LegalPage>
  );
}
