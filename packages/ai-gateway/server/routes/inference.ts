import type { EmbeddingService } from "../../application/embeddingService.js"
import type { InferenceService } from "../../application/inferenceService.js"
import type { ChatOrchestrator } from "../../pipeline/chatOrchestrator.js"
import { Hono } from "hono"
import { detectFormat } from "../../engine/formats/detector.js"
import { FORMATS, type FormatType } from "../../engine/formats/types.js"

export function createInferenceRoutes(
  inferenceService: InferenceService,
  embeddingService?: EmbeddingService,
  orchestrator?: ChatOrchestrator,
) {
  const router = new Hono()

  // Helper handler for all inference formats
  const handleInference = async (c: any, defaultFormat: FormatType = FORMATS.OPENAI) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        { error: { message: "Invalid JSON request body", type: "invalid_request_error" } },
        400,
      )
    }

    const detectedFormat = detectFormat(c.req.path, body) || defaultFormat
    const model = (body.model as string) || (c.req.param("model") as string) || "gpt-4o"
    const tenant = c.get("tenant")
    const application = c.get("application")
    const apiKeyId = c.get("apiKeyId")

    const rtkHeader = c.req.header("x-rtk-enabled")
    const conciseHeader = c.req.header("x-concise-prompt")

    const result = await inferenceService.execute({
      sourceFormat: detectedFormat,
      model,
      body,
      tenant,
      application,
      apiKeyId,
      clientSignal: c.req.raw.signal,
      rtkOptions: {
        enabled: rtkHeader === "true" || rtkHeader === "1",
        concisePrompt: conciseHeader === "true" || conciseHeader === "1",
      },
    })

    if (result.isStream) {
      return new Response(result.stream, {
        status: result.statusCode,
        headers: result.headers,
      })
    }

    return c.json(result.data, result.statusCode as any)
  }

  // 1. OpenAI Chat Completions endpoint
  router.post("/v1/chat/completions", (c) => handleInference(c, FORMATS.OPENAI))

  // 2. Anthropic Claude Messages endpoint
  router.post("/v1/messages", (c) => handleInference(c, FORMATS.CLAUDE))

  // 3. Codex Responses API endpoint
  router.post("/v1/responses", (c) => handleInference(c, FORMATS.RESPONSES))

  // 4. Google Gemini endpoint: /v1beta/models/:model:streamGenerateContent
  router.post("/v1beta/models/:modelAndAction", async (c) => {
    const param = c.req.param("modelAndAction") || ""
    const [model] = param.split(":")
    let body = {}
    try {
      body = await c.req.json()
    } catch {
      /* ignore */
    }
    ;(body as any).model = model
    return handleInference(c, FORMATS.GEMINI)
  })

  // 5. Ollama compatibility endpoints
  router.post("/api/chat", (c) => handleInference(c, FORMATS.OLLAMA))
  router.post("/api/generate", (c) => handleInference(c, FORMATS.OLLAMA))

  // 6. Embeddings endpoint
  router.post("/v1/embeddings", async (c: any) => {
    if (!embeddingService) {
      return c.json(
        { error: { message: "Embedding service is not configured", type: "api_error" } },
        501,
      )
    }
    const body = await c.req.json()
    const tenant = c.get("tenant")
    const application = c.get("application")
    const apiKeyId = c.get("apiKeyId")

    const result = await embeddingService.execute({
      body,
      tenant,
      application,
      apiKeyId,
      clientSignal: c.req.raw.signal,
    })

    return c.json(result)
  })

  // 7. Prompt Pipeline & Chat Orchestrator endpoint (10-step lifecycle)
  router.post("/v1/chat/pipeline", async (c: any) => {
    if (!orchestrator) {
      return c.json(
        { error: { message: "Chat orchestrator is not configured", type: "api_error" } },
        501,
      )
    }
    let body: any
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        { error: { message: "Invalid JSON request body", type: "invalid_request_error" } },
        400,
      )
    }

    const text = body.text || ""
    if (!text) {
      return c.json(
        { error: { message: "Field 'text' is required", type: "invalid_request_error" } },
        400,
      )
    }

    const tenant = c.get("tenant")
    const result = await orchestrator.send(text, {
      conversationId: body.conversationId,
      target: body.target || body.model,
      params: body.params,
      styleProfile: body.styleProfile,
      styleOverride: body.styleOverride,
      history: body.history,
      glossary: body.glossary,
      bypassCache: Boolean(body.bypassCache),
      ttlMs: body.ttlMs,
      stream: Boolean(body.stream),
      tenantId: tenant?.id,
      signal: c.req.raw.signal,
    })

    if (result.stream) {
      return new Response(result.stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    return c.json(result)
  })

  return router
}
