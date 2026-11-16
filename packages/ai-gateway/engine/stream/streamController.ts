import type { TokenUsage } from "../../domain/entities/usage.js"
import type { FormatType, TranslationState } from "../formats/types.js"
import { translatorRegistry } from "../translators/registry.js"
import { createSSEParserStream } from "./sseParser.js"
import { TokenCounter } from "./tokenCounter.js"

export interface StreamControllerOptions {
  upstreamStream: ReadableStream<Uint8Array>
  upstreamAbortController: AbortController
  clientSignal?: AbortSignal
  sourceFormat: FormatType // Client format
  targetFormat: FormatType // Upstream format
  onComplete?: (usage: TokenUsage, isInterrupted: boolean) => void
}

export function createGatewaySSEStream(
  options: StreamControllerOptions,
): ReadableStream<Uint8Array> {
  const {
    upstreamStream,
    upstreamAbortController,
    clientSignal,
    sourceFormat,
    targetFormat,
    onComplete,
  } = options

  const encoder = new TextEncoder()
  const tokenCounter = new TokenCounter()
  const state: TranslationState = {}
  let isInterrupted = false

  // Listen to client disconnect
  if (clientSignal) {
    if (clientSignal.aborted) {
      upstreamAbortController.abort()
      isInterrupted = true
    } else {
      clientSignal.addEventListener(
        "abort",
        () => {
          isInterrupted = true
          upstreamAbortController.abort()
        },
        { once: true },
      )
    }
  }

  const parserStream = upstreamStream.pipeThrough(createSSEParserStream())
  const reader = parserStream.getReader()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          if (isInterrupted) {
            break
          }

          const { done, value } = await reader.read()
          if (done) {
            // End of upstream stream
            if (sourceFormat === "openai") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            }
            break
          }

          if (!value?.data) continue
          if (value.data.trim() === "[DONE]") {
            if (sourceFormat === "openai") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            }
            break
          }

          let parsedChunk: any
          try {
            parsedChunk = JSON.parse(value.data)
          } catch {
            // Not a JSON chunk, pass through or skip
            continue
          }

          // Extract usage if present in upstream chunk
          if (parsedChunk.usage) {
            tokenCounter.setExactUsage({
              promptTokens: parsedChunk.usage.prompt_tokens,
              completionTokens: parsedChunk.usage.completion_tokens,
            })
          }

          // Translate chunk
          const translated = translatorRegistry.translateResponse(
            sourceFormat,
            targetFormat,
            parsedChunk,
            state,
          )

          if (!translated) continue

          // Format translated output to client SSE
          if (Array.isArray(translated)) {
            for (const item of translated) {
              if (item.event && item.data) {
                // e.g. Claude SSE event format
                controller.enqueue(
                  encoder.encode(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`),
                )
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`))
              }
            }
          } else if (typeof translated === "object") {
            if (translated.choices?.[0]?.delta?.content) {
              tokenCounter.recordDelta(translated.choices[0].delta.content)
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(translated)}\n\n`))
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || isInterrupted) {
          isInterrupted = true
        } else {
          controller.error(err)
        }
      } finally {
        reader.releaseLock()
        controller.close()
        if (onComplete) {
          onComplete(tokenCounter.getUsage(), isInterrupted)
        }
      }
    },
    cancel() {
      isInterrupted = true
      upstreamAbortController.abort()
      if (onComplete) {
        onComplete(tokenCounter.getUsage(), true)
      }
    },
  })
}
