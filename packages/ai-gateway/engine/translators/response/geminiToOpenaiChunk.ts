import type { OpenAIChatChunk, TranslationState } from "../../formats/types.js"

/**
 * Translates a Google Gemini streaming chunk into an OpenAI Chat Completion chunk.
 */
export function geminiToOpenaiChunk(
  chunk: Record<string, unknown>,
  state: TranslationState,
): OpenAIChatChunk | null {
  const candidates = chunk.candidates as Array<Record<string, unknown>> | undefined
  const candidate = candidates?.[0]
  if (!candidate) {
    // Check if usage only
    const usage = chunk.usageMetadata as Record<string, number> | undefined
    if (usage) {
      return {
        id: (state.id as string) || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: (state.created as number) || Math.floor(Date.now() / 1000),
        model: (state.model as string) || "gemini",
        choices: [],
        usage: {
          prompt_tokens: usage.promptTokenCount || 0,
          completion_tokens: usage.candidatesTokenCount || 0,
          total_tokens: usage.totalTokenCount || 0,
        },
      }
    }
    return null
  }

  const content = candidate.content as Record<string, unknown> | undefined
  const parts = (content?.parts as Array<Record<string, unknown>>) || []
  const finishReasonRaw = candidate.finishReason as string | undefined

  let finishReason: string | null = null
  if (finishReasonRaw === "STOP") finishReason = "stop"
  else if (finishReasonRaw === "MAX_TOKENS") finishReason = "length"

  let textDelta: string | null = null
  const toolCalls: OpenAIChatChunk["choices"][0]["delta"]["tool_calls"] = []

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (!p) continue
    if (typeof p.text === "string") {
      textDelta = (textDelta || "") + p.text
    } else if (p.functionCall && typeof p.functionCall === "object") {
      const fc = p.functionCall as { name: string; args: unknown }
      toolCalls.push({
        index: i,
        id: `call_${Math.random().toString(36).slice(2, 10)}`,
        type: "function",
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args || {}),
        },
      })
      finishReason = "tool_calls"
    }
  }

  const usage = chunk.usageMetadata as Record<string, number> | undefined

  return {
    id: (state.id as string) || `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: (state.created as number) || Math.floor(Date.now() / 1000),
    model: (state.model as string) || "gemini",
    choices: [
      {
        index: 0,
        delta: {
          ...(state.roleSent ? {} : { role: "assistant" }),
          ...(textDelta !== null ? { content: textDelta } : {}),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    ...(usage
      ? {
          usage: {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens: usage.totalTokenCount || 0,
          },
        }
      : {}),
  }
}
