import type { ProviderCredential } from "../domain/entities/credential.js"
import { describe, it, expect, beforeEach } from "vitest"
import { AccountFallbackService } from "./accountFallbackService.js"

describe("AccountFallbackService & Cooldown Pool", () => {
  let service: AccountFallbackService

  beforeEach(() => {
    service = new AccountFallbackService()
  })

  it("should detect fallback-worthy errors (429, 503, 401)", () => {
    expect(service.checkFallbackError(429).shouldFallback).toBe(true)
    expect(service.checkFallbackError(503).shouldFallback).toBe(true)
    expect(service.checkFallbackError(401).shouldFallback).toBe(true)
    expect(service.checkFallbackError(200).shouldFallback).toBe(false)
    expect(service.checkFallbackError(400, "invalid_model").shouldFallback).toBe(false)
    expect(service.checkFallbackError(400, "rate_limit_exceeded").shouldFallback).toBe(true)
  })

  it("should put credential on cooldown and filter out unavailable credentials", () => {
    const credA: ProviderCredential = {
      id: "cred-A",
      scope: "platform",
      provider: "openai",
      label: "Key A",
      encryptedSecret: "enc:...",
      maskedSecret: "sk-...A",
      isEnabled: true,
      priority: 10,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const credB: ProviderCredential = {
      id: "cred-B",
      scope: "platform",
      provider: "openai",
      label: "Key B",
      encryptedSecret: "enc:...",
      maskedSecret: "sk-...B",
      isEnabled: true,
      priority: 5,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(service.isAvailable("cred-A")).toBe(true)

    // Put cred-A on cooldown
    service.markCooldown("cred-A", 10000)
    expect(service.isAvailable("cred-A")).toBe(false)

    // Filter available credentials
    const available = service.filterAvailable([credA, credB])
    expect(available).toHaveLength(1)
    expect(available[0]?.id).toBe("cred-B")

    // After success on cred-A, it becomes available again
    service.recordSuccess("cred-A")
    expect(service.isAvailable("cred-A")).toBe(true)
  })
})
