/**
 * Set Auth Token API
 * Accepts a token in URL param, verifies it, sets cookies, redirects home.
 * Used by OAuth callbacks that cannot set cookies directly (redirect flow).
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/remote-auth-utils";
import { setAuthCookies } from "@/lib/auth/cookie-auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  const result = verifyToken(token);
  if (!result) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url),
    );
  }

  // Decode payload to get exp and iat for the cookie
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: result.id,
    email: result.email,
    exp: result.exp,
    iat: now,
  };

  const response = NextResponse.redirect(new URL("/", request.url));
  setAuthCookies(response, token, payload);
  return response;
}
