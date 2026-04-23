import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";
import {
  FEISHU_REGISTRATION_COOKIE,
  verifyRegistrationCookie,
} from "@/lib/integrations/feishu/registration-cookie";

/**
 * Cancel QR scan when user closes dialog: clear registration Cookie
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(FEISHU_REGISTRATION_COOKIE)?.value;
  if (raw) {
    const payload = verifyRegistrationCookie(raw, secret);
    if (payload && payload.userId === session.user.id) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set({
        name: FEISHU_REGISTRATION_COOKIE,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }
  }

  return NextResponse.json({ ok: true });
}
