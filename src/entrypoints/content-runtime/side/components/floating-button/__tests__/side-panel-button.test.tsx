// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SidePanelButton from "../side-panel-button"

const mockSendMessage = vi.fn<(...args: any[]) => any>()

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("../../../main", () => ({
  shadowWrapper: document.body,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => {
      if (key === "options.floatingButton.tooltips.sidePanel") return "AI Side Panel"
      return key
    },
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: any[]) => mockSendMessage(...args),
}))

describe("SidePanelButton", () => {
  it("renders with proper label and sends toggleSidePanel on click", () => {
    render(<SidePanelButton expanded={true} side="right" />)

    const button = screen.getByRole("button", { name: "AI Side Panel" })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockSendMessage).toHaveBeenCalledWith("toggleSidePanel", undefined)
  })
})
