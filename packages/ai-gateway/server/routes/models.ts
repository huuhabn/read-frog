import type { ModelRepository } from "../../domain/ports/repositories.js"
import { Hono } from "hono"

export function createModelRoutes(modelRepo: ModelRepository) {
  const router = new Hono()

  router.get("/v1/models", async (c) => {
    const models = await modelRepo.listModels({ isEnabled: true })

    // OpenAI standard format: { object: "list", data: [...] }
    return c.json({
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: 1700000000,
        owned_by: m.provider,
        permission: [],
        root: m.id,
        parent: null,
      })),
    })
  })

  return router
}
