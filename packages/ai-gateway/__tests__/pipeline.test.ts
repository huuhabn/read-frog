import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  InMemoryCredentialRepository,
  InMemoryUsageLedger,
} from "../adapters/db/memory/inMemoryRepos"
import { ProviderRegistry } from "../adapters/providers/registry"
import { AccountFallbackService } from "../application/accountFallbackService"
import { CredentialResolver } from "../application/credentialResolver"
import { InferenceService } from "../application/inferenceService"
import { QuotaService } from "../application/quotaService"
import { ChatOrchestrator } from "../pipeline/chatOrchestrator"
import { OutputNormalizer, SENTINEL_NO_TRANSLATION } from "../pipeline/outputNormalizer"
import { InMemoryPromptCache } from "../pipeline/promptCache"
import { PromptPipeline } from "../pipeline/promptPipeline"

describe("Prompt Pipeline (L2)", () => {
  it("should compile deterministic system prompt with 5-phase pipeline", () => {
    const pipeline = new PromptPipeline()

    const compiled = pipeline.compile(
      "Please translate this sentence with <b>HTML</b> and $E=mc^2$.",
      {
        styleProfile: {
          systemPrompt: "Translate into {{targetLanguage}} with a {{tone}} tone.",
          targetLanguage: "Vietnamese",
          tone: "formal",
          glossary: {
            sentence: "câu",
            irrelevant: "không liên quan",
          },
        },
      },
    )

    // 1. Resolve & Interpolate
    expect(compiled.system).toContain("Translate into Vietnamese with a formal tone.")
    // 2. Aggregate: Only matched glossary term 'sentence' should be in matchedGlossary, not 'irrelevant'
    expect(compiled.matchedGlossary).toEqual({ sentence: "câu" })
    expect(compiled.system).toContain('- "sentence" -> "câu"')
    expect(compiled.system).not.toContain('"irrelevant"')

    // 3. Conditional Layers: HTML marker and Math formula layers should be active
    expect(compiled.appliedLayers).toContain("HtmlMarkerLayer")
    expect(compiled.appliedLayers).toContain("MathFormulaLayer")
    expect(compiled.system).toContain("HTML & Marker Rule")
    expect(compiled.system).toContain("Math Rule")

    // 4. Messages: user message placed at the end
    expect(compiled.messages).toHaveLength(1)
    expect(compiled.messages[0]).toEqual({
      role: "user",
      content: "Please translate this sentence with <b>HTML</b> and $E=mc^2$.",
    })
  })

  it("prevents template injection when user input contains template placeholders", () => {
    const pipeline = new PromptPipeline()

    const maliciousInput = "Hello {{targetLanguage}} and {{tone}} attack!"
    const compiled = pipeline.compile(maliciousInput, {
      styleProfile: {
        systemPrompt: "Target: {{targetLanguage}}",
        targetLanguage: "Japanese",
      },
    })

    // System prompt got interpolated
    expect(compiled.system).toContain("Target: Japanese")
    // User message MUST remain raw and un-interpolated
    expect(compiled.messages[0]?.content).toBe("Hello {{targetLanguage}} and {{tone}} attack!")
  })
})

describe("Prompt Cache (L3)", () => {
  it("generates consistent deterministic SHA-256 keys", async () => {
    const key1 = await InMemoryPromptCache.generateKey("System prompt A", "User text", "gpt-4o", {
      temperature: 0.7,
      max_tokens: 100,
    })
    const key2 = await InMemoryPromptCache.generateKey(
      "System prompt A",
      "User text",
      "gpt-4o",
      { max_tokens: 100, temperature: 0.7 }, // different key order
    )
    const key3 = await InMemoryPromptCache.generateKey("System prompt B", "User text", "gpt-4o", {
      temperature: 0.7,
      max_tokens: 100,
    })

    expect(key1).toBe(key2)
    expect(key1).not.toBe(key3)
  })

  it("handles LRU eviction and TTL expiry", () => {
    const cache = new InMemoryPromptCache({ maxEntries: 2, defaultTtlMs: 50 })

    cache.set("k1", { text: "res1", createdAt: Date.now() })
    cache.set("k2", { text: "res2", createdAt: Date.now() })

    expect(cache.get("k1")?.text).toBe("res1")

    // Adding 3rd item should evict k2 (because k1 was just accessed via get)
    cache.set("k3", { text: "res3", createdAt: Date.now() })
    expect(cache.get("k1")).not.toBeNull()
    expect(cache.get("k2")).toBeNull()
    expect(cache.get("k3")?.text).toBe("res3")
  })
})

describe("Output Normalizer (L5)", () => {
  it("strips <think> reasoning blocks correctly", () => {
    const raw = `<think>
I need to translate this sentence accurately.
Let's choose the best words.
</think>
Xin chào thế giới!`

    const normalized = OutputNormalizer.normalize(raw)
    expect(normalized.hasThinkTags).toBe(true)
    expect(normalized.thoughtContent).toContain("I need to translate this sentence accurately.")
    expect(normalized.text).toBe("Xin chào thế giới!")
  })

  it("handles sentinels such as NO_TRANSLATION_NEEDED", () => {
    const raw = SENTINEL_NO_TRANSLATION
    const normalized = OutputNormalizer.normalize(raw)
    expect(normalized.isSentinel).toBe(true)
    expect(normalized.text).toBe("")
  })

  it("validates HTML markers and flags missing markers", () => {
    const source = 'Hello <span id="1">world</span>, keep <ph id="code"/> safe.'
    const validOutput = 'Xin chào <span id="1">thế giới</span>, giữ <ph id="code"/> an toàn.'
    const invalidOutput = "Xin chào thế giới, giữ an toàn."

    const validRes = OutputNormalizer.normalize(validOutput, {
      sourceText: source,
      validateHtmlMarkers: true,
    })
    expect(validRes.isValid).toBe(true)
    expect(validRes.missingMarkers).toBeUndefined()

    const invalidRes = OutputNormalizer.normalize(invalidOutput, {
      sourceText: source,
      validateHtmlMarkers: true,
    })
    expect(invalidRes.isValid).toBe(false)
    expect(invalidRes.missingMarkers).toEqual(['<span id="1">', "</span>", '<ph id="code"/>'])
  })

  it("streams without <think> tags using createStreamingTransformer", async () => {
    const transformer = OutputNormalizer.createStreamingTransformer()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("Hello! <think>reasoning "))
        controller.enqueue(encoder.encode("steps here</think>This is the actual answer."))
        controller.close()
      },
    })

    const transformedStream = readable.pipeThrough(transformer)
    const reader = transformedStream.getReader()

    let output = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      output += decoder.decode(value, { stream: true })
    }

    expect(output).toBe("Hello! This is the actual answer.")
  })
})

describe("Chat Orchestrator (10-Step Lifecycle)", () => {
  let mockInferenceService: InferenceService
  let cache: InMemoryPromptCache

  beforeEach(() => {
    const credRepo = new InMemoryCredentialRepository()
    const ledger = new InMemoryUsageLedger()
    const credentialHealth = new AccountFallbackService()
    const credResolver = new CredentialResolver(
      credRepo,
      { encrypt: (value) => value, decrypt: (value) => value },
      credentialHealth,
    )
    const quotaService = new QuotaService(ledger)

    mockInferenceService = new InferenceService(credResolver, quotaService, ledger, {
      providers: new ProviderRegistry(),
      credentialHealth,
    })
    cache = new InMemoryPromptCache()
  })

  it("executes full send lifecycle, normalizes output and caches the result", async () => {
    const executeSpy = vi.spyOn(mockInferenceService, "execute").mockResolvedValue({
      isStream: false,
      statusCode: 200,
      headers: {},
      data: {
        choices: [
          {
            message: {
              content: "<think>Processing request</think>Dịch vụ Cổng kết nối AI",
            },
          },
        ],
      },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })

    const savedMessages: Array<{ role: string; content: string }> = []
    const orchestrator = new ChatOrchestrator({
      inferenceService: mockInferenceService,
      cache,
      onSaveMessage: (msg) => {
        savedMessages.push({ role: msg.role, content: msg.content })
      },
    })

    // 1st Call: Cache MISS
    const res1 = await orchestrator.send("AI Gateway Service", {
      conversationId: "c1",
      target: "openai/gpt-4o",
      styleProfile: {
        targetLanguage: "Vietnamese",
      },
    })

    expect(res1.cached).toBe(false)
    expect(res1.text).toBe("Dịch vụ Cổng kết nối AI")
    expect(res1.usage?.totalTokens).toBe(15)
    expect(executeSpy).toHaveBeenCalledTimes(1)

    // Verify messages saved
    expect(savedMessages).toHaveLength(2)
    expect(savedMessages[0]).toEqual({ role: "user", content: "AI Gateway Service" })
    expect(savedMessages[1]).toEqual({ role: "assistant", content: "Dịch vụ Cổng kết nối AI" })

    // 2nd Call: Cache HIT (same input, target & context)
    const res2 = await orchestrator.send("AI Gateway Service", {
      conversationId: "c1",
      target: "openai/gpt-4o",
      styleProfile: {
        targetLanguage: "Vietnamese",
      },
    })

    expect(res2.cached).toBe(true)
    expect(res2.text).toBe("Dịch vụ Cổng kết nối AI")
    // InferenceService should NOT have been called again!
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it("lets the client consume the stream and still builds the final response", async () => {
    const encoder = new TextEncoder()
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
      "data: [DONE]\n\n",
    ]
    vi.spyOn(mockInferenceService, "execute").mockResolvedValue({
      isStream: true,
      statusCode: 200,
      headers: {},
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of sse) controller.enqueue(encoder.encode(chunk))
          controller.close()
        },
      }),
    })

    const orchestrator = new ChatOrchestrator({ inferenceService: mockInferenceService, cache })
    const res = await orchestrator.send("Hello", { target: "openai/gpt-4o", stream: true })

    const reader = res.stream!.getReader()
    while (!(await reader.read()).done) {
      // drain the client branch
    }

    await expect(res.getFinalResponse!()).resolves.toEqual({ text: "Hello world" })
  })
})
