import { describe, expect, it } from "vitest"
import { openSqliteGatewayDatabase } from "./client.js"
import { createSqliteGatewayStore } from "./sqliteRepos.js"

describe("SQLite gateway store", () => {
  it("persists a tenant and lists seeded models", async () => {
    const store = createSqliteGatewayStore(openSqliteGatewayDatabase({ path: ":memory:" }))
    await store.tenantRepo.saveTenant({
      id: "t1",
      name: "Acme",
      slug: "acme",
      status: "active",
      credentialMode: "hybrid",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(await store.tenantRepo.getById("t1")).toMatchObject({ slug: "acme" })
    const models = await store.modelRepo.listModels()
    expect(models.some((model) => model.id === "gpt-4o")).toBe(true)
  })
})
