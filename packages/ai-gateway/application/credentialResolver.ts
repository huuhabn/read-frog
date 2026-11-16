import type { ResolvedCredential } from "../domain/entities/credential.js"
import type { Tenant } from "../domain/entities/tenant.js"
import type { CredentialRepository } from "../domain/ports/repositories.js"
import type { SecretCipher } from "../domain/ports/secretCipher.js"
import type { AccountFallbackService } from "./accountFallbackService.js"
import { AuthError, ProviderUnavailableError } from "../domain/errors.js"

export interface CredentialResolverOptions {
  /** Last-resort key lookup by variable name, such as `process.env` in Node. */
  readEnvKey?: (name: string) => string | undefined
}

export class CredentialResolver {
  constructor(
    private credentialRepo: CredentialRepository,
    private cipher: SecretCipher,
    private credentialHealth: AccountFallbackService,
    private options: CredentialResolverOptions = {},
  ) {}

  /**
   * Resolves credentials for a given provider and tenant based on the Hybrid Credential policy:
   * 1. BYOK (if tenant mode is 'byok' or 'hybrid')
   * 2. Platform shared credentials
   * 3. Environment variables fallback
   */
  async resolve(
    provider: string,
    tenant?: Tenant | null,
    requestApiKeyOverride?: string,
  ): Promise<ResolvedCredential> {
    const p = provider.toLowerCase()

    // 1. Request-level override (only if explicitly allowed)
    if (requestApiKeyOverride) {
      return {
        provider: p,
        apiKey: requestApiKeyOverride,
        scope: "tenant",
        credentialId: "req_override",
      }
    }

    // 2. Tenant BYOK credentials
    if (tenant && (tenant.credentialMode === "byok" || tenant.credentialMode === "hybrid")) {
      const tenantCreds = await this.credentialRepo.findCredentials({
        provider: p,
        scope: "tenant",
        tenantId: tenant.id,
      })

      const availableTenantCreds = this.credentialHealth.filterAvailable(tenantCreds)
      const topCred = availableTenantCreds[0]
      if (topCred) {
        const plainSecret = this.cipher.decrypt(topCred.encryptedSecret)
        return {
          provider: p,
          apiKey: plainSecret,
          baseUrl: topCred.baseUrl,
          organizationId: topCred.organizationId,
          projectId: topCred.projectId,
          scope: "tenant",
          credentialId: topCred.id,
        }
      }

      if (tenant.credentialMode === "byok") {
        throw new AuthError(
          `Tenant '${tenant.name}' has no available (healthy) BYOK credentials for provider '${p}'`,
        )
      }
    }

    // 3. Platform Shared credentials
    const platformCreds = await this.credentialRepo.findCredentials({
      provider: p,
      scope: "platform",
    })

    const availablePlatformCreds = this.credentialHealth.filterAvailable(platformCreds)
    const topPlatform = availablePlatformCreds[0]
    if (topPlatform) {
      const plainSecret = this.cipher.decrypt(topPlatform.encryptedSecret)
      return {
        provider: p,
        apiKey: plainSecret,
        baseUrl: topPlatform.baseUrl,
        organizationId: topPlatform.organizationId,
        projectId: topPlatform.projectId,
        scope: "platform",
        credentialId: topPlatform.id,
      }
    }

    // 4. Environment variable fallback (for ease of local development)
    const envKeyName = `${p.toUpperCase()}_API_KEY`
    const envKey = this.options.readEnvKey?.(envKeyName)
    if (envKey) {
      return {
        provider: p,
        apiKey: envKey,
        scope: "platform",
        credentialId: `env_${envKeyName}`,
      }
    }

    throw new ProviderUnavailableError(p, `No valid credentials configured for provider '${p}'`)
  }
}
