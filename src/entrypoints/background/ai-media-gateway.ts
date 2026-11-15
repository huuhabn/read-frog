import type {
  BackgroundEmbeddingRequest,
  BackgroundEmbeddingResponse,
  BackgroundImageRequest,
  BackgroundImageResponse,
  BackgroundMediaRouting,
  BackgroundSpeechRequest,
  BackgroundSpeechResponse,
  BackgroundTranscriptionRequest,
  BackgroundTranscriptionResponse,
  BackgroundVisionRequest,
  BackgroundVisionResponse,
} from "@/types/background-media"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { GatewayOperation, GatewayRouteCandidate } from "@/utils/ai-gateway"
import { embedMany, generateImage, generateSpeech, generateText, transcribe } from "ai"
import { isLLMProviderConfig } from "@/types/config/provider"
import {
  executeGatewayAttempts,
  GatewayError,
  GatewayHealthRegistry,
  planGatewayRoutes,
} from "@/utils/ai-gateway"
import { getLocalConfig } from "@/utils/config/storage"
import { onMessage } from "@/utils/message"
import { createAIProviderForConfig, getLanguageModelForConfigAndId } from "@/utils/providers/model"

const MAX_BINARY_BYTES = 8 * 1024 * 1024
const MAX_GENERATED_BINARY_BYTES = 16 * 1024 * 1024
const MAX_EMBEDDING_VALUES = 64
const MAX_EMBEDDING_VALUE_CHARS = 16_000
const MAX_EMBEDDING_OUTPUT_VALUES = 262_144
const MAX_SPEECH_TEXT_CHARS = 10_000
const MAX_PROMPT_CHARS = 20_000
const MAX_IMAGE_COUNT = 4
const activeMediaRequests = new Map<string, AbortController>()
const mediaHealth = new GatewayHealthRegistry()

type FactoryName =
  | "imageModel"
  | "image"
  | "embeddingModel"
  | "embedding"
  | "transcriptionModel"
  | "transcription"
  | "speechModel"
  | "speech"

function assertNonEmpty(value: string, name: string) {
  if (!value.trim()) throw new GatewayError("invalid_request", `${name} is required`)
}

function assertPrompt(value: string) {
  assertNonEmpty(value, "prompt")
  if (value.length > MAX_PROMPT_CHARS) {
    throw new GatewayError("invalid_request", "prompt is too long")
  }
}

function base64ByteLength(value: string): number {
  const normalized = value.replace(/\s/g, "")
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new GatewayError("invalid_request", "Invalid base64 payload")
  }
  return (
    (normalized.length * 3) / 4 - (normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0)
  )
}

function assertBinaryInput(value: string) {
  if (base64ByteLength(value) > MAX_BINARY_BYTES) {
    throw new GatewayError("invalid_request", `Binary input exceeds ${MAX_BINARY_BYTES} bytes`)
  }
}

function candidateFor(
  operation: GatewayOperation,
  config: LLMProviderConfig,
  modelId: string,
  configurationOrder: number,
): GatewayRouteCandidate {
  return {
    routeId: `${config.provider}:${config.id}:${modelId}`,
    providerId: config.id,
    model: modelId,
    operations: [operation],
    enabled: config.enabled,
    pinned: configurationOrder === 0,
    configurationOrder,
  }
}

function resolveOperationModel(config: LLMProviderConfig, modelId: string, names: FactoryName[]) {
  const provider = createAIProviderForConfig(config) as unknown as Record<string, unknown>
  for (const name of names) {
    const factory = provider[name]
    if (typeof factory === "function") return factory.call(provider, modelId)
  }
  throw new GatewayError(
    "unsupported",
    `Provider "${config.provider}" does not support this media operation`,
  )
}

function supportsOperationModel(config: LLMProviderConfig, names: FactoryName[]) {
  const provider = createAIProviderForConfig(config) as unknown as Record<string, unknown>
  return names.some((name) => typeof provider[name] === "function")
}

async function executeMedia<T>(
  operation: GatewayOperation,
  routing: BackgroundMediaRouting,
  factoryNames: FactoryName[] | undefined,
  execute: (
    route: { providerConfig: LLMProviderConfig; modelId: string },
    signal: AbortSignal,
  ) => Promise<T>,
): Promise<T> {
  assertNonEmpty(routing.requestId, "requestId")
  assertNonEmpty(routing.providerId, "providerId")
  assertNonEmpty(routing.modelId, "modelId")
  if (activeMediaRequests.has(routing.requestId)) {
    throw new GatewayError("invalid_request", "Media requestId is already active")
  }
  const config = await getLocalConfig()
  if (!config) throw new GatewayError("invalid_request", "Extension config is unavailable")
  const requestedRoutes = [
    { providerId: routing.providerId, modelId: routing.modelId },
    ...(routing.fallbackRoutes ?? []),
  ]
  const seenRoutes = new Set<string>()
  const routes = requestedRoutes.flatMap((requested) => {
    assertNonEmpty(requested.providerId, "fallback providerId")
    assertNonEmpty(requested.modelId, "fallback modelId")
    const routeKey = `${requested.providerId}:${requested.modelId}`
    if (seenRoutes.has(routeKey)) return []
    seenRoutes.add(routeKey)
    const providerConfig = config.providersConfig.find(
      (candidate) => candidate.id === requested.providerId && candidate.enabled,
    )
    if (!providerConfig || !isLLMProviderConfig(providerConfig)) return []
    if (factoryNames && !supportsOperationModel(providerConfig, factoryNames)) return []
    return [{ providerConfig, modelId: requested.modelId }]
  })
  const candidates = routes.map((route, index) =>
    candidateFor(operation, route.providerConfig, route.modelId, index),
  )
  const planned = planGatewayRoutes(operation, candidates, {
    maxAttempts: Math.min(3, Math.max(1, routing.maxGatewayAttempts ?? 1)),
    health: mediaHealth,
  })
  const byRoute = new Map(candidates.map((candidate, index) => [candidate.routeId, routes[index]!]))
  const controller = new AbortController()
  activeMediaRequests.set(routing.requestId, controller)
  try {
    return await executeGatewayAttempts(
      planned.map((candidate) => ({
        candidate,
        execute: (signal) => execute(byRoute.get(candidate.routeId)!, signal),
      })),
      controller.signal,
      {},
      mediaHealth,
    )
  } finally {
    activeMediaRequests.delete(routing.requestId)
  }
}

export async function runVisionRequest(
  request: BackgroundVisionRequest,
): Promise<BackgroundVisionResponse> {
  assertPrompt(request.prompt)
  if (!request.mediaType.startsWith("image/"))
    throw new GatewayError("invalid_request", "mediaType must be image/*")
  assertBinaryInput(request.imageBase64)
  return executeMedia(
    "vision.generate",
    request,
    undefined,
    async ({ providerConfig: config, modelId }, signal) => {
      const result = await generateText({
        model: getLanguageModelForConfigAndId(config, modelId),
        instructions: request.instructions,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: request.prompt },
              { type: "file", data: request.imageBase64, mediaType: request.mediaType },
            ],
          },
        ],
        abortSignal: signal,
        maxRetries: 0,
      })
      return {
        text: result.text,
        usage: result.usage,
        providerId: config.id,
        modelId,
      }
    },
  )
}

export async function runImageRequest(
  request: BackgroundImageRequest,
): Promise<BackgroundImageResponse> {
  assertPrompt(request.prompt)
  const n = request.n ?? 1
  if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGE_COUNT) {
    throw new GatewayError("invalid_request", `n must be between 1 and ${MAX_IMAGE_COUNT}`)
  }
  if (request.size) {
    const match = /^(\d{1,4})x(\d{1,4})$/.exec(request.size)
    if (!match || Number(match[1]) > 4096 || Number(match[2]) > 4096) {
      throw new GatewayError("invalid_request", "size must be at most 4096x4096")
    }
  }
  if (request.aspectRatio) {
    const match = /^(\d{1,3}):(\d{1,3})$/.exec(request.aspectRatio)
    if (!match || Number(match[1]) === 0 || Number(match[2]) === 0) {
      throw new GatewayError("invalid_request", "aspectRatio is invalid")
    }
  }
  if (request.seed !== undefined && !Number.isSafeInteger(request.seed)) {
    throw new GatewayError("invalid_request", "seed must be a safe integer")
  }
  const factoryNames: FactoryName[] = ["imageModel", "image"]
  return executeMedia(
    "image.generate",
    request,
    factoryNames,
    async ({ providerConfig: config, modelId }, signal) => {
      const model = resolveOperationModel(config, modelId, factoryNames)
      const result = await generateImage({
        model: model as Parameters<typeof generateImage>[0]["model"],
        prompt: request.prompt,
        n,
        size: request.size,
        aspectRatio: request.aspectRatio,
        seed: request.seed,
        abortSignal: signal,
        maxRetries: 0,
      })
      const images = result.images.map((image) => ({
        base64: image.base64,
        mediaType: image.mediaType,
      }))
      const totalBytes = images.reduce((total, image) => total + base64ByteLength(image.base64), 0)
      if (totalBytes > MAX_GENERATED_BINARY_BYTES) {
        throw new GatewayError("provider", "Generated image payload exceeds extension limit")
      }
      return { images, providerId: config.id, modelId }
    },
  )
}

export async function runEmbeddingRequest(
  request: BackgroundEmbeddingRequest,
): Promise<BackgroundEmbeddingResponse> {
  if (request.values.length < 1 || request.values.length > MAX_EMBEDDING_VALUES) {
    throw new GatewayError("invalid_request", `values must contain 1-${MAX_EMBEDDING_VALUES} items`)
  }
  if (request.values.some((value) => !value.trim() || value.length > MAX_EMBEDDING_VALUE_CHARS)) {
    throw new GatewayError("invalid_request", "Embedding value is empty or too long")
  }
  if (
    request.dimensions !== undefined &&
    (!Number.isInteger(request.dimensions) || request.dimensions < 1 || request.dimensions > 8192)
  ) {
    throw new GatewayError("invalid_request", "dimensions must be between 1 and 8192")
  }
  const factoryNames: FactoryName[] = ["embeddingModel", "embedding"]
  return executeMedia(
    "embedding.generate",
    request,
    factoryNames,
    async ({ providerConfig: config, modelId }, signal) => {
      const model = resolveOperationModel(config, modelId, factoryNames)
      const result = await embedMany({
        model: model as Parameters<typeof embedMany>[0]["model"],
        values: request.values,
        dimensions: request.dimensions,
        abortSignal: signal,
        maxRetries: 0,
      })
      const outputValues = result.embeddings.reduce(
        (total, embedding) => total + embedding.length,
        0,
      )
      if (outputValues > MAX_EMBEDDING_OUTPUT_VALUES) {
        throw new GatewayError("provider", "Embedding output exceeds extension limit")
      }
      return {
        embeddings: result.embeddings,
        usage: result.usage,
        providerId: config.id,
        modelId,
      }
    },
  )
}

export async function runTranscriptionRequest(
  request: BackgroundTranscriptionRequest,
): Promise<BackgroundTranscriptionResponse> {
  if (!request.mediaType.startsWith("audio/"))
    throw new GatewayError("invalid_request", "mediaType must be audio/*")
  assertBinaryInput(request.audioBase64)
  const factoryNames: FactoryName[] = ["transcriptionModel", "transcription"]
  return executeMedia(
    "speech.transcribe",
    request,
    factoryNames,
    async ({ providerConfig: config, modelId }, signal) => {
      const model = resolveOperationModel(config, modelId, factoryNames)
      const result = await transcribe({
        model: model as Parameters<typeof transcribe>[0]["model"],
        audio: request.audioBase64,
        timestampGranularities: request.timestampGranularities,
        abortSignal: signal,
        maxRetries: 0,
      })
      return {
        text: result.text,
        language: result.language,
        durationInSeconds: result.durationInSeconds,
        segments: result.segments,
        words: result.words,
        providerId: config.id,
        modelId,
      }
    },
  )
}

export async function runSpeechRequest(
  request: BackgroundSpeechRequest,
): Promise<BackgroundSpeechResponse> {
  assertNonEmpty(request.text, "text")
  if (request.text.length > MAX_SPEECH_TEXT_CHARS)
    throw new GatewayError("invalid_request", "Speech text is too long")
  if (request.speed !== undefined && (request.speed < 0.25 || request.speed > 4)) {
    throw new GatewayError("invalid_request", "Speech speed must be between 0.25 and 4")
  }
  const factoryNames: FactoryName[] = ["speechModel", "speech"]
  return executeMedia(
    "speech.synthesize",
    request,
    factoryNames,
    async ({ providerConfig: config, modelId }, signal) => {
      const model = resolveOperationModel(config, modelId, factoryNames)
      const result = await generateSpeech({
        model: model as Parameters<typeof generateSpeech>[0]["model"],
        text: request.text,
        voice: request.voice,
        outputFormat: request.outputFormat,
        instructions: request.instructions,
        speed: request.speed,
        language: request.language,
        abortSignal: signal,
        maxRetries: 0,
      })
      if (base64ByteLength(result.audio.base64) > MAX_GENERATED_BINARY_BYTES) {
        throw new GatewayError("provider", "Generated speech payload exceeds extension limit")
      }
      return {
        audioBase64: result.audio.base64,
        mediaType: result.audio.mediaType,
        providerId: config.id,
        modelId,
      }
    },
  )
}

export function cancelMediaRequest(requestId: string) {
  activeMediaRequests
    .get(requestId)
    ?.abort(new DOMException("Media request cancelled", "AbortError"))
}

export function setupAIMediaGatewayMessageHandlers() {
  onMessage("backgroundGenerateVision", (message) => runVisionRequest(message.data))
  onMessage("backgroundGenerateImage", (message) => runImageRequest(message.data))
  onMessage("backgroundGenerateEmbeddings", (message) => runEmbeddingRequest(message.data))
  onMessage("backgroundTranscribeAudio", (message) => runTranscriptionRequest(message.data))
  onMessage("backgroundGenerateSpeech", (message) => runSpeechRequest(message.data))
  onMessage("backgroundCancelMedia", async (message) => {
    cancelMediaRequest(message.data.requestId)
    return { ok: true as const }
  })
}
