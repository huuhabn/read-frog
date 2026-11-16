import type { OpenAIMessage } from "../formats/types.js"

export interface PromptInjectionOptions {
  concisePrompt?: boolean
  customSystemPrompt?: string
}

export function injectSystemPrompt(
  messages: OpenAIMessage[],
  options: PromptInjectionOptions,
): void {
  const parts: string[] = []

  if (options.concisePrompt) {
    parts.push(
      "Be concise. Avoid pleasantries, fluff, and filler words. Answer directly and precisely.",
    )
  }
  if (options.customSystemPrompt) {
    parts.push(options.customSystemPrompt)
  }

  if (parts.length === 0) return
  const injection = parts.join("\n\n")

  const existing = messages.find((m) => m.role === "system")
  if (existing) {
    const prevContent = typeof existing.content === "string" ? existing.content : ""
    existing.content = `${prevContent}\n\n${injection}`.trim()
  } else {
    messages.unshift({
      role: "system",
      content: injection,
    })
  }
}
