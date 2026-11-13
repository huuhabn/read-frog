import type { AuditLogItem } from "@/utils/db/dexie/tables/audit-log"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanupLegacyAuditLogs,
  clearAllAuditLogs,
  deleteAuditLog,
  pruneAuditLogs,
  queryAuditLogs,
  recordAuditLog,
} from "../audit-log-service"

const mockState = vi.hoisted(() => ({
  logs: [] as AuditLogItem[],
  config: {
    auditLog: {
      enabled: true,
      retentionDays: 30,
      maxLogs: 1000,
    },
  },
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi
    .fn<() => Promise<typeof mockState.config>>()
    .mockImplementation(async () => mockState.config),
}))

vi.mock("@/utils/db/dexie/db", () => {
  const dbMock = {
    auditLog: {
      add: vi.fn<(item: AuditLogItem) => Promise<string>>().mockImplementation(async (item) => {
        mockState.logs.push(item)
        return item.id
      }),
      delete: vi.fn<(id: string) => Promise<void>>().mockImplementation(async (id) => {
        mockState.logs = mockState.logs.filter((l) => l.id !== id)
      }),
      clear: vi.fn<() => Promise<void>>().mockImplementation(async () => {
        mockState.logs = []
      }),
      toArray: vi
        .fn<() => Promise<AuditLogItem[]>>()
        .mockImplementation(async () => [...mockState.logs]),
      count: vi.fn<() => Promise<number>>().mockImplementation(async () => mockState.logs.length),
      bulkDelete: vi.fn<(ids: string[]) => Promise<void>>().mockImplementation(async (ids) => {
        const idSet = new Set(ids)
        mockState.logs = mockState.logs.filter((l) => !idSet.has(l.id))
      }),
      where: vi
        .fn<(index: string) => { below: (date: Date) => { delete: () => Promise<number> } }>()
        .mockImplementation((index) => ({
          below: (date: Date) => ({
            delete: async () => {
              const beforeCount = mockState.logs.length
              if (index === "createdAt") {
                mockState.logs = mockState.logs.filter((l) => l.createdAt >= date)
              }
              return beforeCount - mockState.logs.length
            },
          }),
        })),
      orderBy: vi
        .fn<
          (_index: string) => {
            reverse: () => { toArray: () => Promise<AuditLogItem[]> }
            limit: (n: number) => { primaryKeys: () => Promise<string[]> }
          }
        >()
        .mockImplementation((_index) => ({
          reverse: () => ({
            toArray: async () =>
              [...mockState.logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          }),
          limit: (n: number) => ({
            primaryKeys: async () =>
              [...mockState.logs]
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .slice(0, n)
                .map((l) => l.id),
          }),
        })),
    },
  }

  return { db: dbMock }
})

describe("audit-log-service", () => {
  beforeEach(() => {
    mockState.logs = []
    mockState.config.auditLog.enabled = true
    mockState.config.auditLog.retentionDays = 30
    mockState.config.auditLog.maxLogs = 1000
  })

  it("does not record log when auditLog is disabled", async () => {
    mockState.config.auditLog.enabled = false
    const id = await recordAuditLog({
      sourceFeature: "Side Panel Chat",
      providerId: "openai",
      providerType: "llm",
      prompt: "Hello",
      latencyMs: 120,
      status: "success",
    })

    expect(id).toBeNull()
    expect(mockState.logs).toHaveLength(0)
  })

  it("records log with generated id and timestamp when enabled", async () => {
    const id = await recordAuditLog({
      sourceFeature: "Side Panel Chat",
      providerId: "openai",
      providerType: "llm",
      model: "gpt-4o",
      prompt: "Explain quantum computing",
      responseOutput: "Quantum computing uses qubits...",
      latencyMs: 450,
      status: "success",
    })

    expect(id).toBeTypeOf("string")
    expect(mockState.logs).toHaveLength(1)
    expect(mockState.logs[0]?.id).toBe(id)
    expect(mockState.logs[0]?.prompt).toBe("Explain quantum computing")
    expect(mockState.logs[0]?.status).toBe("success")
  })

  it("filters logs by query, provider, and status", async () => {
    mockState.logs = [
      {
        id: "1",
        createdAt: new Date("2026-11-01T10:00:00Z"),
        sourceFeature: "Side Panel Chat",
        providerId: "openai",
        providerType: "llm",
        prompt: "Summarize this page",
        responseOutput: "Here is the summary",
        latencyMs: 300,
        status: "success",
      },
      {
        id: "2",
        createdAt: new Date("2026-11-02T10:00:00Z"),
        sourceFeature: "Translation",
        providerId: "google",
        providerType: "translation",
        prompt: "Hello world",
        responseOutput: "Xin chào thế giới",
        latencyMs: 150,
        status: "success",
      },
      {
        id: "3",
        createdAt: new Date("2026-11-03T10:00:00Z"),
        sourceFeature: "Side Panel Write",
        providerId: "claude",
        providerType: "llm",
        prompt: "Fix grammar",
        errorMessage: "Rate limit exceeded",
        latencyMs: 50,
        status: "error",
      },
    ]

    // Search query
    const searchRes = await queryAuditLogs({ searchQuery: "quantum" })
    expect(searchRes.items).toHaveLength(0)

    const searchSummary = await queryAuditLogs({ searchQuery: "summary" })
    expect(searchSummary.items).toHaveLength(1)
    expect(searchSummary.items[0]?.id).toBe("1")

    // Filter by provider
    const googleRes = await queryAuditLogs({ providerId: "google" })
    expect(googleRes.items).toHaveLength(1)
    expect(googleRes.items[0]?.providerId).toBe("google")

    // Filter by status
    const errorRes = await queryAuditLogs({ status: "error" })
    expect(errorRes.items).toHaveLength(1)
    expect(errorRes.items[0]?.id).toBe("3")
  })

  it("deletes single log and clears all logs", async () => {
    mockState.logs = [
      {
        id: "log-1",
        createdAt: new Date(),
        sourceFeature: "Test",
        providerId: "p1",
        providerType: "llm",
        prompt: "test",
        latencyMs: 10,
        status: "success",
      },
      {
        id: "log-2",
        createdAt: new Date(),
        sourceFeature: "Test",
        providerId: "p2",
        providerType: "llm",
        prompt: "test",
        latencyMs: 10,
        status: "success",
      },
    ]

    await deleteAuditLog("log-1")
    expect(mockState.logs).toHaveLength(1)
    expect(mockState.logs[0]?.id).toBe("log-2")

    await clearAllAuditLogs()
    expect(mockState.logs).toHaveLength(0)
  })

  it("prunes logs older than retentionDays and enforces maxLogs", async () => {
    const now = Date.now()
    const oldDate = new Date(now - 35 * 24 * 60 * 60 * 1000) // 35 days ago
    const recentDate = new Date(now - 2 * 24 * 60 * 60 * 1000) // 2 days ago

    mockState.logs = [
      {
        id: "old-1",
        createdAt: oldDate,
        sourceFeature: "Test",
        providerId: "p1",
        providerType: "llm",
        prompt: "old",
        latencyMs: 10,
        status: "success",
      },
      {
        id: "recent-1",
        createdAt: recentDate,
        sourceFeature: "Test",
        providerId: "p2",
        providerType: "llm",
        prompt: "recent 1",
        latencyMs: 10,
        status: "success",
      },
      {
        id: "recent-2",
        createdAt: new Date(),
        sourceFeature: "Test",
        providerId: "p3",
        providerType: "llm",
        prompt: "recent 2",
        latencyMs: 10,
        status: "success",
      },
    ]

    // Prune with 30 days retention, max 1 log
    await pruneAuditLogs(30, 1)

    // Old log should be deleted due to > 30 days, and among recent ones only 1 remains due to maxLogs = 1
    expect(mockState.logs).toHaveLength(1)
    expect(mockState.logs[0]?.id).toBe("recent-2")
  })

  it("records log with structured messages, url, tokenUsage and rawPayload", async () => {
    const id = await recordAuditLog({
      sourceFeature: "Sidepanel Chat",
      url: "https://example.com/article",
      providerId: "openai",
      providerType: "llm",
      model: "gpt-4o",
      prompt: "User question",
      messages: [
        { role: "user", content: "User question" },
        { role: "assistant", content: "AI response" },
      ],
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      latencyMs: 250,
      status: "success",
      rawPayload: { custom: "data" },
    })

    expect(id).toBeDefined()
    expect(mockState.logs).toHaveLength(1)
    expect(mockState.logs[0]?.url).toBe("https://example.com/article")
    expect(mockState.logs[0]?.messages).toHaveLength(2)
    expect(mockState.logs[0]?.tokenUsage?.totalTokens).toBe(30)
    expect(mockState.logs[0]?.rawPayload).toEqual({ custom: "data" })
  })

  it("cleans up legacy audit logs without messages for LLM providers", async () => {
    mockState.logs = [
      {
        id: "legacy-1",
        createdAt: new Date(),
        sourceFeature: "Old Chat",
        providerId: "openai",
        providerType: "llm",
        prompt: "legacy prompt",
        latencyMs: 100,
        status: "success",
      },
      {
        id: "new-1",
        createdAt: new Date(),
        sourceFeature: "New Chat",
        providerId: "openai",
        providerType: "llm",
        prompt: "new prompt",
        messages: [{ role: "user", content: "new prompt" }],
        latencyMs: 100,
        status: "success",
      },
      {
        id: "translation-1",
        createdAt: new Date(),
        sourceFeature: "Page Translation",
        providerId: "google",
        providerType: "translation",
        prompt: "text",
        latencyMs: 50,
        status: "success",
      },
    ]

    const deletedCount = await cleanupLegacyAuditLogs()
    expect(deletedCount).toBe(1)
    expect(mockState.logs).toHaveLength(2)
    expect(mockState.logs.map((l) => l.id)).toEqual(["new-1", "translation-1"])
  })

  it("searches audit logs by messages content and url", async () => {
    mockState.logs = [
      {
        id: "log-url",
        createdAt: new Date(),
        sourceFeature: "Chat",
        url: "https://special-domain.com",
        providerId: "openai",
        providerType: "llm",
        prompt: "test",
        latencyMs: 100,
        status: "success",
      },
      {
        id: "log-msg",
        createdAt: new Date(),
        sourceFeature: "Chat",
        providerId: "openai",
        providerType: "llm",
        prompt: "test",
        messages: [{ role: "user", content: "unique search term in message" }],
        latencyMs: 100,
        status: "success",
      },
    ]

    const resultUrl = await queryAuditLogs({ searchQuery: "special-domain" })
    expect(resultUrl.items).toHaveLength(1)
    expect(resultUrl.items[0]?.id).toBe("log-url")

    const resultMsg = await queryAuditLogs({ searchQuery: "unique search term" })
    expect(resultMsg.items).toHaveLength(1)
    expect(resultMsg.items[0]?.id).toBe("log-msg")
  })
})
