import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcrypt-ts";

import { auth } from "@/app/(auth)/auth";
import {
  getUserById,
  updateUserPassword,
  incrementUserSessionVersion,
} from "@/lib/db/queries";
import { isTauriMode } from "@/lib/env/constants";
import { createCloudClientForRequest } from "@/lib/api/remote-client";
import { createHash } from "node:crypto";

const passwordUpdateSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(20, "New password must be at most 20 characters")
    .refine((val) => /[A-Za-z]/.test(val) && /\d/.test(val), {
      message: "Password must include at least one letter and one number.",
    }),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
});

/**
 * Check if user is a shadow user (cloud user in Tauri mode)
 */
function isShadowUser(userId: string): boolean {
  return userId.startsWith("cloud_");
}

/**
 * Check if user has a password
 */
async function userHasPassword(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return Boolean(user?.password);
}

/**
 * Verify current password (supports both local and shadow users)
 * Note: Shadow user passwords may be stored as bcrypt (migrated from local user) or SHA-256
 */
async function verifyCurrentPassword(
  userId: string,
  currentPassword: string,
): Promise<boolean> {
  const user = await getUserById(userId);

  if (!user || !user.password) {
    return false;
  }

  // Shadow user: Try bcrypt verification first (password may have been migrated from local user)
  if (isShadowUser(userId)) {
    try {
      const isBcryptMatch = await compare(currentPassword, user.password);
      if (isBcryptMatch) {
        return true;
      }
    } catch {
      // bcrypt verification failed, continue trying SHA-256
    }

    // Then try SHA-256 verification
    const hashedPassword = createHash("sha256")
      .update(currentPassword)
      .digest("hex");
    return user.password === hashedPassword;
  }

  // Local users use bcrypt verification
  try {
    return await compare(currentPassword, user.password);
  } catch (error) {
    console.error("[PasswordUpdate] Error comparing passwords:", error);
    return false;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { currentPassword, newPassword, confirmPassword } =
      passwordUpdateSchema.parse(payload);

    // Verify new password and confirm password match
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "password_mismatch" }, { status: 400 });
    }

    const userId = session.user.id;
    const hasPassword = await userHasPassword(userId);

    // Shadow user in Tauri mode: Forward to cloud API
    if (isTauriMode() && isShadowUser(userId)) {
      const cloudClient = createCloudClientForRequest(request);

      if (cloudClient) {
        try {
          const result = await cloudClient.updatePassword({
            currentPassword: currentPassword || "",
            newPassword,
            confirmPassword,
          });

          if (result.success) {
            await incrementUserSessionVersion(userId);
            return NextResponse.json(
              { success: true, requiresRelogin: true },
              { status: 200 },
            );
          }
        } catch (cloudError) {
          console.error("[PasswordUpdate] Cloud API error:", cloudError);
          // Cloud API call failed, try local verification (may be offline)
        }
      }
    }

    // If user already has a password, verify current password
    if (hasPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "current_password_required" },
          { status: 400 },
        );
      }

      const isCurrentPasswordValid = await verifyCurrentPassword(
        userId,
        currentPassword,
      );

      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: "invalid_current_password" },
          { status: 400 },
        );
      }
    }

    // Update password
    await updateUserPassword(userId, newPassword);
    await incrementUserSessionVersion(userId);

    return NextResponse.json(
      { success: true, requiresRelogin: true },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_payload", details: error.flatten() },
        { status: 400 },
      );
    }

    console.error("[PasswordUpdate] Failed to update password", error);
    return NextResponse.json(
      { error: "failed_to_update_password" },
      { status: 500 },
    );
  }
}
