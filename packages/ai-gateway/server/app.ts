import type { AuditLogRepository } from "../domain/ports/auditLogRepository.js"
import type {
  CredentialRepository,
  ModelRepository,
  TenantRepository,
  UsageLedger,
} from "../domain/ports/repositories.js"
import type { PromptCachePort } from "../pipeline/types.js"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { openSqliteGatewayDatabase } from "../adapters/db/sqlite/client.js"
import { createSqliteGatewayStore } from "../adapters/db/sqlite/sqliteRepos.js"
import { ProviderRegistry } from "../adapters/providers/registry.js"
import { createEnvelopeCipher } from "../adapters/security/envelopeEncryption.js"
import { AccountFallbackService } from "../application/accountFallbackService.js"
import { AuditService } from "../application/auditService.js"
import { CredentialResolver } from "../application/credentialResolver.js"
import { EmbeddingService } from "../application/embeddingService.js"
import { InferenceService } from "../application/inferenceService.js"
import { QuotaService } from "../application/quotaService.js"
import { ChatOrchestrator } from "../pipeline/chatOrchestrator.js"
import { InMemoryPromptCache } from "../pipeline/promptCache.js"
import { createAuthMiddleware } from "./middlewares/authMiddleware.js"
import { errorHandler } from "./middlewares/errorHandler.js"
import { createInferenceRoutes } from "./routes/inference.js"
import { createManagementRoutes } from "./routes/management.js"
import { createModelRoutes } from "./routes/models.js"

export interface GatewayAppDependencies {
  /** SQLite file path or `:memory:`. Ignored when repositories are passed explicitly. */
  dbPath?: string
  tenantRepo?: TenantRepository
  credentialRepo?: CredentialRepository
  modelRepo?: ModelRepository
  usageLedger?: UsageLedger
  auditRepo?: AuditLogRepository
  cache?: PromptCachePort
  providers?: ProviderRegistry
}

export function createGatewayApp(deps: GatewayAppDependencies = {}) {
  const store =
    deps.tenantRepo && deps.credentialRepo && deps.modelRepo && deps.usageLedger && deps.auditRepo
      ? null
      : createSqliteGatewayStore(openSqliteGatewayDatabase({ path: deps.dbPath }))

  const tenantRepo = deps.tenantRepo ?? store!.tenantRepo
  const credentialRepo = deps.credentialRepo ?? store!.credentialRepo
  const modelRepo = deps.modelRepo ?? store!.modelRepo
  const usageLedger = deps.usageLedger ?? store!.usageLedger
  const auditRepo = deps.auditRepo ?? store!.auditRepo
  const cache = deps.cache || new InMemoryPromptCache()

  const providers = deps.providers || new ProviderRegistry()
  const credentialHealth = new AccountFallbackService()

  const credentialResolver = new CredentialResolver(
    credentialRepo,
    createEnvelopeCipher(),
    credentialHealth,
    { readEnvKey: (name) => process.env[name] },
  )
  const quotaService = new QuotaService(usageLedger)
  const inferenceService = new InferenceService(credentialResolver, quotaService, usageLedger, {
    providers,
    credentialHealth,
  })
  const auditService = new AuditService(auditRepo)
  const embeddingService = new EmbeddingService(credentialResolver)
  const chatOrchestrator = new ChatOrchestrator({ inferenceService, cache })

  const app = new Hono()

  app.use("*", cors())
  app.onError(errorHandler)

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "ai-gateway-standalone",
      storage: store ? "sqlite" : "custom",
      timestamp: new Date().toISOString(),
    }),
  )

  app.use("*", createAuthMiddleware(tenantRepo))

  const inferenceRouter = createInferenceRoutes(
    inferenceService,
    embeddingService,
    chatOrchestrator,
  )
  const modelRouter = createModelRoutes(modelRepo)
  const managementRouter = createManagementRoutes(
    tenantRepo,
    credentialRepo,
    usageLedger,
    auditService,
  )

  app.route("/", inferenceRouter)
  app.route("/", modelRouter)
  app.route("/", managementRouter)

  return {
    app,
    providers,
    tenantRepo,
    credentialRepo,
    modelRepo,
    usageLedger,
    auditRepo,
    auditService,
    embeddingService,
    inferenceService,
    chatOrchestrator,
    cache,
    db: store?.db,
  }
}
