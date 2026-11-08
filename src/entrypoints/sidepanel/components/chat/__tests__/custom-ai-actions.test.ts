import { describe, expect, it } from "vitest"
import {
  CUSTOM_AI_ACTIONS,
  filterCustomAIActions,
  normalizeSearchString,
} from "../custom-ai-actions"

describe("custom-ai-actions", () => {
  it("normalizes text and removes accents correctly", () => {
    expect(normalizeSearchString("Tóm tắt")).toBe("tom tat")
    expect(normalizeSearchString("Dịch Thuật")).toBe("dich thuat")
    expect(normalizeSearchString("  Code Review  ")).toBe("code review")
  })

  it("returns all actions when query is empty or slash alone", () => {
    expect(filterCustomAIActions("")).toHaveLength(CUSTOM_AI_ACTIONS.length)
    expect(filterCustomAIActions("/")).toHaveLength(CUSTOM_AI_ACTIONS.length)
    expect(filterCustomAIActions("   ")).toHaveLength(CUSTOM_AI_ACTIONS.length)
  })

  it("filters actions by keyword with leading slash", () => {
    const codeResults = filterCustomAIActions("/code")
    expect(codeResults.length).toBeGreaterThan(0)
    expect(codeResults.some((a) => a.id === "code-review")).toBe(true)

    const translateResults = filterCustomAIActions("/dich")
    expect(translateResults.length).toBeGreaterThanOrEqual(2)
    expect(translateResults.some((a) => a.id === "translate-vi")).toBe(true)
    expect(translateResults.some((a) => a.id === "translate-en")).toBe(true)
  })

  it("filters actions with accent-insensitive search", () => {
    const results = filterCustomAIActions("/tom")
    expect(results.some((a) => a.id === "summarize")).toBe(true)
  })

  it("returns empty array when no matches are found", () => {
    const results = filterCustomAIActions("/xyznonexistent123")
    expect(results).toHaveLength(0)
  })
})
