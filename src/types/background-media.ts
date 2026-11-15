export interface BackgroundMediaRouting {
  requestId: string
  providerId: string
  fallbackRoutes?: Array<{ providerId: string; modelId: string }>
  maxGatewayAttempts?: number
  modelId: string
}

export interface BackgroundVisionRequest extends BackgroundMediaRouting {
  prompt: string
  imageBase64: string
  mediaType: `image/${string}`
  instructions?: string
}

export interface BackgroundImageRequest extends BackgroundMediaRouting {
  prompt: string
  n?: number
  size?: `${number}x${number}`
  aspectRatio?: `${number}:${number}`
  seed?: number
}

export interface BackgroundEmbeddingRequest extends BackgroundMediaRouting {
  values: string[]
  dimensions?: number
}

export interface BackgroundTranscriptionRequest extends BackgroundMediaRouting {
  audioBase64: string
  mediaType: `audio/${string}`
  timestampGranularities?: Array<"word" | "segment">
}

export interface BackgroundSpeechRequest extends BackgroundMediaRouting {
  text: string
  voice?: string
  outputFormat?: string
  instructions?: string
  speed?: number
  language?: string
}

export interface BackgroundMediaUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface BackgroundVisionResponse {
  text: string
  usage?: BackgroundMediaUsage
  providerId: string
  modelId: string
}

export interface BackgroundImageResponse {
  images: Array<{ base64: string; mediaType: string }>
  providerId: string
  modelId: string
}

export interface BackgroundEmbeddingResponse {
  embeddings: number[][]
  usage?: { tokens?: number }
  providerId: string
  modelId: string
}

export interface BackgroundTranscriptionResponse {
  text: string
  language?: string
  durationInSeconds?: number
  segments?: unknown[]
  words?: unknown[]
  providerId: string
  modelId: string
}

export interface BackgroundSpeechResponse {
  audioBase64: string
  mediaType: string
  providerId: string
  modelId: string
}
