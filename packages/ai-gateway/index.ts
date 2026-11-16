// Runtime-agnostic core: safe to import from browser, worker, and Node code.
// Node-only pieces (Hono server, AES envelope encryption, Drizzle schema) live in `./server`.

// Domain Entities & Ports
export * from "./domain/entities/tenant.js"
export * from "./domain/entities/credential.js"
export * from "./domain/entities/model.js"
export * from "./domain/entities/usage.js"
export * from "./domain/entities/auditLog.js"
export * from "./domain/entities/embedding.js"
export * from "./domain/ports/providerAdapter.js"
export * from "./domain/ports/repositories.js"
export * from "./domain/ports/auditLogRepository.js"
export * from "./domain/ports/secretCipher.js"
export * from "./domain/errors.js"

// Format Engine & Translators
export * from "./engine/formats/types.js"
export * from "./engine/formats/detector.js"
export * from "./engine/translators/registry.js"
export * from "./engine/stream/streamController.js"
export * from "./engine/stream/sseParser.js"
export * from "./engine/stream/tokenCounter.js"
export * from "./engine/rtk/interceptor.js"

// Provider Adapters
export * from "./adapters/providers/base.js"
export * from "./adapters/providers/openaiCompatible.js"
export * from "./adapters/providers/anthropic.js"
export * from "./adapters/providers/gemini.js"
export * from "./adapters/providers/registry.js"
export * from "./adapters/providers/web/baseWebSession.js"
export * from "./adapters/providers/web/chatgptWeb.js"
export * from "./adapters/providers/web/deepseekWeb.js"
export * from "./adapters/providers/web/perplexityWeb.js"
export * from "./adapters/providers/web/geminiWeb.js"
export * from "./adapters/providers/web/museWeb.js"

// In-memory Repositories
export * from "./adapters/db/memory/inMemoryRepos.js"

// Application Services
export * from "./application/credentialResolver.js"
export * from "./application/quotaService.js"
export * from "./application/inferenceService.js"
export * from "./application/auditService.js"
export * from "./application/accountFallbackService.js"
export * from "./application/embeddingService.js"

// Cross-provider Routing
export * from "./routing.js"

// Prompt Pipeline, Cache, Normalizer & Chat Orchestrator
export * from "./pipeline/types.js"
export * from "./pipeline/promptPipeline.js"
export * from "./pipeline/promptCache.js"
export * from "./pipeline/outputNormalizer.js"
export * from "./pipeline/chatOrchestrator.js"
