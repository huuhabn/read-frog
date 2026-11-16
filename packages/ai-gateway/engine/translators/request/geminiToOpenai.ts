import type {
  GeminiRequest,
  OpenAIChatRequest,
  OpenAIMessage,
  ToolCall,
} from "../../formats/types.js"

export function geminiToOpenaiRequest(
  gemini: GeminiRequest,
  model = "gemini-1.5-pro",
): OpenAIChatRequest {
  const messages: OpenAIMessage[] = []

  // System instruction
  if (gemini.systemInstruction?.parts) {
    const sysText = gemini.systemInstruction.parts
      .map((p) => p.text || "")
      .filter(Boolean)
      .join("\n\n")
    if (sysText) {
      messages.push({ role: "system", content: sysText })
    }
  }

  // Contents
  for (const content of gemini.contents || []) {
    const role = content.role === "model" ? "assistant" : "user"
    const textParts: string[] = []
    const toolCalls: ToolCall[] = []

    for (const part of content.parts || []) {
      if (part.text) {
        textParts.push(part.text)
      } else if (part.functionCall) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        })
      } else if (part.functionResponse) {
        messages.push({
          role: "tool",
          name: part.functionResponse.name,
          tool_call_id: `call_${part.functionResponse.name}`,
          content: JSON.stringify(part.functionResponse.response || {}),
        })
      }
    }

    if (textParts.length > 0 || toolCalls.length > 0) {
      messages.push({
        role,
        content: textParts.length > 0 ? textParts.join("\n") : null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })
    }
  }

  // Tools
  const tools: OpenAIChatRequest["tools"] = []
  if (Array.isArray(gemini.tools)) {
    for (const toolGroup of gemini.tools) {
      if (Array.isArray(toolGroup.functionDeclarations)) {
        for (const fn of toolGroup.functionDeclarations) {
          tools.push({
            type: "function",
            function: {
              name: fn.name,
              description: fn.description,
              parameters: fn.parameters,
            },
          })
        }
      }
    }
  }

  return {
    model,
    messages,
    temperature: gemini.generationConfig?.temperature,
    top_p: gemini.generationConfig?.topP,
    max_tokens: gemini.generationConfig?.maxOutputTokens,
    stop: gemini.generationConfig?.stopSequences,
    ...(tools.length > 0 ? { tools } : {}),
  }
}
