/**
 * Output Normalization: Strips <think> reasoning blocks, handles sentinels, and validates markers.
 */

import type { OutputNormalizationOptions } from "./types"

export const SENTINEL_NO_TRANSLATION = "{{NO_TRANSLATION_NEEDED}}"

export interface NormalizationResult {
  text: string
  hasThinkTags: boolean
  thoughtContent?: string
  isSentinel: boolean
  missingMarkers?: string[]
  isValid: boolean
}

export const OutputNormalizer = {
  /**
   * Normalizes complete output text synchronously.
   */
  normalize(
    rawText: string,
    options?: OutputNormalizationOptions & { sourceText?: string },
  ): NormalizationResult {
    let text = rawText
    let hasThinkTags = false
    let thoughtContent: string | undefined = undefined

    // 1. Strip reasoning <think>...</think> tags
    const stripThink = options?.stripThinkTags !== false
    if (stripThink) {
      const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i)
      if (thinkMatch) {
        hasThinkTags = true
        thoughtContent = (thinkMatch[1] ?? "").trim()
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
      }
    }

    // 2. Sentinel Handling
    let isSentinel = false
    if (options?.handleSentinels !== false && text.includes(SENTINEL_NO_TRANSLATION)) {
      isSentinel = true
      text = text.replace(new RegExp(SENTINEL_NO_TRANSLATION, "g"), "").trim()
    }

    // 3. HTML Marker Validation
    let missingMarkers: string[] | undefined = undefined
    let isValid = true

    if (options?.validateHtmlMarkers && options.sourceText) {
      const markerRegex = /<[^>]+>|\[ph\s+id=[^\]]+\]/gi
      const sourceMarkers = options.sourceText.match(markerRegex) || []
      const outputMarkers = new Set(text.match(markerRegex) || [])

      const missing: string[] = []
      for (const m of sourceMarkers) {
        if (!outputMarkers.has(m)) {
          missing.push(m)
        }
      }

      if (missing.length > 0) {
        missingMarkers = missing
        isValid = false
      }
    }

    return {
      text,
      hasThinkTags,
      thoughtContent,
      isSentinel,
      missingMarkers,
      isValid,
    }
  },

  /**
   * Creates a Web Streams TransformStream that strips <think>...</think> in real-time as chunks arrive.
   */
  createStreamingTransformer(): TransformStream<Uint8Array, Uint8Array> {
    const textDecoder = new TextDecoder()
    const textEncoder = new TextEncoder()
    let buffer = ""
    let insideThink = false

    return new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += textDecoder.decode(chunk, { stream: true })

        while (buffer.length > 0) {
          if (insideThink) {
            const endIdx = buffer.indexOf("</think>")
            if (endIdx !== -1) {
              insideThink = false
              buffer = buffer.slice(endIdx + "</think>".length)
            } else {
              // Keep only the potential start of a partial tag at the end
              const potentialTag = buffer.slice(-8)
              if ("</think>".startsWith(potentialTag)) {
                buffer = potentialTag
              } else {
                buffer = ""
              }
              break
            }
          } else {
            const startIdx = buffer.indexOf("<think>")
            if (startIdx !== -1) {
              const beforeThink = buffer.slice(0, startIdx)
              if (beforeThink.length > 0) {
                controller.enqueue(textEncoder.encode(beforeThink))
              }
              insideThink = true
              buffer = buffer.slice(startIdx + "<think>".length)
            } else {
              // Not inside think, but check if buffer ends with partial '<think'
              const partialMatch = buffer.match(/<t?(h?(i?(n?(k?)?)?)?)?$/)
              if (
                partialMatch &&
                partialMatch[0].length > 0 &&
                "<think>".startsWith(partialMatch[0])
              ) {
                const safeToEmit = buffer.slice(0, buffer.length - partialMatch[0].length)
                if (safeToEmit.length > 0) {
                  controller.enqueue(textEncoder.encode(safeToEmit))
                }
                buffer = partialMatch[0]
                break
              } else {
                controller.enqueue(textEncoder.encode(buffer))
                buffer = ""
              }
            }
          }
        }
      },
      flush(controller) {
        if (!insideThink && buffer.length > 0) {
          controller.enqueue(textEncoder.encode(buffer))
        }
      },
    })
  },
}
