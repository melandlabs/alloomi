/**
 * Global Insight Refresh Initialization Component
 *
 * Automatically starts a periodic refresh timer when the app starts.
 * This ensures insights are refreshed even if the user hasn't visited
 * pages that use useInsightRefresh hook.
 *
 * This component:
 * - Only runs in Tauri environment
 * - Waits for session to be available before starting
 * - Triggers an immediate refresh when starting, then every 30 minutes
 * - Cleans up the timer on component unmount
 */

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getAuthToken } from "@/lib/auth/token-manager";

// Refresh interval: 30 minutes (matches useInsightRefresh default)
const REFRESH_INTERVAL = 30 * 60 * 1000;

// Flag to track if global refresh is enabled
let globalRefreshEnabled = false;

export function isGlobalInsightRefreshEnabled(): boolean {
  return globalRefreshEnabled;
}

/**
 * Core refresh function - fetches insights from API
 */
async function triggerGlobalRefresh(): Promise<void> {
  try {
    const headers: HeadersInit = {};
    try {
      const cloudAuthToken = getAuthToken();
      if (cloudAuthToken) {
        headers.Authorization = `Bearer ${cloudAuthToken}`;
      }
    } catch (error) {
      console.error(
        "[InsightRefreshInit] Failed to read cloud_auth_token:",
        error,
      );
    }

    const response = await fetch("/api/insights/all", {
      method: "GET",
      headers,
      credentials: "include",
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    if (!response.ok) {
      console.warn(
        `[InsightRefreshInit] Refresh failed with status: ${response.status}`,
      );
      return;
    }

    const result = await response.json();

    // Log success
    if (result.successful !== undefined) {
      console.log(
        `[InsightRefreshInit] Global refresh completed at ${new Date().toISOString()}`,
      );
    }
  } catch (error) {
    console.error("[InsightRefreshInit] Global refresh error:", error);
  }
}

export function InsightRefreshInit() {
  const { data: session } = useSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAuthenticatedRef = useRef(false);
  // Track if we've already started the refresh cycle
  const hasStartedRef = useRef(false);

  // Track authentication state and trigger start when auth becomes available
  useEffect(() => {
    isAuthenticatedRef.current = session != null && session?.user?.id != null;

    // If auth just became available and we haven't started yet, trigger start
    if (isAuthenticatedRef.current && !hasStartedRef.current) {
      const isTauri =
        typeof window !== "undefined" &&
        // @ts-ignore - __TAURI__ is injected by Tauri
        window.__TAURI__;

      if (!isTauri) {
        return;
      }

      hasStartedRef.current = true;
      globalRefreshEnabled = true;
      console.log(
        `[InsightRefreshInit] Starting global refresh timer (interval: ${REFRESH_INTERVAL / 1000 / 60} minutes)`,
      );

      // Trigger an immediate refresh right now
      triggerGlobalRefresh();

      // Start the periodic refresh for subsequent calls
      intervalRef.current = setInterval(() => {
        if (isAuthenticatedRef.current) {
          console.log(
            `[InsightRefreshInit] Triggering scheduled refresh at ${new Date().toISOString()}`,
          );
          triggerGlobalRefresh();
        }
      }, REFRESH_INTERVAL);
    }
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log("[InsightRefreshInit] Global refresh timer stopped");
      }
      globalRefreshEnabled = false;
    };
  }, []);

  // This component doesn't render anything
  return null;
}
