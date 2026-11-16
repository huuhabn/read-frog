export type CredentialMode = "shared" | "byok" | "hybrid"
export type TenantStatus = "active" | "suspended" | "pending"

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  credentialMode: CredentialMode
  allowedProviders?: string[]
  allowedModels?: string[]
  defaultProvider?: string
  defaultModel?: string
  maxMonthlySpendUsd?: number
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface Application {
  id: string
  tenantId: string
  name: string
  slug: string
  status: "active" | "disabled"
  description?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface ApiKey {
  id: string
  tenantId: string
  applicationId?: string
  name: string
  keyHash: string
  keyPrefix: string // e.g. "gw_live_abcd"
  scopes: string[] // e.g. ["inference:read", "inference:write", "admin:all"]
  expiresAt?: Date
  lastUsedAt?: Date
  createdAt: Date
}
