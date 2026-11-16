import type { OpenAIChatRequest } from "../formats/types.js"
import { injectSystemPrompt, type PromptInjectionOptions } from "./systemPromptInjector.js"
import { compressToolResults, type RtkOptions } from "./toolResultCompressor.js"

export interface RtkPipelineOptions extends RtkOptions, PromptInjectionOptions {}

/**
 * Runs the RTK interceptor pipeline.
 * Guarantees FAIL-OPEN semantics: Any unexpected error is safely logged,
 * leaving the original request body intact.
 */
export function runRtkInterceptor(
  request: OpenAIChatRequest,
  options?: RtkPipelineOptions,
): { modified: boolean; savingsChars: number } {
  if (!options) return { modified: false, savingsChars: 0 }

  try {
    let savings = 0
    let modified = false

    if (request.messages && Array.isArray(request.messages)) {
      if (options.enabled) {
        const res = compressToolResults(request.messages, options)
        savings += res.savingsChars
        if (res.compressed) modified = true
      }

      if (options.concisePrompt || options.customSystemPrompt) {
        injectSystemPrompt(request.messages, options)
        modified = true
      }
    }

    return { modified, savingsChars: savings }
  } catch (err) {
    // Fail-open: Never throw, never abort request
    console.warn("[RTK Interceptor] Error executing RTK pipeline, falling open:", err)
    return { modified: false, savingsChars: 0 }
  }
}
