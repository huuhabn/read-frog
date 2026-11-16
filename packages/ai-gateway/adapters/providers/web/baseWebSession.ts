import { BaseProviderAdapter } from "../base.js"

export const DEFAULT_WEB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"

export abstract class BaseWebSessionAdapter extends BaseProviderAdapter {
  abstract readonly isWebSession: true

  /**
   * Helper to format cookies from a raw cookie string or storageState JSON.
   */
  protected formatCookieHeader(rawCredentials: string): string {
    if (!rawCredentials) return ""
    const trimmed = rawCredentials.trim()

    // Check if JSON storage state (e.g. from browser export)
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed.cookies)) {
          return parsed.cookies
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join("; ")
        }
      } catch {
        // Fall back to treating as raw string
      }
    }

    return trimmed
  }
}
