/**
 * Fallback redaction: hides URL query parameters to prevent sensitive info from leaking in logs.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.search) return parsed.toString();
    return `${parsed.origin}${parsed.pathname}?<redacted>`;
  } catch {
    const idx = url.indexOf("?");
    return idx >= 0 ? `${url.slice(0, idx)}?<redacted>` : url;
  }
}
