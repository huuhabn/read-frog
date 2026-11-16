import type { ProviderRegistry } from "../adapters/providers/registry.js"
import type { ResolvedCredential } from "../domain/entities/credential.js"
import type { Tenant, Application } from "../domain/entities/tenant.js"
import type { TokenUsage, UsageRecord } from "../domain/entities/usage.js"
import type { ProviderExecutionResult } from "../domain/ports/providerAdapter.js"
import type { UsageLedger } from "../domain/ports/repositories.js"
import type { GatewayOperation, GatewayRouteCandidate } from "../domain/routing.js"
import type { AccountFallbackService } from "./accountFallbackService.js"
import type { CredentialResolver } from "./credentialResolver.js"
import type { QuotaService } from "./quotaService.js"
import { GatewayError, ProviderUnavailableError, UpstreamError } from "../domain/errors.js"
import { RouteError } from "../domain/routing.js"
import { FORMATS, type FormatType, type OpenAIChatRequest } from "../engine/formats/types.js"
import { runRtkInterceptor, type RtkPipelineOptions } from "../engine/rtk/interceptor.js"
import { createGatewaySSEStream } from "../engine/stream/streamController.js"
import { translatorRegistry } from "../engine/translators/registry.js"
import { executeGatewayAttempts } from "./routing/routeExecutor.js"
import { GatewayHealthRegistry } from "./routing/routeHealth.js"
import { planGatewayRoutes } from "./routing/routePlanner.js"

const MAX_CREDENTIAL_ATTEMPTS = 3

export interface InferenceServiceDeps {
  providers: ProviderRegistry
  credentialHealth: AccountFallbackService
  /** Cooldown state for whole provider/model routes. Defaults to one registry per service. */
  routeHealth?: GatewayHealthRegistry
}

export interface InferenceOptions {
  requestId?: string
  sourceFormat: FormatType
  model: string
  /** Tried in order, each as its own provider route, when `model` fails with a retryable error. */
  fallbackModels?: string[]
  body: Record<string, unknown>
  tenant?: Tenant | null
  application?: Application | null
  apiKeyId?: string
  clientSignal?: AbortSignal
  headers?: Record<string, string>
  rtkOptions?: RtkPipelineOptions
}

export interface StreamingInferenceResult {
  isStream: true
  statusCode: number
  headers: Record<string, string>
  stream: ReadableStream<Uint8Array>
}

export interface NonStreamingInferenceResult {
  isStream: false
  statusCode: number
  headers: Record<string, string>
  data: Record<string, unknown>
  usage?: TokenUsage
}

export type InferenceResult = StreamingInferenceResult | NonStreamingInferenceResult

export class InferenceService {
  private readonly providers: ProviderRegistry
  private readonly credentialHealth: AccountFallbackService
  private readonly routeHealth: GatewayHealthRegistry

  constructor(
    private credentialResolver: CredentialResolver,
    private quotaService: QuotaService,
    private usageLedger: UsageLedger,
    deps: InferenceServiceDeps,
  ) {
    this.providers = deps.providers
    this.credentialHealth = deps.credentialHealth
    this.routeHealth = deps.routeHealth ?? new GatewayHealthRegistry()
  }

  /**
   * Parse provider and model from model identifier.
   * e.g. "openai/gpt-4o" -> { provider: "openai", model: "gpt-4o" }
   * e.g. "claude-3-5-sonnet-20241022" -> { provider: "anthropic", model: "claude-3-5-sonnet-20241022" }
   * e.g. "gemini-1.5-pro" -> { provider: "gemini", model: "gemini-1.5-pro" }
   */
  public parseModel(rawModel: string): { provider: string; model: string } {
    if (rawModel.includes("/")) {
      const [p = "", ...rest] = rawModel.split("/")
      return { provider: p.toLowerCase(), model: rest.join("/") }
    }

    const lower = rawModel.toLowerCase()
    if (lower.startsWith("claude")) return { provider: "anthropic", model: rawModel }
    if (lower.startsWith("gemini")) return { provider: "gemini", model: rawModel }
    if (lower.startsWith("deepseek")) return { provider: "deepseek", model: rawModel }
    if (lower.startsWith("llama") || lower.startsWith("mistral"))
      return { provider: "groq", model: rawModel }

    return { provider: "openai", model: rawModel }
  }

  /**
   * Determines the provider's upstream format.
   */
  public getTargetFormat(provider: string): FormatType {
    if (provider === "anthropic") return FORMATS.CLAUDE
    if (provider === "gemini") return FORMATS.GEMINI
    return FORMATS.OPENAI
  }

  public async execute(options: InferenceOptions): Promise<InferenceResult> {
    const requestId =
      options.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const startTime = Date.now()

    // 1. Reserve Quota/Credits (if tenant exists)
    if (options.tenant) {
      await this.quotaService.reserveCredits(options.tenant.id, requestId)
    }

    try {
      return await this.executeRoutes(options, requestId, startTime)
    } catch (error) {
      if (options.tenant) {
        await this.quotaService.releaseCredits(requestId)
      }
      throw error
    }
  }

  /**
   * Tries `model`, then each of `fallbackModels`, moving on only for retryable
   * failures (rate limits, overload, missing credentials, network errors).
   */
  private async executeRoutes(
    options: InferenceOptions,
    requestId: string,
    startTime: number,
  ): Promise<InferenceResult> {
    const operation: GatewayOperation = options.body.stream ? "text.stream" : "text.generate"
    const candidates = [options.model, ...(options.fallbackModels ?? [])].map(
      (rawModel, index): GatewayRouteCandidate => {
        const { provider, model } = this.parseModel(rawModel)
        return {
          routeId: `${provider}/${model}`,
          providerId: provider,
          model,
          operations: [operation],
          enabled: true,
          pinned: index === 0,
          configurationOrder: index,
        }
      },
    )
    const planned = planGatewayRoutes(operation, candidates, { health: this.routeHealth })
    const routes = planned.length > 0 ? planned : candidates.slice(0, 1)

    try {
      return await executeGatewayAttempts(
        routes.map((candidate) => ({
          candidate,
          execute: () =>
            this.executeReserved(
              options,
              requestId,
              startTime,
              candidate.providerId,
              candidate.model ?? "",
            ),
        })),
        options.clientSignal ?? new AbortController().signal,
        {},
        this.routeHealth,
      )
    } catch (error) {
      // Callers (and the HTTP error handler) expect the domain error, not the routing wrapper.
      throw error instanceof RouteError && error.cause instanceof GatewayError ? error.cause : error
    }
  }

  /**
   * Calls the adapter, moving to the next healthy credential when the upstream
   * error is one that `credentialHealth` marks as fallback-eligible.
   */
  private async executeWithCredentialFallback(
    provider: string,
    tenant: Tenant | null | undefined,
    run: (credential: ResolvedCredential) => Promise<ProviderExecutionResult>,
  ): Promise<{ credential: ResolvedCredential; execution: ProviderExecutionResult }> {
    const triedCredentialIds = new Set<string>()
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_CREDENTIAL_ATTEMPTS; attempt++) {
      let credential: ResolvedCredential
      try {
        credential = await this.credentialResolver.resolve(provider, tenant)
      } catch (resolveError) {
        throw lastError ?? resolveError
      }
      if (triedCredentialIds.has(credential.credentialId)) break
      triedCredentialIds.add(credential.credentialId)

      try {
        const execution = await run(credential)
        this.credentialHealth.recordSuccess(credential.credentialId)
        return { credential, execution }
      } catch (error) {
        lastError = error
        if (!(error instanceof UpstreamError)) throw error
        const rule = this.credentialHealth.checkFallbackError(
          error.upstreamStatusCode,
          error.message,
        )
        if (!rule.shouldFallback) throw error
        this.credentialHealth.markCooldown(credential.credentialId, rule.cooldownMs)
      }
    }

    throw lastError
  }

  private async executeReserved(
    options: InferenceOptions,
    requestId: string,
    startTime: number,
    provider: string,
    model: string,
  ): Promise<InferenceResult> {
    const targetFormat = this.getTargetFormat(provider)

    // 2. Step 1 of Request Translation: client format -> OpenAI intermediate representation
    let openaiReq = (options.sourceFormat === FORMATS.OPENAI
      ? { ...options.body }
      : translatorRegistry.translateRequest(
          options.sourceFormat,
          FORMATS.OPENAI,
          options.body,
          model,
        )) as unknown as OpenAIChatRequest

    // 3. Run RTK (Request Token-Killer) Interceptor
    runRtkInterceptor(openaiReq, options.rtkOptions)

    // 4. Step 2 of Request Translation: OpenAI -> provider's target format
    const upstreamBody =
      targetFormat === FORMATS.OPENAI
        ? openaiReq
        : translatorRegistry.translateRequest(FORMATS.OPENAI, targetFormat, openaiReq, model)

    // 5. Resolve credentials and execute via Provider Adapter
    const adapter = this.providers.getAdapter(provider)
    if (!adapter) {
      throw new ProviderUnavailableError(provider)
    }

    const isStream = Boolean(options.body.stream)
    const { credential, execution } = await this.executeWithCredentialFallback(
      provider,
      options.tenant,
      (attemptCredential) =>
        adapter.execute({
          model,
          body: upstreamBody,
          credential: attemptCredential,
          stream: isStream,
          signal: options.clientSignal,
          headers: options.headers,
        }),
    )

    // 6. Handle Streaming vs Non-Streaming
    if (execution.isStream) {
      const sseStream = createGatewaySSEStream({
        upstreamStream: execution.stream,
        upstreamAbortController: execution.abortController,
        clientSignal: options.clientSignal,
        sourceFormat: options.sourceFormat,
        targetFormat,
        onComplete: async (usage: TokenUsage, isInterrupted: boolean) => {
          const latencyMs = Date.now() - startTime
          const status = isInterrupted ? "interrupted" : "completed"
          const providerCostUsd = (usage.totalTokens / 1_000_000) * 2.5 // default base calculation

          if (options.tenant) {
            await this.quotaService.settleCredits(requestId, providerCostUsd)
            const usageRecord: UsageRecord = {
              id: `rec_${requestId}`,
              requestId,
              tenantId: options.tenant.id,
              applicationId: options.application?.id,
              apiKeyId: options.apiKeyId,
              provider,
              model,
              credentialId: credential.credentialId,
              credentialMode: credential.scope === "tenant" ? "byok" : "shared",
              status,
              usage,
              providerCostUsd,
              customerChargeUsd: providerCostUsd * 1.2,
              latencyMs,
              createdAt: new Date(),
            }
            await this.usageLedger.recordUsage(usageRecord)
          }
        },
      })

      return {
        isStream: true,
        statusCode: execution.statusCode,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
        stream: sseStream,
      }
    }

    // Non-streaming response
    const latencyMs = Date.now() - startTime
    const usage = execution.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    const providerCostUsd = (usage.totalTokens / 1_000_000) * 2.5

    if (options.tenant) {
      await this.quotaService.settleCredits(requestId, providerCostUsd)
      const usageRecord: UsageRecord = {
        id: `rec_${requestId}`,
        requestId,
        tenantId: options.tenant.id,
        applicationId: options.application?.id,
        apiKeyId: options.apiKeyId,
        provider,
        model,
        credentialId: credential.credentialId,
        credentialMode: credential.scope === "tenant" ? "byok" : "shared",
        status: "completed",
        usage,
        providerCostUsd,
        customerChargeUsd: providerCostUsd * 1.2,
        latencyMs,
        createdAt: new Date(),
      }
      await this.usageLedger.recordUsage(usageRecord)
    }

    return {
      isStream: false,
      statusCode: execution.statusCode,
      headers: { "Content-Type": "application/json" },
      data: execution.data,
      usage,
    }
  }
}
