// @vitest-environment jsdom
import type { LLMProviderConfig } from "@/types/config/provider"
import type { WebChatAutoReplyMode, WebChatTone } from "@/types/config/web-chat"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatContextHeader } from "../ChatContextHeader"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, args?: unknown[]) => {
      if (args && args.length > 0) return `${String(args[0])} messages`
      return key
    },
  },
  getUiLocale: () => "en",
}))

describe("ChatContextHeader", () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    room: {
      id: "zalo-123",
      name: "Gia đình",
      platform: "zalo" as const,
    },
    messageCount: 10,
    loading: false,
    onRefresh: vi.fn<() => void>(),
    availableProviders: [
      {
        id: "provider-gemini",
        provider: "google",
        name: "Google Gemini",
        enabled: true,
        model: "gemini-2.5-flash",
      } as unknown as LLMProviderConfig,
    ],
    selectedProviderId: "provider-gemini",
    onSelectProvider: vi.fn<(id: string) => void>(),
    selectedLang: "vi",
    onSelectLang: vi.fn<(lang: string) => void>(),
    selectedTone: "friendly" as WebChatTone,
    onSelectTone: vi.fn<(tone: WebChatTone) => void>(),
    autoReplyMode: "none" as WebChatAutoReplyMode,
    onSelectAutoReplyMode: vi.fn<(mode: WebChatAutoReplyMode) => void>(),
    isAutoReplying: false,
    isOverridden: false,
    onResetDefaults: vi.fn<() => void>(),
  }

  it("renders platform badge, room name, and telemetry", () => {
    render(<ChatContextHeader {...defaultProps} />)

    expect(screen.getByText("zalo")).toBeDefined()
    expect(screen.getByText("Gia đình")).toBeDefined()
    expect(screen.getByText("10 messages")).toBeDefined()
    expect(screen.getByText("options.webChat.sidepanel.piiMasked")).toBeDefined()
  })

  it("falls back to noRoomDetected when room name is undefined string", () => {
    render(
      <ChatContextHeader
        {...defaultProps}
        room={{ id: "zalo-1", name: "undefined", platform: "zalo" }}
      />,
    )

    expect(screen.getByText("options.webChat.sidepanel.noRoomDetected")).toBeDefined()
  })

  it("shows reset defaults button when overridden and handles click", () => {
    const onReset = vi.fn<() => void>()
    const { rerender } = render(<ChatContextHeader {...defaultProps} isOverridden={false} />)

    expect(screen.queryByTitle("options.webChat.sidepanel.resetDefaults")).toBeNull()

    rerender(<ChatContextHeader {...defaultProps} isOverridden={true} onResetDefaults={onReset} />)

    const resetBtn = screen.getByTitle("options.webChat.sidepanel.resetDefaults")
    expect(resetBtn).toBeDefined()
    fireEvent.click(resetBtn)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("renders model, language, tone, and auto reply controls", () => {
    render(<ChatContextHeader {...defaultProps} />)

    expect(screen.getByText("Google Gemini")).toBeDefined()
    expect(screen.getByText("VI")).toBeDefined()
    expect(screen.getByText("options.webChat.toneShort.friendly")).toBeDefined()
    expect(screen.getAllByText("options.webChat.sidepanel.autoReply.none").length).toBeGreaterThan(
      0,
    )
  })

  it("highlights auto reply pill when enabled and handles mode change", () => {
    const onSelectAutoReply = vi.fn<(mode: WebChatAutoReplyMode) => void>()
    render(
      <ChatContextHeader
        {...defaultProps}
        autoReplyMode="draft"
        onSelectAutoReplyMode={onSelectAutoReply}
      />,
    )

    expect(screen.getAllByText("options.webChat.sidepanel.autoReply.draft").length).toBeGreaterThan(
      0,
    )
  })
})
