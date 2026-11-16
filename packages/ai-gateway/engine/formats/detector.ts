import { FORMATS, type FormatType } from "./types.js"

/**
 * Detect client wire format based on request pathname and request payload.
 */
export function detectFormat(pathname: string, body?: Record<string, unknown> | null): FormatType {
  const path = pathname.toLowerCase()

  // Route-based detection
  if (path.includes("/v1/messages")) {
    return FORMATS.CLAUDE
  }
  if (path.includes("/v1/responses")) {
    return FORMATS.RESPONSES
  }
  if (
    path.includes(":generatecontent") ||
    path.includes(":streamgeneratecontent") ||
    path.includes("/v1beta/models")
  ) {
    return FORMATS.GEMINI
  }
  if (path.includes("/api/chat") || path.includes("/api/generate")) {
    return FORMATS.OLLAMA
  }
  if (path.includes("/v1/chat/completions")) {
    return FORMATS.OPENAI
  }

  // Body-based fallback detection
  if (body && typeof body === "object") {
    if (Array.isArray(body.contents)) {
      return FORMATS.GEMINI
    }
    if (Array.isArray(body.input) && !body.messages) {
      return FORMATS.RESPONSES
    }
    if (body.prompt && !body.messages) {
      return FORMATS.OLLAMA
    }
    if (Array.isArray(body.messages)) {
      // Check if messages have Claude-style content blocks
      const firstMsg = body.messages[0] as Record<string, unknown> | undefined
      if (firstMsg && Array.isArray(firstMsg.content)) {
        const firstPart = firstMsg.content[0] as Record<string, unknown> | undefined
        if (firstPart && (firstPart.type === "tool_use" || firstPart.type === "tool_result")) {
          return FORMATS.CLAUDE
        }
      }
      return FORMATS.OPENAI
    }
  }

  return FORMATS.OPENAI
}
