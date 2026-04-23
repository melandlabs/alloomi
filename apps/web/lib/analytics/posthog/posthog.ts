"use client";

import posthogJs from "posthog-js";
import { isTauri } from "@/lib/tauri";

const DEFAULT_POSTHOG_KEY = "phc_298safHT4L3Fi6pngLfGaZpIIKmPkfkcXh6XOwuSneU";
const DEFAULT_POSTHOG_HOST = "https://app.posthog.com";

const configuredKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const configuredHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

const apiKey = configuredKey || DEFAULT_POSTHOG_KEY;
const apiHost = configuredHost || DEFAULT_POSTHOG_HOST;

let initialized = false;

/**
 * Initializes the PostHog client on the browser.
 * Safe-guards against running on the server or without a configured API key.
 */
export function initPosthog() {
  // Completely disable PostHog in Tauri environment
  if (isTauri()) {
    return;
  }
  // Completely disable PostHog in development environment
  if (process.env.NODE_ENV === "development") {
    return;
  }

  if (initialized) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  posthogJs.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",

    // Disable autocapture - we'll use manual tracking
    autocapture: false,

    // Disable web vitals autocapture to prevent console errors
    // This must be explicitly disabled as it's enabled by default in newer versions
    capture_performance: false,

    // Persistence
    persistence: "cookie",
    cookie_expiration: 30,

    // Disable session recording to reduce event volume
    disable_session_recording: true,

    // Enable request batching for better performance
    request_batching: true,
  });

  initialized = true;
}

export function isPosthogEnabled() {
  // Don't send PostHog events in local environment (Tauri environment)
  if (isTauri()) {
    return false;
  }
  // Disable PostHog in development environment
  if (process.env.NODE_ENV === "development") {
    return false;
  }
  return Boolean(apiKey);
}

/**
 * Event tracking with rate limiting to prevent console errors
 * Uses a simple cooldown to avoid triggering PostHog's rate limiter
 */
const eventCooldown = new Map<string, number>();
const COOLDOWN_MS = 1000; // 1 second cooldown per event type

export function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>,
  options?: { skipCooldown?: boolean },
) {
  if (!initialized) {
    return;
  }

  // Skip cooldown for critical events like page_leave and heartbeat
  const skipCooldown =
    options?.skipCooldown ||
    event === "page_leave" ||
    event === "page_time_heartbeat";

  if (!skipCooldown) {
    // Check if this event type is on cooldown
    const now = Date.now();
    const lastCaptureTime = eventCooldown.get(event);

    if (lastCaptureTime && now - lastCaptureTime < COOLDOWN_MS) {
      // Event is on cooldown, skip this capture
      return;
    }

    // Update last capture time for this event type
    eventCooldown.set(event, now);
  }

  // Capture the event
  posthogJs.capture(event, properties);

  // Clean up old entries from the map periodically
  if (!skipCooldown && eventCooldown.size > 100) {
    const now = Date.now();
    const cutoff = now - 60000; // Remove entries older than 1 minute
    for (const [key, time] of eventCooldown.entries()) {
      if (time < cutoff) {
        eventCooldown.delete(key);
      }
    }
  }
}

export function capturePosthogPageview(url?: string) {
  if (!initialized) {
    return;
  }

  posthogJs.capture("$pageview", {
    $current_url: url ?? window.location.href,
  });
}

export function getPosthogClient() {
  return posthogJs;
}
