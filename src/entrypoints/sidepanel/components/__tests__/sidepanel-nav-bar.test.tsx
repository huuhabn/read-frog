// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SidePanelNavBar } from "../sidepanel-nav-bar"

vi.mock("@/utils/navigation", () => ({
  openOptionsPage: vi.fn<() => Promise<void>>(),
}))

describe("SidePanelNavBar", () => {
  it("renders navigation items with localized tooltips", () => {
    render(<SidePanelNavBar />)

    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  it("triggers openOptionsPage when settings and logs buttons are clicked", async () => {
    const { openOptionsPage } = await import("@/utils/navigation")
    render(<SidePanelNavBar />)

    const buttons = screen.getAllByRole("button")
    const settingsBtn = buttons[buttons.length - 1]!
    fireEvent.click(settingsBtn)

    expect(openOptionsPage).toHaveBeenCalledWith({ route: "/providers" })
  })
})
