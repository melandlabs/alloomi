import type { WhatsAppUserInfo } from "@/lib/integrations/whatsapp";
import {
  type LoginSession,
  getLoginSession,
  setLoginSession,
  ensureRedis,
} from "@/lib/session/context";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { whatsappClientRegistry } from "@/lib/integrations/whatsapp/client-registry";
import { WhatsAppAdapter, activeAdapters } from "@/lib/integrations/whatsapp";

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
  console.log(
    `[WhatsApp QR Route] Writing to Redis: sessionId=${sessionId}, status=${merged.status}, hasQr=${!!merged.qrData}, qrLen=${merged.qrData?.length ?? 0}`,
  );
  const result = await setLoginSession(sessionId, merged);
  console.log(
    `[WhatsApp QR Route] setLoginSession result: ${result}, sessionId=${sessionId}`,
  );
  return merged;
};

export async function POST(request: Request) {
  // Parse body for optional accountId (used to find existing socket from self-listener)
  let accountId: string | undefined;
  try {
    const body = await request.json();
    accountId = body?.accountId;
  } catch {
    // No body — fine, this is expected for the initial QR request
  }

  const sessionId = uuidv4();

  // If accountId provided, look for an existing socket registered by the self-listener.
  // Reusing the self-listener's socket avoids creating a second independent connection.
  let existingSock: ReturnType<typeof whatsappClientRegistry.get> | undefined;
  if (accountId) {
    existingSock = whatsappClientRegistry.get(accountId);
  }

  const adapter = new WhatsAppAdapter({ botId: sessionId });

  // Store under accountId key so self-listener can find this adapter after restart.
  // This is critical for the restart case: self-listener created the socket first,
  // and now the QR adapter stores itself under the same accountId key.
  if (accountId) {
    activeAdapters.set(accountId, adapter);
  }

  let existingSocket = false;
  if (existingSock) {
    console.log(
      "[WhatsApp QR Route] Found existing socket in registry (accountId), attaching to reuse",
    );
    adapter.attachToSocket(existingSock);
    existingSocket = true;
  }
  const createdAt = Date.now();
  const baseSession: Pick<
    LoginSession,
    "provider" | "phone" | "status" | "createdAt"
  > = {
    provider: "whatsapp",
    phone: "",
    status: "pending",
    createdAt,
  };

  await ensureRedis();
  await setLoginSession(sessionId, {
    ...baseSession,
    qrData: "",
    waSession: sessionId,
  });

  try {
    const qr = await adapter.startQrLogin({
      onQr: async (qrCode: string) => {
        console.log(
          `[WhatsApp QR Route] onQr called for ${sessionId}, qr len: ${qrCode.length}`,
        );
        await updateLoginSession(
          sessionId,
          {
            status: "qr_generated",
            qrUrl: undefined,
            qrData: qrCode,
            error: undefined,
          },
          baseSession,
        );
        console.log(
          `[WhatsApp QR Route] Redis updated for ${sessionId}, status: qr_generated`,
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
            qrData: undefined,
            qrUrl: undefined,
            user: {
              wid: info.wid,
              pushName: info.pushName,
              formattedNumber: info.formattedNumber,
            },
            waSession: sessionId,
          },
          baseSession,
        );

        console.log(
          `[WhatsApp] Login successful for ${sessionId}, user:`,
          info,
        );

        // Explicitly save credentials to file system to ensure persistence
        // (creds.update event may not fire in all scenarios)
        await adapter
          .saveSession()
          .catch((e: unknown) =>
            console.error("[WhatsApp] saveSession failed:", e),
          );

        // Also register the socket under accountId so insights/self-listener can find it.
        // Without this, insights looks up whatsappClientRegistry.get(accountId) and finds nothing,
        // then creates a new adapter with sessionId=accountId, which checks the wrong creds path
        // and always reports sessionExists=false.
        if (accountId) {
          adapter.setRegisterSocketAs(accountId);
        }

        // Skip session existence check for LocalAuth mode (development/Tauri)
        // LocalAuth doesn't save session to Redis, only to local file system
        if (!adapter.isUsingLocalAuth()) {
          // Wait for RemoteAuth to save the session naturally
          // We wait 60 seconds to match the backupSyncIntervalMs
          // This ensures WhatsApp Web has fully established and validated the session
          // In development mode, wait 10 seconds instead of 60 for faster iteration
          const isDev = process.env.NODE_ENV === "development";
          const waitTime = isDev ? 10000 : 60000;
          console.log(
            `[WhatsApp] Waiting ${waitTime / 1000} seconds for RemoteAuth to save session...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          // Verify session was saved by RemoteAuth
          const sessionExists = await adapter.sessionExists();
          console.log(
            `[WhatsApp] Session exists check for ${sessionId}: ${sessionExists}`,
          );

          if (!sessionExists) {
            throw new Error(
              `[WhatsApp] Session was not saved to Redis for ${sessionId}!`,
            );
          }
        } else {
          console.log(
            "[WhatsApp] Using LocalAuth/file-based auth, skipping Redis session check. Socket stays alive for self listener.",
          );
        }

        // Do NOT kill the adapter — the socket is registered in the client registry
        // and must stay alive for the self-message-listener to receive messages.
        // The adapter will be killed when the user logs out.
        console.log(
          "[WhatsApp] Login complete, socket kept alive for self listener",
        );
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
        // Do NOT kill the adapter here — the 515 reconnect handler may still
        // create a new socket that emits a fresh QR. The route's outer catch
        // or the frontend's polling will eventually surface the new QR.
      },
    });

    await updateLoginSession(
      sessionId,
      {
        status: "qr_generated",
        qrData: qr,
        error: undefined,
      },
      baseSession,
    );

    return NextResponse.json(
      {
        sessionId,
        qr,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[WhatsApp QR] Failed to generate QR:", error);
    await adapter.kill().catch(() => {});
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate WhatsApp QR code",
      },
      { status: 500 },
    );
  }
}
