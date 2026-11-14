// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useActiveTabSelection } from "../active-tab-selection"

let mockSelectedText = ""
vi.mock("../page-context", () => ({
  getActiveTabSelectedText: vi.fn<() => Promise<string>>().mockImplementation(async () => {
    return mockSelectedText
  }),
}))

describe("useActiveTabSelection", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSelectedText = ""
  })

  it("detects selected snippet on initial check", async () => {
    mockSelectedText = "Sample selection"
    const { result } = renderHook(() => useActiveTabSelection())

    expect(result.current.selectedSnippet).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current.selectedSnippet).toBe("Sample selection")
  })

  it("clears selection on clearSelection and does NOT immediately recreate when same text is returned", async () => {
    mockSelectedText = "Sample selection"
    const { result } = renderHook(() => useActiveTabSelection())

    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.selectedSnippet).toBe("Sample selection")

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectedSnippet).toBeNull()

    // Even if periodic check returns the same text, it must remain null (dismissed)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.selectedSnippet).toBeNull()

    // Even if check momentarily returned empty string and then returned same text again
    mockSelectedText = ""
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    mockSelectedText = "Sample selection"
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.selectedSnippet).toBeNull()

    // But if a brand new selection is made on the web page, it updates
    mockSelectedText = "Brand new selection"
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.selectedSnippet).toBe("Brand new selection")
  })
})
