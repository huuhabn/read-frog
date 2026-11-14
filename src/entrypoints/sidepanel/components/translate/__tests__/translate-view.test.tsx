// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TranslateView } from "../translate-view"

vi.mock("@/utils/sidepanel/page-context", () => ({
  getActiveTabContent: vi.fn<() => Promise<{ selectedText: string }>>().mockResolvedValue({
    selectedText: "Sample text to translate",
  }),
}))

describe("TranslateView", () => {
  it("renders header and translation controls with i18n keys", () => {
    render(<TranslateView />)

    expect(screen.getByText("sidePanel.translate.title")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.pasteSelection")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.autoDetect")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.translateTo")).toBeDefined()
    expect(screen.getByText("sidePanel.translate.action")).toBeDefined()
  })
})
