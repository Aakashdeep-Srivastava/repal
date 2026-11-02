/**
 * A0 Orchestrator — AI SDK 6 ToolLoopAgent, temperature 0.
 *
 * Parses intent and drives the tool chain:
 *   render_intent → scan_wallet → parse_terms → find_offers → optimize →
 *   explain → check_policy → [request_approval] → pay → payout → issue_receipt
 *
 * Every tool call is persisted to tool_traces and streamed to the UI via SSE.
 * The orchestrator NEVER computes money — it only routes to deterministic
 * lib/ functions and reads/plans/explains/asks. See docs/TECH_PRD.md §3.
 *
 * OWNER: Aakash (glue) with AI agents layer owner for the tools.
 */
export {};
// TODO: wire ToolLoopAgent + tool registry + SSE streaming.
