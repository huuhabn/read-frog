// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TranslateView } from "../translate-view"

const mockClearSelection = vi.fn<() => void>()
let mockSelectedSnippet: string | null = null

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" as const, setTheme: vi.fn<() => void>() }),
}))

vi.mock("@/utils/sidepanel/active-tab-selection", () => ({
  useActiveTabSelection: () => ({
    selectedSnippet: mockSelectedSnippet,
    clearSelection: mockClearSelection,
  }),
}))

vi.mock("@/utils/sidepanel/page-context", () => ({
  getActiveTabContent: vi.fn<() => Promise<{ selectedText: string }>>().mockResolvedValue({
    selectedText: "Sample text to translate",
  }),
}))

describe("TranslateView", () => {
  beforeEach(() => {
    mockClearSelection.mockClear()
    mockSelectedSnippet = null
  })

  it("renders header and translation controls with i18n keys", () => {
    render(<TranslateView />)

    expect(screen.getByText("sidePanel.translate.title")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.autoDetect")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.translateTo")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.action")).toBeDefined()
  })

  it("does not render the removed paste selection button", () => {
    render(<TranslateView />)
    expect(screen.queryByText("sidePanel.translate.pasteSelection")).toBeNull()
  })

  it("renders SelectionSnippetCard inside the card when text is selected and allows clearing it", () => {
    mockSelectedSnippet = "Hello world snippet"
    render(<TranslateView />)

    expect(screen.getByText("Text from your selection")).toBeDefined()
    expect(screen.getByText("Hello world snippet")).toBeDefined()

    const clearButton = screen.getByTitle("Clear selected text")
    fireEvent.click(clearButton)
    expect(mockClearSelection).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Hello world snippet")).toBeNull()
  })

  it("allows inserting selection snippet into textarea to edit and clears snippet", () => {
    mockSelectedSnippet = "Editable selection snippet"
    render(<TranslateView />)

    const editButton = screen.getByTitle("Edit in textarea")
    fireEvent.click(editButton)

    expect(mockClearSelection).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Text from your selection")).toBeNull()
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      "sidePanel.translate.placeholder",
    )
    expect(textarea.value).toBe("Editable selection snippet")
  })

  it("allows typing and clearing source text in textarea", () => {
    render(<TranslateView />)
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      "sidePanel.translate.placeholder",
    )

    fireEvent.change(textarea, { target: { value: "Custom text to translate" } })
    expect(textarea.value).toBe("Custom text to translate")

    const clearButton = screen.getByTitle("Clear text")
    fireEvent.click(clearButton)
    expect(textarea.value).toBe("")
  })
})
