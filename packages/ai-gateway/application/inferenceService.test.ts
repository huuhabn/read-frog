import type { Tenant } from "../domain/entities/tenant.js"
import type { ProviderAdapter, ProviderExecutionOptions } from "../domain/ports/providerAdapter.js"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  InMemoryCredentialRepository,
  InMemoryUsageLedger,
} from "../adapters/db/memory/inMemoryRepos.js"
import { ProviderRegistry } from "../adapters/providers/registry.js"
import { createEnvelopeCipher, encryptSecret } from "../adapters/security/envelopeEncryption.js"
import { UpstreamError } from "../domain/errors.js"
import { FORMATS } from "../engine/formats/types.js"
import { AccountFallbackService } from "./accountFallbackService.js"
import { CredentialResolver } from "./credentialResolver.js"
import { InferenceService } from "./inferenceService.js"
import { QuotaService } from "./quotaService.js"

const PROVIDER = "fallbacktest"
const FALLBACK_PROVIDER = "fallbacktest-secondary"

const tenant: Tenant = {
  id: "tenant-fallback",
  name: "Fallback Co",
  slug: "fallback",
  status: "active",
  credentialMode: "hybrid",
  createdAt: new Date(),
  updatedAt: new Date(),
}

type ExecuteFn = (options: ProviderExecutionOptions) => Promise<ReturnType<typeof okResult>>

function okResult() {
  return {
    isStream: false as const,
    statusCode: 200,
    headers: {},
    data: { choices: [{ message: { content: "ok" } }] },
  }
}

describe("InferenceService", () => {
  let credentialRepo: InMemoryCredentialRepository
  let quotaService: QuotaService
  let service: InferenceService
  let execute: ReturnType<typeof vi.fn<ExecuteFn>>
  let executeFallback: ReturnType<typeof vi.fn<ExecuteFn>>

  async function addCredential(id: string, priority: number, provider = PROVIDER) {
    await credentialRepo.saveCredential({
      id,
      scope: "platform",
      provider,
      label: id,
      encryptedSecret: encryptSecret(`sk-${id}`),
      maskedSecret: "sk-...",
      isEnabled: true,
      priority,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  function run(fallbackModels?: string[]) {
    return service.execute({
      sourceFormat: FORMATS.OPENAI,
      model: `${PROVIDER}/model-a`,
      fallbackModels,
      body: { messages: [{ role: "user", content: "hi" }] },
      tenant,
    })
  }

  beforeEach(() => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "test-encryption-key")
    credentialRepo = new InMemoryCredentialRepository()
    const ledger = new InMemoryUsageLedger()
    quotaService = new QuotaService(ledger)
    execute = vi.fn<ExecuteFn>()
    const adapter: ProviderAdapter = { providerId: PROVIDER, supportsModel: () => true, execute }
    executeFallback = vi.fn<ExecuteFn>()
    const providers = new ProviderRegistry()
    providers.register(adapter)
    providers.register({
      providerId: FALLBACK_PROVIDER,
      supportsModel: () => true,
      execute: executeFallback,
    })
    const credentialHealth = new AccountFallbackService()
    service = new InferenceService(
      new CredentialResolver(credentialRepo, createEnvelopeCipher(), credentialHealth),
      quotaService,
      ledger,
      { providers, credentialHealth },
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("falls back to the next credential on a rate-limit error", async () => {
    await addCredential("cred-rl-primary", 10)
    await addCredential("cred-rl-secondary", 5)
    execute.mockImplementation(async ({ credential }) => {
      if (credential.credentialId === "cred-rl-primary") {
        throw new UpstreamError(PROVIDER, 429, "rate_limit")
      }
      return okResult()
    })

    const result = await run()

    expect(result.isStream).toBe(false)
    expect(execute.mock.calls.map(([options]) => options.credential.credentialId)).toEqual([
      "cred-rl-primary",
      "cred-rl-secondary",
    ])
  })

  it("does not fall back on a non-retryable error and releases reserved credits", async () => {
    await addCredential("cred-bad-request-primary", 10)
    await addCredential("cred-bad-request-secondary", 5)
    execute.mockRejectedValue(new UpstreamError(PROVIDER, 400, "bad request"))
    const release = vi.spyOn(quotaService, "releaseCredits")

    await expect(run()).rejects.toBeInstanceOf(UpstreamError)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("surfaces the upstream error when every credential is exhausted", async () => {
    await addCredential("cred-exhausted-only", 10)
    execute.mockRejectedValue(new UpstreamError(PROVIDER, 503, "overloaded"))
    const release = vi.spyOn(quotaService, "releaseCredits")

    await expect(run()).rejects.toMatchObject({ upstreamStatusCode: 503 })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it("falls back to the next provider once the primary provider is rate-limited", async () => {
    await addCredential("cred-route-primary", 10)
    await addCredential("cred-route-secondary", 10, FALLBACK_PROVIDER)
    execute.mockRejectedValue(new UpstreamError(PROVIDER, 429, "rate_limit"))
    executeFallback.mockResolvedValue(okResult())

    const result = await run([`${FALLBACK_PROVIDER}/model-b`])

    expect(result.isStream).toBe(false)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(executeFallback.mock.calls.map(([options]) => options.model)).toEqual(["model-b"])
  })

  it("does not try fallback providers after a non-retryable error", async () => {
    await addCredential("cred-route-bad-request", 10)
    await addCredential("cred-route-unused", 10, FALLBACK_PROVIDER)
    execute.mockRejectedValue(new UpstreamError(PROVIDER, 400, "bad request"))

    await expect(run([`${FALLBACK_PROVIDER}/model-b`])).rejects.toBeInstanceOf(UpstreamError)

    expect(executeFallback).not.toHaveBeenCalled()
  })
})
