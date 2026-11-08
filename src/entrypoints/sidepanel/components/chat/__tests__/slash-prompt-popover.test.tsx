// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CUSTOM_AI_ACTIONS, type CustomAIAction } from "../custom-ai-actions"
import { SlashPromptPopover } from "../slash-prompt-popover"

describe("SlashPromptPopover", () => {
  it("renders Custom AI Actions header and action items", () => {
    const handleSelect = vi.fn<(action: CustomAIAction) => void>()
    const handleClose = vi.fn<() => void>()
    const handleHover = vi.fn<(index: number) => void>()

    render(
      <SlashPromptPopover
        query=""
        actions={CUSTOM_AI_ACTIONS}
        selectedIndex={0}
        onSelect={handleSelect}
        onClose={handleClose}
        onHoverIndex={handleHover}
      />,
    )

    expect(screen.getByText("Custom AI Actions")).toBeDefined()
    expect(screen.getByText(String(CUSTOM_AI_ACTIONS.length))).toBeDefined()
    expect(screen.getByText("Tóm tắt nội dung (Summarize)")).toBeDefined()
  })

  it("calls onSelect when an action item is clicked", () => {
    const handleSelect = vi.fn<(action: CustomAIAction) => void>()
    const handleClose = vi.fn<() => void>()
    const handleHover = vi.fn<(index: number) => void>()

    render(
      <SlashPromptPopover
        query=""
        actions={CUSTOM_AI_ACTIONS}
        selectedIndex={0}
        onSelect={handleSelect}
        onClose={handleClose}
        onHoverIndex={handleHover}
      />,
    )

    const firstItem = screen.getByText("Tóm tắt nội dung (Summarize)")
    fireEvent.click(firstItem)

    expect(handleSelect).toHaveBeenCalledWith(CUSTOM_AI_ACTIONS[0])
  })

  it("calls onClose when the close button is clicked", () => {
    const handleSelect = vi.fn<(action: CustomAIAction) => void>()
    const handleClose = vi.fn<() => void>()
    const handleHover = vi.fn<(index: number) => void>()

    render(
      <SlashPromptPopover
        query=""
        actions={CUSTOM_AI_ACTIONS}
        selectedIndex={0}
        onSelect={handleSelect}
        onClose={handleClose}
        onHoverIndex={handleHover}
      />,
    )

    const closeBtn = screen.getByTitle("Đóng menu")
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledOnce()
  })

  it("renders empty state when actions array is empty", () => {
    const handleSelect = vi.fn<(action: CustomAIAction) => void>()
    const handleClose = vi.fn<() => void>()
    const handleHover = vi.fn<(index: number) => void>()

    render(
      <SlashPromptPopover
        query="unknownxyz"
        actions={[]}
        selectedIndex={0}
        onSelect={handleSelect}
        onClose={handleClose}
        onHoverIndex={handleHover}
      />,
    )

    expect(screen.getByText(/Không tìm thấy action phù hợp/)).toBeDefined()
  })
})
