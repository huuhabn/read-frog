import type { AuditLogItem } from "@/utils/db/dexie/tables/audit-log"
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuditLogsPage } from "../index"

const mockState = vi.hoisted(() => ({
  logs: [
    {
      id: "log-1",
      createdAt: new Date("2026-11-08T10:00:00Z"),
      sourceFeature: "Side Panel Chat",
      providerId: "openai",
      providerType: "llm" as const,
      model: "gpt-4o",
      prompt: "Hello world prompt",
      responseOutput: "Hello response",
      latencyMs: 320,
      status: "success" as const,
    },
  ] as AuditLogItem[],
}))

vi.mock("@/utils/audit-log/audit-log-service", () => ({
  queryAuditLogs: vi
    .fn<(...args: unknown[]) => Promise<{ items: typeof mockState.logs; total: number }>>()
    .mockImplementation(async () => ({
      items: mockState.logs,
      total: mockState.logs.length,
    })),
  deleteAuditLog: vi.fn<(id: string) => Promise<void>>().mockImplementation(async (id) => {
    mockState.logs = mockState.logs.filter((l) => l.id !== id)
  }),
  clearAllAuditLogs: vi.fn<() => Promise<void>>().mockImplementation(async () => {
    mockState.logs = []
  }),
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && "count" in params) return `Total: ${String(params.count)}`
      return key
    },
  },
}))

vi.mock("jotai", async () => {
  const actual = await vi.importActual("jotai")
  return {
    ...actual,
    useAtomValue: vi
      .fn<() => { enabled: boolean; retentionDays: number; maxLogs: number }>()
      .mockReturnValue({
        enabled: true,
        retentionDays: 30,
        maxLogs: 1000,
      }),
  }
})

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

describe("AuditLogsPage", () => {
  beforeEach(() => {
    mockState.logs = [
      {
        id: "log-1",
        createdAt: new Date("2026-11-08T10:00:00Z"),
        sourceFeature: "Side Panel Chat",
        providerId: "openai",
        providerType: "llm" as const,
        model: "gpt-4o",
        prompt: "Hello world prompt",
        responseOutput: "Hello response",
        latencyMs: 320,
        status: "success" as const,
      },
    ]
  })

  it("renders the table with audit log item", async () => {
    render(<AuditLogsPage />)

    await waitFor(() => {
      expect(screen.getByText("Hello world prompt")).toBeDefined()
      expect(screen.getByText("gpt-4o")).toBeDefined()
      expect(screen.getByText("320 ms")).toBeDefined()
    })
  })

  it("opens detail modal when clicking view button", async () => {
    render(<AuditLogsPage />)

    await waitFor(() => {
      expect(screen.getByText("Hello world prompt")).toBeDefined()
    })

    const viewBtn = screen.getByTitle("options.advanced.auditLogs.viewDetail")
    fireEvent.click(viewBtn)

    await waitFor(() => {
      expect(screen.getByText("options.advanced.auditLogs.detailTitle")).toBeDefined()
      expect(screen.getByText("Hello response")).toBeDefined()
    })
  })
})
