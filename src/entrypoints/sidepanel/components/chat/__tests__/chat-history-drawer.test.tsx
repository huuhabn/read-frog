// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatHistoryDrawer } from "../chat-history-drawer"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    chatSession: {
      orderBy: vi.fn<() => unknown>().mockReturnValue({
        reverse: vi.fn<() => unknown>().mockReturnValue({
          toArray: vi.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              id: "session-1",
              title: "React components help",
              model: "gemini-1.5-flash",
              updatedAt: Date.now(),
              messages: [{ id: "m1" }, { id: "m2" }],
            },
            {
              id: "session-2",
              title: "Translate document",
              model: "gpt-4o-mini",
              updatedAt: Date.now() - 3600000,
              messages: [{ id: "m3" }],
            },
          ]),
        }),
      }),
      delete: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    },
  },
}))

describe("ChatHistoryDrawer", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <ChatHistoryDrawer
        isOpen={false}
        currentSessionId={null}
        onClose={vi.fn<() => void>()}
        onSelectSession={vi.fn<(id: string) => void>()}
        onNewChat={vi.fn<() => void>()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders session list and handles selection", async () => {
    const handleSelectSession = vi.fn<(id: string) => void>()
    const handleClose = vi.fn<() => void>()

    render(
      <ChatHistoryDrawer
        isOpen={true}
        currentSessionId="session-1"
        onClose={handleClose}
        onSelectSession={handleSelectSession}
        onNewChat={vi.fn<() => void>()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("React components help")).toBeDefined()
      expect(screen.getByText("Translate document")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Translate document"))
    expect(handleSelectSession).toHaveBeenCalledWith("session-2")
    expect(handleClose).toHaveBeenCalled()
  })
})
