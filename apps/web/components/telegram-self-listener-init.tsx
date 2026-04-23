/**
 * Telegram User Listener Auto-Init Component
 *
 * Automatically starts the Telegram user listener (Saved Messages monitoring)
 * when the app starts in Tauri/desktop environment.
 *
 * This component:
 * - Only runs in Tauri environment (skips in web)
 * - Delays 3 seconds to ensure app is fully loaded
 * - Fetches current user session and triggers listener initialization
 * - Cleans up listeners only when the app/window is closing (not when switching apps)
 */

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAuthToken } from "@/lib/auth/token-manager";

// Flag to prevent duplicate cleanup
let cleanupInProgress = false;

export function TelegramSelfListenerInit() {
  const { data: session } = useSession();
  const userIdRef = useRef<string | undefined>(session?.user?.id);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    userIdRef.current = session?.user?.id;
  }, [session?.user?.id]);

  // Cleanup listeners function - only called when window is actually closing
  const cleanupListeners = async () => {
    if (cleanupInProgress) {
      return;
    }

    const userId = userIdRef.current;
    if (!userId) {
      return;
    }

    cleanupInProgress = true;

    // Use navigator.sendBeacon or fetch with keepalive to ensure request is sent
    try {
      const data = JSON.stringify({ userId });
      if (navigator.sendBeacon) {
        // Prefer sendBeacon as it is more reliable
        const blob = new Blob([data], { type: "application/json" });
        const sent = navigator.sendBeacon("/api/listeners/cleanup", blob);
        if (sent) {
          console.log(
            "[TelegramSelfListenerInit] Cleanup request sent via sendBeacon",
          );
        }
      } else {
        // Fallback to fetch with keepalive
        await fetch("/api/listeners/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: data,
          keepalive: true,
        });
        console.log(
          "[TelegramSelfListenerInit] Cleanup request sent via fetch",
        );
      }
    } catch (error) {
      console.error(
        "[TelegramSelfListenerInit] Failed to cleanup listeners:",
        error,
      );
    }
  };

  useEffect(() => {
    // Only run in Tauri environment
    if (typeof window === "undefined") {
      return;
    }

    // Check if we're in Tauri environment
    const isTauri =
      typeof window !== "undefined" &&
      // @ts-ignore - __TAURI__ is injected by Tauri
      window.__TAURI__;

    if (!isTauri) {
      return;
    }

    // Delay execution to ensure app is fully loaded
    initTimeoutRef.current = setTimeout(async () => {
      // Guard against running after component unmounts
      if (!isMountedRef.current) {
        return;
      }
      const userId = session?.user?.id;
      const isAuthenticated = session !== null && !!userId;
      if (!isAuthenticated) {
        return;
      }

      try {
        // Get cloud auth token from localStorage for API configuration
        const cloudAuthToken = getAuthToken() || undefined;

        const response = await fetch(
          `/api/telegram/user-listener/init?userId=${encodeURIComponent(userId)}${cloudAuthToken ? `&authToken=${encodeURIComponent(cloudAuthToken)}` : ""}`,
        );
        if (!response.ok) {
          return;
        }
        const text = await response.text();
        try {
          const result = JSON.parse(text);
          // Optionally print on success, silently fail
        } catch {
          // Response is not valid JSON, silently skip
        }
      } catch {
        // All errors silently handled
      }
    }, 3000); // 3 second delay

    // Only cleanup listeners when window is truly closing
    // Do not listen to visibilitychange: desktop app switching to background should not stop the listener
    // const handleBeforeUnload = () => {
    //   cleanupListeners();
    // };

    // window.addEventListener("beforeunload", handleBeforeUnload);
    // // @ts-ignore - Tauri window close event
    // window.addEventListener("tauri://close-requested", handleBeforeUnload);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      // Mark as unmounted to prevent pending timeout callbacks from running
      isMountedRef.current = false;
      // window.removeEventListener("beforeunload", handleBeforeUnload);
      // // @ts-ignore
      // window.removeEventListener("tauri://close-requested", handleBeforeUnload);
    };
  }, [session?.user?.id]);

  // This component doesn't render anything
  return null;
}
