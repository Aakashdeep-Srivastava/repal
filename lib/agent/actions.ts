import { prisma } from "@/lib/db";
import { gateSpend } from "@/lib/policy/gate";
import { createOrder, captureOrder, type PayPalOrder } from "@/lib/paypal/orders";
import { issueReceipt } from "@/lib/receipts/issue";
import { liberateReward } from "@/lib/payout/liberate";

/**
 * Agent money actions — deterministic wrappers the orchestrator's pay/payout
 * tools call. The LLM NEVER computes amounts: every number comes from the plan
 * (optimizer) or the reward (DB). Every spend re-runs the policy gate here, so
 * the model cannot bypass the mandate even if it tries.
 *
 * Autonomy model: the agent settles plans the deterministic policy marks
 * `allow` (i.e. within the user's cap/budget and UNDER their approval threshold).
 * Anything `ask` (over threshold) or `deny` is refused here and handed back to
 * the human — the threshold IS the human-in-the-loop boundary.
 */

export interface AgentPlan {
  offer: { id: string; title: string; priceUsd: number; retailer: string };
  cashUsd: number;
  savedUsd: number;
}

function captureIdOf(r: PayPalOrder): string {
  const c = (r as unknown as {
    purchase_units?: { payments?: { captures?: { id?: string }[] } }[];
  })?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return typeof c === "string" ? c : r.id;
}

export async function agentPay(input: { userId: string; category: string; plan: AgentPlan }) {
  const { userId, category, plan } = input;

  // Re-gate deterministically against the real active mandate.
  const gate = await gateSpend({
    userId,
    category,
    merchant: plan.offer.retailer,
    cashUsd: plan.cashUsd,
  });
  if (gate.decision === "deny") {
    return { status: "denied" as const, reasons: gate.reasons };
  }
  if (gate.decision === "ask") {
    return {
      status: "needs_approval" as const,
      reasons: gate.reasons,
      message:
        "This purchase is above your approval threshold — approve it at checkout to proceed.",
    };
  }

  // allow → charge the Vault token with no buyer redirect. Requires a
  // Vault-backed mandate (createOrder({vaultId})).
  const mandate = await prisma.mandate.findFirst({
    where: { userId, status: "active", paypalVaultTokenId: { not: null } },
    orderBy: { expiresAt: "desc" },
  });
  if (!mandate?.paypalVaultTokenId) {
    return {
      status: "no_vault" as const,
      message:
        "To pay autonomously I need a Vault-backed spending mandate. Grant one at /mandate, then ask me again.",
    };
  }

  const order = await createOrder({
    amountUsd: plan.cashUsd,
    description: plan.offer.title,
    vaultId: mandate.paypalVaultTokenId,
  });
  const capture = await captureOrder(order.id);
  const receipt = await issueReceipt({
    userId,
    runId: `agent-${order.id}`,
    item: plan.offer.title,
    merchant: plan.offer.retailer,
    category,
    priceUsd: plan.offer.priceUsd,
    savedUsd: plan.savedUsd,
    cashUsd: plan.cashUsd,
    paypalOrderId: order.id,
    paypalCaptureId: captureIdOf(capture),
  });
  return {
    status: "paid" as const,
    receiptId: receipt.id,
    verifyUrl: `/verify/${receipt.id}`,
    paypalOrderId: order.id,
    cashUsd: plan.cashUsd,
    savedUsd: plan.savedUsd,
  };
}

export async function agentPayout(input: {
  userId: string;
  rewardId?: string;
  receiverEmail: string;
  amountUsd: number;
}) {
  try {
    const r = await liberateReward(input);
    return { status: "liberated" as const, ...r };
  } catch (e) {
    return { status: "failed" as const, error: e instanceof Error ? e.message : "payout failed" };
  }
}
