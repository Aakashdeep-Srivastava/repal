import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { z } from "zod";
import { claude, assertBedrockConfigured } from "@/lib/ai/bedrock";
import { prisma } from "@/lib/db";
import { renderIntent } from "@/agents/intent";
import { explainPlan } from "@/agents/explainer";
import { planPurchase } from "@/lib/pipeline";
import { agentPay, agentPayout } from "@/lib/agent/actions";
import {
  fetchRewardEmails,
  isGmailConfigured,
  getConnectedEmail,
  guessType,
} from "@/lib/ingest/google";
import type { Plan } from "@/lib/types";

/**
 * A0 Orchestrator — AI SDK `ToolLoopAgent` on the Bedrock Claude model.
 *
 * Drives the flow at a HIGH level:
 *   render_intent → plan_purchase (deterministic: wallet+offers+optimize+policy)
 *   → explain_plan → [ask approval above threshold] → (pay/payout/receipt: A7/A8)
 *
 * The orchestrator NEVER computes money — `plan_purchase` runs the deterministic
 * `lib/` pipeline server-side and hands back ready numbers + a policy decision.
 * The LLM only routes, reads, explains, and asks. See docs/TECH_PRD.md §3.
 *
 * OWNER: Aakash (glue); deterministic cores in lib/ (Rachna); PayPal tools (A7).
 */

const SYSTEM = [
  "You are RePal's shopping orchestrator. You help a user buy the cheapest option",
  "AFTER their rewards, then settle via PayPal. You NEVER calculate prices,",
  "discounts, budgets, or totals yourself — those come only from the tools.",
  "Flow: call render_intent on the user's request, then plan_purchase with the",
  "category and any budget, then explain the top plan with explain_plan.",
  "If the user asks what rewards they have (or to check their inbox), call",
  "scan_inbox to read reward mail from their connected Gmail and tell them what",
  "you found; if it returns connected:false, say so and use scan_wallet instead.",
  "Each plan carries a policy decision. To settle an 'allow' plan, call pay with",
  "that exact plan — it re-checks the mandate server-side and charges the user's",
  "Vault token. For an 'ask' plan, tell the user it is above their approval",
  "threshold and they must approve it at checkout — do NOT call pay. For 'deny',",
  "explain the reasons (from the plan) and do not pay. Use payout to liberate a",
  "reward to cash (reward → PayPal balance). To set or change spending limits,",
  "call grant_mandate and give the user the link. Never invent a number not",
  "returned by a tool.",
].join(" ");

export const orchestrator = new ToolLoopAgent({
  model: claude,
  temperature: 0,
  instructions: SYSTEM,
  stopWhen: stepCountIs(10),
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

    scan_inbox: tool({
      description:
        "Read the user's CONNECTED Gmail for reward-looking mail (gift cards, cashback, coupons, points). READ-ONLY: returns only each email's subject, a short snippet, and a guessed reward type — never full bodies, never non-reward mail. Use this to tell the user what rewards you found in their inbox, e.g. 'I found a $40 Best Buy gift card in your inbox.' If it returns connected:false, surface the message and fall back to scan_wallet — do not retry.",
      inputSchema: z.object({
        userId: z.string().default("demo-user").describe("The user whose inbox to scan."),
        max: z.number().int().positive().max(50).default(20).describe("Max emails to scan."),
      }),
      execute: async ({ userId, max }) => {
        if (!isGmailConfigured()) {
          return {
            connected: false,
            reason: "gmail_not_configured",
            message:
              "Gmail isn't configured on this deployment — use scan_wallet for the imported wallet instead.",
          };
        }
        const account = await getConnectedEmail(userId);
        if (!account) {
          return {
            connected: false,
            reason: "not_connected",
            connectUrl: "/wallet",
            message:
              "This user hasn't connected Gmail yet. Ask them to connect it on the Wallet page (Connect Gmail), then retry.",
          };
        }
        try {
          const emails = await fetchRewardEmails(userId, max);
          return {
            connected: true,
            account,
            count: emails.length,
            rewards: emails.map((e) => ({
              subject: e.subject,
              snippet: e.snippet,
              guessedType: guessType(`${e.subject} ${e.snippet}`),
            })),
          };
        } catch {
          // Token expired/revoked or Gmail API hiccup — stay graceful, never throw
          // mid-run; the agent should continue with scan_wallet.
          return {
            connected: true,
            account,
            count: 0,
            rewards: [],
            message: "Couldn't read the inbox right now (token may need reconnecting). Use scan_wallet.",
          };
        }
      },
    }),

    plan_purchase: tool({
      description:
        "Run the deterministic plan: load the wallet + mandate, fetch offers, and compute up to 3 ranked plans (cheapest cash AFTER rewards) — each with a policy decision (allow/ask/deny) and the rewards it applied. Also returns why some rewards were rejected.",
      inputSchema: z.object({
        userId: z.string().default("demo-user"),
        category: z.string().describe('What to buy, e.g. "headphones".'),
        maxPriceUsd: z.number().positive().optional().describe("Budget ceiling in USD, if any."),
      }),
      execute: async ({ userId, category, maxPriceUsd }) =>
        planPurchase({ userId, category, maxPriceUsd }),
    }),

    explain_plan: tool({
      description:
        "Explain a chosen plan to the user in one or two plain sentences, using only the numbers already in the plan.",
      inputSchema: z.object({
        plan: z
          .object({
            name: z.string(),
            offer: z.object({
              id: z.string(),
              title: z.string(),
              priceUsd: z.number(),
              retailer: z.string(),
              buyUrl: z.string(),
            }),
            useRewards: z.array(z.object({ rewardId: z.string(), appliedUsd: z.number() })),
            savedUsd: z.number(),
            cashUsd: z.number(),
          })
          .describe("One plan object from plan_purchase."),
      }),
      execute: async ({ plan }) => ({ explanation: await explainPlan(plan as Plan) }),
    }),

    pay: tool({
      description:
        "Settle a plan via PayPal. ONLY call this for a plan whose policy decision is 'allow'. It re-checks the mandate server-side and charges the user's Vault token (no redirect). Returns a signed receipt on success, or refuses ('denied'/'needs_approval'/'no_vault') — surface that to the user, never retry around it.",
      inputSchema: z.object({
        userId: z.string().default("demo-user"),
        category: z.string().describe("The purchase category (from the intent)."),
        plan: z
          .object({
            offer: z.object({
              id: z.string(),
              title: z.string(),
              priceUsd: z.number(),
              retailer: z.string(),
            }),
            cashUsd: z.number(),
            savedUsd: z.number(),
          })
          .describe("The exact 'allow' plan from plan_purchase to settle."),
      }),
      execute: async ({ userId, category, plan }) => agentPay({ userId, category, plan }),
    }),

    payout: tool({
      description:
        "Liberate a reward to cash — send its value to the user's PayPal balance (reward → money). Provide the rewardId (from scan_wallet) and the user's PayPal (receiver) email. The amount is bounded to the reward's value server-side.",
      inputSchema: z.object({
        userId: z.string().default("demo-user"),
        rewardId: z.string().optional().describe("The reward to cash out (from scan_wallet)."),
        receiverEmail: z.string().describe("The user's PayPal email to receive the cash."),
        amountUsd: z.number().positive().describe("Amount to liberate (capped to the reward value)."),
      }),
      execute: async ({ userId, rewardId, receiverEmail, amountUsd }) =>
        agentPayout({ userId, rewardId, receiverEmail, amountUsd }),
    }),

    grant_mandate: tool({
      description:
        "When the user has no spending mandate (or wants to change limits), point them to grant one. You cannot complete the PayPal approval yourself — return the link for the user.",
      inputSchema: z.object({}),
      execute: async () => ({
        url: "/mandate",
        message:
          "Grant a Vault-backed spending mandate at /mandate (set cap, budget, approval threshold). Once active, I can settle 'allow' plans for you.",
      }),
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
