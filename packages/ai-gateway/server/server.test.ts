import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createGatewayApp } from "./app.js"

describe("Gateway HTTP Server (Hono)", () => {
  beforeEach(() => {
    vi.stubEnv("GATEWAY_ENCRYPTION_KEY", "test-encryption-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("should respond to health check", async () => {
    const { app } = createGatewayApp()
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("ok")
    expect(json.service).toBe("ai-gateway-standalone")
  })

  it("should list available models on /v1/models", async () => {
    const { app } = createGatewayApp()
    const res = await app.request("/v1/models")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.object).toBe("list")
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    expect(json.data.some((m: any) => m.id === "gpt-4o")).toBe(true)
  })

  it("should register a tenant and add a masked BYOK credential", async () => {
    const { app } = createGatewayApp()

    // 1. Create Tenant
    const tenantRes = await app.request("/v1/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "tenant-test-1",
        name: "Test Tenant",
        slug: "test-tenant",
        credentialMode: "byok",
      }),
    })
    expect(tenantRes.status).toBe(201)
    const tenantJson = await tenantRes.json()
    expect(tenantJson.tenant.id).toBe("tenant-test-1")

    // 2. Add BYOK Credential
    const credRes = await app.request("/v1/tenant/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant-test-1",
        provider: "openai",
        apiKey: "sk-proj-1234567890abcdef",
        label: "My OpenAI Key",
      }),
    })
    expect(credRes.status).toBe(201)
    const credJson = await credRes.json()
    expect(credJson.success).toBe(true)
    // Crucial security requirement: Raw secret must NEVER be returned!
    expect(credJson.credential.maskedSecret).toBe("sk-p...cdef")
    expect(credJson.credential.apiKey).toBeUndefined()
    expect(credJson.credential.encryptedSecret).toBeUndefined()
  })

  it("should record and list audit logs for administrative and credential actions", async () => {
    const { app } = createGatewayApp()

    // 1. Create a tenant
    await app.request("/v1/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "tenant-audit-test",
        name: "Audit Test Org",
        slug: "audit-org",
      }),
    })

    // 2. Add BYOK credential
    await app.request("/v1/tenant/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant-audit-test",
        provider: "anthropic",
        apiKey: "sk-ant-test-key-123456",
      }),
    })

    // 3. Query Admin Audit Logs
    const adminLogsRes = await app.request("/v1/admin/audit-logs")
    expect(adminLogsRes.status).toBe(200)
    const adminLogs = await adminLogsRes.json()
    expect(adminLogs.total).toBeGreaterThanOrEqual(2)
    expect(adminLogs.items.some((l: any) => l.action === "tenant.create")).toBe(true)
    expect(adminLogs.items.some((l: any) => l.action === "credential.create")).toBe(true)

    // 4. Query Tenant Audit Logs
    const tenantLogsRes = await app.request("/v1/tenant/audit-logs?tenantId=tenant-audit-test")
    expect(tenantLogsRes.status).toBe(200)
    const tenantLogs = await tenantLogsRes.json()
    expect(tenantLogs.items.every((l: any) => l.tenantId === "tenant-audit-test")).toBe(true)
  })

  it("should handle /v1/chat/pipeline with caching and normalizer", async () => {
    const { app, inferenceService } = createGatewayApp()

    vi.spyOn(inferenceService, "execute").mockResolvedValue({
      isStream: false,
      statusCode: 200,
      headers: {},
      data: {
        choices: [
          {
            message: {
              content: "<think>thinking...</think>Xin chào thế giới!",
            },
          },
        ],
      },
      usage: { promptTokens: 5, completionTokens: 4, totalTokens: 9 },
    })

    // 1st request: Cache Miss
    const res1 = await app.request("/v1/chat/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Hello world!",
        target: "openai/gpt-4o",
        styleProfile: {
          targetLanguage: "Vietnamese",
        },
      }),
    })
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.cached).toBe(false)
    expect(json1.text).toBe("Xin chào thế giới!")

    // 2nd request: Cache Hit
    const res2 = await app.request("/v1/chat/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Hello world!",
        target: "openai/gpt-4o",
        styleProfile: {
          targetLanguage: "Vietnamese",
        },
      }),
    })
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.cached).toBe(true)
    expect(json2.text).toBe("Xin chào thế giới!")
  })
})
