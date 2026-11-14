// @vitest-environment jsdom
import type { ChatMessageItem as ChatMessageType } from "@/utils/db/dexie/tables/chat-session"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatMessageItem } from "../chat-message-item"

describe("ChatMessageItem", () => {
  const baseUserMessage: ChatMessageType = {
    id: "msg-user-1",
    role: "user",
    content: "Xin chào, đây là câu hỏi của tôi",
    createdAt: new Date(),
  }

  const baseAssistantMessage: ChatMessageType = {
    id: "msg-assistant-1",
    role: "assistant",
    content: "Xin chào! Tôi có thể giúp gì cho bạn?",
    createdAt: new Date(),
  }

  it("renders user message bubble and outside icon-only action buttons", () => {
    const handleCopy = vi.fn<(text: string, index: number) => void>()
    const handleToggleOriginal = vi.fn<(id: string) => void>()
    const handleToggleTranslateResponse = vi.fn<(msg: ChatMessageType) => void>()

    render(
      <ChatMessageItem
        message={baseUserMessage}
        index={0}
        isStreaming={false}
        isLast={false}
        isCopied={false}
        isTranslating={false}
        showOriginal={false}
        showTranslatedResponse={false}
        isUpworkJob={false}
        onCopy={handleCopy}
        onToggleOriginal={handleToggleOriginal}
        onToggleTranslateResponse={handleToggleTranslateResponse}
      />,
    )

    // User question text should be displayed
    expect(screen.getByText("Xin chào, đây là câu hỏi của tôi")).toBeDefined()

    // Copy button should be present with title and aria-label, but have NO text content
    const copyBtn = screen.getByTitle("sidePanel.chat.copy")
    expect(copyBtn).toBeDefined()
    expect(copyBtn.textContent?.trim()).toBe("")

    // Clicking copy should trigger onCopy
    fireEvent.click(copyBtn)
    expect(handleCopy).toHaveBeenCalledWith("Xin chào, đây là câu hỏi của tôi", 0)
  })

  it("renders user translate button when originalContent is present, icon only", () => {
    const handleToggleOriginal = vi.fn<(id: string) => void>()
    const userMsgWithOriginal: ChatMessageType = {
      ...baseUserMessage,
      originalContent: "Hello, this is my original prompt",
    }

    render(
      <ChatMessageItem
        message={userMsgWithOriginal}
        index={0}
        isStreaming={false}
        isLast={false}
        isCopied={false}
        isTranslating={false}
        showOriginal={false}
        showTranslatedResponse={false}
        isUpworkJob={false}
        onCopy={vi.fn<(text: string, index: number) => void>()}
        onToggleOriginal={handleToggleOriginal}
        onToggleTranslateResponse={vi.fn<(msg: ChatMessageType) => void>()}
      />,
    )

    const toggleBtn = screen.getByTitle("options.upwork.sidepanel.viewOriginal")
    expect(toggleBtn).toBeDefined()
    expect(toggleBtn.textContent?.trim()).toBe("")

    fireEvent.click(toggleBtn)
    expect(handleToggleOriginal).toHaveBeenCalledWith("msg-user-1")
  })

  it("renders assistant message and outside icon-only action buttons", () => {
    const handleCopy = vi.fn<(text: string, index: number) => void>()
    const handleToggleTranslate = vi.fn<(msg: ChatMessageType) => void>()
    const handleFillCoverLetter = vi.fn<(content: string, index: number) => void>()

    render(
      <ChatMessageItem
        message={baseAssistantMessage}
        index={1}
        isStreaming={false}
        isLast={true}
        isCopied={false}
        isTranslating={false}
        showOriginal={false}
        showTranslatedResponse={false}
        isUpworkJob={true}
        onCopy={handleCopy}
        onToggleOriginal={vi.fn<(id: string) => void>()}
        onToggleTranslateResponse={handleToggleTranslate}
        onFillCoverLetter={handleFillCoverLetter}
      />,
    )

    // Assistant response text should be displayed
    expect(screen.getByText("Xin chào! Tôi có thể giúp gì cho bạn?")).toBeDefined()

    // Translate button: icon only, no text
    const translateBtn = screen.getByTitle("options.upwork.sidepanel.viewTranslated")
    expect(translateBtn).toBeDefined()
    expect(translateBtn.textContent?.trim()).toBe("")
    fireEvent.click(translateBtn)
    expect(handleToggleTranslate).toHaveBeenCalledWith(baseAssistantMessage)

    // Fill into Upwork button (isUpworkJob=true): icon only, no text
    const fillBtn = screen.getByTitle("options.upwork.sidepanel.fillIntoUpwork")
    expect(fillBtn).toBeDefined()
    expect(fillBtn.textContent?.trim()).toBe("")
    fireEvent.click(fillBtn)
    expect(handleFillCoverLetter).toHaveBeenCalledWith(baseAssistantMessage.content, 1)

    // Copy button: icon only, no text
    const copyBtn = screen.getByTitle("sidePanel.chat.copy")
    expect(copyBtn).toBeDefined()
    expect(copyBtn.textContent?.trim()).toBe("")
    fireEvent.click(copyBtn)
    expect(handleCopy).toHaveBeenCalledWith(baseAssistantMessage.content, 1)
  })

  it("renders thinking indicator when assistant message is empty and streaming", () => {
    const emptyAssistantMessage: ChatMessageType = {
      id: "msg-assistant-2",
      role: "assistant",
      content: "",
      createdAt: new Date(),
    }

    render(
      <ChatMessageItem
        message={emptyAssistantMessage}
        index={1}
        isStreaming={true}
        isLast={true}
        isCopied={false}
        isTranslating={false}
        showOriginal={false}
        showTranslatedResponse={false}
        isUpworkJob={false}
        onCopy={vi.fn<(text: string, index: number) => void>()}
        onToggleOriginal={vi.fn<(id: string) => void>()}
        onToggleTranslateResponse={vi.fn<(msg: ChatMessageType) => void>()}
      />,
    )

    expect(screen.getByText("sidePanel.chat.thinking")).toBeDefined()
  })
})
