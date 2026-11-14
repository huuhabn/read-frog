// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LanguageSelectorDropdown } from "../language-selector-dropdown"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

describe("LanguageSelectorDropdown", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders trigger with current language name", () => {
    render(
      <LanguageSelectorDropdown selectedCode="vi" onSelect={vi.fn<(option: unknown) => void>()} />,
    )

    expect(screen.getByText("Tiếng Việt")).toBeDefined()
  })

  it("displays auto-detect when allowAutoDetect is true and code is auto", () => {
    render(
      <LanguageSelectorDropdown
        selectedCode="auto"
        allowAutoDetect
        onSelect={vi.fn<(option: unknown) => void>()}
      />,
    )

    expect(screen.getByText("sidePanel.translate.autoDetect")).toBeDefined()
  })

  it("triggers onSelect when choosing another language", () => {
    const handleSelect = vi.fn<(option: unknown) => void>()
    render(<LanguageSelectorDropdown selectedCode="vi" onSelect={handleSelect} />)

    const trigger = screen.getByText("Tiếng Việt")
    fireEvent.click(trigger)

    const englishOption = screen.getByText("English")
    expect(englishOption).toBeDefined()
    fireEvent.click(englishOption)

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ code: "en", name: "English" }),
    )
  })
})
