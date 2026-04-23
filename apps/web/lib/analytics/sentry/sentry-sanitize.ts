import type * as Sentry from "@sentry/react";

/**
 * Sanitize Sentry events to remove sensitive information
 */
export function sanitizeSentryEvent(
  event: Sentry.ErrorEvent,
  _hint: Sentry.EventHint,
): Sentry.ErrorEvent {
  // Remove user IP address
  if (event.user) {
    event.user.ip_address = undefined;
  }

  // Filter sensitive fields from event and contexts
  const sensitiveFields = [
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "authorization",
    "cookie",
    "x-api-key",
    "api-key",
  ];

  const sensitiveRegex = new RegExp(
    sensitiveFields.map((f) => `(${f})`).join("|"),
    "i",
  );

  // Recursive sanitization helper
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      // Mask potential sensitive string values
      if (sensitiveRegex.test(value)) {
        return "[REDACTED]";
      }
      return value;
    }

    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }

      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (sensitiveRegex.test(k)) {
          sanitized[k] = "[REDACTED]";
        } else if (typeof v === "string") {
          // Check if the value itself looks sensitive
          if (k.toLowerCase().includes("email") && v.includes("@")) {
            // Partial email for debugging
            const [local, domain] = v.split("@");
            sanitized[k] = `${local.slice(0, 2)}***@${domain}`;
          } else if (k.toLowerCase().includes("name") && v.length > 0) {
            // Partial name for debugging
            sanitized[k] = `${v.charAt(0)}***`;
          } else {
            sanitized[k] = v;
          }
        } else {
          sanitized[k] = sanitizeValue(v);
        }
      }
      return sanitized;
    }

    return value;
  };

  // Sanitize extra fields
  if (event.extra) {
    event.extra = sanitizeValue(event.extra) as Record<string, unknown>;
  }

  // Sanitize breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(
      (breadcrumb: Sentry.Breadcrumb) => ({
        ...breadcrumb,
        data: breadcrumb.data
          ? (sanitizeValue(breadcrumb.data) as Record<string, unknown>)
          : undefined,
      }),
    );
  }

  // Sanitize request headers
  if (event.request?.headers) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.request.headers)) {
      if (sensitiveRegex.test(key)) {
        headers[key] = "[REDACTED]";
      } else {
        headers[key] = typeof value === "string" ? value : String(value);
      }
    }
    event.request.headers = headers;
  }

  return event;
}
