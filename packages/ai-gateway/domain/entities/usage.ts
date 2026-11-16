export type RequestStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "interrupted"
  | "reconciliation"

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens?: number
  reasoningTokens?: number
}

export interface UsageRecord {
  id: string
  requestId: string
  tenantId: string
  applicationId?: string
  apiKeyId?: string
  provider: string
  model: string
  credentialId?: string
  credentialMode: "shared" | "byok"
  status: RequestStatus
  usage: TokenUsage
  providerCostUsd: number
  customerChargeUsd: number
  latencyMs: number
  firstTokenLatencyMs?: number
  errorCode?: string
  errorMessage?: string
  createdAt: Date
}

export interface CreditReservation {
  id: string
  tenantId: string
  requestId: string
  estimatedCredits: number
  reservedAt: Date
  expiresAt: Date
  status: "reserved" | "settled" | "released"
}
