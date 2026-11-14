// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { UpworkSettingsPage } from "../index"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
  getUiLocale: () => "en",
}))

describe("UpworkSettingsPage", () => {
  it("renders all sections and inputs with default config", () => {
    render(
      <JotaiProvider>
        <UpworkSettingsPage />
      </JotaiProvider>,
    )

    // Check headings / items
    expect(screen.getByText("options.upwork.title")).toBeDefined()
    expect(screen.getByText("options.upwork.profileSection.title")).toBeDefined()
    expect(screen.getByText("options.upwork.parametersSection.title")).toBeDefined()
    expect(screen.getByText("options.upwork.selectorsSection.title")).toBeDefined()

    // Check inputs exist
    expect(screen.getByDisplayValue(DEFAULT_CONFIG.upwork.jobDetailsSelector)).toBeDefined()
    expect(screen.getByDisplayValue(DEFAULT_CONFIG.upwork.screeningQuestionsSelector)).toBeDefined()
    expect(screen.getByDisplayValue(DEFAULT_CONFIG.upwork.coverLetterInputSelector)).toBeDefined()
  })

  it("updates profile text when typed", () => {
    render(
      <JotaiProvider>
        <UpworkSettingsPage />
      </JotaiProvider>,
    )

    const placeholder = "options.upwork.profileSection.placeholder"
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(placeholder)
    expect(textarea).toBeDefined()

    fireEvent.change(textarea, { target: { value: "My awesome profile facts" } })
    expect(textarea.value).toBe("My awesome profile facts")
  })
})
