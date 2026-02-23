/**
 * Validates that a URL uses only http: or https: protocols.
 *
 * Rejects javascript:, data:, ftp:, and any other protocol to prevent
 * XSS via href injection attacks. HTML maxlength alone is insufficient
 * because it can be bypassed via the DOM — this server-side check is
 * the authoritative validation gate.
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
