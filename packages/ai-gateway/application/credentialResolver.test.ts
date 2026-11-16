import type { Tenant } from "../domain/entities/tenant.js"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { InMemoryCredentialRepository } from "../adapters/db/memory/inMemoryRepos.js"
import { createEnvelopeCipher, encryptSecret } from "../adapters/security/envelopeEncryption.js"
import { AccountFallbackService } from "./accountFallbackService.js"
import { CredentialResolver } from "./credentialResolver.js"

describe("Credential Resolver", () => {
  let credentialRepo: InMemoryCredentialRepository
  let resolver: CredentialResolver

  beforeEach(() => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "test-encryption-key")
    credentialRepo = new InMemoryCredentialRepository()
    resolver = new CredentialResolver(
      credentialRepo,
      createEnvelopeCipher(),
      new AccountFallbackService(),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should resolve tenant BYOK credentials when mode is BYOK", async () => {
    const tenant: Tenant = {
      id: "tenant-1",
      name: "Acme Corp",
      slug: "acme",
      status: "active",
      credentialMode: "byok",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await credentialRepo.saveCredential({
      id: "cred-byok-1",
      scope: "tenant",
      tenantId: "tenant-1",
      provider: "openai",
      label: "Acme OpenAI",
      encryptedSecret: encryptSecret("sk-byok-secret-123"),
      maskedSecret: "sk-b...-123",
      isEnabled: true,
      priority: 10,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const resolved = await resolver.resolve("openai", tenant)
    expect(resolved.apiKey).toBe("sk-byok-secret-123")
    expect(resolved.scope).toBe("tenant")
  })

  it("should resolve platform shared credentials when tenant mode is shared", async () => {
    const tenant: Tenant = {
      id: "tenant-2",
      name: "Beta Corp",
      slug: "beta",
      status: "active",
      credentialMode: "shared",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await credentialRepo.saveCredential({
      id: "cred-platform-1",
      scope: "platform",
      provider: "anthropic",
      label: "Platform Claude",
      encryptedSecret: encryptSecret("sk-ant-platform-key"),
      maskedSecret: "sk-a...-key",
      isEnabled: true,
      priority: 1,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const resolved = await resolver.resolve("anthropic", tenant)
    expect(resolved.apiKey).toBe("sk-ant-platform-key")
    expect(resolved.scope).toBe("platform")
  })
})
