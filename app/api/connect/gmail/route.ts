import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isGmailConfigured, getConnectedEmail, disconnectGmail } from "@/lib/ingest/google";

/** GET — connection status for the UI. */
export async function GET() {
  const configured = isGmailConfigured();
  const session = await getSession();
  const email = configured && session ? await getConnectedEmail(session.userId) : null;
  return NextResponse.json({ configured, connected: Boolean(email), email });
}

/** DELETE — revoke/disconnect the current user's Gmail. */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await disconnectGmail(session.userId);
  return NextResponse.json({ ok: true });
}
