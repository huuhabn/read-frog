/**
 * Chat Orchestrator: Complete 10-step lifecycle implementation.
 */

import type { SendOptions, SendResult, CachedResponse } from "./types"
import { InferenceService } from "../application/inferenceService"
import { FORMATS } from "../engine/formats/types"
import { OutputNormalizer } from "./outputNormalizer"
import { type PromptCachePort, InMemoryPromptCache } from "./promptCache"
import { PromptPipeline } from "./promptPipeline"

export interface ChatOrchestratorOptions {
  inferenceService: InferenceService
  cache?: PromptCachePort
  pipeline?: PromptPipeline
  onSaveMessage?: (message: {
    conversationId?: string
    role: "user" | "assistant"
    content: string
    metadata?: Record<string, unknown>
  }) => Promise<void> | void
}

export class ChatOrchestrator {
  private inferenceService: InferenceService
  private cache: PromptCachePort
  private pipeline: PromptPipeline
  private onSaveMessage?: (message: {
    conversationId?: string
    role: "user" | "assistant"
    content: string
    metadata?: Record<string, unknown>
  }) => Promise<void> | void

  constructor(options: ChatOrchestratorOptions) {
    this.inferenceService = options.inferenceService
    this.cache = options.cache ?? new InMemoryPromptCache()
    this.pipeline = options.pipeline ?? new PromptPipeline()
    this.onSaveMessage = options.onSaveMessage
  }

  /**
   * Executes the full 10-step lifecycle for a single user prompt/message.
   */
  public async send(text: string, options?: SendOptions): Promise<SendResult> {
    // [1] Check abort signal
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError")
    }

    const target = options?.target || "gpt-4o"
    const { provider, model } = this.inferenceService.parseModel(target)

    // [2] & [3] Context aggregation & 5-phase prompt compilation
    const compiled = this.pipeline.compile(text, {
      styleProfile: options?.styleProfile,
      styleOverride: options?.styleOverride,
      history: options?.history,
      glossary: options?.glossary,
    })

    // [4] Record user message if hook provided
    if (this.onSaveMessage) {
      await this.onSaveMessage({
        conversationId: options?.conversationId,
        role: "user",
        content: text,
        metadata: { target, ...options?.metadata },
      })
    }

    // [5] Cache lookup
    const cacheKey = await InMemoryPromptCache.generateKey(
      compiled.system,
      text,
      target,
      options?.params,
    )

    if (!options?.bypassCache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return {
          text: cached.text,
          cached: true,
          attempt: cached.attempt,
          usage: {
            promptTokens: cached.promptTokens ?? 0,
            completionTokens: cached.completionTokens ?? 0,
            totalTokens: cached.totalTokens ?? 0,
          },
        }
      }
    }

    // [6] & [7] Execute via InferenceService (Router / Account Fallback / Translators)
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "system", content: compiled.system }, ...compiled.messages],
      stream: Boolean(options?.stream),
      ...(options?.params ?? {}),
    }

    const inferenceResult = await this.inferenceService.execute({
      sourceFormat: FORMATS.OPENAI,
      model: target,
      body,
      clientSignal: options?.signal,
    })

    // [8], [9], [10] Handle Non-streaming vs Streaming with Normalization
    if (!inferenceResult.isStream) {
      const data = inferenceResult.data
      const choices = (data.choices as Array<{ message?: { content?: string } }>) || []
      const rawText = choices[0]?.message?.content || ""

      const normalized = OutputNormalizer.normalize(rawText, {
        sourceText: text,
        validateHtmlMarkers: true,
        stripThinkTags: true,
        handleSentinels: true,
      })

      const attemptInfo = {
        provider,
        model,
      }

      const usage = inferenceResult.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }

      // Save to Cache
      const cacheEntry: CachedResponse = {
        text: normalized.text,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        attempt: attemptInfo,
        createdAt: Date.now(),
      }
      await this.cache.set(cacheKey, cacheEntry, options?.ttlMs)

      // Record assistant message
      if (this.onSaveMessage) {
        await this.onSaveMessage({
          conversationId: options?.conversationId,
          role: "assistant",
          content: normalized.text,
          metadata: { attempt: attemptInfo, usage },
        })
      }

      return {
        text: normalized.text,
        cached: false,
        attempt: attemptInfo,
        usage,
      }
    }

    // Streaming handling
    const [clientStream, rawStream] = inferenceResult.stream.tee()
    const normalizedStream = clientStream.pipeThrough(OutputNormalizer.createStreamingTransformer())

    return {
      text: "",
      cached: false,
      attempt: { provider, model },
      stream: normalizedStream,
      getFinalResponse: async () => {
        // Collect stream chunks to cache and save message
        const reader = rawStream.getReader()
        const decoder = new TextDecoder()
        let fullSseText = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            fullSseText += decoder.decode(value, { stream: true })
          }
        } finally {
          reader.releaseLock()
        }

        // Extract content from SSE data chunks
        const lines = fullSseText.split("\n")
        let accumulatedContent = ""
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const parsed = JSON.parse(line.slice(6))
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) accumulatedContent += delta
            } catch {
              // Ignore invalid JSON in SSE heartbeat
            }
          }
        }

        const normalized = OutputNormalizer.normalize(accumulatedContent, {
          sourceText: text,
          validateHtmlMarkers: true,
        })

        await this.cache.set(
          cacheKey,
          {
            text: normalized.text,
            attempt: { provider, model },
            createdAt: Date.now(),
          },
          options?.ttlMs,
        )

        if (this.onSaveMessage) {
          await this.onSaveMessage({
            conversationId: options?.conversationId,
            role: "assistant",
            content: normalized.text,
            metadata: { provider, model },
          })
        }

        return {
          text: normalized.text,
        }
      },
    }
  }

  public getCache(): PromptCachePort {
    return this.cache
  }

  public getPipeline(): PromptPipeline {
    return this.pipeline
  }
}
