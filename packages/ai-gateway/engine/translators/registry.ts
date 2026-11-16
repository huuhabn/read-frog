import { FORMATS, type FormatType, type TranslationState } from "../formats/types.js"
import { claudeToOpenaiRequest } from "./request/claudeToOpenai.js"
import { geminiToOpenaiRequest } from "./request/geminiToOpenai.js"
import { ollamaToOpenaiRequest } from "./request/ollamaToOpenai.js"
import { openaiToClaudeRequest } from "./request/openaiToClaude.js"
import { openaiToGeminiRequest } from "./request/openaiToGemini.js"
import { responsesToOpenaiRequest } from "./request/responsesToOpenai.js"
import { claudeToOpenaiChunk } from "./response/claudeToOpenaiChunk.js"
import { geminiToOpenaiChunk } from "./response/geminiToOpenaiChunk.js"
import { openaiToClaudeEvents } from "./response/openaiToClaudeChunk.js"

type RequestTranslatorFn = (body: any, model?: string) => any
type ResponseTranslatorFn = (chunk: any, state: TranslationState) => any

export class TranslatorRegistry {
  private static instance: TranslatorRegistry
  private requestRegistry = new Map<string, RequestTranslatorFn>()
  private responseRegistry = new Map<string, ResponseTranslatorFn>()

  private constructor() {
    this.registerDefaults()
  }

  public static getInstance(): TranslatorRegistry {
    if (!TranslatorRegistry.instance) {
      TranslatorRegistry.instance = new TranslatorRegistry()
    }
    return TranslatorRegistry.instance
  }

  public register(
    from: string,
    to: string,
    requestFn?: RequestTranslatorFn,
    responseFn?: ResponseTranslatorFn,
  ): void {
    const key = `${from}:${to}`
    if (requestFn) this.requestRegistry.set(key, requestFn)
    if (responseFn) this.responseRegistry.set(key, responseFn)
  }

  private registerDefaults(): void {
    // Request Translators to OpenAI
    this.register(FORMATS.CLAUDE, FORMATS.OPENAI, (body) => claudeToOpenaiRequest(body))
    this.register(FORMATS.GEMINI, FORMATS.OPENAI, (body, model) =>
      geminiToOpenaiRequest(body, model),
    )
    this.register(FORMATS.RESPONSES, FORMATS.OPENAI, (body) => responsesToOpenaiRequest(body))
    this.register(FORMATS.OLLAMA, FORMATS.OPENAI, (body) => ollamaToOpenaiRequest(body))

    // Request Translators from OpenAI
    this.register(FORMATS.OPENAI, FORMATS.CLAUDE, (body) => openaiToClaudeRequest(body))
    this.register(FORMATS.OPENAI, FORMATS.GEMINI, (body) => openaiToGeminiRequest(body))

    // Response Chunk Translators
    this.register(FORMATS.CLAUDE, FORMATS.OPENAI, undefined, (chunk, state) =>
      claudeToOpenaiChunk(chunk, state),
    )
    this.register(FORMATS.GEMINI, FORMATS.OPENAI, undefined, (chunk, state) =>
      geminiToOpenaiChunk(chunk, state),
    )
    this.register(FORMATS.OPENAI, FORMATS.CLAUDE, undefined, (chunk, state) =>
      openaiToClaudeEvents(chunk, state),
    )
  }

  /**
   * Translate inbound client request into upstream provider format.
   * If source !== target: pivots through OpenAI intermediate representation if no direct route exists.
   */
  public translateRequest(
    sourceFormat: FormatType,
    targetFormat: FormatType,
    body: Record<string, unknown>,
    model?: string,
  ): Record<string, unknown> {
    if (sourceFormat === targetFormat) {
      return body
    }

    // Direct route
    const directKey = `${sourceFormat}:${targetFormat}`
    const directFn = this.requestRegistry.get(directKey)
    if (directFn) {
      return directFn(body, model)
    }

    // Step 1: source -> openai (if source is not openai)
    let intermediate: any = body
    if (sourceFormat !== FORMATS.OPENAI) {
      const toOpenaiFn = this.requestRegistry.get(`${sourceFormat}:${FORMATS.OPENAI}`)
      if (toOpenaiFn) {
        intermediate = toOpenaiFn(body, model)
      }
    }

    // Step 2: openai -> target (if target is not openai)
    if (targetFormat !== FORMATS.OPENAI) {
      const toTargetFn = this.requestRegistry.get(`${FORMATS.OPENAI}:${targetFormat}`)
      if (toTargetFn) {
        return toTargetFn(intermediate, model)
      }
    }

    return intermediate
  }

  /**
   * Translate upstream chunk into client wire format.
   */
  public translateResponse(
    sourceFormat: FormatType, // client's desired format
    targetFormat: FormatType, // upstream provider's output format
    chunk: Record<string, unknown>,
    state: TranslationState,
  ): any {
    if (sourceFormat === targetFormat) {
      return chunk
    }

    // Direct route: ${targetFormat}:${sourceFormat}
    const directKey = `${targetFormat}:${sourceFormat}`
    const directFn = this.responseRegistry.get(directKey)
    if (directFn) {
      return directFn(chunk, state)
    }

    // Step 1: upstream target -> openai (if target is not openai)
    let intermediate: any = chunk
    if (targetFormat !== FORMATS.OPENAI) {
      const toOpenaiFn = this.responseRegistry.get(`${targetFormat}:${FORMATS.OPENAI}`)
      if (toOpenaiFn) {
        intermediate = toOpenaiFn(chunk, state)
      }
    }

    if (!intermediate) return null

    // Step 2: openai -> client source (if client is not expecting openai)
    if (sourceFormat !== FORMATS.OPENAI) {
      const toClientFn = this.responseRegistry.get(`${FORMATS.OPENAI}:${sourceFormat}`)
      if (toClientFn) {
        return toClientFn(intermediate, state)
      }
    }

    return intermediate
  }
}

export const translatorRegistry = TranslatorRegistry.getInstance()
