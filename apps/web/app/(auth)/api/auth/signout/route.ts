import { NextResponse } from "next/server";
import {
  isTauriProductionEnv,
  createTauriProductionAuthModule,
} from "@/app/(auth)/tauri";
import { nextAuthSessionCookies } from "@/lib/env/constants";

export async function POST(request: Request) {
  // Only clear session in file in Tauri environment
  // Do not limit NODE_ENV, both development and production environments supported
  if (isTauriProductionEnv()) {
    try {
      const authModule = createTauriProductionAuthModule();
      await authModule.signOut();
      return NextResponse.json({ ok: true, message: "Session cleared" });
    } catch (error) {
      console.error("[SignOut] Failed to clear session:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to clear session" },
        { status: 500 },
      );
    }
  }

  // Non-Tauri environment: clear all session cookies
  const response = NextResponse.json({ ok: true, message: "Session cleared" });
  for (const cookieName of nextAuthSessionCookies) {
    response.cookies.set({
      name: cookieName,
      value: "",
      maxAge: 0,
      expires: new Date(0),
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}
