import type { AuditLogItem } from "@/utils/db/dexie/tables/audit-log"
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AuditLogDetailModal } from "../audit-log-detail-modal"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

describe("AuditLogDetailModal", () => {
  const baseLog: AuditLogItem = {
    id: "log-1",
    createdAt: new Date("2026-11-13T10:00:00Z"),
    sourceFeature: "Sidepanel Chat",
    url: "https://example.com/test-article",
    providerId: "openai",
    providerType: "llm",
    model: "gpt-4o",
    systemPrompt: "You are a helpful assistant.",
    prompt: "What is AI?",
    messages: [
      { role: "user", content: "What is AI?" },
      { role: "assistant", content: "AI stands for Artificial Intelligence." },
    ],
    tokenUsage: {
      promptTokens: 12,
      completionTokens: 25,
      totalTokens: 37,
    },
    parameters: {
      temperature: 0.7,
      maxTokens: 1000,
    },
    responseOutput: "AI stands for Artificial Intelligence.",
    thinking: "Let me explain AI clearly.",
    latencyMs: 450,
    status: "success",
    rawPayload: {
      test: true,
    },
  }

  it("renders structured messages timeline and metadata", () => {
    render(<AuditLogDetailModal isOpen={true} onClose={() => {}} log={baseLog} />)

    expect(screen.getByText("Sidepanel Chat")).toBeDefined()
    expect(screen.getByText("https://example.com/test-article")).toBeDefined()
    expect(screen.getByText("You are a helpful assistant.")).toBeDefined()
    expect(screen.getByText("Lịch sử hội thoại (2 tin nhắn)")).toBeDefined()
    expect(screen.getByText("What is AI?")).toBeDefined()
    expect(screen.getAllByText("AI stands for Artificial Intelligence.")).toHaveLength(2)
    expect(screen.getByText("Let me explain AI clearly.")).toBeDefined()
    expect(screen.getByText(/P: 12/)).toBeDefined()
    expect(screen.getByText(/Total: 37/)).toBeDefined()
  })

  it("renders prompt fallback when messages are not present", () => {
    const legacyLog: AuditLogItem = {
      ...baseLog,
      messages: undefined,
    }

    render(<AuditLogDetailModal isOpen={true} onClose={() => {}} log={legacyLog} />)

    expect(screen.getByText("options.advanced.auditLogs.promptContent")).toBeDefined()
    expect(screen.getByText("What is AI?")).toBeDefined()
  })

  it("toggles raw JSON viewer on click", () => {
    render(<AuditLogDetailModal isOpen={true} onClose={() => {}} log={baseLog} />)

    expect(screen.queryByText('"test": true')).toBeNull()

    const rawJsonBtn = screen.getByText(/Raw JSON Payload/)
    fireEvent.click(rawJsonBtn)

    expect(screen.getByText(/"test": true/)).toBeDefined()
  })
})
