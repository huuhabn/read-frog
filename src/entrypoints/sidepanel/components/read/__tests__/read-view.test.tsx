// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReadView } from "../read-view"

vi.mock("@/utils/sidepanel/page-context", () => ({
  getActiveTabContent: vi
    .fn<() => Promise<{ title: string; url: string; pageText: string }>>()
    .mockResolvedValue({
      title: "Test Page",
      url: "https://example.com",
      pageText: "Sample article text for summarization.",
    }),
}))

describe("ReadView", () => {
  it("renders header and summary mode buttons with i18n keys", () => {
    render(<ReadView />)

    expect(screen.getByText("sidePanel.read.title")).toBeDefined()
    expect(screen.getByText("sidePanel.read.modes.keyPoints")).toBeDefined()
    expect(screen.getByText("sidePanel.read.modes.tldr")).toBeDefined()
    expect(screen.getByText("sidePanel.read.modes.outline")).toBeDefined()
    expect(screen.getByText("sidePanel.read.askInChat")).toBeDefined()
  })
})
