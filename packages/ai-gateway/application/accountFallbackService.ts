import type { ProviderCredential } from "../domain/entities/credential.js"

export interface FallbackRuleResult {
  shouldFallback: boolean
  cooldownMs: number
}

export class AccountFallbackService {
  // credentialId -> timestamp until which it is on cooldown
  private cooldowns = new Map<string, number>()
  // credentialId -> current backoff level (for exponential backoff)
  private backoffLevels = new Map<string, number>()

  private readonly BASE_COOLDOWN_MS = 2000 // 2 seconds base
  private readonly MAX_COOLDOWN_MS = 240000 // 4 minutes max
  private readonly MAX_BACKOFF_LEVEL = 7

  /**
   * Determine whether an upstream error should put the credential on cooldown
   * and trigger an automatic fallback to the next available credential.
   */
  public checkFallbackError(statusCode: number, errorText = ""): FallbackRuleResult {
    const lower = errorText.toLowerCase()

    // 1. Rate Limit (429) or Quota Reached
    if (
      statusCode === 429 ||
      lower.includes("rate_limit") ||
      lower.includes("quota_exceeded") ||
      lower.includes("insufficient_quota") ||
      lower.includes("resource_exhausted")
    ) {
      return { shouldFallback: true, cooldownMs: 5000 }
    }

    // 2. Authentication failure (401 / 403) - Key revoked or expired
    if (
      statusCode === 401 ||
      (statusCode === 403 &&
        (lower.includes("invalid_api_key") ||
          lower.includes("revoked") ||
          lower.includes("unauthorized")))
    ) {
      // Long cooldown for dead keys (1 hour)
      return { shouldFallback: true, cooldownMs: 3600000 }
    }

    // 3. Provider Overloaded / Service Unavailable (503 / 529)
    if (statusCode === 503 || statusCode === 529 || lower.includes("overloaded")) {
      return { shouldFallback: true, cooldownMs: 3000 }
    }

    return { shouldFallback: false, cooldownMs: 0 }
  }

  /**
   * Mark a credential as on cooldown with exponential backoff.
   */
  public markCooldown(credentialId: string, customCooldownMs?: number): void {
    const currentLevel = this.backoffLevels.get(credentialId) || 0
    const nextLevel = Math.min(currentLevel + 1, this.MAX_BACKOFF_LEVEL)
    this.backoffLevels.set(credentialId, nextLevel)

    const exponentialCooldown = this.BASE_COOLDOWN_MS * Math.pow(2, nextLevel - 1)
    const cooldownMs = customCooldownMs
      ? Math.max(customCooldownMs, exponentialCooldown)
      : Math.min(exponentialCooldown, this.MAX_COOLDOWN_MS)

    const cooldownUntil = Date.now() + cooldownMs
    this.cooldowns.set(credentialId, cooldownUntil)
  }

  /**
   * Reset cooldown and backoff level upon successful request.
   */
  public recordSuccess(credentialId: string): void {
    this.cooldowns.delete(credentialId)
    this.backoffLevels.delete(credentialId)
  }

  /**
   * Check if a credential is currently available (not on cooldown).
   */
  public isAvailable(credentialId: string): boolean {
    const until = this.cooldowns.get(credentialId)
    if (!until) return true
    if (Date.now() >= until) {
      this.cooldowns.delete(credentialId)
      return true
    }
    return false
  }

  /**
   * Filter and sort active credentials, placing ready credentials first.
   */
  public filterAvailable(credentials: ProviderCredential[]): ProviderCredential[] {
    return credentials.filter((c) => this.isAvailable(c.id))
  }
}
