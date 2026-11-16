import type { AuditLogEntry } from "../../../domain/entities/auditLog.js"
import type { ProviderCredential, CredentialScope } from "../../../domain/entities/credential.js"
import type { ModelDefinition } from "../../../domain/entities/model.js"
import type { Tenant, Application, ApiKey } from "../../../domain/entities/tenant.js"
import type { UsageRecord, CreditReservation } from "../../../domain/entities/usage.js"
import type {
  AuditLogFilter,
  AuditLogRepository,
} from "../../../domain/ports/auditLogRepository.js"
import type {
  CredentialRepository,
  ModelRepository,
  TenantRepository,
  UsageLedger,
} from "../../../domain/ports/repositories.js"
import type { GatewaySqliteDatabase } from "./client.js"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import {
  apiKeysTable,
  applicationsTable,
  auditLogsTable,
  creditReservationsTable,
  modelsTable,
  providerCredentialsTable,
  tenantsTable,
  usageRecordsTable,
} from "../schema/index.js"

function asDate(value: Date | number | string | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined
  return value instanceof Date ? value : new Date(value)
}

function revivePricing(pricing: ModelDefinition["pricing"]): ModelDefinition["pricing"] {
  return {
    ...pricing,
    effectiveFrom: asDate(pricing.effectiveFrom) ?? new Date(),
  }
}

const DEFAULT_MODELS: Array<
  Pick<ModelDefinition, "id" | "provider" | "upstreamModelId" | "displayName">
> = [
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
]

export class SqliteTenantRepository implements TenantRepository {
  constructor(private db: GatewaySqliteDatabase) {}

  async getById(id: string): Promise<Tenant | null> {
    const row = this.db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).get()
    return row ? this.mapTenant(row) : null
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    const row = this.db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug)).get()
    return row ? this.mapTenant(row) : null
  }

  async getApiKey(
    keyHash: string,
  ): Promise<{ apiKey: ApiKey; tenant: Tenant; application?: Application } | null> {
    const row = this.db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, keyHash)).get()
    if (!row) return null
    const tenant = await this.getById(row.tenantId)
    if (!tenant) return null
    let application: Application | undefined
    if (row.applicationId) {
      const appRow = this.db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, row.applicationId))
        .get()
      if (appRow) application = this.mapApplication(appRow)
    }
    return {
      apiKey: {
        id: row.id,
        tenantId: row.tenantId,
        applicationId: row.applicationId ?? undefined,
        name: row.name,
        keyHash: row.keyHash,
        keyPrefix: row.keyPrefix,
        scopes: row.scopes,
        expiresAt: asDate(row.expiresAt),
        lastUsedAt: asDate(row.lastUsedAt),
        createdAt: asDate(row.createdAt) ?? new Date(),
      },
      tenant,
      application,
    }
  }

  async saveTenant(tenant: Tenant): Promise<void> {
    this.db
      .insert(tenantsTable)
      .values({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        credentialMode: tenant.credentialMode,
        allowedProviders: tenant.allowedProviders,
        allowedModels: tenant.allowedModels,
        defaultProvider: tenant.defaultProvider,
        defaultModel: tenant.defaultModel,
        maxMonthlySpendUsd:
          tenant.maxMonthlySpendUsd === undefined ? null : String(tenant.maxMonthlySpendUsd),
        metadata: tenant.metadata,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      })
      .onConflictDoUpdate({
        target: tenantsTable.id,
        set: {
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          credentialMode: tenant.credentialMode,
          allowedProviders: tenant.allowedProviders,
          allowedModels: tenant.allowedModels,
          defaultProvider: tenant.defaultProvider,
          defaultModel: tenant.defaultModel,
          maxMonthlySpendUsd:
            tenant.maxMonthlySpendUsd === undefined ? null : String(tenant.maxMonthlySpendUsd),
          metadata: tenant.metadata,
          updatedAt: tenant.updatedAt,
        },
      })
      .run()
  }

  async addApiKey(apiKey: ApiKey, _tenant: Tenant, _application?: Application): Promise<void> {
    this.db
      .insert(apiKeysTable)
      .values({
        id: apiKey.id,
        tenantId: apiKey.tenantId,
        applicationId: apiKey.applicationId,
        name: apiKey.name,
        keyHash: apiKey.keyHash,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
      })
      .onConflictDoUpdate({
        target: apiKeysTable.id,
        set: {
          name: apiKey.name,
          keyHash: apiKey.keyHash,
          keyPrefix: apiKey.keyPrefix,
          scopes: apiKey.scopes,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          applicationId: apiKey.applicationId,
        },
      })
      .run()
  }

  private mapTenant(row: typeof tenantsTable.$inferSelect): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status as Tenant["status"],
      credentialMode: row.credentialMode as Tenant["credentialMode"],
      allowedProviders: row.allowedProviders ?? undefined,
      allowedModels: row.allowedModels ?? undefined,
      defaultProvider: row.defaultProvider ?? undefined,
      defaultModel: row.defaultModel ?? undefined,
      maxMonthlySpendUsd: row.maxMonthlySpendUsd ? Number(row.maxMonthlySpendUsd) : undefined,
      metadata: row.metadata ?? undefined,
      createdAt: asDate(row.createdAt) ?? new Date(),
      updatedAt: asDate(row.updatedAt) ?? new Date(),
    }
  }

  private mapApplication(row: typeof applicationsTable.$inferSelect): Application {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      slug: row.slug,
      status: row.status as Application["status"],
      description: row.description ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: asDate(row.createdAt) ?? new Date(),
      updatedAt: asDate(row.updatedAt) ?? new Date(),
    }
  }
}

export class SqliteCredentialRepository implements CredentialRepository {
  constructor(private db: GatewaySqliteDatabase) {}

  async getById(id: string): Promise<ProviderCredential | null> {
    const row = this.db
      .select()
      .from(providerCredentialsTable)
      .where(eq(providerCredentialsTable.id, id))
      .get()
    return row ? this.map(row) : null
  }

  async findCredentials(filter: {
    provider: string
    scope: CredentialScope
    tenantId?: string
  }): Promise<ProviderCredential[]> {
    const conditions = [
      eq(providerCredentialsTable.provider, filter.provider.toLowerCase()),
      eq(providerCredentialsTable.scope, filter.scope),
      eq(providerCredentialsTable.isEnabled, true),
    ]
    if (filter.tenantId) {
      conditions.push(eq(providerCredentialsTable.tenantId, filter.tenantId))
    }
    return this.db
      .select()
      .from(providerCredentialsTable)
      .where(and(...conditions))
      .orderBy(desc(providerCredentialsTable.priority))
      .all()
      .map((row) => this.map(row))
  }

  async saveCredential(credential: ProviderCredential): Promise<void> {
    this.db
      .insert(providerCredentialsTable)
      .values({
        id: credential.id,
        scope: credential.scope,
        tenantId: credential.tenantId,
        provider: credential.provider.toLowerCase(),
        label: credential.label,
        encryptedSecret: credential.encryptedSecret,
        maskedSecret: credential.maskedSecret,
        baseUrl: credential.baseUrl,
        organizationId: credential.organizationId,
        projectId: credential.projectId,
        isEnabled: credential.isEnabled,
        priority: credential.priority,
        weight: credential.weight,
        lastTestedAt: credential.lastTestedAt,
        lastTestStatus: credential.lastTestStatus,
        lastTestError: credential.lastTestError,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      })
      .onConflictDoUpdate({
        target: providerCredentialsTable.id,
        set: {
          scope: credential.scope,
          tenantId: credential.tenantId,
          provider: credential.provider.toLowerCase(),
          label: credential.label,
          encryptedSecret: credential.encryptedSecret,
          maskedSecret: credential.maskedSecret,
          baseUrl: credential.baseUrl,
          organizationId: credential.organizationId,
          projectId: credential.projectId,
          isEnabled: credential.isEnabled,
          priority: credential.priority,
          weight: credential.weight,
          lastTestedAt: credential.lastTestedAt,
          lastTestStatus: credential.lastTestStatus,
          lastTestError: credential.lastTestError,
          updatedAt: credential.updatedAt,
        },
      })
      .run()
  }

  async deleteCredential(id: string): Promise<void> {
    this.db.delete(providerCredentialsTable).where(eq(providerCredentialsTable.id, id)).run()
  }

  private map(row: typeof providerCredentialsTable.$inferSelect): ProviderCredential {
    return {
      id: row.id,
      scope: row.scope as CredentialScope,
      tenantId: row.tenantId ?? undefined,
      provider: row.provider,
      label: row.label,
      encryptedSecret: row.encryptedSecret,
      maskedSecret: row.maskedSecret,
      baseUrl: row.baseUrl ?? undefined,
      organizationId: row.organizationId ?? undefined,
      projectId: row.projectId ?? undefined,
      isEnabled: row.isEnabled,
      priority: row.priority,
      weight: row.weight,
      lastTestedAt: asDate(row.lastTestedAt),
      lastTestStatus: (row.lastTestStatus as ProviderCredential["lastTestStatus"]) ?? undefined,
      lastTestError: row.lastTestError ?? undefined,
      createdAt: asDate(row.createdAt) ?? new Date(),
      updatedAt: asDate(row.updatedAt) ?? new Date(),
    }
  }
}

export class SqliteModelRepository implements ModelRepository {
  constructor(private db: GatewaySqliteDatabase) {
    this.seedDefaults()
  }

  private seedDefaults(): void {
    const existing = this.db.select({ id: modelsTable.id }).from(modelsTable).limit(1).get()
    if (existing) return
    const now = new Date()
    for (const model of DEFAULT_MODELS) {
      this.db
        .insert(modelsTable)
        .values({
          id: model.id.toLowerCase(),
          provider: model.provider,
          upstreamModelId: model.upstreamModelId,
          displayName: model.displayName,
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
            effectiveFrom: now,
            inputPerMillionTokensUsd: 2.5,
            outputPerMillionTokensUsd: 10.0,
          },
          isEnabled: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }
  }

  async getById(id: string): Promise<ModelDefinition | null> {
    const row = this.db.select().from(modelsTable).where(eq(modelsTable.id, id.toLowerCase())).get()
    return row ? this.map(row) : null
  }

  async listModels(filter?: {
    provider?: string
    isEnabled?: boolean
  }): Promise<ModelDefinition[]> {
    const conditions = []
    if (filter?.provider) {
      conditions.push(eq(modelsTable.provider, filter.provider.toLowerCase()))
    }
    if (filter?.isEnabled !== undefined) {
      conditions.push(eq(modelsTable.isEnabled, filter.isEnabled))
    }
    const query = this.db.select().from(modelsTable)
    const rows = conditions.length > 0 ? query.where(and(...conditions)).all() : query.all()
    return rows.map((row) => this.map(row))
  }

  async saveModel(model: ModelDefinition): Promise<void> {
    const now = new Date()
    this.db
      .insert(modelsTable)
      .values({
        id: model.id.toLowerCase(),
        provider: model.provider,
        upstreamModelId: model.upstreamModelId,
        displayName: model.displayName,
        modalities: model.modalities,
        capabilities: model.capabilities,
        pricing: model.pricing,
        isEnabled: model.isEnabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: modelsTable.id,
        set: {
          provider: model.provider,
          upstreamModelId: model.upstreamModelId,
          displayName: model.displayName,
          modalities: model.modalities,
          capabilities: model.capabilities,
          pricing: model.pricing,
          isEnabled: model.isEnabled,
          updatedAt: now,
        },
      })
      .run()
  }

  private map(row: typeof modelsTable.$inferSelect): ModelDefinition {
    return {
      id: row.id,
      provider: row.provider,
      upstreamModelId: row.upstreamModelId,
      displayName: row.displayName,
      modalities: row.modalities,
      capabilities: row.capabilities,
      pricing: revivePricing(row.pricing),
      isEnabled: row.isEnabled,
    }
  }
}

export class SqliteUsageLedger implements UsageLedger {
  constructor(private db: GatewaySqliteDatabase) {}

  async recordUsage(record: UsageRecord): Promise<void> {
    this.db
      .insert(usageRecordsTable)
      .values({
        id: record.id,
        requestId: record.requestId,
        tenantId: record.tenantId,
        applicationId: record.applicationId,
        apiKeyId: record.apiKeyId,
        provider: record.provider,
        model: record.model,
        credentialId: record.credentialId,
        credentialMode: record.credentialMode,
        status: record.status,
        usage: record.usage,
        providerCostUsd: String(record.providerCostUsd),
        customerChargeUsd: String(record.customerChargeUsd),
        latencyMs: record.latencyMs,
        firstTokenLatencyMs: record.firstTokenLatencyMs,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        createdAt: record.createdAt,
      })
      .run()
  }

  async createReservation(reservation: CreditReservation): Promise<void> {
    this.db
      .insert(creditReservationsTable)
      .values({
        id: reservation.id,
        tenantId: reservation.tenantId,
        requestId: reservation.requestId,
        estimatedCredits: String(reservation.estimatedCredits),
        reservedAt: reservation.reservedAt,
        expiresAt: reservation.expiresAt,
        status: reservation.status,
      })
      .run()
  }

  async settleReservation(requestId: string, _actualCostUsd: number): Promise<void> {
    this.db
      .update(creditReservationsTable)
      .set({ status: "settled" })
      .where(eq(creditReservationsTable.requestId, requestId))
      .run()
  }

  async releaseReservation(requestId: string): Promise<void> {
    this.db
      .update(creditReservationsTable)
      .set({ status: "released" })
      .where(eq(creditReservationsTable.requestId, requestId))
      .run()
  }

  async getTenantUsageSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ totalRequests: number; totalTokens: number; totalCostUsd: number }> {
    const rows = this.db
      .select()
      .from(usageRecordsTable)
      .where(
        and(
          eq(usageRecordsTable.tenantId, tenantId),
          gte(usageRecordsTable.createdAt, from),
          lte(usageRecordsTable.createdAt, to),
        ),
      )
      .all()

    let totalTokens = 0
    let totalCostUsd = 0
    for (const row of rows) {
      totalTokens += row.usage.totalTokens
      totalCostUsd += Number(row.providerCostUsd)
    }
    return { totalRequests: rows.length, totalTokens, totalCostUsd }
  }
}

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(private db: GatewaySqliteDatabase) {}

  async record(entry: AuditLogEntry): Promise<void> {
    this.db
      .insert(auditLogsTable)
      .values({
        id: entry.id,
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        changes: entry.changes,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        status: entry.status,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      })
      .run()
  }

  async list(filter?: AuditLogFilter): Promise<{ items: AuditLogEntry[]; total: number }> {
    const conditions = []
    if (filter?.tenantId) conditions.push(eq(auditLogsTable.tenantId, filter.tenantId))
    if (filter?.resourceType) conditions.push(eq(auditLogsTable.resourceType, filter.resourceType))
    if (filter?.action) conditions.push(eq(auditLogsTable.action, filter.action))
    if (filter?.actorId) conditions.push(eq(auditLogsTable.actorId, filter.actorId))
    if (filter?.status) conditions.push(eq(auditLogsTable.status, filter.status))
    if (filter?.from) conditions.push(gte(auditLogsTable.createdAt, filter.from))
    if (filter?.to) conditions.push(lte(auditLogsTable.createdAt, filter.to))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const totalRow = this.db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogsTable)
      .where(where)
      .get()
    const total = totalRow?.count ?? 0
    const offset = filter?.offset || 0
    const limit = filter?.limit || 50
    const rows = this.db
      .select()
      .from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        actorId: row.actorId,
        actorType: row.actorType,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        changes: row.changes ?? undefined,
        ipAddress: row.ipAddress ?? undefined,
        userAgent: row.userAgent ?? undefined,
        status: row.status as AuditLogEntry["status"],
        metadata: row.metadata ?? undefined,
        createdAt: asDate(row.createdAt) ?? new Date(),
      })),
    }
  }
}

export interface SqliteGatewayStore {
  db: GatewaySqliteDatabase
  tenantRepo: SqliteTenantRepository
  credentialRepo: SqliteCredentialRepository
  modelRepo: SqliteModelRepository
  usageLedger: SqliteUsageLedger
  auditRepo: SqliteAuditLogRepository
}

export function createSqliteGatewayStore(db: GatewaySqliteDatabase): SqliteGatewayStore {
  return {
    db,
    tenantRepo: new SqliteTenantRepository(db),
    credentialRepo: new SqliteCredentialRepository(db),
    modelRepo: new SqliteModelRepository(db),
    usageLedger: new SqliteUsageLedger(db),
    auditRepo: new SqliteAuditLogRepository(db),
  }
}
