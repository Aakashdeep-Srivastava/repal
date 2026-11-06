import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — RePal",
  description: "What RePal collects, why, who processes it, and your choices.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information RePal collects when you use it, how it is used, which services process it on our behalf, and the choices you have."
    >
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Your PayPal profile, if you log in with PayPal:</strong> your name, email
            address and PayPal payer ID, as shared by PayPal with your permission. We never see
            your PayPal password.
          </li>
          <li>
            <strong>Rewards in your wallet:</strong> gift cards, coupons, cashback offers and
            points, including their terms and expiry dates. In this prototype these come from
            sample sources. RePal does not read your email inbox, card accounts or loyalty
            accounts.
          </li>
          <li>
            <strong>Spending limits you set:</strong> per-purchase cap, budget, approval threshold
            and allowed categories or merchants (your &ldquo;mandate&rdquo;).
          </li>
          <li>
            <strong>Shopping activity:</strong> what you search for, what you ask the assistant,
            the plans it produces, and the steps it took to get there.
          </li>
          <li>
            <strong>Payments and receipts:</strong> PayPal order and capture IDs, the item,
            merchant, price, savings and amount paid, and a signed receipt for each purchase.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address, used briefly to rate-limit requests
            and protect the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To sign you in and keep you signed in.</li>
          <li>To find products and work out which of your rewards apply and how much you save.</li>
          <li>To check every purchase against the limits you set before any payment is made.</li>
          <li>To process payments through PayPal and issue receipts anyone can verify.</li>
          <li>To keep the service secure and prevent abuse.</li>
        </ul>
        <p>We do not sell your information or use it for advertising.</p>
      </section>

      <section>
        <h2>Who processes it</h2>
        <p>RePal relies on these providers, each only for the purpose listed:</p>
        <ul>
          <li>
            <strong>PayPal</strong> (login and payments): handles your login and every payment.
          </li>
          <li>
            <strong>Amazon Web Services (Bedrock)</strong> (AI): reward terms and the goals you
            type are sent to an AI model (Claude by Anthropic) to read fine print and explain
            plans. Prices and savings are always calculated by RePal&apos;s own code, never by
            the AI.
          </li>
          <li>
            <strong>Channel3</strong> (product search): receives your search terms to return
            products and prices.
          </li>
          <li>
            <strong>Neon</strong> (database) and <strong>Render</strong> (hosting): store the data
            above and run the app, in the United States.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <ul>
          <li>
            <strong>Session cookie</strong> (<code>repal_session</code>): keeps you signed in for
            up to 7 days. It is signed, not readable by scripts, and removed when you log out.
          </li>
          <li>
            <strong>Browser storage:</strong> remembers your light/dark theme and, for the current
            tab only, your checkout progress so a refresh doesn&apos;t lose it.
          </li>
        </ul>
        <p>We do not use advertising or third-party tracking cookies.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your information while the prototype is running or until you ask us to delete
          it. Signed receipts may be kept so they stay verifiable. Demo data may be reset at any
          time.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can use the demo login instead of your PayPal account.</li>
          <li>You can log out at any time, which removes the session cookie.</li>
          <li>
            You can ask to see, correct or delete your information, and you can remove
            RePal&apos;s access in your PayPal account settings.
          </li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is sent over encrypted connections, sessions are signed, and every receipt carries
          a digital signature so tampering can be detected. No system is perfectly secure, so
          please don&apos;t store sensitive information in this prototype.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>RePal is not intended for anyone under 18.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we will update the date at the top of this page. For questions
          or requests, <ContactLine />. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
