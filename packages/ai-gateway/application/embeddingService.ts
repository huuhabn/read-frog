import type { EmbeddingRequest, EmbeddingResponse } from "../domain/entities/embedding.js"
import type { Tenant, Application } from "../domain/entities/tenant.js"
import type { CredentialResolver } from "./credentialResolver.js"
import { ValidationError, UpstreamError } from "../domain/errors.js"

export interface ExecuteEmbeddingOptions {
  body: EmbeddingRequest
  tenant?: Tenant | null
  application?: Application | null
  apiKeyId?: string
  clientSignal?: AbortSignal
}

export class EmbeddingService {
  constructor(private credentialResolver: CredentialResolver) {}

  public parseModel(rawModel: string): { provider: string; model: string } {
    if (rawModel.includes("/")) {
      const [p = "", ...rest] = rawModel.split("/")
      return { provider: p.toLowerCase(), model: rest.join("/") }
    }
    const lower = rawModel.toLowerCase()
    if (lower.startsWith("text-embedding-004") || lower.includes("gemini")) {
      return { provider: "gemini", model: rawModel }
    }
    if (lower.includes("nomic") || lower.includes("bge-") || lower.includes("all-minilm")) {
      return { provider: "ollama", model: rawModel }
    }
    return { provider: "openai", model: rawModel }
  }

  public async execute(options: ExecuteEmbeddingOptions): Promise<EmbeddingResponse> {
    const { body, tenant } = options

    if (!body.input) {
      throw new ValidationError("Missing required field: input")
    }
    if (typeof body.input !== "string" && !Array.isArray(body.input)) {
      throw new ValidationError("Field 'input' must be a string or array of strings")
    }

    const { provider, model } = this.parseModel(body.model || "text-embedding-3-small")
    const credential = await this.credentialResolver.resolve(provider, tenant)

    const inputs = Array.isArray(body.input) ? body.input : [body.input]

    // 1. Google Gemini Embeddings
    if (provider === "gemini") {
      const baseUrl = (
        credential.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
      ).replace(/\/+$/, "")
      const url = `${baseUrl}/models/${model}:batchEmbedContents`

      const geminiBody = {
        requests: inputs.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: body.dimensions,
        })),
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": credential.apiKey,
        },
        body: JSON.stringify(geminiBody),
        signal: options.clientSignal,
      })

      if (!resp.ok) {
        const errText = await resp.text()
        throw new UpstreamError("gemini", resp.status, errText)
      }

      const json = await resp.json()
      const embeddings = (json.embeddings || []).map((e: any, idx: number) => ({
        object: "embedding" as const,
        index: idx,
        embedding: e.values || [],
      }))

      const estimatedTokens = inputs.reduce((acc, str) => acc + Math.ceil(str.length / 4), 0)

      return {
        object: "list",
        data: embeddings,
        model,
        usage: {
          prompt_tokens: estimatedTokens,
          total_tokens: estimatedTokens,
        },
      }
    }

    // 2. Default: OpenAI-compatible endpoint
    const baseUrl = (credential.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")
    const cleanUrl = baseUrl.endsWith("/embeddings") ? baseUrl : `${baseUrl}/embeddings`

    const resp = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential.apiKey}`,
        ...(credential.organizationId ? { "OpenAI-Organization": credential.organizationId } : {}),
      },
      body: JSON.stringify({
        input: body.input,
        model,
        dimensions: body.dimensions,
        encoding_format: body.encoding_format || "float",
      }),
      signal: options.clientSignal,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new UpstreamError(provider, resp.status, errText)
    }

    const data = await resp.json()
    return data as EmbeddingResponse
  }
}
