import type { ProviderCredential, CredentialScope } from "../entities/credential.js"
import type { ModelDefinition } from "../entities/model.js"
import type { Tenant, Application, ApiKey } from "../entities/tenant.js"
import type { UsageRecord, CreditReservation } from "../entities/usage.js"

export interface TenantRepository {
  getById(id: string): Promise<Tenant | null>
  getBySlug(slug: string): Promise<Tenant | null>
  getApiKey(
    keyHash: string,
  ): Promise<{ apiKey: ApiKey; tenant: Tenant; application?: Application } | null>
  saveTenant(tenant: Tenant): Promise<void>
}

export interface CredentialRepository {
  getById(id: string): Promise<ProviderCredential | null>
  findCredentials(filter: {
    provider: string
    scope: CredentialScope
    tenantId?: string
  }): Promise<ProviderCredential[]>
  saveCredential(credential: ProviderCredential): Promise<void>
  deleteCredential(id: string): Promise<void>
}

export interface ModelRepository {
  getById(id: string): Promise<ModelDefinition | null>
  listModels(filter?: { provider?: string; isEnabled?: boolean }): Promise<ModelDefinition[]>
  saveModel(model: ModelDefinition): Promise<void>
}

export interface UsageLedger {
  recordUsage(record: UsageRecord): Promise<void>
  createReservation(reservation: CreditReservation): Promise<void>
  settleReservation(requestId: string, actualCostUsd: number): Promise<void>
  releaseReservation(requestId: string): Promise<void>
  getTenantUsageSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalRequests: number
    totalTokens: number
    totalCostUsd: number
  }>
}
