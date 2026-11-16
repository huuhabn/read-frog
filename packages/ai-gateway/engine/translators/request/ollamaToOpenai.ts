import type { OpenAIChatRequest, OpenAIMessage } from "../../formats/types.js"

export function ollamaToOpenaiRequest(body: Record<string, unknown>): OpenAIChatRequest {
  const messages: OpenAIMessage[] = []

  if (body.system && typeof body.system === "string") {
    messages.push({ role: "system", content: body.system })
  }

  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (msg && typeof msg === "object") {
        messages.push({
          role: (msg.role as OpenAIMessage["role"]) || "user",
          content: (msg.content as string) || "",
        })
      }
    }
  } else if (typeof body.prompt === "string") {
    messages.push({ role: "user", content: body.prompt })
  }

  const options = (body.options as Record<string, unknown>) || {}

  return {
    model: (body.model as string) || "llama3",
    messages,
    stream: body.stream !== false,
    temperature: typeof options.temperature === "number" ? options.temperature : undefined,
    max_tokens: typeof options.num_predict === "number" ? options.num_predict : undefined,
    top_p: typeof options.top_p === "number" ? options.top_p : undefined,
  }
}
