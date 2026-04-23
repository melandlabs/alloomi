/**
 * Centralized cookie names and options for authentication.
 * These constants are used across both client and server code.
 */

/**
 * HttpOnly Bearer token cookie — stores the actual auth token.
 * JS CANNOT read this (XSS-safe). The browser auto-sends it with same-origin requests.
 * The server reads it via `extractToken`.
 */
export const AUTH_TOKEN_COOKIE = "cloud_auth_token";

/**
 * Non-HttpOnly token cookie — stores the Bearer token for client-side access.
 * JS CAN read this via document.cookie. Used by getAuthToken() for the Authorization header.
 * During XSS, this token could be stolen (same as localStorage risk), but provides
 * defense-in-depth: auto-sent via Cookie header when server doesn't require Authorization.
 */
export const AUTH_TOKEN_CLIENT_COOKIE = "cloud_auth_token_client";

/**
 * Non-HttpOnly payload info cookie — stores decoded user info for client-side use.
 * Contains only { id, email, exp, iat } — no secrets. JS-readable for parseToken, expiry checks.
 */
export const AUTH_PAYLOAD_COOKIE = "cloud_auth_payload";

/** Max age: configurable via AUTH_TOKEN_EXPIRY_SECONDS env var, default 90 days in seconds */
export const AUTH_COOKIE_MAX_AGE = Number.parseInt(
  process.env.AUTH_TOKEN_EXPIRY_SECONDS || "7776000",
  10,
);

export const AUTH_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
};

export const AUTH_TOKEN_CLIENT_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
};

export const AUTH_PAYLOAD_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
};

export const CSRF_TOKEN_COOKIE = "csrf_token";
export const CSRF_TOKEN_CLIENT_COOKIE = "csrf_token_client";
