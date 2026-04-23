import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  WhatsAppAdapter,
  type WhatsAppUserInfo,
} from "@/lib/integrations/whatsapp";
import {
  getLoginSession,
  setLoginSession,
  type LoginSession,
  ensureRedis,
} from "@/lib/session/context";

type SessionUpdater = (
  sessionId: string,
  updates: Partial<LoginSession>,
  defaults: Pick<LoginSession, "provider" | "phone" | "status" | "createdAt">,
) => Promise<LoginSession>;

const updateLoginSession: SessionUpdater = async (
  sessionId,
  updates,
  defaults,
) => {
  const existing = (await getLoginSession(sessionId)) ?? defaults;
  const merged: LoginSession = {
    ...existing,
    ...updates,
  };
  await setLoginSession(sessionId, merged);
  return merged;
};

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    // Validate phone number (E.164 format without + sign)
    if (!phone || !/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid phone number (10-15 digits, country code included)",
        },
        { status: 400 },
      );
    }

    const sessionId = uuidv4();
    const adapter = new WhatsAppAdapter({ botId: sessionId });
    const createdAt = Date.now();
    const baseSession: Pick<
      LoginSession,
      "provider" | "phone" | "status" | "createdAt"
    > = {
      provider: "whatsapp",
      phone,
      status: "pending",
      createdAt,
    };

    await ensureRedis();
    await setLoginSession(sessionId, {
      ...baseSession,
      pairingCode: "",
      waSession: sessionId,
    });

    // Start pairing code login process
    const pairingCode = await adapter.startPairingCodeLogin(phone, {
      onCode: async (code: string) => {
        await updateLoginSession(
          sessionId,
          {
            status: "code_generated",
            pairingCode: code,
            error: undefined,
          },
          baseSession,
        );
      },
      onSession: async () => {
        await updateLoginSession(
          sessionId,
          {
            waSession: sessionId,
          },
          baseSession,
        );
      },
      onReady: async (info: WhatsAppUserInfo) => {
        await updateLoginSession(
          sessionId,
          {
            status: "completed",
            error: undefined,
            user: {
              wid: info.wid,
              pushName: info.pushName,
              formattedNumber: info.formattedNumber,
            },
            waSession: sessionId,
          },
          baseSession,
        );
        await adapter.kill();
      },
      onError: async (error: Error) => {
        await updateLoginSession(
          sessionId,
          {
            status: "error",
            error: error.message,
          },
          baseSession,
        );
        await adapter.kill();
      },
    });

    // Update session with the pairing code
    await updateLoginSession(
      sessionId,
      {
        status: "code_generated",
        pairingCode,
        error: undefined,
      },
      baseSession,
    );

    return NextResponse.json(
      {
        sessionId,
        pairingCode,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[WhatsApp Pairing] Failed to init login:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize WhatsApp pairing code login",
      },
      { status: 500 },
    );
  }
}
