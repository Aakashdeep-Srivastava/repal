import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/me — current session user, or null if not logged in.
 */
export async function GET() {
  return NextResponse.json({ user: await getSession() });
}
