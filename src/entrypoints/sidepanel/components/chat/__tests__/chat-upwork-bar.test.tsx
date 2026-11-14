// @vitest-environment jsdom
import type { UpworkConfig } from "@/types/config/upwork"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatUpworkBar } from "../chat-upwork-bar"

describe("ChatUpworkBar", () => {
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

  it("returns null when isUpworkJob is false", () => {
    const { container } = render(
      <ChatUpworkBar
        isUpworkJob={false}
        upworkConfig={mockUpworkConfig}
        setUpworkConfig={vi.fn<(cfg: UpworkConfig) => void>()}
        translationProviders={mockTranslationProviders}
        onCoverLetter={vi.fn<() => void>()}
        isStreaming={false}
        isTranslating={false}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders Upwork quick action bar and calls onCoverLetter", () => {
    const handleCoverLetter = vi.fn<() => void>()

    render(
      <ChatUpworkBar
        isUpworkJob={true}
        upworkConfig={mockUpworkConfig}
        setUpworkConfig={vi.fn<(cfg: UpworkConfig) => void>()}
        translationProviders={mockTranslationProviders}
        onCoverLetter={handleCoverLetter}
        isStreaming={false}
        isTranslating={false}
      />,
    )

    expect(screen.getByText("options.upwork.sidepanel.quickActionLabel")).toBeDefined()

    const coverLetterBtn = screen.getByText("options.upwork.sidepanel.coverLetter")
    fireEvent.click(coverLetterBtn)
    expect(handleCoverLetter).toHaveBeenCalledTimes(1)
  })
})
