import { Entity } from "dexie"

export interface AuditLogMessage {
  role: string
  content: unknown
}

export interface AuditLogTokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AuditLogItem {
  id: string
  createdAt: Date
  sourceFeature: string
  url?: string
  providerId: string
  providerName?: string
  providerType: "llm" | "translation" | "other"
  model?: string
  systemPrompt?: string
  prompt: string
  messages?: AuditLogMessage[]
  parameters?: Record<string, unknown>
  responseOutput?: string
  thinking?: string
  latencyMs: number
  status: "success" | "error" | "aborted"
  errorMessage?: string
  tokenUsage?: AuditLogTokenUsage
  rawPayload?: Record<string, unknown>
}

export default class AuditLog extends Entity implements AuditLogItem {
  id!: string

  createdAt!: Date

  sourceFeature!: string

  url?: string

  providerId!: string

  providerName?: string

  providerType!: "llm" | "translation" | "other"

  model?: string

  systemPrompt?: string

  prompt!: string

  messages?: AuditLogMessage[]

  parameters?: Record<string, unknown>

  responseOutput?: string

  thinking?: string

  latencyMs!: number

  status!: "success" | "error" | "aborted"

  errorMessage?: string

  tokenUsage?: AuditLogTokenUsage

  rawPayload?: Record<string, unknown>
}
