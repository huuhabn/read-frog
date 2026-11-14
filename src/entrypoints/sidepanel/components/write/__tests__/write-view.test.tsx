// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WriteView } from "../write-view"

vi.mock("@/utils/sidepanel/page-context", () => ({
  getActiveTabContent: vi.fn<() => Promise<{ selectedText: string }>>().mockResolvedValue({
    selectedText: "Sample text to rewrite",
  }),
}))

describe("WriteView", () => {
  it("renders header and write action buttons with i18n keys", () => {
    render(<WriteView />)

    expect(screen.getByText("sidePanel.write.title")).toBeDefined()
    expect(screen.getByText("sidePanel.write.actions.polish")).toBeDefined()
    expect(screen.getByText("sidePanel.write.actions.formal")).toBeDefined()
    expect(screen.getByText("sidePanel.write.actions.casual")).toBeDefined()
    expect(screen.getByText("sidePanel.write.actions.shorten")).toBeDefined()
    expect(screen.getByText("sidePanel.write.actions.grammar")).toBeDefined()
  })
})
