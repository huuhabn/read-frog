export const FORMATS = {
  OPENAI: "openai",
  CLAUDE: "claude",
  GEMINI: "gemini",
  RESPONSES: "openai-responses",
  OLLAMA: "ollama",
} as const

export type FormatType = (typeof FORMATS)[keyof typeof FORMATS]

export type Role = "system" | "user" | "assistant" | "tool"

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface ContentPartText {
  type: "text"
  text: string
}

export interface ContentPartImage {
  type: "image_url"
  image_url: {
    url: string
    detail?: string
  }
}

export type ContentPart = ContentPartText | ContentPartImage

export interface OpenAIMessage {
  role: Role
  content: string | ContentPart[] | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  reasoning_content?: string
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  max_completion_tokens?: number
  tools?: Array<{
    type: "function"
    function: {
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }
  }>
  tool_choice?: unknown
  stop?: string | string[]
  [key: string]: unknown
}

export interface OpenAIChatChunk {
  id: string
  object: "chat.completion.chunk"
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: Role
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: "function"
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
}

export interface ClaudeMessage {
  role: "user" | "assistant"
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        | {
            type: "tool_result"
            tool_use_id: string
            content: string | unknown[]
            is_error?: boolean
          }
      >
}

export interface ClaudeRequest {
  model: string
  messages: ClaudeMessage[]
  system?: string | Array<{ type: "text"; text: string }>
  max_tokens: number
  stream?: boolean
  temperature?: number
  top_p?: number
  tools?: Array<{
    name: string
    description?: string
    input_schema: Record<string, unknown>
  }>
  [key: string]: unknown
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

export interface GeminiContent {
  role: "user" | "model"
  parts: GeminiPart[]
}

export interface GeminiRequest {
  contents: GeminiContent[]
  systemInstruction?: { parts: Array<{ text: string }> }
  generationConfig?: {
    temperature?: number
    topP?: number
    maxOutputTokens?: number
    stopSequences?: string[]
  }
  tools?: Array<{
    functionDeclarations?: Array<{
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }>
  }>
  [key: string]: unknown
}

export interface TranslationState {
  id?: string
  model?: string
  created?: number
  roleSent?: boolean
  toolCallMap?: Map<number, { id: string; name: string }>
  toolCallIdMap?: Map<string, number>
  activeToolIndex?: number
  thinkingSent?: boolean
  thinkingBuffer?: string
  [key: string]: unknown
}
