import type {
  OpenAIChatRequest,
  GeminiRequest,
  GeminiContent,
  GeminiPart,
} from "../../formats/types.js"

export function openaiToGeminiRequest(openai: OpenAIChatRequest): GeminiRequest {
  const contents: GeminiContent[] = []
  let systemInstruction: GeminiRequest["systemInstruction"] | undefined

  for (const msg of openai.messages || []) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
      systemInstruction = { parts: [{ text }] }
      continue
    }

    if (msg.role === "tool") {
      let parsed: Record<string, unknown>
      try {
        parsed =
          typeof msg.content === "string"
            ? JSON.parse(msg.content)
            : (msg.content as unknown as Record<string, unknown>)
      } catch {
        parsed = { output: msg.content }
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name || msg.tool_call_id || "function_response",
              response: parsed,
            },
          },
        ],
      })
      continue
    }

    const role = msg.role === "assistant" ? "model" : "user"
    const parts: GeminiPart[] = []

    if (typeof msg.content === "string" && msg.content) {
      parts.push({ text: msg.content })
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ text: part.text })
        } else if (part.type === "image_url") {
          const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
          const [, mimeType, data] = match ?? []
          if (mimeType !== undefined && data !== undefined) {
            parts.push({
              inlineData: {
                mimeType,
                data,
              },
            })
          }
        }
      }
    }

    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown>
        try {
          args = JSON.parse(tc.function.arguments || "{}")
        } catch {
          args = { raw: tc.function.arguments }
        }
        parts.push({
          functionCall: {
            name: tc.function.name,
            args,
          },
        })
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts })
    }
  }

  // Tools
  const functionDeclarations = openai.tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }))

  return {
    contents,
    systemInstruction,
    generationConfig: {
      temperature: openai.temperature,
      topP: openai.top_p,
      maxOutputTokens: openai.max_tokens || openai.max_completion_tokens,
      stopSequences: typeof openai.stop === "string" ? [openai.stop] : openai.stop,
    },
    ...(functionDeclarations && functionDeclarations.length > 0
      ? { tools: [{ functionDeclarations }] }
      : {}),
  }
}
