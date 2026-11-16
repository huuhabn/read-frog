import type { OpenAIMessage } from "../formats/types.js"

export interface RtkOptions {
  enabled?: boolean
  maxToolResultChars?: number
}

/**
 * Request Token-Killer: Compresses oversized tool_result content in-place.
 * Principle: Fail-open. If an error occurs, the original messages remain intact.
 */
export function compressToolResults(
  messages: OpenAIMessage[],
  options: RtkOptions = {},
): { compressed: boolean; savingsChars: number } {
  if (!options.enabled) return { compressed: false, savingsChars: 0 }
  const maxChars = options.maxToolResultChars || 3000
  let totalSavings = 0
  let didCompress = false

  for (const msg of messages) {
    if (msg.role !== "tool" || !msg.content || typeof msg.content !== "string") {
      continue
    }

    if (msg.content.length > maxChars) {
      const originalLength = msg.content.length
      const head = msg.content.slice(0, Math.floor(maxChars * 0.7))
      const tail = msg.content.slice(-Math.floor(maxChars * 0.2))
      const omitted = originalLength - head.length - tail.length

      msg.content = `${head}\n\n... [RTK: ${omitted} characters truncated to save tokens] ...\n\n${tail}`
      totalSavings += originalLength - msg.content.length
      didCompress = true
    }
  }

  return { compressed: didCompress, savingsChars: totalSavings }
}
