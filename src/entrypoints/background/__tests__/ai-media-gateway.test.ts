import type { LLMProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"

const generateTextMock = vi.fn<(...args: any[]) => Promise<any>>()
const generateImageMock = vi.fn<(...args: any[]) => Promise<any>>()
const embedManyMock = vi.fn<(...args: any[]) => Promise<any>>()
const transcribeMock = vi.fn<(...args: any[]) => Promise<any>>()
const generateSpeechMock = vi.fn<(...args: any[]) => Promise<any>>()
const createProviderMock = vi.fn<(...args: any[]) => any>()
const getLanguageModelMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigMock = vi.fn<() => Promise<any>>()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  generateImage: generateImageMock,
  embedMany: embedManyMock,
  transcribe: transcribeMock,
  generateSpeech: generateSpeechMock,
}))

vi.mock("@/utils/providers/model", () => ({
  createAIProviderForConfig: createProviderMock,
  getLanguageModelForConfigAndId: getLanguageModelMock,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/message", () => ({ onMessage: vi.fn<(name: string, handler: unknown) => void>() }))

const providerConfig = {
  id: "openai-main",
  name: "OpenAI",
  provider: "openai",
  enabled: true,
  model: { model: "gpt", isCustomModel: true, customModel: "gpt" },
} as unknown as LLMProviderConfig

let requestSequence = 0
function routing() {
  requestSequence++
  return {
    requestId: `media-${requestSequence}`,
    providerId: providerConfig.id,
    modelId: "operation-model",
  }
}

describe("background AI media gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createProviderMock.mockReturnValue({
      imageModel: vi.fn<(id: string) => object>((id) => ({ kind: "image", id })),
      embeddingModel: vi.fn<(id: string) => object>((id) => ({ kind: "embedding", id })),
      transcription: vi.fn<(id: string) => object>((id) => ({ kind: "transcription", id })),
      speech: vi.fn<(id: string) => object>((id) => ({ kind: "speech", id })),
    })
    getLanguageModelMock.mockReturnValue({ kind: "language" })
    getLocalConfigMock.mockResolvedValue({ providersConfig: [providerConfig] })
  })

  it("sends a size-limited image file part through the language model", async () => {
    generateTextMock.mockResolvedValue({
      text: "a cat",
      usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 },
    })
    const { runVisionRequest } = await import("../ai-media-gateway")
    await expect(
      runVisionRequest({
        ...routing(),
        prompt: "describe",
        imageBase64: "Y2F0",
        mediaType: "image/png",
      }),
    ).resolves.toMatchObject({ text: "a cat", providerId: "openai-main" })
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { kind: "language" },
        maxRetries: 0,
        messages: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: "file", data: "Y2F0", mediaType: "image/png" }),
            ]),
          }),
        ],
      }),
    )
  })

  it("generates bounded image output with an operation-specific model", async () => {
    generateImageMock.mockResolvedValue({
      images: [{ base64: "aW1hZ2U=", mediaType: "image/png" }],
    })
    const { runImageRequest } = await import("../ai-media-gateway")
    await expect(runImageRequest({ ...routing(), prompt: "draw", n: 1 })).resolves.toMatchObject({
      images: [{ base64: "aW1hZ2U=", mediaType: "image/png" }],
    })
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: { kind: "image", id: "operation-model" }, maxRetries: 0 }),
    )
    await expect(runImageRequest({ ...routing(), prompt: "draw", n: 5 })).rejects.toMatchObject({
      code: "invalid_request",
    })
  })

  it("embeds a bounded batch", async () => {
    embedManyMock.mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 2 } })
    const { runEmbeddingRequest } = await import("../ai-media-gateway")
    await expect(runEmbeddingRequest({ ...routing(), values: ["hello"] })).resolves.toMatchObject({
      embeddings: [[0.1, 0.2]],
      usage: { tokens: 2 },
    })
  })

  it("transcribes base64 audio without remote URL fetching", async () => {
    transcribeMock.mockResolvedValue({ text: "hello", segments: [], words: [] })
    const { runTranscriptionRequest } = await import("../ai-media-gateway")
    await expect(
      runTranscriptionRequest({ ...routing(), audioBase64: "YXVkaW8=", mediaType: "audio/mpeg" }),
    ).resolves.toMatchObject({ text: "hello" })
    expect(transcribeMock).toHaveBeenCalledWith(
      expect.objectContaining({ audio: "YXVkaW8=", maxRetries: 0 }),
    )
  })

  it("generates provider speech and serializes the audio", async () => {
    generateSpeechMock.mockResolvedValue({
      audio: { base64: "YXVkaW8=", mediaType: "audio/mpeg" },
    })
    const { runSpeechRequest } = await import("../ai-media-gateway")
    await expect(
      runSpeechRequest({ ...routing(), text: "hello", voice: "alloy" }),
    ).resolves.toMatchObject({ audioBase64: "YXVkaW8=", mediaType: "audio/mpeg" })
  })

  it("rejects providers that do not expose the requested model factory", async () => {
    createProviderMock.mockReturnValue({ languageModel: vi.fn<(id: string) => object>() })
    const { runImageRequest } = await import("../ai-media-gateway")
    await expect(runImageRequest({ ...routing(), prompt: "draw" })).rejects.toMatchObject({
      code: "unsupported",
    })
  })

  it("rejects malformed or oversized binary payloads before provider execution", async () => {
    const { runVisionRequest } = await import("../ai-media-gateway")
    await expect(
      runVisionRequest({
        ...routing(),
        prompt: "describe",
        imageBase64: "not base64",
        mediaType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "invalid_request" })
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it("propagates cancellation to the active SDK request", async () => {
    let observedSignal: AbortSignal | undefined
    generateImageMock.mockImplementation(async (options) => {
      observedSignal = options.abortSignal
      await new Promise((resolve) =>
        observedSignal!.addEventListener("abort", resolve, { once: true }),
      )
      throw new DOMException("cancelled", "AbortError")
    })
    const { cancelMediaRequest, runImageRequest } = await import("../ai-media-gateway")
    const pending = runImageRequest({
      requestId: "cancel-me",
      providerId: providerConfig.id,
      modelId: "image-model",
      prompt: "draw",
    })
    await vi.waitFor(() => expect(observedSignal).toBeDefined())
    cancelMediaRequest("cancel-me")
    await expect(pending).rejects.toMatchObject({ code: "aborted" })
    expect(observedSignal?.aborted).toBe(true)
  })
})
