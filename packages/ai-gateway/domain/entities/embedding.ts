export interface EmbeddingRequest {
  model: string
  input: string | string[]
  encoding_format?: "float" | "base64"
  dimensions?: number
  user?: string
  [key: string]: unknown
}

export interface EmbeddingItem {
  object: "embedding"
  index: number
  embedding: number[]
}

export interface EmbeddingResponse {
  object: "list"
  data: EmbeddingItem[]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}
