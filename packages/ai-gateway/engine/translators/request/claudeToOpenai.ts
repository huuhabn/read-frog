import type {
  ClaudeRequest,
  OpenAIChatRequest,
  OpenAIMessage,
  ToolCall,
} from "../../formats/types.js"

export function claudeToOpenaiRequest(claude: ClaudeRequest): OpenAIChatRequest {
  const messages: OpenAIMessage[] = []

  // Extract top-level system prompt
  if (claude.system) {
    const systemText = Array.isArray(claude.system)
      ? claude.system.map((s) => s.text).join("\n\n")
      : claude.system
    // Request bodies are client JSON, so the declared type is not guaranteed.
    if (typeof systemText === "string" && systemText.trim()) {
      messages.push({
        role: "system",
        content: systemText,
      })
    }
  }

  // Convert Claude messages
  for (const msg of claude.messages || []) {
    if (typeof msg.content === "string") {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
      continue
    }

    if (Array.isArray(msg.content)) {
      const textParts: string[] = []
      const toolCalls: ToolCall[] = []

      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text)
        } else if (part.type === "tool_use") {
          toolCalls.push({
            id: part.id,
            type: "function",
            function: {
              name: part.name,
              arguments:
                typeof part.input === "string" ? part.input : JSON.stringify(part.input || {}),
            },
          })
        } else if (part.type === "tool_result") {
          const contentStr =
            typeof part.content === "string" ? part.content : JSON.stringify(part.content)
          messages.push({
            role: "tool",
            tool_call_id: part.tool_use_id,
            content: contentStr,
          })
        } else if (part.type === "image") {
          messages.push({
            role: msg.role,
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${part.source.media_type};base64,${part.source.data}`,
                },
              },
            ],
          })
        }
      }

      if (textParts.length > 0 || toolCalls.length > 0) {
        messages.push({
          role: msg.role,
          content: textParts.length > 0 ? textParts.join("\n") : null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        })
      }
    }
  }

  // Convert tools
  const tools = claude.tools?.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }))

  const openai: OpenAIChatRequest = {
    model: claude.model,
    messages,
    stream: claude.stream ?? false,
    max_tokens: claude.max_tokens,
    temperature: claude.temperature,
    top_p: claude.top_p,
    ...(tools && tools.length > 0 ? { tools } : {}),
  }

  return openai
}
