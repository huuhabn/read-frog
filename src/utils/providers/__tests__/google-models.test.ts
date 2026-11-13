import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { buildLocalGenerateTextParams } from "../generate-params"

const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }]

describe("Google Gemini reasoning resolution", () => {
  it("maps reasoning none to minimal for gemini-3.5-flash-lite to avoid compatibility warning", () => {
    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.google,
      model: { model: "gemini-3.5-flash-lite", isCustomModel: false, customModel: null },
      reasoning: "none",
    })
    expect(params.reasoning).toBe("minimal")
    expect(params.providerOptions).toBeUndefined()
  })

  it("maps reasoning none to low for gemini-3.7-flash", () => {
    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.google,
      model: { model: "gemini-3.7-flash", isCustomModel: false, customModel: null },
      reasoning: "none",
    })
    expect(params.reasoning).toBe("low")
    expect(params.providerOptions).toBeUndefined()
  })

  it("keeps reasoning none for gemini-2.5-flash", () => {
    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.google,
      model: { model: "gemini-2.5-flash", isCustomModel: false, customModel: null },
      reasoning: "none",
    })
    expect(params.reasoning).toBe("none")
    expect(params.providerOptions).toBeUndefined()
  })

  it("preserves explicit reasoning level when specified", () => {
    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.google,
      model: { model: "gemini-3.5-flash-lite", isCustomModel: false, customModel: null },
      reasoning: "high",
    })
    expect(params.reasoning).toBe("high")
  })

  it("does not trigger compatibility warning when invoking Google language model with resolved params", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        candidates: [
          {
            content: { parts: [{ text: "Hi there" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
      }),
    )

    const google = createGoogleGenerativeAI({
      apiKey: "test-key",
      fetch: fetchMock,
    })

    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.google,
      model: { model: "gemini-3.5-flash-lite", isCustomModel: false, customModel: null },
      reasoning: "none",
    })

    await google.languageModel("gemini-3.5-flash-lite").doGenerate({ prompt, ...params })

    const compatibilityWarnings = warnSpy.mock.calls
      .map((call) => call.join(" "))
      .filter((msg) => msg.includes('The feature "reasoning" is used in a compatibility mode'))

    expect(compatibilityWarnings).toHaveLength(0)
    warnSpy.mockRestore()
  })
})
