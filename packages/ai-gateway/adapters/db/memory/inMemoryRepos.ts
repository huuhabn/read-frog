import type { AuditLogEntry } from "../../../domain/entities/auditLog.js"
import type { ProviderCredential, CredentialScope } from "../../../domain/entities/credential.js"
import type { ModelDefinition } from "../../../domain/entities/model.js"
import type { Tenant, Application, ApiKey } from "../../../domain/entities/tenant.js"
import type { UsageRecord, CreditReservation } from "../../../domain/entities/usage.js"
import type {
  AuditLogRepository,
  AuditLogFilter,
} from "../../../domain/ports/auditLogRepository.js"
import type {
  TenantRepository,
  CredentialRepository,
  ModelRepository,
  UsageLedger,
} from "../../../domain/ports/repositories.js"

export class InMemoryTenantRepository implements TenantRepository {
  private tenants = new Map<string, Tenant>()
  private apiKeys = new Map<string, { apiKey: ApiKey; tenant: Tenant; application?: Application }>()

  async getById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    for (const t of this.tenants.values()) {
      if (t.slug === slug) return t
    }
    return null
  }

  async getApiKey(
    keyHash: string,
  ): Promise<{ apiKey: ApiKey; tenant: Tenant; application?: Application } | null> {
    return this.apiKeys.get(keyHash) || null
  }

  async saveTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant)
  }

  async addApiKey(apiKey: ApiKey, tenant: Tenant, application?: Application): Promise<void> {
    this.apiKeys.set(apiKey.keyHash, { apiKey, tenant, application })
  }
}

export class InMemoryCredentialRepository implements CredentialRepository {
  private credentials = new Map<string, ProviderCredential>()

  async getById(id: string): Promise<ProviderCredential | null> {
    return this.credentials.get(id) || null
  }

  async findCredentials(filter: {
    provider: string
    scope: CredentialScope
    tenantId?: string
  }): Promise<ProviderCredential[]> {
    const list: ProviderCredential[] = []
    for (const c of this.credentials.values()) {
      if (c.provider.toLowerCase() !== filter.provider.toLowerCase()) continue
      if (c.scope !== filter.scope) continue
      if (filter.tenantId && c.tenantId !== filter.tenantId) continue
      if (c.isEnabled) list.push(c)
    }
    return list.sort((a, b) => b.priority - a.priority)
  }

  async saveCredential(credential: ProviderCredential): Promise<void> {
    this.credentials.set(credential.id, credential)
  }

  async deleteCredential(id: string): Promise<void> {
    this.credentials.delete(id)
  }
}

export class InMemoryModelRepository implements ModelRepository {
  private models = new Map<string, ModelDefinition>()

  constructor() {
    this.seedDefaults()
  }

  private seedDefaults(): void {
    const defaultModels = [
      // Standard LLMs
      { id: "gpt-4o", provider: "openai", upstreamModelId: "gpt-4o", displayName: "GPT-4o" },
      {
        id: "gpt-4o-mini",
        provider: "openai",
        upstreamModelId: "gpt-4o-mini",
        displayName: "GPT-4o Mini",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        provider: "anthropic",
        upstreamModelId: "claude-3-5-sonnet-20241022",
        displayName: "Claude 3.5 Sonnet",
      },
      {
        id: "gemini-1.5-pro",
        provider: "gemini",
        upstreamModelId: "gemini-1.5-pro",
        displayName: "Gemini 1.5 Pro",
      },
      {
        id: "deepseek-chat",
        provider: "deepseek",
        upstreamModelId: "deepseek-chat",
        displayName: "DeepSeek Chat",
      },
      // OpenAI
      {
        id: "gpt-6.1-sol",
        provider: "openai",
        upstreamModelId: "gpt-6.1-sol",
        displayName: "GPT-6.1 Sol",
      },
      {
        id: "gpt-6-luna",
        provider: "openai",
        upstreamModelId: "gpt-6-luna",
        displayName: "GPT-6 Luna",
      },
      // Anthropic
      {
        id: "claude-opus-5-5",
        provider: "anthropic",
        upstreamModelId: "claude-opus-5-5",
        displayName: "Claude Opus 5.5",
      },
      {
        id: "claude-sonnet-5-5",
        provider: "anthropic",
        upstreamModelId: "claude-sonnet-5-5",
        displayName: "Claude Sonnet 5.5",
      },
      {
        id: "claude-haiku-5-5",
        provider: "anthropic",
        upstreamModelId: "claude-haiku-5-5",
        displayName: "Claude Haiku 5.5",
      },
      // Gemini
      {
        id: "gemini-4-argon",
        provider: "gemini",
        upstreamModelId: "gemini-4-argon",
        displayName: "Gemini 4 Argon",
      },
      {
        id: "gemini-3.8-flash",
        provider: "gemini",
        upstreamModelId: "gemini-3.8-flash",
        displayName: "Gemini 3.8 Flash",
      },
      // DeepSeek
      {
        id: "deepseek-flash",
        provider: "deepseek",
        upstreamModelId: "deepseek-flash",
        displayName: "DeepSeek V4.1 Flash",
      },
      {
        id: "deepseek-v4-pro",
        provider: "deepseek",
        upstreamModelId: "deepseek-v4-pro",
        displayName: "DeepSeek V4 Pro",
      },
    ]
    for (const m of defaultModels) {
      this.models.set(m.id.toLowerCase(), {
        ...m,
        modalities: ["text"],
        capabilities: {
          streaming: true,
          toolCalling: true,
          vision: true,
          jsonOutput: true,
          reasoningEffort: false,
        },
        pricing: {
          version: "v1",
          effectiveFrom: new Date(),
          inputPerMillionTokensUsd: 2.5,
          outputPerMillionTokensUsd: 10.0,
        },
        isEnabled: true,
      })
    }
  }

  async getById(id: string): Promise<ModelDefinition | null> {
    return this.models.get(id.toLowerCase()) || null
  }

  async listModels(filter?: {
    provider?: string
    isEnabled?: boolean
  }): Promise<ModelDefinition[]> {
    const list: ModelDefinition[] = []
    for (const m of this.models.values()) {
      if (filter?.provider && m.provider.toLowerCase() !== filter.provider.toLowerCase()) continue
      if (filter?.isEnabled !== undefined && m.isEnabled !== filter.isEnabled) continue
      list.push(m)
    }
    return list
  }

  async saveModel(model: ModelDefinition): Promise<void> {
    this.models.set(model.id.toLowerCase(), model)
  }
}

export class InMemoryUsageLedger implements UsageLedger {
  private records = new Map<string, UsageRecord>()
  private reservations = new Map<string, CreditReservation>()

  async recordUsage(record: UsageRecord): Promise<void> {
    this.records.set(record.id, record)
  }

  async createReservation(reservation: CreditReservation): Promise<void> {
    this.reservations.set(reservation.requestId, reservation)
  }

  async settleReservation(requestId: string, _actualCostUsd: number): Promise<void> {
    const res = this.reservations.get(requestId)
    if (res) {
      res.status = "settled"
    }
  }

  async releaseReservation(requestId: string): Promise<void> {
    const res = this.reservations.get(requestId)
    if (res) {
      res.status = "released"
    }
  }

  async getTenantUsageSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalRequests: number
    totalTokens: number
    totalCostUsd: number
  }> {
    let totalRequests = 0
    let totalTokens = 0
    let totalCostUsd = 0

    for (const r of this.records.values()) {
      if (r.tenantId === tenantId && r.createdAt >= from && r.createdAt <= to) {
        totalRequests++
        totalTokens += r.usage.totalTokens
        totalCostUsd += r.providerCostUsd
      }
    }

    return { totalRequests, totalTokens, totalCostUsd }
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private logs: AuditLogEntry[] = []

  async record(entry: AuditLogEntry): Promise<void> {
    this.logs.unshift(entry)
  }

  async list(filter?: AuditLogFilter): Promise<{ items: AuditLogEntry[]; total: number }> {
    let filtered = this.logs
    if (filter?.tenantId) filtered = filtered.filter((l) => l.tenantId === filter.tenantId)
    if (filter?.resourceType)
      filtered = filtered.filter((l) => l.resourceType === filter.resourceType)
    if (filter?.action) filtered = filtered.filter((l) => l.action === filter.action)
    if (filter?.actorId) filtered = filtered.filter((l) => l.actorId === filter.actorId)
    if (filter?.status) filtered = filtered.filter((l) => l.status === filter.status)
    if (filter?.from) filtered = filtered.filter((l) => l.createdAt >= filter.from!)
    if (filter?.to) filtered = filtered.filter((l) => l.createdAt <= filter.to!)

    const total = filtered.length
    const offset = filter?.offset || 0
    const limit = filter?.limit || 50
    const items = filtered.slice(offset, offset + limit)

    return { items, total }
  }
}
