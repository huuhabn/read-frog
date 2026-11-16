/**
 * Prompt Pipeline & Chat Orchestrator Types
 */

export interface StyleProfile {
  id?: string
  name?: string
  targetLanguage?: string
  tone?: string
  systemPrompt?: string
  glossary?: Record<string, string>
  rules?: string[]
  fewShotExamples?: Array<{ user: string; assistant: string }>
  params?: Record<string, unknown>
}

export interface ConversationContext {
  id: string
  styleProfileId?: string
  styleProfile?: StyleProfile
  styleOverride?: string
  target?: string
  params?: Record<string, unknown>
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface ConditionalLayerContext {
  input: string
  targetLanguage?: string
  isBatch?: boolean
  hasHtmlMarkers?: boolean
  hasMathFormulas?: boolean
  structuredSchema?: Record<string, unknown>
}

export interface CompiledPrompt {
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  matchedGlossary: Record<string, string>
  appliedLayers: string[]
}

export interface CachedResponse {
  text: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  attempt?: {
    provider: string
    model: string
    credentialId?: string
  }
  createdAt: number
}

export interface PromptCachePort {
  get(key: string): Promise<CachedResponse | null> | CachedResponse | null
  set(key: string, value: CachedResponse, ttlMs?: number): Promise<void> | void
  delete(key: string): Promise<void> | void
  clear(): Promise<void> | void
}

export interface SendOptions {
  conversationId?: string
  target?: string
  params?: Record<string, unknown>
  styleProfile?: StyleProfile
  styleOverride?: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
  glossary?: Record<string, string>
  bypassCache?: boolean
  ttlMs?: number
  stream?: boolean
  signal?: AbortSignal
  tenantId?: string
  metadata?: Record<string, unknown>
}

export interface SendResult {
  text: string
  cached: boolean
  attempt?: {
    provider: string
    model: string
    credentialId?: string
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  stream?: ReadableStream<Uint8Array>
  getFinalResponse?: () => Promise<{
    text: string
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  }>
}

export interface OutputNormalizationOptions {
  stripThinkTags?: boolean
  handleSentinels?: boolean
  expectedMarkers?: string[]
  validateHtmlMarkers?: boolean
}
