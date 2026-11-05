import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { z } from "zod";
import { claude, assertBedrockConfigured } from "@/lib/ai/bedrock";
import { prisma } from "@/lib/db";
import { renderIntent } from "@/agents/intent";

/**
 * A0 Orchestrator — AI SDK `ToolLoopAgent` on the Bedrock Claude model.
 *
 * Parses intent and drives the deterministic tool chain:
 *   render_intent → scan_wallet → parse_terms → find_offers → optimize →
 *   explain → check_policy → [request_approval] → pay → payout → issue_receipt
 *
 * The orchestrator NEVER computes money — it only routes to deterministic
 * lib/ functions and reads / plans / explains / asks. See docs/TECH_PRD.md §3.
 *
 * OWNER: Aakash (glue) with the AI agents layer owner for the remaining tools.
 */

const SYSTEM = [
  "You are RePal's shopping orchestrator. You help a user buy the cheapest option",
  "AFTER their rewards, then settle via PayPal. You never calculate prices,",
  "discounts, budgets, or totals yourself — those come only from deterministic",
  "tools. Your job is to route: call tools in a sensible order, read their",
  "results, explain plainly, and ask the user to approve anything above their",
  "mandate's approval threshold before paying. If a tool reports it is not yet",
  "implemented, tell the user that step isn't available yet rather than guessing.",
].join(" ");

/**
 * The live tool registry. render_intent (A1) and scan_wallet are wired now;
 * the rest are registered as the backbone fills in — each maps to a lib/ unit:
 *   parse_terms   → lib/tnc (A2, Rachna)       find_offers → lib/channel3 (A3)
 *   optimize      → lib/optimizer (A4, Rachna)  explain     → A5 (post-check vs optimizer JSON)
 *   check_policy  → lib/policy (A6, Rachna)      pay/payout  → lib/paypal (A7, Aakash)
 *   issue_receipt → lib/receipts (A8, Rachna)
 * They're added here as their deterministic cores land so the loop lights up
 * incrementally without reworking this glue.
 */
export const orchestrator = new ToolLoopAgent({
  model: claude,
  instructions: SYSTEM,
  stopWhen: stepCountIs(12),
  tools: {
    render_intent: tool({
      description:
        "Turn the shopper's plain-language request into a structured purchase intent (category, optional budget, preferences).",
      inputSchema: z.object({
        rawText: z.string().describe("The shopper's request, verbatim."),
      }),
      execute: async ({ rawText }) => renderIntent(rawText),
    }),
    scan_wallet: tool({
      description:
        "List the user's auto-imported reward wallet (gift cards, cashback, points), each with its free-text terms.",
      inputSchema: z.object({
        userId: z.string().default("demo-user").describe("The user whose wallet to read."),
      }),
      execute: async ({ userId }) => {
        const rewards = await prisma.reward.findMany({
          where: { userId },
          orderBy: { expiresAt: "asc" },
        });
        return { count: rewards.length, rewards };
      },
    }),
  },
});

/**
 * Run the orchestrator against a raw shopper request. Fails fast with an
 * actionable message if Bedrock isn't configured yet.
 */
export async function runAgent(rawText: string) {
  assertBedrockConfigured();
  return orchestrator.generate({ prompt: rawText });
}
