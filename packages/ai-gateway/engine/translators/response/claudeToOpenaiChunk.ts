import type { OpenAIChatChunk, TranslationState } from "../../formats/types.js"

/**
 * Translates an Anthropic Claude streaming event object into an OpenAI Chat Completion chunk.
 */
export function claudeToOpenaiChunk(
  event: Record<string, unknown>,
  state: TranslationState,
): OpenAIChatChunk | null {
  const type = event.type as string

  if (type === "message_start") {
    const msg = (event.message as Record<string, unknown>) || {}
    state.id = (msg.id as string) || `chatcmpl-${Date.now()}`
    state.model = (msg.model as string) || "claude"
    state.created = Math.floor(Date.now() / 1000)
    state.toolCallMap = new Map()
    state.roleSent = true

    // Send the first chunk with role: "assistant"
    return {
      id: state.id,
      object: "chat.completion.chunk",
      created: state.created,
      model: state.model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "" },
          finish_reason: null,
        },
      ],
    }
  }

  if (type === "content_block_start") {
    const block = (event.content_block as Record<string, unknown>) || {}
    const index = (event.index as number) ?? 0

    if (block.type === "tool_use") {
      state.activeToolIndex = index
      state.toolCallMap?.set(index, { id: block.id as string, name: block.name as string })

      return {
        id: (state.id as string) || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: (state.created as number) || Math.floor(Date.now() / 1000),
        model: (state.model as string) || "claude",
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index,
                  id: block.id as string,
                  type: "function",
                  function: {
                    name: block.name as string,
                    arguments: "",
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }
    }
    return null
  }

  if (type === "content_block_delta") {
    const delta = (event.delta as Record<string, unknown>) || {}

    if (delta.type === "text_delta") {
      return {
        id: (state.id as string) || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: (state.created as number) || Math.floor(Date.now() / 1000),
        model: (state.model as string) || "claude",
        choices: [
          {
            index: 0,
            delta: { content: delta.text as string },
            finish_reason: null,
          },
        ],
      }
    }

    if (delta.type === "thinking_delta") {
      return {
        id: (state.id as string) || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: (state.created as number) || Math.floor(Date.now() / 1000),
        model: (state.model as string) || "claude",
        choices: [
          {
            index: 0,
            delta: { reasoning_content: delta.thinking as string },
            finish_reason: null,
          },
        ],
      }
    }

    if (delta.type === "input_json_delta") {
      const index = (event.index as number) ?? state.activeToolIndex ?? 0
      return {
        id: (state.id as string) || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: (state.created as number) || Math.floor(Date.now() / 1000),
        model: (state.model as string) || "claude",
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index,
                  function: {
                    arguments: delta.partial_json as string,
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }
    }
  }

  if (type === "message_delta") {
    const delta = (event.delta as Record<string, unknown>) || {}
    let finishReason: string | null = null

    if (delta.stop_reason === "end_turn") finishReason = "stop"
    else if (delta.stop_reason === "tool_use") finishReason = "tool_calls"
    else if (delta.stop_reason === "max_tokens") finishReason = "length"

    const usage = (event.usage as Record<string, number>) || {}

    return {
      id: (state.id as string) || `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: (state.created as number) || Math.floor(Date.now() / 1000),
      model: (state.model as string) || "claude",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: finishReason,
        },
      ],
      ...(usage.output_tokens
        ? {
            usage: {
              prompt_tokens: (state.promptTokens as number) || 0,
              completion_tokens: usage.output_tokens,
              total_tokens: ((state.promptTokens as number) || 0) + usage.output_tokens,
            },
          }
        : {}),
    }
  }

  return null
}
