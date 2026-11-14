// @vitest-environment jsdom
import type { LLMProviderConfig } from "@/types/config/provider"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ModelSelectorDropdown } from "../model-selector-dropdown"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

describe("ModelSelectorDropdown", () => {
  afterEach(() => {
    cleanup()
  })

  const mockProviders = [
    {
      id: "provider-gemini",
      name: "Google Gemini",
      provider: "google",
      enabled: true,
      apiKey: "test",
      model: {
        model: "gemini-2.5-flash",
      },
    },
    {
      id: "provider-openai",
      name: "OpenAI",
      provider: "openai",
      enabled: true,
      apiKey: "test",
      model: {
        model: "gpt-4o",
      },
    },
  ] as unknown as LLMProviderConfig[]

  it("renders trigger with model name", () => {
    render(
      <ModelSelectorDropdown
        selectedProviderId="provider-gemini"
        selectedModelName="gemini-2.5-flash"
        onSelectModel={vi.fn<(providerId: string, model: string) => void>()}
        llmProviders={mockProviders}
      />,
    )

    expect(screen.getByText("gemini-2.5-flash")).toBeDefined()
  })

  it("opens menu and calls onSelectModel when an item is selected", () => {
    const handleSelectModel = vi.fn<(providerId: string, model: string) => void>()
    render(
      <ModelSelectorDropdown
        selectedProviderId="provider-gemini"
        selectedModelName="gemini-2.5-flash"
        onSelectModel={handleSelectModel}
        llmProviders={mockProviders}
      />,
    )

    const trigger = screen.getByTitle("gemini-2.5-flash")
    fireEvent.click(trigger)

    const openAiOption = screen.getByText("OpenAI")
    expect(openAiOption).toBeDefined()
    fireEvent.click(openAiOption)

    expect(handleSelectModel).toHaveBeenCalledWith("provider-openai", "gpt-4o")
  })
})
