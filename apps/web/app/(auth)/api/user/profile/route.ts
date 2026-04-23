import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { getUserProfile, updateUserProfile } from "@/lib/db/queries";
import { isTauriMode } from "@/lib/env/constants";
import {
  createCloudClientForRequest,
  type CloudApiClient,
} from "@/lib/auth/remote-client";

const profileUpdateSchema = z.object({
  name: z
    .union([z.string().trim().min(2).max(64), z.literal("")])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === "") return null;
      return value;
    }),
  avatarUrl: z
    // Avatar URLs can be long depending on storage provider/pathname.
    // 2048 keeps us within typical URL limits while avoiding false rejections.
    // Allow both absolute URLs (cloud) and relative paths (local-fs).
    .union([z.string().trim().max(2048), z.literal("")])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === "") return null;
      return value;
    }),
});

/**
 * Check if shadow user (cloud user in Tauri mode)
 */
function isShadowUser(userId: string): boolean {
  return userId.startsWith("cloud_");
}

/**
 * Sync user information from cloud to local
 */
async function syncUserFromCloud(
  cloudClient: CloudApiClient | null,
  userId: string,
): Promise<{ name: string | null; avatarUrl: string | null } | null> {
  if (!cloudClient) {
    return null;
  }
  try {
    const cloudUser = await cloudClient.getCurrentUser();
    return {
      name: cloudUser.name || null,
      avatarUrl: cloudUser.avatarUrl || null,
    };
  } catch (error) {
    console.error("[UserProfile] Failed to sync user from cloud:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // First get user profile from local database
    const profile = await getUserProfile(session.user.id);
    if (!profile) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Shadow user in Tauri mode: try to sync user information from cloud
    if (isTauriMode() && isShadowUser(session.user.id)) {
      // Use createCloudClientForRequest to get authentication info from request
      const cloudClient = createCloudClientForRequest(request);
      if (cloudClient) {
        const cloudUserData = await syncUserFromCloud(
          cloudClient,
          session.user.id,
        );

        // If cloud has updates, sync to local
        if (cloudUserData) {
          let needsUpdate = false;
          const updates: { name?: string | null; avatarUrl?: string | null } =
            {};

          if (
            cloudUserData.name !== null &&
            cloudUserData.name !== profile.name
          ) {
            updates.name = cloudUserData.name;
            needsUpdate = true;
          }

          if (
            cloudUserData.avatarUrl !== null &&
            cloudUserData.avatarUrl !== profile.avatarUrl
          ) {
            updates.avatarUrl = cloudUserData.avatarUrl;
            needsUpdate = true;
          }

          // Update local shadow user data
          if (needsUpdate) {
            try {
              await updateUserProfile(session.user.id, updates);
              // Update profile variable to reflect latest data
              profile.name = updates.name ?? profile.name;
              profile.avatarUrl = updates.avatarUrl ?? profile.avatarUrl;
            } catch (updateError) {
              console.error(
                "[UserProfile] Failed to update shadow user profile:",
                updateError,
              );
              // Even if update fails, continue returning current profile
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          hasPassword: profile.hasPassword,
          updatedAt: profile.updatedAt,
          lastLoginAt: profile.lastLoginAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[UserProfile] Failed to fetch profile", error);
    return NextResponse.json(
      { error: "failed_to_load_profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const updates = profileUpdateSchema.parse(payload);

    // Shadow user in Tauri mode: sync to cloud simultaneously
    if (isTauriMode() && isShadowUser(session.user.id)) {
      // Use createCloudClientForRequest to get authentication info from request
      const cloudClient = createCloudClientForRequest(request);
      if (cloudClient) {
        try {
          // Sync updates to cloud
          // Cloud API does not accept null values, need to filter
          const cloudUpdates = {
            name: updates.name ?? undefined,
            avatarUrl: updates.avatarUrl ?? undefined,
          };
          await cloudClient.updateUser(cloudUpdates);
        } catch (cloudError) {
          console.error(
            "[UserProfile] Failed to sync profile to cloud:",
            cloudError,
          );
          // Even if cloud sync fails, continue updating local
        }
      }
    }

    const updated = await updateUserProfile(session.user.id, updates);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
          updatedAt: updated.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_payload", details: error.flatten() },
        { status: 400 },
      );
    }

    console.error("[UserProfile] Failed to update profile", error);
    return NextResponse.json(
      { error: "failed_to_update_profile" },
      { status: 500 },
    );
  }
}
