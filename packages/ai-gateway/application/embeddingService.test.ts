import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { InMemoryCredentialRepository } from "../adapters/db/memory/inMemoryRepos.js"
import { createEnvelopeCipher, encryptSecret } from "../adapters/security/envelopeEncryption.js"
import { AccountFallbackService } from "./accountFallbackService.js"
import { CredentialResolver } from "./credentialResolver.js"
import { EmbeddingService } from "./embeddingService.js"

describe("EmbeddingService", () => {
  let credentialRepo: InMemoryCredentialRepository
  let resolver: CredentialResolver
  let service: EmbeddingService

  beforeEach(() => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "test-encryption-key")
    credentialRepo = new InMemoryCredentialRepository()
    resolver = new CredentialResolver(
      credentialRepo,
      createEnvelopeCipher(),
      new AccountFallbackService(),
    )
    service = new EmbeddingService(resolver)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should parse model identifiers to appropriate providers", () => {
    expect(service.parseModel("text-embedding-3-small")).toEqual({
      provider: "openai",
      model: "text-embedding-3-small",
    })
    expect(service.parseModel("text-embedding-004")).toEqual({
      provider: "gemini",
      model: "text-embedding-004",
    })
    expect(service.parseModel("nomic-embed-text")).toEqual({
      provider: "ollama",
      model: "nomic-embed-text",
    })
    expect(service.parseModel("custom-provider/my-model")).toEqual({
      provider: "custom-provider",
      model: "my-model",
    })
  })

  it("should reject empty input with ValidationError", async () => {
    await expect(
      service.execute({
        body: { model: "text-embedding-3-small", input: "" },
      }),
    ).rejects.toThrow("Missing required field: input")
  })

  it("should format and execute OpenAI embeddings", async () => {
    await credentialRepo.saveCredential({
      id: "embed-cred-1",
      scope: "platform",
      provider: "openai",
      label: "OpenAI Platform",
      encryptedSecret: encryptSecret("sk-mock-key"),
      maskedSecret: "sk-...-key",
      isEnabled: true,
      priority: 1,
      weight: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Mock global fetch
    const mockFetch = vi.fn<() => Promise<unknown>>().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: "list",
        data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 5, total_tokens: 5 },
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    const result = await service.execute({
      body: {
        model: "text-embedding-3-small",
        input: "The quick brown fox",
      },
    })

    expect(result.object).toBe("list")
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.embedding).toEqual([0.1, 0.2, 0.3])
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
      }),
    )

    vi.unstubAllGlobals()
  })
})
