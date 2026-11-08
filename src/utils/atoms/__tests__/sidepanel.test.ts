import { getDefaultStore } from "jotai"
import { describe, expect, it } from "vitest"
import {
  activeChatSessionIdAtom,
  includePageContextAtom,
  selectedChatModelAtom,
  sidepanelNavTabAtom,
} from "../sidepanel"

describe("Sidepanel Atoms", () => {
  it("should have correct initial values", () => {
    const store = getDefaultStore()
    expect(store.get(sidepanelNavTabAtom)).toBe("chat")
    expect(store.get(activeChatSessionIdAtom)).toBeNull()
    expect(store.get(includePageContextAtom)).toBe(false)
    expect(store.get(selectedChatModelAtom)).toEqual({
      providerId: "openrouter",
      model: "google/gemma-4-31b-it:free",
    })
  })

  it("should update atom values correctly", () => {
    const store = getDefaultStore()
    store.set(sidepanelNavTabAtom, "read")
    expect(store.get(sidepanelNavTabAtom)).toBe("read")

    store.set(includePageContextAtom, true)
    expect(store.get(includePageContextAtom)).toBe(true)

    store.set(selectedChatModelAtom, {
      providerId: "openai",
      model: "gpt-4o",
    })
    expect(store.get(selectedChatModelAtom)).toEqual({
      providerId: "openai",
      model: "gpt-4o",
    })
  })
})
