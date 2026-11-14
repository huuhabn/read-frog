// @vitest-environment jsdom
import type { UpworkConfig } from "@/types/config/upwork"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatHeader } from "../chat-header"

describe("ChatHeader", () => {
  const mockUpworkConfig: UpworkConfig = {
    enabled: true,
    profile: "",
    wordCount: 150,
    tone: "professional",
    rules: "",
    examples: "",
    providerId: "",
    translateLang: "vi",
    translateProviderId: "",
    jobDetailsSelector: "",
    screeningQuestionsSelector: "",
    coverLetterInputSelector: "textarea",
  }

  const mockTranslationProviders: ProviderSelectorOption[] = [
    {
      kind: "system",
      id: "google-translate",
      name: "Google Translate",
      logo: () => "",
    },
  ]

  it("renders header title and triggers new chat / open history callbacks", () => {
    const handleNewChat = vi.fn<() => void>()
    const handleOpenHistory = vi.fn<() => void>()
    const handleSetUpworkConfig = vi.fn<(cfg: UpworkConfig) => void>()

    render(
      <ChatHeader
        onNewChat={handleNewChat}
        onOpenHistory={handleOpenHistory}
        upworkConfig={mockUpworkConfig}
        setUpworkConfig={handleSetUpworkConfig}
        translationProviders={mockTranslationProviders}
      />,
    )

    // Check title presence
    expect(screen.getByText("sidePanel.chat.title")).toBeDefined()

    // History button
    const historyBtn = screen.getByTitle("sidePanel.chat.history")
    expect(historyBtn).toBeDefined()
    fireEvent.click(historyBtn)
    expect(handleOpenHistory).toHaveBeenCalledTimes(1)

    // New chat button
    const newChatBtn = screen.getByTitle("sidePanel.chat.newChat")
    expect(newChatBtn).toBeDefined()
    fireEvent.click(newChatBtn)
    expect(handleNewChat).toHaveBeenCalledTimes(1)
  })
})
