/**
 * Clear Auth Cookie API
 * Clears all auth cookies. Called by the logout handler in app-sidebar.
 */

import { type NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookie-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
