// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_TRANSLATE_PREFERENCES,
  type TranslatePreferences,
} from "@/utils/sidepanel/translate-preferences"
import { TranslationPreferencesPopover } from "../translation-preferences-popover"

describe("TranslationPreferencesPopover", () => {
  it("renders preferences and allows changing length, tone, style, complexity, and custom prompt", () => {
    const onChange = vi.fn<(preferences: TranslatePreferences) => void>()
    const onOpenChange = vi.fn<(open: boolean) => void>()

    const initialPrefs: TranslatePreferences = {
      ...DEFAULT_TRANSLATE_PREFERENCES,
    }

    render(
      <TranslationPreferencesPopover
        open={true}
        onOpenChange={onOpenChange}
        preferences={initialPrefs}
        onChange={onChange}
      />,
    )

    expect(screen.getByText("Translation preferences")).toBeDefined()

    // Click Concise
    const conciseBtn = screen.getByRole("button", { name: "Concise" })
    fireEvent.click(conciseBtn)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        length: "concise",
      }),
    )

    // Type custom prompt
    const textarea = screen.getByPlaceholderText(/Keep tech terminology in English/i)
    fireEvent.change(textarea, { target: { value: "My custom system instructions" } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: "My custom system instructions",
      }),
    )

    // Click Reset button
    const resetBtn = screen.getByTitle("Reset to default")
    fireEvent.click(resetBtn)
    expect(onChange).toHaveBeenCalledWith(DEFAULT_TRANSLATE_PREFERENCES)
  })
})
