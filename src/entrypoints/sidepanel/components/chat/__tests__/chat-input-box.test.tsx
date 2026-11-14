// @vitest-environment jsdom
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectedModelConfig } from "@/utils/sidepanel/chat-model-storage"
import type { ActiveTabContent } from "@/utils/sidepanel/page-context"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatInputBox } from "../chat-input-box"

describe("ChatInputBox", () => {
  const mockModel: SelectedModelConfig = {
    providerId: "openai",
    model: "gpt-4o",
  }

  const mockLLMProviders: LLMProviderConfig[] = [
    {
      id: "openai",
      name: "OpenAI",
      enabled: true,
      model: "gpt-4o",
      apiKey: "sk-test",
    } as unknown as LLMProviderConfig,
  ]

  const mockActiveTab: ActiveTabContent = {
    id: 1,
    title: "Example Domain",
    url: "https://example.com",
    pageText: "Hello world",
  }

  it("renders textarea, model dropdown, tab context, and submit button", () => {
    const handleSend = vi.fn<() => void>()
    const handleStop = vi.fn<() => void>()
    const handleSetInput = vi.fn<(v: string) => void>()
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    const handleSetUsePageContext = vi.fn<(v: boolean) => void>()

    render(
      <ChatInputBox
        input=""
        setInput={handleSetInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={false}
        isTranslating={false}
        selectedModel={mockModel}
        onSelectModel={handleSelectModel}
        llmProviders={mockLLMProviders}
        usePageContext={true}
        setUsePageContext={handleSetUsePageContext}
        activeTab={mockActiveTab}
      />,
    )

    expect(screen.getByRole("textbox")).toBeDefined()
    expect(screen.getByText("gpt-4o")).toBeDefined()
  })

  it("calls onSend when submit button is clicked", () => {
    const handleSend = vi.fn<() => void>()
    const handleStop = vi.fn<() => void>()
    const handleSetInput = vi.fn<(v: string) => void>()
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    const handleSetUsePageContext = vi.fn<(v: boolean) => void>()

    render(
      <ChatInputBox
        input="Hello Workmate AI"
        setInput={handleSetInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={false}
        isTranslating={false}
        selectedModel={mockModel}
        onSelectModel={handleSelectModel}
        llmProviders={mockLLMProviders}
        usePageContext={true}
        setUsePageContext={handleSetUsePageContext}
        activeTab={mockActiveTab}
      />,
    )

    // The submit button is enabled when input has text
    const buttons = screen.getAllByRole("button")
    const submitBtn = buttons[buttons.length - 1]!
    fireEvent.click(submitBtn)
    expect(handleSend).toHaveBeenCalled()
  })

  it("renders stop button and calls onStop when isStreaming is true", () => {
    const handleSend = vi.fn<() => void>()
    const handleStop = vi.fn<() => void>()
    const handleSetInput = vi.fn<(v: string) => void>()
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    const handleSetUsePageContext = vi.fn<(v: boolean) => void>()

    render(
      <ChatInputBox
        input="Streaming text..."
        setInput={handleSetInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={true}
        isTranslating={false}
        selectedModel={mockModel}
        onSelectModel={handleSelectModel}
        llmProviders={mockLLMProviders}
        usePageContext={true}
        setUsePageContext={handleSetUsePageContext}
        activeTab={mockActiveTab}
      />,
    )

    const buttons = screen.getAllByRole("button")
    const stopBtn = buttons[buttons.length - 1]!
    fireEvent.click(stopBtn)
    expect(handleStop).toHaveBeenCalledTimes(1)
  })

  it("toggles page context when tab context button is clicked", () => {
    const handleSend = vi.fn<() => void>()
    const handleStop = vi.fn<() => void>()
    const handleSetInput = vi.fn<(v: string) => void>()
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    const handleSetUsePageContext = vi.fn<(v: boolean) => void>()

    render(
      <ChatInputBox
        input=""
        setInput={handleSetInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={false}
        isTranslating={false}
        selectedModel={mockModel}
        onSelectModel={handleSelectModel}
        llmProviders={mockLLMProviders}
        usePageContext={false}
        setUsePageContext={handleSetUsePageContext}
        activeTab={mockActiveTab}
      />,
    )

    // Find tab context button by its title (in test env i18n key is returned)
    const tabContextBtn = screen.getByTitle(/tabContext/i)
    expect(tabContextBtn).toBeDefined()
    fireEvent.click(tabContextBtn)
    expect(handleSetUsePageContext).toHaveBeenCalledWith(true)
  })

  it("disables tab context button on internal/restricted pages", () => {
    const handleSend = vi.fn<() => void>()
    const handleStop = vi.fn<() => void>()
    const handleSetInput = vi.fn<(v: string) => void>()
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    const handleSetUsePageContext = vi.fn<(v: boolean) => void>()

    render(
      <ChatInputBox
        input=""
        setInput={handleSetInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={false}
        isTranslating={false}
        selectedModel={mockModel}
        onSelectModel={handleSelectModel}
        llmProviders={mockLLMProviders}
        usePageContext={true}
        setUsePageContext={handleSetUsePageContext}
        activeTab={{
          id: 2,
          title: "Extensions",
          url: "chrome://extensions",
          pageText: "",
        }}
      />,
    )

    const restrictedBtn = screen.getByTitle(/chrome:\/\/extensions/i)
    expect(restrictedBtn).toBeDefined()
    expect(restrictedBtn.hasAttribute("disabled")).toBe(true)
    fireEvent.click(restrictedBtn)
    expect(handleSetUsePageContext).not.toHaveBeenCalled()
  })
})
