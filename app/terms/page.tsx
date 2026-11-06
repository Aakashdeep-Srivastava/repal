import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — RePal",
  description: "The terms for using the RePal prototype.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms apply when you use RePal. By using it, you agree to them. If you don't agree, please don't use the service."
    >
      <section>
        <h2>What RePal is</h2>
        <p>
          RePal helps you use your rewards (gift cards, coupons, cashback and points) when you
          shop. It finds products, works out which rewards apply, checks each purchase against
          the limits you set, and pays through PayPal. It is a prototype built for the PayPal AI
          Hackathon, not a commercial product.
        </p>
      </section>

      <section>
        <h2>Sandbox only</h2>
        <ul>
          <li>
            Payments run in PayPal&apos;s sandbox (test) environment. No real money is charged or
            sent.
          </li>
          <li>Rewards in the wallet are sample data and cannot be redeemed with any merchant.</li>
          <li>Product prices come from third parties and may be out of date.</li>
        </ul>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You can sign in with PayPal or use the demo login. Your use of PayPal is also governed
          by PayPal&apos;s own terms. Keep your PayPal credentials to yourself; you are
          responsible for activity under your account.
        </p>
      </section>

      <section>
        <h2>Spending limits and approvals</h2>
        <p>
          You decide your per-purchase cap, budget, approval threshold and allowed categories or
          merchants. RePal will not pay for anything outside those limits, and asks for your
          approval above the threshold. Review each order before you confirm it.
        </p>
      </section>

      <section>
        <h2>AI-generated content</h2>
        <p>
          RePal uses an AI model to read rewards&apos; fine print and explain its suggestions.
          These explanations can be wrong. Prices, savings and amounts are always calculated by
          RePal&apos;s own rules, not by the AI, and rewards whose terms can&apos;t be read
          confidently are shown for review instead of being applied. Always check a reward&apos;s
          original terms before relying on it.
        </p>
      </section>

      <section>
        <h2>Receipts</h2>
        <p>
          Each purchase produces a digitally signed receipt that anyone can check at its verify
          link. A valid signature shows the receipt hasn&apos;t been changed since RePal issued
          it.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t attempt to break, overload or get around the service&apos;s limits.</li>
          <li>Don&apos;t access other users&apos; data or forge receipts.</li>
          <li>Don&apos;t use RePal for anything unlawful.</li>
        </ul>
        <p>We may suspend access that breaks these rules.</p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          RePal is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranties of any kind. It may change, break or be taken offline at any time, and data
          may be reset.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the extent the law allows, the RePal team is not liable for any indirect or
          consequential loss, or for any loss arising from rewards, prices or explanations shown
          in the prototype.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the date at the top shows the latest version. For questions,{" "}
          <ContactLine />. See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
