import type { OpenAIChatRequest, OpenAIMessage } from "../../formats/types.js"

export function responsesToOpenaiRequest(body: Record<string, unknown>): OpenAIChatRequest {
  const messages: OpenAIMessage[] = []

  if (body.instructions && typeof body.instructions === "string") {
    messages.push({
      role: "system",
      content: body.instructions,
    })
  }

  if (Array.isArray(body.input)) {
    for (const item of body.input) {
      if (typeof item === "string") {
        messages.push({ role: "user", content: item })
      } else if (item && typeof item === "object") {
        const role = (item.role as OpenAIMessage["role"]) || "user"
        messages.push({
          role,
          content: (item.content as string) || (item.text as string) || "",
        })
      }
    }
  } else if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input })
  }

  return {
    model: (body.model as string) || "gpt-4o",
    messages,
    stream: Boolean(body.stream),
    temperature: typeof body.temperature === "number" ? body.temperature : undefined,
    max_tokens: typeof body.max_output_tokens === "number" ? body.max_output_tokens : undefined,
  }
}
