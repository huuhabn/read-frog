// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatEmptyState, QUICK_PROMPT_KEYS } from "../chat-empty-state"

describe("ChatEmptyState", () => {
  it("renders empty state with quick prompts and handles clicks", () => {
    const handleSendPrompt = vi.fn<(prompt: string) => void>()

    render(<ChatEmptyState isUpworkJob={false} onSendPrompt={handleSendPrompt} />)

    expect(screen.getByText("sidePanel.chat.title")).toBeDefined()
    expect(screen.getByText("sidePanel.chat.description")).toBeDefined()

    // Base quick prompts should be rendered
    const firstPrompt = screen.getByText(QUICK_PROMPT_KEYS[0])
    expect(firstPrompt).toBeDefined()
    fireEvent.click(firstPrompt)
    expect(handleSendPrompt).toHaveBeenCalledWith(QUICK_PROMPT_KEYS[0])
  })

  it("renders Upwork quick prompts when isUpworkJob is true", () => {
    const handleSendPrompt = vi.fn<(prompt: string) => void>()

    render(<ChatEmptyState isUpworkJob={true} onSendPrompt={handleSendPrompt} />)

    const coverLetterBtn = screen.getByText(/Viết Upwork Cover Letter/i)
    expect(coverLetterBtn).toBeDefined()
    fireEvent.click(coverLetterBtn)
    expect(handleSendPrompt).toHaveBeenCalled()
  })
})
