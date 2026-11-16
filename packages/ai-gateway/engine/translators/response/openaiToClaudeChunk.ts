import type { OpenAIChatChunk, TranslationState } from "../../formats/types.js"

export interface ClaudeSseEvent {
  event: string
  data: Record<string, unknown>
}

export function openaiToClaudeEvents(
  chunk: OpenAIChatChunk,
  state: TranslationState,
): ClaudeSseEvent[] {
  const events: ClaudeSseEvent[] = []

  // If first chunk, send message_start
  if (!state.roleSent) {
    state.roleSent = true
    state.id = chunk.id || `msg_${Date.now()}`
    state.model = chunk.model || "claude"

    events.push({
      event: "message_start",
      data: {
        type: "message_start",
        message: {
          id: state.id,
          type: "message",
          role: "assistant",
          model: state.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      },
    })
  }

  const choice = chunk.choices?.[0]
  if (!choice) return events

  // Handle thinking / reasoning delta
  if (choice.delta?.reasoning_content) {
    if (!state.thinkingSent) {
      state.thinkingSent = true
      events.push({
        event: "content_block_start",
        data: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
      })
    }
    events.push({
      event: "content_block_delta",
      data: {
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: choice.delta.reasoning_content },
      },
    })
  }

  // Handle text delta
  if (choice.delta?.content) {
    if (!state.contentBlockStarted) {
      state.contentBlockStarted = true
      events.push({
        event: "content_block_start",
        data: {
          type: "content_block_start",
          index: state.thinkingSent ? 1 : 0,
          content_block: { type: "text", text: "" },
        },
      })
    }

    events.push({
      event: "content_block_delta",
      data: {
        type: "content_block_delta",
        index: state.thinkingSent ? 1 : 0,
        delta: { type: "text_delta", text: choice.delta.content },
      },
    })
  }

  // Handle finish reason
  if (choice.finish_reason) {
    let stopReason = "end_turn"
    if (choice.finish_reason === "tool_calls") stopReason = "tool_use"
    else if (choice.finish_reason === "length") stopReason = "max_tokens"

    if (state.contentBlockStarted) {
      events.push({
        event: "content_block_stop",
        data: {
          type: "content_block_stop",
          index: state.thinkingSent ? 1 : 0,
        },
      })
    }

    events.push({
      event: "message_delta",
      data: {
        type: "message_delta",
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: chunk.usage?.completion_tokens || 1 },
      },
    })

    events.push({
      event: "message_stop",
      data: { type: "message_stop" },
    })
  }

  return events
}
