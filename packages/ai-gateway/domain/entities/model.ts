export type Modality = "text" | "image" | "audio" | "video" | "embedding"

export interface ModelPricing {
  version: string
  effectiveFrom: Date
  inputPerMillionTokensUsd: number
  outputPerMillionTokensUsd: number
  cachedInputPerMillionTokensUsd?: number
  perImageUsd?: number
}

export interface ModelCapabilities {
  streaming: boolean
  toolCalling: boolean
  vision: boolean
  jsonOutput: boolean
  reasoningEffort: boolean
  maxContextTokens?: number
  maxOutputTokens?: number
}

export interface ModelDefinition {
  id: string // e.g. "openai/gpt-4o" or alias "gpt-4o"
  provider: string // "openai"
  upstreamModelId: string // "gpt-4o-2024-08-06"
  displayName: string
  modalities: Modality[]
  capabilities: ModelCapabilities
  pricing: ModelPricing
  isEnabled: boolean
}
