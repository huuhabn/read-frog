import type { OpenAIChatRequest, ClaudeRequest, ClaudeMessage } from "../../formats/types.js"

export function openaiToClaudeRequest(openai: OpenAIChatRequest): ClaudeRequest {
  const systemParts: string[] = []
  const claudeMessages: ClaudeMessage[] = []

  for (const msg of openai.messages || []) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
      if (text.trim()) systemParts.push(text)
      continue
    }

    if (msg.role === "tool") {
      claudeMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "call_unknown",
            content:
              typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? ""),
          },
        ],
      })
      continue
    }

    if (msg.role === "assistant") {
      const contentParts: ClaudeMessage["content"] = []
      if (typeof msg.content === "string" && msg.content) {
        contentParts.push({ type: "text", text: msg.content })
      }

      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          let parsedInput: Record<string, unknown>
          try {
            parsedInput = JSON.parse(tc.function.arguments || "{}")
          } catch {
            parsedInput = { raw: tc.function.arguments }
          }

          contentParts.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: parsedInput,
          })
        }
      }

      claudeMessages.push({
        role: "assistant",
        content: contentParts.length > 0 ? contentParts : (msg.content as string) || "",
      })
      continue
    }

    // Role is "user"
    if (typeof msg.content === "string") {
      claudeMessages.push({
        role: "user",
        content: msg.content,
      })
    } else if (Array.isArray(msg.content)) {
      const parts: ClaudeMessage["content"] = []
      for (const p of msg.content) {
        if (p.type === "text") {
          parts.push({ type: "text", text: p.text })
        } else if (p.type === "image_url") {
          const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
          const [, mediaType, data] = match ?? []
          if (mediaType !== undefined && data !== undefined) {
            parts.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data,
              },
            })
          }
        }
      }
      claudeMessages.push({ role: "user", content: parts })
    }
  }

  // Ensure turns alternate and merge adjacent same-role turns if needed
  const mergedMessages: ClaudeMessage[] = []
  for (const m of claudeMessages) {
    const prev = mergedMessages[mergedMessages.length - 1]
    if (prev && prev.role === m.role) {
      const prevContent = Array.isArray(prev.content)
        ? prev.content
        : [{ type: "text" as const, text: prev.content }]
      const nextContent = Array.isArray(m.content)
        ? m.content
        : [{ type: "text" as const, text: m.content }]
      prev.content = [...prevContent, ...nextContent] as unknown as string
    } else {
      mergedMessages.push(m)
    }
  }

  // Claude requires max_tokens
  const maxTokens = openai.max_tokens || openai.max_completion_tokens || 4096

  // Tools
  const tools = openai.tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }))

  return {
    model: openai.model,
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: mergedMessages,
    max_tokens: maxTokens,
    stream: openai.stream ?? false,
    temperature: openai.temperature,
    top_p: openai.top_p,
    ...(tools && tools.length > 0 ? { tools } : {}),
  }
}
