export type CredentialScope = "platform" | "tenant"

export interface ProviderCredential {
  id: string
  scope: CredentialScope
  tenantId?: string // null if platform credential
  provider: string // e.g. "openai", "anthropic", "gemini"
  label: string
  encryptedSecret: string // enc:v1:...
  maskedSecret: string // e.g. "sk-...1234"
  baseUrl?: string
  organizationId?: string
  projectId?: string
  isEnabled: boolean
  priority: number
  weight: number
  lastTestedAt?: Date
  lastTestStatus?: "ok" | "error"
  lastTestError?: string
  createdAt: Date
  updatedAt: Date
}

export interface ResolvedCredential {
  provider: string
  apiKey: string
  baseUrl?: string
  organizationId?: string
  projectId?: string
  scope: CredentialScope
  credentialId: string
}
